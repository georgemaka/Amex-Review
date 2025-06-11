from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.models import User, UserRole
from app.db.session import AsyncSessionLocal


async def init_db() -> None:
    async with AsyncSessionLocal() as db:
        # Check if superuser exists
        result = await db.execute(
            select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL)
        )
        superuser = result.scalar_one_or_none()
        
        if not superuser:
            # Create superuser
            superuser = User(
                email=settings.FIRST_SUPERUSER_EMAIL,
                first_name=settings.FIRST_SUPERUSER_FIRST_NAME,
                last_name=settings.FIRST_SUPERUSER_LAST_NAME,
                hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                is_superuser=True
            )
            db.add(superuser)
            await db.commit()
            print(f"Superuser created: {settings.FIRST_SUPERUSER_EMAIL}")
        else:
            print(f"Superuser already exists: {settings.FIRST_SUPERUSER_EMAIL}")
        
        # You can add more initialization logic here
        # For example, creating default GL accounts, job codes, etc.