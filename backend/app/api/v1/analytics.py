from typing import List, Optional, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.models import (
    User, Transaction, SpendingCategory, SpendingAnalytics,
    SpendingAlert, BudgetLimit, MerchantMapping, CardholderStatement
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
    cardholder_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get analytics dashboard data."""
    # Default to current month if not specified
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    
    # Build filters
    filters = [
        SpendingAnalytics.period_month == month,
        SpendingAnalytics.period_year == year
    ]
    if cardholder_id:
        filters.append(SpendingAnalytics.cardholder_id == cardholder_id)
    
    # Get current period analytics
    result = await db.execute(
        select(SpendingAnalytics)
        .where(and_(*filters))
        .options(
            selectinload(SpendingAnalytics.category),
            selectinload(SpendingAnalytics.cardholder)
        )
    )
    current_analytics = result.scalars().all()
    
    # Calculate totals
    total_spending = sum(a.total_amount for a in current_analytics)
    total_transactions = sum(a.transaction_count for a in current_analytics)
    average_transaction = total_spending / total_transactions if total_transactions > 0 else 0
    
    # Get category breakdown
    category_spending = {}
    for analytics in current_analytics:
        cat_name = analytics.category.name if analytics.category else "Uncategorized"
        cat_color = analytics.category.color if analytics.category else "#95A5A6"
        cat_id = analytics.category_id or 0
        
        if cat_id not in category_spending:
            category_spending[cat_id] = {
                'category_id': cat_id,
                'category_name': cat_name,
                'category_color': cat_color,
                'total_amount': 0,
                'transaction_count': 0
            }
        
        category_spending[cat_id]['total_amount'] += analytics.total_amount
        category_spending[cat_id]['transaction_count'] += analytics.transaction_count
    
    # Calculate percentages and sort
    top_categories = []
    for cat_data in category_spending.values():
        cat_data['percentage'] = (cat_data['total_amount'] / total_spending * 100) if total_spending > 0 else 0
        top_categories.append(CategorySpending(**cat_data))
    
    top_categories.sort(key=lambda x: x.total_amount, reverse=True)
    
    # Get top merchants from all analytics
    all_merchants = {}
    for analytics in current_analytics:
        if analytics.top_merchants:
            for merchant_data in analytics.top_merchants:
                merchant = merchant_data['merchant']
                if merchant not in all_merchants:
                    all_merchants[merchant] = {
                        'amount': 0,
                        'count': 0,
                        'category': analytics.category.name if analytics.category else "Uncategorized"
                    }
                all_merchants[merchant]['amount'] += merchant_data['amount']
                all_merchants[merchant]['count'] += merchant_data['count']
    
    top_merchants = []
    for merchant, data in sorted(all_merchants.items(), key=lambda x: x[1]['amount'], reverse=True)[:10]:
        top_merchants.append(MerchantSpending(
            merchant_name=merchant,
            total_amount=data['amount'],
            transaction_count=data['count'],
            average_amount=data['amount'] / data['count'] if data['count'] > 0 else 0,
            category_name=data['category']
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
    
    # Calculate period comparison (current vs previous month)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    prev_result = await db.execute(
        select(
            func.sum(SpendingAnalytics.total_amount).label('total'),
            func.sum(SpendingAnalytics.transaction_count).label('count')
        )
        .where(
            and_(
                SpendingAnalytics.period_month == prev_month,
                SpendingAnalytics.period_year == prev_year,
                SpendingAnalytics.cardholder_id == cardholder_id if cardholder_id else True
            )
        )
    )
    prev_data = prev_result.one()
    
    period_comparison = {
        'current_total': total_spending,
        'previous_total': prev_data.total or 0,
        'change_amount': total_spending - (prev_data.total or 0),
        'change_percent': ((total_spending / prev_data.total - 1) * 100) if prev_data.total else 0
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
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get spending by cardholder."""
    # Default to current month
    if not month or not year:
        now = datetime.now()
        month = month or now.month
        year = year or now.year
    
    # Get current period data
    result = await db.execute(
        select(
            SpendingAnalytics.cardholder_id,
            func.sum(SpendingAnalytics.total_amount).label('total_amount'),
            func.sum(SpendingAnalytics.transaction_count).label('transaction_count')
        )
        .where(
            and_(
                SpendingAnalytics.period_month == month,
                SpendingAnalytics.period_year == year
            )
        )
        .group_by(SpendingAnalytics.cardholder_id)
    )
    
    # Get previous period data for trend
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    prev_result = await db.execute(
        select(
            SpendingAnalytics.cardholder_id,
            func.sum(SpendingAnalytics.total_amount).label('total_amount')
        )
        .where(
            and_(
                SpendingAnalytics.period_month == prev_month,
                SpendingAnalytics.period_year == prev_year
            )
        )
        .group_by(SpendingAnalytics.cardholder_id)
    )
    prev_data = {row.cardholder_id: row.total_amount for row in prev_result}
    
    # Get cardholders
    from app.db.models import Cardholder
    ch_result = await db.execute(select(Cardholder))
    cardholders = {c.id: c for c in ch_result.scalars().all()}
    
    # Get top categories per cardholder
    cat_result = await db.execute(
        select(
            SpendingAnalytics.cardholder_id,
            SpendingAnalytics.category_id,
            func.sum(SpendingAnalytics.total_amount).label('amount')
        )
        .where(
            and_(
                SpendingAnalytics.period_month == month,
                SpendingAnalytics.period_year == year
            )
        )
        .group_by(SpendingAnalytics.cardholder_id, SpendingAnalytics.category_id)
        .order_by(SpendingAnalytics.cardholder_id, func.sum(SpendingAnalytics.total_amount).desc())
    )
    
    # Get categories
    cat_names_result = await db.execute(select(SpendingCategory))
    categories = {c.id: c.name for c in cat_names_result.scalars().all()}
    
    # Group top categories by cardholder
    top_categories = {}
    for row in cat_result:
        if row.cardholder_id not in top_categories:
            cat_name = categories.get(row.category_id, "Uncategorized") if row.category_id else "Uncategorized"
            top_categories[row.cardholder_id] = cat_name
    
    # Build response
    cardholder_spending = []
    for row in result:
        cardholder = cardholders.get(row.cardholder_id)
        if not cardholder:
            continue
        
        # Calculate trend
        prev_amount = prev_data.get(row.cardholder_id, 0)
        if prev_amount > 0:
            change = (row.total_amount - prev_amount) / prev_amount
            trend = "up" if change > 0.05 else "down" if change < -0.05 else "stable"
        else:
            trend = "up" if row.total_amount > 0 else "stable"
        
        cardholder_spending.append(CardholderSpending(
            cardholder_id=row.cardholder_id,
            cardholder_name=cardholder.full_name,
            total_amount=float(row.total_amount),
            transaction_count=row.transaction_count,
            top_category=top_categories.get(row.cardholder_id),
            trend=trend
        ))
    
    # Sort by total amount
    cardholder_spending.sort(key=lambda x: x.total_amount, reverse=True)
    
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