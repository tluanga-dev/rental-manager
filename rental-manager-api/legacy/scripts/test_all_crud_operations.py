#!/usr/bin/env python3
"""
Comprehensive CRUD Operations Test Script
Tests all major CRUD operations across all modules to verify database functionality.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import json
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash, verify_password
from sqlalchemy import text, select, func
from sqlalchemy.exc import IntegrityError

# Import all models
from app.modules.users.models import User
from app.modules.company.models import Company
from app.modules.master_data.categories.models import Category
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item
from app.modules.customers.models import Customer
from app.modules.suppliers.models import Supplier
from app.modules.inventory.models import InventoryUnit, StockLevel
from app.modules.transactions.base.models.transaction_headers import TransactionHeader
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.auth.models import Role, Permission

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_test(module: str, operation: str, status: str = "TESTING"):
    """Print test status"""
    color = Colors.BLUE if status == "TESTING" else Colors.GREEN if status == "PASSED" else Colors.FAIL
    symbol = "🔄" if status == "TESTING" else "✓" if status == "PASSED" else "✗"
    print(f"{color}{symbol} [{module}] {operation}{Colors.ENDC}")


def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.HEADER}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.ENDC}")


async def test_auth_models(session):
    """Test authentication and RBAC models"""
    print_section("Testing Authentication & RBAC Models")
    
    try:
        # Test Role CRUD
        print_test("Auth", "Creating role", "TESTING")
        test_role = Role(
            name=f"test_role_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            description="Test role for CRUD testing"
        )
        session.add(test_role)
        await session.commit()
        print_test("Auth", "Creating role", "PASSED")
        
        # Test Permission CRUD
        print_test("Auth", "Creating permission", "TESTING")
        test_permission = Permission(
            name=f"test_permission_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            resource="test_resource",
            action="test_action",
            description="Test permission"
        )
        session.add(test_permission)
        await session.commit()
        print_test("Auth", "Creating permission", "PASSED")
        
        # Test Role-Permission association
        print_test("Auth", "Associating role with permission", "TESTING")
        test_role.permissions.append(test_permission)
        await session.commit()
        print_test("Auth", "Associating role with permission", "PASSED")
        
        # Read test
        print_test("Auth", "Reading role with permissions", "TESTING")
        result = await session.execute(
            select(Role).where(Role.id == test_role.id)
        )
        fetched_role = result.scalar_one()
        assert fetched_role.name == test_role.name
        print_test("Auth", "Reading role with permissions", "PASSED")
        
        # Cleanup
        await session.delete(test_role)
        await session.delete(test_permission)
        await session.commit()
        print_test("Auth", "Cleanup", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Auth", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_company_model(session):
    """Test Company model CRUD operations"""
    print_section("Testing Company Model")
    
    try:
        # Create
        print_test("Company", "Creating company", "TESTING")
        test_company = Company(
            name="Test Company CRUD",
            code=f"TC_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            address="123 Test Street",
            city="Test City",
            country="Test Country",
            email="test@company.com"
        )
        session.add(test_company)
        await session.commit()
        print_test("Company", "Creating company", "PASSED")
        
        # Read
        print_test("Company", "Reading company", "TESTING")
        result = await session.execute(
            select(Company).where(Company.id == test_company.id)
        )
        fetched_company = result.scalar_one()
        assert fetched_company.name == "Test Company CRUD"
        print_test("Company", "Reading company", "PASSED")
        
        # Update
        print_test("Company", "Updating company", "TESTING")
        fetched_company.city = "Updated City"
        await session.commit()
        print_test("Company", "Updating company", "PASSED")
        
        # Delete
        print_test("Company", "Deleting company", "TESTING")
        await session.delete(fetched_company)
        await session.commit()
        print_test("Company", "Deleting company", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Company", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_master_data_models(session):
    """Test all master data models"""
    print_section("Testing Master Data Models")
    
    try:
        # Test Category
        print_test("Category", "Creating category", "TESTING")
        test_category = Category(
            name="Test Category",
            code=f"CAT_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            description="Test category for CRUD"
        )
        session.add(test_category)
        await session.commit()
        print_test("Category", "Creating category", "PASSED")
        
        # Test Brand
        print_test("Brand", "Creating brand", "TESTING")
        test_brand = Brand(
            name="Test Brand",
            code=f"BR_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            description="Test brand for CRUD"
        )
        session.add(test_brand)
        await session.commit()
        print_test("Brand", "Creating brand", "PASSED")
        
        # Test Unit of Measurement
        print_test("Unit", "Creating unit of measurement", "TESTING")
        test_unit = UnitOfMeasurement(
            name="Test Unit",
            abbreviation=f"TU_{datetime.now().strftime('%H%M%S')}",
            description="Test unit for CRUD"
        )
        session.add(test_unit)
        await session.commit()
        print_test("Unit", "Creating unit of measurement", "PASSED")
        
        # Test Location
        print_test("Location", "Creating location", "TESTING")
        test_location = Location(
            name="Test Location",
            code=f"LOC_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            type="WAREHOUSE",
            address="Test Address"
        )
        session.add(test_location)
        await session.commit()
        print_test("Location", "Creating location", "PASSED")
        
        # Test Item
        print_test("Item", "Creating item", "TESTING")
        test_item = Item(
            name="Test Item",
            sku=f"SKU_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            description="Test item for CRUD",
            category_id=test_category.id,
            brand_id=test_brand.id,
            unit_of_measurement_id=test_unit.id,
            is_serialized=False,
            is_rental=True,
            rental_rate_daily=10.00
        )
        session.add(test_item)
        await session.commit()
        print_test("Item", "Creating item", "PASSED")
        
        # Test relationships
        print_test("Item", "Testing item relationships", "TESTING")
        result = await session.execute(
            select(Item).where(Item.id == test_item.id)
        )
        fetched_item = result.scalar_one()
        assert fetched_item.category_id == test_category.id
        assert fetched_item.brand_id == test_brand.id
        print_test("Item", "Testing item relationships", "PASSED")
        
        # Cleanup
        await session.delete(test_item)
        await session.delete(test_location)
        await session.delete(test_unit)
        await session.delete(test_brand)
        await session.delete(test_category)
        await session.commit()
        print_test("Master Data", "Cleanup", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Master Data", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_business_partners(session):
    """Test Customer and Supplier models"""
    print_section("Testing Business Partners")
    
    try:
        # Test Customer
        print_test("Customer", "Creating customer", "TESTING")
        test_customer = Customer(
            name="Test Customer",
            code=f"CUST_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            email="test@customer.com",
            phone="1234567890",
            customer_type="INDIVIDUAL"
        )
        session.add(test_customer)
        await session.commit()
        print_test("Customer", "Creating customer", "PASSED")
        
        # Test Supplier
        print_test("Supplier", "Creating supplier", "TESTING")
        test_supplier = Supplier(
            name="Test Supplier",
            code=f"SUP_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            email="test@supplier.com",
            phone="0987654321"
        )
        session.add(test_supplier)
        await session.commit()
        print_test("Supplier", "Creating supplier", "PASSED")
        
        # Update tests
        print_test("Customer", "Updating customer", "TESTING")
        test_customer.phone = "9999999999"
        await session.commit()
        print_test("Customer", "Updating customer", "PASSED")
        
        # Cleanup
        await session.delete(test_customer)
        await session.delete(test_supplier)
        await session.commit()
        print_test("Business Partners", "Cleanup", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Business Partners", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_inventory_models(session):
    """Test Inventory models"""
    print_section("Testing Inventory Models")
    
    try:
        # First create required master data
        test_location = Location(
            name="Inventory Test Location",
            code=f"INV_LOC_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            type="WAREHOUSE"
        )
        test_item = Item(
            name="Inventory Test Item",
            sku=f"INV_SKU_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            is_serialized=True
        )
        session.add_all([test_location, test_item])
        await session.commit()
        
        # Test Inventory Unit
        print_test("Inventory", "Creating inventory unit", "TESTING")
        test_inv_unit = InventoryUnit(
            item_id=test_item.id,
            serial_number=f"SN_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            location_id=test_location.id,
            status="AVAILABLE",
            condition="NEW"
        )
        session.add(test_inv_unit)
        await session.commit()
        print_test("Inventory", "Creating inventory unit", "PASSED")
        
        # Test Stock Level
        print_test("Inventory", "Creating stock level", "TESTING")
        test_stock = StockLevel(
            item_id=test_item.id,
            location_id=test_location.id,
            quantity_on_hand=100,
            quantity_available=100,
            quantity_reserved=0,
            reorder_point=10,
            reorder_quantity=50
        )
        session.add(test_stock)
        await session.commit()
        print_test("Inventory", "Creating stock level", "PASSED")
        
        # Update stock levels
        print_test("Inventory", "Updating stock levels", "TESTING")
        test_stock.quantity_reserved = 10
        test_stock.quantity_available = 90
        await session.commit()
        print_test("Inventory", "Updating stock levels", "PASSED")
        
        # Cleanup
        await session.delete(test_inv_unit)
        await session.delete(test_stock)
        await session.delete(test_item)
        await session.delete(test_location)
        await session.commit()
        print_test("Inventory", "Cleanup", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Inventory", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_transaction_models(session):
    """Test Transaction models"""
    print_section("Testing Transaction Models")
    
    try:
        # Create required data
        test_customer = Customer(
            name="Transaction Test Customer",
            code=f"TRX_CUST_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )
        test_item = Item(
            name="Transaction Test Item",
            sku=f"TRX_SKU_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )
        session.add_all([test_customer, test_item])
        await session.commit()
        
        # Test Transaction Header
        print_test("Transaction", "Creating transaction header", "TESTING")
        test_header = TransactionHeader(
            transaction_number=f"TRX_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            transaction_type="RENTAL",
            transaction_date=datetime.now(),
            customer_id=test_customer.id,
            status="DRAFT",
            total_amount=100.00
        )
        session.add(test_header)
        await session.commit()
        print_test("Transaction", "Creating transaction header", "PASSED")
        
        # Test Transaction Line
        print_test("Transaction", "Creating transaction line", "TESTING")
        test_line = TransactionLine(
            transaction_header_id=test_header.id,
            item_id=test_item.id,
            quantity=5,
            unit_price=20.00,
            line_total=100.00,
            line_number=1
        )
        session.add(test_line)
        await session.commit()
        print_test("Transaction", "Creating transaction line", "PASSED")
        
        # Update transaction
        print_test("Transaction", "Updating transaction status", "TESTING")
        test_header.status = "CONFIRMED"
        await session.commit()
        print_test("Transaction", "Updating transaction status", "PASSED")
        
        # Cleanup
        await session.delete(test_line)
        await session.delete(test_header)
        await session.delete(test_item)
        await session.delete(test_customer)
        await session.commit()
        print_test("Transaction", "Cleanup", "PASSED")
        
        return True
        
    except Exception as e:
        print_test("Transaction", f"Error: {str(e)}", "FAILED")
        await session.rollback()
        return False


async def test_database_statistics(session):
    """Get and display database statistics"""
    print_section("Database Statistics")
    
    try:
        stats = {}
        
        # Count records in each major table
        tables = [
            ('Users', User),
            ('Companies', Company),
            ('Categories', Category),
            ('Brands', Brand),
            ('Items', Item),
            ('Customers', Customer),
            ('Suppliers', Supplier),
            ('Transactions', TransactionHeader),
            ('Roles', Role),
            ('Permissions', Permission)
        ]
        
        for table_name, model in tables:
            result = await session.execute(select(func.count()).select_from(model))
            count = result.scalar()
            stats[table_name] = count
            print(f"  {table_name}: {count} records")
        
        return stats
        
    except Exception as e:
        print(f"  Error getting statistics: {str(e)}")
        return {}


async def main():
    """Main test execution"""
    print(f"\n{Colors.BOLD}{'='*60}")
    print("COMPREHENSIVE CRUD OPERATIONS TEST")
    print(f"{'='*60}{Colors.ENDC}")
    print(f"Started at: {datetime.now().isoformat()}")
    
    results = {
        'passed': [],
        'failed': []
    }
    
    async with AsyncSessionLocal() as session:
        # Run all tests
        tests = [
            ('Authentication & RBAC', test_auth_models),
            ('Company', test_company_model),
            ('Master Data', test_master_data_models),
            ('Business Partners', test_business_partners),
            ('Inventory', test_inventory_models),
            ('Transactions', test_transaction_models)
        ]
        
        for test_name, test_func in tests:
            try:
                if await test_func(session):
                    results['passed'].append(test_name)
                else:
                    results['failed'].append(test_name)
            except Exception as e:
                print(f"{Colors.FAIL}Unexpected error in {test_name}: {str(e)}{Colors.ENDC}")
                results['failed'].append(test_name)
        
        # Get database statistics
        stats = await test_database_statistics(session)
    
    # Print summary
    print(f"\n{Colors.BOLD}{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}{Colors.ENDC}")
    
    total_tests = len(results['passed']) + len(results['failed'])
    
    if results['passed']:
        print(f"{Colors.GREEN}✓ PASSED ({len(results['passed'])}/{total_tests}):{Colors.ENDC}")
        for test in results['passed']:
            print(f"  • {test}")
    
    if results['failed']:
        print(f"{Colors.FAIL}✗ FAILED ({len(results['failed'])}/{total_tests}):{Colors.ENDC}")
        for test in results['failed']:
            print(f"  • {test}")
    
    # Final verdict
    print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
    if not results['failed']:
        print(f"{Colors.GREEN}{Colors.BOLD}ALL TESTS PASSED! ✓{Colors.ENDC}")
        print("Database CRUD operations are working correctly.")
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}SOME TESTS FAILED! ✗{Colors.ENDC}")
        print("Please review the failed tests above.")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    
    return len(results['failed']) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)