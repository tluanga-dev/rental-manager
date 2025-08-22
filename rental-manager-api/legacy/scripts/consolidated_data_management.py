#!/usr/bin/env python3
"""
Consolidated Data Management Script
Combines all data clearing functionality into a single, well-organized script
"""

import asyncio
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text, select, delete
from app.core.config import settings
from app.db.session import SessionLocal
import sys

class DataManager:
    """Unified data management class for clearing and resetting data"""
    
    def __init__(self):
        self.engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    async def clear_rental_transactions(self, session: AsyncSession):
        """Clear only rental-related transactions"""
        print("🔄 Clearing rental transactions...")
        
        queries = [
            "DELETE FROM rental_lifecycle WHERE transaction_header_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'RENTAL')",
            "DELETE FROM transaction_lines WHERE transaction_header_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'RENTAL')",
            "DELETE FROM transaction_headers WHERE transaction_type = 'RENTAL'",
            "UPDATE inventory_units SET status = 'AVAILABLE', reserved_by_transaction_id = NULL WHERE status IN ('RESERVED', 'RENTED')",
            "UPDATE stock_levels SET quantity_on_rent = 0, quantity_available = quantity_on_hand"
        ]
        
        for query in queries:
            await session.execute(text(query))
        
        await session.commit()
        print("✅ Rental transactions cleared")
    
    async def clear_purchase_transactions(self, session: AsyncSession):
        """Clear purchase transactions and related inventory"""
        print("🔄 Clearing purchase transactions...")
        
        queries = [
            "DELETE FROM stock_movements WHERE transaction_header_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'PURCHASE')",
            "DELETE FROM inventory_units WHERE created_from_transaction_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'PURCHASE')",
            "DELETE FROM transaction_lines WHERE transaction_header_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'PURCHASE')",
            "DELETE FROM transaction_headers WHERE transaction_type = 'PURCHASE'",
            "UPDATE stock_levels SET quantity_on_hand = 0, quantity_available = 0"
        ]
        
        for query in queries:
            await session.execute(text(query))
        
        await session.commit()
        print("✅ Purchase transactions cleared")
    
    async def clear_all_transactions(self, session: AsyncSession):
        """Clear all transactions and inventory data"""
        print("🔄 Clearing all transactions and inventory...")
        
        tables_to_clear = [
            "rental_lifecycle",
            "stock_movements", 
            "inventory_units",
            "transaction_lines",
            "transaction_headers",
            "stock_levels"
        ]
        
        for table in tables_to_clear:
            await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
            print(f"  ✓ Cleared {table}")
        
        await session.commit()
        print("✅ All transactions and inventory cleared")
    
    async def clear_master_data(self, session: AsyncSession, keep_auth: bool = True):
        """Clear master data (optionally keeping auth data)"""
        print("🔄 Clearing master data...")
        
        # First clear dependent data
        await self.clear_all_transactions(session)
        
        master_tables = [
            "items",
            "categories", 
            "brands",
            "units",
            "locations",
            "suppliers",
            "customers"
        ]
        
        if not keep_auth:
            master_tables.extend(["user_roles", "roles", "permissions", "users", "companies"])
        
        for table in master_tables:
            try:
                await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                print(f"  ✓ Cleared {table}")
            except Exception as e:
                print(f"  ✗ Error clearing {table}: {e}")
        
        await session.commit()
        print("✅ Master data cleared")
    
    async def reset_sequences(self, session: AsyncSession):
        """Reset all sequences to 1"""
        print("🔄 Resetting sequences...")
        
        sequences = [
            "transaction_headers_transaction_number_seq",
            "transaction_lines_line_number_seq",
            "items_sku_seq"
        ]
        
        for seq in sequences:
            try:
                await session.execute(text(f"ALTER SEQUENCE {seq} RESTART WITH 1"))
                print(f"  ✓ Reset {seq}")
            except Exception as e:
                print(f"  ✗ Error resetting {seq}: {e}")
        
        await session.commit()
        print("✅ Sequences reset")

async def main():
    """Main entry point with menu"""
    manager = DataManager()
    
    print("=" * 60)
    print("DATA MANAGEMENT TOOL")
    print("=" * 60)
    print("\nSelect an operation:")
    print("1. Clear rental transactions only")
    print("2. Clear purchase transactions only")
    print("3. Clear all transactions and inventory")
    print("4. Clear all data except auth (master data + transactions)")
    print("5. Clear everything (full reset)")
    print("6. Reset sequences")
    print("0. Exit")
    
    choice = input("\nEnter your choice (0-6): ").strip()
    
    if choice == "0":
        print("Exiting...")
        return
    
    # Confirmation
    confirm = input("\n⚠️  This operation cannot be undone. Continue? (yes/no): ").lower()
    if confirm != "yes":
        print("Operation cancelled.")
        return
    
    async with SessionLocal() as session:
        try:
            if choice == "1":
                await manager.clear_rental_transactions(session)
            elif choice == "2":
                await manager.clear_purchase_transactions(session)
            elif choice == "3":
                await manager.clear_all_transactions(session)
            elif choice == "4":
                await manager.clear_master_data(session, keep_auth=True)
            elif choice == "5":
                await manager.clear_master_data(session, keep_auth=False)
            elif choice == "6":
                await manager.reset_sequences(session)
            else:
                print("Invalid choice.")
                return
            
            print("\n✅ Operation completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(main())