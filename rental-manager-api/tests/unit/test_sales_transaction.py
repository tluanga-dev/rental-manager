"""
Unit tests for sales transaction service.
Tests sales order creation, payment processing, and credit checking.
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.transaction.sales_service import SalesService
from app.schemas.transaction.sales import (
    SalesCreate,
    SalesItemCreate,
    SalesPaymentCreate,
    SalesDiscountCreate,
)
from app.models.transaction.enums import (
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    DiscountType,
)


@pytest.fixture
def sales_service():
    """Create sales service instance with mocked dependencies."""
    mock_db = AsyncMock()
    mock_crud = MagicMock()
    mock_event_service = AsyncMock()
    
    service = SalesService(mock_db)
    service.crud = mock_crud
    service.event_service = mock_event_service
    
    return service


@pytest.fixture
def sample_sales_data():
    """Sample sales transaction data for testing."""
    return SalesCreate(
        customer_id=uuid4(),
        location_id=uuid4(),
        reference_number="SO-2024-001",
        sales_date=datetime.utcnow(),
        due_date=datetime.utcnow() + timedelta(days=30),
        payment_terms="Net 30",
        salesperson_id=uuid4(),
        items=[
            SalesItemCreate(
                item_id=uuid4(),
                quantity=5,
                unit_price=Decimal("100.00"),
                discount_amount=Decimal("25.00"),
                tax_amount=Decimal("37.50"),
            ),
            SalesItemCreate(
                item_id=uuid4(),
                quantity=3,
                unit_price=Decimal("50.00"),
                discount_amount=Decimal("0.00"),
                tax_amount=Decimal("11.25"),
            ),
        ],
        discounts=[
            SalesDiscountCreate(
                discount_type=DiscountType.PERCENTAGE,
                value=Decimal("10.00"),
                reason="Loyalty discount",
            )
        ],
        shipping_address="123 Main St, City, State 12345",
        billing_address="456 Oak Ave, City, State 12345",
        notes="Rush order - expedite shipping",
    )


@pytest.fixture
def mock_customer():
    """Mock customer data."""
    customer = MagicMock()
    customer.id = uuid4()
    customer.name = "Test Customer"
    customer.credit_limit = Decimal("10000.00")
    customer.current_balance = Decimal("2000.00")
    customer.payment_terms = "Net 30"
    customer.is_active = True
    return customer


@pytest.fixture
def mock_items():
    """Mock item data."""
    items = []
    for i in range(2):
        item = MagicMock()
        item.id = uuid4()
        item.name = f"Test Item {i+1}"
        item.sku = f"ITEM-{i+1:03d}"
        item.quantity_on_hand = 100
        item.unit_price = Decimal("100.00") if i == 0 else Decimal("50.00")
        item.is_active = True
        items.append(item)
    return items


class TestSalesService:
    """Test suite for sales service."""
    
    @pytest.mark.asyncio
    async def test_create_sales_order_success(
        self, sales_service, sample_sales_data, mock_customer, mock_items
    ):
        """Test successful sales order creation."""
        # Setup mocks
        sales_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        sales_service.crud.item.get_multi = AsyncMock(return_value=mock_items)
        sales_service._check_customer_credit = AsyncMock(
            return_value={"approved": True}
        )
        sales_service._check_stock_availability = AsyncMock(return_value=True)
        
        mock_sales = MagicMock()
        mock_sales.id = uuid4()
        mock_sales.transaction_number = "SO-2024-001"
        mock_sales.total_amount = Decimal("623.75")
        sales_service.crud.sales.create = AsyncMock(return_value=mock_sales)
        
        # Execute
        result = await sales_service.create_sales_order(
            sample_sales_data, user_id=uuid4()
        )
        
        # Assert
        assert result.id == mock_sales.id
        assert result.transaction_number == "SO-2024-001"
        sales_service._check_customer_credit.assert_called_once()
        sales_service._check_stock_availability.assert_called_once()
        sales_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_create_sales_order_credit_denied(
        self, sales_service, sample_sales_data, mock_customer
    ):
        """Test sales order creation with credit denial."""
        # Setup mocks
        sales_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        sales_service._check_customer_credit = AsyncMock(
            return_value={
                "approved": False,
                "reason": "Exceeds credit limit",
                "suggested_payment": Decimal("1000.00"),
            }
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Credit check failed"):
            await sales_service.create_sales_order(
                sample_sales_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_create_sales_order_insufficient_stock(
        self, sales_service, sample_sales_data, mock_customer, mock_items
    ):
        """Test sales order creation with insufficient stock."""
        # Setup mocks
        mock_items[0].quantity_on_hand = 2  # Less than requested 5
        sales_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        sales_service.crud.item.get_multi = AsyncMock(return_value=mock_items)
        sales_service._check_customer_credit = AsyncMock(
            return_value={"approved": True}
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Insufficient stock"):
            await sales_service.create_sales_order(
                sample_sales_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_process_payment_full(self, sales_service):
        """Test processing full payment for sales order."""
        # Setup mock sales order
        mock_sales = MagicMock()
        mock_sales.id = uuid4()
        mock_sales.total_amount = Decimal("500.00")
        mock_sales.paid_amount = Decimal("0.00")
        mock_sales.balance_amount = Decimal("500.00")
        mock_sales.payment_status = PaymentStatus.PENDING
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        sales_service.crud.sales.update = AsyncMock(return_value=mock_sales)
        
        payment_data = SalesPaymentCreate(
            amount=Decimal("500.00"),
            payment_method=PaymentMethod.CREDIT_CARD,
            reference_number="CC-123456",
        )
        
        # Execute
        result = await sales_service.process_payment(
            mock_sales.id, payment_data, user_id=uuid4()
        )
        
        # Assert
        assert result.payment_status == PaymentStatus.PAID
        assert result.paid_amount == Decimal("500.00")
        assert result.balance_amount == Decimal("0.00")
        sales_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_payment_partial(self, sales_service):
        """Test processing partial payment for sales order."""
        # Setup mock sales order
        mock_sales = MagicMock()
        mock_sales.id = uuid4()
        mock_sales.total_amount = Decimal("500.00")
        mock_sales.paid_amount = Decimal("0.00")
        mock_sales.balance_amount = Decimal("500.00")
        mock_sales.payment_status = PaymentStatus.PENDING
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        sales_service.crud.sales.update = AsyncMock(return_value=mock_sales)
        
        payment_data = SalesPaymentCreate(
            amount=Decimal("200.00"),
            payment_method=PaymentMethod.CASH,
        )
        
        # Execute
        result = await sales_service.process_payment(
            mock_sales.id, payment_data, user_id=uuid4()
        )
        
        # Assert
        assert result.payment_status == PaymentStatus.PARTIAL
        assert result.paid_amount == Decimal("200.00")
        assert result.balance_amount == Decimal("300.00")
    
    @pytest.mark.asyncio
    async def test_process_payment_overpayment(self, sales_service):
        """Test handling overpayment for sales order."""
        # Setup mock sales order
        mock_sales = MagicMock()
        mock_sales.id = uuid4()
        mock_sales.total_amount = Decimal("500.00")
        mock_sales.balance_amount = Decimal("500.00")
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        
        payment_data = SalesPaymentCreate(
            amount=Decimal("600.00"),
            payment_method=PaymentMethod.CREDIT_CARD,
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="exceeds balance"):
            await sales_service.process_payment(
                mock_sales.id, payment_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_calculate_totals_with_discounts(self, sales_service):
        """Test total calculation with multiple discounts."""
        items = [
            {"quantity": 5, "unit_price": Decimal("100.00"), "discount_amount": Decimal("25.00")},
            {"quantity": 3, "unit_price": Decimal("50.00"), "discount_amount": Decimal("0.00")},
        ]
        
        discounts = [
            {"type": DiscountType.PERCENTAGE, "value": Decimal("10.00")},
            {"type": DiscountType.FIXED, "value": Decimal("50.00")},
        ]
        
        # Execute
        totals = sales_service._calculate_totals(items, discounts)
        
        # Assert
        assert totals["subtotal"] == Decimal("625.00")  # (5*100 - 25) + (3*50)
        assert totals["discount_total"] == Decimal("112.50")  # 10% of 625 + 50
        assert totals["total"] == Decimal("512.50")  # 625 - 112.50
    
    @pytest.mark.asyncio
    async def test_check_customer_credit_approved(self, sales_service):
        """Test customer credit check approval."""
        customer_id = uuid4()
        mock_customer = MagicMock()
        mock_customer.credit_limit = Decimal("10000.00")
        mock_customer.current_balance = Decimal("2000.00")
        
        sales_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        
        items = [
            SalesItemCreate(
                item_id=uuid4(),
                quantity=5,
                unit_price=Decimal("100.00"),
            )
        ]
        
        # Execute
        result = await sales_service._check_customer_credit(customer_id, items)
        
        # Assert
        assert result["approved"] is True
        assert result["available_credit"] == Decimal("8000.00")
        assert result["order_amount"] == Decimal("500.00")
    
    @pytest.mark.asyncio
    async def test_check_customer_credit_denied(self, sales_service):
        """Test customer credit check denial."""
        customer_id = uuid4()
        mock_customer = MagicMock()
        mock_customer.credit_limit = Decimal("1000.00")
        mock_customer.current_balance = Decimal("800.00")
        
        sales_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        
        items = [
            SalesItemCreate(
                item_id=uuid4(),
                quantity=5,
                unit_price=Decimal("100.00"),
            )
        ]
        
        # Execute
        result = await sales_service._check_customer_credit(customer_id, items)
        
        # Assert
        assert result["approved"] is False
        assert result["reason"] == "Exceeds credit limit"
        assert result["suggested_payment"] == Decimal("300.00")
    
    @pytest.mark.asyncio
    async def test_update_sales_status(self, sales_service):
        """Test updating sales order status."""
        sales_id = uuid4()
        mock_sales = MagicMock()
        mock_sales.id = sales_id
        mock_sales.status = TransactionStatus.PENDING
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        sales_service.crud.sales.update = AsyncMock(return_value=mock_sales)
        
        # Execute
        result = await sales_service.update_status(
            sales_id,
            TransactionStatus.APPROVED,
            user_id=uuid4(),
        )
        
        # Assert
        assert result.status == TransactionStatus.APPROVED
        sales_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_cancel_sales_order(self, sales_service):
        """Test canceling a sales order."""
        sales_id = uuid4()
        mock_sales = MagicMock()
        mock_sales.id = sales_id
        mock_sales.status = TransactionStatus.PENDING
        mock_sales.payment_status = PaymentStatus.PENDING
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        sales_service.crud.sales.update = AsyncMock(return_value=mock_sales)
        sales_service._reverse_inventory_allocation = AsyncMock()
        
        # Execute
        result = await sales_service.cancel_sales_order(
            sales_id,
            reason="Customer request",
            user_id=uuid4(),
        )
        
        # Assert
        assert result.status == TransactionStatus.CANCELLED
        sales_service._reverse_inventory_allocation.assert_called_once()
        sales_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_cancel_sales_order_with_payment(self, sales_service):
        """Test preventing cancellation of paid sales order."""
        sales_id = uuid4()
        mock_sales = MagicMock()
        mock_sales.id = sales_id
        mock_sales.payment_status = PaymentStatus.PAID
        
        sales_service.crud.sales.get = AsyncMock(return_value=mock_sales)
        
        # Execute and assert
        with pytest.raises(ValueError, match="Cannot cancel paid order"):
            await sales_service.cancel_sales_order(
                sales_id,
                reason="Customer request",
                user_id=uuid4(),
            )