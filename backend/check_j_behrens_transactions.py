#!/usr/bin/env python3
"""
Script to check if J BEHRENS transactions exist and where they're assigned
"""
from sqlalchemy import text
from app.db.session import SessionLocal
from datetime import datetime


def check_j_behrens_transactions():
    db = SessionLocal()
    
    try:
        # Look for transactions from the dates we saw in BRENT's PDF
        print("Searching for transactions from BRENT J WALL's PDF dates...")
        
        # Some specific transactions from the PDF
        test_transactions = [
            ("2025-04-30", 152.59, "ACCURIDE"),
            ("2025-04-30", 602.24, "PAYPAL"),
            ("2025-05-02", 258.28, "NAPA"),
            ("2025-05-04", 2036.69, "PLEASANTON NAPA"),
            ("2025-05-17", 825.00, "DAVES TOWING")
        ]
        
        for trans_date, amount, merchant_part in test_transactions:
            print(f"\nLooking for transaction: {trans_date} ${amount} {merchant_part}")
            
            result = db.execute(text("""
                SELECT t.id, t.amount, t.merchant_name, t.description,
                       c.full_name as assigned_to,
                       t.original_row_data->>'first_name' as excel_first,
                       t.original_row_data->>'last_name' as excel_last
                FROM transactions t
                JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
                JOIN cardholders c ON cs.cardholder_id = c.id
                WHERE DATE(t.transaction_date) = :trans_date
                  AND ABS(t.amount - :amount) < 0.01
                  AND (t.merchant_name ILIKE :merchant_pattern 
                       OR t.description ILIKE :merchant_pattern)
            """), {
                "trans_date": trans_date,
                "amount": amount,
                "merchant_pattern": f"%{merchant_part}%"
            })
            
            matches = result.fetchall()
            if matches:
                for match in matches:
                    print(f"  FOUND: Assigned to {match.assigned_to}")
                    print(f"    Excel name: {match.excel_first} {match.excel_last}")
                    print(f"    Merchant: {match.merchant_name}")
                    print(f"    Description: {match.description[:80]}...")
            else:
                print(f"  NOT FOUND in database")
        
        # Also check if there's anyone with J BEHRENS in their transactions
        print("\n\nChecking for any J BEHRENS references...")
        result = db.execute(text("""
            SELECT DISTINCT c.full_name, COUNT(*) as trans_count
            FROM transactions t
            JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
            JOIN cardholders c ON cs.cardholder_id = c.id
            WHERE t.description ILIKE '%BEHRENS%'
               OR t.merchant_name ILIKE '%BEHRENS%'
               OR t.original_row_data::text ILIKE '%BEHRENS%'
            GROUP BY c.full_name
        """))
        
        behrens_refs = result.fetchall()
        if behrens_refs:
            print("Found references to BEHRENS in transactions:")
            for ref in behrens_refs:
                print(f"  {ref.full_name}: {ref.trans_count} transactions")
        
    finally:
        db.close()


if __name__ == "__main__":
    check_j_behrens_transactions()