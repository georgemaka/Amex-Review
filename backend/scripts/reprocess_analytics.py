#!/usr/bin/env python3
"""Reprocess analytics for an existing statement to generate alerts."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import Statement, SpendingAlert
from app.services.analytics_processor import process_statement_analytics_sync


def reprocess_analytics(statement_id: int):
    db = SessionLocal()
    
    try:
        # Get statement
        statement = db.query(Statement).filter(Statement.id == statement_id).first()
        if not statement:
            print(f"Statement {statement_id} not found")
            return
            
        print(f"Reprocessing analytics for statement {statement_id} ({statement.month}/{statement.year})")
        
        # Delete existing alerts for this statement (optional)
        # You might want to keep old alerts for comparison
        
        # Process analytics
        process_statement_analytics_sync(db, statement_id)
        
        # Check alerts generated
        alerts = db.query(SpendingAlert).filter(SpendingAlert.is_resolved == False).all()
        print(f"\nTotal unresolved alerts: {len(alerts)}")
        
        # Group by type
        alert_types = {}
        for alert in alerts:
            if alert.alert_type not in alert_types:
                alert_types[alert.alert_type] = 0
            alert_types[alert.alert_type] += 1
        
        print("\nAlerts by type:")
        for alert_type, count in alert_types.items():
            print(f"  - {alert_type}: {count}")
        
        # Show some sample alerts
        print("\nSample alerts:")
        for alert in alerts[:5]:
            print(f"  - [{alert.severity}] {alert.description}")
        
    except Exception as e:
        print(f"Error reprocessing analytics: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        statement_id = int(sys.argv[1])
    else:
        # Use the most recent statement
        db = SessionLocal()
        latest = db.query(Statement).order_by(Statement.id.desc()).first()
        db.close()
        if latest:
            statement_id = latest.id
        else:
            print("No statements found")
            sys.exit(1)
    
    reprocess_analytics(statement_id)