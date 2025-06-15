#!/usr/bin/env python3
"""Create test budget limits for alert generation."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import BudgetLimit, SpendingCategory, Cardholder


def create_test_budgets():
    db = SessionLocal()
    
    try:
        # Get some categories
        categories = db.query(SpendingCategory).filter(SpendingCategory.is_active == True).all()
        
        # Get some cardholders
        cardholders = db.query(Cardholder).filter(Cardholder.is_active == True).limit(3).all()
        
        # Create some budget limits
        budgets_to_create = []
        
        # Overall budget for Travel category
        travel_cat = next((c for c in categories if c.name == "Travel"), None)
        if travel_cat:
            budgets_to_create.append(BudgetLimit(
                category_id=travel_cat.id,
                limit_amount=5000.0,
                alert_threshold=0.8
            ))
        
        # Overall budget for Meals & Entertainment
        meals_cat = next((c for c in categories if c.name == "Meals & Entertainment"), None)
        if meals_cat:
            budgets_to_create.append(BudgetLimit(
                category_id=meals_cat.id,
                limit_amount=3000.0,
                alert_threshold=0.75
            ))
        
        # Individual cardholder budgets
        for i, cardholder in enumerate(cardholders[:2]):
            budgets_to_create.append(BudgetLimit(
                cardholder_id=cardholder.id,
                limit_amount=2000.0 + (i * 500),  # Different limits
                alert_threshold=0.8
            ))
        
        # Cardholder + Category specific budget
        if cardholders and travel_cat:
            budgets_to_create.append(BudgetLimit(
                cardholder_id=cardholders[0].id,
                category_id=travel_cat.id,
                limit_amount=1000.0,
                alert_threshold=0.9
            ))
        
        # Add all budgets
        for budget in budgets_to_create:
            # Check if similar budget already exists
            existing = db.query(BudgetLimit).filter(
                BudgetLimit.cardholder_id == budget.cardholder_id,
                BudgetLimit.category_id == budget.category_id,
                BudgetLimit.is_active == True
            ).first()
            
            if not existing:
                db.add(budget)
                print(f"Created budget: cardholder_id={budget.cardholder_id}, category_id={budget.category_id}, limit=${budget.limit_amount}")
            else:
                print(f"Budget already exists for cardholder_id={budget.cardholder_id}, category_id={budget.category_id}")
        
        db.commit()
        print("\nTest budgets created successfully!")
        
        # Display all active budgets
        all_budgets = db.query(BudgetLimit).filter(BudgetLimit.is_active == True).all()
        print(f"\nTotal active budgets: {len(all_budgets)}")
        
    except Exception as e:
        print(f"Error creating test budgets: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_test_budgets()