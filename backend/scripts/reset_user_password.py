#!/usr/bin/env python3
"""Reset a user's password."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import get_password_hash


def reset_password(email: str, new_password: str):
    db = SessionLocal()
    
    try:
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            print(f"User with email {email} not found")
            return False
        
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        
        print(f"Password reset successfully for {email}")
        print(f"Role: {user.role.value}")
        print(f"Name: {user.first_name} {user.last_name}")
        return True
        
    except Exception as e:
        print(f"Error resetting password: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reset_user_password.py <email> [password]")
        print("If password is not provided, it will be set to 'password123'")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else "password123"
    
    reset_password(email, password)