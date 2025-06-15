from datetime import timedelta, datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import (
    create_access_token,
    verify_password,
    get_current_user
)
from app.db.models import User, UserActivity
from app.db.schemas import Token, User as UserSchema, UserWithToken
from app.db.session import get_async_db

router = APIRouter()


@router.post("/login", response_model=UserWithToken)
async def login(
    db: AsyncSession = Depends(get_async_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
) -> Any:
    # Get user by email
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    # Update last login time
    user.last_login = datetime.utcnow()
    
    # Create user activity log
    activity = UserActivity(
        user_id=user.id,
        activity_type="login",
        description=f"User logged in",
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent", "")[:500] if request else None,
        activity_metadata={"email": user.email}
    )
    db.add(activity)
    await db.commit()
    await db.refresh(user)
    
    # Create access token
    access_token = create_access_token(user.id)
    
    # Convert user to dict and add token
    user_dict = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "access_token": access_token,
        "token_type": "bearer"
    }
    
    return UserWithToken(**user_dict)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user)
) -> Any:
    access_token = create_access_token(current_user.id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> Any:
    return current_user