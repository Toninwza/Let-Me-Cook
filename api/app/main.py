from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import catalog, chat, health


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


# Every route lives under /api so the same paths work directly
# and through the Next.js rewrite (/api/* -> this service).
app = FastAPI(
    title="Let-Me-Cook API",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
