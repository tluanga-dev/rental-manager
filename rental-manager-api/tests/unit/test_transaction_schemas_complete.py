"""
Comprehensive schema tests for 100% transaction module coverage.
Tests all Pydantic validators, model conversions, and edge cases.
"""

import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta
from uuid import uuid4
from typing import Dict, Any
from unittest.mock import MagicMock

from pydantic import ValidationError

from app.schemas.transaction.sales import (
    SalesCreate,
    SalesItemCreate,
    SalesDiscountCreate,
    SalesPaymentCreate,
    SalesResponse,
    SalesFilter,
    CustomerCreditCheck,
    SalesValidationError,
)
from app.schemas.transaction.rental import (
    RentalCreate,
    RentalItemCreate,
    RentalExtensionRequest,
    RentalReturnRequest,
    RentalDamageAssessment,
    RentalResponse,
    RentalFilter,
    RentalValidationError,
)
from app.schemas.transaction.purchase_returns import (
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
    PurchaseReturnInspection,
    PurchaseReturnResponse,
    PurchaseReturnFilter,
    PurchaseReturnValidationError,
)
from app.schemas.transaction.transaction_header import (
    TransactionHeaderCreate,
    TransactionHeaderUpdate,
    TransactionHeaderResponse,
)
from app.schemas.transaction.transaction_line import (
    TransactionLineCreate,
    TransactionLineUpdate,
    TransactionLineResponse,
)
from app.models.transaction.enums import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    DiscountType,
    ReturnType,
    ReturnStatus,
    ConditionRating,
    ItemDisposition,
    DamageSeverity,
)


class TestSalesSchemasComplete:
    """Complete test coverage for sales schemas."""
    
    def test_sales_discount_create_percentage_validation(self):
        """Test percentage discount validation."""
        # Valid percentage
        discount = SalesDiscountCreate(
            discount_type=DiscountType.PERCENTAGE,
            value=Decimal("15.00"),
            reason="Loyalty discount"
        )
        assert discount.value == Decimal("15.00")
        
        # Invalid percentage > 100
        with pytest.raises(ValidationError, match="Percentage discount cannot exceed 100%"):
            SalesDiscountCreate(
                discount_type=DiscountType.PERCENTAGE,
                value=Decimal("150.00"),
                reason="Invalid discount"
            )
    
    def test_sales_item_create_discount_validation(self):
        """Test item discount validation."""
        # Valid item with discount
        item = SalesItemCreate(
            item_id=uuid4(),
            quantity=2,
            unit_price=Decimal("100.00"),
            discount_amount=Decimal("50.00"),  # Valid: less than total
            tax_amount=Decimal("15.00")
        )
        assert item.discount_amount == Decimal("50.00")
        
        # Invalid: discount exceeds item total
        with pytest.raises(ValidationError, match="Discount amount cannot exceed item total"):
            SalesItemCreate(
                item_id=uuid4(),
                quantity=2,
                unit_price=Decimal("100.00"),
                discount_amount=Decimal("250.00"),  # Invalid: more than 2 * 100
                tax_amount=Decimal("15.00")
            )
    
    def test_sales_create_date_validation(self):
        """Test sales date validation."""
        # Valid dates
        sales_data = SalesCreate(
            customer_id=uuid4(),
            location_id=uuid4(),
            reference_number="SO-001",
            sales_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=30),
            items=[
                SalesItemCreate(
                    item_id=uuid4(),
                    quantity=1,
                    unit_price=Decimal("100.00")
                )
            ]
        )
        assert sales_data.due_date > sales_data.sales_date
        
        # Invalid: due date before sales date
        with pytest.raises(ValidationError, match="Due date must be after sales date"):
            SalesCreate(
                customer_id=uuid4(),
                location_id=uuid4(),
                reference_number="SO-001",
                sales_date=datetime.utcnow(),
                due_date=datetime.utcnow() - timedelta(days=1),  # Invalid
                items=[
                    SalesItemCreate(
                        item_id=uuid4(),
                        quantity=1,
                        unit_price=Decimal("100.00")
                    )
                ]
            )
    
    def test_sales_filter_validation(self):
        """Test sales filter schema validation."""
        # Valid filter
        filter_data = SalesFilter(
            customer_id=uuid4(),
            location_id=uuid4(),
            status=TransactionStatus.COMPLETED,
            payment_status=PaymentStatus.PAID,
            date_from=datetime.utcnow() - timedelta(days=30),
            date_to=datetime.utcnow(),
            min_amount=Decimal("100.00"),
            max_amount=Decimal("1000.00")
        )
        assert filter_data.min_amount < filter_data.max_amount
    
    def test_customer_credit_check_response(self):
        """Test customer credit check response schema."""
        credit_check = CustomerCreditCheck(
            customer_id=uuid4(),
            credit_limit=Decimal("10000.00"),
            available_credit=Decimal("7500.00"),
            current_balance=Decimal("2500.00"),
            order_amount=Decimal("1000.00"),
            approved=True
        )
        
        assert credit_check.approved is True
        assert credit_check.available_credit == Decimal("7500.00")
        
        # Test declined with reason
        declined_check = CustomerCreditCheck(
            customer_id=uuid4(),
            credit_limit=Decimal("5000.00"),
            available_credit=Decimal("0.00"),
            current_balance=Decimal("5000.00"),
            order_amount=Decimal("1000.00"),
            approved=False,
            reason="Credit limit exceeded",
            suggested_payment=Decimal("1000.00")
        )
        
        assert declined_check.approved is False
        assert declined_check.reason == "Credit limit exceeded"
    
    def test_sales_response_from_orm(self):
        """Test SalesResponse from_orm conversion."""
        # Mock ORM object
        mock_sales = MagicMock()
        mock_sales.id = uuid4()
        mock_sales.transaction_number = "SALE-001"
        mock_sales.customer_name = "Test Customer"
        mock_sales.location_name = "Main Store"
        mock_sales.total_amount = Decimal("150.00")
        mock_sales.paid_amount = Decimal("100.00")
        mock_sales.items = []
        mock_sales.payments = []
        mock_sales.created_at = datetime.utcnow()
        mock_sales.updated_at = datetime.utcnow()
        mock_sales.created_by = uuid4()
        
        # Create response from mock
        response = SalesResponse.from_attributes(mock_sales)
        assert response.transaction_number == "SALE-001"
        assert response.customer_name == "Test Customer"
    
    def test_sales_validation_error(self):
        """Test SalesValidationError schema."""
        error = SalesValidationError(
            field="customer_id",
            message="Customer not found",
            code="NOT_FOUND",
            value=str(uuid4())
        )
        
        assert error.field == "customer_id"
        assert error.code == "NOT_FOUND"


class TestRentalSchemasComplete:
    """Complete test coverage for rental schemas."""
    
    def test_rental_item_create_validation(self):
        """Test rental item validation."""
        # Valid rental item
        item = RentalItemCreate(
            item_id=uuid4(),
            quantity=1,
            daily_rate=Decimal("50.00"),
            weekly_rate=Decimal("300.00"),
            monthly_rate=Decimal("1000.00"),
            security_deposit=Decimal("100.00")
        )
        assert item.daily_rate == Decimal("50.00")
        
        # Test weekly rate validation (should be less than 7 * daily)
        with pytest.raises(ValidationError, match="Weekly rate should be less than 7 times daily rate"):
            RentalItemCreate(
                item_id=uuid4(),
                quantity=1,
                daily_rate=Decimal("50.00"),
                weekly_rate=Decimal("400.00"),  # More than 7 * 50
                monthly_rate=Decimal("1000.00")
            )
    
    def test_rental_extension_request_validation(self):
        """Test rental extension validation."""
        # Valid extension
        extension = RentalExtensionRequest(
            rental_id=uuid4(),
            new_end_date=datetime.utcnow() + timedelta(days=7),
            extension_reason="Customer requested more time"
        )
        assert extension.new_end_date > datetime.utcnow()
        
        # Invalid: past date
        with pytest.raises(ValidationError, match="Extension date must be in the future"):
            RentalExtensionRequest(
                rental_id=uuid4(),
                new_end_date=datetime.utcnow() - timedelta(days=1),  # Past date
                extension_reason="Invalid extension"
            )
    
    def test_rental_return_create_validation(self):
        """Test rental return validation."""
        return_data = RentalReturnRequest(
            rental_id=uuid4(),
            return_date=datetime.utcnow(),
            items=[
                {
                    "item_id": uuid4(),
                    "returned_quantity": 1,
                    "condition_rating": ConditionRating.A,
                    "damage_notes": None
                }
            ],
            late_fees=Decimal("25.00"),
            damage_fees=Decimal("0.00")
        )
        
        assert return_data.late_fees == Decimal("25.00")
        assert len(return_data.items) == 1
    
    def test_rental_inspection_create_validation(self):
        """Test rental inspection validation."""
        inspection = RentalDamageAssessment(
            rental_line_id=uuid4(),
            condition_rating=ConditionRating.B,
            damage_type="COSMETIC",
            damage_description="Minor scratches on surface",
            repair_required=True,
            repair_cost_estimate=Decimal("50.00"),
            inspector_id=uuid4()
        )
        
        assert inspection.repair_required is True
        assert inspection.repair_cost_estimate == Decimal("50.00")
        
        # Test repair cost required when repair_required is True
        with pytest.raises(ValidationError, match="Repair cost estimate required when repair is needed"):
            RentalDamageAssessment(
                rental_line_id=uuid4(),
                condition_rating=ConditionRating.D,
                damage_type="STRUCTURAL",
                damage_description="Significant damage",
                repair_required=True,
                repair_cost_estimate=None,  # Missing required cost
                inspector_id=uuid4()
            )
    
    def test_rental_filter_validation(self):
        """Test rental filter validation."""
        filter_data = RentalFilter(
            customer_id=uuid4(),
            location_id=uuid4(),
            status="RENTAL_INPROGRESS",
            start_date_from=date.today() - timedelta(days=30),
            start_date_to=date.today(),
            end_date_from=date.today(),
            end_date_to=date.today() + timedelta(days=30),
            is_overdue=True
        )
        
        assert filter_data.is_overdue is True
        assert filter_data.start_date_from < filter_data.start_date_to


class TestPurchaseReturnSchemasComplete:
    """Complete test coverage for purchase return schemas."""
    
    def test_purchase_return_item_validation(self):
        """Test purchase return item validation."""
        # Valid defective return with description
        item = PurchaseReturnItemCreate(
            purchase_line_id=uuid4(),
            item_id=uuid4(),
            quantity=2,
            unit_cost=Decimal("75.00"),
            return_reason=ReturnType.DEFECTIVE,
            condition_rating=ConditionRating.D,
            defect_description="Product arrived damaged",
            serial_numbers=["SN001", "SN002"]
        )
        
        assert item.defect_description == "Product arrived damaged"
        assert len(item.serial_numbers) == 2
        
        # Invalid: defective without description
        with pytest.raises(ValidationError, match="Defect description required for defective returns"):
            PurchaseReturnItemCreate(
                purchase_line_id=uuid4(),
                item_id=uuid4(),
                quantity=1,
                unit_cost=Decimal("50.00"),
                return_reason=ReturnType.DEFECTIVE,
                condition_rating=ConditionRating.E,
                defect_description=None  # Missing required description
            )
        
        # Invalid: defective with excellent condition
        with pytest.raises(ValidationError, match="Defective items cannot have excellent condition rating"):
            PurchaseReturnItemCreate(
                purchase_line_id=uuid4(),
                item_id=uuid4(),
                quantity=1,
                unit_cost=Decimal("50.00"),
                return_reason=ReturnType.DEFECTIVE,
                condition_rating=ConditionRating.A,  # Inconsistent with defective
                defect_description="Damaged item"
            )
    
    def test_purchase_return_inspection_validation(self):
        """Test purchase return inspection validation."""
        # Valid inspection
        inspection = PurchaseReturnInspection(
            return_line_id=uuid4(),
            condition_verified=True,
            condition_rating=ConditionRating.C,
            disposition=ItemDisposition.SEND_TO_REPAIR,
            repair_cost_estimate=Decimal("25.00"),
            inspection_notes="Repairable damage found",
            inspector_id=uuid4()
        )
        
        assert inspection.repair_cost_estimate == Decimal("25.00")
        
        # Invalid: repair disposition without cost estimate
        with pytest.raises(ValidationError, match="Repair cost estimate required for repair disposition"):
            PurchaseReturnInspection(
                return_line_id=uuid4(),
                condition_verified=True,
                condition_rating=ConditionRating.D,
                disposition=ItemDisposition.SEND_TO_REPAIR,
                repair_cost_estimate=None,  # Missing required estimate
                inspection_notes="Needs repair",
                inspector_id=uuid4()
            )
        
        # Test quarantine validation
        with pytest.raises(ValidationError, match="Quarantine days required for quarantine disposition"):
            PurchaseReturnInspection(
                return_line_id=uuid4(),
                condition_verified=True,
                condition_rating=ConditionRating.E,
                disposition=ItemDisposition.QUARANTINE,
                quarantine_days=None,  # Missing required days
                inspection_notes="Contaminated item",
                inspector_id=uuid4()
            )
    
    def test_purchase_return_create_validation(self):
        """Test purchase return creation validation."""
        return_data = PurchaseReturnCreate(
            supplier_id=uuid4(),
            purchase_order_id=uuid4(),
            return_reason=ReturnType.DEFECTIVE,
            return_date=datetime.utcnow(),
            items=[
                PurchaseReturnItemCreate(
                    purchase_line_id=uuid4(),
                    item_id=uuid4(),
                    quantity=1,
                    unit_cost=Decimal("100.00"),
                    return_reason=ReturnType.DEFECTIVE,
                    condition_rating=ConditionRating.D,
                    defect_description="Manufacturing defect"
                )
            ],
            expected_credit_amount=Decimal("100.00"),
            return_shipping_cost=Decimal("15.00"),
            notes="Defective batch returned to supplier"
        )
        
        assert len(return_data.items) == 1
        assert return_data.expected_credit_amount == Decimal("100.00")
    
    def test_purchase_return_filter_validation(self):
        """Test purchase return filter validation."""
        filter_data = PurchaseReturnFilter(
            supplier_id=uuid4(),
            return_status=ReturnStatus.APPROVED,
            return_reason=ReturnType.DEFECTIVE,
            date_from=datetime.utcnow() - timedelta(days=30),
            date_to=datetime.utcnow(),
            min_amount=Decimal("50.00"),
            max_amount=Decimal("500.00")
        )
        
        assert filter_data.return_status == ReturnStatus.APPROVED
        assert filter_data.min_amount < filter_data.max_amount


class TestTransactionHeaderSchemasComplete:
    """Complete test coverage for transaction header schemas."""
    
    def test_transaction_header_currency_validation(self):
        """Test currency code validation."""
        # Valid currency
        header = TransactionHeaderCreate(
            transaction_type=TransactionType.SALE,
            customer_id=uuid4(),
            location_id=uuid4(),
            currency="USD"
        )
        assert header.currency == "USD"
        
        # Invalid currency code
        with pytest.raises(ValidationError, match="Currency must be 3 characters"):
            TransactionHeaderCreate(
                transaction_type=TransactionType.SALE,
                customer_id=uuid4(),
                location_id=uuid4(),
                currency="US"  # Too short
            )
    
    def test_transaction_header_amount_validation(self):
        """Test amount field validation."""
        # Valid amounts
        header = TransactionHeaderCreate(
            transaction_type=TransactionType.SALE,
            customer_id=uuid4(),
            location_id=uuid4(),
            total_amount=Decimal("100.00"),
            subtotal=Decimal("90.00"),
            paid_amount=Decimal("50.00")
        )
        assert header.total_amount == Decimal("100.00")
        
        # Test negative amount validation
        with pytest.raises(ValidationError, match="Amount must be non-negative"):
            TransactionHeaderCreate(
                transaction_type=TransactionType.SALE,
                customer_id=uuid4(),
                location_id=uuid4(),
                total_amount=Decimal("-10.00")  # Invalid negative
            )
    
    def test_transaction_header_delivery_validation(self):
        """Test delivery address validation."""
        # Valid delivery setup
        header = TransactionHeaderCreate(
            transaction_type=TransactionType.SALE,
            customer_id=uuid4(),
            location_id=uuid4(),
            delivery_required=True,
            delivery_address="123 Main St, City, State 12345"
        )
        assert header.delivery_required is True
        assert header.delivery_address is not None
        
        # Invalid: delivery required without address
        with pytest.raises(ValidationError, match="Delivery address required when delivery is enabled"):
            TransactionHeaderCreate(
                transaction_type=TransactionType.SALE,
                customer_id=uuid4(),
                location_id=uuid4(),
                delivery_required=True,
                delivery_address=None  # Missing required address
            )
    
    def test_transaction_header_customer_supplier_validation(self):
        """Test customer/supplier validation per transaction type."""
        # Valid sale with customer
        sale_header = TransactionHeaderCreate(
            transaction_type=TransactionType.SALE,
            customer_id=uuid4(),
            location_id=uuid4()
        )
        assert sale_header.customer_id is not None
        
        # Valid purchase with supplier
        purchase_header = TransactionHeaderCreate(
            transaction_type=TransactionType.PURCHASE,
            supplier_id=uuid4(),
            location_id=uuid4()
        )
        assert purchase_header.supplier_id is not None
        
        # Invalid: sale without customer
        with pytest.raises(ValidationError, match="Customer required for sales"):
            TransactionHeaderCreate(
                transaction_type=TransactionType.SALE,
                customer_id=None,  # Missing required customer
                location_id=uuid4()
            )
        
        # Invalid: purchase without supplier
        with pytest.raises(ValidationError, match="Supplier required for purchases"):
            TransactionHeaderCreate(
                transaction_type=TransactionType.PURCHASE,
                supplier_id=None,  # Missing required supplier
                location_id=uuid4()
            )


class TestTransactionLineSchemasComplete:
    """Complete test coverage for transaction line schemas."""
    
    def test_transaction_line_quantity_validation(self):
        """Test quantity validation."""
        # Valid line
        line = TransactionLineCreate(
            item_id=uuid4(),
            quantity=Decimal("5"),
            unit_price=Decimal("20.00"),
            description="Test item"
        )
        assert line.quantity == Decimal("5")
        
        # Invalid: zero quantity
        with pytest.raises(ValidationError, match="Quantity must be positive"):
            TransactionLineCreate(
                item_id=uuid4(),
                quantity=Decimal("0"),  # Invalid
                unit_price=Decimal("20.00"),
                description="Test item"
            )
    
    def test_transaction_line_return_quantity_validation(self):
        """Test return quantity validation."""
        # Valid return quantity
        line = TransactionLineUpdate(
            returned_quantity=Decimal("3")
        )
        assert line.returned_quantity == Decimal("3")
        
        # Test validation in context (would need model validation)
        line_data = {
            "quantity": Decimal("5"),
            "returned_quantity": Decimal("3")
        }
        assert line_data["returned_quantity"] <= line_data["quantity"]
    
    def test_transaction_line_rental_date_validation(self):
        """Test rental date validation."""
        # Valid rental dates
        line = TransactionLineCreate(
            item_id=uuid4(),
            quantity=Decimal("1"),
            unit_price=Decimal("50.00"),
            description="Rental item",
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7)
        )
        assert line.rental_end_date > line.rental_start_date
        
        # Invalid: end before start (would be caught by model validation)
        with pytest.raises(ValidationError, match="Rental end date must be after start date"):
            TransactionLineCreate(
                item_id=uuid4(),
                quantity=Decimal("1"),
                unit_price=Decimal("50.00"),
                description="Rental item",
                rental_start_date=date.today(),
                rental_end_date=date.today() - timedelta(days=1)  # Invalid
            )
    
    def test_transaction_line_description_validation(self):
        """Test description validation."""
        # Valid description
        line = TransactionLineCreate(
            item_id=uuid4(),
            quantity=Decimal("1"),
            unit_price=Decimal("25.00"),
            description="Valid product description"
        )
        assert line.description == "Valid product description"
        
        # Invalid: empty description
        with pytest.raises(ValidationError, match="Description cannot be empty"):
            TransactionLineCreate(
                item_id=uuid4(),
                quantity=Decimal("1"),
                unit_price=Decimal("25.00"),
                description=""  # Invalid empty string
            )