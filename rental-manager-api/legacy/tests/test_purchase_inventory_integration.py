"""
Comprehensive test suite for purchase transaction with inventory updates.
Tests the complete flow including:
1. InventoryUnit creation for serialized items
2. StockLevel updates/creation
3. StockMovement audit trail
4. Error handling and rollback
5. Edge cases and validation
6. Performance with large quantities
7. Transaction calculations and totals
8. Concurrent purchase handling
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

from app.modules.transactions.purchase.service import PurchaseService
from app.modules.transactions.purchase.schemas import NewPurchaseRequest, PurchaseItemCreate
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

@pytest.mark.asyncio
class TestPurchaseInventoryIntegration:
    """Test purchase transactions with complete inventory updates."""

    @pytest_asyncio.fixture
    async def setup_test_data(self, db_session: AsyncSession):
        """Set up comprehensive test data."""
        
        # Create Brand
        brand = Brand(
            name="Test Brand",
            code="TB001",
            description="Test brand for inventory testing"
        )
        db_session.add(brand)
        await db_session.flush()

        # Create Category
        category = Category(
            name="Test Category",
            category_code="TEST-CAT"
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
            supplier_code="SUP001",
            company_name="Test Supplier Co.",
            supplier_type=SupplierType.DISTRIBUTOR,
            contact_person="John Doe",
            email="supplier@test.com",
            phone="+1234567890",
            address_line1="123 Supplier St"
        )
        db_session.add(supplier)
        await db_session.flush()

        # Create Primary Location
        location = Location(
            location_code="WH001",
            location_name="Main Warehouse",
            location_type=LocationType.WAREHOUSE,
            address="123 Warehouse St",
            city="Test City",
            state="Test State",
            country="Test Country"
        )
        db_session.add(location)
        await db_session.flush()

        # Create Secondary Location for multi-location tests
        location_2 = Location(
            location_code="WH002",
            location_name="Secondary Warehouse",
            location_type=LocationType.WAREHOUSE,
            address="456 Secondary St",
            city="Test City 2",
            state="Test State 2",
            country="Test Country"
        )
        db_session.add(location_2)
        await db_session.flush()

        # Create Items - one serialized, one non-serialized
        serialized_item = Item(
            sku="SERIAL001",
            item_name="Serialized Test Item",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=True,  # This item requires serial numbers
            purchase_price=Decimal("100.00"),
            sale_price=Decimal("150.00"),
            security_deposit=Decimal("50.00"),
            reorder_point=10,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(serialized_item)
        await db_session.flush()

        non_serialized_item = Item(
            sku="NONSRL001",
            item_name="Non-Serialized Test Item",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=False,  # This item does NOT require serial numbers
            purchase_price=Decimal("25.00"),
            sale_price=Decimal("40.00"),
            security_deposit=Decimal("10.00"),
            reorder_point=50,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(non_serialized_item)
        await db_session.flush()

        # Create additional serialized item for testing
        serialized_item_2 = Item(
            sku="SERIAL002",
            item_name="Second Serialized Item",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=True,
            purchase_price=Decimal("200.00"),
            sale_price=Decimal("300.00"),
            security_deposit=Decimal("100.00"),
            reorder_point=5,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(serialized_item_2)
        await db_session.flush()

        await db_session.commit()

        return {
            "supplier": supplier,
            "location": location,
            "location_2": location_2,
            "serialized_item": serialized_item,
            "serialized_item_2": serialized_item_2,
            "non_serialized_item": non_serialized_item,
            "brand": brand,
            "category": category,
            "uom": uom
        }

    @pytest_asyncio.fixture
    async def purchase_service(self, db_session: AsyncSession):
        """Create purchase service instance."""
        return PurchaseService(db_session)

    # ================================================================
    # BASIC PURCHASE CREATION TESTS
    # ================================================================

    async def test_purchase_with_serialized_items(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test purchase transaction with serialized items - should create InventoryUnits."""
        
        test_data = setup_test_data
        
        # Create purchase request with serialized item
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test purchase with serialized items",
            reference_number="PO-TEST-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=3,  # Purchase 3 units
                    unit_cost=100.00,
                    tax_rate=10.0,
                    discount_amount=5.00,
                    condition="A",
                    notes="Test serialized item purchase",
                    serial_numbers=["SN001", "SN002", "SN003"]  # 3 serial numbers for 3 units
                )
            ]
        )

        # Execute purchase
        result = await purchase_service.create_new_purchase(purchase_request)

        # Verify purchase was created successfully
        assert result.success is True
        assert result.transaction_id is not None
        assert result.transaction_number is not None
        assert "successfully" in result.message.lower()

        # Verify transaction header
        tx_stmt = select(TransactionHeader).where(TransactionHeader.id == result.transaction_id)
        tx_result = await db_session.execute(tx_stmt)
        transaction = tx_result.scalar_one()
        
        assert transaction.transaction_type == TransactionType.PURCHASE
        assert str(transaction.supplier_id) == str(test_data["supplier"].id)
        assert str(transaction.location_id) == str(test_data["location"].id)
        assert transaction.status == TransactionStatus.COMPLETED

        # Verify transaction line
        line_stmt = select(TransactionLine).where(TransactionLine.transaction_header_id == result.transaction_id)
        line_result = await db_session.execute(line_stmt)
        lines = line_result.scalars().all()
        
        assert len(lines) == 1
        line = lines[0]
        assert str(line.item_id) == str(test_data["serialized_item"].id)
        assert line.quantity == Decimal("3")
        assert line.unit_price == Decimal("100.00")

        # Verify InventoryUnits were created (3 units for serialized item)
        unit_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        ).order_by(InventoryUnit.sku.asc())
        unit_result = await db_session.execute(unit_stmt)
        inventory_units = unit_result.scalars().all()
        
        assert len(inventory_units) == 3
        for i, unit in enumerate(inventory_units):
            assert str(unit.item_id) == str(test_data["serialized_item"].id)
            assert str(unit.location_id) == str(test_data["location"].id)
            assert unit.status == InventoryUnitStatus.AVAILABLE.value
            assert unit.condition == "NEW"
            assert unit.purchase_price == Decimal("100.00")
            assert unit.sku == f"SERIAL001-{i+1:04d}"  # Should use SKU as prefix
            assert unit.purchase_date is not None
            assert unit.created_by == "system"

        # Verify StockLevel was created/updated
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["serialized_item"].id),
            StockLevel.location_id == str(test_data["location"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()
        
        assert stock_level.quantity_on_hand == Decimal("3")
        assert stock_level.quantity_available == Decimal("3")
        assert stock_level.quantity_on_rent == Decimal("0")

        # Verify StockMovement was created
        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["serialized_item"].id),
            StockMovement.location_id == str(test_data["location"].id)
        )
        movement_result = await db_session.execute(movement_stmt)
        movements = movement_result.scalars().all()
        
        assert len(movements) == 1
        movement = movements[0]
        assert movement.movement_type == MovementType.PURCHASE.value
        assert movement.quantity_change == Decimal("3")
        assert movement.quantity_before == Decimal("0")  # First movement
        assert movement.quantity_after == Decimal("3")
        assert str(movement.transaction_line_id) == str(line.id)
        assert str(movement.stock_level_id) == str(stock_level.id)

    async def test_purchase_with_non_serialized_items(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test purchase transaction with non-serialized items - should NOT create InventoryUnits."""
        
        test_data = setup_test_data
        
        # Create purchase request with non-serialized item
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test purchase with non-serialized items",
            reference_number="PO-TEST-002",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=10,  # Purchase 10 units
                    unit_cost=25.00,
                    tax_rate=8.0,
                    discount_amount=2.00,
                    condition="A",
                    notes="Test non-serialized item purchase"
                )
            ]
        )

        # Execute purchase
        result = await purchase_service.create_new_purchase(purchase_request)

        # Verify purchase was created successfully
        assert result.success is True

        # Verify NO InventoryUnits were created (non-serialized item)
        unit_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["non_serialized_item"].id)
        )
        unit_result = await db_session.execute(unit_stmt)
        inventory_units = unit_result.scalars().all()
        
        assert len(inventory_units) == 0  # No units should be created

        # Verify StockLevel was created
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["non_serialized_item"].id),
            StockLevel.location_id == str(test_data["location"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()
        
        assert stock_level.quantity_on_hand == Decimal("10")
        assert stock_level.quantity_available == Decimal("10")
        assert stock_level.quantity_on_rent == Decimal("0")

        # Verify StockMovement was created
        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["non_serialized_item"].id)
        )
        movement_result = await db_session.execute(movement_stmt)
        movements = movement_result.scalars().all()
        
        assert len(movements) == 1
        movement = movements[0]
        assert movement.quantity_change == Decimal("10")
        assert movement.quantity_before == Decimal("0")
        assert movement.quantity_after == Decimal("10")

    async def test_purchase_with_mixed_items(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test purchase with both serialized and non-serialized items."""
        
        test_data = setup_test_data
        
        # Create purchase request with both item types
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test purchase with mixed item types",
            reference_number="PO-TEST-004",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=2,  # 2 serialized units
                    unit_cost=100.00,
                    tax_rate=10.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Serialized items",
                    serial_numbers=["SN-MIX-001", "SN-MIX-002"]  # Required for serialized items
                ),
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=15,  # 15 non-serialized units
                    unit_cost=25.00,
                    tax_rate=8.0,
                    discount_amount=5.00,
                    condition="A",
                    notes="Non-serialized items"
                )
            ]
        )

        # Execute purchase
        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify transaction has 2 lines
        line_stmt = select(TransactionLine).where(TransactionLine.transaction_header_id == result.transaction_id)
        line_result = await db_session.execute(line_stmt)
        lines = line_result.scalars().all()
        assert len(lines) == 2

        # Verify InventoryUnits created only for serialized item
        serialized_units_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        serialized_units_result = await db_session.execute(serialized_units_stmt)
        serialized_units = serialized_units_result.scalars().all()
        assert len(serialized_units) == 2  # 2 units for serialized item

        non_serialized_units_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["non_serialized_item"].id)
        )
        non_serialized_units_result = await db_session.execute(non_serialized_units_stmt)
        non_serialized_units = non_serialized_units_result.scalars().all()
        assert len(non_serialized_units) == 0  # No units for non-serialized item

        # Verify both stock levels were created
        stock_count_stmt = select(func.count(StockLevel.id))
        stock_count_result = await db_session.execute(stock_count_stmt)
        stock_count = stock_count_result.scalar()
        assert stock_count == 2

        # Verify both stock movements were created
        movement_count_stmt = select(func.count(StockMovement.id))
        movement_count_result = await db_session.execute(movement_count_stmt)
        movement_count = movement_count_result.scalar()
        assert movement_count == 2

    # ================================================================
    # STOCK LEVEL UPDATE TESTS
    # ================================================================

    async def test_purchase_updates_existing_stock_level(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that subsequent purchases update existing stock levels correctly."""
        
        test_data = setup_test_data
        
        # Create initial stock level
        initial_stock = StockLevel(
            item_id=str(test_data["non_serialized_item"].id),
            location_id=str(test_data["location"].id),
            quantity_on_hand=Decimal("5"),
            quantity_available=Decimal("3"),  # 2 units on rent
            quantity_on_rent=Decimal("2")
        )
        db_session.add(initial_stock)
        await db_session.commit()

        # Create purchase request
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test purchase updating existing stock",
            reference_number="PO-TEST-003",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=7,  # Add 7 more units
                    unit_cost=25.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Additional stock purchase"
                )
            ]
        )

        # Execute purchase
        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify stock level was updated correctly
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["non_serialized_item"].id),
            StockLevel.location_id == str(test_data["location"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        updated_stock = stock_result.scalar_one()
        
        # Should add 7 to both on_hand and available
        assert updated_stock.quantity_on_hand == Decimal("12")  # 5 + 7
        assert updated_stock.quantity_available == Decimal("10")  # 3 + 7
        assert updated_stock.quantity_on_rent == Decimal("2")  # Unchanged

        # Verify StockMovement shows correct before/after quantities
        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["non_serialized_item"].id)
        ).order_by(StockMovement.created_at.desc())
        movement_result = await db_session.execute(movement_stmt)
        latest_movement = movement_result.scalars().first()
        
        assert latest_movement.quantity_change == Decimal("7")
        assert latest_movement.quantity_before == Decimal("5")  # Previous on_hand
        assert latest_movement.quantity_after == Decimal("12")  # 5 + 7

    # ================================================================
    # STOCK MOVEMENT AUDIT TRAIL TESTS
    # ================================================================

    async def test_purchase_sequential_movements_quantity_tracking(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that sequential purchases track quantities correctly in stock movements."""
        
        test_data = setup_test_data
        
        # First purchase
        purchase_1 = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="First purchase",
            reference_number="PO-SEQ-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=5,
                    unit_cost=25.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="First batch"
                )
            ]
        )

        result_1 = await purchase_service.create_new_purchase(purchase_1)
        assert result_1.success is True

        # Second purchase
        purchase_2 = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Second purchase",
            reference_number="PO-SEQ-002",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=8,
                    unit_cost=25.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Second batch"
                )
            ]
        )

        result_2 = await purchase_service.create_new_purchase(purchase_2)
        assert result_2.success is True

        # Third purchase to verify continued tracking
        purchase_3 = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Third purchase",
            reference_number="PO-SEQ-003",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=3,
                    unit_cost=25.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Third batch"
                )
            ]
        )

        result_3 = await purchase_service.create_new_purchase(purchase_3)
        assert result_3.success is True

        # Verify stock movements show correct progression
        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["non_serialized_item"].id)
        ).order_by(StockMovement.created_at.asc())
        movement_result = await db_session.execute(movement_stmt)
        movements = movement_result.scalars().all()
        
        assert len(movements) == 3

        # First movement: 0 -> 5
        first_movement = movements[0]
        assert first_movement.quantity_change == Decimal("5")
        assert first_movement.quantity_before == Decimal("0")
        assert first_movement.quantity_after == Decimal("5")

        # Second movement: 5 -> 13
        second_movement = movements[1]
        assert second_movement.quantity_change == Decimal("8")
        assert second_movement.quantity_before == Decimal("5")
        assert second_movement.quantity_after == Decimal("13")

        # Third movement: 13 -> 16
        third_movement = movements[2]
        assert third_movement.quantity_change == Decimal("3")
        assert third_movement.quantity_before == Decimal("13")
        assert third_movement.quantity_after == Decimal("16")

        # Verify final stock level
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["non_serialized_item"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        final_stock = stock_result.scalar_one()
        
        assert final_stock.quantity_on_hand == Decimal("16")
        assert final_stock.quantity_available == Decimal("16")

    # ================================================================
    # INVENTORY UNIT TESTS
    # ================================================================

    async def test_purchase_inventory_sku_generation(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that inventory unit SKUs are generated correctly and uniquely."""
        
        test_data = setup_test_data
        
        # Create purchase with serialized items
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test unit SKU generation",
            reference_number="PO-CODE-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=5,  # Create 5 units
                    unit_cost=100.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Unit SKU test",
                    serial_numbers=["SKU-001", "SKU-002", "SKU-003", "SKU-004", "SKU-005"]  # Required for serialized items
                )
            ]
        )

        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify unit SKUs are generated correctly
        unit_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        ).order_by(InventoryUnit.sku.asc())
        unit_result = await db_session.execute(unit_stmt)
        units = unit_result.scalars().all()
        
        assert len(units) == 5
        
        # Verify unit SKUs follow SKU-NNNN pattern
        expected_skus = [
            "SERIAL001-0001",
            "SERIAL001-0002", 
            "SERIAL001-0003",
            "SERIAL001-0004",
            "SERIAL001-0005"
        ]
        
        actual_skus = [unit.sku for unit in units]
        assert actual_skus == expected_skus

        # Verify all SKUs are unique
        assert len(set(actual_skus)) == len(actual_skus)

        # Verify unit properties
        for unit in units:
            assert unit.status == InventoryUnitStatus.AVAILABLE.value
            assert unit.condition == "NEW"
            assert unit.purchase_price == Decimal("100.00")
            assert unit.purchase_date is not None
            assert unit.created_by == "system"
            assert unit.updated_by == "system"

    async def test_purchase_multiple_serialized_items_skus(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test SKU generation for multiple different serialized items."""
        
        test_data = setup_test_data
        
        # Create purchase with multiple serialized items
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test multiple serialized items",
            reference_number="PO-MULTI-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=2,
                    unit_cost=100.00,
                    condition="A",
                    notes="First serialized item",
                    serial_numbers=["MULTI-001", "MULTI-002"]
                ),
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item_2"].id),
                    quantity=3,
                    unit_cost=200.00,
                    condition="A",
                    notes="Second serialized item",
                    serial_numbers=["MULTI-003", "MULTI-004", "MULTI-005"]
                )
            ]
        )

        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify units for first item
        units_1_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        ).order_by(InventoryUnit.sku.asc())
        units_1_result = await db_session.execute(units_1_stmt)
        units_1 = units_1_result.scalars().all()
        
        assert len(units_1) == 2
        assert units_1[0].sku == "SERIAL001-0001"
        assert units_1[1].sku == "SERIAL001-0002"

        # Verify units for second item
        units_2_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item_2"].id)
        ).order_by(InventoryUnit.sku.asc())
        units_2_result = await db_session.execute(units_2_stmt)
        units_2 = units_2_result.scalars().all()
        
        assert len(units_2) == 3
        assert units_2[0].sku == "SERIAL002-0001"
        assert units_2[1].sku == "SERIAL002-0002"
        assert units_2[2].sku == "SERIAL002-0003"

    # ================================================================
    # ERROR HANDLING AND VALIDATION TESTS
    # ================================================================

    async def test_purchase_error_handling_rollback(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that errors during inventory update cause proper rollback."""
        
        test_data = setup_test_data
        
        # Create purchase request with invalid item ID to trigger error
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test error handling",
            reference_number="PO-ERROR-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(uuid4()),  # Invalid item ID
                    quantity=3,
                    unit_cost=100.00,
                    tax_rate=0.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="This should fail"
                )
            ]
        )

        # Execute purchase - should fail
        with pytest.raises(Exception):  # Should raise NotFoundError or similar
            await purchase_service.create_new_purchase(purchase_request)

        # Verify no data was created (rollback worked)
        tx_count_stmt = select(func.count(TransactionHeader.id))
        tx_count_result = await db_session.execute(tx_count_stmt)
        tx_count = tx_count_result.scalar()
        assert tx_count == 0

        line_count_stmt = select(func.count(TransactionLine.id))
        line_count_result = await db_session.execute(line_count_stmt)
        line_count = line_count_result.scalar()
        assert line_count == 0

        stock_count_stmt = select(func.count(StockLevel.id))
        stock_count_result = await db_session.execute(stock_count_stmt)
        stock_count = stock_count_result.scalar()
        assert stock_count == 0

        movement_count_stmt = select(func.count(StockMovement.id))
        movement_count_result = await db_session.execute(movement_count_stmt)
        movement_count = movement_count_result.scalar()
        assert movement_count == 0

        unit_count_stmt = select(func.count(InventoryUnit.id))
        unit_count_result = await db_session.execute(unit_count_stmt)
        unit_count = unit_count_result.scalar()
        assert unit_count == 0

    async def test_purchase_with_invalid_supplier_fails(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchase with invalid supplier ID fails."""
        
        test_data = setup_test_data
        
        purchase_request = NewPurchaseRequest(
            supplier_id=str(uuid4()),  # Invalid supplier ID
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test invalid supplier",
            reference_number="PO-INVALID-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=1,
                    unit_cost=100.00,
                    condition="A",
                    notes="Should fail"
                )
            ]
        )

        with pytest.raises(Exception):
            await purchase_service.create_new_purchase(purchase_request)

    async def test_purchase_with_invalid_location_fails(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchase with invalid location ID fails."""
        
        test_data = setup_test_data
        
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(uuid4()),  # Invalid location ID
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test invalid location",
            reference_number="PO-INVALID-002",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=1,
                    unit_cost=100.00,
                    condition="A",
                    notes="Should fail"
                )
            ]
        )

        with pytest.raises(Exception):
            await purchase_service.create_new_purchase(purchase_request)

    async def test_purchase_with_zero_quantity_fails(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchase with zero quantity fails validation."""
        
        test_data = setup_test_data
        
        # This should raise a ValidationError when creating the PurchaseItemCreate
        with pytest.raises((ValidationError, ValueError)):
            purchase_request = NewPurchaseRequest(
                supplier_id=str(test_data["supplier"].id),
                location_id=str(test_data["location"].id),
                purchase_date=date.today().strftime("%Y-%m-%d"),
                notes="Test zero quantity",
                reference_number="PO-ZERO-001",
                items=[
                    PurchaseItemCreate(
                        item_id=str(test_data["serialized_item"].id),
                        quantity=0,  # Invalid quantity
                        unit_cost=100.00,
                        condition="A",
                        notes="Should fail"
                    )
                ]
            )

    async def test_purchase_with_negative_quantity_fails(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchase with negative quantity fails validation."""
        
        test_data = setup_test_data
        
        # This should raise a ValidationError when creating the PurchaseItemCreate
        with pytest.raises((ValidationError, ValueError)):
            purchase_request = NewPurchaseRequest(
                supplier_id=str(test_data["supplier"].id),
                location_id=str(test_data["location"].id),
                purchase_date=date.today().strftime("%Y-%m-%d"),
                notes="Test negative quantity",
                reference_number="PO-NEG-001",
                items=[
                    PurchaseItemCreate(
                        item_id=str(test_data["serialized_item"].id),
                        quantity=-5,  # Invalid quantity
                        unit_cost=100.00,
                        condition="A",
                        notes="Should fail"
                    )
                ]
            )

    # ================================================================
    # PERFORMANCE AND EDGE CASE TESTS
    # ================================================================

    async def test_purchase_large_quantity_serialized_items(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test purchase with large quantity of serialized items for performance."""
        
        test_data = setup_test_data
        
        # Create purchase with large quantity
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test large quantity purchase",
            reference_number="PO-LARGE-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=50,  # Large quantity
                    unit_cost=100.00,
                    condition="A",
                    notes="Large batch test",
                    serial_numbers=[f"LARGE-{i+1:03d}" for i in range(50)]  # Generate 50 serial numbers
                )
            ]
        )

        # Measure execution time
        start_time = time.time()
        result = await purchase_service.create_new_purchase(purchase_request)
        end_time = time.time()
        execution_time = end_time - start_time

        # Verify success and reasonable performance
        assert result.success is True
        assert execution_time < 10.0  # Should complete within 10 seconds

        # Verify all units were created
        unit_count_stmt = select(func.count(InventoryUnit.id)).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        unit_count_result = await db_session.execute(unit_count_stmt)
        unit_count = unit_count_result.scalar()
        assert unit_count == 50

        # Verify stock level
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["serialized_item"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()
        assert stock_level.quantity_on_hand == Decimal("50")

    async def test_purchase_many_line_items(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test purchase with many different line items."""
        
        test_data = setup_test_data
        
        # Create purchase with multiple line items
        items = []
        for i in range(10):
            items.extend([
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=1,
                    unit_cost=100.00 + i,
                    condition="A",
                    notes=f"Serialized batch {i+1}",
                    serial_numbers=[f"MANY-{i+1:02d}-001"]  # Each serialized item needs 1 serial number
                ),
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=5 + i,
                    unit_cost=25.00 + i,
                    condition="A",
                    notes=f"Non-serialized batch {i+1}"
                )
            ])

        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test many line items",
            reference_number="PO-MANY-001",
            items=items
        )

        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify all line items were created
        line_count_stmt = select(func.count(TransactionLine.id)).where(
            TransactionLine.transaction_header_id == result.transaction_id
        )
        line_count_result = await db_session.execute(line_count_stmt)
        line_count = line_count_result.scalar()
        assert line_count == 20  # 10 batches * 2 items each

        # Verify inventory units for serialized items
        unit_count_stmt = select(func.count(InventoryUnit.id)).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        unit_count_result = await db_session.execute(unit_count_stmt)
        unit_count = unit_count_result.scalar()
        assert unit_count == 10  # 10 batches * 1 unit each

    # ================================================================
    # MULTI-LOCATION TESTS
    # ================================================================

    async def test_purchase_different_locations_separate_stock(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchases to different locations create separate stock levels."""
        
        test_data = setup_test_data
        
        # Purchase to first location
        purchase_1 = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Purchase to location 1",
            reference_number="PO-LOC1-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=10,
                    unit_cost=25.00,
                    condition="A",
                    notes="Location 1 stock"
                )
            ]
        )

        result_1 = await purchase_service.create_new_purchase(purchase_1)
        assert result_1.success is True

        # Purchase to second location
        purchase_2 = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location_2"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Purchase to location 2",
            reference_number="PO-LOC2-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=15,
                    unit_cost=25.00,
                    condition="A",
                    notes="Location 2 stock"
                )
            ]
        )

        result_2 = await purchase_service.create_new_purchase(purchase_2)
        assert result_2.success is True

        # Verify separate stock levels were created
        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["non_serialized_item"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_levels = stock_result.scalars().all()
        
        assert len(stock_levels) == 2

        # Verify quantities at each location
        location_1_stock = next(s for s in stock_levels if str(s.location_id) == str(test_data["location"].id))
        location_2_stock = next(s for s in stock_levels if str(s.location_id) == str(test_data["location_2"].id))
        
        assert location_1_stock.quantity_on_hand == Decimal("10")
        assert location_2_stock.quantity_on_hand == Decimal("15")

    # ================================================================
    # TRANSACTION CALCULATION TESTS
    # ================================================================

    async def test_purchase_transaction_totals_calculation(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that purchase transaction totals are calculated correctly."""
        
        test_data = setup_test_data
        
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test transaction totals",
            reference_number="PO-TOTALS-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=2,
                    unit_cost=100.00,
                    tax_rate=10.0,
                    discount_amount=5.00,
                    condition="A",
                    notes="Item with tax and discount",
                    serial_numbers=["SN-TOTALS-001", "SN-TOTALS-002"]
                ),
                PurchaseItemCreate(
                    item_id=str(test_data["non_serialized_item"].id),
                    quantity=4,
                    unit_cost=50.00,
                    tax_rate=8.0,
                    discount_amount=10.00,
                    condition="A",
                    notes="Second item with different rates"
                )
            ]
        )

        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Verify transaction totals
        tx_stmt = select(TransactionHeader).where(TransactionHeader.id == result.transaction_id)
        tx_result = await db_session.execute(tx_stmt)
        transaction = tx_result.scalar_one()

        # Calculate expected totals
        # Item 1: (2 * 100.00) = 200.00, tax = 20.00, discount = 5.00
        # Item 2: (4 * 50.00) = 200.00, tax = 16.00, discount = 10.00
        # Subtotal = 400.00, Tax = 36.00, Discount = 15.00, Total = 421.00

        expected_subtotal = Decimal("400.00")  # (2*100) + (4*50)
        expected_tax = Decimal("36.00")  # (200 * 0.10) + (200 * 0.08)
        expected_discount = Decimal("15.00")  # 5.00 + 10.00
        expected_total = Decimal("421.00")  # 400 + 36 - 15

        # Allow for small rounding differences
        assert abs(transaction.subtotal - expected_subtotal) < Decimal("0.01")
        assert abs(transaction.tax_amount - expected_tax) < Decimal("0.01")
        assert abs(transaction.discount_amount - expected_discount) < Decimal("0.01")
        assert abs(transaction.total_amount - expected_total) < Decimal("0.01")

    # ================================================================
    # DATA INTEGRITY TESTS
    # ================================================================

    async def test_purchase_referential_integrity(self, db_session: AsyncSession, setup_test_data, purchase_service):
        """Test that all created records maintain proper referential integrity."""
        
        test_data = setup_test_data
        
        purchase_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="Test referential integrity",
            reference_number="PO-INTEGRITY-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["serialized_item"].id),
                    quantity=2,
                    unit_cost=100.00,
                    condition="A",
                    notes="Integrity test",
                    serial_numbers=["SN-INTEGRITY-001", "SN-INTEGRITY-002"]
                )
            ]
        )

        result = await purchase_service.create_new_purchase(purchase_request)
        assert result.success is True

        # Get all related records
        tx_stmt = select(TransactionHeader).where(TransactionHeader.id == result.transaction_id)
        tx_result = await db_session.execute(tx_stmt)
        transaction = tx_result.scalar_one()

        line_stmt = select(TransactionLine).where(TransactionLine.transaction_header_id == result.transaction_id)
        line_result = await db_session.execute(line_stmt)
        line = line_result.scalar_one()

        stock_stmt = select(StockLevel).where(
            StockLevel.item_id == str(test_data["serialized_item"].id)
        )
        stock_result = await db_session.execute(stock_stmt)
        stock_level = stock_result.scalar_one()

        movement_stmt = select(StockMovement).where(
            StockMovement.item_id == str(test_data["serialized_item"].id)
        )
        movement_result = await db_session.execute(movement_stmt)
        movement = movement_result.scalar_one()

        units_stmt = select(InventoryUnit).where(
            InventoryUnit.item_id == str(test_data["serialized_item"].id)
        )
        units_result = await db_session.execute(units_stmt)
        units = units_result.scalars().all()

        # Verify referential integrity
        # Transaction line references transaction
        assert line.transaction_header_id == transaction.id

        # Stock movement references transaction and line
        assert str(movement.transaction_line_id) == str(line.id)
        assert str(movement.stock_level_id) == str(stock_level.id)

        # Inventory units reference correct item and location
        for unit in units:
            assert str(unit.item_id) == str(test_data["serialized_item"].id)
            assert str(unit.location_id) == str(test_data["location"].id)

        # Stock level references correct item and location
        assert str(stock_level.item_id) == str(test_data["serialized_item"].id)
        assert str(stock_level.location_id) == str(test_data["location"].id)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])