import re
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Transaction, SpendingCategory, MerchantMapping, SpendingAnalytics,
    SpendingAlert, BudgetLimit, CardholderStatement, Cardholder
)
from app.core.alert_config import (
    LARGE_TRANSACTION_THRESHOLD,
    WEEKEND_TRANSACTION_ENABLED,
    UNUSUAL_SPENDING_INCREASE_PERCENT,
    DUPLICATE_DETECTION_ENABLED,
    ALERT_TYPES
)

logger = logging.getLogger(__name__)


class AnalyticsProcessor:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._category_cache = {}
        self._mapping_cache = {}
        
    async def _load_categories(self):
        """Load categories into cache."""
        if not self._category_cache:
            result = await self.db.execute(
                select(SpendingCategory).where(SpendingCategory.is_active == True)
            )
            categories = result.scalars().all()
            self._category_cache = {cat.id: cat for cat in categories}
            
    async def _load_mappings(self):
        """Load merchant mappings into cache."""
        if not self._mapping_cache:
            result = await self.db.execute(
                select(MerchantMapping).options(selectinload(MerchantMapping.category))
            )
            mappings = result.scalars().all()
            self._mapping_cache = mappings
    
    async def categorize_transaction(self, transaction: Transaction) -> Optional[int]:
        """
        Categorize a transaction based on merchant name and description.
        Returns category_id if found, None otherwise.
        """
        await self._load_mappings()
        
        # Combine merchant name and description for matching
        search_text = f"{transaction.merchant_name or ''} {transaction.description}".upper()
        
        best_match = None
        best_confidence = 0.0
        
        for mapping in self._mapping_cache:
            pattern = mapping.merchant_pattern.upper()
            match_found = False
            
            if mapping.is_regex:
                # Use regex matching
                try:
                    if re.search(pattern, search_text):
                        match_found = True
                except re.error:
                    logger.error(f"Invalid regex pattern: {pattern}")
            else:
                # Simple substring matching
                if pattern in search_text:
                    match_found = True
            
            if match_found and mapping.confidence > best_confidence:
                best_match = mapping
                best_confidence = mapping.confidence
        
        if best_match:
            return best_match.category_id
        
        # Default to "Other" category if no match
        await self._load_categories()
        for cat_id, category in self._category_cache.items():
            if category.name == "Other":
                return cat_id
        
        return None
    
    async def categorize_transactions_bulk(self, transactions: List[Transaction]):
        """Categorize multiple transactions at once."""
        for transaction in transactions:
            if not transaction.category_id:
                category_id = await self.categorize_transaction(transaction)
                if category_id:
                    transaction.category_id = category_id
        
        await self.db.commit()
    
    async def calculate_analytics(self, statement_id: int):
        """Calculate and store analytics for a statement."""
        # Get all transactions for the statement
        result = await self.db.execute(
            select(Transaction)
            .join(CardholderStatement)
            .where(CardholderStatement.statement_id == statement_id)
            .options(selectinload(Transaction.cardholder_statement))
        )
        transactions = result.scalars().all()
        
        if not transactions:
            return
        
        # Get statement month/year from first transaction
        first_trans = transactions[0]
        month = first_trans.transaction_date.month
        year = first_trans.transaction_date.year
        
        # Group transactions by cardholder and category
        analytics_data = defaultdict(lambda: {
            'transactions': [],
            'merchants': set(),
            'daily_amounts': defaultdict(float)
        })
        
        for trans in transactions:
            cardholder_id = trans.cardholder_statement.cardholder_id
            category_id = trans.category_id or 0  # 0 for uncategorized
            
            key = (cardholder_id, category_id)
            analytics_data[key]['transactions'].append(trans)
            analytics_data[key]['merchants'].add(trans.merchant_name)
            
            # Track daily spending
            day = trans.transaction_date.day
            analytics_data[key]['daily_amounts'][day] += trans.amount
        
        # Create analytics records
        for (cardholder_id, category_id), data in analytics_data.items():
            transactions_list = data['transactions']
            amounts = [t.amount for t in transactions_list]
            
            # Calculate top merchants
            merchant_spending = defaultdict(lambda: {'amount': 0, 'count': 0})
            for trans in transactions_list:
                merchant_spending[trans.merchant_name]['amount'] += trans.amount
                merchant_spending[trans.merchant_name]['count'] += 1
            
            top_merchants = sorted(
                [{'merchant': m, **v} for m, v in merchant_spending.items()],
                key=lambda x: x['amount'],
                reverse=True
            )[:5]
            
            # Create analytics record
            analytics = SpendingAnalytics(
                statement_id=statement_id,
                cardholder_id=cardholder_id,
                category_id=category_id if category_id > 0 else None,
                period_month=month,
                period_year=year,
                total_amount=sum(amounts),
                transaction_count=len(transactions_list),
                average_transaction=sum(amounts) / len(amounts),
                max_transaction=max(amounts),
                min_transaction=min(amounts),
                merchant_count=len(data['merchants']),
                top_merchants=top_merchants,
                daily_breakdown=dict(data['daily_amounts'])
            )
            self.db.add(analytics)
        
        await self.db.commit()
    
    async def detect_anomalies(self, statement_id: int):
        """Detect spending anomalies and create alerts."""
        # Get current period analytics
        result = await self.db.execute(
            select(SpendingAnalytics)
            .where(SpendingAnalytics.statement_id == statement_id)
            .options(
                selectinload(SpendingAnalytics.cardholder),
                selectinload(SpendingAnalytics.category)
            )
        )
        current_analytics = result.scalars().all()
        
        alerts = []
        
        for analytics in current_analytics:
            # Get historical average for comparison
            hist_result = await self.db.execute(
                select(func.avg(SpendingAnalytics.total_amount))
                .where(
                    and_(
                        SpendingAnalytics.cardholder_id == analytics.cardholder_id,
                        SpendingAnalytics.category_id == analytics.category_id,
                        SpendingAnalytics.statement_id != statement_id,
                        SpendingAnalytics.period_year >= analytics.period_year - 1
                    )
                )
            )
            historical_avg = hist_result.scalar() or analytics.total_amount
            
            # Check for unusual spending
            threshold_multiplier = 1 + (UNUSUAL_SPENDING_INCREASE_PERCENT / 100)
            if analytics.total_amount > historical_avg * threshold_multiplier:
                alert = SpendingAlert(
                    alert_type="unusual_spending",
                    severity="warning",
                    cardholder_id=analytics.cardholder_id,
                    category_id=analytics.category_id,
                    amount=analytics.total_amount,
                    threshold=historical_avg * 1.5,
                    description=f"Spending in {analytics.category.name if analytics.category else 'Uncategorized'} "
                               f"is {(analytics.total_amount / historical_avg - 1) * 100:.0f}% higher than average"
                )
                alerts.append(alert)
                self.db.add(alert)
            
            # Check budget limits
            budget_result = await self.db.execute(
                select(BudgetLimit)
                .where(
                    and_(
                        BudgetLimit.is_active == True,
                        or_(
                            and_(
                                BudgetLimit.cardholder_id == analytics.cardholder_id,
                                BudgetLimit.category_id == analytics.category_id
                            ),
                            and_(
                                BudgetLimit.cardholder_id == analytics.cardholder_id,
                                BudgetLimit.category_id.is_(None)
                            ),
                            and_(
                                BudgetLimit.cardholder_id.is_(None),
                                BudgetLimit.category_id == analytics.category_id
                            )
                        )
                    )
                )
            )
            budgets = budget_result.scalars().all()
            
            for budget in budgets:
                if analytics.total_amount > budget.limit_amount:
                    alert = SpendingAlert(
                        alert_type="budget_exceeded",
                        severity="critical",
                        cardholder_id=analytics.cardholder_id,
                        category_id=analytics.category_id,
                        amount=analytics.total_amount,
                        threshold=budget.limit_amount,
                        description=f"Budget limit exceeded by ${analytics.total_amount - budget.limit_amount:.2f}"
                    )
                    alerts.append(alert)
                    self.db.add(alert)
                elif analytics.total_amount > budget.limit_amount * budget.alert_threshold:
                    alert = SpendingAlert(
                        alert_type="budget_warning",
                        severity="info",
                        cardholder_id=analytics.cardholder_id,
                        category_id=analytics.category_id,
                        amount=analytics.total_amount,
                        threshold=budget.limit_amount * budget.alert_threshold,
                        description=f"Spending at {(analytics.total_amount / budget.limit_amount * 100):.0f}% of budget"
                    )
                    alerts.append(alert)
                    self.db.add(alert)
        
        await self.db.commit()
        return alerts
    
    async def generate_transaction_alerts(self, statement_id: int):
        """Generate alerts for individual transactions based on patterns."""
        # Get all transactions for the statement
        result = await self.db.execute(
            select(Transaction)
            .join(CardholderStatement)
            .where(CardholderStatement.statement_id == statement_id)
            .options(
                selectinload(Transaction.cardholder_statement).selectinload(CardholderStatement.cardholder),
                selectinload(Transaction.category)
            )
        )
        transactions = result.scalars().all()
        
        alerts = []
        
        for transaction in transactions:
            # Check for large transactions
            if ALERT_TYPES['large_transaction']['enabled'] and transaction.amount > LARGE_TRANSACTION_THRESHOLD:
                alert = SpendingAlert(
                    alert_type="large_transaction",
                    severity=ALERT_TYPES['large_transaction']['severity'],
                    cardholder_id=transaction.cardholder_statement.cardholder_id,
                    category_id=transaction.category_id,
                    transaction_id=transaction.id,
                    amount=transaction.amount,
                    threshold=LARGE_TRANSACTION_THRESHOLD,
                    description=f"Large transaction of ${transaction.amount:.2f} at {transaction.merchant_name}"
                )
                alerts.append(alert)
                self.db.add(alert)
            
            # Check for weekend transactions
            if WEEKEND_TRANSACTION_ENABLED and transaction.transaction_date.weekday() >= 5:  # Saturday or Sunday
                alert = SpendingAlert(
                    alert_type="weekend_transaction",
                    severity="info",
                    cardholder_id=transaction.cardholder_statement.cardholder_id,
                    category_id=transaction.category_id,
                    transaction_id=transaction.id,
                    amount=transaction.amount,
                    description=f"Weekend transaction on {transaction.transaction_date.strftime('%A')}"
                )
                alerts.append(alert)
                self.db.add(alert)
            
            # Check for duplicate transactions (same amount and merchant on same day)
            duplicate_result = await self.db.execute(
                select(Transaction)
                .join(CardholderStatement)
                .where(
                    and_(
                        CardholderStatement.cardholder_id == transaction.cardholder_statement.cardholder_id,
                        Transaction.id != transaction.id,
                        Transaction.merchant_name == transaction.merchant_name,
                        Transaction.amount == transaction.amount,
                        func.date(Transaction.transaction_date) == transaction.transaction_date.date()
                    )
                )
            )
            duplicates = duplicate_result.scalars().all()
            
            if duplicates:
                alert = SpendingAlert(
                    alert_type="potential_duplicate",
                    severity="warning",
                    cardholder_id=transaction.cardholder_statement.cardholder_id,
                    category_id=transaction.category_id,
                    transaction_id=transaction.id,
                    amount=transaction.amount,
                    description=f"Potential duplicate transaction: ${transaction.amount:.2f} at {transaction.merchant_name}"
                )
                alerts.append(alert)
                self.db.add(alert)
        
        await self.db.commit()
        return alerts
    
    async def get_spending_trends(
        self,
        cardholder_id: Optional[int] = None,
        category_id: Optional[int] = None,
        months: int = 12
    ) -> List[Dict]:
        """Get spending trends over time."""
        # Build query filters
        filters = []
        if cardholder_id:
            filters.append(SpendingAnalytics.cardholder_id == cardholder_id)
        if category_id:
            filters.append(SpendingAnalytics.category_id == category_id)
        
        # Add date filter
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        # Get analytics data
        result = await self.db.execute(
            select(
                SpendingAnalytics.period_year,
                SpendingAnalytics.period_month,
                func.sum(SpendingAnalytics.total_amount).label('total'),
                func.sum(SpendingAnalytics.transaction_count).label('count')
            )
            .where(and_(*filters) if filters else True)
            .group_by(SpendingAnalytics.period_year, SpendingAnalytics.period_month)
            .order_by(SpendingAnalytics.period_year, SpendingAnalytics.period_month)
        )
        
        trends = []
        for row in result:
            trends.append({
                'date': datetime(row.period_year, row.period_month, 1),
                'amount': float(row.total),
                'transaction_count': row.count
            })
        
        return trends
    
    async def get_top_merchants(
        self,
        cardholder_id: Optional[int] = None,
        category_id: Optional[int] = None,
        limit: int = 10
    ) -> List[Dict]:
        """Get top merchants by spending."""
        # Build query filters
        filters = []
        if cardholder_id:
            filters.append(Transaction.cardholder_statement.has(cardholder_id=cardholder_id))
        if category_id:
            filters.append(Transaction.category_id == category_id)
        
        # Get merchant spending
        result = await self.db.execute(
            select(
                Transaction.merchant_name,
                func.sum(Transaction.amount).label('total_amount'),
                func.count(Transaction.id).label('transaction_count'),
                func.avg(Transaction.amount).label('avg_amount')
            )
            .where(and_(*filters) if filters else True)
            .group_by(Transaction.merchant_name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(limit)
        )
        
        merchants = []
        for row in result:
            merchants.append({
                'merchant_name': row.merchant_name,
                'total_amount': float(row.total_amount),
                'transaction_count': row.transaction_count,
                'average_amount': float(row.avg_amount)
            })
        
        return merchants
    
    async def process_statement_analytics(self, statement_id: int):
        """Main method to process all analytics for a statement."""
        try:
            logger.info(f"Processing analytics for statement {statement_id}")
            
            # Get all transactions for categorization
            result = await self.db.execute(
                select(Transaction)
                .join(CardholderStatement)
                .where(CardholderStatement.statement_id == statement_id)
            )
            transactions = result.scalars().all()
            
            # Categorize transactions
            logger.info(f"Categorizing {len(transactions)} transactions")
            await self.categorize_transactions_bulk(transactions)
            
            # Calculate analytics
            logger.info("Calculating spending analytics")
            await self.calculate_analytics(statement_id)
            
            # Detect anomalies
            logger.info("Detecting spending anomalies")
            alerts = await self.detect_anomalies(statement_id)
            logger.info(f"Created {len(alerts)} alerts")
            
            # Generate alerts for transactions
            logger.info("Generating transaction-based alerts")
            transaction_alerts = await self.generate_transaction_alerts(statement_id)
            logger.info(f"Created {len(transaction_alerts)} transaction alerts")
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing analytics for statement {statement_id}: {str(e)}")
            raise


# Sync version for use in Celery tasks
def process_statement_analytics_sync(db, statement_id: int):
    """
    Synchronous wrapper for analytics processing in Celery tasks.
    This avoids asyncio event loop issues in Celery workers.
    """
    from sqlalchemy.orm import Session
    
    try:
        logger.info(f"Processing analytics for statement {statement_id} (sync)")
        
        # Get all transactions for the statement
        transactions = db.query(Transaction)\
            .join(CardholderStatement)\
            .filter(CardholderStatement.statement_id == statement_id)\
            .all()
        
        logger.info(f"Found {len(transactions)} transactions to process")
        
        # Load categories and mappings
        categories = db.query(SpendingCategory).filter(SpendingCategory.is_active == True).all()
        category_dict = {cat.id: cat for cat in categories}
        
        mappings = db.query(MerchantMapping).all()
        
        # Categorize transactions
        categorized_count = 0
        for transaction in transactions:
            if transaction.category_id:
                continue  # Already categorized
                
            search_text = f"{transaction.merchant_name or ''} {transaction.description}".upper()
            
            # Find best matching merchant mapping
            best_match = None
            best_confidence = 0.0
            
            for mapping in mappings:
                pattern = mapping.merchant_pattern.upper()
                if pattern in search_text:
                    if mapping.confidence > best_confidence:
                        best_match = mapping
                        best_confidence = mapping.confidence
            
            if best_match and best_confidence >= 0.7:
                transaction.category_id = best_match.category_id
                categorized_count += 1
        
        db.commit()
        logger.info(f"Categorized {categorized_count} transactions")
        
        # Calculate analytics
        # Get statement details
        stmt = db.query(CardholderStatement).filter(
            CardholderStatement.statement_id == statement_id
        ).first()
        
        if not stmt:
            logger.error(f"No cardholder statements found for statement {statement_id}")
            return
        
        month = stmt.statement.month
        year = stmt.statement.year
        
        # Delete existing analytics for this period
        db.query(SpendingAnalytics).filter(
            SpendingAnalytics.period_month == month,
            SpendingAnalytics.period_year == year
        ).delete()
        
        # Calculate spending by category
        category_spending = db.query(
            Transaction.category_id,
            func.sum(Transaction.amount).label('total_amount'),
            func.count(Transaction.id).label('transaction_count')
        ).join(CardholderStatement)\
        .filter(CardholderStatement.statement_id == statement_id)\
        .group_by(Transaction.category_id)\
        .all()
        
        # Calculate spending by cardholder
        cardholder_spending = db.query(
            CardholderStatement.cardholder_id,
            func.sum(Transaction.amount).label('total_amount'),
            func.count(Transaction.id).label('transaction_count')
        ).join(Transaction)\
        .filter(CardholderStatement.statement_id == statement_id)\
        .group_by(CardholderStatement.cardholder_id)\
        .all()
        
        # Create analytics records
        for category_id, amount, count in category_spending:
            if category_id:  # Skip uncategorized
                analytics = SpendingAnalytics(
                    period_month=month,
                    period_year=year,
                    category_id=category_id,
                    total_amount=float(amount),
                    transaction_count=count,
                    average_transaction=float(amount) / count if count > 0 else 0
                )
                db.add(analytics)
        
        # Create cardholder analytics
        for cardholder_id, amount, count in cardholder_spending:
            analytics = SpendingAnalytics(
                period_month=month,
                period_year=year,
                cardholder_id=cardholder_id,
                total_amount=float(amount),
                transaction_count=count,
                average_transaction=float(amount) / count if count > 0 else 0
            )
            db.add(analytics)
        
        db.commit()
        logger.info(f"Analytics calculation completed for statement {statement_id}")
        
        # Generate alerts for transactions
        logger.info("Generating transaction-based alerts")
        alert_count = 0
        
        # Get all transactions for alert generation
        transactions = db.query(Transaction)\
            .join(CardholderStatement)\
            .filter(CardholderStatement.statement_id == statement_id)\
            .all()
        
        for transaction in transactions:
            # Check for large transactions
            if ALERT_TYPES['large_transaction']['enabled'] and transaction.amount > LARGE_TRANSACTION_THRESHOLD:
                alert = SpendingAlert(
                    alert_type="large_transaction",
                    severity=ALERT_TYPES['large_transaction']['severity'],
                    cardholder_id=transaction.cardholder_statement.cardholder_id,
                    category_id=transaction.category_id,
                    transaction_id=transaction.id,
                    amount=transaction.amount,
                    threshold=LARGE_TRANSACTION_THRESHOLD,
                    description=f"Large transaction of ${transaction.amount:.2f} at {transaction.merchant_name}"
                )
                db.add(alert)
                alert_count += 1
            
            # Check for weekend transactions
            if WEEKEND_TRANSACTION_ENABLED and transaction.transaction_date.weekday() >= 5:  # Saturday or Sunday
                alert = SpendingAlert(
                    alert_type="weekend_transaction",
                    severity="info",
                    cardholder_id=transaction.cardholder_statement.cardholder_id,
                    category_id=transaction.category_id,
                    transaction_id=transaction.id,
                    amount=transaction.amount,
                    description=f"Weekend transaction on {transaction.transaction_date.strftime('%A')}"
                )
                db.add(alert)
                alert_count += 1
        
        # Check budget limits
        budget_limits = db.query(BudgetLimit).filter(BudgetLimit.is_active == True).all()
        
        for budget in budget_limits:
            # Calculate spending for this budget's criteria
            query = db.query(func.sum(Transaction.amount)).join(CardholderStatement)
            
            if budget.cardholder_id:
                query = query.filter(CardholderStatement.cardholder_id == budget.cardholder_id)
            
            if budget.category_id:
                query = query.filter(Transaction.category_id == budget.category_id)
            
            if budget.month and budget.year:
                query = query.filter(
                    func.extract('month', Transaction.transaction_date) == budget.month,
                    func.extract('year', Transaction.transaction_date) == budget.year
                )
            else:
                # Use current statement's month/year
                query = query.filter(
                    func.extract('month', Transaction.transaction_date) == month,
                    func.extract('year', Transaction.transaction_date) == year
                )
            
            total_spending = query.scalar() or 0
            
            if total_spending > budget.limit_amount:
                alert = SpendingAlert(
                    alert_type="budget_exceeded",
                    severity="critical",
                    cardholder_id=budget.cardholder_id,
                    category_id=budget.category_id,
                    amount=total_spending,
                    threshold=budget.limit_amount,
                    description=f"Budget limit exceeded by ${total_spending - budget.limit_amount:.2f}"
                )
                db.add(alert)
                alert_count += 1
            elif total_spending > budget.limit_amount * budget.alert_threshold:
                alert = SpendingAlert(
                    alert_type="budget_warning",
                    severity="warning",
                    cardholder_id=budget.cardholder_id,
                    category_id=budget.category_id,
                    amount=total_spending,
                    threshold=budget.limit_amount * budget.alert_threshold,
                    description=f"Spending at {(total_spending / budget.limit_amount * 100):.0f}% of budget"
                )
                db.add(alert)
                alert_count += 1
        
        db.commit()
        logger.info(f"Generated {alert_count} alerts for statement {statement_id}")
        
    except Exception as e:
        logger.error(f"Error in sync analytics processing: {str(e)}")
        db.rollback()
        raise