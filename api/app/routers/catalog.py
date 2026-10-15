from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from app import catalog
from app.db import engine
from app.models import AppUser
from app.routers.chat import profile_of
from app.schemas import ProductHit, UserProfile

router = APIRouter(tags=["catalog"])


@router.get("/products")
async def list_products(shop_id: str | None = None) -> list[ProductHit]:
    return await catalog.list_products(shop_id)


@router.get("/users/{user_id}")
def get_user(user_id: str) -> UserProfile:
    with Session(engine) as session:
        user = session.get(AppUser, user_id)
        if user is None:
            raise HTTPException(404, "user not found")
        return profile_of(user)
