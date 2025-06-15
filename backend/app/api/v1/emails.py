from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, EmailStr

from app.core.security import get_current_user, check_user_role
from app.db.models import User, UserRole, Statement, CardholderAssignment, CardholderReviewer
from app.db.session import get_async_db
from app.services.email_service import EmailService
from app.tasks.email_tasks import send_group_notification_task

router = APIRouter()


class GroupEmailRequest(BaseModel):
    recipient_type: str  # "all_coders", "all_reviewers", "specific", "assigned_coders", "assigned_reviewers"
    specific_recipients: Optional[List[EmailStr]] = None
    statement_id: Optional[int] = None
    subject: str
    body: str
    attachments: Optional[List[str]] = None
    is_draft: bool = True  # Default to creating drafts


class StatementNotificationRequest(BaseModel):
    statement_id: int
    recipient_type: str  # "all_coders", "all_reviewers", "assigned_coders", "assigned_reviewers"
    notification_type: str  # "ready_for_coding", "ready_for_review", "custom"
    custom_message: Optional[str] = None
    is_draft: bool = True


@router.post("/send-group")
async def send_group_email(
    request: GroupEmailRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    """Send email to a group of recipients."""
    email_service = EmailService()
    
    # Get recipients based on type
    recipients = []
    
    if request.recipient_type == "specific" and request.specific_recipients:
        recipients = request.specific_recipients
    
    elif request.recipient_type == "all_coders":
        # Get all active coders
        result = await db.execute(
            select(User).where(
                and_(User.role == UserRole.CODER, User.is_active == True)
            )
        )
        users = result.scalars().all()
        recipients = [user.email for user in users]
    
    elif request.recipient_type == "all_reviewers":
        # Get all active reviewers
        result = await db.execute(
            select(User).where(
                and_(User.role == UserRole.REVIEWER, User.is_active == True)
            )
        )
        users = result.scalars().all()
        recipients = [user.email for user in users]
    
    elif request.recipient_type == "assigned_coders" and request.statement_id:
        # Get coders assigned to cardholders in this statement
        from sqlalchemy import text
        query = text("""
            SELECT DISTINCT u.email
            FROM users u
            JOIN cardholder_assignments ca ON u.id = ca.coder_id
            JOIN cardholders c ON ca.cardholder_id = c.id
            JOIN cardholder_statements cs ON c.id = cs.cardholder_id
            WHERE cs.statement_id = :statement_id
            AND ca.is_active = true
            AND u.is_active = true
        """)
        result = await db.execute(query, {"statement_id": request.statement_id})
        recipients = [row[0] for row in result.fetchall()]
    
    elif request.recipient_type == "assigned_reviewers" and request.statement_id:
        # Get reviewers assigned to cardholders in this statement
        from sqlalchemy import text
        query = text("""
            SELECT DISTINCT u.email
            FROM users u
            JOIN cardholder_reviewers cr ON u.id = cr.reviewer_id
            JOIN cardholders c ON cr.cardholder_id = c.id
            JOIN cardholder_statements cs ON c.id = cs.cardholder_id
            WHERE cs.statement_id = :statement_id
            AND cr.is_active = true
            AND u.is_active = true
        """)
        result = await db.execute(query, {"statement_id": request.statement_id})
        recipients = [row[0] for row in result.fetchall()]
    
    if not recipients:
        raise HTTPException(400, "No recipients found for the specified criteria")
    
    # Create drafts (only mode available without Graph API)
    result = email_service.send_group_notification(
        recipients=recipients,
        subject=request.subject,
        body=request.body,
        attachments=request.attachments,
        is_draft=True
    )
    
    return result


@router.post("/statement-notification")
async def send_statement_notification(
    request: StatementNotificationRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    """Send notification about statement readiness."""
    # Get statement details
    result = await db.execute(
        select(Statement).where(Statement.id == request.statement_id)
    )
    statement = result.scalar_one_or_none()
    
    if not statement:
        raise HTTPException(404, "Statement not found")
    
    # Get cardholder count
    from sqlalchemy import text
    ch_count_result = await db.execute(
        text("""
        SELECT COUNT(DISTINCT cardholder_id) 
        FROM cardholder_statements 
        WHERE statement_id = :statement_id
        """),
        {"statement_id": request.statement_id}
    )
    cardholder_count = ch_count_result.scalar() or 0
    
    # Prepare statement info
    statement_info = {
        "month": statement.month,
        "year": statement.year,
        "cardholder_count": cardholder_count,
        "statement_id": statement.id
    }
    
    # Create email request based on notification type
    if request.notification_type in ["ready_for_coding", "ready_for_review"]:
        email_service = EmailService()
        
        # Determine actual recipients
        recipient_type_map = {
            "all_coders": "all_coders",
            "all_reviewers": "all_reviewers",
            "assigned_coders": "assigned_coders",
            "assigned_reviewers": "assigned_reviewers"
        }
        
        # Get recipients
        recipients = await _get_recipients_by_type(
            db, 
            recipient_type_map.get(request.recipient_type, request.recipient_type),
            request.statement_id
        )
        
        if not recipients:
            raise HTTPException(400, "No recipients found")
        
        # Send notification
        result = email_service.send_statement_ready_notification(
            statement_info=statement_info,
            recipient_type=request.recipient_type,
            specific_recipients=recipients
        )
    else:
        # Custom notification
        if not request.custom_message:
            raise HTTPException(400, "Custom message required for custom notifications")
        
        # Use the group email endpoint logic
        recipients = await _get_recipients_by_type(db, request.recipient_type, request.statement_id)
        
        email_service = EmailService()
        result = email_service.send_group_notification(
            recipients=recipients,
            subject=f"AMEX Statement Update - {statement.month}/{statement.year}",
            body=request.custom_message,
            is_draft=request.is_draft
        )
    
    return result


async def _get_recipients_by_type(db: AsyncSession, recipient_type: str, statement_id: Optional[int] = None) -> List[str]:
    """Helper function to get recipients by type."""
    recipients = []
    
    if recipient_type == "all_coders":
        result = await db.execute(
            select(User).where(
                and_(User.role == UserRole.CODER, User.is_active == True)
            )
        )
        users = result.scalars().all()
        recipients = [user.email for user in users]
    
    elif recipient_type == "all_reviewers":
        result = await db.execute(
            select(User).where(
                and_(User.role == UserRole.REVIEWER, User.is_active == True)
            )
        )
        users = result.scalars().all()
        recipients = [user.email for user in users]
    
    elif recipient_type == "assigned_coders" and statement_id:
        from sqlalchemy import text
        query = text("""
            SELECT DISTINCT u.email
            FROM users u
            JOIN cardholder_assignments ca ON u.id = ca.coder_id
            JOIN cardholders c ON ca.cardholder_id = c.id
            JOIN cardholder_statements cs ON c.id = cs.cardholder_id
            WHERE cs.statement_id = :statement_id
            AND ca.is_active = true
            AND u.is_active = true
        """)
        result = await db.execute(query, {"statement_id": statement_id})
        recipients = [row[0] for row in result.fetchall()]
    
    elif recipient_type == "assigned_reviewers" and statement_id:
        from sqlalchemy import text
        query = text("""
            SELECT DISTINCT u.email
            FROM users u
            JOIN cardholder_reviewers cr ON u.id = cr.reviewer_id
            JOIN cardholders c ON cr.cardholder_id = c.id
            JOIN cardholder_statements cs ON c.id = cs.cardholder_id
            WHERE cs.statement_id = :statement_id
            AND cr.is_active = true
            AND u.is_active = true
        """)
        result = await db.execute(query, {"statement_id": statement_id})
        recipients = [row[0] for row in result.fetchall()]
    
    return recipients


@router.get("/email-config")
async def get_email_configuration(
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    """Get current email configuration status."""
    email_service = EmailService()
    
    return {
        "graph_api_configured": False,  # Simplified - no Graph API
        "outlook_available": email_service.use_outlook,
        "from_email": email_service.from_email,
        "default_mode": "draft"  # Always draft mode
    }