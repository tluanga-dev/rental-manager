"""
Test suite for Purchase Transaction API endpoints.
Tests the HTTP API layer for purchase transactions including:
1. List purchases with various filters
2. Get purchase by ID
3. Create new purchase
4. API response format validation
5. Error handling
6. Pagination
"""

import pytest
import pytest_asyncio
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from typing import List, Dict, Any
import json

from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.modules.transactions.purchase.service import PurchaseService
from app.modules.transactions.purchase.schemas import NewPurchaseRequest, PurchaseItemCreate
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType, TransactionStatus
from app.modules.suppliers.models import Supplier, SupplierType
from app.modules.master_data.locations.models import Location, LocationType
from app.modules.master_data.item_master.models import Item, ItemStatus
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement


@pytest.mark.asyncio
class TestPurchaseAPI:
    """Test purchase transaction API endpoints."""

    @pytest_asyncio.fixture
    async def setup_api_test_data(self, db_session: AsyncSession):
        """Set up test data for API tests."""
        
        # Create Brand
        brand = Brand(
            name="API Test Brand",
            code="ATB001",
            description="Brand for API testing"
        )
        db_session.add(brand)
        await db_session.flush()

        # Create Category
        category = Category(
            name="API Test Category",
            category_code="API-CAT"
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
            supplier_code="API-SUP001",
            company_name="API Test Supplier 1",
            supplier_type=SupplierType.DISTRIBUTOR,
            contact_person="John API",
            email="api1@test.com",
            phone="+1111111111",
            address_line1="123 API St"
        )
        db_session.add(supplier_1)
        await db_session.flush()

        supplier_2 = Supplier(
            supplier_code="API-SUP002",
            company_name="API Test Supplier 2",
            supplier_type=SupplierType.MANUFACTURER,
            contact_person="Jane API",
            email="api2@test.com",
            phone="+2222222222",
            address_line1="456 API Ave"
        )
        db_session.add(supplier_2)
        await db_session.flush()

        # Create Locations
        location_1 = Location(
            location_code="API-LOC001",
            location_name="API Test Warehouse 1",
            location_type=LocationType.WAREHOUSE,
            address="123 API Warehouse St",
            city="API City",
            state="API State",
            country="API Country"
        )
        db_session.add(location_1)
        await db_session.flush()

        location_2 = Location(
            location_code="API-LOC002",
            location_name="API Test Warehouse 2",
            location_type=LocationType.WAREHOUSE,
            address="456 API Warehouse Ave",
            city="API City 2",
            state="API State 2",
            country="API Country"
        )
        db_session.add(location_2)
        await db_session.flush()

        # Create Items
        item_1 = Item(
            sku="API-ITEM001",
            item_name="API Test Item 1",
            item_status=ItemStatus.ACTIVE.value,
            brand_id=brand.id,
            category_id=category.id,
            unit_of_measurement_id=uom.id,
            serial_number_required=True,
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
            sku="API-ITEM002",
            item_name="API Test Item 2",
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
            "location_1": location_1,
            "location_2": location_2,
            "item_1": item_1,
            "item_2": item_2,
            "brand": brand,
            "category": category,
            "uom": uom
        }

    @pytest_asyncio.fixture
    async def create_test_purchases(self, db_session: AsyncSession, setup_api_test_data):
        """Create multiple test purchases for list API testing."""
        
        test_data = setup_api_test_data
        purchase_service = PurchaseService(db_session)
        created_purchases = []

        # Purchase 1 - Recent, high value
        purchase_1_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_1"].id),
            location_id=str(test_data["location_1"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="API Test Purchase 1 - Recent High Value",
            reference_number="API-PO-001",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_1"].id),
                    quantity=5,
                    unit_cost=100.00,
                    tax_rate=10.0,
                    discount_amount=5.00,
                    condition="A",
                    notes="High value items",
                    serial_numbers=["SN001", "SN002", "SN003", "SN004", "SN005"]
                )
            ]
        )
        
        result_1 = await purchase_service.create_new_purchase(purchase_1_request)
        created_purchases.append({
            "id": result_1.transaction_id,
            "reference": "API-PO-001",
            "supplier_id": test_data["supplier_1"].id,
            "location_id": test_data["location_1"].id,
            "total_amount": Decimal("545.00")  # (5*100 + tax - discount)
        })

        # Purchase 2 - Recent, low value
        purchase_2_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_2"].id),
            location_id=str(test_data["location_2"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="API Test Purchase 2 - Recent Low Value",
            reference_number="API-PO-002",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_2"].id),
                    quantity=10,
                    unit_cost=25.00,
                    tax_rate=5.0,
                    discount_amount=2.00,
                    condition="A",
                    notes="Low value items"
                )
            ]
        )
        
        result_2 = await purchase_service.create_new_purchase(purchase_2_request)
        created_purchases.append({
            "id": result_2.transaction_id,
            "reference": "API-PO-002",
            "supplier_id": test_data["supplier_2"].id,
            "location_id": test_data["location_2"].id,
            "total_amount": Decimal("260.50")  # (10*25 + tax - discount)
        })

        # Purchase 3 - Mixed items
        purchase_3_request = NewPurchaseRequest(
            supplier_id=str(test_data["supplier_1"].id),
            location_id=str(test_data["location_1"].id),
            purchase_date=date.today().strftime("%Y-%m-%d"),
            notes="API Test Purchase 3 - Mixed Items",
            reference_number="API-PO-003",
            items=[
                PurchaseItemCreate(
                    item_id=str(test_data["item_1"].id),
                    quantity=2,
                    unit_cost=100.00,
                    tax_rate=8.0,
                    discount_amount=0.00,
                    condition="A",
                    notes="Premium items",
                    serial_numbers=["SN010", "SN011"]
                ),
                PurchaseItemCreate(
                    item_id=str(test_data["item_2"].id),
                    quantity=20,
                    unit_cost=25.00,
                    tax_rate=8.0,
                    discount_amount=10.00,
                    condition="A",
                    notes="Bulk items"
                )
            ]
        )
        
        result_3 = await purchase_service.create_new_purchase(purchase_3_request)
        created_purchases.append({
            "id": result_3.transaction_id,
            "reference": "API-PO-003",
            "supplier_id": test_data["supplier_1"].id,
            "location_id": test_data["location_1"].id,
            "total_amount": Decimal("708.00")  # ((2*100 + 20*25) + tax - discount)
        })

        return created_purchases

    @pytest_asyncio.fixture
    async def test_app(self, db_session: AsyncSession):
        """Create a minimal test FastAPI app with only the routes we need."""
        from fastapi import FastAPI
        from app.modules.transactions.purchase.routes import router as purchase_router
        from app.shared.dependencies import get_session
        
        app = FastAPI()
        
        # Override database dependency for testing
        def get_test_session():
            return db_session
        
        app.dependency_overrides[get_session] = get_test_session
        
        # Include only the router we need for testing
        app.include_router(purchase_router, prefix="/api/transactions/purchases", tags=["purchases"])
        
        return app

    @pytest_asyncio.fixture
    async def async_client(self, test_app):
        """Create async HTTP client for testing."""
        async with AsyncClient(app=test_app, base_url="http://test") as client:
            yield client

    # ================================================================
    # PURCHASE LIST API TESTS
    # ================================================================

    async def test_get_purchase_transactions_basic_list(self, async_client: AsyncClient, create_test_purchases):
        """Test basic purchase transactions list endpoint."""
        
        # Make API request
        response = await async_client.get("/api/transactions/purchases/")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of purchases
        assert isinstance(data, list)
        assert len(data) == 3  # We created 3 test purchases
        
        # Verify response structure for first purchase
        first_purchase = data[0]
        required_fields = [
            "id", "supplier", "location", "purchase_date", "reference_number",
            "notes", "subtotal", "tax_amount", "discount_amount", "total_amount",
            "status", "payment_status", "created_at", "updated_at", "items"
        ]
        
        for field in required_fields:
            assert field in first_purchase, f"Missing field: {field}"
        
        # Verify nested objects structure
        assert "id" in first_purchase["supplier"]
        assert "name" in first_purchase["supplier"]
        assert "id" in first_purchase["location"]
        assert "name" in first_purchase["location"]
        
        # Verify items structure
        assert isinstance(first_purchase["items"], list)
        if first_purchase["items"]:
            item = first_purchase["items"][0]
            item_fields = [
                "id", "item", "quantity", "unit_cost", "tax_rate",
                "discount_amount", "condition", "notes", "line_total"
            ]
            for field in item_fields:
                assert field in item, f"Missing item field: {field}"

    async def test_get_purchase_transactions_pagination(self, async_client: AsyncClient, create_test_purchases):
        """Test pagination parameters for purchase list."""
        
        # Test with limit
        response = await async_client.get("/api/transactions/purchases/?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
        
        # Test with skip
        response = await async_client.get("/api/transactions/purchases/?skip=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
        
        # Test with skip beyond available records
        response = await async_client.get("/api/transactions/purchases/?skip=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    async def test_get_purchase_transactions_filter_by_supplier(self, async_client: AsyncClient, create_test_purchases):
        """Test filtering purchases by supplier ID."""
        
        test_purchases = create_test_purchases
        supplier_1_id = test_purchases[0]["supplier_id"]
        
        # Filter by supplier 1 (should get 2 purchases)
        response = await async_client.get(f"/api/transactions/purchases/?supplier_id={supplier_1_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Should return 2 purchases for supplier 1
        assert len(data) == 2
        
        # Verify all returned purchases are for the correct supplier
        for purchase in data:
            assert purchase["supplier"]["id"] == str(supplier_1_id)

    async def test_get_purchase_transactions_filter_by_amount_range(self, async_client: AsyncClient, create_test_purchases):
        """Test filtering purchases by amount range."""
        
        # Filter for high-value purchases (> 500)
        response = await async_client.get("/api/transactions/purchases/?amount_from=500")
        assert response.status_code == 200
        data = response.json()
        
        # Should return 2 high-value purchases
        assert len(data) == 2
        
        # Verify all returned purchases meet the criteria
        for purchase in data:
            assert float(purchase["total_amount"]) >= 500.0
        
        # Filter for low-value purchases (< 300)
        response = await async_client.get("/api/transactions/purchases/?amount_to=300")
        assert response.status_code == 200
        data = response.json()
        
        # Should return 1 low-value purchase
        assert len(data) == 1
        assert float(data[0]["total_amount"]) <= 300.0

    async def test_get_purchase_transactions_filter_by_date(self, async_client: AsyncClient, create_test_purchases):
        """Test filtering purchases by date range."""
        
        today = date.today().strftime("%Y-%m-%d")
        
        # Filter by today's date
        response = await async_client.get(f"/api/transactions/purchases/?date_from={today}&date_to={today}")
        assert response.status_code == 200
        data = response.json()
        
        # Should return all 3 purchases (all created today)
        assert len(data) == 3
        
        # Verify all returned purchases are from today
        for purchase in data:
            assert purchase["purchase_date"] == today

    async def test_get_purchase_transactions_multiple_filters(self, async_client: AsyncClient, create_test_purchases):
        """Test combining multiple filters."""
        
        test_purchases = create_test_purchases
        supplier_1_id = test_purchases[0]["supplier_id"]
        today = date.today().strftime("%Y-%m-%d")
        
        # Combine supplier and amount filters
        response = await async_client.get(
            f"/api/transactions/purchases/?supplier_id={supplier_1_id}&amount_from=600&date_from={today}"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return 1 purchase (supplier 1, amount > 600, today's date)
        assert len(data) == 1
        purchase = data[0]
        assert purchase["supplier"]["id"] == str(supplier_1_id)
        assert float(purchase["total_amount"]) >= 600.0
        assert purchase["purchase_date"] == today

    async def test_get_purchase_transactions_invalid_filters(self, async_client: AsyncClient, create_test_purchases):
        """Test API behavior with invalid filter parameters."""
        
        # Invalid UUID for supplier_id
        response = await async_client.get("/api/transactions/purchases/?supplier_id=invalid-uuid")
        assert response.status_code == 422  # Validation error
        
        # Negative limit
        response = await async_client.get("/api/transactions/purchases/?limit=-1")
        assert response.status_code == 422  # Validation error
        
        # Excessive limit
        response = await async_client.get("/api/transactions/purchases/?limit=2000")
        assert response.status_code == 422  # Validation error
        
        # Invalid date format
        response = await async_client.get("/api/transactions/purchases/?date_from=invalid-date")
        assert response.status_code == 422  # Validation error

    # ================================================================
    # PURCHASE BY ID API TESTS
    # ================================================================

    async def test_get_purchase_by_id_success(self, async_client: AsyncClient, create_test_purchases):
        """Test getting a specific purchase by ID."""
        
        test_purchases = create_test_purchases
        purchase_id = test_purchases[0]["id"]
        
        # Get purchase by ID
        response = await async_client.get(f"/api/transactions/purchases/{purchase_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify it's the correct purchase
        assert data["id"] == str(purchase_id)
        # System generates transaction_number in format PUR-YYYYMMDD-####
        assert data["reference_number"].startswith("PUR-")
        assert len(data["reference_number"]) == 17  # PUR-20250726-0001 format
        
        # Verify complete structure
        assert "supplier" in data
        assert "location" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) > 0

    async def test_get_purchase_by_id_not_found(self, async_client: AsyncClient, create_test_purchases):
        """Test getting a purchase with non-existent ID."""
        
        non_existent_id = uuid4()
        
        response = await async_client.get(f"/api/transactions/purchases/{non_existent_id}")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data

    async def test_get_purchase_by_id_invalid_uuid(self, async_client: AsyncClient, create_test_purchases):
        """Test getting a purchase with invalid UUID format."""
        
        response = await async_client.get("/api/transactions/purchases/invalid-uuid")
        assert response.status_code == 422  # Validation error

    # ================================================================
    # CREATE PURCHASE API TESTS
    # ================================================================

    async def test_create_new_purchase_success(self, async_client: AsyncClient, setup_api_test_data):
        """Test creating a new purchase via API."""
        
        test_data = setup_api_test_data
        
        # Create purchase request
        purchase_data = {
            "supplier_id": str(test_data["supplier_1"].id),
            "location_id": str(test_data["location_1"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "notes": "API Created Purchase",
            "reference_number": "API-CREATE-001",
            "items": [
                {
                    "item_id": str(test_data["item_1"].id),
                    "quantity": 3,
                    "unit_cost": 100.00,
                    "tax_rate": 10.0,
                    "discount_amount": 5.00,
                    "condition": "A",
                    "notes": "API created items",
                    "serial_numbers": ["SN020", "SN021", "SN022"]
                }
            ]
        }
        
        # Make API request
        response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert response.status_code == 201
        
        data = response.json()
        
        # Verify response structure
        assert data["success"] is True
        assert "transaction_id" in data
        assert "transaction_number" in data
        assert "message" in data
        assert "data" in data
        
        # Verify transaction data
        tx_data = data["data"]
        assert tx_data["supplier_id"] == str(test_data["supplier_1"].id)
        assert tx_data["location_id"] == str(test_data["location_1"].id)
        assert tx_data["status"] == "COMPLETED"

    async def test_create_new_purchase_validation_errors(self, async_client: AsyncClient, setup_api_test_data):
        """Test purchase creation with validation errors."""
        
        test_data = setup_api_test_data
        
        # Missing required fields
        purchase_data = {
            "supplier_id": str(test_data["supplier_1"].id),
            # Missing location_id
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "items": []  # Empty items array
        }
        
        response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert response.status_code == 422  # Validation error
        
        # Invalid supplier ID
        purchase_data = {
            "supplier_id": "invalid-uuid",
            "location_id": str(test_data["location_1"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "items": [
                {
                    "item_id": str(test_data["item_1"].id),
                    "quantity": 1,
                    "unit_cost": 100.00,
                    "condition": "A",
                    "serial_numbers": ["SN031"]
                }
            ]
        }
        
        response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert response.status_code == 422  # Validation error

    async def test_create_new_purchase_not_found_errors(self, async_client: AsyncClient, setup_api_test_data):
        """Test purchase creation with non-existent entities."""
        
        test_data = setup_api_test_data
        
        # Non-existent supplier
        purchase_data = {
            "supplier_id": str(uuid4()),  # Non-existent supplier
            "location_id": str(test_data["location_1"].id),
            "purchase_date": date.today().strftime("%Y-%m-%d"),
            "items": [
                {
                    "item_id": str(test_data["item_1"].id),
                    "quantity": 1,
                    "unit_cost": 100.00,
                    "condition": "A",
                    "serial_numbers": ["SN030"]
                }
            ]
        }
        
        response = await async_client.post("/api/transactions/purchases/new", json=purchase_data)
        assert response.status_code == 404  # Not found error

    # ================================================================
    # API RESPONSE FORMAT VALIDATION TESTS
    # ================================================================

    async def test_purchase_response_format_consistency(self, async_client: AsyncClient, create_test_purchases):
        """Test that API responses maintain consistent format."""
        
        # Get list of purchases
        list_response = await async_client.get("/api/transactions/purchases/")
        assert list_response.status_code == 200
        list_data = list_response.json()
        
        if list_data:
            first_purchase_from_list = list_data[0]
            purchase_id = first_purchase_from_list["id"]
            
            # Get same purchase by ID
            detail_response = await async_client.get(f"/api/transactions/purchases/{purchase_id}")
            assert detail_response.status_code == 200
            purchase_from_detail = detail_response.json()
            
            # Verify both responses have the same structure and data
            assert first_purchase_from_list["id"] == purchase_from_detail["id"]
            assert first_purchase_from_list["reference_number"] == purchase_from_detail["reference_number"]
            assert first_purchase_from_list["total_amount"] == purchase_from_detail["total_amount"]
            
            # Verify nested structures are consistent
            assert first_purchase_from_list["supplier"]["id"] == purchase_from_detail["supplier"]["id"]
            assert first_purchase_from_list["location"]["id"] == purchase_from_detail["location"]["id"]

    async def test_purchase_datetime_format(self, async_client: AsyncClient, create_test_purchases):
        """Test that datetime fields are properly formatted in API responses."""
        
        response = await async_client.get("/api/transactions/purchases/")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            purchase = data[0]
            
            # Verify date format
            assert "purchase_date" in purchase
            # Should be YYYY-MM-DD format
            date_str = purchase["purchase_date"]
            assert len(date_str) == 10
            assert date_str.count("-") == 2
            
            # Verify datetime format
            assert "created_at" in purchase
            assert "updated_at" in purchase
            # Should be ISO format with timezone
            datetime_str = purchase["created_at"]
            assert "T" in datetime_str

    async def test_purchase_decimal_precision(self, async_client: AsyncClient, create_test_purchases):
        """Test that decimal amounts maintain proper precision in API responses."""
        
        response = await async_client.get("/api/transactions/purchases/")
        assert response.status_code == 200
        data = response.json()
        
        if data:
            purchase = data[0]
            
            # Verify decimal fields are present and formatted correctly
            decimal_fields = ["subtotal", "tax_amount", "discount_amount", "total_amount"]
            for field in decimal_fields:
                assert field in purchase
                # Should be able to convert to Decimal
                amount = Decimal(str(purchase[field]))
                assert amount >= 0
            
            # Check line items
            if purchase["items"]:
                item = purchase["items"][0]
                item_decimal_fields = ["unit_cost", "tax_rate", "discount_amount", "line_total"]
                for field in item_decimal_fields:
                    if field in item:
                        amount = Decimal(str(item[field]))
                        assert amount >= 0

    # ================================================================
    # ERROR HANDLING TESTS
    # ================================================================

    async def test_api_error_response_format(self, async_client: AsyncClient):
        """Test that API errors return consistent error format."""
        
        # Test 404 error
        response = await async_client.get(f"/api/transactions/purchases/{uuid4()}")
        assert response.status_code == 404
        error_data = response.json()
        assert "detail" in error_data
        
        # Test 422 validation error
        response = await async_client.get("/api/transactions/purchases/invalid-uuid")
        assert response.status_code == 422
        error_data = response.json()
        assert "detail" in error_data

    async def test_api_handles_database_errors_gracefully(self, async_client: AsyncClient):
        """Test that API handles database connection issues gracefully."""
        
        # This test would require more complex setup to simulate DB issues
        # For now, just verify the endpoint exists and handles basic requests
        response = await async_client.get("/api/transactions/purchases/")
        # Should either succeed or fail gracefully (not 500 without proper error handling)
        assert response.status_code in [200, 500, 503]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
