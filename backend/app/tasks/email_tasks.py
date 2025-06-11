import logging
from datetime import datetime
from typing import List, Dict
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models import (
    Statement, CardholderStatement, CardholderAssignment,
    CardholderReviewer, EmailLog, User
)
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


@celery_app.task(name="send_coding_assignments")
def send_coding_assignments_task(statement_id: int) -> Dict:
    """Send coding assignment emails to all coders for a statement."""
    db = SessionLocal()
    email_service = EmailService()
    
    try:
        # Get statement with cardholder statements
        statement = db.query(Statement).filter(
            Statement.id == statement_id
        ).first()
        
        if not statement:
            raise ValueError(f"Statement {statement_id} not found")
        
        # Get all cardholder statements with assignments
        cardholder_statements = db.query(CardholderStatement).options(
            joinedload(CardholderStatement.cardholder).joinedload(
                Cardholder.assignments
            ).joinedload(CardholderAssignment.coder)
        ).filter(
            CardholderStatement.statement_id == statement_id
        ).all()
        
        # Group by coder
        assignments_by_coder = {}
        
        for ch_stmt in cardholder_statements:
            for assignment in ch_stmt.cardholder.assignments:
                if not assignment.is_active:
                    continue
                
                coder_email = assignment.coder.email
                if coder_email not in assignments_by_coder:
                    assignments_by_coder[coder_email] = {
                        "coder": assignment.coder,
                        "cc_emails": set(),
                        "files": []
                    }
                
                # Add CC emails
                if assignment.cc_emails:
                    assignments_by_coder[coder_email]["cc_emails"].update(assignment.cc_emails)
                
                # Add file info
                assignments_by_coder[coder_email]["files"].append({
                    "cardholder_name": ch_stmt.cardholder.full_name,
                    "pdf_path": ch_stmt.pdf_path,
                    "csv_path": ch_stmt.csv_path
                })
        
        # Send emails
        emails_sent = 0
        errors = []
        
        for coder_email, info in assignments_by_coder.items():
            try:
                success = email_service.send_coding_assignment(
                    recipient=coder_email,
                    cc_recipients=list(info["cc_emails"]),
                    cardholder_files=info["files"],
                    month=statement.month,
                    year=statement.year
                )
                
                # Log email
                email_log = EmailLog(
                    recipient=coder_email,
                    cc_recipients=list(info["cc_emails"]),
                    subject=f"{statement.month}/{statement.year} American Express Charges",
                    body="Coding assignment email",
                    email_type="coding_assignment",
                    related_statement_id=statement_id,
                    is_successful=success,
                    error_message=None if success else "Failed to send"
                )
                db.add(email_log)
                
                if success:
                    emails_sent += 1
                    # Update email sent timestamp
                    for file_info in info["files"]:
                        db.query(CardholderStatement).filter(
                            CardholderStatement.cardholder.has(full_name=file_info["cardholder_name"]),
                            CardholderStatement.statement_id == statement_id
                        ).update({"email_sent_at": datetime.utcnow()})
                else:
                    errors.append(f"Failed to send to {coder_email}")
                    
            except Exception as e:
                errors.append(f"Error sending to {coder_email}: {str(e)}")
                logger.error(f"Error sending to {coder_email}: {str(e)}")
        
        db.commit()
        
        return {
            "emails_sent": emails_sent,
            "total_coders": len(assignments_by_coder),
            "errors": errors
        }
    
    finally:
        db.close()


@celery_app.task(name="send_review_requests")
def send_review_requests_task(statement_id: int) -> Dict:
    """Send review request emails to all reviewers for a statement."""
    db = SessionLocal()
    email_service = EmailService()
    
    try:
        # Get statement
        statement = db.query(Statement).filter(
            Statement.id == statement_id
        ).first()
        
        if not statement:
            raise ValueError(f"Statement {statement_id} not found")
        
        # Get all cardholder statements with reviewers
        cardholder_statements = db.query(CardholderStatement).options(
            joinedload(CardholderStatement.cardholder).joinedload(
                Cardholder.reviewers
            ).joinedload(CardholderReviewer.reviewer)
        ).filter(
            CardholderStatement.statement_id == statement_id
        ).all()
        
        # Group by reviewer
        files_by_reviewer = {}
        
        for ch_stmt in cardholder_statements:
            for reviewer_assignment in ch_stmt.cardholder.reviewers:
                if not reviewer_assignment.is_active:
                    continue
                
                reviewer_email = reviewer_assignment.reviewer.email
                if reviewer_email not in files_by_reviewer:
                    files_by_reviewer[reviewer_email] = []
                
                files_by_reviewer[reviewer_email].append({
                    "cardholder_name": ch_stmt.cardholder.full_name,
                    "pdf_path": ch_stmt.pdf_path
                })
        
        # Send emails
        emails_sent = 0
        errors = []
        
        for reviewer_email, files in files_by_reviewer.items():
            try:
                success = email_service.send_review_request(
                    recipient=reviewer_email,
                    cardholder_files=files,
                    month=statement.month,
                    year=statement.year
                )
                
                # Log email
                email_log = EmailLog(
                    recipient=reviewer_email,
                    cc_recipients=[],
                    subject=f"{statement.month}/{statement.year} American Express Statement Review",
                    body="Review request email",
                    email_type="review_request",
                    related_statement_id=statement_id,
                    is_successful=success,
                    error_message=None if success else "Failed to send"
                )
                db.add(email_log)
                
                if success:
                    emails_sent += 1
                else:
                    errors.append(f"Failed to send to {reviewer_email}")
                    
            except Exception as e:
                errors.append(f"Error sending to {reviewer_email}: {str(e)}")
                logger.error(f"Error sending to {reviewer_email}: {str(e)}")
        
        db.commit()
        
        return {
            "emails_sent": emails_sent,
            "total_reviewers": len(files_by_reviewer),
            "errors": errors
        }
    
    finally:
        db.close()