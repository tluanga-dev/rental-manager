"""
Comprehensive sales service tests for 100% coverage.
Tests all async methods, business logic, and error handling.
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.transaction.sales_service import SalesService
from app.schemas.transaction.sales import (
    SalesCreate,
    SalesItemCreate,
    SalesPaymentCreate,
    SalesDiscountCreate,
    SalesUpdate,
)
from app.models.transaction.enums import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    DiscountType,
)
from app.core.errors import ValidationError, NotFoundError, ConflictError


class TestSalesServiceComplete:
    """Complete test coverage for SalesService."""
    
    @pytest.fixture
    def mock_session(self):
        """Mock database session."""
        return AsyncMock()
    
    @pytest.fixture
    def sales_service(self, mock_session):
        """Sales service instance with mocked dependencies."""
        service = SalesService(mock_session)
        service.transaction_repo = AsyncMock()
        service.customer_repo = AsyncMock()
        service.location_repo = AsyncMock()
        service.item_repo = AsyncMock()
        return service
    
    @pytest.fixture
    def sample_sales_data(self):
        """Sample sales data for testing."""
        return SalesCreate(
            customer_id=uuid4(),
            location_id=uuid4(),
            reference_number="SO-2024-001",
            sales_date=datetime.now(timezone.utc),
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            payment_terms="Net 30",
            items=[
                SalesItemCreate(
                    item_id=uuid4(),
                    quantity=2,
                    unit_price=Decimal("100.00"),
                    discount_amount=Decimal("10.00"),
                    tax_amount=Decimal("18.00")
                ),
                SalesItemCreate(
                    item_id=uuid4(),
                    quantity=1,
                    unit_price=Decimal("50.00"),
                    tax_amount=Decimal("5.00")
                )
            ],
            discounts=[
                SalesDiscountCreate(
                    discount_type=DiscountType.PERCENTAGE,
                    value=Decimal("5.00"),
                    reason="Early payment discount"
                )
            ],
            notes="Rush order"
        )
    
    @pytest.mark.asyncio
    async def test_create_sales_success(self, sales_service, sample_sales_data):
        """Test successful sales creation."""
        # Mock validation methods
        sales_service._validate_sales_data = AsyncMock(return_value=[])
        sales_service._check_stock_availability = AsyncMock(return_value=[])
        sales_service._generate_transaction_number = AsyncMock(return_value="SALE-20240122-001")
        sales_service._calculate_sales_pricing = MagicMock(return_value={
            "subtotal": Decimal("240.00"),
            "discount_amount": Decimal("22.00"),
            "tax_amount": Decimal("23.00"),
            "total_amount": Decimal("241.00")
        })
        
        # Mock repository methods
        mock_transaction = MagicMock()
        mock_transaction.id = uuid4()
        sales_service.transaction_repo.create.return_value = mock_transaction
        sales_service.session.commit = AsyncMock()
        sales_service.session.refresh = AsyncMock()
        
        # Execute
        result = await sales_service.create_sales(sample_sales_data)
        
        # Verify
        assert result is not None
        sales_service._validate_sales_data.assert_called_once()
        sales_service._check_stock_availability.assert_called_once()
        sales_service.transaction_repo.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_sales_validation_failure(self, sales_service, sample_sales_data):
        """Test sales creation with validation errors."""
        # Mock validation to return errors
        validation_errors = ["Customer not found", "Location inactive"]
        sales_service._validate_sales_data = AsyncMock(return_value=validation_errors)
        
        # Execute and verify exception
        with pytest.raises(ValidationError) as exc_info:
            await sales_service.create_sales(sample_sales_data)
        
        assert "Sales validation failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_create_sales_stock_unavailable(self, sales_service, sample_sales_data):
        """Test sales creation with insufficient stock."""
        # Mock validation to pass but stock check to fail
        sales_service._validate_sales_data = AsyncMock(return_value=[])
        stock_issues = [{"item_id": str(uuid4()), "available": 1, "requested": 5}]
        sales_service._check_stock_availability = AsyncMock(return_value=stock_issues)
        
        # Execute and verify exception
        with pytest.raises(ConflictError) as exc_info:
            await sales_service.create_sales(sample_sales_data)
        
        assert "Insufficient stock" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_create_sales_credit_check_failure(self, sales_service, sample_sales_data):
        """Test sales creation with credit check failure."""
        # Modify sample data to use credit account
        sample_sales_data.payment_method = PaymentMethod.CREDIT_ACCOUNT
        
        # Mock validation and stock to pass
        sales_service._validate_sales_data = AsyncMock(return_value=[])
        sales_service._check_stock_availability = AsyncMock(return_value=[])
        
        # Mock credit check to fail
        credit_check_result = {
            "approved": False,
            "reason": "Credit limit exceeded",
            "available_credit": Decimal("0.00")
        }
        sales_service._check_customer_credit = AsyncMock(return_value=credit_check_result)
        
        # Execute and verify exception
        with pytest.raises(ValidationError) as exc_info:
            await sales_service.create_sales(sample_sales_data)
        
        assert "Customer credit check failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_sales_data(self, sales_service, sample_sales_data):
        """Test sales data validation."""
        # Mock repository responses
        sales_service.customer_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.location_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.item_repo.get_by_id.return_value = MagicMock(is_active=True, is_salable=True)
        
        # Execute
        errors = await sales_service._validate_sales_data(sample_sales_data)
        
        # Verify no errors
        assert errors == []
    
    @pytest.mark.asyncio
    async def test_validate_sales_data_customer_not_found(self, sales_service, sample_sales_data):
        """Test validation with missing customer."""
        # Mock customer as not found
        sales_service.customer_repo.get_by_id.return_value = None
        sales_service.location_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.item_repo.get_by_id.return_value = MagicMock(is_active=True, is_salable=True)
        
        # Execute
        errors = await sales_service._validate_sales_data(sample_sales_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Customer not found" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_sales_data_inactive_location(self, sales_service, sample_sales_data):
        """Test validation with inactive location."""
        # Mock inactive location
        sales_service.customer_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.location_repo.get_by_id.return_value = MagicMock(is_active=False)
        sales_service.item_repo.get_by_id.return_value = MagicMock(is_active=True, is_salable=True)
        
        # Execute
        errors = await sales_service._validate_sales_data(sample_sales_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Location is inactive" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_sales_data_non_salable_item(self, sales_service, sample_sales_data):
        """Test validation with non-salable item."""
        # Mock non-salable item
        sales_service.customer_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.location_repo.get_by_id.return_value = MagicMock(is_active=True)
        sales_service.item_repo.get_by_id.return_value = MagicMock(is_active=True, is_salable=False)
        
        # Execute
        errors = await sales_service._validate_sales_data(sample_sales_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Item is not available for sale" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_check_stock_availability_sufficient(self, sales_service):
        """Test stock availability check with sufficient stock."""
        items = [
            SalesItemCreate(item_id=uuid4(), quantity=2, unit_price=Decimal("50.00"))
        ]
        location_id = uuid4()
        
        # Mock sufficient stock
        mock_stock = MagicMock()
        mock_stock.available_quantity = 10
        sales_service.item_repo.get_stock_by_location.return_value = mock_stock
        
        # Execute
        issues = await sales_service._check_stock_availability(items, location_id)
        
        # Verify no issues
        assert issues == []
    
    @pytest.mark.asyncio
    async def test_check_stock_availability_insufficient(self, sales_service):
        """Test stock availability check with insufficient stock."""
        item_id = uuid4()
        items = [
            SalesItemCreate(item_id=item_id, quantity=10, unit_price=Decimal("50.00"))
        ]
        location_id = uuid4()
        
        # Mock insufficient stock
        mock_stock = MagicMock()
        mock_stock.available_quantity = 5
        sales_service.item_repo.get_stock_by_location.return_value = mock_stock
        
        # Execute
        issues = await sales_service._check_stock_availability(items, location_id)
        
        # Verify issues found
        assert len(issues) > 0
        assert issues[0]["item_id"] == str(item_id)
        assert issues[0]["requested"] == 10
        assert issues[0]["available"] == 5
    
    @pytest.mark.asyncio
    async def test_check_customer_credit_approved(self, sales_service):
        """Test customer credit check - approved."""
        customer_id = uuid4()
        items = [
            SalesItemCreate(item_id=uuid4(), quantity=1, unit_price=Decimal("100.00"))
        ]
        
        # Mock customer with sufficient credit
        mock_customer = MagicMock()
        mock_customer.credit_limit = Decimal("5000.00")
        mock_customer.current_balance = Decimal("1000.00")
        sales_service.customer_repo.get_by_id.return_value = mock_customer
        
        # Execute
        result = await sales_service._check_customer_credit(customer_id, items)
        
        # Verify approval
        assert result["approved"] is True
        assert result["available_credit"] == Decimal("4000.00")
    
    @pytest.mark.asyncio
    async def test_check_customer_credit_declined(self, sales_service):
        """Test customer credit check - declined."""
        customer_id = uuid4()
        items = [
            SalesItemCreate(item_id=uuid4(), quantity=1, unit_price=Decimal("5000.00"))
        ]
        
        # Mock customer with insufficient credit
        mock_customer = MagicMock()
        mock_customer.credit_limit = Decimal("1000.00")
        mock_customer.current_balance = Decimal("800.00")
        sales_service.customer_repo.get_by_id.return_value = mock_customer
        
        # Execute
        result = await sales_service._check_customer_credit(customer_id, items)
        
        # Verify decline
        assert result["approved"] is False
        assert "Credit limit exceeded" in result["reason"]
    
    def test_calculate_sales_pricing(self, sales_service):
        """Test sales pricing calculation."""
        items = [
            SalesItemCreate(
                item_id=uuid4(),
                quantity=2,
                unit_price=Decimal("100.00"),
                discount_amount=Decimal("10.00"),
                tax_amount=Decimal("18.00")
            ),
            SalesItemCreate(
                item_id=uuid4(),
                quantity=1,
                unit_price=Decimal("50.00"),
                tax_amount=Decimal("5.00")
            )
        ]
        
        # Execute
        result = sales_service._calculate_sales_pricing(
            items,
            discount_amount=Decimal("5.00"),
            discount_percent=None
        )
        
        # Verify calculations
        # Item totals: (2 * 100 - 10 + 18) + (1 * 50 + 5) = 208 + 55 = 263
        # Less order discount: 263 - 5 = 258
        assert result["subtotal"] == Decimal("250.00")  # Before item discounts and taxes
        assert result["total_amount"] == Decimal("258.00")
    
    def test_calculate_sales_pricing_with_percentage_discount(self, sales_service):
        """Test sales pricing with percentage discount."""
        items = [
            SalesItemCreate(
                item_id=uuid4(),
                quantity=1,
                unit_price=Decimal("100.00")
            )
        ]
        
        # Execute with 10% discount
        result = sales_service._calculate_sales_pricing(
            items,
            discount_amount=None,
            discount_percent=Decimal("10.00")
        )
        
        # Verify 10% discount applied
        assert result["discount_amount"] == Decimal("10.00")
        assert result["total_amount"] == Decimal("90.00")
    
    @pytest.mark.asyncio
    async def test_generate_transaction_number(self, sales_service):
        """Test transaction number generation."""
        with patch('app.services.transaction.sales_service.datetime') as mock_dt:
            mock_dt.now.return_value.strftime.return_value = "20240122123456"
            
            result = await sales_service._generate_transaction_number()
            
            assert result == "SALE-20240122123456"
    
    @pytest.mark.asyncio
    async def test_process_payment_success(self, sales_service):
        """Test successful payment processing."""
        transaction_id = uuid4()
        payment_data = SalesPaymentCreate(
            amount=Decimal("100.00"),
            payment_method=PaymentMethod.CREDIT_CARD,
            reference_number="CC-123456"
        )
        
        # Mock transaction retrieval
        mock_transaction = MagicMock()
        mock_transaction.total_amount = Decimal("150.00")
        mock_transaction.paid_amount = Decimal("50.00")
        mock_transaction.payment_status = PaymentStatus.PARTIAL
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        
        # Mock payment creation
        mock_payment = MagicMock()
        sales_service.transaction_repo.create_payment.return_value = mock_payment
        sales_service.session.commit = AsyncMock()
        
        # Execute
        result = await sales_service.process_payment(transaction_id, payment_data)
        
        # Verify
        assert result is not None
        sales_service.transaction_repo.create_payment.assert_called_once()
        assert mock_transaction.paid_amount == Decimal("150.00")  # 50 + 100
        assert mock_transaction.payment_status == PaymentStatus.PAID
    
    @pytest.mark.asyncio
    async def test_process_payment_transaction_not_found(self, sales_service):
        """Test payment processing with missing transaction."""
        transaction_id = uuid4()
        payment_data = SalesPaymentCreate(
            amount=Decimal("100.00"),
            payment_method=PaymentMethod.CASH
        )
        
        # Mock transaction not found
        sales_service.transaction_repo.get_by_id.return_value = None
        
        # Execute and verify exception
        with pytest.raises(NotFoundError):
            await sales_service.process_payment(transaction_id, payment_data)
    
    @pytest.mark.asyncio
    async def test_process_payment_overpayment(self, sales_service):
        """Test payment processing with overpayment."""
        transaction_id = uuid4()
        payment_data = SalesPaymentCreate(
            amount=Decimal("200.00"),
            payment_method=PaymentMethod.CASH
        )
        
        # Mock transaction with lower balance
        mock_transaction = MagicMock()
        mock_transaction.total_amount = Decimal("100.00")
        mock_transaction.paid_amount = Decimal("0.00")
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        
        # Execute and verify exception
        with pytest.raises(ValidationError, match="Payment amount exceeds balance due"):
            await sales_service.process_payment(transaction_id, payment_data)
    
    @pytest.mark.asyncio
    async def test_update_sales_status_success(self, sales_service):
        """Test successful sales status update."""
        transaction_id = uuid4()
        new_status = TransactionStatus.COMPLETED
        notes = "Order completed successfully"
        
        # Mock transaction retrieval
        mock_transaction = MagicMock()
        mock_transaction.status = TransactionStatus.PROCESSING
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        sales_service.session.commit = AsyncMock()
        
        # Execute
        result = await sales_service.update_status(transaction_id, new_status, notes)
        
        # Verify
        assert result is not None
        assert mock_transaction.status == new_status
    
    @pytest.mark.asyncio
    async def test_cancel_sales_order_success(self, sales_service):
        """Test successful sales order cancellation."""
        transaction_id = uuid4()
        reason = "Customer requested cancellation"
        
        # Mock transaction retrieval
        mock_transaction = MagicMock()
        mock_transaction.status = TransactionStatus.PENDING
        mock_transaction.can_be_cancelled.return_value = True
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        sales_service.session.commit = AsyncMock()
        
        # Execute
        result = await sales_service.cancel_sales_order(transaction_id, reason)
        
        # Verify
        assert result is not None
        assert mock_transaction.status == TransactionStatus.CANCELLED
    
    @pytest.mark.asyncio
    async def test_cancel_sales_order_cannot_cancel(self, sales_service):
        """Test sales cancellation when not allowed."""
        transaction_id = uuid4()
        reason = "Cannot cancel"
        
        # Mock transaction that cannot be cancelled
        mock_transaction = MagicMock()
        mock_transaction.status = TransactionStatus.COMPLETED
        mock_transaction.can_be_cancelled.return_value = False
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        
        # Execute and verify exception
        with pytest.raises(ValidationError, match="Sales order cannot be cancelled"):
            await sales_service.cancel_sales_order(transaction_id, reason)
    
    @pytest.mark.asyncio
    async def test_get_sales_by_id_success(self, sales_service):
        """Test successful sales retrieval by ID."""
        transaction_id = uuid4()
        
        # Mock transaction retrieval
        mock_transaction = MagicMock()
        sales_service.transaction_repo.get_by_id.return_value = mock_transaction
        
        # Execute
        result = await sales_service.get_sales_by_id(transaction_id)
        
        # Verify
        assert result == mock_transaction
        sales_service.transaction_repo.get_by_id.assert_called_once_with(
            transaction_id, include_lines=True, include_payments=True
        )
    
    @pytest.mark.asyncio
    async def test_get_sales_by_id_not_found(self, sales_service):
        """Test sales retrieval with missing transaction."""
        transaction_id = uuid4()
        
        # Mock transaction not found
        sales_service.transaction_repo.get_by_id.return_value = None
        
        # Execute and verify exception
        with pytest.raises(NotFoundError):
            await sales_service.get_sales_by_id(transaction_id)
    
    @pytest.mark.asyncio
    async def test_list_sales_with_filters(self, sales_service):
        """Test sales listing with filters."""
        # Mock repository response
        mock_sales_list = [MagicMock(), MagicMock()]
        sales_service.transaction_repo.list_sales.return_value = mock_sales_list
        
        # Execute with filters
        result = await sales_service.list_sales(
            customer_id=uuid4(),
            location_id=uuid4(),
            status=TransactionStatus.COMPLETED,
            date_from=datetime.now(timezone.utc) - timedelta(days=30),
            date_to=datetime.now(timezone.utc),
            skip=0,
            limit=50
        )
        
        # Verify
        assert len(result) == 2
        sales_service.transaction_repo.list_sales.assert_called_once()
    
    def test_calculate_totals_helper_method(self, sales_service):
        """Test _calculate_totals helper method."""
        items = [
            {"quantity": 2, "unit_price": "100.00", "discount_amount": "10.00", "tax_amount": "18.00"},
            {"quantity": 1, "unit_price": "50.00", "tax_amount": "5.00"}
        ]
        discounts = [
            {"type": "PERCENTAGE", "value": "5.00"}
        ]
        
        result = sales_service._calculate_totals(items, discounts)
        
        assert "subtotal" in result
        assert "total_amount" in result
        assert "discount_amount" in result
        assert "tax_amount" in result
        assert result["subtotal"] > 0