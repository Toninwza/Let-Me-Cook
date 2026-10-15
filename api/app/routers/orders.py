"""Checkout (U-Pay). Contract: docs/contract.md "Order" and "[P2] checkout"."""

import asyncio
import logging
import secrets
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlmodel import Session, col, select

from app import catalog, payments
from app.db import engine
from app.models import AppUser, Order, Product, Shop, utcnow
from app.ratelimit import limit
from app.schemas import Order as OrderOut
from app.schemas import ShopInfo

log = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])

MIN_TOTAL_THB = 10.0  # Stripe's minimum charge for THB
PURCHASE_HISTORY_KEEP = 20
CANCELLABLE = {"pending_confirm", "awaiting_payment", "payment_failed"}
NEXT_STATUS = {"shipped": "paid", "delivered": "shipped"}  # target -> required current status


class OrderIn(BaseModel):
    session_id: str | None = None
    user_id: str
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)
    payment_method: Literal["promptpay", "avax_escrow"] = "promptpay"


class StatusIn(BaseModel):
    status: Literal["shipped", "delivered"]


# ---------- DB helpers (sync, run in a thread) ----------


def _out(order: Order, shop: Shop) -> OrderOut:
    return OrderOut(
        order_id=order.id,
        session_id=order.session_id,
        user_id=order.user_id,
        product_id=order.product_id,
        title=order.title,
        shop=ShopInfo(shop_id=shop.id, name=shop.name, rating=shop.rating, ship_days=shop.ship_days),
        quantity=order.quantity,
        unit_price=order.unit_price,
        subtotal=order.subtotal,
        utag_discount_percent=order.utag_discount_percent,
        utag_discount=order.utag_discount,
        total=order.total,
        delivery_date=order.delivery_date,
        address=order.address,
        payment_method=order.payment_method,
        status=order.status,
        payment_qr_url=order.payment_qr_url,
        payment_test_url=order.payment_test_url,
        payment_expires_at=order.payment_expires_at,
        created_at=order.created_at,
        paid_at=order.paid_at,
        shipped_at=order.shipped_at,
        delivered_at=order.delivered_at,
        tracking_number=order.tracking_number,
    )


def _get(order_id: str) -> Order:
    with Session(engine) as session:
        order = session.get(Order, order_id)
        if order is None:
            raise HTTPException(404, "ไม่พบคำสั่งซื้อ")
        return order


def _read(order_id: str) -> OrderOut:
    with Session(engine) as session:
        order = session.get(Order, order_id)
        if order is None:
            raise HTTPException(404, "ไม่พบคำสั่งซื้อ")
        return _out(order, session.get(Shop, order.shop_id))


def _save(order_id: str, **fields) -> OrderOut:
    with Session(engine) as session:
        order = session.get(Order, order_id)
        for key, value in fields.items():
            setattr(order, key, value)
        session.add(order)
        session.commit()
        session.refresh(order)
        return _out(order, session.get(Shop, order.shop_id))


def _mark_paid(order_id: str) -> None:
    """awaiting_payment -> paid and stock -= quantity, exactly once even if polls race."""
    with Session(engine) as session:
        changed = session.exec(
            update(Order)
            .where(col(Order.id) == order_id, col(Order.status) == "awaiting_payment")
            .values(status="paid", paid_at=utcnow())
        ).rowcount
        if changed:
            order = session.get(Order, order_id)
            product = session.get(Product, order.product_id)
            product.stock = max(0, product.stock - order.quantity)
            session.add(product)
            # U-Tag learns: the agent reads purchase_history on the next search.
            user = session.get(AppUser, order.user_id)
            bought = {
                "product_id": product.id,
                "title": order.title,
                "category": product.category,
                "price": order.unit_price,
                "purchased_at": utcnow().isoformat(),
            }
            # A new list (not .insert) so SQLAlchemy sees the JSON column changed.
            user.purchase_history = [bought, *user.purchase_history][:PURCHASE_HISTORY_KEEP]
            session.add(user)
        session.commit()


def _mark_failed(order_id: str) -> None:
    with Session(engine) as session:
        session.exec(
            update(Order)
            .where(col(Order.id) == order_id, col(Order.status) == "awaiting_payment")
            .values(status="payment_failed")
        )
        session.commit()


# ---------- Stripe sync ----------


async def _sync(order: Order) -> None:
    """Ask Stripe how an awaiting_payment order is doing and store the result."""
    if order.status != "awaiting_payment" or not order.payment_intent_id:
        return
    try:
        status = await payments.intent_status(order.payment_intent_id)
    except (stripe.StripeError, payments.PaymentsNotConfigured):
        log.exception("stripe status check failed for %s", order.id)
        return
    if status == "succeeded":
        await asyncio.to_thread(_mark_paid, order.id)
    elif status in ("requires_payment_method", "canceled"):
        await asyncio.to_thread(_mark_failed, order.id)


async def _synced(order_id: str) -> OrderOut:
    await _sync(await asyncio.to_thread(_get, order_id))
    return await asyncio.to_thread(_read, order_id)


# ---------- routes ----------


@router.post("", status_code=201)
async def create_order(body: OrderIn) -> OrderOut:
    if body.payment_method == "avax_escrow":
        raise HTTPException(400, "การจ่ายผ่าน AVAX escrow ยังไม่เปิดใช้งาน")
    hit = await catalog.get_product(body.product_id)
    if hit is None:
        raise HTTPException(404, "ไม่พบสินค้า")
    if body.quantity > hit.stock:
        raise HTTPException(409, f"สินค้าเหลือ {hit.stock} ชิ้น")

    def insert() -> OrderOut:
        with Session(engine) as session:
            user = session.get(AppUser, body.user_id)
            if user is None:
                raise HTTPException(404, "ไม่พบผู้ใช้")
            subtotal = round(hit.price * body.quantity, 2)
            discount = round(subtotal * user.discount_percent / 100, 2)
            order = Order(
                session_id=body.session_id,
                user_id=user.id,
                product_id=hit.product_id,
                shop_id=hit.shop.shop_id,
                title=hit.title,
                quantity=body.quantity,
                unit_price=hit.price,
                subtotal=subtotal,
                utag_discount_percent=user.discount_percent,
                utag_discount=discount,
                total=max(round(subtotal - discount, 2), MIN_TOTAL_THB),
                delivery_date=hit.delivery_date,
                address=user.address,
                payment_method=body.payment_method,
                status="pending_confirm",
            )
            session.add(order)
            session.commit()
            session.refresh(order)
            return _out(order, session.get(Shop, order.shop_id))

    return await asyncio.to_thread(insert)


@router.post("/{order_id}/confirm", dependencies=[Depends(limit("confirm", 10))])
async def confirm_order(order_id: str) -> OrderOut:
    order = await asyncio.to_thread(_get, order_id)
    if order.status not in ("pending_confirm", "payment_failed"):
        raise HTTPException(409, "คำสั่งซื้อนี้ยืนยันไปแล้ว")
    hit = await catalog.get_product(order.product_id)
    if hit is None or hit.stock < order.quantity:
        raise HTTPException(409, "สินค้าหมดระหว่างทำรายการ")
    try:
        qr = await payments.create_promptpay(order.id, order.total, f"{order.user_id}@example.com")
    except payments.PaymentsNotConfigured:
        raise HTTPException(503, "ระบบชำระเงินยังไม่ได้ตั้งค่า")
    except stripe.StripeError:
        log.exception("stripe create failed for %s", order.id)
        raise HTTPException(502, "สร้าง QR ชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งครับ")
    return await asyncio.to_thread(
        _save,
        order.id,
        status="awaiting_payment",
        payment_intent_id=qr.payment_intent_id,
        payment_qr_url=qr.image_url,
        payment_test_url=qr.test_url,
        payment_expires_at=qr.expires_at,
    )


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str) -> OrderOut:
    order = await asyncio.to_thread(_get, order_id)
    if order.status not in CANCELLABLE:
        raise HTTPException(409, "ยกเลิกคำสั่งซื้อนี้ไม่ได้แล้ว")
    if order.payment_intent_id:
        await payments.cancel(order.payment_intent_id)
        # The user may have paid a moment before cancelling: trust Stripe over the button.
        current = await _synced(order_id)
        if current.status == "paid":
            raise HTTPException(409, "ชำระเงินแล้ว ยกเลิกไม่ได้")
    return await asyncio.to_thread(_save, order_id, status="cancelled")


@router.post("/{order_id}/status")
async def update_status(order_id: str, body: StatusIn) -> OrderOut:
    order = await asyncio.to_thread(_get, order_id)
    if order.status != NEXT_STATUS[body.status]:
        raise HTTPException(409, f"เปลี่ยนจาก {order.status} เป็น {body.status} ไม่ได้")
    now = utcnow()
    if body.status == "shipped":
        tracking = "LMC" + "".join(secrets.choice("0123456789") for _ in range(8))
        return await asyncio.to_thread(_save, order_id, status="shipped", shipped_at=now, tracking_number=tracking)
    return await asyncio.to_thread(_save, order_id, status="delivered", delivered_at=now)


@router.get("/{order_id}")
async def get_order(order_id: str) -> OrderOut:
    return await _synced(order_id)


@router.get("")
async def list_orders(shop_id: str | None = None, user_id: str | None = None) -> list[OrderOut]:
    def load() -> list[Order]:
        query = select(Order).order_by(col(Order.created_at).desc())
        if shop_id:
            query = query.where(Order.shop_id == shop_id)
        if user_id:
            query = query.where(Order.user_id == user_id)
        with Session(engine) as session:
            return list(session.exec(query).all())

    orders = await asyncio.to_thread(load)
    await asyncio.gather(*(_sync(o) for o in orders if o.status == "awaiting_payment"))
    return await asyncio.gather(*(asyncio.to_thread(_read, o.id) for o in orders))
