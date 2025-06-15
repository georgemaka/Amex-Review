#!/usr/bin/env python3
"""Create test assignments for coders and reviewers."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User, UserRole, Cardholder, CardholderAssignment, CardholderReviewer


def create_test_assignments():
    db = SessionLocal()
    
    try:
        # Get coders and reviewers
        coders = db.query(User).filter(User.role == UserRole.CODER, User.is_active == True).all()
        reviewers = db.query(User).filter(User.role == UserRole.REVIEWER, User.is_active == True).all()
        
        # Get cardholders
        cardholders = db.query(Cardholder).filter(Cardholder.is_active == True).all()
        
        if not coders:
            print("No coders found. Please create some coder users first.")
            return
            
        if not reviewers:
            print("No reviewers found. Please create some reviewer users first.")
            return
            
        if not cardholders:
            print("No cardholders found.")
            return
        
        print(f"Found {len(coders)} coders, {len(reviewers)} reviewers, and {len(cardholders)} cardholders")
        
        # Distribute cardholders among coders
        for i, cardholder in enumerate(cardholders):
            # Assign to coder (round-robin)
            coder = coders[i % len(coders)]
            
            # Check if assignment already exists
            existing = db.query(CardholderAssignment).filter(
                CardholderAssignment.cardholder_id == cardholder.id,
                CardholderAssignment.coder_id == coder.id,
                CardholderAssignment.is_active == True
            ).first()
            
            if not existing:
                assignment = CardholderAssignment(
                    cardholder_id=cardholder.id,
                    coder_id=coder.id,
                    is_active=True
                )
                db.add(assignment)
                print(f"Assigned {cardholder.full_name} to coder {coder.first_name} {coder.last_name}")
            
            # Also assign to reviewer (round-robin)
            if reviewers:
                reviewer = reviewers[i % len(reviewers)]
                
                # Check if reviewer assignment already exists
                existing_review = db.query(CardholderReviewer).filter(
                    CardholderReviewer.cardholder_id == cardholder.id,
                    CardholderReviewer.reviewer_id == reviewer.id,
                    CardholderReviewer.is_active == True
                ).first()
                
                if not existing_review:
                    review_assignment = CardholderReviewer(
                        cardholder_id=cardholder.id,
                        reviewer_id=reviewer.id,
                        review_order=1,
                        is_active=True
                    )
                    db.add(review_assignment)
                    print(f"Assigned {cardholder.full_name} to reviewer {reviewer.first_name} {reviewer.last_name}")
        
        db.commit()
        print("\nTest assignments created successfully!")
        
        # Show summary
        coder_counts = {}
        reviewer_counts = {}
        
        for coder in coders:
            count = db.query(CardholderAssignment).filter(
                CardholderAssignment.coder_id == coder.id,
                CardholderAssignment.is_active == True
            ).count()
            coder_counts[f"{coder.first_name} {coder.last_name}"] = count
        
        for reviewer in reviewers:
            count = db.query(CardholderReviewer).filter(
                CardholderReviewer.reviewer_id == reviewer.id,
                CardholderReviewer.is_active == True
            ).count()
            reviewer_counts[f"{reviewer.first_name} {reviewer.last_name}"] = count
        
        print("\nCoder Assignments:")
        for name, count in coder_counts.items():
            print(f"  - {name}: {count} cardholders")
            
        print("\nReviewer Assignments:")
        for name, count in reviewer_counts.items():
            print(f"  - {name}: {count} cardholders")
        
    except Exception as e:
        print(f"Error creating test assignments: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_test_assignments()