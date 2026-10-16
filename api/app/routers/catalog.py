from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from app import catalog
from app.db import engine
from app.models import AppUser
from app.routers.chat import profile_of
from app.schemas import Address, ProductHit, UserProfile

router = APIRouter(tags=["catalog"])


class UserUpdate(BaseModel):
    """Every field is optional; only the ones sent are changed."""

    # Strip before the length checks, so "   " is rejected instead of saved as "".
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^0\d{8,9}$")
    address: Address | None = None


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


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate) -> UserProfile:
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    with Session(engine) as session:
        user = session.get(AppUser, user_id)
        if user is None:
            raise HTTPException(404, "user not found")
        for key, value in changes.items():
            setattr(user, key, value)
        session.add(user)
        session.commit()
        session.refresh(user)
        return profile_of(user)
