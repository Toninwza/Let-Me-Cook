"""Product data access for the AI module and routes. Contract: docs/contract.md "Catalog interface"."""

import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlmodel import Session, select

from app.db import engine
from app.models import Product, Shop
from app.schemas import ProductHit, SearchResult, ShopInfo

# Fixed offset instead of zoneinfo: Windows Python has no tz database without the tzdata package.
_BANGKOK = timezone(timedelta(hours=7))


def today() -> date:
    return datetime.now(_BANGKOK).date()


def to_hit(product: Product, shop: Shop, on: date) -> ProductHit:
    return ProductHit(
        product_id=product.id,
        title=product.title,
        description=product.description,
        category=product.category,
        tags=product.tags,
        image_url=product.image_url,
        price=round(product.original_price * (100 - product.discount_percent) / 100, 2),
        original_price=product.original_price,
        discount_percent=product.discount_percent,
        rating=product.rating,
        review_count=product.review_count,
        stock=product.stock,
        delivery_date=on + timedelta(days=shop.ship_days),
        shop=ShopInfo(shop_id=shop.id, name=shop.name, rating=shop.rating, ship_days=shop.ship_days),
    )


def _all_hits(shop_id: str | None = None) -> list[ProductHit]:
    on = today()
    query = select(Product, Shop).where(Product.shop_id == Shop.id)
    if shop_id:
        query = query.where(Product.shop_id == shop_id)
    with Session(engine) as session:
        return [to_hit(p, s, on) for p, s in session.exec(query).all()]


def _search(
    keywords: list[str],
    category: str | None,
    min_price: float | None,
    max_price: float | None,
    deliver_by: date | None,
    in_stock_only: bool,
    limit: int,
) -> SearchResult:
    words = [k.strip().lower() for k in keywords if k and k.strip()]
    wanted_category = category.strip().lower() if category else None

    scored: list[tuple[int, ProductHit]] = []
    for hit in _all_hits():
        if wanted_category and hit.category.lower() != wanted_category:
            continue
        haystack = " ".join([hit.title, hit.description, hit.category, *hit.tags]).lower()
        score = sum(1 for w in words if w in haystack)
        if words and score == 0:
            continue
        scored.append((score, hit))

    out_of_stock = price = late = 0
    kept: list[tuple[int, ProductHit]] = []
    for score, hit in scored:
        if in_stock_only and hit.stock <= 0:
            out_of_stock += 1
        elif (min_price is not None and hit.price < min_price) or (
            max_price is not None and hit.price > max_price
        ):
            price += 1
        elif deliver_by is not None and hit.delivery_date > deliver_by:
            late += 1
        else:
            kept.append((score, hit))

    kept.sort(key=lambda t: (-t[0], -t[1].rating, -t[1].review_count))
    return SearchResult(
        items=[hit for _, hit in kept[:limit]],
        matched=len(scored),
        excluded_out_of_stock=out_of_stock,
        excluded_price=price,
        excluded_late_delivery=late,
    )


async def search_products(
    keywords: list[str],
    *,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    deliver_by: date | None = None,
    in_stock_only: bool = True,
    limit: int = 10,
) -> SearchResult:
    return await asyncio.to_thread(
        _search, keywords, category, min_price, max_price, deliver_by, in_stock_only, limit
    )


async def get_product(product_id: str) -> ProductHit | None:
    def load() -> ProductHit | None:
        with Session(engine) as session:
            product = session.get(Product, product_id)
            if product is None:
                return None
            return to_hit(product, session.get(Shop, product.shop_id), today())

    return await asyncio.to_thread(load)


async def list_products(shop_id: str | None = None) -> list[ProductHit]:
    return await asyncio.to_thread(_all_hits, shop_id)


async def list_categories() -> list[str]:
    def load() -> list[str]:
        with Session(engine) as session:
            return sorted(set(session.exec(select(Product.category)).all()))

    return await asyncio.to_thread(load)
