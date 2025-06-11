from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.security import (
    get_current_user,
    get_current_active_superuser,
    get_password_hash,
    check_user_role
)
from app.db.models import User, UserRole
from app.db.schemas import User as UserSchema, UserCreate, UserUpdate
from app.db.session import get_async_db

router = APIRouter()


@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: AsyncSession = Depends(get_async_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return users


@router.post("/", response_model=UserSchema)
async def create_user(
    *,
    db: AsyncSession = Depends(get_async_db),
    user_in: UserCreate,
    current_user: User = Depends(get_current_active_superuser)
) -> Any:
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    # Create new user
    user = User(
        email=user_in.email,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
        is_superuser=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserSchema)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Users can read their own profile, admins can read any profile
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Users can update their own profile (except role), admins can update any profile
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Non-admins cannot change roles
    if current_user.role != UserRole.ADMIN and "role" in update_data:
        del update_data["role"]
    
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_superuser)
) -> Any:
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Don't allow deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}