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
    discount_percent: int = 0


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


class Receiver(BaseModel):
    name: str
    promptpay_id: str


class SlipCheck(BaseModel):
    ok: bool
    amount: float | None
    reason: str
