import csv
import io
from typing import List, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, check_user_role
from app.core.config import settings
from app.db.models import (
    User, UserRole, Transaction, TransactionStatus,
    CardholderStatement, CardholderAssignment, Cardholder
)
from app.db.schemas import (
    Transaction as TransactionSchema,
    TransactionCode,
    TransactionUpdate,
    CSVExportRequest
)
from app.db.session import get_async_db
from app.tasks.statement_tasks import update_coding_progress_task

router = APIRouter()


@router.get("/", response_model=List[TransactionSchema])
async def list_transactions(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    cardholder_statement_id: Optional[int] = None,
    status: Optional[TransactionStatus] = None,
    skip: int = 0,
    limit: int = 50
) -> Any:
    # Build query
    query = select(Transaction).options(
        selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder),
        selectinload(Transaction.coded_by),
        selectinload(Transaction.reviewed_by)
    )
    
    # Filter by cardholder statement if provided
    if cardholder_statement_id:
        query = query.where(Transaction.cardholder_statement_id == cardholder_statement_id)
    
    # Filter by status if provided
    if status:
        query = query.where(Transaction.status == status)
    
    # Apply role-based filtering
    if current_user.role == UserRole.CODER:
        # Coders can only see transactions for cardholders assigned to them
        query = query.join(CardholderStatement).join(Cardholder).join(
            CardholderAssignment
        ).where(
            CardholderAssignment.coder_id == current_user.id,
            CardholderAssignment.is_active == True
        )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    return transactions


@router.get("/{transaction_id}", response_model=TransactionSchema)
async def get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder),
            selectinload(Transaction.coded_by),
            selectinload(Transaction.reviewed_by)
        )
        .where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    
    # Check permissions
    if current_user.role == UserRole.CODER:
        # Verify coder is assigned to this cardholder
        assignment_result = await db.execute(
            select(CardholderAssignment).where(
                CardholderAssignment.cardholder_id == transaction.cardholder_statement.cardholder_id,
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        if not assignment_result.scalar_one_or_none():
            raise HTTPException(403, "Not authorized to view this transaction")
    
    return transaction


@router.put("/{transaction_id}/code", response_model=TransactionSchema)
async def code_transaction(
    transaction_id: int,
    coding_data: TransactionCode,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Get transaction
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.cardholder_statement))
        .where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    
    # Check permissions
    if current_user.role == UserRole.CODER:
        # Verify coder is assigned to this cardholder
        assignment_result = await db.execute(
            select(CardholderAssignment).where(
                CardholderAssignment.cardholder_id == transaction.cardholder_statement.cardholder_id,
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        if not assignment_result.scalar_one_or_none():
            raise HTTPException(403, "Not authorized to code this transaction")
    
    # Update transaction
    transaction.gl_account = coding_data.gl_account
    transaction.job_code = coding_data.job_code
    transaction.phase = coding_data.phase
    transaction.cost_type = coding_data.cost_type
    transaction.notes = coding_data.notes
    transaction.status = TransactionStatus.CODED
    transaction.coded_at = datetime.utcnow()
    transaction.coded_by_id = current_user.id
    
    await db.commit()
    await db.refresh(transaction)
    
    # Queue progress update
    background_tasks.add_task(
        update_coding_progress_task.delay,
        transaction.cardholder_statement_id
    )
    
    return transaction


@router.put("/{transaction_id}/review")
async def review_transaction(
    transaction_id: int,
    background_tasks: BackgroundTasks,
    approved: bool = True,
    rejection_reason: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.REVIEWER, UserRole.ADMIN]))
) -> Any:
    # Get transaction
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    
    if transaction.status != TransactionStatus.CODED:
        raise HTTPException(400, "Transaction must be coded before review")
    
    # Update transaction
    if approved:
        transaction.status = TransactionStatus.REVIEWED
        transaction.rejection_reason = None
    else:
        transaction.status = TransactionStatus.REJECTED
        transaction.rejection_reason = rejection_reason
    
    transaction.reviewed_at = datetime.utcnow()
    transaction.reviewed_by_id = current_user.id
    
    await db.commit()
    
    # Queue progress update
    background_tasks.add_task(
        update_coding_progress_task.delay,
        transaction.cardholder_statement_id
    )
    
    return {"message": f"Transaction {'approved' if approved else 'rejected'}"}


@router.post("/bulk-code")
async def bulk_code_transactions(
    transaction_ids: List[int],
    coding_data: TransactionCode,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if not settings.ENABLE_BULK_CODING:
        raise HTTPException(400, "Bulk coding is disabled")
    
    # Get transactions
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.cardholder_statement))
        .where(Transaction.id.in_(transaction_ids))
    )
    transactions = result.scalars().all()
    
    if len(transactions) != len(transaction_ids):
        raise HTTPException(404, "Some transactions not found")
    
    # Verify permissions for all transactions
    if current_user.role == UserRole.CODER:
        cardholder_ids = {t.cardholder_statement.cardholder_id for t in transactions}
        
        assignment_result = await db.execute(
            select(CardholderAssignment.cardholder_id).where(
                CardholderAssignment.cardholder_id.in_(cardholder_ids),
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        assigned_cardholder_ids = {row[0] for row in assignment_result}
        
        if assigned_cardholder_ids != cardholder_ids:
            raise HTTPException(403, "Not authorized to code some transactions")
    
    # Update transactions
    updated_count = 0
    cardholder_statement_ids = set()
    
    for transaction in transactions:
        transaction.gl_account = coding_data.gl_account
        transaction.job_code = coding_data.job_code
        transaction.phase = coding_data.phase
        transaction.cost_type = coding_data.cost_type
        transaction.notes = coding_data.notes
        transaction.status = TransactionStatus.CODED
        transaction.coded_at = datetime.utcnow()
        transaction.coded_by_id = current_user.id
        
        cardholder_statement_ids.add(transaction.cardholder_statement_id)
        updated_count += 1
    
    await db.commit()
    
    # Queue progress updates
    for cs_id in cardholder_statement_ids:
        background_tasks.add_task(
            update_coding_progress_task.delay,
            cs_id
        )
    
    return {"message": f"Updated {updated_count} transactions"}


@router.post("/export-csv")
async def export_transactions_csv(
    export_request: CSVExportRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Get cardholder statements with transactions
    result = await db.execute(
        select(CardholderStatement)
        .options(
            selectinload(CardholderStatement.cardholder),
            selectinload(CardholderStatement.transactions)
        )
        .where(CardholderStatement.id.in_(export_request.cardholder_statement_ids))
    )
    cardholder_statements = result.scalars().all()
    
    if not cardholder_statements:
        raise HTTPException(404, "No cardholder statements found")
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    for cs in cardholder_statements:
        # Calculate total
        transactions = cs.transactions
        if not export_request.include_uncoded:
            transactions = [t for t in transactions if t.status != TransactionStatus.UNCODED]
        
        if not transactions:
            continue
        
        total_amount = sum(t.amount for t in transactions)
        
        # Generate AP reference
        first_name = cs.cardholder.first_name
        last_name = cs.cardholder.last_name
        month = str(cs.statement.month).zfill(2)
        ap_reference = f"amex{month}{first_name[0]}{last_name[0]}".upper()
        
        # Write APHB header
        writer.writerow([
            "APHB",
            settings.AMEX_VENDOR_CODE,
            f"{total_amount:.2f}",
            ap_reference,
            "", "", "", "", "", ""
        ])
        
        # Write APLB lines
        for transaction in transactions:
            writer.writerow([
                "APLB",
                "3",  # Type
                f"{transaction.amount:.2f}",
                transaction.gl_account or "",
                "",  # Empty
                "1",  # JCCo
                transaction.job_code or "",
                transaction.phase or "",
                transaction.cost_type or "",
                f"{transaction.description} - {transaction.merchant_name or ''}"
            ])
    
    # Return CSV file
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=amex_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )