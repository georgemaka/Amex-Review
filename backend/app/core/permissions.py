"""
Permission system for role-based access control.
"""
from typing import List, Optional
from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_current_user
from app.db.models import User, UserRole, CardholderAssignment, CardholderReviewer
from app.db.session import get_async_db


class PermissionChecker:
    """Check user permissions for various operations."""
    
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_db)
    ) -> User:
        if current_user.role not in self.allowed_roles and not current_user.is_superuser:
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions"
            )
        return current_user


# Permission decorators for different roles
require_admin = PermissionChecker([UserRole.ADMIN])
require_coder = PermissionChecker([UserRole.ADMIN, UserRole.CODER])
require_reviewer = PermissionChecker([UserRole.ADMIN, UserRole.REVIEWER])
require_coder_or_reviewer = PermissionChecker([UserRole.ADMIN, UserRole.CODER, UserRole.REVIEWER])


async def get_user_assigned_cardholders(
    user: User,
    db: AsyncSession,
    include_review_assignments: bool = False
) -> List[int]:
    """Get list of cardholder IDs assigned to a user."""
    if user.is_superuser or user.role == UserRole.ADMIN:
        # Admin sees all cardholders
        return []  # Empty list means no filtering
    
    assigned_ids = []
    
    # Get coder assignments
    if user.role == UserRole.CODER:
        result = await db.execute(
            select(CardholderAssignment.cardholder_id)
            .where(
                CardholderAssignment.coder_id == user.id,
                CardholderAssignment.is_active == True
            )
        )
        assigned_ids.extend([row[0] for row in result.all()])
    
    # Get reviewer assignments
    if user.role == UserRole.REVIEWER or include_review_assignments:
        result = await db.execute(
            select(CardholderReviewer.cardholder_id)
            .where(
                CardholderReviewer.reviewer_id == user.id,
                CardholderReviewer.is_active == True
            )
        )
        assigned_ids.extend([row[0] for row in result.all()])
    
    # Remove duplicates
    return list(set(assigned_ids))


async def check_cardholder_access(
    user: User,
    cardholder_id: int,
    db: AsyncSession,
    require_coder_access: bool = False,
    require_reviewer_access: bool = False
) -> bool:
    """Check if user has access to a specific cardholder."""
    if user.is_superuser or user.role == UserRole.ADMIN:
        return True
    
    # Check coder access
    if require_coder_access or user.role == UserRole.CODER:
        result = await db.execute(
            select(CardholderAssignment)
            .where(
                CardholderAssignment.coder_id == user.id,
                CardholderAssignment.cardholder_id == cardholder_id,
                CardholderAssignment.is_active == True
            )
        )
        if result.scalar_one_or_none():
            return True
    
    # Check reviewer access
    if require_reviewer_access or user.role == UserRole.REVIEWER:
        result = await db.execute(
            select(CardholderReviewer)
            .where(
                CardholderReviewer.reviewer_id == user.id,
                CardholderReviewer.cardholder_id == cardholder_id,
                CardholderReviewer.is_active == True
            )
        )
        if result.scalar_one_or_none():
            return True
    
    return False


def filter_by_cardholder_access(query, user: User, assigned_cardholder_ids: List[int]):
    """Add filters to a query based on user's cardholder access."""
    if user.is_superuser or user.role == UserRole.ADMIN:
        # No filtering for admins
        return query
    
    if not assigned_cardholder_ids:
        # User has no assignments - return empty result
        return query.where(False)
    
    # This will need to be customized based on the specific query
    # The calling code should specify how to filter
    return query