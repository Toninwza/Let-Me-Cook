"""Cart. Contract: docs/contract.md "[P2] cart"."""

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app import catalog
from app.db import engine
from app.models import AppUser, CartItem, Product, Shop
from app.schemas import CartLine

router = APIRouter(prefix="/users/{user_id}/cart", tags=["cart"])

MAX_QTY = 20  # same cap as the U-Pay quantity stepper


class QuantityIn(BaseModel):
    quantity: int = Field(ge=1, le=99)


def _lines(user_id: str) -> list[CartLine]:
    on = catalog.today()
    with Session(engine) as session:
        if session.get(AppUser, user_id) is None:
            raise HTTPException(404, "ไม่พบผู้ใช้")
        rows = session.exec(
            select(CartItem, Product, Shop)
            .where(CartItem.product_id == Product.id, Product.shop_id == Shop.id)
            .where(CartItem.user_id == user_id)
            .order_by(CartItem.created_at)
        ).all()
        return [
            CartLine(product=catalog.to_hit(p, s, on), quantity=min(c.quantity, max(1, p.stock), MAX_QTY))
            for c, p, s in rows
        ]


def _set(user_id: str, product_id: str, quantity: int) -> None:
    with Session(engine) as session:
        if session.get(AppUser, user_id) is None:
            raise HTTPException(404, "ไม่พบผู้ใช้")
        product = session.get(Product, product_id)
        if product is None:
            raise HTTPException(404, "ไม่พบสินค้า")
        quantity = min(quantity, max(1, product.stock), MAX_QTY)
        item = session.get(CartItem, (user_id, product_id))
        if item is None:
            session.add(CartItem(user_id=user_id, product_id=product_id, quantity=quantity))
        else:
            item.quantity = quantity
            session.add(item)
        session.commit()


def _delete(user_id: str, product_id: str) -> None:
    with Session(engine) as session:
        item = session.get(CartItem, (user_id, product_id))
        if item is not None:
            session.delete(item)
            session.commit()


@router.get("")
async def get_cart(user_id: str) -> list[CartLine]:
    return await asyncio.to_thread(_lines, user_id)


@router.put("/{product_id}")
async def set_item(user_id: str, product_id: str, body: QuantityIn) -> list[CartLine]:
    """Sets the quantity (adds the product when it is not in the cart). Returns the whole cart."""
    await asyncio.to_thread(_set, user_id, product_id, body.quantity)
    return await asyncio.to_thread(_lines, user_id)


@router.delete("/{product_id}")
async def remove_item(user_id: str, product_id: str) -> list[CartLine]:
    await asyncio.to_thread(_delete, user_id, product_id)
    return await asyncio.to_thread(_lines, user_id)
