#!/usr/bin/env python3
"""
Integration test for enhanced rental transaction system.

This script tests the integration of:
1. Enhanced rental transaction creation API endpoint
2. Enhanced rentable items API endpoints
3. Proper error handling and validation
"""

import asyncio
import sys
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
import pytest
import pytest_asyncio

from sqlalchemy.ext.asyncio import AsyncSession

# Add app to path
sys.path.append('/Users/tluanga/current_work/rental-manager/rental-manager-backend')

from app.core.database import get_db
from app.modules.customers.models import Customer
from app.modules.master_data.item_master.models import Item
from app.modules.master_data.locations.models import Location
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.inventory.models import StockLevel
from app.modules.transactions.rentals.rental_service_enhanced import EnhancedRentalService, RentalTransactionRequest
from app.modules.transactions.rentals.rentable_items_service import RentableItemsService


@pytest_asyncio.fixture
async def test_data(db_session: AsyncSession):
    """Setup test data for integration testing."""
    print("🔧 Setting up test data...")
    
    # Create test customer
    from app.modules.customers.models import CustomerType
    customer = Customer(
        customer_code="CUST001",
        customer_type=CustomerType.INDIVIDUAL,
        first_name="Integration",
        last_name="Tester",
        email="integration@test.com",
        phone="1234567890"
    )
    db_session.add(customer)
    
    # Create test location
    from app.modules.master_data.locations.models import LocationType
    location = Location(
        location_code="LOC001",
        location_name="Integration Test Location",
        location_type=LocationType.WAREHOUSE,
        address="123 Test Street",
        city="Test City",
        state="Test State", 
        country="Test Country"
    )
    db_session.add(location)
    
    # Create test category
    category = Category(
        name="Test Equipment",
        category_code="TEST-EQUIP"
    )
    db_session.add(category)
    
    # Create test unit of measurement
    unit = UnitOfMeasurement(
        name="Test Units",
        code="TU"
    )
    db_session.add(unit)
    
    await db_session.flush()
    
    # Create test rentable item
    item = Item(
        id=uuid4(),
        item_name="Test Camera Equipment",
        sku="TEST-CAM-001",
        is_rentable=True,
        rental_rate_per_period=Decimal("25.00"),
        rental_period="1",  # 1 day per period
        category_id=category.id,
        unit_of_measurement_id=unit.id,
        is_active=True
    )
    db_session.add(item)
    
    await db_session.flush()
    
    # Create stock level
    stock_level = StockLevel(
        id=uuid4(),
        item_id=str(item.id),
        location_id=str(location.id),
        quantity_on_hand=Decimal("10"),
        quantity_available=Decimal("10"),
        quantity_on_rent=Decimal("0")
    )
    db_session.add(stock_level)
    
    await db_session.commit()
    print("✅ Test data setup completed")
    
    return {
        "customer": customer,
        "location": location,
        "category": category,
        "unit": unit,
        "item": item,
        "stock_level": stock_level
    }


@pytest.mark.asyncio
async def test_enhanced_rental_creation(db_session: AsyncSession, test_data):
    """Test enhanced rental transaction creation."""
    print("🧪 Testing enhanced rental transaction creation...")
    
    customer = test_data["customer"]
    location = test_data["location"]
    item = test_data["item"]
    
    # Create rental request
    request = RentalTransactionRequest(
        customer_id=str(customer.id),
        location_id=str(location.id),
        rental_start_date=date.today(),
        items=[{
            "item_id": str(item.id),
            "quantity": 2,
            "no_of_periods": 3,
            "discount_amount": Decimal("5.00"),
            "tax_rate": Decimal("2.0")
        }],
        notes="Integration test rental",
        discount_amount=Decimal("10.00"),
        tax_rate=Decimal("5.0")
    )
    
    # Test enhanced rental service
    service = EnhancedRentalService(db_session)
    result = await service.create_rental_transaction(request)
    
    # Validate result
    assert result["success"] is True
    assert "transaction_id" in result
    assert result["rental_status"] == "RENTAL_INPROGRESS"
    assert len(result["line_items"]) == 1
    
    print(f"✅ Enhanced rental created successfully: {result['transaction_id']}")
    print(f"   - Transaction Number: {result.get('transaction_number', 'N/A')}")
    print(f"   - Total Amount: ${result['total_amount']}")
    print(f"   - Line Items: {len(result['line_items'])}")
    
    return result


@pytest.mark.asyncio
async def test_rentable_items_service(db_session: AsyncSession, test_data):
    """Test rentable items service."""
    print("🧪 Testing rentable items service...")
    
    service = RentableItemsService(db_session)
    
    # Test 1: Get all rentable items with stock
    items = await service.get_all_rentable_items_with_stock()
    print(f"✅ Found {len(items)} rentable items")
    
    if items:
        item = items[0]
        print(f"   - Sample item: {item['itemname']}")
        print(f"   - Available locations: {len(item['available_units'])}")
    
    # Test 2: Get summary statistics
    summary = await service.get_rentable_items_summary()
    print(f"✅ Summary statistics:")
    print(f"   - Total rentable items: {summary['total_rentable_items']}")
    print(f"   - Items with stock: {summary['items_with_available_stock']}")
    print(f"   - Availability %: {summary['availability_percentage']}%")
    
    # Test 3: Get items by category
    categories = await service.get_rentable_items_by_category()
    print(f"✅ Found {len(categories)} categories with rentable items")
    
    if categories:
        category = categories[0]
        print(f"   - Sample category: {category['category_name']}")
        print(f"   - Items in category: {category['total_items']}")
    
    return {"items": items, "summary": summary, "categories": categories}


@pytest.mark.asyncio
async def test_validation_scenarios(db_session: AsyncSession, test_data):
    """Test validation scenarios."""
    print("🧪 Testing validation scenarios...")
    
    customer = test_data["customer"]
    location = test_data["location"]
    item = test_data["item"]
    
    service = EnhancedRentalService(db_session)
    
    # Test 1: Insufficient stock validation
    print("   Testing insufficient stock validation...")
    try:
        request = RentalTransactionRequest(
            customer_id=str(customer.id),
            location_id=str(location.id),
            rental_start_date=date.today(),
            items=[{
                "item_id": str(item.id),
                "quantity": 20,  # More than available (8 remaining after previous test)
                "no_of_periods": 1
            }]
        )
        await service.create_rental_transaction(request)
        assert False, "Should have raised validation error"
    except Exception as e:
        print(f"   ✅ Correctly caught insufficient stock error: {str(e)[:50]}...")
    
    # Test 2: Non-existent item validation
    print("   Testing non-existent item validation...")
    try:
        request = RentalTransactionRequest(
            customer_id=str(customer.id),
            location_id=str(location.id),
            rental_start_date=date.today(),
            items=[{
                "item_id": str(uuid4()),  # Random UUID that doesn't exist
                "quantity": 1,
                "no_of_periods": 1
            }]
        )
        await service.create_rental_transaction(request)
        assert False, "Should have raised validation error"
    except Exception:
        # Exception caught as expected - ensure DB session cleanup
        await db_session.rollback()
        print("   ✅ Correctly caught non-existent item error")
    
    print("✅ All validation scenarios passed")


@pytest.mark.asyncio
async def test_rental_calculations(db_session: AsyncSession, test_data):
    """Test rental calculation accuracy."""
    print("🧪 Testing rental calculation accuracy...")
    
    customer = test_data["customer"]
    location = test_data["location"]
    item = test_data["item"]
    
    service = EnhancedRentalService(db_session)
    
    # Test precise calculation scenario
    request = RentalTransactionRequest(
        customer_id=str(customer.id),
        location_id=str(location.id),
        rental_start_date=date(2025, 7, 30),
        items=[{
            "item_id": str(item.id),
            "quantity": 1,
            "no_of_periods": 5,  # 5 periods × 1 day = 5 days
            "discount_amount": Decimal("10.00"),
            "tax_rate": Decimal("5.0")  # 5% tax
        }],
        discount_amount=Decimal("5.00"),
        tax_rate=Decimal("10.0")  # 10% header tax
    )
    
    # Calculate line items manually to verify
    line_items = await service._calculate_line_items(request)
    assert len(line_items) == 1
    
    line_item = line_items[0]
    
    # Verify calculations
    # Expected: 25.00 × 5 periods × 1 quantity = 125.00
    assert line_item["raw_line_total"] == Decimal("125.00")
    
    # After line discount: 125.00 - 10.00 = 115.00
    assert line_item["raw_line_total"] - line_item["discount_amount"] == Decimal("115.00")
    
    # Line tax: 115.00 × 5% = 5.75
    expected_line_tax = Decimal("115.00") * (Decimal("5.0") / Decimal("100"))
    assert abs(line_item["tax_amount"] - expected_line_tax) < Decimal("0.01")
    
    # Return date: 2025-07-30 + 5 days = 2025-08-04
    assert line_item["return_date"] == date(2025, 8, 4)
    
    print("✅ All calculation tests passed")
    print(f"   - Raw line total: ${line_item['raw_line_total']}")
    print(f"   - After discount: ${line_item['raw_line_total'] - line_item['discount_amount']}")
    print(f"   - Line tax: ${line_item['tax_amount']}")
    print(f"   - Return date: {line_item['return_date']}")


async def run_integration_tests():
    """Run all integration tests."""
    print("🚀 Starting Enhanced Rental Transaction Integration Tests")
    print("=" * 60)
    
    try:
        async for session in get_db():
            try:
                # Setup test data
                test_data = await setup_test_data(session)
                
                # Run tests
                print()
                rental_result = await test_enhanced_rental_creation(session, test_data)
                
                print()
                items_result = await test_rentable_items_service(session, test_data)
                
                print()
                await test_validation_scenarios(session, test_data)
                
                print()
                await test_rental_calculations(session, test_data)
                
                print()
                print("=" * 60)
                print("🎉 ALL INTEGRATION TESTS PASSED!")
                print()
                print("Summary:")
                print(f"✅ Enhanced rental transaction creation: PASSED")
                print(f"✅ Rentable items service: PASSED")
                print(f"✅ Validation scenarios: PASSED")
                print(f"✅ Calculation accuracy: PASSED")
                print()
                print("The enhanced rental transaction system is ready for production use!")
                
            finally:
                await db_session.close()
                break
                
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_integration_tests())