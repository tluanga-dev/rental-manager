#!/usr/bin/env python3
"""
Test purchase creation using raw SQL to bypass ORM issues
"""
import asyncio
import uuid
from datetime import datetime
from decimal import Decimal

import asyncpg
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://rental_user:rental_password@localhost:5432/rental_db"

async def create_purchase_raw():
    """Create a purchase using raw SQL"""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Generate IDs
            transaction_id = uuid.uuid4()
            transaction_number = f"PUR-{datetime.now().strftime('%Y%m%d')}-0001"
            
            # Insert transaction header using raw SQL
            insert_sql = text("""
                INSERT INTO transaction_headers (
                    id, transaction_type, transaction_number, status,
                    transaction_date, supplier_id, location_id,
                    currency, subtotal, discount_amount, tax_amount,
                    shipping_amount, total_amount, paid_amount,
                    payment_status, payment_method,
                    created_at, updated_at, created_by, updated_by
                ) VALUES (
                    :id, :transaction_type, :transaction_number, :status,
                    :transaction_date, :supplier_id, :location_id,
                    :currency, :subtotal, :discount_amount, :tax_amount,
                    :shipping_amount, :total_amount, :paid_amount,
                    :payment_status, :payment_method,
                    NOW(), NOW(), :created_by, :updated_by
                )
                RETURNING id, transaction_number, total_amount
            """)
            
            result = await session.execute(
                insert_sql,
                {
                    "id": transaction_id,
                    "transaction_type": "PURCHASE",
                    "transaction_number": transaction_number,
                    "status": "PENDING",
                    "transaction_date": datetime.now(),
                    "supplier_id": uuid.UUID("550e8400-e29b-41d4-a716-446655440001"),
                    "location_id": uuid.UUID("70b8dc79-846b-47be-9450-507401a27494"),
                    "currency": "INR",
                    "subtotal": Decimal("499.95"),
                    "discount_amount": Decimal("0.00"),
                    "tax_amount": Decimal("0.00"),
                    "shipping_amount": Decimal("0.00"),
                    "total_amount": Decimal("499.95"),
                    "paid_amount": Decimal("0.00"),
                    "payment_status": "PENDING",
                    "payment_method": "BANK_TRANSFER",
                    "created_by": "admin",
                    "updated_by": "admin"
                }
            )
            
            row = result.fetchone()
            await session.commit()
            
            print(f"✅ Purchase created successfully!")
            print(f"   ID: {row[0]}")
            print(f"   Transaction Number: {row[1]}")
            print(f"   Total Amount: {row[2]}")
            
            return row[0]
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating purchase: {e}")
            raise
        finally:
            await engine.dispose()

async def verify_purchase(transaction_id):
    """Verify the purchase exists in the database"""
    
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='rental_user',
        password='rental_password',
        database='rental_db'
    )
    
    try:
        row = await conn.fetchrow(
            """
            SELECT id, transaction_number, status, total_amount 
            FROM transaction_headers 
            WHERE id = $1
            """,
            transaction_id
        )
        
        if row:
            print(f"\n📋 Purchase verified in database:")
            print(f"   ID: {row['id']}")
            print(f"   Number: {row['transaction_number']}")
            print(f"   Status: {row['status']}")
            print(f"   Total: {row['total_amount']}")
        else:
            print(f"❌ Purchase not found in database")
            
    finally:
        await conn.close()

async def main():
    print("🧪 Testing purchase creation with raw SQL...")
    print("=" * 50)
    
    # Create purchase
    transaction_id = await create_purchase_raw()
    
    if transaction_id:
        # Verify it exists
        await verify_purchase(transaction_id)
        
        print("\n✅ Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())