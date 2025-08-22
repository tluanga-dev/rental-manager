"""
Comprehensive test suite for rental transaction creation.
Tests the complete flow including:
1. Customer and location validation
2. Item availability and stock validation
3. Stock level updates (available/on_rent quantities)
4. Inventory unit status updates for serialized items
5. Transaction header and line creation
6. Stock movement audit trail
7. Error handling and rollback scenarios
8. Edge cases and validation
9. UUID type handling consistency
"""

import pytest
import pytest_asyncio
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from typing import List, Dict, Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.transactions.rentals.repository import RentalsRepository
from app.modules.transactions.rentals.schemas import NewRentalRequest, RentalItemCreate
from app.modules.transactions.base.models import (
    TransactionHeader, TransactionLine, TransactionType, TransactionStatus,
    RentalPeriodUnit
)
from app.modules.inventory.models import StockLevel, StockMovement, InventoryUnit
from app.modules.inventory.enums import MovementType, InventoryUnitStatus
from app.modules.customers.models import Customer, CustomerType, CustomerStatus
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement
from app.core.errors import NotFoundError, ValidationError


@pytest.mark.asyncio
class TestRentalCreationIntegration:
    """Test rental transaction creation with complete inventory updates."""

    @pytest_asyncio.fixture
    async def setup_test_data(self, db_session: AsyncSession):
        """Set up comprehensive test data for rental testing."""
        
        # Create Brand
        brand = Brand(
            name="Test Rental Brand",
            code="TRB001",
            description="Test brand for rental testing"
        )
        db_session.add(brand)
        await db_session.flush()

        # Create Category
        category = Category(
            name="Rental Equipment",
            category_code="RENT-EQUIP"
        )
        db_session.add(category)
        await db_session.flush()

        # Create Unit of Measurement
        uom = UnitOfMeasurement(
            name="Unit",
            code="UNIT",
            description="Individual units"
        )
        db_session.add(uom)
        await db_session.flush()

        # Create Customer (Individual)
        customer = Customer(
            customer_code="CUST001",
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email="john.doe@test.com",
            phone="1234567890",
            address_line1="123 Customer St",
            city="Test City",
            state="Test State",
            postal_code="12345",
            country="Test Country"
        )
        db_session.add(customer)
        await db_session.flush()

        # Create Location
        location = Location(
            location_code="STORE001",
            location_name="Main Store",
            location_type=LocationType.STORE,
            address="123 Store St",
            city="Test City",
            state="Test State",
            country="Test Country"
        )
        db_session.add(location)
        await db_session.flush()

        # Create Rentable Items
        # Item 1: Regular rentable item (no serial numbers)
        item1 = Item(
            sku="RENT-001",
            item_name="Rental Laptop",
            item_status=ItemStatus.ACTIVE,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            rental_rate_per_period=Decimal("50.00"),
            rental_period="1",
            security_deposit=Decimal("200.00"),
            is_rentable=True,
            is_saleable=False,
            serial_number_required=False,
            reorder_point=5
        )
        db_session.add(item1)
        await db_session.flush()

        # Item 2: Serialized rentable item
        item2 = Item(
            sku="RENT-002",
            item_name="Professional Camera",
            item_status=ItemStatus.ACTIVE,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            rental_rate_per_period=Decimal("100.00"),
            rental_period="1",
            security_deposit=Decimal("500.00"),
            is_rentable=True,
            is_saleable=False,
            serial_number_required=True,
            reorder_point=2
        )
        db_session.add(item2)
        await db_session.flush()

        # Create Stock Levels
        stock1 = StockLevel(
            item_id=str(item1.id),
            location_id=str(location.id),
            quantity_on_hand=Decimal("10"),
            quantity_available=Decimal("10"),
            quantity_on_rent=Decimal("0")
        )
        db_session.add(stock1)

        stock2 = StockLevel(
            item_id=str(item2.id),
            location_id=str(location.id),
            quantity_on_hand=Decimal("5"),
            quantity_available=Decimal("5"),
            quantity_on_rent=Decimal("0")
        )
        db_session.add(stock2)

        # Create Inventory Units for serialized item
        for i in range(5):
            unit = InventoryUnit(
                item_id=str(item2.id),
                location_id=str(location.id),
                sku=f"CAM-{i+1:03d}",
                serial_number=f"SN-CAM-{i+1:06d}",
                status=InventoryUnitStatus.AVAILABLE
            )
            db_session.add(unit)

        await db_session.commit()

        return {
            "customer": customer,
            "location": location,
            "item1": item1,  # Non-serialized
            "item2": item2,  # Serialized
            "brand": brand,
            "category": category,
            "uom": uom,
            "stock1": stock1,
            "stock2": stock2
        }

    async def test_successful_rental_creation_basic(self, db_session: AsyncSession, setup_test_data):
        """Test successful rental creation with basic items."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create rental request
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="CASH",
            payment_reference="REF-001",
            notes="Test rental transaction",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=2,
                    rental_period_value=7,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("10.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-22",
                    notes="Laptop rental"
                )
            ],
            delivery_required=False,
            pickup_required=False,
            deposit_amount=Decimal("200.00"),
            reference_number="RENT-REF-001"
        )

        # Execute rental creation
        result = await repository.create_transaction(db_session, rental_request)

        # Verify result structure
        assert "tx_id" in result
        assert "tx_number" in result
        assert result["tx_number"].startswith("RENT-")

        # Verify transaction header
        header = await db_session.scalar(
            select(TransactionHeader).where(TransactionHeader.id == result["tx_id"])
        )
        assert header is not None
        assert header.transaction_type == TransactionType.RENTAL
        assert str(header.customer_id) == str(data["customer"].id)
        assert str(header.location_id) == str(data["location"].id)
        assert header.payment_method.value == "CASH"
        assert header.subtotal == Decimal("90.00")  # (2 * 50) - 10 discount
        assert header.total_amount == Decimal("106.20")  # 90 + 18% tax
        assert header.deposit_amount == Decimal("200.00")

        # Verify transaction lines
        lines = await db_session.execute(
            select(TransactionLine).where(TransactionLine.transaction_header_id == result["tx_id"])
        )
        lines_list = lines.scalars().all()
        assert len(lines_list) == 1
        
        line = lines_list[0]
        assert str(line.item_id) == str(data["item1"].id)
        assert line.quantity == Decimal("2")
        assert line.unit_price == Decimal("50.00")
        assert line.discount_amount == Decimal("10.00")
        assert line.line_total == Decimal("90.00")
        assert line.rental_period == 7
        assert line.rental_period_unit == RentalPeriodUnit.DAY

        # Verify stock level updates
        # Refresh session to see latest data
        await db_session.refresh(data["stock1"])
        updated_stock = data["stock1"]
        assert updated_stock.quantity_available == Decimal("8")  # 10 - 2
        assert updated_stock.quantity_on_rent == Decimal("2")   # 0 + 2

        # Verify stock movement
        movement = await db_session.scalar(
            select(StockMovement).where(
                and_(
                    StockMovement.item_id == str(data["item1"].id),
                    StockMovement.transaction_header_id == str(result["tx_id"])
                )
            )
        )
        assert movement is not None
        assert movement.movement_type == "RENTAL_OUT"
        assert movement.movement_type == MovementType.RENTAL_OUT
        assert movement.quantity_change == Decimal("-2")

    async def test_successful_rental_creation_serialized_items(self, db_session: AsyncSession, setup_test_data):
        """Test successful rental creation with serialized items."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create rental request for serialized item
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="CREDIT_CARD",
            items=[
                RentalItemCreate(
                    item_id=str(data["item2"].id),
                    quantity=2,
                    rental_period_value=3,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("100.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-18",
                    notes="Camera rental"
                )
            ],
            delivery_required=True,
            delivery_address="456 Delivery St",
            delivery_date="2024-01-15",
            delivery_time="10:00",
            pickup_required=True,
            pickup_date="2024-01-18",
            pickup_time="17:00",
            deposit_amount=Decimal("1000.00")
        )

        # Execute rental creation
        result = await repository.create_transaction(db_session, rental_request)

        # Verify inventory units are updated to RENTED status
        rented_units = await db_session.execute(
            select(InventoryUnit).where(
                and_(
                    InventoryUnit.item_id == str(data["item2"].id),
                    InventoryUnit.location_id == str(data["location"].id),
                    InventoryUnit.status == InventoryUnitStatus.RENTED
                )
            )
        )
        rented_units_list = rented_units.scalars().all()
        assert len(rented_units_list) == 2

        # Verify remaining units are still available
        available_units = await db_session.execute(
            select(InventoryUnit).where(
                and_(
                    InventoryUnit.item_id == str(data["item2"].id),
                    InventoryUnit.location_id == str(data["location"].id),
                    InventoryUnit.status == InventoryUnitStatus.AVAILABLE
                )
            )
        )
        available_units_list = available_units.scalars().all()
        assert len(available_units_list) == 3

        # Verify delivery and pickup details
        header = await db_session.scalar(
            select(TransactionHeader).where(TransactionHeader.id == result["tx_id"])
        )
        assert header.delivery_required is True
        assert header.delivery_address == "456 Delivery St"
        assert header.pickup_required is True

    async def test_rental_creation_insufficient_stock(self, db_session: AsyncSession, setup_test_data):
        """Test rental creation failure due to insufficient stock."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create rental request with quantity exceeding available stock
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=15,  # More than available (10)
                    rental_period_value=1,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-16"
                )
            ]
        )

        # Expect ValueError for insufficient stock
        with pytest.raises(ValueError, match="Insufficient stock"):
            await repository.create_transaction(db_session, rental_request)

        # Verify no changes to stock levels
        stock = await db_session.scalar(
            select(StockLevel).where(
                and_(
                    StockLevel.item_id == str(data["item1"].id),
                    StockLevel.location_id == str(data["location"].id)
                )
            )
        )
        assert stock.quantity_available == Decimal("10")  # Unchanged
        assert stock.quantity_on_rent == Decimal("0")     # Unchanged

    async def test_rental_creation_invalid_customer(self, db_session: AsyncSession, setup_test_data):
        """Test rental creation failure due to invalid customer."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create rental request with non-existent customer
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(uuid4()),  # Non-existent customer
            location_id=str(data["location"].id),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=1,
                    rental_period_value=1,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-16"
                )
            ]
        )

        # Expect ValueError for invalid customer
        with pytest.raises(ValueError, match="Invalid customer or location"):
            await repository.create_transaction(db_session, rental_request)

    async def test_rental_creation_multiple_items(self, db_session: AsyncSession, setup_test_data):
        """Test rental creation with multiple different items."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create rental request with multiple items
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="BANK_TRANSFER",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=3,
                    rental_period_value=5,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("15.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-20",
                    notes="Laptop rental"
                ),
                RentalItemCreate(
                    item_id=str(data["item2"].id),
                    quantity=1,
                    rental_period_value=7,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("100.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-22",
                    notes="Camera rental"
                )
            ],
            deposit_amount=Decimal("700.00")
        )

        # Execute rental creation
        result = await repository.create_transaction(db_session, rental_request)

        # Verify transaction lines
        lines = await db_session.execute(
            select(TransactionLine).where(TransactionLine.transaction_header_id == result["tx_id"])
        )
        lines_list = lines.scalars().all()
        assert len(lines_list) == 2

        # Verify stock updates for both items
        await db_session.refresh(data["stock1"])
        await db_session.refresh(data["stock2"])
        
        stock1 = data["stock1"]
        assert stock1.quantity_available == Decimal("7")  # 10 - 3
        assert stock1.quantity_on_rent == Decimal("3")

        stock2 = data["stock2"]
        assert stock2.quantity_available == Decimal("4")  # 5 - 1
        assert stock2.quantity_on_rent == Decimal("1")

        # Verify one inventory unit is rented for serialized item
        rented_units = await db_session.execute(
            select(InventoryUnit).where(
                and_(
                    InventoryUnit.item_id == str(data["item2"].id),
                    InventoryUnit.status == InventoryUnitStatus.RENTED
                )
            )
        )
        assert len(rented_units.scalars().all()) == 1

    async def test_rental_creation_uuid_consistency(self, db_session: AsyncSession, setup_test_data):
        """Test that UUID handling is consistent throughout the rental creation process."""
        data = setup_test_data
        repository = RentalsRepository()

        # Test with string UUIDs (as they would come from API)
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),  # String UUID
            location_id=str(data["location"].id),  # String UUID
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),  # String UUID
                    quantity=1,
                    rental_period_value=1,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-16"
                )
            ]
        )

        # Should not raise any UUID-related errors
        result = await repository.create_transaction(db_session, rental_request)
        assert result is not None
        assert "tx_id" in result

        # Verify the transaction was created successfully
        header = await db_session.scalar(
            select(TransactionHeader).where(TransactionHeader.id == result["tx_id"])
        )
        assert header is not None
        assert str(header.customer_id) == str(data["customer"].id)
        assert str(header.location_id) == str(data["location"].id)

    async def test_rental_creation_edge_case_zero_discount(self, db_session: AsyncSession, setup_test_data):
        """Test rental creation with zero discount and various edge cases."""
        data = setup_test_data
        repository = RentalsRepository()

        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=1,
                    rental_period_value=1,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=None,  # Test None discount
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-16",
                    notes=""  # Empty notes
                )
            ],
            delivery_required=False,
            pickup_required=False,
            deposit_amount=None,  # Test None deposit
            reference_number=""  # Empty reference
        )

        result = await repository.create_transaction(db_session, rental_request)
        
        # Verify transaction was created successfully
        header = await db_session.scalar(
            select(TransactionHeader).where(TransactionHeader.id == result["tx_id"])
        )
        assert header.deposit_amount == Decimal("0")  # Should default to 0
        
        line = await db_session.scalar(
            select(TransactionLine).where(TransactionLine.transaction_header_id == result["tx_id"])
        )
        assert line.discount_amount == Decimal("0")  # Should default to 0

    async def test_get_all_rentals(self, db_session: AsyncSession, setup_test_data):
        """Test retrieving all rental transactions."""
        data = setup_test_data
        repository = RentalsRepository()

        # Create a rental first
        rental_request = NewRentalRequest(
            transaction_date="2024-01-15",
            customer_id=str(data["customer"].id),
            location_id=str(data["location"].id),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=str(data["item1"].id),
                    quantity=1,
                    rental_period_value=1,
                    rental_period_type="DAILY",
                    unit_rate=Decimal("50.00"),
                    discount_value=Decimal("0.00"),
                    rental_start_date="2024-01-15",
                    rental_end_date="2024-01-16"
                )
            ]
        )

        await repository.create_transaction(db_session, rental_request)

        # Test get_all_rentals
        rentals = await repository.get_all_rentals(db_session, skip=0, limit=10)
        
        assert len(rentals) >= 1
        rental = rentals[0]
        
        # Verify rental structure
        assert "id" in rental
        assert "transaction_number" in rental
        assert "customer_name" in rental
        assert "location_name" in rental
        assert "items" in rental
        assert len(rental["items"]) == 1
        
        # Verify item structure
        item = rental["items"][0]
        assert "item_name" in item
        assert "sku" in item
        assert "quantity" in item
        assert "unit_price" in item

    async def test_get_rentable_items_with_stock(self, db_session: AsyncSession, setup_test_data):
        """Test retrieving rentable items with stock information."""
        data = setup_test_data
        repository = RentalsRepository()

        # Test without filters
        items = await repository.get_rentable_items_with_stock(db_session)
        
        assert len(items) >= 2  # Should have at least our test items
        
        # Find our test items
        item1_found = None
        item2_found = None
        
        for item in items:
            if item["item_id"] == str(data["item1"].id):
                item1_found = item
            elif item["item_id"] == str(data["item2"].id):
                item2_found = item
        
        assert item1_found is not None
        assert item2_found is not None
        
        # Verify structure
        assert "itemname" in item1_found
        assert "itemcategory_name" in item1_found
        assert "rental_rate_per_period" in item1_found
        assert "available_units" in item1_found
        assert len(item1_found["available_units"]) >= 1
        
        # Verify stock information
        location_stock = item1_found["available_units"][0]
        assert "location_id" in location_stock
        assert "location_name" in location_stock
        assert "available_units" in location_stock
        assert location_stock["available_units"] == 10  # Initial stock

        # Test with location filter
        filtered_items = await repository.get_rentable_items_with_stock(
            db_session,
            location_id=str(data["location"].id)
        )
        assert len(filtered_items) >= 2

        # Test with search filter
        search_items = await repository.get_rentable_items_with_stock(
            db_session,
            search_name="Laptop"
        )
        assert len(search_items) >= 1
        assert any("Laptop" in item["itemname"] for item in search_items)