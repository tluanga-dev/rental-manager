"""
Comprehensive API endpoint tests for transaction features.

Tests all transaction API endpoints including purchase, sales,
rental, and return operations with authentication, validation,
and error handling.
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from fastapi import status

from app.main import app
from app.models.transaction import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    RentalStatus,
    LineItemType
)


class TestTransactionAPI:
    """Test suite for general transaction API endpoints."""

    @pytest.fixture
    def mock_transaction_data(self):
        return {
            "id": str(uuid4()),
            "transaction_number": "TXN-2025-001",
            "transaction_type": "SALE",
            "status": "COMPLETED",
            "customer_id": str(uuid4()),
            "location_id": str(uuid4()),
            "total_amount": "150.75",
            "payment_status": "PAID",
            "created_at": datetime.now().isoformat()
        }

    async def test_list_transactions_success(self, mock_auth_user, mock_transaction_data):
        """Test successful transaction listing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_transactions") as mock_get:
                
                mock_get.return_value = {
                    "items": [mock_transaction_data],
                    "total": 1,
                    "skip": 0,
                    "limit": 100
                }
                
                response = await ac.get("/api/v1/transactions/")
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["transaction_number"] == "TXN-2025-001"

    async def test_list_transactions_with_filters(self, mock_auth_user):
        """Test transaction listing with filters."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_transactions") as mock_get:
                
                mock_get.return_value = {
                    "items": [],
                    "total": 0,
                    "skip": 0,
                    "limit": 50
                }
                
                response = await ac.get(
                    "/api/v1/transactions/",
                    params={
                        "transaction_type": "SALE",
                        "status": "COMPLETED",
                        "start_date": "2025-01-01",
                        "end_date": "2025-01-31",
                        "limit": 50
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0

    async def test_get_transaction_by_id_success(self, mock_auth_user, mock_transaction_data):
        """Test retrieving specific transaction by ID."""
        transaction_id = mock_transaction_data["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_transaction") as mock_get:
                
                mock_get.return_value = mock_transaction_data
                
                response = await ac.get(f"/api/v1/transactions/{transaction_id}")
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == transaction_id
        assert data["transaction_number"] == "TXN-2025-001"

    async def test_get_transaction_by_id_not_found(self, mock_auth_user):
        """Test retrieving non-existent transaction."""
        transaction_id = str(uuid4())
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_transaction") as mock_get:
                
                mock_get.return_value = None
                
                response = await ac.get(f"/api/v1/transactions/{transaction_id}")
                
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_cancel_transaction_success(self, mock_auth_user):
        """Test successful transaction cancellation."""
        transaction_id = str(uuid4())
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.cancel_transaction") as mock_cancel:
                
                mock_cancel.return_value = {
                    "id": transaction_id,
                    "status": "CANCELLED",
                    "cancelled_at": datetime.now().isoformat()
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/{transaction_id}/cancel",
                    json={"reason": "Customer request"}
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "CANCELLED"

    async def test_apply_discount_success(self, mock_auth_user):
        """Test applying discount to transaction."""
        transaction_id = str(uuid4())
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.apply_discount") as mock_apply:
                
                mock_apply.return_value = {
                    "id": transaction_id,
                    "discount_amount": "25.00",
                    "total_amount": "125.00"
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/{transaction_id}/discount",
                    json={
                        "discount_amount": "25.00",
                        "discount_type": "fixed",
                        "reason": "Customer loyalty"
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["discount_amount"] == "25.00"

    async def test_get_transaction_statistics(self, mock_auth_user):
        """Test retrieving transaction statistics."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_statistics") as mock_stats:
                
                mock_stats.return_value = {
                    "total_transactions": 150,
                    "total_amount": "25000.00",
                    "completed_transactions": 120,
                    "pending_transactions": 20,
                    "cancelled_transactions": 10
                }
                
                response = await ac.get("/api/v1/transactions/statistics")
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_transactions"] == 150
        assert data["total_amount"] == "25000.00"


class TestPurchaseAPI:
    """Test suite for purchase transaction API endpoints."""

    @pytest.fixture
    def sample_purchase_data(self):
        return {
            "supplier_id": str(uuid4()),
            "location_id": str(uuid4()),
            "purchase_order_number": "PO-2025-001",
            "expected_delivery_date": (date.today() + timedelta(days=7)).isoformat(),
            "payment_terms": "NET30",
            "line_items": [
                {
                    "item_id": str(uuid4()),
                    "quantity": "10.00",
                    "unit_cost": "25.00",
                    "description": "Test item"
                }
            ]
        }

    async def test_create_purchase_order_success(self, mock_auth_user, sample_purchase_data):
        """Test successful purchase order creation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseService.create_purchase_order") as mock_create:
                
                mock_create.return_value = {
                    "id": str(uuid4()),
                    "transaction_number": "PUR-2025-001",
                    "status": "PENDING",
                    "total_amount": "250.00"
                }
                
                response = await ac.post("/api/v1/transactions/purchases/", json=sample_purchase_data)
                
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["transaction_number"] == "PUR-2025-001"
        assert data["total_amount"] == "250.00"

    async def test_create_purchase_order_validation_error(self, mock_auth_user):
        """Test purchase order creation with validation errors."""
        invalid_data = {
            "supplier_id": "invalid-uuid",  # Invalid UUID
            "location_id": str(uuid4()),
            "line_items": []  # Empty line items
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                
                response = await ac.post("/api/v1/transactions/purchases/", json=invalid_data)
                
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_receive_purchase_order_success(self, mock_auth_user):
        """Test successful purchase order receiving."""
        purchase_id = str(uuid4())
        
        receive_data = {
            "received_items": [
                {
                    "line_id": str(uuid4()),
                    "quantity_received": "10.00",
                    "condition": "excellent",
                    "notes": "All items in good condition"
                }
            ]
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseService.receive_purchase_order") as mock_receive:
                
                mock_receive.return_value = {
                    "purchase_id": purchase_id,
                    "status": "received",
                    "total_received": "10.00",
                    "inventory_updated": True
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/purchases/{purchase_id}/receive",
                    json=receive_data
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "received"
        assert data["inventory_updated"] is True

    async def test_list_purchase_orders(self, mock_auth_user):
        """Test listing purchase orders."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseService.get_purchase_orders") as mock_list:
                
                mock_list.return_value = {
                    "items": [
                        {
                            "id": str(uuid4()),
                            "transaction_number": "PUR-2025-001",
                            "supplier_id": str(uuid4()),
                            "status": "PENDING"
                        }
                    ],
                    "total": 1
                }
                
                response = await ac.get("/api/v1/transactions/purchases/")
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 1


class TestSalesAPI:
    """Test suite for sales transaction API endpoints."""

    @pytest.fixture
    def sample_sales_data(self):
        return {
            "customer_id": str(uuid4()),
            "location_id": str(uuid4()),
            "payment_method": "CREDIT_CARD",
            "line_items": [
                {
                    "item_id": str(uuid4()),
                    "quantity": "2.00",
                    "unit_price": "75.00",
                    "discount_amount": "5.00"
                }
            ],
            "notes": "Customer purchase"
        }

    async def test_create_sales_transaction_success(self, mock_auth_user, sample_sales_data):
        """Test successful sales transaction creation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.SalesService.create_sales_transaction") as mock_create:
                
                mock_create.return_value = {
                    "id": str(uuid4()),
                    "transaction_number": "SAL-2025-001",
                    "status": "COMPLETED",
                    "total_amount": "145.00"
                }
                
                response = await ac.post("/api/v1/transactions/sales/", json=sample_sales_data)
                
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["transaction_number"] == "SAL-2025-001"
        assert data["status"] == "COMPLETED"

    async def test_process_sales_payment_success(self, mock_auth_user):
        """Test successful sales payment processing."""
        sales_id = str(uuid4())
        
        payment_data = {
            "payment_amount": "145.00",
            "payment_method": "CREDIT_CARD",
            "card_reference": "CARD123"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.SalesService.process_payment") as mock_payment:
                
                mock_payment.return_value = {
                    "payment_successful": True,
                    "amount_processed": "145.00",
                    "receipt_number": "RCP-2025-001"
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/sales/{sales_id}/payment",
                    json=payment_data
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["payment_successful"] is True

    async def test_generate_sales_report(self, mock_auth_user):
        """Test sales report generation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.SalesService.generate_sales_report") as mock_report:
                
                mock_report.return_value = {
                    "period": "monthly",
                    "total_sales": "15000.00",
                    "total_transactions": 150,
                    "average_transaction_value": "100.00"
                }
                
                response = await ac.get(
                    "/api/v1/transactions/sales/reports/",
                    params={
                        "start_date": "2025-01-01",
                        "end_date": "2025-01-31"
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_sales"] == "15000.00"
        assert data["total_transactions"] == 150


class TestRentalAPI:
    """Test suite for rental transaction API endpoints."""

    @pytest.fixture
    def sample_rental_data(self):
        return {
            "customer_id": str(uuid4()),
            "location_id": str(uuid4()),
            "rental_start_date": date.today().isoformat(),
            "rental_end_date": (date.today() + timedelta(days=7)).isoformat(),
            "payment_method": "CREDIT_CARD",
            "pricing_strategy": "DAILY_RATE",
            "line_items": [
                {
                    "item_id": str(uuid4()),
                    "quantity": "1.00",
                    "daily_rate": "50.00",
                    "deposit_amount": "100.00"
                }
            ],
            "delivery_required": True,
            "delivery_address": "123 Main St"
        }

    async def test_create_rental_transaction_success(self, mock_auth_user, sample_rental_data):
        """Test successful rental transaction creation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.RentalService.create_rental_transaction") as mock_create:
                
                mock_create.return_value = {
                    "id": str(uuid4()),
                    "transaction_number": "RNT-2025-001",
                    "rental_status": "ACTIVE",
                    "total_amount": "450.00"
                }
                
                response = await ac.post("/api/v1/transactions/rentals/", json=sample_rental_data)
                
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["transaction_number"] == "RNT-2025-001"
        assert data["rental_status"] == "ACTIVE"

    async def test_extend_rental_period_success(self, mock_auth_user):
        """Test successful rental period extension."""
        rental_id = str(uuid4())
        
        extend_data = {
            "additional_days": 3,
            "daily_rate": "50.00",
            "reason": "Customer request"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.RentalService.extend_rental_period") as mock_extend:
                
                mock_extend.return_value = {
                    "rental_id": rental_id,
                    "new_end_date": (date.today() + timedelta(days=10)).isoformat(),
                    "additional_cost": "150.00",
                    "total_cost": "600.00"
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/rentals/{rental_id}/extend",
                    json=extend_data
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["additional_cost"] == "150.00"

    async def test_process_rental_return_success(self, mock_auth_user):
        """Test successful rental return processing."""
        rental_id = str(uuid4())
        
        return_data = {
            "return_date": date.today().isoformat(),
            "items": [
                {
                    "line_id": str(uuid4()),
                    "condition": "good",
                    "damage_notes": "Minor scuff"
                }
            ],
            "early_return": True
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.RentalService.process_rental_return") as mock_return:
                
                mock_return.return_value = {
                    "rental_id": rental_id,
                    "return_processed": True,
                    "deposit_refund": "95.00",
                    "early_return_credit": "25.00"
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/rentals/{rental_id}/return",
                    json=return_data
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["return_processed"] is True
        assert data["deposit_refund"] == "95.00"

    async def test_check_item_availability(self, mock_auth_user):
        """Test checking item availability for rental."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.RentalService.check_item_availability") as mock_check:
                
                mock_check.return_value = {
                    "available": True,
                    "quantity_available": "5.00",
                    "conflicting_rentals": []
                }
                
                response = await ac.get(
                    "/api/v1/transactions/rentals/availability",
                    params={
                        "item_id": str(uuid4()),
                        "location_id": str(uuid4()),
                        "start_date": date.today().isoformat(),
                        "end_date": (date.today() + timedelta(days=7)).isoformat(),
                        "quantity_needed": "2.00"
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["available"] is True
        assert data["quantity_available"] == "5.00"

    async def test_calculate_rental_pricing(self, mock_auth_user):
        """Test rental pricing calculation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.RentalService.calculate_rental_pricing") as mock_calculate:
                
                mock_calculate.return_value = {
                    "base_cost": "350.00",
                    "discount_amount": "35.00",
                    "final_rental_cost": "315.00",
                    "deposit_amount": "100.00",
                    "total_due": "415.00"
                }
                
                response = await ac.post(
                    "/api/v1/transactions/rentals/calculate-pricing",
                    json={
                        "item_id": str(uuid4()),
                        "rental_period": 7,
                        "pricing_strategy": "DAILY_RATE",
                        "daily_rate": "50.00"
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["final_rental_cost"] == "315.00"
        assert data["total_due"] == "415.00"


class TestPurchaseReturnsAPI:
    """Test suite for purchase return API endpoints."""

    @pytest.fixture
    def sample_return_data(self):
        return {
            "original_purchase_id": str(uuid4()),
            "return_type": "DEFECTIVE",
            "supplier_id": str(uuid4()),
            "return_items": [
                {
                    "line_id": str(uuid4()),
                    "quantity_returned": "2.00",
                    "return_reason": "Defective items",
                    "condition": "damaged"
                }
            ],
            "return_shipping_cost": "25.00",
            "restocking_fee": "10.00"
        }

    async def test_create_purchase_return_success(self, mock_auth_user, sample_return_data):
        """Test successful purchase return creation."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseReturnsService.create_purchase_return") as mock_create:
                
                mock_create.return_value = {
                    "id": str(uuid4()),
                    "transaction_number": "RTN-2025-001",
                    "status": "PENDING",
                    "refund_amount": "115.00"
                }
                
                response = await ac.post("/api/v1/transactions/returns/", json=sample_return_data)
                
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["transaction_number"] == "RTN-2025-001"
        assert data["refund_amount"] == "115.00"

    async def test_process_return_refund_success(self, mock_auth_user):
        """Test successful return refund processing."""
        return_id = str(uuid4())
        
        refund_data = {
            "refund_method": "credit_card",
            "notes": "Refund processed successfully"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseReturnsService.process_refund") as mock_refund:
                
                mock_refund.return_value = {
                    "refund_processed": True,
                    "refund_amount": "115.00",
                    "refund_reference": "REF123456"
                }
                
                response = await ac.post(
                    f"/api/v1/transactions/returns/{return_id}/refund",
                    json=refund_data
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["refund_processed"] is True
        assert data["refund_amount"] == "115.00"

    async def test_validate_return_eligibility(self, mock_auth_user):
        """Test return eligibility validation."""
        purchase_id = str(uuid4())
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.PurchaseReturnsService.validate_return_eligibility") as mock_validate:
                
                mock_validate.return_value = {
                    "eligible": True,
                    "days_since_purchase": 15,
                    "return_window_days": 30,
                    "restrictions": []
                }
                
                response = await ac.get(
                    f"/api/v1/transactions/returns/validate/{purchase_id}",
                    params={
                        "return_items": [{"line_id": str(uuid4()), "quantity": "1.00"}]
                    }
                )
                
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["eligible"] is True
        assert data["days_since_purchase"] == 15


class TestTransactionAPIErrorHandling:
    """Test suite for transaction API error handling."""

    async def test_unauthorized_access(self):
        """Test unauthorized access to transaction endpoints."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.get("/api/v1/transactions/")
            
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_invalid_transaction_id_format(self, mock_auth_user):
        """Test invalid transaction ID format."""
        invalid_id = "invalid-uuid-format"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                
                response = await ac.get(f"/api/v1/transactions/{invalid_id}")
                
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_service_unavailable_error(self, mock_auth_user):
        """Test service unavailable error handling."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.get_transactions") as mock_get:
                
                mock_get.side_effect = Exception("Database connection error")
                
                response = await ac.get("/api/v1/transactions/")
                
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    async def test_validation_error_empty_request_body(self, mock_auth_user):
        """Test validation error with empty request body."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                
                response = await ac.post("/api/v1/transactions/sales/", json={})
                
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_business_rule_violation_error(self, mock_auth_user):
        """Test business rule violation error handling."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.transaction.TransactionService.cancel_transaction") as mock_cancel:
                
                mock_cancel.side_effect = ValueError("Cannot cancel completed transaction")
                
                response = await ac.post(
                    f"/api/v1/transactions/{uuid4()}/cancel",
                    json={"reason": "Test cancellation"}
                )
                
        assert response.status_code == status.HTTP_400_BAD_REQUEST