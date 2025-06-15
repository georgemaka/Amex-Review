from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.core.security import (
    get_current_user,
    get_current_active_superuser,
    get_password_hash,
    check_user_role
)
from app.db.models import User, UserRole, CardholderAssignment, CardholderReviewer, Cardholder
from app.db.schemas import User as UserSchema, UserCreate, UserUpdate
from app.db.session import get_async_db

router = APIRouter()


@router.get("/")
async def read_users(
    db: AsyncSession = Depends(get_async_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Get users
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    
    # Get assignment counts for each user
    user_data = []
    for user in users:
        user_dict = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "last_login": user.last_login,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "assignment_count": 0
        }
        
        # Count assignments based on role
        if user.role == UserRole.CODER:
            count_result = await db.execute(
                select(func.count(CardholderAssignment.id))
                .where(
                    CardholderAssignment.coder_id == user.id,
                    CardholderAssignment.is_active == True
                )
            )
            user_dict["assignment_count"] = count_result.scalar() or 0
        elif user.role == UserRole.REVIEWER:
            count_result = await db.execute(
                select(func.count(CardholderReviewer.id))
                .where(
                    CardholderReviewer.reviewer_id == user.id,
                    CardholderReviewer.is_active == True
                )
            )
            user_dict["assignment_count"] = count_result.scalar() or 0
        
        user_data.append(user_dict)
    
    return user_data


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


@router.get("/{user_id}/assignments")
async def get_user_assignments(
    user_id: int,
    role: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    """Get cardholder assignments for a user based on their role."""
    # Verify user exists
    user_result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    assignments = []
    
    if role == "coder":
        # Get coder assignments
        result = await db.execute(
            select(CardholderAssignment, Cardholder)
            .join(Cardholder)
            .where(
                CardholderAssignment.coder_id == user_id,
                CardholderAssignment.is_active == True
            )
            .order_by(Cardholder.full_name)
        )
        
        for assignment, cardholder in result:
            assignments.append({
                "id": assignment.id,
                "cardholder_id": cardholder.id,
                "cardholder_name": cardholder.full_name,
                "card_number": cardholder.card_last_four,
                "is_active": assignment.is_active,
                "created_at": assignment.created_at
            })
            
    elif role == "reviewer":
        # Get reviewer assignments
        result = await db.execute(
            select(CardholderReviewer, Cardholder)
            .join(Cardholder)
            .where(
                CardholderReviewer.reviewer_id == user_id,
                CardholderReviewer.is_active == True
            )
            .order_by(Cardholder.full_name)
        )
        
        for assignment, cardholder in result:
            assignments.append({
                "id": assignment.id,
                "cardholder_id": cardholder.id,
                "cardholder_name": cardholder.full_name,
                "card_number": cardholder.card_last_four,
                "is_active": assignment.is_active,
                "review_order": assignment.review_order,
                "created_at": assignment.created_at
            })
    
    return assignments