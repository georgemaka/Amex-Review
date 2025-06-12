import os
import shutil
from typing import List, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, check_user_role
from app.core.config import settings
from app.db.models import (
    User, UserRole, Statement, StatementStatus, 
    CardholderStatement, Transaction
)
from app.db.schemas import (
    Statement as StatementSchema,
    StatementUpload,
    StatementProgress
)
from app.db.session import get_async_db
from app.tasks.statement_tasks import process_statement_task
from app.tasks.email_tasks import send_coding_assignments_task

router = APIRouter()


@router.post("/upload", response_model=StatementSchema)
async def upload_statement(
    background_tasks: BackgroundTasks,
    month: int = Form(...),
    year: int = Form(...),
    closing_date: datetime = Form(...),
    pdf_file: UploadFile = File(...),
    excel_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Validate file extensions
    if not pdf_file.filename.endswith('.pdf'):
        raise HTTPException(400, "PDF file must have .pdf extension")
    
    if not excel_file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Excel file must have .xlsx or .xls extension")
    
    # Check for duplicate statement with same files
    existing = await db.execute(
        select(Statement).where(
            Statement.month == month,
            Statement.year == year,
            Statement.pdf_filename == pdf_file.filename
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Statement with PDF file '{pdf_file.filename}' for {month}/{year} already exists")
    
    # Create upload directories
    upload_dir = os.path.join(settings.UPLOAD_DIR, "statements", f"{year}-{month:02d}")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save files
    pdf_path = os.path.join(upload_dir, pdf_file.filename)
    excel_path = os.path.join(upload_dir, excel_file.filename)
    
    try:
        # Save PDF
        with open(pdf_path, "wb") as f:
            shutil.copyfileobj(pdf_file.file, f)
        
        # Save Excel
        with open(excel_path, "wb") as f:
            shutil.copyfileobj(excel_file.file, f)
    
    except Exception as e:
        raise HTTPException(500, f"Failed to save files: {str(e)}")
    
    # Create statement record (handle timezone-aware datetime)
    statement = Statement(
        month=month,
        year=year,
        closing_date=closing_date.replace(tzinfo=None) if closing_date.tzinfo else closing_date,
        pdf_filename=pdf_file.filename,
        excel_filename=excel_file.filename,
        pdf_path=pdf_path,
        excel_path=excel_path,
        status=StatementStatus.PENDING,
        created_by_id=current_user.id
    )
    db.add(statement)
    await db.commit()
    await db.refresh(statement)
    
    # Queue processing task
    background_tasks.add_task(
        process_statement_task.delay,
        statement.id
    )
    
    return statement


@router.get("/", response_model=List[StatementSchema])
async def list_statements(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
) -> Any:
    result = await db.execute(
        select(Statement)
        .order_by(Statement.year.desc(), Statement.month.desc())
        .offset(skip)
        .limit(limit)
    )
    statements = result.scalars().all()
    return statements


@router.get("/{statement_id}", response_model=StatementSchema)
async def get_statement(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id)
    )
    statement = result.scalar_one_or_none()
    
    if not statement:
        raise HTTPException(404, "Statement not found")
    
    return statement


@router.get("/{statement_id}/progress", response_model=StatementProgress)
async def get_statement_progress(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Get statement
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id)
    )
    statement = result.scalar_one_or_none()
    
    if not statement:
        raise HTTPException(404, "Statement not found")
    
    # Get cardholder statements with progress
    ch_result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(CardholderStatement.statement_id == statement_id)
    )
    cardholder_statements = ch_result.scalars().all()
    
    # Calculate overall progress
    total_cardholders = len(cardholder_statements)
    total_transactions = sum(cs.transaction_count for cs in cardholder_statements)
    
    # Get coded transaction count
    coded_result = await db.execute(
        select(func.count(Transaction.id))
        .join(CardholderStatement)
        .where(
            CardholderStatement.statement_id == statement_id,
            Transaction.status != "uncoded"
        )
    )
    coded_transactions = coded_result.scalar() or 0
    
    # Build cardholder progress list
    cardholder_progress = []
    for cs in cardholder_statements:
        # Get transaction counts by status
        trans_result = await db.execute(
            select(
                Transaction.status,
                func.count(Transaction.id).label("count")
            )
            .where(Transaction.cardholder_statement_id == cs.id)
            .group_by(Transaction.status)
        )
        status_counts = {row.status: row.count for row in trans_result}
        
        cardholder_progress.append({
            "cardholder_id": cs.cardholder_id,
            "cardholder_statement_id": cs.id,
            "cardholder_name": cs.cardholder.full_name,
            "total_transactions": cs.transaction_count,
            "coded_transactions": status_counts.get("coded", 0),
            "reviewed_transactions": status_counts.get("reviewed", 0),
            "rejected_transactions": status_counts.get("rejected", 0),
            "progress_percentage": cs.coding_progress
        })
    
    # Calculate overall progress
    overall_progress = (coded_transactions / total_transactions * 100) if total_transactions > 0 else 0
    
    return {
        "statement_id": statement_id,
        "status": statement.status,
        "total_cardholders": total_cardholders,
        "processed_cardholders": len([cs for cs in cardholder_statements if cs.coding_progress >= 100]),
        "total_transactions": total_transactions,
        "coded_transactions": coded_transactions,
        "progress_percentage": overall_progress,
        "cardholder_progress": cardholder_progress
    }


@router.post("/{statement_id}/send-emails")
async def send_statement_emails(
    statement_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Verify statement exists and is ready
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id)
    )
    statement = result.scalar_one_or_none()
    
    if not statement:
        raise HTTPException(404, "Statement not found")
    
    if statement.status not in [StatementStatus.SPLIT, StatementStatus.DISTRIBUTED]:
        raise HTTPException(400, "Statement must be processed before sending emails")
    
    # Queue email task
    background_tasks.add_task(
        send_coding_assignments_task.delay,
        statement_id
    )
    
    # Update status
    statement.status = StatementStatus.DISTRIBUTED
    await db.commit()
    
    return {"message": "Email distribution started", "statement_id": statement_id}


@router.get("/{statement_id}")
async def get_statement(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id)
    )
    statement = result.scalar_one_or_none()
    
    if not statement:
        raise HTTPException(404, "Statement not found")
    
    return statement


@router.get("/{statement_id}/cardholder/{cardholder_id}/pdf")
async def download_cardholder_pdf(
    statement_id: int,
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Get cardholder statement
    result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(
            CardholderStatement.statement_id == statement_id,
            CardholderStatement.cardholder_id == cardholder_id
        )
    )
    cardholder_statement = result.scalar_one_or_none()
    
    if not cardholder_statement:
        raise HTTPException(404, "Cardholder statement not found")
    
    # Check if PDF exists
    if not cardholder_statement.pdf_path or not os.path.exists(cardholder_statement.pdf_path):
        raise HTTPException(404, "PDF file not found")
    
    # Return PDF file
    return FileResponse(
        cardholder_statement.pdf_path,
        media_type="application/pdf",
        filename=f"{cardholder_statement.cardholder.full_name}_{statement_id}.pdf"
    )


@router.get("/{statement_id}/cardholder/{cardholder_id}/csv")
async def download_cardholder_csv(
    statement_id: int,
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Get cardholder statement
    result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(
            CardholderStatement.statement_id == statement_id,
            CardholderStatement.cardholder_id == cardholder_id
        )
    )
    cardholder_statement = result.scalar_one_or_none()
    
    if not cardholder_statement:
        raise HTTPException(404, "Cardholder statement not found")
    
    # Check if CSV exists
    if not cardholder_statement.csv_path or not os.path.exists(cardholder_statement.csv_path):
        raise HTTPException(404, "CSV file not found")
    
    # Return CSV file
    return FileResponse(
        cardholder_statement.csv_path,
        media_type="text/csv",
        filename=f"{cardholder_statement.cardholder.full_name}_{statement_id}.csv"
    )


@router.get("/{statement_id}/download-all-pdfs")
async def download_all_pdfs(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    import zipfile
    import tempfile
    
    # Get all cardholder statements
    result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(CardholderStatement.statement_id == statement_id)
    )
    cardholder_statements = result.scalars().all()
    
    if not cardholder_statements:
        raise HTTPException(404, "No cardholder statements found")
    
    # Create temporary ZIP file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    
    try:
        with zipfile.ZipFile(temp_zip.name, 'w') as zip_file:
            for cs in cardholder_statements:
                if cs.pdf_path and os.path.exists(cs.pdf_path):
                    # Add PDF to ZIP with cardholder name
                    arcname = f"pdfs/{cs.cardholder.full_name}_{cs.cardholder.id}.pdf"
                    zip_file.write(cs.pdf_path, arcname)
        
        # Return ZIP file
        return FileResponse(
            temp_zip.name,
            media_type="application/zip",
            filename=f"statement_{statement_id}_all_pdfs.zip",
            background=BackgroundTask(lambda: os.unlink(temp_zip.name))
        )
    except Exception as e:
        os.unlink(temp_zip.name)
        raise HTTPException(500, f"Failed to create ZIP: {str(e)}")


@router.get("/{statement_id}/download-all-csvs")
async def download_all_csvs(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    import zipfile
    import tempfile
    
    # Get all cardholder statements
    result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(CardholderStatement.statement_id == statement_id)
    )
    cardholder_statements = result.scalars().all()
    
    if not cardholder_statements:
        raise HTTPException(404, "No cardholder statements found")
    
    # Create temporary ZIP file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    
    try:
        with zipfile.ZipFile(temp_zip.name, 'w') as zip_file:
            for cs in cardholder_statements:
                if cs.csv_path and os.path.exists(cs.csv_path):
                    # Add CSV to ZIP with cardholder name
                    arcname = f"csvs/{cs.cardholder.full_name}_{cs.cardholder.id}.csv"
                    zip_file.write(cs.csv_path, arcname)
        
        # Return ZIP file
        return FileResponse(
            temp_zip.name,
            media_type="application/zip",
            filename=f"statement_{statement_id}_all_csvs.zip",
            background=BackgroundTask(lambda: os.unlink(temp_zip.name))
        )
    except Exception as e:
        os.unlink(temp_zip.name)
        raise HTTPException(500, f"Failed to create ZIP: {str(e)}")


@router.get("/{statement_id}/download-all")
async def download_all_files(
    statement_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    import zipfile
    import tempfile
    
    # Get all cardholder statements
    result = await db.execute(
        select(CardholderStatement)
        .options(selectinload(CardholderStatement.cardholder))
        .where(CardholderStatement.statement_id == statement_id)
    )
    cardholder_statements = result.scalars().all()
    
    if not cardholder_statements:
        raise HTTPException(404, "No cardholder statements found")
    
    # Create temporary ZIP file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    
    try:
        with zipfile.ZipFile(temp_zip.name, 'w') as zip_file:
            for cs in cardholder_statements:
                # Add PDF if exists
                if cs.pdf_path and os.path.exists(cs.pdf_path):
                    arcname = f"pdfs/{cs.cardholder.full_name}_{cs.cardholder.id}.pdf"
                    zip_file.write(cs.pdf_path, arcname)
                
                # Add CSV if exists
                if cs.csv_path and os.path.exists(cs.csv_path):
                    arcname = f"csvs/{cs.cardholder.full_name}_{cs.cardholder.id}.csv"
                    zip_file.write(cs.csv_path, arcname)
        
        # Return ZIP file
        return FileResponse(
            temp_zip.name,
            media_type="application/zip",
            filename=f"statement_{statement_id}_all_files.zip",
            background=BackgroundTask(lambda: os.unlink(temp_zip.name))
        )
    except Exception as e:
        os.unlink(temp_zip.name)
        raise HTTPException(500, f"Failed to create ZIP: {str(e)}")