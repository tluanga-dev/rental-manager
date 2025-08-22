"""
Test suite for Purchase Transaction List API functionality.
Tests the purchase list service method to ensure the API endpoint works correctly.
"""

import pytest
import pytest_asyncio
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.transactions.purchase.service import PurchaseService
from app.modules.transactions.purchase.schemas import NewPurchaseRequest, PurchaseItemCreate
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType, TransactionStatus, PaymentStatus
from app.modules.suppliers.models import Supplier, SupplierType
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement


@pytest.mark.asyncio
class TestPurchaseListAPI:
    """Test purchase transaction list functionality."""

    @pytest_asyncio.fixture
    async def setup_purchase_list_test_data(self, db_session: AsyncSession):
        """Set up test data for purchase list testing."""
        
        # Create Brand
        brand = Brand(
            name="List Test Brand",
            code="LTB001",
            description="Brand for list testing"
        )
        db_session.add(brand)
        await db_session.flush()

        # Create Category
        category = Category(
            name="List Test Category",
            category_code="LIST-TEST"
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

        # Create Suppliers
        supplier_1 = Supplier(
            supplier_code="LIST-SUP001",
            company_name="List Test Supplier 1",
            supplier_type=SupplierType.DISTRIBUTOR,
            contact_person="John List",
            email="list1@test.com",
            phone="+1111111111",
            address_line1="123 List St"
        )
        db_session.add(supplier_1)
        await db_session.flush()

        supplier_2 = Supplier(
            supplier_code="LIST-SUP002",
            company_name="List Test Supplier 2",
            supplier_type=SupplierType.MANUFACTURER,
            contact_person="Jane List",
            email="list2@test.com",
            phone="+2222222222",
            address_line1="456 List Ave"
        )
        db_session.add(supplier_2)
        await db_session.flush()

        # Create Location
        location = Location(
            location_code="LIST-LOC001",
            location_name="List Test Warehouse",
            location_type=LocationType.WAREHOUSE,
            address="123 List Warehouse St",
            city="List City",
            state="List State",
            country="List Country"
        )
        db_session.add(location)
        await db_session.flush()

        # Create Items
        item_1 = Item(
            sku="LIST-ITEM001",
            item_name="List Test Item 1",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=False,
            purchase_price=Decimal("100.00"),
            sale_price=Decimal("150.00"),
            security_deposit=Decimal("50.00"),
            reorder_point=10,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(item_1)
        await db_session.flush()

        item_2 = Item(
            sku="LIST-ITEM002",
            item_name="List Test Item 2",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=False,
            purchase_price=Decimal("25.00"),
            sale_price=Decimal("40.00"),
            security_deposit=Decimal("10.00"),
            reorder_point=50,
            is_rentable=True,
            is_saleable=False
        )
        db_session.add(item_2)
        await db_session.flush()

        await db_session.commit()

        return {
            "supplier_1": supplier_1,
            "supplier_2": supplier_2,
            "location": location,
            "item_1": item_1,
            "item_2": item_2,
            "brand": brand,
            "category": category,
            "uom": uom
        }

    @pytest_asyncio.fixture
    async def create_multiple_test_purchases(self, db_session: AsyncSession, setup_purchase_list_test_data):
        """Create multiple test purchases for list testing."""
        
        test_data = setup_purchase_list_test_data
        purchase_service = PurchaseService(db_session)
        created_purchases = []

        # Purchase 1 - High value from supplier 1
        purchase_1_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_1"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="List Test Purchase 1 - High Value",
            reference_number="LIST-PO-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_1"].id),
                    quantity=10,
                    unit_cost=100.00,
                    tax_rate=10.0,
                    discount_amount=50.00,
                    condition="A",
                    notes="High value bulk purchase"
                )
            ]
        )
        
        result_1 = await purchase_service.create_new_purchase(purchase_1_request)
        assert result_1.success is True
        created_purchases.append({
            "id": result_1.transaction_id,
            "reference": "LIST-PO-001",
            "supplier_id": test_data["supplier_1"].id,
            "expected_total": Decimal("1050.00")  # (10*100 + 10% tax - 50 discount)
        })

        # Purchase 2 - Medium value from supplier 2
        purchase_2_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_2"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="List Test Purchase 2 - Medium Value",
            reference_number="LIST-PO-002",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_2"].id),
                    quantity=20,
                    unit_cost=25.00,
                    tax_rate=8.0,
                    discount_amount=10.00,
                    condition="A",
                    notes="Medium value purchase"
                )
            ]
        )
        
        result_2 = await purchase_service.create_new_purchase(purchase_2_request)
        assert result_2.success is True
        created_purchases.append({
            "id": result_2.transaction_id,
            "reference": "LIST-PO-002",
            "supplier_id": test_data["supplier_2"].id,
            "expected_total": Decimal("530.00")  # (20*25 + 8% tax - 10 discount)
        })

        # Purchase 3 - Low value from supplier 1
        purchase_3_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_1"].id),
            location_id=str(test_data["location"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="List Test Purchase 3 - Low Value",
            reference_number="LIST-PO-003",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_2"].id),
                    quantity=5,
                    unit_cost=25.00,
                    tax_rate=5.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Small purchase"
                )
            ]
        )
        
        result_3 = await purchase_service.create_new_purchase(purchase_3_request)
        assert result_3.success is True
        created_purchases.append({
            "id": result_3.transaction_id,
            "reference": "LIST-PO-003",
            "supplier_id": test_data["supplier_1"].id,
            "expected_total": Decimal("131.25")  # (5*25 + 5% tax)
        })

        return created_purchases

    # ================================================================
    # PURCHASE LIST SERVICE TESTS
    # ================================================================

    async def test_get_purchase_transactions_basic_list(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test basic purchase transactions list functionality."""
        
        created_purchases = create_multiple_test_purchases
        purchase_service = PurchaseService(db_session)
        
        # Get all purchases with default parameters
        purchases = await purchase_service.get_purchase_transactions()
        
        # Verify we get a list
        assert isinstance(purchases, list)
        assert len(purchases) == 3  # We created 3 purchases
        
        # Verify basic structure of each purchase
        for purchase in purchases:
            # Check that it has the expected attributes
            assert hasattr(purchase, 'id')
            assert hasattr(purchase, 'supplier')
            assert hasattr(purchase, 'location')
            assert hasattr(purchase, 'purchase_date')
            assert hasattr(purchase, 'total_amount')
            assert hasattr(purchase, 'status')
            assert hasattr(purchase, 'payment_status')
            assert hasattr(purchase, 'items')
            
            # Verify supplier structure
            assert hasattr(purchase.supplier, 'id')
            assert hasattr(purchase.supplier, 'name')
            
            # Verify location structure
            assert hasattr(purchase.location, 'id')
            assert hasattr(purchase.location, 'name')
            
            # Verify items is a list
            assert isinstance(purchase.items, list)
            assert len(purchase.items) > 0
            
            # Verify each item has expected structure
            for item in purchase.items:
                assert hasattr(item, 'id')
                assert hasattr(item, 'item')
                assert hasattr(item, 'quantity')
                assert hasattr(item, 'unit_cost')
                assert hasattr(item, 'line_total')

    async def test_get_purchase_transactions_pagination(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test pagination parameters for purchase list."""
        
        purchase_service = PurchaseService(db_session)
        
        # Test with limit
        purchases_limited = await purchase_service.get_purchase_transactions(limit=2)
        assert len(purchases_limited) == 2
        
        # Test with skip
        purchases_skipped = await purchase_service.get_purchase_transactions(skip=1, limit=2)
        assert len(purchases_skipped) == 2
        
        # Verify different results
        first_batch = await purchase_service.get_purchase_transactions(limit=1)
        second_batch = await purchase_service.get_purchase_transactions(skip=1, limit=1)
        
        assert len(first_batch) == 1
        assert len(second_batch) == 1
        # They should be different purchases
        assert first_batch[0].id != second_batch[0].id

    async def test_get_purchase_transactions_filter_by_supplier(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test filtering purchases by supplier ID."""
        
        created_purchases = create_multiple_test_purchases
        purchase_service = PurchaseService(db_session)
        
        # Filter by supplier 1 (should get 2 purchases)
        supplier_1_id = created_purchases[0]["supplier_id"]
        supplier_1_purchases = await purchase_service.get_purchase_transactions(
            supplier_id=supplier_1_id
        )
        
        assert len(supplier_1_purchases) == 2  # Purchases 1 and 3
        
        # Verify all returned purchases are for the correct supplier
        for purchase in supplier_1_purchases:
            assert str(purchase.supplier.id) == str(supplier_1_id)
        
        # Filter by supplier 2 (should get 1 purchase)
        supplier_2_id = created_purchases[1]["supplier_id"]
        supplier_2_purchases = await purchase_service.get_purchase_transactions(
            supplier_id=supplier_2_id
        )
        
        assert len(supplier_2_purchases) == 1  # Purchase 2
        assert str(supplier_2_purchases[0].supplier.id) == str(supplier_2_id)

    async def test_get_purchase_transactions_filter_by_amount_range(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test filtering purchases by amount range."""
        
        purchase_service = PurchaseService(db_session)
        
        # Filter for high-value purchases (>= 500)
        high_value_purchases = await purchase_service.get_purchase_transactions(
            amount_from=Decimal("500.00")
        )
        
        assert len(high_value_purchases) == 2  # Purchases 1 and 2
        
        # Verify all returned purchases meet the criteria
        for purchase in high_value_purchases:
            assert purchase.total_amount >= Decimal("500.00")
        
        # Filter for low-value purchases (<= 200)
        low_value_purchases = await purchase_service.get_purchase_transactions(
            amount_to=Decimal("200.00")
        )
        
        assert len(low_value_purchases) == 1  # Purchase 3
        assert low_value_purchases[0].total_amount <= Decimal("200.00")
        
        # Filter for medium range (200-600)
        medium_value_purchases = await purchase_service.get_purchase_transactions(
            amount_from=Decimal("200.00"),
            amount_to=Decimal("600.00")
        )
        
        assert len(medium_value_purchases) == 1  # Purchase 2
        purchase = medium_value_purchases[0]
        assert Decimal("200.00") <= purchase.total_amount <= Decimal("600.00")

    async def test_get_purchase_transactions_filter_by_date_range(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test filtering purchases by date range."""
        
        purchase_service = PurchaseService(db_session)
        today = date.today()
        
        # Filter by today's date (should get all 3)
        today_purchases = await purchase_service.get_purchase_transactions(
            date_from=today,
            date_to=today
        )
        
        assert len(today_purchases) == 3
        
        # Verify all returned purchases are from today
        for purchase in today_purchases:
            assert purchase.purchase_date == today

    async def test_get_purchase_transactions_filter_by_status(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test filtering purchases by transaction status."""
        
        purchase_service = PurchaseService(db_session)
        
        # Filter by COMPLETED status (all should be completed)
        completed_purchases = await purchase_service.get_purchase_transactions(
            status=TransactionStatus.COMPLETED
        )
        
        assert len(completed_purchases) == 3
        
        # Verify all are completed
        for purchase in completed_purchases:
            assert purchase.status == TransactionStatus.COMPLETED.value

    async def test_get_purchase_transactions_multiple_filters(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test combining multiple filters."""
        
        created_purchases = create_multiple_test_purchases
        purchase_service = PurchaseService(db_session)
        
        # Combine supplier and amount filters
        supplier_1_id = created_purchases[0]["supplier_id"]
        
        filtered_purchases = await purchase_service.get_purchase_transactions(
            supplier_id=supplier_1_id,
            amount_from=Decimal("500.00")
        )
        
        # Should return 1 purchase (supplier 1, amount >= 500)
        assert len(filtered_purchases) == 1
        purchase = filtered_purchases[0]
        assert str(purchase.supplier.id) == str(supplier_1_id)
        assert purchase.total_amount >= Decimal("500.00")

    async def test_get_purchase_transactions_empty_result(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test that filters can return empty results."""
        
        purchase_service = PurchaseService(db_session)
        
        # Filter for non-existent supplier
        empty_results = await purchase_service.get_purchase_transactions(
            supplier_id=uuid4()  # Random UUID that doesn't exist
        )
        
        assert len(empty_results) == 0
        assert isinstance(empty_results, list)

    async def test_get_purchase_transactions_default_parameters(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test that the function works with default parameters."""
        
        purchase_service = PurchaseService(db_session)
        
        # Call without any parameters
        all_purchases = await purchase_service.get_purchase_transactions()
        
        assert isinstance(all_purchases, list)
        assert len(all_purchases) == 3

    # ================================================================
    # PURCHASE RESPONSE FORMAT TESTS
    # ================================================================

    async def test_purchase_response_format_validation(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test that purchase responses have the correct format."""
        
        purchase_service = PurchaseService(db_session)
        purchases = await purchase_service.get_purchase_transactions()
        
        assert len(purchases) > 0
        
        purchase = purchases[0]
        
        # Test required fields exist
        required_fields = [
            'id', 'supplier', 'location', 'purchase_date', 
            'total_amount', 'status', 'payment_status', 'items'
        ]
        
        for field in required_fields:
            assert hasattr(purchase, field), f"Missing required field: {field}"
        
        # Test supplier nested structure
        assert hasattr(purchase.supplier, 'id')
        assert hasattr(purchase.supplier, 'name')
        assert isinstance(purchase.supplier.name, str)
        
        # Test location nested structure
        assert hasattr(purchase.location, 'id')
        assert hasattr(purchase.location, 'name')
        assert isinstance(purchase.location.name, str)
        
        # Test items structure
        assert isinstance(purchase.items, list)
        if purchase.items:
            item = purchase.items[0]
            item_fields = ['id', 'item', 'quantity', 'unit_cost', 'line_total']
            for field in item_fields:
                assert hasattr(item, field), f"Missing item field: {field}"

    async def test_purchase_amounts_are_decimal_type(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test that monetary amounts are proper Decimal types."""
        
        purchase_service = PurchaseService(db_session)
        purchases = await purchase_service.get_purchase_transactions()
        
        purchase = purchases[0]
        
        # Check main amounts
        assert isinstance(purchase.total_amount, Decimal)
        if hasattr(purchase, 'subtotal'):
            assert isinstance(purchase.subtotal, Decimal)
        if hasattr(purchase, 'tax_amount'):
            assert isinstance(purchase.tax_amount, Decimal)
        if hasattr(purchase, 'discount_amount'):
            assert isinstance(purchase.discount_amount, Decimal)
        
        # Check line item amounts
        if purchase.items:
            item = purchase.items[0]
            assert isinstance(item.unit_cost, Decimal)
            assert isinstance(item.line_total, Decimal)

    async def test_purchase_dates_are_proper_types(self, db_session: AsyncSession, create_multiple_test_purchases):
        """Test that date fields are proper date/datetime types."""
        
        purchase_service = PurchaseService(db_session)
        purchases = await purchase_service.get_purchase_transactions()
        
        purchase = purchases[0]
        
        # Check date types
        assert isinstance(purchase.purchase_date, date)
        if hasattr(purchase, 'created_at'):
            assert isinstance(purchase.created_at, datetime)
        if hasattr(purchase, 'updated_at'):
            assert isinstance(purchase.updated_at, datetime)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
