#!/usr/bin/env python3
"""Test password verification."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import verify_password, get_password_hash


def test_password_verification(email: str):
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"User with email {email} not found")
            return
        
        print(f"\nUser found: {user.email}")
        print(f"Name: {user.first_name} {user.last_name}")
        print(f"Role: {user.role.value}")
        print(f"Active: {user.is_active}")
        
        # Test password verification
        test_password = "password123"
        result = verify_password(test_password, user.hashed_password)
        print(f"\nPassword verification for 'password123': {result}")
        
        if not result:
            # Try resetting the password
            print("\nResetting password to 'password123'...")
            user.hashed_password = get_password_hash(test_password)
            db.commit()
            
            # Verify again
            result2 = verify_password(test_password, user.hashed_password)
            print(f"Password verification after reset: {result2}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@sukut.com"
    test_password_verification(email)