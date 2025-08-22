#!/usr/bin/env python3
"""
Create comprehensive test data for dashboard analytics testing

This script creates:
1. Purchase transactions to populate inventory
2. Rental transactions with various statuses
3. Data spread across the last 30 days for trend visualization
"""

import asyncio
import sys
import os
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID, uuid4
import random

# Add the project root to the path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import engine
from app.db.session import AsyncSessionLocal
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.locations.models import Location
from app.modules.suppliers.models import Supplier
from app.modules.customers.models import Customer
from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import (
    TransactionType, RentalStatus, PaymentStatus, TransactionStatus
)
from app.modules.inventory.models import StockLevel


async def get_or_create_supplier(session: AsyncSession) -> Supplier:
    """Get existing supplier or create a default one"""
    # Try to get an existing supplier
    result = await session.execute(select(Supplier).limit(1))
    supplier = result.scalar()
    
    if supplier:
        print(f"Using existing supplier: {supplier.name}")
        return supplier
    
    # Create a default supplier
    supplier = Supplier(
        id=uuid4(),
        name="Test Equipment Supplier",
        contact_person="John Smith",
        email="supplier@example.com",
        phone="123-456-7890",
        address="123 Supplier St",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        is_active=True
    )
    session.add(supplier)
    await session.commit()
    print(f"Created supplier: {supplier.name}")
    return supplier


async def get_or_create_customer(session: AsyncSession, name: str, email: str) -> Customer:
    """Get existing customer or create one"""
    # Check if customer exists
    result = await session.execute(
        select(Customer).where(Customer.email == email)
    )
    customer = result.scalar()
    
    if customer:
        return customer
    
    # Create new customer
    customer = Customer(
        id=uuid4(),
        name=name,
        email=email,
        phone=f"555-{random.randint(1000, 9999)}",
        address=f"{random.randint(100, 999)} Customer St",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        is_active=True
    )
    session.add(customer)
    await session.commit()
    print(f"Created customer: {customer.name}")
    return customer


async def get_available_items(session: AsyncSession, limit: int = 10) -> List[Item]:
    """Get available items for transactions"""
    result = await session.execute(
        select(Item).where(Item.is_active == True).limit(limit)
    )
    items = result.scalars().all()
    
    if not items:
        print("⚠️ No items found in the database. Please create items first.")
        return []
    
    print(f"Found {len(items)} items for test transactions")
    return list(items)


async def get_location(session: AsyncSession) -> Optional[Location]:
    """Get a default location"""
    result = await session.execute(select(Location).limit(1))
    location = result.scalar()
    
    if not location:
        print("⚠️ No location found. Creating default location.")
        location = Location(
            id=uuid4(),
            name="Main Location",
            address="123 Main St",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            is_active=True
        )
        session.add(location)
        await session.commit()
    
    return location


async def create_purchase_transaction(
    session: AsyncSession,
    supplier: Supplier,
    location: Location,
    items: List[Item],
    transaction_date: datetime
) -> TransactionHeader:
    """Create a purchase transaction to populate inventory"""
    
    # Select 2-4 random items for this purchase
    selected_items = random.sample(items, min(random.randint(2, 4), len(items)))
    
    # Create transaction header
    transaction = TransactionHeader(
        id=uuid4(),
        transaction_type=TransactionType.PURCHASE,
        status=TransactionStatus.COMPLETED,
        transaction_date=transaction_date,
        supplier_id=supplier.id,
        location_id=location.id,
        total_amount=Decimal("0.00"),
        created_at=transaction_date,
        updated_at=transaction_date,
        notes=f"Test purchase transaction for dashboard analytics"
    )
    
    session.add(transaction)
    total_amount = Decimal("0.00")
    
    # Create transaction lines
    for idx, item in enumerate(selected_items, 1):
        quantity = random.randint(5, 20)  # Purchase 5-20 units
        unit_price = Decimal(str(random.uniform(100.0, 500.0)))  # ₹100-500 per unit
        line_total = unit_price * quantity
        total_amount += line_total
        
        line = TransactionLine(
            id=uuid4(),
            transaction_header_id=transaction.id,
            line_number=idx,
            item_id=str(item.id),
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
            created_at=transaction_date,
            updated_at=transaction_date
        )
        session.add(line)
        
        # Update or create stock level
        stock_level_result = await session.execute(
            select(StockLevel).where(
                StockLevel.item_id == item.id,
                StockLevel.location_id == location.id
            )
        )
        stock_level = stock_level_result.scalar()
        
        if stock_level:
            stock_level.quantity_on_hand += quantity
            stock_level.quantity_available += quantity
            stock_level.updated_at = transaction_date
        else:
            stock_level = StockLevel(
                id=uuid4(),
                item_id=item.id,
                location_id=location.id,
                quantity_on_hand=quantity,
                quantity_available=quantity,
                quantity_on_rent=Decimal("0"),
                quantity_damaged=Decimal("0"),
                quantity_under_repair=Decimal("0"),
                quantity_beyond_repair=Decimal("0"),
                created_at=transaction_date,
                updated_at=transaction_date
            )
            session.add(stock_level)
    
    # Update transaction total
    transaction.total_amount = total_amount
    await session.commit()
    
    print(f"Created purchase transaction: ₹{total_amount:.2f} for {len(selected_items)} items")
    return transaction


async def create_rental_transaction(
    session: AsyncSession,
    customer: Customer,
    location: Location,
    items: List[Item],
    transaction_date: datetime
) -> TransactionHeader:
    """Create a rental transaction"""
    
    # Select 1-3 random items for this rental
    selected_items = random.sample(items, min(random.randint(1, 3), len(items)))
    
    # Determine rental status based on date
    days_ago = (datetime.now(timezone.utc) - transaction_date).days
    if days_ago > 15:
        # Old rentals are likely completed
        possible_statuses = [RentalStatus.RENTAL_COMPLETED, RentalStatus.RENTAL_LATE]
        status = random.choice(possible_statuses)
    elif days_ago > 7:
        # Medium age rentals might be extended or in progress
        possible_statuses = [RentalStatus.RENTAL_INPROGRESS, RentalStatus.RENTAL_EXTENDED, RentalStatus.RENTAL_COMPLETED]
        status = random.choice(possible_statuses)
    else:
        # Recent rentals are likely in progress
        possible_statuses = [RentalStatus.RENTAL_INPROGRESS, RentalStatus.RENTAL_EXTENDED]
        status = random.choice(possible_statuses)
    
    # Create transaction header
    transaction = TransactionHeader(
        id=uuid4(),
        transaction_type=TransactionType.RENTAL,
        status=TransactionStatus.COMPLETED if status == RentalStatus.RENTAL_COMPLETED else TransactionStatus.IN_PROGRESS,
        transaction_date=transaction_date,
        customer_id=customer.id,
        location_id=location.id,
        total_amount=Decimal("0.00"),
        created_at=transaction_date,
        updated_at=transaction_date,
        notes=f"Test rental transaction - Status: {status.value}"
    )
    
    session.add(transaction)
    total_amount = Decimal("0.00")
    
    # Create transaction lines
    for idx, item in enumerate(selected_items, 1):
        # Check available stock
        stock_level_result = await session.execute(
            select(StockLevel).where(
                StockLevel.item_id == item.id,
                StockLevel.location_id == location.id
            )
        )
        stock_level = stock_level_result.scalar()
        
        if not stock_level or stock_level.quantity_available <= 0:
            print(f"⚠️ No stock available for {item.item_name}, skipping")
            continue
        
        quantity = min(random.randint(1, 3), int(stock_level.quantity_available))  # Rent 1-3 units
        unit_price = Decimal(str(random.uniform(50.0, 200.0)))  # ₹50-200 per day
        rental_days = random.randint(3, 14)  # 3-14 day rentals
        line_total = unit_price * quantity * rental_days
        total_amount += line_total
        
        line = TransactionLine(
            id=uuid4(),
            transaction_header_id=transaction.id,
            line_number=idx,
            item_id=str(item.id),
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
            current_rental_status=status,
            created_at=transaction_date,
            updated_at=transaction_date
        )
        session.add(line)
        
        # Update stock level (reduce available quantity, increase on rent)
        if status != RentalStatus.RENTAL_COMPLETED:
            stock_level.quantity_available -= quantity
            stock_level.quantity_on_rent += quantity
            stock_level.updated_at = transaction_date
    
    # Update transaction total
    transaction.total_amount = total_amount
    await session.commit()
    
    print(f"Created rental transaction: ₹{total_amount:.2f} ({status.value}) for {len(selected_items)} items")
    return transaction


async def create_test_data():
    """Main function to create comprehensive test data"""
    
    async with AsyncSessionLocal() as session:
        try:
            print("🚀 Starting dashboard test data creation...")
            
            # Get required master data
            supplier = await get_or_create_supplier(session)
            location = await get_location(session)
            items = await get_available_items(session)
            
            if not items:
                print("❌ Cannot create test data without items. Please run item seeding first.")
                return
            
            # Create customers
            customers = []
            customer_names = [
                ("Alice Johnson", "alice@example.com"),
                ("Bob Smith", "bob@example.com"),
                ("Carol Davis", "carol@example.com"),
                ("David Wilson", "david@example.com"),
                ("Emma Brown", "emma@example.com")
            ]
            
            for name, email in customer_names:
                customer = await get_or_create_customer(session, name, email)
                customers.append(customer)
            
            print(f"✅ Created/found {len(customers)} customers")
            
            # Create date range for last 30 days
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=30)
            
            # Create purchase transactions (to populate inventory)
            print("\n📦 Creating purchase transactions...")
            purchase_dates = []
            for i in range(5):  # 5 purchase transactions
                # Spread purchases across the last 30 days
                days_back = random.randint(25, 30)
                purchase_date = end_date - timedelta(days=days_back)
                purchase_dates.append(purchase_date)
            
            purchase_dates.sort()  # Chronological order
            
            for i, purchase_date in enumerate(purchase_dates):
                await create_purchase_transaction(
                    session, supplier, location, items, purchase_date
                )
            
            print(f"✅ Created {len(purchase_dates)} purchase transactions")
            
            # Create rental transactions
            print("\n🏠 Creating rental transactions...")
            rental_dates = []
            for i in range(12):  # 12 rental transactions
                # Spread rentals across the last 25 days (after some purchases)
                days_back = random.randint(1, 25)
                rental_date = end_date - timedelta(days=days_back)
                rental_dates.append(rental_date)
            
            rental_dates.sort()  # Chronological order
            
            for i, rental_date in enumerate(rental_dates):
                customer = random.choice(customers)
                await create_rental_transaction(
                    session, customer, location, items, rental_date
                )
            
            print(f"✅ Created {len(rental_dates)} rental transactions")
            
            # Summary
            print("\n📊 Test data creation summary:")
            print(f"   • {len(purchase_dates)} purchase transactions")
            print(f"   • {len(rental_dates)} rental transactions")
            print(f"   • {len(customers)} customers")
            print(f"   • Data spans {(end_date - start_date).days} days")
            print(f"   • Items involved: {len(items)}")
            
            print("\n✅ Dashboard test data created successfully!")
            print("🔄 You can now refresh the dashboard to see the analytics.")
            
        except Exception as e:
            print(f"❌ Error creating test data: {str(e)}")
            await session.rollback()
            raise


if __name__ == "__main__":
    print("🧪 Dashboard Analytics Test Data Creator")
    print("=" * 50)
    
    # Run the async function
    asyncio.run(create_test_data())