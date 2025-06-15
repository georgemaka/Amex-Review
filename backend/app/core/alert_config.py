"""
Alert configuration settings.
Update these values to change alert thresholds across the system.
"""

# Transaction Alert Thresholds
LARGE_TRANSACTION_THRESHOLD = 2000
WEEKEND_TRANSACTION_ENABLED = True

# Spending Pattern Thresholds
UNUSUAL_SPENDING_INCREASE_PERCENT = 50
UNUSUAL_SPENDING_MIN_HISTORY_MONTHS = 3  # Minimum months of history needed for comparison

# Duplicate Detection
DUPLICATE_DETECTION_ENABLED = False
DUPLICATE_TIME_WINDOW_HOURS = 24

# Budget Alert Defaults
DEFAULT_BUDGET_ALERT_THRESHOLD = 0.8  # Default to alert at 80% of budget
BUDGET_CRITICAL_THRESHOLD = 1.0       # Critical alert when budget is exceeded

# Alert Severity Levels
SEVERITY_LEVELS = {
    'info': {
        'color': '#2196F3',
        'priority': 1,
        'auto_resolve_days': 30  # Auto-resolve info alerts after 30 days
    },
    'warning': {
        'color': '#FF9800',
        'priority': 2,
        'auto_resolve_days': None  # Don't auto-resolve
    },
    'critical': {
        'color': '#F44336',
        'priority': 3,
        'auto_resolve_days': None  # Don't auto-resolve
    }
}

# Alert Type Configurations
ALERT_TYPES = {
    'large_transaction': {
        'enabled': True,
        'severity': 'info',
        'description_template': 'Large transaction of ${amount:.2f} at {merchant_name}'
    },
    'weekend_transaction': {
        'enabled': WEEKEND_TRANSACTION_ENABLED,
        'severity': 'info',
        'description_template': 'Weekend transaction on {day_of_week}'
    },
    'potential_duplicate': {
        'enabled': DUPLICATE_DETECTION_ENABLED,
        'severity': 'warning',
        'description_template': 'Potential duplicate transaction: ${amount:.2f} at {merchant_name}'
    },
    'unusual_spending': {
        'enabled': True,
        'severity': 'warning',
        'description_template': 'Spending in {category} is {percent_increase:.0f}% higher than average'
    },
    'budget_warning': {
        'enabled': True,
        'severity': 'warning',
        'description_template': 'Spending at {percent_of_budget:.0f}% of budget'
    },
    'budget_exceeded': {
        'enabled': True,
        'severity': 'critical',
        'description_template': 'Budget limit exceeded by ${amount_over:.2f}'
    }
}