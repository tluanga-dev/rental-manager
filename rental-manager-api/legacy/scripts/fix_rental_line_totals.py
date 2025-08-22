#!/usr/bin/env python3
"""
Fix rental line totals for existing rentals that were created before the calculation fix.
This script recalculates line_total for all rental transaction lines to include rental period multiplication.
"""

import asyncio
import sys
import os
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionType


async def fix_rental_line_totals():
    """Fix line totals for all rental transactions."""
    
    # Create async engine and session
    engine = create_async_engine(str(settings.DATABASE_URL), echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Get all rental transaction lines
            query = select(TransactionLine).join(TransactionHeader).where(
                TransactionHeader.transaction_type == TransactionType.RENTAL
            )
            
            result = await session.execute(query)
            rental_lines = result.scalars().all()
            
            print(f"Found {len(rental_lines)} rental transaction lines to check...")
            
            fixed_count = 0
            
            for line in rental_lines:
                # Calculate the correct line total
                old_line_total = line.line_total
                
                # Recalculate using the fixed calculation method
                new_line_total = line._calculate_line_total()
                
                if abs(old_line_total - new_line_total) > Decimal('0.01'):
                    print(f"Fixing line {line.id}:")
                    print(f"  Item: {line.description}")
                    print(f"  Quantity: {line.quantity}")
                    print(f"  Unit Price: {line.unit_price}")
                    print(f"  Rental Period: {line.rental_period}")
                    print(f"  Old Total: {old_line_total}")
                    print(f"  New Total: {new_line_total}")
                    print(f"  Difference: {new_line_total - old_line_total}")
                    print("---")
                    
                    # Update the line total
                    line.line_total = new_line_total
                    fixed_count += 1
                    
            if fixed_count > 0:
                # Commit the changes
                await session.commit()
                print(f"✅ Fixed {fixed_count} rental line totals")
                
                # Now update transaction header totals
                await fix_transaction_header_totals(session)
            else:
                print("✅ All rental line totals are already correct")
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error fixing rental line totals: {e}")
            raise
        finally:
            await engine.dispose()


async def fix_transaction_header_totals(session: AsyncSession):
    """Fix transaction header totals based on updated line totals."""
    
    # Get all rental transaction headers
    query = select(TransactionHeader).where(
        TransactionHeader.transaction_type == TransactionType.RENTAL
    )
    
    result = await session.execute(query)
    rental_headers = result.scalars().all()
    
    print(f"Updating {len(rental_headers)} rental transaction headers...")
    
    fixed_headers = 0
    
    for header in rental_headers:
        # Get all lines for this transaction
        lines_query = select(TransactionLine).where(
            TransactionLine.transaction_header_id == header.id
        )
        lines_result = await session.execute(lines_query)
        lines = lines_result.scalars().all()
        
        # Calculate new totals
        new_subtotal = sum(line.line_total for line in lines)
        old_subtotal = header.subtotal
        
        # Calculate total amount (subtotal + tax - discount)
        new_total_amount = new_subtotal + (header.tax_amount or Decimal('0')) - (header.discount_amount or Decimal('0'))
        old_total_amount = header.total_amount
        
        if abs(old_subtotal - new_subtotal) > Decimal('0.01') or abs(old_total_amount - new_total_amount) > Decimal('0.01'):
            print(f"Updating header {header.transaction_number}:")
            print(f"  Old Subtotal: {old_subtotal} -> New Subtotal: {new_subtotal}")
            print(f"  Old Total: {old_total_amount} -> New Total: {new_total_amount}")
            
            header.subtotal = new_subtotal
            header.total_amount = new_total_amount
            fixed_headers += 1
    
    if fixed_headers > 0:
        await session.commit()
        print(f"✅ Updated {fixed_headers} transaction headers")
    else:
        print("✅ All transaction headers are already correct")


async def main():
    """Main function."""
    print("🔧 Starting rental line total fix...")
    await fix_rental_line_totals()
    print("✅ Rental line total fix completed!")


if __name__ == "__main__":
    asyncio.run(main())