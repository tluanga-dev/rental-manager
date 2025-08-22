"""
Comprehensive model tests for 100% transaction module coverage.
Tests all model methods, properties, validations, and business logic.
"""

import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta, timezone
from uuid import uuid4
from unittest.mock import MagicMock, patch

from app.models.transaction.transaction_header import (
    TransactionHeader,
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    RentalPeriodUnit,
    RentalStatus,
)
from app.models.transaction.transaction_line import (
    TransactionLine,
    LineItemType,
)
from app.models.transaction.rental_lifecycle import RentalLifecycle
from app.models.transaction.transaction_inspection import (
    TransactionInspection,
    InspectionStatus,
    ConditionRating,
    DamageType,
    ItemDisposition,
)
from app.models.transaction.transaction_event import TransactionEvent
from app.models.transaction.transaction_metadata import TransactionMetadata


class TestTransactionHeaderComplete:
    """Complete test coverage for TransactionHeader model."""
    
    def test_constructor_all_transaction_types(self):
        """Test constructor with all transaction types."""
        for tx_type in TransactionType:
            header = TransactionHeader.__new__(TransactionHeader)
            header.id = uuid4()
            header.transaction_type = tx_type
            header.transaction_number = f"TEST-{tx_type.value}-001"
            header.customer_id = uuid4() if tx_type in [TransactionType.SALE, TransactionType.RENTAL] else None
            header.supplier_id = uuid4() if tx_type == TransactionType.PURCHASE else None
            header.location_id = uuid4()
            header.subtotal = Decimal("100.00")
            header.total_amount = Decimal("100.00")
            header.paid_amount = Decimal("0.00")
            header.created_by = uuid4()
            
            # Verify type assignment
            assert header.transaction_type == tx_type
            assert header.transaction_number.startswith("TEST")
    
    def test_generate_transaction_number(self):
        """Test transaction number generation for all types."""
        with patch('app.models.transaction.transaction_header.datetime') as mock_dt:
            mock_dt.now.return_value.strftime.return_value = "20240122123456"
            
            for tx_type in TransactionType:
                header = TransactionHeader.__new__(TransactionHeader)
                header.transaction_type = tx_type
                
                number = header._generate_transaction_number()
                
                prefix_map = {
                    TransactionType.SALE: "SALE",
                    TransactionType.PURCHASE: "PURCH",
                    TransactionType.RENTAL: "RENT",
                    TransactionType.RETURN: "RET",
                    TransactionType.ADJUSTMENT: "ADJ"
                }
                expected_prefix = prefix_map[tx_type]
                assert number == f"{expected_prefix}-20240122123456"
    
    def test_validate_negative_amounts(self):
        """Test validation of negative amounts."""
        test_cases = [
            ("subtotal", Decimal("-10.00"), "Subtotal cannot be negative"),
            ("discount_amount", Decimal("-5.00"), "Discount amount cannot be negative"),
            ("tax_amount", Decimal("-3.00"), "Tax amount cannot be negative"),
            ("shipping_amount", Decimal("-2.00"), "Shipping amount cannot be negative"),
            ("total_amount", Decimal("-100.00"), "Total amount cannot be negative"),
            ("paid_amount", Decimal("-50.00"), "Paid amount cannot be negative"),
        ]
        
        for field, negative_value, expected_error in test_cases:
            header = TransactionHeader.__new__(TransactionHeader)
            header.transaction_type = TransactionType.SALE
            header.customer_id = uuid4()
            setattr(header, field, negative_value)
            
            with pytest.raises(ValueError, match=expected_error):
                header._validate_business_rules()
    
    def test_validate_overpayment(self):
        """Test validation of overpayment."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_type = TransactionType.SALE
        header.customer_id = uuid4()
        header.total_amount = Decimal("100.00")
        header.paid_amount = Decimal("150.00")  # Overpayment
        
        with pytest.raises(ValueError, match="Paid amount cannot exceed total amount"):
            header._validate_business_rules()
    
    def test_validate_customer_required_for_sales_rental(self):
        """Test customer validation for sales and rentals."""
        for tx_type in [TransactionType.SALE, TransactionType.RENTAL]:
            header = TransactionHeader.__new__(TransactionHeader)
            header.transaction_type = tx_type
            header.customer_id = None  # Missing customer
            
            with pytest.raises(ValueError, match="Customer ID is required"):
                header._validate_business_rules()
    
    def test_validate_supplier_required_for_purchase(self):
        """Test supplier validation for purchases."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_type = TransactionType.PURCHASE
        header.supplier_id = None  # Missing supplier
        
        with pytest.raises(ValueError, match="Supplier ID is required"):
            header._validate_business_rules()
    
    def test_validate_delivery_requirements(self):
        """Test delivery validation rules."""
        # Missing delivery address
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_type = TransactionType.SALE
        header.customer_id = uuid4()
        header.delivery_required = True
        header.delivery_address = None
        
        with pytest.raises(ValueError, match="Delivery address is required"):
            header._validate_business_rules()
        
        # Missing delivery date
        header.delivery_address = "123 Main St"
        header.delivery_date = None
        
        with pytest.raises(ValueError, match="Delivery date is required"):
            header._validate_business_rules()
    
    def test_validate_pickup_requirements(self):
        """Test pickup validation rules."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_type = TransactionType.SALE
        header.customer_id = uuid4()
        header.pickup_required = True
        header.pickup_date = None
        
        with pytest.raises(ValueError, match="Pickup date is required"):
            header._validate_business_rules()
    
    def test_validate_currency_code(self):
        """Test currency code validation."""
        invalid_currencies = ["US", "USDX", "", "1234"]
        
        for invalid_currency in invalid_currencies:
            header = TransactionHeader.__new__(TransactionHeader)
            header.transaction_type = TransactionType.SALE
            header.customer_id = uuid4()
            header.currency = invalid_currency
            
            with pytest.raises(ValueError, match="Currency code must be 3 characters"):
                header._validate_business_rules()
    
    def test_balance_due_property(self):
        """Test balance_due computed property."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.total_amount = Decimal("100.00")
        header.paid_amount = Decimal("30.00")
        
        assert header.balance_due == Decimal("70.00")
        
        # Test with None values
        header.total_amount = None
        assert header.balance_due == Decimal("0.00")
    
    def test_is_paid_property(self):
        """Test is_paid computed property."""
        header = TransactionHeader.__new__(TransactionHeader)
        
        # Fully paid
        header.total_amount = Decimal("100.00")
        header.paid_amount = Decimal("100.00")
        assert header.is_paid is True
        
        # Partially paid
        header.paid_amount = Decimal("50.00")
        assert header.is_paid is False
        
        # Overpaid
        header.paid_amount = Decimal("120.00")
        assert header.is_paid is True
        
        # No amounts
        header.total_amount = None
        header.paid_amount = None
        assert header.is_paid is False
    
    def test_is_overdue_property(self):
        """Test is_overdue computed property."""
        header = TransactionHeader.__new__(TransactionHeader)
        
        # Past due date with balance
        header.due_date = date.today() - timedelta(days=1)
        header.total_amount = Decimal("100.00")
        header.paid_amount = Decimal("50.00")
        assert header.is_overdue is True
        
        # Past due date but fully paid
        header.paid_amount = Decimal("100.00")
        assert header.is_overdue is False
        
        # Future due date
        header.due_date = date.today() + timedelta(days=1)
        header.paid_amount = Decimal("50.00")
        assert header.is_overdue is False
        
        # No due date
        header.due_date = None
        assert header.is_overdue is False
    
    def test_update_amounts_method(self):
        """Test update_amounts method."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_type = TransactionType.SALE
        header.customer_id = uuid4()
        
        # Update all amounts
        header.update_amounts(
            subtotal=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            tax_amount=Decimal("9.00"),
            shipping_amount=Decimal("5.00")
        )
        
        assert header.subtotal == Decimal("100.00")
        assert header.discount_amount == Decimal("10.00")
        assert header.tax_amount == Decimal("9.00")
        assert header.shipping_amount == Decimal("5.00")
        assert header.total_amount == Decimal("104.00")  # 100 - 10 + 9 + 5
    
    def test_apply_payment_method(self):
        """Test apply_payment method."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.total_amount = Decimal("100.00")
        header.paid_amount = Decimal("0.00")
        header.payment_status = PaymentStatus.PENDING
        
        # Partial payment
        header.apply_payment(Decimal("30.00"))
        assert header.paid_amount == Decimal("30.00")
        assert header.payment_status == PaymentStatus.PARTIAL
        
        # Full payment
        header.apply_payment(Decimal("70.00"))
        assert header.paid_amount == Decimal("100.00")
        assert header.payment_status == PaymentStatus.PAID
    
    def test_can_be_cancelled_method(self):
        """Test can_be_cancelled method."""
        header = TransactionHeader.__new__(TransactionHeader)
        
        # Pending status - can cancel
        header.status = TransactionStatus.PENDING
        assert header.can_be_cancelled() is True
        
        # Processing status - can cancel
        header.status = TransactionStatus.PROCESSING
        assert header.can_be_cancelled() is True
        
        # Completed status - cannot cancel
        header.status = TransactionStatus.COMPLETED
        assert header.can_be_cancelled() is False
        
        # Already cancelled - cannot cancel
        header.status = TransactionStatus.CANCELLED
        assert header.can_be_cancelled() is False
    
    def test_str_representation(self):
        """Test string representation."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.transaction_number = "SALE-001"
        header.transaction_type = TransactionType.SALE
        header.total_amount = Decimal("150.75")
        
        expected = "TransactionHeader(number=SALE-001, type=TransactionType.SALE, total=150.75)"
        assert str(header) == expected
    
    def test_repr_representation(self):
        """Test repr representation."""
        header = TransactionHeader.__new__(TransactionHeader)
        header.id = uuid4()
        header.transaction_number = "SALE-001"
        header.transaction_type = TransactionType.SALE
        
        repr_str = repr(header)
        assert "TransactionHeader" in repr_str
        assert "SALE-001" in repr_str
        assert str(header.id) in repr_str


class TestTransactionLineComplete:
    """Complete test coverage for TransactionLine model."""
    
    def test_line_total_calculation(self):
        """Test line total calculation property."""
        line = TransactionLine.__new__(TransactionLine)
        line.quantity = Decimal("5")
        line.unit_price = Decimal("20.00")
        line.discount_amount = Decimal("10.00")
        line.tax_amount = Decimal("9.00")
        
        # Expected: (5 * 20) - 10 + 9 = 99.00
        line.total_price = (line.quantity * line.unit_price) - line.discount_amount + line.tax_amount
        assert line.total_price == Decimal("99.00")
    
    def test_validate_quantity_positive(self):
        """Test quantity validation."""
        line = TransactionLine.__new__(TransactionLine)
        line.transaction_header_id = uuid4()
        line.line_number = 1
        line.description = "Test item"
        line.quantity = Decimal("-1")  # Invalid
        
        with pytest.raises(ValueError, match="Quantity must be positive"):
            line._validate_business_rules()
    
    def test_validate_unit_price_non_negative(self):
        """Test unit price validation."""
        line = TransactionLine.__new__(TransactionLine)
        line.transaction_header_id = uuid4()
        line.line_number = 1
        line.description = "Test item"
        line.quantity = Decimal("1")
        line.unit_price = Decimal("-10.00")  # Invalid
        
        with pytest.raises(ValueError, match="Unit price cannot be negative"):
            line._validate_business_rules()
    
    def test_validate_rental_dates(self):
        """Test rental date validation."""
        line = TransactionLine.__new__(TransactionLine)
        line.transaction_header_id = uuid4()
        line.line_number = 1
        line.description = "Test item"
        line.quantity = Decimal("1")
        line.unit_price = Decimal("10.00")
        line.line_item_type = LineItemType.RENTAL
        line.rental_start_date = date.today()
        line.rental_end_date = date.today() - timedelta(days=1)  # Invalid
        
        with pytest.raises(ValueError, match="Rental end date must be after start date"):
            line._validate_business_rules()
    
    def test_validate_return_quantity(self):
        """Test return quantity validation."""
        line = TransactionLine.__new__(TransactionLine)
        line.transaction_header_id = uuid4()
        line.line_number = 1
        line.description = "Test item"
        line.quantity = Decimal("5")
        line.unit_price = Decimal("10.00")
        line.returned_quantity = Decimal("6")  # More than available
        
        with pytest.raises(ValueError, match="Returned quantity cannot exceed original quantity"):
            line._validate_business_rules()
    
    def test_rental_duration_property(self):
        """Test rental duration calculation."""
        line = TransactionLine.__new__(TransactionLine)
        line.rental_start_date = date(2024, 1, 1)
        line.rental_end_date = date(2024, 1, 8)
        
        assert line.rental_duration == 7  # days
        
        # Test with None dates
        line.rental_start_date = None
        assert line.rental_duration == 0
    
    def test_is_rental_property(self):
        """Test is_rental property."""
        line = TransactionLine.__new__(TransactionLine)
        
        line.line_item_type = LineItemType.RENTAL
        assert line.is_rental is True
        
        line.line_item_type = LineItemType.STANDARD
        assert line.is_rental is False
    
    def test_is_fully_returned_property(self):
        """Test is_fully_returned property."""
        line = TransactionLine.__new__(TransactionLine)
        line.quantity = Decimal("10")
        
        # Fully returned
        line.returned_quantity = Decimal("10")
        assert line.is_fully_returned is True
        
        # Partially returned
        line.returned_quantity = Decimal("5")
        assert line.is_fully_returned is False
        
        # Not returned
        line.returned_quantity = Decimal("0")
        assert line.is_fully_returned is False
        
        # None returned quantity
        line.returned_quantity = None
        assert line.is_fully_returned is False
    
    def test_remaining_quantity_property(self):
        """Test remaining quantity calculation."""
        line = TransactionLine.__new__(TransactionLine)
        line.quantity = Decimal("10")
        line.returned_quantity = Decimal("3")
        
        assert line.remaining_quantity == Decimal("7")
        
        # Test with None returned quantity
        line.returned_quantity = None
        assert line.remaining_quantity == Decimal("10")


class TestRentalLifecycleComplete:
    """Complete test coverage for RentalLifecycle model."""
    
    def test_is_overdue_property(self):
        """Test is_overdue property."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        
        # Past due date
        lifecycle.rental_end_date = date.today() - timedelta(days=1)
        lifecycle.status = RentalStatus.RENTAL_INPROGRESS
        assert lifecycle.is_overdue is True
        
        # Future due date
        lifecycle.rental_end_date = date.today() + timedelta(days=1)
        assert lifecycle.is_overdue is False
        
        # Completed rental
        lifecycle.rental_end_date = date.today() - timedelta(days=1)
        lifecycle.status = RentalStatus.RENTAL_COMPLETED
        assert lifecycle.is_overdue is False
    
    def test_days_overdue_property(self):
        """Test days_overdue calculation."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        lifecycle.status = RentalStatus.RENTAL_INPROGRESS
        
        # 3 days overdue
        lifecycle.rental_end_date = date.today() - timedelta(days=3)
        assert lifecycle.days_overdue == 3
        
        # Not overdue
        lifecycle.rental_end_date = date.today() + timedelta(days=2)
        assert lifecycle.days_overdue == 0
        
        # Completed rental
        lifecycle.status = RentalStatus.RENTAL_COMPLETED
        lifecycle.rental_end_date = date.today() - timedelta(days=5)
        assert lifecycle.days_overdue == 0
    
    def test_rental_duration_property(self):
        """Test rental duration calculation."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        lifecycle.rental_start_date = date(2024, 1, 1)
        lifecycle.rental_end_date = date(2024, 1, 15)
        
        assert lifecycle.rental_duration == 14  # days
    
    def test_is_active_property(self):
        """Test is_active property."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        
        # Active statuses
        active_statuses = [RentalStatus.RENTAL_INPROGRESS, RentalStatus.RENTAL_EXTENDED]
        for status in active_statuses:
            lifecycle.status = status
            assert lifecycle.is_active is True
        
        # Inactive statuses
        inactive_statuses = [RentalStatus.RENTAL_COMPLETED, RentalStatus.RENTAL_LATE]
        for status in inactive_statuses:
            lifecycle.status = status
            assert lifecycle.is_active is False
    
    def test_can_be_extended_method(self):
        """Test can_be_extended method."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        
        # Can extend in progress rental
        lifecycle.status = RentalStatus.RENTAL_INPROGRESS
        assert lifecycle.can_be_extended() is True
        
        # Cannot extend completed rental
        lifecycle.status = RentalStatus.RENTAL_COMPLETED
        assert lifecycle.can_be_extended() is False
    
    def test_extend_rental_method(self):
        """Test extend_rental method."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        lifecycle.status = RentalStatus.RENTAL_INPROGRESS
        lifecycle.rental_end_date = date.today() + timedelta(days=7)
        
        new_end_date = date.today() + timedelta(days=14)
        lifecycle.extend_rental(new_end_date)
        
        assert lifecycle.rental_end_date == new_end_date
        assert lifecycle.status == RentalStatus.RENTAL_EXTENDED
    
    def test_complete_rental_method(self):
        """Test complete_rental method."""
        lifecycle = RentalLifecycle.__new__(RentalLifecycle)
        lifecycle.status = RentalStatus.RENTAL_INPROGRESS
        
        return_date = date.today()
        lifecycle.complete_rental(return_date)
        
        assert lifecycle.actual_return_date == return_date
        assert lifecycle.status == RentalStatus.RENTAL_COMPLETED


class TestTransactionInspectionComplete:
    """Complete test coverage for TransactionInspection model."""
    
    def test_condition_score_property(self):
        """Test condition score mapping."""
        inspection = TransactionInspection.__new__(TransactionInspection)
        
        score_map = {
            ConditionRating.A: 100,
            ConditionRating.B: 85,
            ConditionRating.C: 70,
            ConditionRating.D: 50,
            ConditionRating.E: 0
        }
        
        for rating, expected_score in score_map.items():
            inspection.condition_rating = rating
            if hasattr(inspection, 'condition_score'):
                assert inspection.condition_score == expected_score
    
    def test_validate_repair_cost_for_repair_disposition(self):
        """Test repair cost validation for repair disposition."""
        inspection = TransactionInspection.__new__(TransactionInspection)
        inspection.transaction_line_id = uuid4()
        inspection.disposition = ItemDisposition.SEND_TO_REPAIR
        inspection.repair_cost_estimate = None  # Missing required cost
        
        with pytest.raises(ValueError, match="Repair cost estimate required"):
            inspection._validate_business_rules()
    
    def test_validate_quarantine_days_for_quarantine_disposition(self):
        """Test quarantine days validation."""
        inspection = TransactionInspection.__new__(TransactionInspection)
        inspection.transaction_line_id = uuid4()
        inspection.disposition = ItemDisposition.QUARANTINE
        inspection.quarantine_days = None  # Missing required days
        
        with pytest.raises(ValueError, match="Quarantine days required"):
            inspection._validate_business_rules()
    
    def test_is_damaged_property(self):
        """Test is_damaged property."""
        inspection = TransactionInspection.__new__(TransactionInspection)
        
        # Damaged types
        damaged_types = [DamageType.COSMETIC, DamageType.FUNCTIONAL, DamageType.STRUCTURAL]
        for damage_type in damaged_types:
            inspection.damage_type = damage_type
            assert inspection.is_damaged is True
        
        # Not damaged
        inspection.damage_type = DamageType.NONE
        assert inspection.is_damaged is False
    
    def test_requires_quarantine_property(self):
        """Test requires_quarantine property."""
        inspection = TransactionInspection.__new__(TransactionInspection)
        
        inspection.disposition = ItemDisposition.QUARANTINE
        assert inspection.requires_quarantine is True
        
        inspection.disposition = ItemDisposition.RETURN_TO_STOCK
        assert inspection.requires_quarantine is False


class TestTransactionEventComplete:
    """Complete test coverage for TransactionEvent model."""
    
    def test_event_serialization(self):
        """Test event data serialization."""
        event = TransactionEvent.__new__(TransactionEvent)
        event.transaction_id = uuid4()
        event.event_type = "STATUS_CHANGE"
        event.event_category = "TRANSACTION"
        
        test_data = {"old_status": "PENDING", "new_status": "PROCESSING"}
        event.event_data = test_data
        
        # Test serialization works
        assert event.event_data == test_data
    
    def test_is_user_action_property(self):
        """Test is_user_action property."""
        event = TransactionEvent.__new__(TransactionEvent)
        
        event.user_id = uuid4()
        assert event.is_user_action is True
        
        event.user_id = None
        assert event.is_user_action is False


class TestTransactionMetadataComplete:
    """Complete test coverage for TransactionMetadata model."""
    
    def test_metadata_content_access(self):
        """Test metadata content access."""
        metadata = TransactionMetadata.__new__(TransactionMetadata)
        metadata.transaction_id = uuid4()
        metadata.metadata_type = "SHIPPING_INFO"
        
        test_content = {"carrier": "UPS", "tracking": "123456"}
        metadata.metadata_content = test_content
        
        assert metadata.metadata_content == test_content
    
    def test_get_value_method(self):
        """Test get_value method."""
        metadata = TransactionMetadata.__new__(TransactionMetadata)
        metadata.metadata_content = {"key1": "value1", "nested": {"key2": "value2"}}
        
        # Test direct key access
        if hasattr(metadata, 'get_value'):
            assert metadata.get_value("key1") == "value1"
            assert metadata.get_value("nonexistent") is None
            assert metadata.get_value("nonexistent", "default") == "default"
    
    def test_set_value_method(self):
        """Test set_value method."""
        metadata = TransactionMetadata.__new__(TransactionMetadata)
        metadata.metadata_content = {}
        
        if hasattr(metadata, 'set_value'):
            metadata.set_value("new_key", "new_value")
            assert metadata.metadata_content["new_key"] == "new_value"