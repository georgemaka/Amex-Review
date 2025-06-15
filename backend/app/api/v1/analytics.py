from typing import List, Optional, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.core.permissions import get_user_assigned_cardholders
from app.db.models import (
    User, UserRole, Transaction, SpendingCategory, SpendingAnalytics,
    SpendingAlert, BudgetLimit, MerchantMapping, CardholderStatement, Cardholder
)
from app.db.schemas import (
    SpendingCategory as SpendingCategorySchema,
    SpendingAnalytics as SpendingAnalyticsSchema,
    SpendingAlert as SpendingAlertSchema,
    BudgetLimit as BudgetLimitSchema,
    BudgetLimitCreate,
    AnalyticsDashboard,
    CategorySpending,
    MerchantSpending,
    SpendingTrend,
    CardholderSpending
)
from app.db.session import get_async_db
from app.services.analytics_processor import AnalyticsProcessor

router = APIRouter()


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    cardholder_id: Optional[int] = None,
    category_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get analytics dashboard data calculated directly from transactions."""
    # Get user's assigned cardholders if they're a reviewer
    assigned_cardholder_ids = []
    if current_user.role == UserRole.REVIEWER:
        assigned_cardholder_ids = await get_user_assigned_cardholders(
            current_user, db, include_review_assignments=True
        )
        if not assigned_cardholder_ids:
            # Reviewer has no assignments - return empty dashboard
            return AnalyticsDashboard(
                total_spending=0,
                total_transactions=0,
                average_transaction=0,
                top_categories=[],
                top_merchants=[],
                spending_trend=[],
                recent_alerts=[],
                period_comparison={
                    'current_total': 0,
                    'previous_total': 0,
                    'change_amount': 0,
                    'change_percent': 0
                }
            )
    
    # Build transaction filters
    transaction_filters = []
    
    # Use date range if provided, otherwise fall back to month/year
    if date_from and date_to:
        try:
            from_date = datetime.strptime(date_from, '%Y-%m-%d')
            to_date = datetime.strptime(date_to, '%Y-%m-%d')
            transaction_filters.extend([
                Transaction.transaction_date >= from_date,
                Transaction.transaction_date <= to_date
            ])
        except ValueError:
            # If date parsing fails, fall back to month/year
            pass
    else:
        # Fall back to month/year for backward compatibility
        if not month or not year:
            now = datetime.now()
            month = month or now.month
            year = year or now.year
        
        transaction_filters.extend([
            func.extract('month', Transaction.transaction_date) == month,
            func.extract('year', Transaction.transaction_date) == year
        ])
    
    if cardholder_id:
        transaction_filters.append(
            CardholderStatement.cardholder_id == cardholder_id
        )
    elif current_user.role == UserRole.REVIEWER and assigned_cardholder_ids:
        # Reviewer can only see their assigned cardholders
        transaction_filters.append(
            CardholderStatement.cardholder_id.in_(assigned_cardholder_ids)
        )
    
    if category_id:
        transaction_filters.append(Transaction.category_id == category_id)
    
    if statement_id:
        transaction_filters.append(
            CardholderStatement.statement_id == statement_id
        )
    
    # Get total spending and transaction count directly from transactions
    query = select(
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.amount).label('total'),
        func.avg(Transaction.amount).label('average')
    ).select_from(Transaction)
    
    # Join with CardholderStatement if we need to filter by cardholder or statement
    if cardholder_id or statement_id:
        query = query.join(CardholderStatement)
    
    # Apply filters
    query = query.where(and_(*transaction_filters))
    
    totals_result = await db.execute(query)
    totals = totals_result.one()
    
    total_spending = float(totals.total or 0)
    total_transactions = int(totals.count or 0)
    average_transaction = float(totals.average or 0)
    
    # Get category breakdown directly from transactions
    category_query = select(
        Transaction.category_id,
        SpendingCategory.name,
        SpendingCategory.color,
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.amount).label('total')
    ).select_from(Transaction)
    
    # Join with CardholderStatement if we need to filter by cardholder or statement
    if cardholder_id or statement_id:
        category_query = category_query.join(CardholderStatement)
    
    category_query = (
        category_query
        .outerjoin(SpendingCategory, Transaction.category_id == SpendingCategory.id)
        .where(and_(*transaction_filters))
        .group_by(Transaction.category_id, SpendingCategory.name, SpendingCategory.color)
    )
    
    category_result = await db.execute(category_query)
    category_data = category_result.all()
    
    top_categories = []
    for row in category_data:
        cat_id = row.category_id or 0
        cat_name = row.name or "Uncategorized"
        cat_color = row.color or "#95A5A6"
        cat_total = float(row.total or 0)
        cat_count = int(row.count or 0)
        
        percentage = (cat_total / total_spending * 100) if total_spending > 0 else 0
        
        top_categories.append(CategorySpending(
            category_id=cat_id,
            category_name=cat_name,
            category_color=cat_color,
            total_amount=cat_total,
            transaction_count=cat_count,
            percentage=percentage
        ))
    
    top_categories.sort(key=lambda x: x.total_amount, reverse=True)
    
    # Get top merchants directly from transactions
    merchant_query = select(
        Transaction.merchant_name,
        SpendingCategory.name.label('category_name'),
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.amount).label('total'),
        func.avg(Transaction.amount).label('average')
    ).select_from(Transaction)
    
    # Join with CardholderStatement if we need to filter by cardholder or statement
    if cardholder_id or statement_id:
        merchant_query = merchant_query.join(CardholderStatement)
    
    merchant_query = (
        merchant_query
        .outerjoin(SpendingCategory, Transaction.category_id == SpendingCategory.id)
        .where(
            and_(
                *transaction_filters,
                Transaction.merchant_name.isnot(None)
            )
        )
        .group_by(Transaction.merchant_name, SpendingCategory.name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(10)
    )
    
    merchant_result = await db.execute(merchant_query)
    merchant_data = merchant_result.all()
    
    top_merchants = []
    for row in merchant_data:
        # Clean up merchant name for better display
        merchant_name = row.merchant_name
        if merchant_name:
            # Remove REF# prefix if present
            if merchant_name.startswith('REF#'):
                parts = merchant_name.split(' ', 2)
                if len(parts) > 2:
                    merchant_name = parts[2]  # Get everything after REF# and number
            
        top_merchants.append(MerchantSpending(
            merchant_name=merchant_name,
            total_amount=float(row.total or 0),
            transaction_count=int(row.count or 0),
            average_amount=float(row.average or 0),
            category_name=row.category_name or "Uncategorized"
        ))
    
    # Get spending trend (last 12 months)
    processor = AnalyticsProcessor(db)
    trend_data = await processor.get_spending_trends(
        cardholder_id=cardholder_id,
        months=12
    )
    spending_trend = [SpendingTrend(**t) for t in trend_data]
    
    # Get recent alerts
    alert_result = await db.execute(
        select(SpendingAlert)
        .where(
            and_(
                SpendingAlert.is_resolved == False,
                SpendingAlert.cardholder_id == cardholder_id if cardholder_id else True
            )
        )
        .order_by(SpendingAlert.created_at.desc())
        .limit(10)
    )
    recent_alerts = alert_result.scalars().all()
    
    # Calculate period comparison from transactions
    prev_filters = []
    
    if date_from and date_to:
        # For date ranges, calculate the previous period of the same duration
        try:
            from_date = datetime.strptime(date_from, '%Y-%m-%d')
            to_date = datetime.strptime(date_to, '%Y-%m-%d')
            period_days = (to_date - from_date).days + 1
            
            # Previous period is the same duration before the current period
            prev_to_date = from_date - timedelta(days=1)
            prev_from_date = prev_to_date - timedelta(days=period_days - 1)
            
            prev_filters.extend([
                Transaction.transaction_date >= prev_from_date,
                Transaction.transaction_date <= prev_to_date
            ])
        except ValueError:
            pass
    else:
        # For month/year, use previous month
        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1
        
        prev_filters.extend([
            func.extract('month', Transaction.transaction_date) == prev_month,
            func.extract('year', Transaction.transaction_date) == prev_year
        ])
    
    if cardholder_id:
        prev_filters.append(
            CardholderStatement.cardholder_id == cardholder_id
        )
    
    if category_id:
        prev_filters.append(Transaction.category_id == category_id)
    
    if statement_id:
        # For previous period with statement filter, we might not have data
        # So we'll skip the statement filter for previous period comparison
        pass
    
    prev_query = select(
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).select_from(Transaction)
    
    # Join with CardholderStatement if we need to filter by cardholder
    if cardholder_id:
        prev_query = prev_query.join(CardholderStatement)
    
    prev_query = prev_query.where(and_(*prev_filters))
    
    prev_result = await db.execute(prev_query)
    prev_data = prev_result.one()
    
    previous_total = float(prev_data.total or 0)
    change_amount = total_spending - previous_total
    change_percent = ((total_spending / previous_total - 1) * 100) if previous_total > 0 else 0
    
    period_comparison = {
        'current_total': total_spending,
        'previous_total': previous_total,
        'change_amount': change_amount,
        'change_percent': change_percent
    }
    
    return AnalyticsDashboard(
        total_spending=total_spending,
        total_transactions=total_transactions,
        average_transaction=average_transaction,
        top_categories=top_categories[:5],
        top_merchants=top_merchants,
        spending_trend=spending_trend,
        recent_alerts=recent_alerts,
        period_comparison=period_comparison
    )


@router.get("/spending-by-category", response_model=List[CategorySpending])
async def get_spending_by_category(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    cardholder_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get spending breakdown by category."""
    # Default to current month
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    
    # Query analytics grouped by category
    filters = [
        SpendingAnalytics.period_month == month,
        SpendingAnalytics.period_year == year
    ]
    if cardholder_id:
        filters.append(SpendingAnalytics.cardholder_id == cardholder_id)
    
    result = await db.execute(
        select(
            SpendingAnalytics.category_id,
            func.sum(SpendingAnalytics.total_amount).label('total_amount'),
            func.sum(SpendingAnalytics.transaction_count).label('transaction_count')
        )
        .where(and_(*filters))
        .group_by(SpendingAnalytics.category_id)
    )
    
    # Get categories
    cat_result = await db.execute(select(SpendingCategory))
    categories = {c.id: c for c in cat_result.scalars().all()}
    
    # Calculate total for percentages
    category_data = []
    total_spending = 0
    
    for row in result:
        category = categories.get(row.category_id)
        category_data.append({
            'category_id': row.category_id or 0,
            'category_name': category.name if category else "Uncategorized",
            'category_color': category.color if category else "#95A5A6",
            'total_amount': float(row.total_amount),
            'transaction_count': row.transaction_count
        })
        total_spending += row.total_amount
    
    # Calculate percentages
    for data in category_data:
        data['percentage'] = (data['total_amount'] / total_spending * 100) if total_spending > 0 else 0
    
    # Sort by amount
    category_data.sort(key=lambda x: x['total_amount'], reverse=True)
    
    return [CategorySpending(**data) for data in category_data]


@router.get("/spending-by-merchant", response_model=List[MerchantSpending])
async def get_spending_by_merchant(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    cardholder_id: Optional[int] = None,
    category_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get top merchants by spending."""
    processor = AnalyticsProcessor(db)
    merchants = await processor.get_top_merchants(
        cardholder_id=cardholder_id,
        category_id=category_id,
        limit=limit
    )
    
    # Get category names
    if category_id:
        cat_result = await db.execute(
            select(SpendingCategory).where(SpendingCategory.id == category_id)
        )
        category = cat_result.scalar_one_or_none()
        category_name = category.name if category else None
    else:
        category_name = None
    
    return [
        MerchantSpending(
            merchant_name=m['merchant_name'],
            total_amount=m['total_amount'],
            transaction_count=m['transaction_count'],
            average_amount=m['average_amount'],
            category_name=category_name
        )
        for m in merchants
    ]


@router.get("/spending-trends", response_model=List[SpendingTrend])
async def get_spending_trends(
    cardholder_id: Optional[int] = None,
    category_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get spending trends over time."""
    processor = AnalyticsProcessor(db)
    trends = await processor.get_spending_trends(
        cardholder_id=cardholder_id,
        category_id=category_id,
        months=months
    )
    
    return [SpendingTrend(**t) for t in trends]


@router.get("/spending-by-cardholder", response_model=List[CardholderSpending])
async def get_spending_by_cardholder(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020),
    statement_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get spending by cardholder calculated from transactions."""
    # Default to current month
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    
    # Build filters
    filters = [
        func.extract('month', Transaction.transaction_date) == month,
        func.extract('year', Transaction.transaction_date) == year
    ]
    
    if statement_id:
        filters.append(CardholderStatement.statement_id == statement_id)
    
    # Get current period data from transactions
    result = await db.execute(
        select(
            CardholderStatement.cardholder_id,
            Cardholder.full_name,
            func.count(Transaction.id).label('transaction_count'),
            func.sum(Transaction.amount).label('total_amount')
        )
        .select_from(Transaction)
        .join(CardholderStatement)
        .join(Cardholder)
        .where(and_(*filters))
        .group_by(CardholderStatement.cardholder_id, Cardholder.full_name)
        .order_by(func.sum(Transaction.amount).desc())
    )
    current_data = result.all()
    
    # Get previous period data for trend calculation
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    prev_filters = [
        func.extract('month', Transaction.transaction_date) == prev_month,
        func.extract('year', Transaction.transaction_date) == prev_year
    ]
    
    if statement_id:
        # Skip statement filter for previous period
        pass
    
    prev_result = await db.execute(
        select(
            CardholderStatement.cardholder_id,
            func.sum(Transaction.amount).label('total_amount')
        )
        .select_from(Transaction)
        .join(CardholderStatement)
        .where(and_(*prev_filters))
        .group_by(CardholderStatement.cardholder_id)
    )
    prev_data = {row.cardholder_id: float(row.total_amount or 0) for row in prev_result.all()}
    
    # Get top category for each cardholder
    cat_result = await db.execute(
        select(
            CardholderStatement.cardholder_id,
            SpendingCategory.name,
            func.sum(Transaction.amount).label('amount')
        )
        .select_from(Transaction)
        .join(CardholderStatement)
        .outerjoin(SpendingCategory, Transaction.category_id == SpendingCategory.id)
        .where(and_(*filters))
        .group_by(CardholderStatement.cardholder_id, SpendingCategory.name)
        .order_by(
            CardholderStatement.cardholder_id,
            func.sum(Transaction.amount).desc()
        )
    )
    
    # Get top category per cardholder
    top_categories = {}
    for row in cat_result.all():
        if row.cardholder_id not in top_categories:
            top_categories[row.cardholder_id] = row.name or "Uncategorized"
    
    # Build response
    cardholder_spending = []
    for row in current_data:
        total_amount = float(row.total_amount or 0)
        prev_amount = prev_data.get(row.cardholder_id, 0)
        
        # Calculate trend
        trend = 'stable'
        if prev_amount > 0:
            change = ((total_amount - prev_amount) / prev_amount) * 100
            if change > 10:
                trend = 'up'
            elif change < -10:
                trend = 'down'
        elif total_amount > 0:
            trend = 'up'
        
        cardholder_spending.append(CardholderSpending(
            cardholder_id=row.cardholder_id,
            cardholder_name=row.full_name,
            total_amount=total_amount,
            transaction_count=int(row.transaction_count or 0),
            top_category=top_categories.get(row.cardholder_id, "Uncategorized"),
            trend=trend
        ))
    
    return cardholder_spending


@router.get("/alerts", response_model=List[SpendingAlertSchema])
async def get_spending_alerts(
    cardholder_id: Optional[int] = None,
    is_resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get spending alerts."""
    filters = []
    if cardholder_id:
        filters.append(SpendingAlert.cardholder_id == cardholder_id)
    if is_resolved is not None:
        filters.append(SpendingAlert.is_resolved == is_resolved)
    if severity:
        filters.append(SpendingAlert.severity == severity)
    
    result = await db.execute(
        select(SpendingAlert)
        .where(and_(*filters) if filters else True)
        .order_by(SpendingAlert.created_at.desc())
        .limit(limit)
    )
    
    return result.scalars().all()


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Mark an alert as resolved."""
    result = await db.execute(
        select(SpendingAlert).where(SpendingAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(404, "Alert not found")
    
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by_id = current_user.id
    
    await db.commit()
    
    return {"message": "Alert resolved successfully"}


@router.get("/budgets", response_model=List[BudgetLimitSchema])
async def get_budget_limits(
    cardholder_id: Optional[int] = None,
    category_id: Optional[int] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get budget limits."""
    filters = [BudgetLimit.is_active == is_active]
    if cardholder_id:
        filters.append(BudgetLimit.cardholder_id == cardholder_id)
    if category_id:
        filters.append(BudgetLimit.category_id == category_id)
    
    result = await db.execute(
        select(BudgetLimit).where(and_(*filters))
    )
    
    return result.scalars().all()


@router.post("/budgets", response_model=BudgetLimitSchema)
async def create_budget_limit(
    budget: BudgetLimitCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Create a new budget limit."""
    db_budget = BudgetLimit(**budget.dict())
    db.add(db_budget)
    await db.commit()
    await db.refresh(db_budget)
    
    return db_budget


@router.put("/budgets/{budget_id}", response_model=BudgetLimitSchema)
async def update_budget_limit(
    budget_id: int,
    budget: BudgetLimitCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Update a budget limit."""
    result = await db.execute(
        select(BudgetLimit).where(BudgetLimit.id == budget_id)
    )
    db_budget = result.scalar_one_or_none()
    
    if not db_budget:
        raise HTTPException(404, "Budget limit not found")
    
    for key, value in budget.dict().items():
        setattr(db_budget, key, value)
    
    await db.commit()
    await db.refresh(db_budget)
    
    return db_budget


@router.delete("/budgets/{budget_id}")
async def delete_budget_limit(
    budget_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Delete (deactivate) a budget limit."""
    result = await db.execute(
        select(BudgetLimit).where(BudgetLimit.id == budget_id)
    )
    db_budget = result.scalar_one_or_none()
    
    if not db_budget:
        raise HTTPException(404, "Budget limit not found")
    
    db_budget.is_active = False
    await db.commit()
    
    return {"message": "Budget limit deactivated successfully"}


@router.get("/categories", response_model=List[SpendingCategorySchema])
async def get_spending_categories(
    is_active: bool = True,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all spending categories."""
    result = await db.execute(
        select(SpendingCategory).where(SpendingCategory.is_active == is_active)
    )
    
    return result.scalars().all()