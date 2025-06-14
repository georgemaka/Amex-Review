#!/usr/bin/env python3
"""
Script to find BRENT WALL transactions by examining the Excel data patterns
"""
from sqlalchemy import text
from app.db.session import SessionLocal
import json


def find_brent_transactions():
    db = SessionLocal()
    
    try:
        # First, let's see what's in the original_row_data for a few transactions
        print("Checking original_row_data structure from recent transactions...")
        result = db.execute(text("""
            SELECT t.id, t.description, t.amount, t.original_row_data,
                   c.full_name as current_cardholder
            FROM transactions t
            JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
            JOIN cardholders c ON cs.cardholder_id = c.id
            WHERE t.original_row_data IS NOT NULL
            LIMIT 5
        """))
        
        sample_transactions = result.fetchall()
        print(f"\nSample transaction data:")
        for trans in sample_transactions:
            data = trans.original_row_data
            print(f"\nTransaction ID: {trans.id}")
            print(f"Current cardholder: {trans.current_cardholder}")
            print(f"Amount: ${trans.amount:.2f}")
            if isinstance(data, dict):
                print(f"First name: {data.get('first_name', 'N/A')}")
                print(f"Last name: {data.get('last_name', 'N/A')}")
                print(f"Card number: {data.get('card_number', 'N/A')}")
            
        # Now search for BRENT in the data
        print("\n\nSearching for transactions with BRENT in original_row_data...")
        result = db.execute(text("""
            SELECT t.id, t.description, t.amount, t.merchant_name,
                   t.original_row_data->>'first_name' as first_name,
                   t.original_row_data->>'last_name' as last_name,
                   t.original_row_data->>'card_number' as card_number,
                   c.full_name as current_cardholder,
                   cs.id as current_cs_id
            FROM transactions t
            JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
            JOIN cardholders c ON cs.cardholder_id = c.id
            WHERE t.original_row_data->>'first_name' = 'BRENT'
               OR t.original_row_data->>'last_name' LIKE '%WALL%'
            ORDER BY t.transaction_date
        """))
        
        brent_transactions = result.fetchall()
        
        if brent_transactions:
            print(f"\nFound {len(brent_transactions)} potential BRENT WALL transactions:")
            total_amount = 0
            for trans in brent_transactions:
                print(f"\n  Transaction ID: {trans.id}")
                print(f"  Name in data: {trans.first_name} {trans.last_name}")
                print(f"  Card ending: {trans.card_number[-4:] if trans.card_number else 'N/A'}")
                print(f"  Amount: ${trans.amount:.2f}")
                print(f"  Merchant: {trans.merchant_name}")
                print(f"  Currently assigned to: {trans.current_cardholder}")
                total_amount += trans.amount
            
            print(f"\nTotal amount: ${total_amount:.2f}")
        else:
            print("\nNo transactions found with BRENT in the name fields")
            
        # Let's also check if the Excel parsing might be putting names in different fields
        print("\n\nChecking for any pattern variations...")
        result = db.execute(text("""
            SELECT DISTINCT 
                   t.original_row_data->>'first_name' as first_name,
                   t.original_row_data->>'last_name' as last_name,
                   COUNT(*) as trans_count
            FROM transactions t
            WHERE t.original_row_data IS NOT NULL
            GROUP BY first_name, last_name
            HAVING COUNT(*) < 10
            ORDER BY last_name, first_name
            LIMIT 20
        """))
        
        name_patterns = result.fetchall()
        print("\nCardholders with few transactions (might indicate parsing issues):")
        for pattern in name_patterns:
            if pattern.first_name and pattern.last_name:
                print(f"  {pattern.first_name} {pattern.last_name}: {pattern.trans_count} transactions")
        
    finally:
        db.close()


if __name__ == "__main__":
    find_brent_transactions()