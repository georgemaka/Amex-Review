from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
import os
from datetime import datetime
import asyncio

from app.core.security import get_current_user, check_user_role
from app.db.models import User, UserRole, Statement, CardholderStatement, EmailLog, EmailTemplate
from app.db.session import get_async_db
from app.services.email_service import EmailService

router = APIRouter()


class SendEmailRequest(BaseModel):
    recipient_type: str  # "all_coders", "all_reviewers", "specific", "assigned_coders", "assigned_reviewers"
    specific_recipients: Optional[List[EmailStr]] = None
    statement_id: Optional[int] = None
    template_id: Optional[int] = None
    subject: str
    body: str
    include_attachments: bool = False
    attachment_type: Optional[str] = "pdf"  # "pdf", "csv", "both"
    reply_to: Optional[EmailStr] = None


class SendEmailResponse(BaseModel):
    success: bool
    message: str
    recipients_count: int
    email_ids: List[int]


@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    request: SendEmailRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> SendEmailResponse:
    """Send emails with optional attachments from sukutapps.com domain."""
    
    email_service = EmailService()
    
    # Get recipients based on type
    recipients = await _get_recipients_by_type(db, request.recipient_type, request.statement_id)
    
    if request.recipient_type == "specific" and request.specific_recipients:
        recipients = request.specific_recipients
    
    if not recipients:
        raise HTTPException(400, "No recipients found for the specified criteria")
    
    # Get attachments if requested
    attachments = []
    if request.include_attachments and request.statement_id:
        attachments = await _get_statement_attachments(
            db, 
            request.statement_id, 
            request.attachment_type
        )
    
    # Prepare email data
    email_logs = []
    for recipient in recipients:
        email_log = EmailLog(
            recipient=recipient,
            cc_recipients=[],
            subject=request.subject,
            body=request.body,
            email_type="bulk_send",
            related_statement_id=request.statement_id,
            is_successful=False
        )
        db.add(email_log)
        email_logs.append(email_log)
    
    await db.commit()
    
    # Send emails in background
    background_tasks.add_task(
        _send_emails_task,
        email_service,
        recipients,
        request.subject,
        request.body,
        attachments,
        [log.id for log in email_logs],
        request.reply_to or f"{current_user.email}"
    )
    
    return SendEmailResponse(
        success=True,
        message=f"Emails queued for sending to {len(recipients)} recipients",
        recipients_count=len(recipients),
        email_ids=[log.id for log in email_logs]
    )


async def _send_emails_task(
    email_service: EmailService,
    recipients: List[str],
    subject: str,
    body: str,
    attachments: List[Dict[str, Any]],
    email_log_ids: List[int],
    reply_to: str
):
    """Background task to send emails."""
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        for i, recipient in enumerate(recipients):
            try:
                # Send email synchronously (email_service methods are sync)
                success = await asyncio.to_thread(
                    email_service.send_email,
                    to_email=recipient,
                    subject=subject,
                    body=body,
                    attachments=attachments,
                    from_email="noreply@sukutapps.com",
                    from_name="AMEX Coding Portal",
                    reply_to=reply_to
                )
                
                # Update log
                if i < len(email_log_ids):
                    log = db.query(EmailLog).filter(EmailLog.id == email_log_ids[i]).first()
                    if log:
                        log.is_successful = True
                        db.commit()
                        
            except Exception as e:
                # Update log with error
                if i < len(email_log_ids):
                    log = db.query(EmailLog).filter(EmailLog.id == email_log_ids[i]).first()
                    if log:
                        log.error_message = str(e)
                        log.is_successful = False
                        db.commit()
    finally:
        db.close()


async def _get_recipients_by_type(
    db: AsyncSession, 
    recipient_type: str, 
    statement_id: Optional[int] = None
) -> List[str]:
    """Get recipients based on type."""
    if recipient_type == "all_coders":
        result = await db.execute(
            select(User.email).where(
                and_(User.role == UserRole.CODER, User.is_active == True)
            )
        )
        return [row[0] for row in result.fetchall()]
    
    elif recipient_type == "all_reviewers":
        result = await db.execute(
            select(User.email).where(
                and_(User.role == UserRole.REVIEWER, User.is_active == True)
            )
        )
        return [row[0] for row in result.fetchall()]
    
    # Add more recipient types as needed
    
    return []


async def _get_statement_attachments(
    db: AsyncSession,
    statement_id: int,
    attachment_type: str
) -> List[Dict[str, Any]]:
    """Get statement attachments."""
    attachments = []
    
    # Get cardholder statements
    result = await db.execute(
        select(CardholderStatement)
        .where(CardholderStatement.statement_id == statement_id)
        .options(selectinload(CardholderStatement.cardholder))
    )
    cardholder_statements = result.scalars().all()
    
    for cs in cardholder_statements:
        if not cs.cardholder:
            continue
            
        # Add PDF attachment
        if attachment_type in ["pdf", "both"] and cs.pdf_path and os.path.exists(cs.pdf_path):
            attachments.append({
                "filename": f"{cs.cardholder.full_name}_statement.pdf",
                "path": cs.pdf_path,
                "content_type": "application/pdf"
            })
        
        # Add CSV attachment
        if attachment_type in ["csv", "both"] and cs.csv_path and os.path.exists(cs.csv_path):
            attachments.append({
                "filename": f"{cs.cardholder.full_name}_transactions.csv",
                "path": cs.csv_path,
                "content_type": "text/csv"
            })
    
    return attachments


@router.get("/history")
async def get_email_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> List[Dict[str, Any]]:
    """Get email sending history."""
    result = await db.execute(
        select(EmailLog)
        .order_by(EmailLog.sent_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "recipient": log.recipient,
            "cc_recipients": log.cc_recipients,
            "subject": log.subject,
            "email_type": log.email_type,
            "is_successful": log.is_successful,
            "error_message": log.error_message,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]


@router.post("/test")
async def send_test_email(
    to_email: EmailStr,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Dict[str, Any]:
    """Send a test email to verify email configuration."""
    email_service = EmailService()
    
    try:
        success = await asyncio.to_thread(
            email_service.send_email,
            to_email=to_email,
            subject="Test Email from AMEX Coding Portal",
            body="""
            <h2>Test Email</h2>
            <p>This is a test email from the AMEX Coding Portal on sukutapps.com.</p>
            <p>If you received this email, the email service is working correctly!</p>
            <p>Sent by: {}</p>
            """.format(current_user.email),
            from_email="noreply@sukutapps.com",
            from_name="AMEX Coding Portal"
        )
        
        return {
            "success": True,
            "message": f"Test email sent successfully to {to_email}"
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to send test email: {str(e)}")