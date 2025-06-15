#!/usr/bin/env python3
"""Initialize spending categories if they don't exist."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import SpendingCategory


def init_categories():
    db = SessionLocal()
    
    try:
        categories = [
            {"name": "Travel", "color": "#3498DB", "icon": "flight"},
            {"name": "Meals & Entertainment", "color": "#E74C3C", "icon": "restaurant"},
            {"name": "Office Supplies", "color": "#F39C12", "icon": "business_center"},
            {"name": "Technology", "color": "#9B59B6", "icon": "computer"},
            {"name": "Transportation", "color": "#1ABC9C", "icon": "directions_car"},
            {"name": "Professional Services", "color": "#34495E", "icon": "work"},
            {"name": "Utilities", "color": "#7F8C8D", "icon": "power"},
            {"name": "Marketing", "color": "#E67E22", "icon": "campaign"},
            {"name": "Other", "color": "#95A5A6", "icon": "category"}
        ]
        
        for cat_data in categories:
            # Check if category exists
            existing = db.query(SpendingCategory).filter(
                SpendingCategory.name == cat_data["name"]
            ).first()
            
            if not existing:
                category = SpendingCategory(**cat_data)
                db.add(category)
                print(f"Created category: {cat_data['name']}")
            else:
                print(f"Category already exists: {cat_data['name']}")
        
        db.commit()
        print("\nCategories initialized successfully!")
        
        # Display all categories
        all_categories = db.query(SpendingCategory).filter(SpendingCategory.is_active == True).all()
        print(f"\nTotal active categories: {len(all_categories)}")
        for cat in all_categories:
            print(f"  - {cat.name} (id={cat.id})")
        
    except Exception as e:
        print(f"Error initializing categories: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_categories()