#!/usr/bin/env python3
"""
Script to check for any unassigned or orphaned transactions
"""
from sqlalchemy import text
from app.db.session import SessionLocal


def check_transactions():
    db = SessionLocal()
    
    try:
        # Check cardholder statements with 0 transactions
        result = db.execute(text("""
            SELECT cs.id, c.full_name, cs.transaction_count, cs.total_amount,
                   s.month, s.year
            FROM cardholder_statements cs
            JOIN cardholders c ON cs.cardholder_id = c.id
            JOIN statements s ON cs.statement_id = s.id
            WHERE cs.transaction_count = 0
            ORDER BY c.full_name
        """))
        
        empty_statements = result.fetchall()
        print(f"Found {len(empty_statements)} cardholder statements with 0 transactions:")
        for stmt in empty_statements:
            print(f"  - {stmt.full_name} (Statement ID: {stmt.id}, Month: {stmt.month}/{stmt.year})")
        
        # Check if there are any transactions in the same statement period
        # that might belong to these cardholders
        print("\nChecking for potential matches in transaction data...")
        
        # Look for transactions where the description might contain cardholder names
        for stmt in empty_statements:
            cardholder_name = stmt.full_name
            # Extract first and last name
            parts = cardholder_name.split()
            if len(parts) >= 2:
                first_name = parts[0]
                last_name = parts[-1]
                
                # Search in all transactions for this statement period
                query = text("""
                    SELECT COUNT(*) as count, SUM(t.amount) as total,
                           cs.id as current_cs_id, c.full_name as current_cardholder
                    FROM transactions t
                    JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
                    JOIN cardholders c ON cs.cardholder_id = c.id
                    JOIN statements s ON cs.statement_id = s.id
                    WHERE s.month = :month AND s.year = :year
                      AND (
                        t.original_row_data::text ILIKE :first_pattern
                        OR t.original_row_data::text ILIKE :last_pattern
                        OR t.original_row_data::text ILIKE :full_pattern
                      )
                    GROUP BY cs.id, c.full_name
                """)
                
                result = db.execute(query, {
                    "month": stmt.month,
                    "year": stmt.year,
                    "first_pattern": f"%{first_name}%",
                    "last_pattern": f"%{last_name}%",
                    "full_pattern": f"%{first_name}%{last_name}%"
                })
                
                matches = result.fetchall()
                if matches:
                    print(f"\n  Potential matches for {cardholder_name}:")
                    for match in matches:
                        if match.count > 0:
                            print(f"    - {match.count} transactions (${match.total:.2f}) currently assigned to {match.current_cardholder}")
        
        # Also check the transaction count by cardholder for the period
        print("\n\nTransaction distribution for the statement period:")
        result = db.execute(text("""
            SELECT c.full_name, COUNT(t.id) as trans_count, SUM(t.amount) as total_amount
            FROM transactions t
            JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
            JOIN cardholders c ON cs.cardholder_id = c.id
            JOIN statements s ON cs.statement_id = s.id
            WHERE s.id = (SELECT MAX(id) FROM statements)
            GROUP BY c.full_name
            ORDER BY trans_count DESC
            LIMIT 10
        """))
        
        distributions = result.fetchall()
        for dist in distributions:
            print(f"  {dist.full_name}: {dist.trans_count} transactions (${dist.total_amount:.2f})")
        
    finally:
        db.close()


if __name__ == "__main__":
    check_transactions()