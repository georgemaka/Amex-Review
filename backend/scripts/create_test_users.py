#!/usr/bin/env python3
"""Create test users with different roles."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User, UserRole
from app.core.security import get_password_hash


def create_test_users():
    db = SessionLocal()
    
    try:
        test_users = [
            {
                "email": "coder1@example.com",
                "first_name": "John",
                "last_name": "Coder",
                "role": UserRole.CODER,
                "password": "password123"
            },
            {
                "email": "coder2@example.com",
                "first_name": "Jane",
                "last_name": "Developer",
                "role": UserRole.CODER,
                "password": "password123"
            },
            {
                "email": "reviewer1@example.com",
                "first_name": "Bob",
                "last_name": "Reviewer",
                "role": UserRole.REVIEWER,
                "password": "password123"
            },
            {
                "email": "reviewer2@example.com",
                "first_name": "Alice",
                "last_name": "Approver",
                "role": UserRole.REVIEWER,
                "password": "password123"
            }
        ]
        
        created_count = 0
        
        for user_data in test_users:
            # Check if user already exists
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            
            if not existing:
                user = User(
                    email=user_data["email"],
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    role=user_data["role"],
                    hashed_password=get_password_hash(user_data["password"]),
                    is_active=True,
                    is_superuser=False
                )
                db.add(user)
                created_count += 1
                print(f"Created user: {user_data['email']} ({user_data['role'].value})")
            else:
                print(f"User already exists: {user_data['email']}")
        
        db.commit()
        print(f"\nCreated {created_count} new users")
        
        # Show all users summary
        all_users = db.query(User).all()
        print(f"\nTotal users in system: {len(all_users)}")
        
        role_counts = {}
        for user in all_users:
            role = user.role.value
            role_counts[role] = role_counts.get(role, 0) + 1
        
        print("\nUsers by role:")
        for role, count in role_counts.items():
            print(f"  - {role}: {count}")
        
    except Exception as e:
        print(f"Error creating test users: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_test_users()