"""DB tables. Only Kiratikorn edits this file: see AGENTS.md "Schema"."""

from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def utcnow() -> datetime:
    return datetime.now(UTC)


class Shop(SQLModel, table=True):
    __tablename__ = "shop"

    id: str = Field(primary_key=True)
    name: str
    rating: float = 0
    ship_days: int = 3
    promptpay_id: str
    promptpay_name: str


class Product(SQLModel, table=True):
    __tablename__ = "product"

    id: str = Field(primary_key=True)
    shop_id: str = Field(foreign_key="shop.id", index=True)
    title: str
    description: str = ""
    category: str = Field(index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    original_price: float
    discount_percent: int = 0
    stock: int = 0
    rating: float = 0
    review_count: int = 0
    image_url: str | None = None


class AppUser(SQLModel, table=True):
    __tablename__ = "app_user"

    id: str = Field(primary_key=True)
    display_name: str
    address: dict = Field(sa_column=Column(JSON, nullable=False))
    interests: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    purchase_history: list[dict] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    discount_percent: int = 0


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_session"

    id: str = Field(default_factory=lambda: new_id("s"), primary_key=True)
    user_id: str = Field(foreign_key="app_user.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class Message(SQLModel, table=True):
    __tablename__ = "message"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="chat_session.id", index=True)
    role: str
    text: str
    option_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: str = Field(default_factory=lambda: new_id("o"), primary_key=True)
    session_id: str | None = Field(default=None, foreign_key="chat_session.id")
    user_id: str = Field(foreign_key="app_user.id", index=True)
    product_id: str = Field(foreign_key="product.id")
    shop_id: str = Field(foreign_key="shop.id", index=True)
    title: str
    quantity: int
    unit_price: float
    subtotal: float
    utag_discount_percent: int
    utag_discount: float
    total: float
    delivery_date: date
    address: dict = Field(sa_column=Column(JSON, nullable=False))
    payment_method: str
    status: str
    promptpay_payload: str | None = None
    slip_check: dict | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
    paid_at: datetime | None = None
