"""Types shared by routes, catalog and the AI module. Mirrors docs/contract.md."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class Address(BaseModel):
    line: str
    district: str
    province: str
    postcode: str


class PastPurchase(BaseModel):
    product_id: str
    title: str
    category: str
    price: float
    purchased_at: datetime


class UserProfile(BaseModel):
    user_id: str
    display_name: str
    address: Address
    interests: list[str] = Field(default_factory=list)
    purchase_history: list[PastPurchase] = Field(default_factory=list)
    discount_percent: int = Field(default=0, ge=0, le=90)


class ShopInfo(BaseModel):
    shop_id: str
    name: str
    rating: float
    ship_days: int


class ProductHit(BaseModel):
    product_id: str
    title: str
    description: str
    category: str
    tags: list[str]
    image_url: str | None
    price: float
    original_price: float
    discount_percent: int
    rating: float
    review_count: int
    stock: int
    delivery_date: date
    shop: ShopInfo


class CartLine(BaseModel):
    product: ProductHit
    quantity: int


class ProductOption(ProductHit):
    reason: str


class SearchResult(BaseModel):
    items: list[ProductHit]
    matched: int
    excluded_out_of_stock: int
    excluded_price: int
    excluded_late_delivery: int


class HistoryMessage(BaseModel):
    role: Literal["user", "bot"]
    text: str
    option_ids: list[str] = Field(default_factory=list)
    created_at: datetime


OrderStatus = Literal[
    "pending_confirm",
    "awaiting_payment",
    "payment_failed",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
]


class Order(BaseModel):
    order_id: str
    session_id: str | None
    user_id: str
    product_id: str
    title: str
    shop: ShopInfo
    quantity: int
    unit_price: float
    subtotal: float
    utag_discount_percent: int
    utag_discount: float
    total: float
    delivery_date: date
    address: Address
    payment_method: Literal["promptpay", "card", "avax_escrow"]
    status: OrderStatus
    payment_qr_url: str | None
    payment_test_url: str | None
    payment_expires_at: datetime | None
    payment_url: str | None
    created_at: datetime
    paid_at: datetime | None
    shipped_at: datetime | None
    delivered_at: datetime | None
    tracking_number: str | None
