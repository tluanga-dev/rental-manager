#!/usr/bin/env python3
"""
Quick integration test for the Item module.
Tests basic functionality with real database operations.
"""

import asyncio
import sys
import os
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.models.item import Item
from app.models.brand import Brand
from app.models.category import Category
from app.models.unit_of_measurement import UnitOfMeasurement
from app.schemas.item import ItemCreate, ItemUpdate
from app.services.item import ItemService
from app.crud.item import ItemRepository
from app.services.sku_generator import SKUGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Test database configuration
TEST_DATABASE_URL = "postgresql+asyncpg://test_user:TestPass123!@localhost:5433/rental_manager_test"

async def test_database_connection():
    """Test that we can connect to the test database."""
    print("🔍 Testing database connection...")
    try:
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session_maker() as session:
            # Simple query to test connection
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            if row and row[0] == 1:
                print("  ✅ Database connection successful")
                return True
            else:
                print("  ❌ Database connection failed - invalid response")
                return False
                
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}")
        return False

async def test_item_crud_operations():
    """Test basic CRUD operations for items."""
    print("🔍 Testing Item CRUD operations...")
    
    try:
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session_maker() as session:
            # Create test dependencies first
            brand = Brand(
                id=uuid4(),
                name="Test Brand",
                code="TB",
                description="Test brand for integration testing"
            )
            session.add(brand)
            
            category = Category(
                id=uuid4(),
                name="Test Category", 
                category_code="TESTCAT",
                category_path="Test Category",
                category_level=1
            )
            session.add(category)
            
            unit = UnitOfMeasurement(
                id=uuid4(),
                name="Pieces",
                code="PCS", 
                description="Individual pieces"
            )
            session.add(unit)
            
            await session.flush()  # Get the IDs
            
            # Create test item
            item = Item(
                id=uuid4(),
                item_name="Integration Test Item",
                sku=f"INTEG-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                description="Item created during integration testing",
                brand_id=brand.id,
                category_id=category.id, 
                unit_of_measurement_id=unit.id,
                is_rentable=True,
                is_salable=True,
                cost_price=Decimal("100.00"),
                sale_price=Decimal("150.00"),
                rental_rate_per_day=Decimal("25.00"),
                stock_quantity=10,
                reorder_level=5
            )
            session.add(item)
            await session.commit()
            
            print(f"  ✅ Created item: {item.item_name} (SKU: {item.sku})")
            print(f"  ✅ Item can be rented: {item.can_be_rented()}")
            print(f"  ✅ Item can be sold: {item.can_be_sold()}")
            print(f"  ✅ Profit margin: {item.profit_margin}%")
            
            # Test rental blocking
            item.block_rental("Integration test block", uuid4())
            await session.commit()
            print(f"  ✅ Item rental blocked: {item.is_rental_blocked}")
            
            # Test rental unblocking
            item.unblock_rental()
            await session.commit()
            print(f"  ✅ Item rental unblocked: {not item.is_rental_blocked}")
            
            return True
            
    except Exception as e:
        print(f"  ❌ CRUD operations failed: {e}")
        return False

async def test_sku_generator():
    """Test SKU generator functionality."""
    print("🔍 Testing SKU Generator...")
    
    try:
        engine = create_async_engine(TEST_DATABASE_URL, echo=False)
        async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session_maker() as session:
            sku_gen = SKUGenerator(session)
            
            # Test basic SKU generation
            sku = await sku_gen.generate_sku()
            print(f"  ✅ Generated SKU: {sku}")
            
            # Test with custom pattern
            sku_custom = await sku_gen.generate_sku(pattern="TEST-{counter:04d}")
            print(f"  ✅ Generated custom SKU: {sku_custom}")
            
            return True
            
    except Exception as e:
        print(f"  ❌ SKU Generator test failed: {e}")
        return False

async def run_integration_tests():
    """Run all integration tests."""
    print("🚀 Starting Item Module Integration Tests")
    print("=" * 50)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Item CRUD Operations", test_item_crud_operations), 
        ("SKU Generator", test_sku_generator)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 30)
        
        try:
            if await test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ Test failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print("📊 INTEGRATION TEST SUMMARY") 
    print("=" * 50)
    print(f"✅ Passed: {passed}/{len(tests)}")
    print(f"❌ Failed: {failed}/{len(tests)}")
    
    if failed == 0:
        print("🎉 ALL INTEGRATION TESTS PASSED!")
        return True
    else:
        print("⚠️  Some integration tests failed.")
        return False

if __name__ == "__main__":
    success = asyncio.run(run_integration_tests())
    sys.exit(0 if success else 1)