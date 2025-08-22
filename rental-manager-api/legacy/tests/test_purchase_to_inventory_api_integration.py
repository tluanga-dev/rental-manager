"""
Comprehensive End-to-End Test: Purchase Transaction API to Inventory Stock API Integration

This test suite verifies that:
1. Purchase transactions can be created via the API endpoint
2. The inventory stock data is properly updated and reflected in the inventory API
3. The complete flow from purchase creation to inventory verification works correctly

Tests cover:
- Creating purchase transactions via API
- Verifying inventory stock levels are updated
- Testing both serialized and non-serialized items
- Validating stock movements and audit trails
- Testing error scenarios and data consistency
"""

import pytest
import pytest_asyncio
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from typing import List, Dict, Any
import time

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.transactions.purchase.service import PurchaseService
from app.modules.transactions.purchase.schemas import NewPurchaseRequest, PurchaseItemCreate
from app.modules.transactions.purchase.routes import router as purchase_router
from app.modules.inventory.routes import router as inventory_router
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType, TransactionStatus
from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
from app.modules.inventory.enums import MovementType, InventoryUnitStatus, InventoryUnitCondition
from app.modules.suppliers.models import Supplier, SupplierType
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement
from app.core.errors import NotFoundError, ValidationError
from app.shared.dependencies import get_session


@pytest.mark.asyncio
class TestPurchaseToInventoryIntegration:
    """End-to-end test for Purchase API to Inventory Stock API integration."""

    @pytest_asyncio.fixture
    async def test_app(self, db_session: AsyncSession):
        """Create a minimal test FastAPI app with only the routes we need."""
        app = FastAPI()
        
        # Override database dependency for testing
        def get_test_session():
            return db_session
        
        app.dependency_overrides[get_session] = get_test_session
        
        # Include only the routers we need for testing
        app.include_router(purchase_router, prefix="/api/transactions/purchases", tags=["purchases"])
        app.include_router(inventory_router, prefix="/api/inventory", tags=["inventory"])
        
        return app

    @pytest_asyncio.fixture
    async def setup_integration_test_data(self, db_session: AsyncSession):
        """Set up comprehensive test data for integration testing."""
        
        # Create Brand
        brand = Brand(
            name="Integration Test Brand",
            code="ITB001",
            description="Brand for integration testing"
        )
        db_session.add(brand)
        await db_session.flush()

        # Create Category
        category = Category(
            name="Integration Test Category",
            category_code="INT-TEST"
        )
        db_session.add(category)
        await db_session.flush()

        # Create Unit of Measurement
        uom = UnitOfMeasurement(
            name="Piece",
            code="PCS",
            description="Individual pieces"
        )
        db_session.add(uom)
        await db_session.flush()

        # Create Supplier
        supplier = Supplier(
            supplier_code="INT-SUP001",
            company_name="Integration Test Supplier",
            supplier_type=SupplierType.DISTRIBUTOR,
            contact_person="John Integration",
            email="integration@test.com",
            phone="+1234567890",
            address_line1="123 Integration St"
        )
        db_session.add(supplier)
        await db_session.flush()

        # Create Location
        location = Location(
            location_code="INT-LOC001",
            location_name="Integration Test Warehouse",
            location_type=LocationType.WAREHOUSE,
            address="123 Integration Warehouse St",
            city="Integration City",
            state="Integration State",
            country="Integration Country"
        )
        db_session.add(location)
        await db_session.flush()

        # Create Serialized Item
        serialized_item = Item(
            sku="INT-SERIAL001",
            item_name="Integration Serialized Test Item",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=True,
            purchase_price=Decimal("150.00"),
            sale_price=Decimal("225.00"),
            security_deposit=Decimal("75.00"),
            reorder_point=5,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(serialized_item)
        await db_session.flush()

        # Create Non-Serialized Item (rentable only - cannot be both rentable and saleable)
        non_serialized_item = Item(
            sku="INT-NONSRL001",
            item_name="Integration Non-Serialized Test Item",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=False,
            purchase_price=Decimal("35.00"),
            sale_price=Decimal("55.00"),
            security_deposit=Decimal("15.00"),
            reorder_point=20,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(non_serialized_item)
        await db_session.flush()

        await db_session.commit()

        return {
            "supplier": supplier,
            "location": location,
            "serialized_item": serialized_item,
            "non_serialized_item": non_serialized_item,
            "brand": brand,
            "category": category,
            "uom": uom
        }

    @pytest_asyncio.fixture
    async def async_client(self, test_app):
        """Create async HTTP client for testing."""
        async with AsyncClient(app=test_app, base_url="http://test") as client:
            yield client

    # ================================================================
    # CORE INTEGRATION TESTS
    # ================================================================

    async def test_purchase_api_to_inventory_stock_api_serialized_items(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession, 
        setup_integration_test_data
    ):
        """
        Test complete flow: Create purchase via API → Verify inventory via stock API.
        Tests serialized items (should create inventory units).
        """
        
        test_data = setup_integration_test_data
        
        # 1. VERIFY INITIAL STATE - No inventory should exist
        initial_inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert initial_inventory_response.status_code == 200
        initial_inventory_data = initial_inventory_response.json()
        
        # Should be empty or not contain our test items
        initial_serialized_stock = None
        for item in initial_inventory_data:
            if item.get("sku") == "INT-SERIAL001":
                initial_serialized_stock = item
                break
        
        # 2. CREATE PURCHASE TRANSACTION VIA API
        purchase_data = {
            "supplier_id": str(test_data["supplier"].id),
            "location_id": str(test_data["location"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "Integration test purchase - serialized items",
            "reference_number": "INT-PO-SERIAL-001",
            "items": [
                {
                    "item_id": str(test_data["serialized_item"].id),
                    "quantity": 4,  # Purchase 4 serialized units
                    "unit_cost": 150.00,
                    "tax_rate": 12.0,
                    "discount_amount": 10.00,
                    "condition": "A",
                    "notes": "Integration test serialized items",
                    "serial_numbers": ["SN-INT-SERIAL-001", "SN-INT-SERIAL-002", "SN-INT-SERIAL-003", "SN-INT-SERIAL-004"]
                }
            ]
        }
        
        # Execute purchase API call
        purchase_response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert purchase_response.status_code == 201
        
        purchase_result = purchase_response.json()
        assert purchase_result["success"] is True
        assert "transaction_id" in purchase_result
        assert "transaction_number" in purchase_result
        
        transaction_id = purchase_result["transaction_id"]
        
        # 3. VERIFY INVENTORY STOCK API REFLECTS CHANGES
        updated_inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert updated_inventory_response.status_code == 200
        updated_inventory_data = updated_inventory_response.json()
        
        # Find our serialized item in inventory data
        serialized_item_stock = None
        for item in updated_inventory_data:
            if item.get("sku") == "INT-SERIAL001":
                serialized_item_stock = item
                break
        
        assert serialized_item_stock is not None, "Serialized item should appear in inventory stock API"
        
        # Verify stock quantities
        stock = serialized_item_stock["stock"]
        assert stock["total"] == 4
        assert stock["available"] == 4
        assert stock["rented"] == 0
        
        # 4. VERIFY DATABASE RECORDS DIRECTLY
        # Check InventoryUnits were created
        unit_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        unit_result = await db_session.execute(unit_stmt)
        inventory_units = unit_result.scalars().all()
        
        assert len(inventory_units) == 4
        for i, unit in enumerate(inventory_units):
            assert unit.status == InventoryUnitStatus.AVAILABLE.value
            assert unit.condition == "NEW"
            assert unit.purchase_price == Decimal("150.00")
            assert unit.sku == f"INT-SERIAL001-{i+1:04d}"
        
        # Check StockLevel was created
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["serialized_item"].id),
            StockLevel.location_id == str(test_data["location"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()
        
        assert stock_level.quantity_on_hand == Decimal("4")
        assert stock_level.quantity_available == Decimal("4")
        assert stock_level.quantity_on_rent == Decimal("0")
        
        # Check StockMovement was created
        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["serialized_item"].id)
        )
        movement_result = await db_session.execute(movement_stmt)
        movement = movement_result.scalar_one()
        
        assert movement.movement_type == MovementType.PURCHASE.value
        assert movement.quantity_change == Decimal("4")
        assert movement.quantity_before == Decimal("0")
        assert movement.quantity_after == Decimal("4")

    async def test_purchase_api_to_inventory_stock_api_non_serialized_items(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession, 
        setup_integration_test_data
    ):
        """
        Test complete flow: Create purchase via API → Verify inventory via stock API.
        Tests non-serialized items (should NOT create inventory units).
        """
        
        test_data = setup_integration_test_data
        
        # 1. CREATE PURCHASE TRANSACTION VIA API
        purchase_data = {
            "supplier_id": str(test_data["supplier"].id),
            "location_id": str(test_data["location"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "Integration test purchase - non-serialized items",
            "reference_number": "INT-PO-NONSRL-001",
            "items": [
                {
                    "item_id": str(test_data["non_serialized_item"].id),
                    "quantity": 25,  # Purchase 25 non-serialized units
                    "unit_cost": 35.00,
                    "tax_rate": 8.0,
                    "discount_amount": 5.00,
                    "condition": "A",
                    "notes": "Integration test non-serialized items"
                }
            ]
        }
        
        # Execute purchase API call
        purchase_response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert purchase_response.status_code == 201
        
        purchase_result = purchase_response.json()
        assert purchase_result["success"] is True
        
        transaction_id = purchase_result["transaction_id"]
        
        # 2. VERIFY INVENTORY STOCK API REFLECTS CHANGES
        inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert inventory_response.status_code == 200
        inventory_data = inventory_response.json()
        
        # Find our non-serialized item in inventory data
        non_serialized_item_stock = None
        for item in inventory_data:
            if item.get("sku") == "INT-NONSRL001":
                non_serialized_item_stock = item
                break
        
        assert non_serialized_item_stock is not None, "Non-serialized item should appear in inventory stock API"
        
        # Verify stock quantities
        stock = non_serialized_item_stock["stock"]
        assert stock["total"] == 25
        assert stock["available"] == 25
        assert stock["rented"] == 0
        
        # 3. VERIFY DATABASE RECORDS DIRECTLY
        # Check NO InventoryUnits were created (non-serialized)
        unit_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["non_serialized_item"].id)
        )
        unit_result = await db_session.execute(unit_stmt)
        inventory_units = unit_result.scalars().all()
        
        assert len(inventory_units) == 0, "No inventory units should be created for non-serialized items"
        
        # Check StockLevel was created
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["non_serialized_item"].id),
            StockLevel.location_id == str(test_data["location"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()
        
        assert stock_level.quantity_on_hand == Decimal("25")
        assert stock_level.quantity_available == Decimal("25")
        assert stock_level.quantity_on_rent == Decimal("0")

    async def test_purchase_api_to_inventory_stock_api_mixed_items(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession, 
        setup_integration_test_data
    ):
        """
        Test complete flow with mixed item types in single purchase.
        Verifies both serialized and non-serialized items in one transaction.
        """
        
        test_data = setup_integration_test_data
        
        # 1. CREATE PURCHASE WITH MIXED ITEMS VIA API
        purchase_data = {
            "supplier_id": str(test_data["supplier"].id),
            "location_id": str(test_data["location"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "Integration test purchase - mixed item types",
            "reference_number": "INT-PO-MIXED-001",
            "items": [
                {
                    "item_id": str(test_data["serialized_item"].id),
                    "quantity": 3,  # 3 serialized units
                    "unit_cost": 150.00,
                    "tax_rate": 10.0,
                    "discount_amount": 5.00,
                    "condition": "A",
                    "notes": "Serialized items in mixed purchase",
                    "serial_numbers": ["SN-INT-MIXED-001", "SN-INT-MIXED-002", "SN-INT-MIXED-003"]
                },
                {
                    "item_id": str(test_data["non_serialized_item"].id),
                    "quantity": 20,  # 20 non-serialized units
                    "unit_cost": 35.00,
                    "tax_rate": 8.0,
                    "discount_amount": 10.00,
                    "condition": "A",
                    "notes": "Non-serialized items in mixed purchase"
                }
            ]
        }
        
        # Execute purchase API call
        purchase_response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert purchase_response.status_code == 201
        
        purchase_result = purchase_response.json()
        assert purchase_result["success"] is True
        
        # 2. VERIFY INVENTORY STOCK API REFLECTS BOTH ITEMS
        inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert inventory_response.status_code == 200
        inventory_data = inventory_response.json()
        
        # Find both items in inventory data
        serialized_stock = None
        non_serialized_stock = None
        
        for item in inventory_data:
            if item.get("sku") == "INT-SERIAL001":
                serialized_stock = item
            elif item.get("sku") == "INT-NONSRL001":
                non_serialized_stock = item
        
        # Verify both items appear in inventory
        assert serialized_stock is not None, "Serialized item should appear in inventory"
        assert non_serialized_stock is not None, "Non-serialized item should appear in inventory"
        
        # Verify serialized item stock
        serialized_stock_data = serialized_stock["stock"]
        assert serialized_stock_data["total"] == 3
        assert serialized_stock_data["available"] == 3
        assert serialized_stock_data["rented"] == 0

        # Verify non-serialized item stock
        non_serialized_stock_data = non_serialized_stock["stock"]
        assert non_serialized_stock_data["total"] == 20
        assert non_serialized_stock_data["available"] == 20
        assert non_serialized_stock_data["rented"] == 0        # 3. VERIFY INVENTORY UNITS CREATED CORRECTLY
        # Serialized item should have 3 units
        serialized_units_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        serialized_units_result = await db_session.execute(serialized_units_stmt)
        serialized_units = serialized_units_result.scalars().all()
        
        assert len(serialized_units) == 3
        
        # Non-serialized item should have NO units
        non_serialized_units_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["non_serialized_item"].id)
        )
        non_serialized_units_result = await db_session.execute(non_serialized_units_stmt)
        non_serialized_units = non_serialized_units_result.scalars().all()
        
        assert len(non_serialized_units) == 0

    async def test_purchase_api_error_inventory_consistency(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession, 
        setup_integration_test_data
    ):
        """
        Test that failed purchase API calls don't corrupt inventory data.
        Verifies transaction rollback maintains data consistency.
        """
        
        test_data = setup_integration_test_data
        
        # 1. GET INITIAL INVENTORY STATE
        initial_inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert initial_inventory_response.status_code == 200
        initial_inventory_data = initial_inventory_response.json()
        
        # 2. ATTEMPT PURCHASE WITH INVALID DATA (should fail)
        invalid_purchase_data = {
            "supplier_id": str(uuid4()),  # Invalid supplier ID
            "location_id": str(test_data["location"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "This should fail",
            "reference_number": "INT-PO-FAIL-001",
            "items": [
                {
                    "item_id": str(test_data["serialized_item"].id),
                    "quantity": 5,
                    "unit_cost": 150.00,
                    "condition": "A",
                    "notes": "Should not be created"
                }
            ]
        }
        
        # This should fail with 404
        failed_purchase_response = await async_client.post("/api/transactions/purchases/new", json=invalid_purchase_data)
        assert failed_purchase_response.status_code == 404
        
        # 3. VERIFY INVENTORY REMAINS UNCHANGED
        after_fail_inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert after_fail_inventory_response.status_code == 200
        after_fail_inventory_data = after_fail_inventory_response.json()
        
        # Should be identical to initial state
        assert len(after_fail_inventory_data) == len(initial_inventory_data)
        
        # 4. VERIFY NO PARTIAL DATABASE RECORDS WERE CREATED
        # No transaction should exist
        tx_count_stmt = select(func.count(TransactionHeader.id))
        tx_count_result = await db_session.execute(tx_count_stmt)
        tx_count = tx_count_result.scalar()
        assert tx_count == 0
        
        # No stock levels should exist
        stock_count_stmt = select(func.count(StockLevel.id))
        stock_count_result = await db_session.execute(stock_count_stmt)
        stock_count = stock_count_result.scalar()
        assert stock_count == 0
        
        # No inventory units should exist
        unit_count_stmt = select(func.count(InventoryUnit.id))
        unit_count_result = await db_session.execute(unit_count_stmt)
        unit_count = unit_count_result.scalar()
        assert unit_count == 0

    async def test_inventory_api_data_format_validation(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession, 
        setup_integration_test_data
    ):
        """
        Test that inventory stock API returns data in the expected format.
        Validates response schema and data types.
        """
        
        test_data = setup_integration_test_data
        
        # Create purchase to ensure we have data
        purchase_data = {
            "supplier_id": str(test_data["supplier"].id),
            "location_id": str(test_data["location"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "Format validation test",
            "reference_number": "INT-PO-FORMAT-001",
            "items": [
                {
                    "item_id": str(test_data["serialized_item"].id),
                    "quantity": 3,
                    "unit_cost": 150.00,
                    "condition": "A",
                    "notes": "Format test items",
                    "serial_numbers": ["SN-INT-FORMAT-001", "SN-INT-FORMAT-002", "SN-INT-FORMAT-003"]
                }
            ]
        }
        
        purchase_response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert purchase_response.status_code == 201
        
        # Get inventory data
        inventory_response = await async_client.get("/api/inventory/stocks_info_all_items_brief")
        assert inventory_response.status_code == 200
        inventory_data = inventory_response.json()
        
        # Validate response is a list
        assert isinstance(inventory_data, list)
        assert len(inventory_data) > 0
        
        # Find our test item
        test_item_stock = None
        for item in inventory_data:
            if item.get("sku") == "INT-SERIAL001":
                test_item_stock = item
                break

        assert test_item_stock is not None

        # Validate required fields exist
        required_fields = [
            "sku", "item_name", "item_status", "category", 
            "unit_of_measurement", "stock"
        ]

        for field in required_fields:
            assert field in test_item_stock, f"Missing required field: {field}"

        # Validate stock field structure
        stock = test_item_stock["stock"]
        assert isinstance(stock, dict), "Stock should be a dictionary"
        
        stock_fields = ["total", "available", "rented", "status"]
        for field in stock_fields:
            assert field in stock, f"Missing stock field: {field}"

        # Validate data types
        assert isinstance(test_item_stock["sku"], str)
        assert isinstance(test_item_stock["item_name"], str)
        assert isinstance(test_item_stock["item_status"], str)
        assert isinstance(stock["total"], int)
        assert isinstance(stock["available"], int)
        assert isinstance(stock["rented"], int)
        assert isinstance(stock["status"], str)

        # Validate stock values make sense
        assert stock["total"] >= 0
        assert stock["available"] >= 0
        assert stock["rented"] >= 0
        assert stock["total"] >= stock["available"] + stock["rented"]
        assert stock["status"] in ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]

        # For our test item, we purchased 3, so we should have 3 total and 3 available
        assert stock["total"] == 3, f"Expected 3 total stock, got {stock['total']}"
        assert stock["available"] == 3, f"Expected 3 available stock, got {stock['available']}"
        assert stock["rented"] == 0, f"Expected 0 rented stock, got {stock['rented']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
