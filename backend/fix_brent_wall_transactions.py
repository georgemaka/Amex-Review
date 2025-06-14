#!/usr/bin/env python3
"""
Script to fix BRENT J WALL's missing transactions by finding them in other cardholders' data
"""
import asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import Transaction, CardholderStatement, Cardholder


async def find_and_fix_brent_wall_transactions():
    async with AsyncSessionLocal() as db:
        # Find BRENT J WALL's cardholder record
        result = await db.execute(
            select(Cardholder).where(Cardholder.full_name == "BRENT J WALL")
        )
        brent_cardholder = result.scalar_one_or_none()
        
        if not brent_cardholder:
            print("BRENT J WALL not found in cardholders table")
            return
        
        print(f"Found BRENT J WALL: ID={brent_cardholder.id}")
        
        # Find his cardholder statement
        result = await db.execute(
            select(CardholderStatement).where(
                CardholderStatement.cardholder_id == brent_cardholder.id
            )
        )
        brent_statement = result.scalar_one_or_none()
        
        if not brent_statement:
            print("No cardholder statement found for BRENT J WALL")
            return
        
        print(f"Found BRENT J WALL's statement: ID={brent_statement.id}, current transaction count={brent_statement.transaction_count}")
        
        # Search for transactions that might belong to BRENT WALL
        # Look in the original_row_data JSON for first_name='BRENT' and last_name='WALL'
        query = text("""
            SELECT t.id, t.description, t.amount, t.merchant_name, t.transaction_date,
                   t.cardholder_statement_id, cs.cardholder_id, c.full_name,
                   t.original_row_data->>'first_name' as first_name,
                   t.original_row_data->>'last_name' as last_name
            FROM transactions t
            JOIN cardholder_statements cs ON t.cardholder_statement_id = cs.id
            JOIN cardholders c ON cs.cardholder_id = c.id
            WHERE t.original_row_data->>'first_name' = 'BRENT'
              AND t.original_row_data->>'last_name' = 'WALL'
              AND cs.statement_id = :statement_id
        """)
        
        result = await db.execute(query, {"statement_id": brent_statement.statement_id})
        transactions = result.fetchall()
        
        if not transactions:
            print("No transactions found for BRENT WALL in original_row_data")
            return
        
        print(f"\nFound {len(transactions)} transactions for BRENT WALL:")
        total_amount = 0
        for trans in transactions:
            print(f"  - {trans.transaction_date}: {trans.description} ${trans.amount:.2f} (currently assigned to {trans.full_name})")
            total_amount += trans.amount
        
        print(f"\nTotal amount: ${total_amount:.2f}")
        
        # Update transactions to point to BRENT J WALL's cardholder statement
        transaction_ids = [trans.id for trans in transactions]
        
        await db.execute(
            text("""
                UPDATE transactions 
                SET cardholder_statement_id = :new_cs_id 
                WHERE id = ANY(:trans_ids)
            """),
            {
                "new_cs_id": brent_statement.id,
                "trans_ids": transaction_ids
            }
        )
        
        # Update BRENT J WALL's cardholder statement counts
        await db.execute(
            text("""
                UPDATE cardholder_statements 
                SET transaction_count = :count,
                    total_amount = :amount
                WHERE id = :cs_id
            """),
            {
                "cs_id": brent_statement.id,
                "count": len(transactions),
                "amount": total_amount
            }
        )
        
        await db.commit()
        print(f"\nSuccessfully reassigned {len(transactions)} transactions to BRENT J WALL")
        print(f"Updated cardholder statement with count={len(transactions)}, total=${total_amount:.2f}")


if __name__ == "__main__":
    asyncio.run(find_and_fix_brent_wall_transactions())