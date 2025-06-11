from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
import openpyxl
import io

from app.core.security import get_current_user, check_user_role
from app.db.models import (
    User, UserRole, Cardholder, CardholderAssignment, 
    CardholderReviewer
)
from app.db.schemas import (
    Cardholder as CardholderSchema,
    CardholderCreate,
    CardholderUpdate,
    CardholderAssignment as AssignmentSchema,
    CardholderAssignmentCreate,
    CardholderReviewer as ReviewerSchema,
    CardholderReviewerCreate
)
from app.db.session import get_async_db

router = APIRouter()


@router.get("/", response_model=List[CardholderSchema])
async def list_cardholders(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> Any:
    query = select(Cardholder)
    
    # Filter by active status
    if is_active is not None:
        query = query.where(Cardholder.is_active == is_active)
    
    # Search by name
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Cardholder.full_name.ilike(search_term),
                Cardholder.first_name.ilike(search_term),
                Cardholder.last_name.ilike(search_term),
                Cardholder.employee_id.ilike(search_term)
            )
        )
    
    query = query.order_by(Cardholder.full_name).offset(skip).limit(limit)
    result = await db.execute(query)
    cardholders = result.scalars().all()
    
    return cardholders


@router.post("/", response_model=CardholderSchema)
async def create_cardholder(
    cardholder_in: CardholderCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Check if cardholder already exists
    existing = await db.execute(
        select(Cardholder).where(Cardholder.full_name == cardholder_in.full_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Cardholder with this name already exists")
    
    cardholder = Cardholder(**cardholder_in.model_dump())
    db.add(cardholder)
    await db.commit()
    await db.refresh(cardholder)
    
    return cardholder


@router.get("/{cardholder_id}", response_model=CardholderSchema)
async def get_cardholder(
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(Cardholder).where(Cardholder.id == cardholder_id)
    )
    cardholder = result.scalar_one_or_none()
    
    if not cardholder:
        raise HTTPException(404, "Cardholder not found")
    
    return cardholder


@router.put("/{cardholder_id}", response_model=CardholderSchema)
async def update_cardholder(
    cardholder_id: int,
    cardholder_in: CardholderUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    result = await db.execute(
        select(Cardholder).where(Cardholder.id == cardholder_id)
    )
    cardholder = result.scalar_one_or_none()
    
    if not cardholder:
        raise HTTPException(404, "Cardholder not found")
    
    # Update fields
    update_data = cardholder_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cardholder, field, value)
    
    await db.commit()
    await db.refresh(cardholder)
    
    return cardholder


@router.delete("/{cardholder_id}")
async def delete_cardholder(
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    result = await db.execute(
        select(Cardholder).where(Cardholder.id == cardholder_id)
    )
    cardholder = result.scalar_one_or_none()
    
    if not cardholder:
        raise HTTPException(404, "Cardholder not found")
    
    # Soft delete - just mark as inactive
    cardholder.is_active = False
    await db.commit()
    
    return {"message": "Cardholder deactivated"}


# Assignment endpoints
@router.get("/{cardholder_id}/assignments", response_model=List[AssignmentSchema])
async def get_cardholder_assignments(
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(CardholderAssignment)
        .options(selectinload(CardholderAssignment.coder))
        .where(CardholderAssignment.cardholder_id == cardholder_id)
    )
    assignments = result.scalars().all()
    
    return assignments


@router.post("/{cardholder_id}/assignments", response_model=AssignmentSchema)
async def create_cardholder_assignment(
    cardholder_id: int,
    assignment_in: CardholderAssignmentCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Verify cardholder exists
    cardholder_result = await db.execute(
        select(Cardholder).where(Cardholder.id == cardholder_id)
    )
    if not cardholder_result.scalar_one_or_none():
        raise HTTPException(404, "Cardholder not found")
    
    # Check if assignment already exists
    existing = await db.execute(
        select(CardholderAssignment).where(
            CardholderAssignment.cardholder_id == cardholder_id,
            CardholderAssignment.coder_id == assignment_in.coder_id,
            CardholderAssignment.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Active assignment already exists")
    
    assignment = CardholderAssignment(
        cardholder_id=cardholder_id,
        **assignment_in.model_dump()
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return assignment


# Reviewer endpoints
@router.get("/{cardholder_id}/reviewers", response_model=List[ReviewerSchema])
async def get_cardholder_reviewers(
    cardholder_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    result = await db.execute(
        select(CardholderReviewer)
        .options(selectinload(CardholderReviewer.reviewer))
        .where(CardholderReviewer.cardholder_id == cardholder_id)
        .order_by(CardholderReviewer.review_order)
    )
    reviewers = result.scalars().all()
    
    return reviewers


@router.post("/{cardholder_id}/reviewers", response_model=ReviewerSchema)
async def create_cardholder_reviewer(
    cardholder_id: int,
    reviewer_in: CardholderReviewerCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    # Verify cardholder exists
    cardholder_result = await db.execute(
        select(Cardholder).where(Cardholder.id == cardholder_id)
    )
    if not cardholder_result.scalar_one_or_none():
        raise HTTPException(404, "Cardholder not found")
    
    # Check if reviewer already exists
    existing = await db.execute(
        select(CardholderReviewer).where(
            CardholderReviewer.cardholder_id == cardholder_id,
            CardholderReviewer.reviewer_id == reviewer_in.reviewer_id,
            CardholderReviewer.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Active reviewer assignment already exists")
    
    reviewer = CardholderReviewer(
        cardholder_id=cardholder_id,
        **reviewer_in.model_dump()
    )
    db.add(reviewer)
    await db.commit()
    await db.refresh(reviewer)
    
    return reviewer


@router.post("/import")
async def import_cardholders_from_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(check_user_role([UserRole.ADMIN]))
) -> Any:
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "File must be an Excel file")
    
    try:
        # Read Excel file
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents))
        sheet = wb.active
        
        imported_count = 0
        errors = []
        
        # Process rows (assuming headers in row 1)
        for row_num in range(2, sheet.max_row + 1):
            try:
                # Extract data based on expected columns
                pdf_name = sheet.cell(row=row_num, column=1).value
                csv_name = sheet.cell(row=row_num, column=2).value
                coder_email = sheet.cell(row=row_num, column=3).value
                cc_email = sheet.cell(row=row_num, column=4).value
                
                if not pdf_name:
                    continue
                
                # Parse name
                name_parts = pdf_name.strip().split()
                first_name = name_parts[0] if name_parts else ""
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
                full_name = pdf_name.strip()
                
                # Get or create cardholder
                cardholder_result = await db.execute(
                    select(Cardholder).where(Cardholder.full_name == full_name)
                )
                cardholder = cardholder_result.scalar_one_or_none()
                
                if not cardholder:
                    cardholder = Cardholder(
                        full_name=full_name,
                        first_name=first_name,
                        last_name=last_name
                    )
                    db.add(cardholder)
                    await db.flush()
                
                # Create assignment if coder email provided
                if coder_email:
                    # Get coder user
                    coder_result = await db.execute(
                        select(User).where(User.email == coder_email)
                    )
                    coder = coder_result.scalar_one_or_none()
                    
                    if coder:
                        # Check if assignment exists
                        assignment_result = await db.execute(
                            select(CardholderAssignment).where(
                                CardholderAssignment.cardholder_id == cardholder.id,
                                CardholderAssignment.coder_id == coder.id
                            )
                        )
                        assignment = assignment_result.scalar_one_or_none()
                        
                        if not assignment:
                            cc_emails = [cc_email] if cc_email else []
                            assignment = CardholderAssignment(
                                cardholder_id=cardholder.id,
                                coder_id=coder.id,
                                cc_emails=cc_emails
                            )
                            db.add(assignment)
                    else:
                        errors.append(f"Row {row_num}: Coder {coder_email} not found")
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        await db.commit()
        
        return {
            "imported": imported_count,
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(500, f"Failed to process file: {str(e)}")