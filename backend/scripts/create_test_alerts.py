#!/usr/bin/env python3
"""Create some test alerts to demonstrate the alert functionality."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import SpendingAlert, SpendingCategory, Cardholder


def create_test_alerts():
    db = SessionLocal()
    
    try:
        # Get some data
        categories = db.query(SpendingCategory).all()
        cardholders = db.query(Cardholder).limit(3).all()
        
        # Create various types of alerts
        alerts_to_create = []
        
        # Budget exceeded alert
        if cardholders and categories:
            alerts_to_create.append(SpendingAlert(
                alert_type="budget_exceeded",
                severity="critical",
                cardholder_id=cardholders[0].id,
                category_id=categories[0].id,  # Travel
                amount=5500.0,
                threshold=5000.0,
                description=f"Travel budget exceeded by $500.00 for {cardholders[0].full_name}"
            ))
        
        # Budget warning
        if len(cardholders) > 1 and len(categories) > 1:
            alerts_to_create.append(SpendingAlert(
                alert_type="budget_warning",
                severity="warning",
                cardholder_id=cardholders[1].id,
                category_id=categories[1].id,  # Meals
                amount=2400.0,
                threshold=2400.0,
                description=f"Meals & Entertainment spending at 80% of budget for {cardholders[1].full_name}"
            ))
        
        # Unusual spending pattern
        if cardholders:
            alerts_to_create.append(SpendingAlert(
                alert_type="unusual_spending",
                severity="warning",
                cardholder_id=cardholders[0].id,
                amount=3500.0,
                threshold=2000.0,
                description=f"Total spending is 75% higher than average for {cardholders[0].full_name}"
            ))
        
        # Add all alerts
        for alert in alerts_to_create:
            db.add(alert)
            print(f"Created alert: {alert.alert_type} - {alert.description}")
        
        db.commit()
        print("\nTest alerts created successfully!")
        
        # Display all alerts
        all_alerts = db.query(SpendingAlert).filter(SpendingAlert.is_resolved == False).all()
        print(f"\nTotal unresolved alerts: {len(all_alerts)}")
        
    except Exception as e:
        print(f"Error creating test alerts: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_test_alerts()