import os
import logging
from datetime import datetime
from typing import Dict
from celery import current_task
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models import (
    Statement, StatementStatus, CardholderStatement, 
    Cardholder, Transaction, TransactionStatus
)
from app.services.pdf_processor import PDFProcessor
from app.services.excel_processor import ExcelProcessor
from app.services.analytics_processor import AnalyticsProcessor
from app.core.config import settings

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="process_statement")
def process_statement_task(self, statement_id: int) -> Dict:
    """Process uploaded statement files (PDF and Excel)."""
    db = SessionLocal()
    
    try:
        # Get statement
        statement = db.query(Statement).filter(Statement.id == statement_id).first()
        if not statement:
            raise ValueError(f"Statement {statement_id} not found")
        
        # Update status to processing
        statement.status = StatementStatus.PROCESSING
        statement.processing_started_at = datetime.utcnow()
        db.commit()
        
        # Initialize processors
        pdf_processor = PDFProcessor()
        excel_processor = ExcelProcessor()
        
        # Create output directories
        pdf_output_dir = os.path.join(settings.UPLOAD_DIR, f"statements/{statement_id}/pdfs")
        csv_output_dir = os.path.join(settings.UPLOAD_DIR, f"statements/{statement_id}/csvs")
        
        # Process Excel file first to get transaction data
        logger.info(f"Processing Excel file: {statement.excel_path}")
        transactions_by_cardholder = excel_processor.parse_statement(statement.excel_path)
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"current": 25, "total": 100, "status": "Excel processed"}
        )
        
        # Split PDF by cardholder
        logger.info(f"Splitting PDF file: {statement.pdf_path}")
        pdf_results = pdf_processor.split_by_cardholder(statement.pdf_path, pdf_output_dir)
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"current": 50, "total": 100, "status": "PDF split completed"}
        )
        
        # Generate CSV files
        csv_results = excel_processor.generate_csv_files(
            transactions_by_cardholder,
            csv_output_dir,
            statement.month,
            statement.year
        )
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"current": 75, "total": 100, "status": "CSV files generated"}
        )
        
        # Create database records
        total_cardholders = 0
        total_transactions = 0
        
        for cardholder_name in pdf_results.keys():
            # Get or create cardholder
            cardholder = db.query(Cardholder).filter(
                Cardholder.full_name == cardholder_name
            ).first()
            
            if not cardholder:
                # Parse name
                name_parts = cardholder_name.split()
                first_name = name_parts[0] if name_parts else ""
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
                
                cardholder = Cardholder(
                    full_name=cardholder_name,
                    first_name=first_name,
                    last_name=last_name
                )
                db.add(cardholder)
                db.flush()
            
            # Create cardholder statement
            pdf_info = pdf_results[cardholder_name]
            transactions = transactions_by_cardholder.get(cardholder_name, [])
            
            cardholder_statement = CardholderStatement(
                statement_id=statement_id,
                cardholder_id=cardholder.id,
                pdf_path=pdf_info["path"],
                csv_path=csv_results.get(cardholder_name, ""),
                page_start=pdf_info["page_start"],
                page_end=pdf_info["page_end"],
                total_amount=sum(t["amount"] for t in transactions),
                transaction_count=len(transactions)
            )
            db.add(cardholder_statement)
            db.flush()
            
            # Create transaction records
            for trans_data in transactions:
                # Convert datetime objects to strings for JSON serialization
                json_safe_data = trans_data.copy()
                if isinstance(json_safe_data.get("transaction_date"), datetime):
                    json_safe_data["transaction_date"] = json_safe_data["transaction_date"].isoformat()
                if isinstance(json_safe_data.get("posting_date"), datetime):
                    json_safe_data["posting_date"] = json_safe_data["posting_date"].isoformat()
                
                transaction = Transaction(
                    cardholder_statement_id=cardholder_statement.id,
                    transaction_date=trans_data["transaction_date"],
                    posting_date=trans_data["posting_date"],
                    description=trans_data["description"],
                    amount=trans_data["amount"],
                    merchant_name=trans_data["merchant"],
                    status=TransactionStatus.UNCODED,
                    original_row_data=json_safe_data
                )
                db.add(transaction)
            
            total_cardholders += 1
            total_transactions += len(transactions)
        
        # Update statement status
        statement.status = StatementStatus.SPLIT
        statement.processing_completed_at = datetime.utcnow()
        db.commit()
        
        # Update progress before analytics
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Processing analytics",
                "cardholders": total_cardholders,
                "transactions": total_transactions
            }
        )
        
        # Process analytics
        try:
            from sqlalchemy.ext.asyncio import AsyncSession
            from app.db.session import async_session
            
            # Create async session for analytics processor
            async def process_analytics():
                async with async_session() as async_db:
                    analytics_processor = AnalyticsProcessor(async_db)
                    await analytics_processor.process_statement_analytics(statement_id)
            
            # Run async function
            import asyncio
            asyncio.run(process_analytics())
            
            logger.info(f"Analytics processed for statement {statement_id}")
        except Exception as e:
            logger.error(f"Error processing analytics: {str(e)}")
            # Don't fail the whole process if analytics fail
        
        # Final progress update
        self.update_state(
            state="SUCCESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Processing completed",
                "cardholders": total_cardholders,
                "transactions": total_transactions
            }
        )
        
        return {
            "status": "success",
            "cardholders_processed": total_cardholders,
            "transactions_created": total_transactions
        }
    
    except Exception as e:
        logger.error(f"Error processing statement {statement_id}: {str(e)}")
        
        # Update statement with error
        if statement:
            statement.status = StatementStatus.ERROR
            statement.processing_error = str(e)
            db.commit()
        
        # Update task state
        self.update_state(
            state="FAILURE",
            meta={"error": str(e)}
        )
        
        raise
    
    finally:
        db.close()


@celery_app.task(name="update_coding_progress")
def update_coding_progress_task(cardholder_statement_id: int) -> Dict:
    """Update coding progress for a cardholder statement."""
    db = SessionLocal()
    
    try:
        # Get cardholder statement
        stmt = db.query(CardholderStatement).filter(
            CardholderStatement.id == cardholder_statement_id
        ).first()
        
        if not stmt:
            raise ValueError(f"CardholderStatement {cardholder_statement_id} not found")
        
        # Calculate progress
        total_transactions = stmt.transaction_count
        coded_transactions = db.query(Transaction).filter(
            Transaction.cardholder_statement_id == cardholder_statement_id,
            Transaction.status.in_([
                TransactionStatus.CODED,
                TransactionStatus.REVIEWED,
                TransactionStatus.EXPORTED
            ])
        ).count()
        
        # Update progress
        progress = (coded_transactions / total_transactions * 100) if total_transactions > 0 else 0
        stmt.coding_progress = progress
        
        if progress >= 100:
            stmt.completed_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "cardholder_statement_id": cardholder_statement_id,
            "progress": progress,
            "coded": coded_transactions,
            "total": total_transactions
        }
    
    finally:
        db.close()