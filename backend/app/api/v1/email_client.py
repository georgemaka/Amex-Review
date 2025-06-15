from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text
from pydantic import BaseModel
import base64
import json
from datetime import datetime

from app.core.security import get_current_user, check_user_role
from app.db.models import User, UserRole, Statement, CardholderStatement, EmailTemplate
from app.db.schemas import EmailTemplate as EmailTemplateSchema, EmailTemplateCreate, EmailTemplateUpdate
from app.db.session import get_async_db

router = APIRouter()


class EmailClientRequest(BaseModel):
    recipient_type: str  # "all_coders", "all_reviewers", "specific", "assigned_coders", "assigned_reviewers"
    specific_recipients: Optional[List[str]] = None
    statement_id: Optional[int] = None
    subject: str
    body: str
    include_attachments: bool = False


class EmailClientResponse(BaseModel):
    mailto_link: str
    recipients: List[str]
    subject: str
    body_preview: str
    attachment_instructions: Optional[str] = None
    outlook_command: Optional[str] = None
    total_recipients: int


@router.post("/prepare-email")
async def prepare_email_for_client(
    request: EmailClientRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> EmailClientResponse:
    """Prepare email data for the user's email client."""
    
    # Get recipients based on type
    recipients = await _get_recipients_by_type(db, request.recipient_type, request.statement_id)
    
    if request.recipient_type == "specific" and request.specific_recipients:
        recipients = request.specific_recipients
    
    if not recipients:
        raise HTTPException(400, "No recipients found for the specified criteria")
    
    # Create mailto link (limited to reasonable length)
    # Most email clients support around 2000 characters in mailto
    mailto_recipients = recipients[:10]  # Limit for mailto link
    mailto_link = f"mailto:{','.join(mailto_recipients)}?subject={request.subject}"
    
    # If body is small enough, include it
    if len(request.body) < 500:
        mailto_link += f"&body={request.body}"
    
    # Prepare attachment instructions if needed
    attachment_instructions = None
    if request.include_attachments and request.statement_id:
        attachment_instructions = await _get_attachment_instructions(db, request.statement_id)
    
    # Create Outlook command for advanced users
    outlook_command = _generate_outlook_vba_script(
        recipients=recipients,
        subject=request.subject,
        body=request.body,
        from_email="GL@sukut.com"
    )
    
    return EmailClientResponse(
        mailto_link=mailto_link,
        recipients=recipients,
        subject=request.subject,
        body_preview=request.body[:200] + "..." if len(request.body) > 200 else request.body,
        attachment_instructions=attachment_instructions,
        outlook_command=outlook_command,
        total_recipients=len(recipients)
    )


@router.post("/generate-eml")
async def generate_eml_file(
    request: EmailClientRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Generate an .eml file that can be opened in any email client."""
    
    # Get recipients
    recipients = await _get_recipients_by_type(db, request.recipient_type, request.statement_id)
    
    if request.recipient_type == "specific" and request.specific_recipients:
        recipients = request.specific_recipients
    
    if not recipients:
        raise HTTPException(400, "No recipients found")
    
    # Create EML content
    eml_content = f"""From: GL@sukut.com
To: {', '.join(recipients)}
Subject: {request.subject}
Content-Type: text/html; charset=UTF-8
Date: {datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')}

<html>
<body>
{request.body}
</body>
</html>
"""
    
    # Base64 encode for download
    eml_base64 = base64.b64encode(eml_content.encode()).decode()
    
    return {
        "filename": f"email_draft_{datetime.now().strftime('%Y%m%d_%H%M%S')}.eml",
        "content_base64": eml_base64,
        "content_type": "message/rfc822",
        "recipients_count": len(recipients)
    }


@router.get("/recipient-lists")
async def get_recipient_lists(
    statement_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """Get all available recipient lists for easy copying."""
    
    lists = {}
    
    # All coders
    result = await db.execute(
        select(User).where(
            and_(User.role == UserRole.CODER, User.is_active == True)
        )
    )
    coders = result.scalars().all()
    lists["all_coders"] = [u.email for u in coders]
    
    # All reviewers
    result = await db.execute(
        select(User).where(
            and_(User.role == UserRole.REVIEWER, User.is_active == True)
        )
    )
    reviewers = result.scalars().all()
    lists["all_reviewers"] = [u.email for u in reviewers]
    
    # Statement-specific lists if provided
    if statement_id:
        lists["assigned_coders"] = await _get_recipients_by_type(db, "assigned_coders", statement_id)
        lists["assigned_reviewers"] = await _get_recipients_by_type(db, "assigned_reviewers", statement_id)
    
    return lists


async def _get_recipients_by_type(
    db: AsyncSession, 
    recipient_type: str, 
    statement_id: Optional[int] = None
) -> List[str]:
    """Helper to get recipients by type."""
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


async def _get_attachment_instructions(db: AsyncSession, statement_id: int) -> str:
    """Generate instructions for attaching files."""
    # Get cardholder statements
    result = await db.execute(
        select(CardholderStatement)
        .where(CardholderStatement.statement_id == statement_id)
    )
    cardholder_statements = result.scalars().all()
    
    instructions = "Please attach the following files from the portal:\n\n"
    for cs in cardholder_statements:
        if cs.cardholder:
            instructions += f"• {cs.cardholder.full_name}: PDF and/or CSV file\n"
    
    instructions += "\nFiles can be downloaded from the Statements section of the portal."
    return instructions


def _generate_outlook_vba_script(recipients: List[str], subject: str, body: str, from_email: str) -> str:
    """Generate VBA script for Outlook automation."""
    recipients_str = ";".join(recipients)
    
    # Escape quotes in subject and body
    subject_escaped = subject.replace('"', '""')
    body_escaped = body.replace('"', '""')
    
    vba_script = f'''Sub CreateDraftEmail()
    Dim olApp As Object
    Dim olMail As Object
    
    Set olApp = CreateObject("Outlook.Application")
    Set olMail = olApp.CreateItem(0)
    
    With olMail
        .To = "{recipients_str}"
        .Subject = "{subject_escaped}"
        .HTMLBody = "{body_escaped}"
        .SentOnBehalfOfName = "{from_email}"
        .Display ' or .Save to save as draft
    End With
    
    Set olMail = Nothing
    Set olApp = Nothing
End Sub'''
    
    return vba_script


# Email Template Endpoints
@router.get("/templates", response_model=List[EmailTemplateSchema])
async def get_email_templates(
    category: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> List[EmailTemplateSchema]:
    """Get all email templates."""
    query = select(EmailTemplate).where(EmailTemplate.is_active == is_active)
    
    if category:
        query = query.where(EmailTemplate.category == category)
    
    query = query.order_by(EmailTemplate.category, EmailTemplate.name)
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return templates


@router.post("/templates", response_model=EmailTemplateSchema)
async def create_email_template(
    template: EmailTemplateCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> EmailTemplateSchema:
    """Create a new email template."""
    # Check if template with same name exists
    existing = await db.execute(
        select(EmailTemplate).where(EmailTemplate.name == template.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Template with this name already exists")
    
    db_template = EmailTemplate(
        **template.model_dump(),
        created_by_id=current_user.id
    )
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    
    return db_template


@router.put("/templates/{template_id}", response_model=EmailTemplateSchema)
async def update_email_template(
    template_id: int,
    template_update: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> EmailTemplateSchema:
    """Update an email template."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    # Check if new name conflicts with existing
    if template_update.name and template_update.name != template.name:
        existing = await db.execute(
            select(EmailTemplate).where(EmailTemplate.name == template_update.name)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, "Template with this name already exists")
    
    # Update fields
    update_data = template_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/templates/{template_id}")
async def delete_email_template(
    template_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Dict[str, str]:
    """Delete an email template."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    await db.delete(template)
    await db.commit()
    
    return {"message": "Template deleted successfully"}


@router.post("/templates/{template_id}/preview")
async def preview_email_template(
    template_id: int,
    variables: Dict[str, Any],
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Preview an email template with variables replaced."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(404, "Template not found")
    
    # Replace variables in subject and body
    subject = template.subject
    body = template.body
    
    for var, value in variables.items():
        placeholder = f"{{{{{var}}}}}"
        subject = subject.replace(placeholder, str(value))
        body = body.replace(placeholder, str(value))
    
    return {
        "subject": subject,
        "body": body,
        "variables_used": list(variables.keys())
    }