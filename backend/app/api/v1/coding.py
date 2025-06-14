from typing import List, Any, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, case
from sqlalchemy.orm import selectinload, joinedload

from app.core.security import get_current_user, check_user_role
from app.db.models import (
    User, UserRole, Transaction, TransactionStatus, CodingType,
    CardholderStatement, CardholderAssignment, Cardholder,
    Company, GLAccount, Job, JobPhase, JobCostType,
    Equipment, EquipmentCostCode, EquipmentCostType,
    Statement
)
from app.db.schemas import (
    TransactionWithCoding,
    TransactionCodingUpdate,
    BatchCodingRequest,
    PaginatedTransactionsResponse,
    Company as CompanySchema,
    GLAccount as GLAccountSchema,
    Job as JobSchema,
    JobPhase as JobPhaseSchema,
    JobCostType as JobCostTypeSchema,
    Equipment as EquipmentSchema,
    EquipmentCostCode as EquipmentCostCodeSchema,
    EquipmentCostType as EquipmentCostTypeSchema,
)
from app.db.session import get_async_db

router = APIRouter()


@router.get("/transactions", response_model=PaginatedTransactionsResponse)
async def list_coding_transactions(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    cardholder_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[TransactionStatus] = None,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    List transactions for coding with filters.
    """
    # Build base query with all relationships
    query = select(Transaction).options(
        selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder),
        selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.statement),
        selectinload(Transaction.coded_by),
        selectinload(Transaction.reviewed_by),
        selectinload(Transaction.category),
        selectinload(Transaction.company),
        selectinload(Transaction.gl_account_rel),
        selectinload(Transaction.job),
        selectinload(Transaction.job_phase),
        selectinload(Transaction.job_cost_type),
        selectinload(Transaction.equipment),
        selectinload(Transaction.equipment_cost_code),
        selectinload(Transaction.equipment_cost_type),
    )
    
    # Join with cardholder statement for filtering
    query = query.join(CardholderStatement)
    
    # Filter by cardholder if specified
    if cardholder_id:
        query = query.where(CardholderStatement.cardholder_id == cardholder_id)
    
    # Filter by statement if specified
    if statement_id:
        query = query.where(CardholderStatement.statement_id == statement_id)
    
    # For non-admin users, only show transactions for their assigned cardholders
    if current_user.role != UserRole.ADMIN:
        # Get assigned cardholder IDs
        assigned_stmt = select(CardholderAssignment.cardholder_id).where(
            and_(
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        result = await db.execute(assigned_stmt)
        assigned_cardholder_ids = [row[0] for row in result.fetchall()]
        
        if not assigned_cardholder_ids:
            return []
        
        query = query.where(CardholderStatement.cardholder_id.in_(assigned_cardholder_ids))
    
    # Date filters
    if date_from:
        query = query.where(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.where(Transaction.transaction_date <= date_to)
    
    # Status filter
    if status:
        query = query.where(Transaction.status == status)
    
    # Create a subquery for the filtered results
    subq = query.subquery()
    
    # First, get total count and totals WITHOUT pagination
    count_query = select(
        func.count(subq.c.id).label('total_count'),
        func.coalesce(func.sum(subq.c.amount), 0).label('total_amount'),
        func.count(
            case(
                (subq.c.status.in_([TransactionStatus.CODED, TransactionStatus.REVIEWED]), 1),
                else_=None
            )
        ).label('coded_count'),
        func.coalesce(
            func.sum(
                case(
                    (subq.c.status.in_([TransactionStatus.CODED, TransactionStatus.REVIEWED]), subq.c.amount),
                    else_=0
                )
            ), 
            0
        ).label('coded_amount')
    )
    
    totals_result = await db.execute(count_query)
    totals = totals_result.one()
    
    # Order by transaction date desc
    query = query.order_by(Transaction.transaction_date.desc())
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    return PaginatedTransactionsResponse(
        transactions=transactions,
        total_count=totals.total_count or 0,
        total_amount=float(totals.total_amount or 0),
        coded_count=totals.coded_count or 0,
        coded_amount=float(totals.coded_amount or 0),
        page=skip // limit,
        page_size=limit
    )


@router.put("/transactions/{transaction_id}", response_model=TransactionWithCoding)
async def code_transaction(
    transaction_id: int,
    coding_data: TransactionCodingUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Code a single transaction.
    """
    # Get transaction
    query = select(Transaction).options(
        selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder)
    ).where(Transaction.id == transaction_id)
    
    result = await db.execute(query)
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if the statement is locked
    statement_query = select(Statement).where(
        Statement.id == Transaction.cardholder_statement.has(
            CardholderStatement.statement_id == transaction.cardholder_statement.statement_id
        )
    )
    statement_result = await db.execute(
        select(Statement).join(CardholderStatement).where(
            CardholderStatement.id == transaction.cardholder_statement_id,
            Statement.id == CardholderStatement.statement_id
        )
    )
    statement = statement_result.scalar_one_or_none()
    
    if statement and statement.is_locked:
        raise HTTPException(status_code=403, detail="Cannot code transactions in a locked statement")
    
    # Check permissions - only admin or assigned coder can code
    if current_user.role != UserRole.ADMIN:
        # Check if user is assigned to this cardholder
        assignment_query = select(CardholderAssignment).where(
            and_(
                CardholderAssignment.cardholder_id == transaction.cardholder_statement.cardholder_id,
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        assignment_result = await db.execute(assignment_query)
        if not assignment_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You are not assigned to this cardholder")
    
    # Update transaction with coding data
    for field, value in coding_data.dict(exclude_unset=True).items():
        setattr(transaction, field, value)
    
    # Set coding metadata
    transaction.status = TransactionStatus.CODED
    transaction.coded_at = datetime.utcnow()
    transaction.coded_by_id = current_user.id
    
    await db.commit()
    await db.refresh(transaction)
    
    # Update coding progress
    from app.tasks.statement_tasks import update_coding_progress_task
    update_coding_progress_task.delay(transaction.cardholder_statement_id)
    
    return transaction


@router.post("/transactions/batch", response_model=List[TransactionWithCoding])
async def batch_code_transactions(
    batch_request: BatchCodingRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Code multiple transactions at once.
    """
    # Get all transactions
    query = select(Transaction).options(
        selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder)
    ).where(Transaction.id.in_(batch_request.transaction_ids))
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    if len(transactions) != len(batch_request.transaction_ids):
        raise HTTPException(status_code=404, detail="Some transactions not found")
    
    # Check if any of the statements are locked
    statement_ids = {t.cardholder_statement.statement_id for t in transactions}
    locked_statements = await db.execute(
        select(Statement).where(
            Statement.id.in_(statement_ids),
            Statement.is_locked == True
        )
    )
    if locked_statements.scalars().first():
        raise HTTPException(status_code=403, detail="Cannot code transactions in locked statements")
    
    # Check permissions for all transactions
    if current_user.role != UserRole.ADMIN:
        cardholder_ids = {t.cardholder_statement.cardholder_id for t in transactions}
        
        # Check if user is assigned to all cardholders
        assignment_query = select(CardholderAssignment.cardholder_id).where(
            and_(
                CardholderAssignment.cardholder_id.in_(cardholder_ids),
                CardholderAssignment.coder_id == current_user.id,
                CardholderAssignment.is_active == True
            )
        )
        assignment_result = await db.execute(assignment_query)
        assigned_cardholder_ids = {row[0] for row in assignment_result.fetchall()}
        
        if cardholder_ids != assigned_cardholder_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to all cardholders")
    
    # Update all transactions
    updated_transactions = []
    for transaction in transactions:
        # Update with coding data
        for field, value in batch_request.dict(exclude={'transaction_ids'}, exclude_unset=True).items():
            setattr(transaction, field, value)
        
        # Set coding metadata
        transaction.status = TransactionStatus.CODED
        transaction.coded_at = datetime.utcnow()
        transaction.coded_by_id = current_user.id
        
        updated_transactions.append(transaction)
    
    await db.commit()
    
    # Update coding progress for all affected cardholder statements
    cardholder_statement_ids = {t.cardholder_statement_id for t in transactions}
    from app.tasks.statement_tasks import update_coding_progress_task
    for cs_id in cardholder_statement_ids:
        update_coding_progress_task.delay(cs_id)
    
    # Refresh all transactions to get updated relationships
    for transaction in updated_transactions:
        await db.refresh(transaction)
    
    return updated_transactions


# Reference data endpoints

@router.get("/companies", response_model=List[CompanySchema])
async def list_companies(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = True
) -> Any:
    """
    List all companies.
    """
    query = select(Company)
    if is_active is not None:
        query = query.where(Company.is_active == is_active)
    
    result = await db.execute(query.order_by(Company.code))
    companies = result.scalars().all()
    
    return companies


@router.get("/gl-accounts", response_model=List[GLAccountSchema])
async def list_gl_accounts(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    company_id: Optional[int] = None,
    is_active: Optional[bool] = True
) -> Any:
    """
    List GL accounts, optionally filtered by company.
    """
    query = select(GLAccount).options(selectinload(GLAccount.company))
    
    if company_id:
        query = query.where(GLAccount.company_id == company_id)
    if is_active is not None:
        query = query.where(GLAccount.is_active == is_active)
    
    result = await db.execute(query.order_by(GLAccount.account_code))
    gl_accounts = result.scalars().all()
    
    return gl_accounts


@router.get("/jobs", response_model=List[JobSchema])
async def list_jobs(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = True,
    search: Optional[str] = None
) -> Any:
    """
    List jobs with optional search.
    """
    query = select(Job)
    
    if is_active is not None:
        query = query.where(Job.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Job.job_number.ilike(search_term),
                Job.name.ilike(search_term)
            )
        )
    
    result = await db.execute(query.order_by(Job.job_number))
    jobs = result.scalars().all()
    
    return jobs


@router.get("/jobs/{job_id}/phases", response_model=List[JobPhaseSchema])
async def list_job_phases(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    List phases for a specific job.
    """
    query = select(JobPhase).options(
        selectinload(JobPhase.job)
    ).where(JobPhase.job_id == job_id)
    
    result = await db.execute(query.order_by(JobPhase.phase_code))
    phases = result.scalars().all()
    
    return phases


@router.get("/job-cost-types", response_model=List[JobCostTypeSchema])
async def list_job_cost_types(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    List all job cost types.
    """
    query = select(JobCostType)
    result = await db.execute(query.order_by(JobCostType.code))
    cost_types = result.scalars().all()
    
    return cost_types


@router.get("/equipment", response_model=List[EquipmentSchema])
async def list_equipment(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = True,
    search: Optional[str] = None
) -> Any:
    """
    List equipment with optional search.
    """
    query = select(Equipment)
    
    if is_active is not None:
        query = query.where(Equipment.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Equipment.equipment_number.ilike(search_term),
                Equipment.description.ilike(search_term)
            )
        )
    
    result = await db.execute(query.order_by(Equipment.equipment_number))
    equipment = result.scalars().all()
    
    return equipment


@router.get("/equipment-cost-codes", response_model=List[EquipmentCostCodeSchema])
async def list_equipment_cost_codes(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    List all equipment cost codes.
    """
    query = select(EquipmentCostCode)
    result = await db.execute(query.order_by(EquipmentCostCode.code))
    cost_codes = result.scalars().all()
    
    return cost_codes


@router.get("/equipment-cost-types", response_model=List[EquipmentCostTypeSchema])
async def list_equipment_cost_types(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    List all equipment cost types.
    """
    query = select(EquipmentCostType)
    result = await db.execute(query.order_by(EquipmentCostType.code))
    cost_types = result.scalars().all()
    
    return cost_types