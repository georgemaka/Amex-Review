from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from typing import AsyncGenerator

from app.core.config import settings

# Convert postgresql:// to postgresql+asyncpg:// for async
async_database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Async engine
async_engine = create_async_engine(
    async_database_url,
    echo=settings.DEBUG,
    future=True
)

# Sync engine for migrations
sync_engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG
)

AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create async session context for use in sync code
async_session = AsyncSessionLocal

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)

Base = declarative_base()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()