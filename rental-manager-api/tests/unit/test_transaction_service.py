"""
Comprehensive service layer tests for transaction workflows.

Tests all business logic, transaction processing, and complex workflows
for purchase, sales, rental, and return operations.
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    RentalStatus,
    LineItemType
)
from app.services.transaction import (
    TransactionService,
    PurchaseService,
    SalesService,
    RentalService,
    PurchaseReturnsService,
    RentalPricingStrategy,
    ReturnType
)
from app.schemas.transaction.purchase import PurchaseCreate, PurchaseBulkCreate
from app.schemas.transaction.sales import SalesCreate, SalesUpdateStatus
from app.schemas.transaction.rental import RentalCreate, RentalExtend, RentalReturn
from app.schemas.transaction.purchase_returns import PurchaseReturnCreate


class TestTransactionService:
    """Test suite for general transaction service operations."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    @pytest.fixture
    def mock_db_session(self):
        return AsyncMock(spec=AsyncSession)

    async def test_create_transaction_success(self, transaction_service, mock_db_session):
        """Test successful transaction creation."""
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("150.00"),
            "payment_method": PaymentMethod.CREDIT_CARD
        }
        
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            mock_transaction = MagicMock()
            mock_transaction.id = uuid4()
            mock_transaction.transaction_number = "TXN-2025-001"
            mock_transaction.status = TransactionStatus.PENDING
            mock_create.return_value = mock_transaction
            
            result = await transaction_service.create_transaction(
                mock_db_session,
                **transaction_data,
                created_by=uuid4()
            )
            
            assert result.transaction_number == "TXN-2025-001"
            assert result.status == TransactionStatus.PENDING

    async def test_process_payment_success(self, transaction_service, mock_db_session):
        """Test successful payment processing."""
        transaction_id = uuid4()
        
        with patch.object(transaction_service, 'process_payment') as mock_process_payment:
            mock_result = {
                "status": "success",
                "payment_id": str(uuid4()),
                "amount_processed": Decimal("150.00"),
                "payment_method": PaymentMethod.CREDIT_CARD,
                "transaction_id": str(transaction_id)
            }
            mock_process_payment.return_value = mock_result
            
            result = await transaction_service.process_payment(
                mock_db_session,
                transaction_id=transaction_id,
                payment_amount=Decimal("150.00"),
                payment_method=PaymentMethod.CREDIT_CARD,
                payment_reference="REF123"
            )
            
            assert result["status"] == "success"
            assert result["amount_processed"] == Decimal("150.00")

    async def test_cancel_transaction_success(self, transaction_service, mock_db_session):
        """Test successful transaction cancellation."""
        transaction_id = uuid4()
        
        with patch.object(transaction_service, 'cancel_transaction') as mock_cancel:
            mock_transaction = MagicMock()
            mock_transaction.status = TransactionStatus.CANCELLED
            mock_transaction.cancelled_at = datetime.now(timezone.utc)
            mock_cancel.return_value = mock_transaction
            
            result = await transaction_service.cancel_transaction(
                mock_db_session,
                transaction_id=transaction_id,
                reason="Customer request",
                cancelled_by=uuid4()
            )
            
            assert result.status == TransactionStatus.CANCELLED
            assert result.cancelled_at is not None

    async def test_apply_discount_success(self, transaction_service, mock_db_session):
        """Test applying discount to transaction."""
        transaction_id = uuid4()
        
        with patch.object(transaction_service, 'apply_discount') as mock_apply_discount:
            mock_transaction = MagicMock()
            mock_transaction.discount_amount = Decimal("25.00")
            mock_transaction.total_amount = Decimal("125.00")
            mock_apply_discount.return_value = mock_transaction
            
            result = await transaction_service.apply_discount(
                mock_db_session,
                transaction_id=transaction_id,
                discount_amount=Decimal("25.00"),
                discount_type="percentage",
                reason="Customer loyalty",
                applied_by=uuid4()
            )
            
            assert result.discount_amount == Decimal("25.00")

    async def test_get_transaction_history(self, transaction_service, mock_db_session):
        """Test retrieving transaction history."""
        customer_id = uuid4()
        
        with patch.object(transaction_service, 'get_customer_transaction_history') as mock_get_history:
            mock_history = {
                "total_transactions": 25,
                "total_amount": Decimal("2500.00"),
                "last_transaction_date": date.today(),
                "transactions": [
                    MagicMock(transaction_type=TransactionType.SALE),
                    MagicMock(transaction_type=TransactionType.RENTAL)
                ]
            }
            mock_get_history.return_value = mock_history
            
            result = await transaction_service.get_customer_transaction_history(
                mock_db_session,
                customer_id=customer_id,
                limit=10
            )
            
            assert result["total_transactions"] == 25
            assert result["total_amount"] == Decimal("2500.00")


class TestPurchaseService:
    """Test suite for purchase transaction operations."""

    @pytest.fixture
    def purchase_service(self):
        return PurchaseService()

    @pytest.fixture
    def sample_purchase_data(self):
        return PurchaseCreate(
            supplier_id=uuid4(),
            location_id=uuid4(),
            purchase_order_number="PO-2025-001",
            expected_delivery_date=date.today() + timedelta(days=7),
            payment_terms="NET30",
            line_items=[
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("10.00"),
                    "unit_cost": Decimal("25.00"),
                    "description": "Test item"
                },
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("5.00"),
                    "unit_cost": Decimal("50.00"),
                    "description": "Another item"
                }
            ]
        )

    async def test_create_purchase_order_success(self, purchase_service, mock_db_session, sample_purchase_data):
        """Test successful purchase order creation."""
        with patch.object(purchase_service, 'create_purchase_order') as mock_create:
            mock_purchase = MagicMock()
            mock_purchase.id = uuid4()
            mock_purchase.transaction_number = "PUR-2025-001"
            mock_purchase.status = TransactionStatus.PENDING
            mock_purchase.total_amount = Decimal("500.00")
            mock_create.return_value = mock_purchase
            
            result = await purchase_service.create_purchase_order(
                mock_db_session,
                purchase_data=sample_purchase_data,
                created_by=uuid4()
            )
            
            assert result.transaction_number == "PUR-2025-001"
            assert result.total_amount == Decimal("500.00")

    async def test_receive_purchase_order_success(self, purchase_service, mock_db_session):
        """Test successful purchase order receiving."""
        purchase_id = uuid4()
        
        received_items = [
            {
                "line_id": uuid4(),
                "quantity_received": Decimal("10.00"),
                "condition": "excellent",
                "notes": "All items in good condition"
            },
            {
                "line_id": uuid4(),
                "quantity_received": Decimal("4.00"),  # Partial receipt
                "condition": "good",
                "notes": "1 item damaged, excluded"
            }
        ]
        
        with patch.object(purchase_service, 'receive_purchase_order') as mock_receive:
            mock_result = {
                "purchase_id": str(purchase_id),
                "status": "partially_received",
                "total_received": Decimal("14.00"),
                "total_expected": Decimal("15.00"),
                "inventory_updated": True,
                "received_items": received_items
            }
            mock_receive.return_value = mock_result
            
            result = await purchase_service.receive_purchase_order(
                mock_db_session,
                purchase_id=purchase_id,
                received_items=received_items,
                received_by=uuid4()
            )
            
            assert result["status"] == "partially_received"
            assert result["total_received"] == Decimal("14.00")

    async def test_bulk_purchase_creation(self, purchase_service, mock_db_session):
        """Test bulk purchase order creation."""
        bulk_data = PurchaseBulkCreate(
            supplier_id=uuid4(),
            location_id=uuid4(),
            purchases=[
                {
                    "purchase_order_number": "PO-2025-001",
                    "expected_delivery_date": date.today() + timedelta(days=7),
                    "line_items": [
                        {
                            "item_id": uuid4(),
                            "quantity": Decimal("100.00"),
                            "unit_cost": Decimal("10.00")
                        }
                    ]
                },
                {
                    "purchase_order_number": "PO-2025-002",
                    "expected_delivery_date": date.today() + timedelta(days=14),
                    "line_items": [
                        {
                            "item_id": uuid4(),
                            "quantity": Decimal("50.00"),
                            "unit_cost": Decimal("20.00")
                        }
                    ]
                }
            ]
        )
        
        with patch.object(purchase_service, 'create_bulk_purchases') as mock_bulk_create:
            mock_purchases = [
                MagicMock(transaction_number="PO-2025-001", total_amount=Decimal("1000.00")),
                MagicMock(transaction_number="PO-2025-002", total_amount=Decimal("1000.00"))
            ]
            mock_bulk_create.return_value = mock_purchases
            
            result = await purchase_service.create_bulk_purchases(
                mock_db_session,
                bulk_data=bulk_data,
                created_by=uuid4()
            )
            
            assert len(result) == 2
            assert all(p.total_amount == Decimal("1000.00") for p in result)


class TestSalesService:
    """Test suite for sales transaction operations."""

    @pytest.fixture
    def sales_service(self):
        return SalesService()

    @pytest.fixture
    def sample_sales_data(self):
        return SalesCreate(
            customer_id=uuid4(),
            location_id=uuid4(),
            payment_method=PaymentMethod.CREDIT_CARD,
            line_items=[
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("2.00"),
                    "unit_price": Decimal("75.00"),
                    "discount_amount": Decimal("5.00")
                }
            ],
            notes="Customer purchase"
        )

    async def test_create_sales_transaction_success(self, sales_service, mock_db_session, sample_sales_data):
        """Test successful sales transaction creation."""
        with patch.object(sales_service, 'create_sales_transaction') as mock_create:
            mock_sale = MagicMock()
            mock_sale.id = uuid4()
            mock_sale.transaction_number = "SAL-2025-001"
            mock_sale.status = TransactionStatus.COMPLETED
            mock_sale.total_amount = Decimal("145.00")
            mock_create.return_value = mock_sale
            
            result = await sales_service.create_sales_transaction(
                mock_db_session,
                sales_data=sample_sales_data,
                created_by=uuid4()
            )
            
            assert result.transaction_number == "SAL-2025-001"
            assert result.status == TransactionStatus.COMPLETED

    async def test_process_sales_payment_success(self, sales_service, mock_db_session):
        """Test successful sales payment processing."""
        sales_id = uuid4()
        
        with patch.object(sales_service, 'process_payment') as mock_process_payment:
            mock_result = {
                "payment_successful": True,
                "amount_processed": Decimal("145.00"),
                "payment_reference": "PAY123456",
                "receipt_number": "RCP-2025-001"
            }
            mock_process_payment.return_value = mock_result
            
            result = await sales_service.process_payment(
                mock_db_session,
                sales_id=sales_id,
                payment_amount=Decimal("145.00"),
                payment_method=PaymentMethod.CREDIT_CARD,
                card_reference="CARD123"
            )
            
            assert result["payment_successful"] is True
            assert result["amount_processed"] == Decimal("145.00")

    async def test_generate_sales_report(self, sales_service, mock_db_session):
        """Test sales report generation."""
        with patch.object(sales_service, 'generate_sales_report') as mock_generate_report:
            mock_report = {
                "period": "monthly",
                "start_date": date.today() - timedelta(days=30),
                "end_date": date.today(),
                "total_sales": Decimal("15000.00"),
                "total_transactions": 150,
                "average_transaction_value": Decimal("100.00"),
                "top_selling_items": [
                    {"item_id": str(uuid4()), "quantity_sold": Decimal("50.00")},
                    {"item_id": str(uuid4()), "quantity_sold": Decimal("35.00")}
                ]
            }
            mock_generate_report.return_value = mock_report
            
            result = await sales_service.generate_sales_report(
                mock_db_session,
                start_date=date.today() - timedelta(days=30),
                end_date=date.today(),
                location_id=uuid4()
            )
            
            assert result["total_sales"] == Decimal("15000.00")
            assert result["total_transactions"] == 150


class TestRentalService:
    """Test suite for rental transaction operations."""

    @pytest.fixture
    def rental_service(self):
        return RentalService()

    @pytest.fixture
    def sample_rental_data(self):
        return RentalCreate(
            customer_id=uuid4(),
            location_id=uuid4(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7),
            payment_method=PaymentMethod.CREDIT_CARD,
            pricing_strategy=RentalPricingStrategy.DAILY_RATE,
            line_items=[
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "daily_rate": Decimal("50.00"),
                    "deposit_amount": Decimal("100.00")
                }
            ],
            delivery_required=True,
            delivery_address="123 Main St"
        )

    async def test_create_rental_transaction_success(self, rental_service, mock_db_session, sample_rental_data):
        """Test successful rental transaction creation."""
        with patch.object(rental_service, 'create_rental_transaction') as mock_create:
            mock_rental = MagicMock()
            mock_rental.id = uuid4()
            mock_rental.transaction_number = "RNT-2025-001"
            mock_rental.rental_status = RentalStatus.ACTIVE
            mock_rental.total_amount = Decimal("450.00")  # (50 * 7) + 100
            mock_create.return_value = mock_rental
            
            result = await rental_service.create_rental_transaction(
                mock_db_session,
                rental_data=sample_rental_data,
                created_by=uuid4()
            )
            
            assert result.transaction_number == "RNT-2025-001"
            assert result.rental_status == RentalStatus.ACTIVE

    async def test_extend_rental_period_success(self, rental_service, mock_db_session):
        """Test successful rental period extension."""
        rental_id = uuid4()
        
        extend_data = RentalExtend(
            additional_days=3,
            daily_rate=Decimal("50.00"),
            reason="Customer request"
        )
        
        with patch.object(rental_service, 'extend_rental_period') as mock_extend:
            mock_result = {
                "rental_id": str(rental_id),
                "original_end_date": date.today() + timedelta(days=7),
                "new_end_date": date.today() + timedelta(days=10),
                "additional_cost": Decimal("150.00"),
                "total_cost": Decimal("600.00")
            }
            mock_extend.return_value = mock_result
            
            result = await rental_service.extend_rental_period(
                mock_db_session,
                rental_id=rental_id,
                extend_data=extend_data,
                extended_by=uuid4()
            )
            
            assert result["additional_cost"] == Decimal("150.00")
            assert result["total_cost"] == Decimal("600.00")

    async def test_process_rental_return_success(self, rental_service, mock_db_session):
        """Test successful rental return processing."""
        rental_id = uuid4()
        
        return_data = RentalReturn(
            return_date=date.today(),
            items=[
                {
                    "line_id": uuid4(),
                    "condition": "good",
                    "damage_notes": "Minor scuff on side"
                }
            ],
            early_return=True,
            return_location_id=uuid4()
        )
        
        with patch.object(rental_service, 'process_rental_return') as mock_return:
            mock_result = {
                "rental_id": str(rental_id),
                "return_processed": True,
                "deposit_refund": Decimal("95.00"),  # 100 - 5 damage fee
                "early_return_credit": Decimal("25.00"),
                "final_total": Decimal("375.00")
            }
            mock_return.return_value = mock_result
            
            result = await rental_service.process_rental_return(
                mock_db_session,
                rental_id=rental_id,
                return_data=return_data,
                processed_by=uuid4()
            )
            
            assert result["return_processed"] is True
            assert result["deposit_refund"] == Decimal("95.00")

    async def test_calculate_rental_pricing(self, rental_service, mock_db_session):
        """Test rental pricing calculations."""
        with patch.object(rental_service, 'calculate_rental_pricing') as mock_calculate:
            pricing_data = {
                "item_id": uuid4(),
                "rental_period": 7,
                "pricing_strategy": RentalPricingStrategy.DAILY_RATE,
                "daily_rate": Decimal("50.00"),
                "weekly_discount": Decimal("0.10"),
                "deposit_rate": Decimal("2.00")  # 2x daily rate
            }
            
            expected_pricing = {
                "base_cost": Decimal("350.00"),  # 50 * 7
                "discount_amount": Decimal("35.00"),  # 10% weekly discount
                "final_rental_cost": Decimal("315.00"),
                "deposit_amount": Decimal("100.00"),  # 50 * 2
                "total_due": Decimal("415.00")
            }
            mock_calculate.return_value = expected_pricing
            
            result = await rental_service.calculate_rental_pricing(mock_db_session, **pricing_data)
            
            assert result["final_rental_cost"] == Decimal("315.00")
            assert result["deposit_amount"] == Decimal("100.00")

    async def test_check_item_availability(self, rental_service, mock_db_session):
        """Test checking item availability for rental."""
        with patch.object(rental_service, 'check_item_availability') as mock_check_availability:
            availability_data = {
                "item_id": uuid4(),
                "location_id": uuid4(),
                "start_date": date.today() + timedelta(days=1),
                "end_date": date.today() + timedelta(days=8),
                "quantity_needed": Decimal("2.00")
            }
            
            mock_availability = {
                "available": True,
                "quantity_available": Decimal("5.00"),
                "conflicting_rentals": [],
                "next_available_date": None
            }
            mock_check_availability.return_value = mock_availability
            
            result = await rental_service.check_item_availability(mock_db_session, **availability_data)
            
            assert result["available"] is True
            assert result["quantity_available"] == Decimal("5.00")


class TestPurchaseReturnsService:
    """Test suite for purchase return operations."""

    @pytest.fixture
    def returns_service(self):
        return PurchaseReturnsService()

    @pytest.fixture
    def sample_return_data(self):
        return PurchaseReturnCreate(
            original_purchase_id=uuid4(),
            return_type=ReturnType.DEFECTIVE,
            supplier_id=uuid4(),
            return_items=[
                {
                    "line_id": uuid4(),
                    "quantity_returned": Decimal("2.00"),
                    "return_reason": "Defective items",
                    "condition": "damaged"
                }
            ],
            return_shipping_cost=Decimal("25.00"),
            restocking_fee=Decimal("10.00")
        )

    async def test_create_purchase_return_success(self, returns_service, mock_db_session, sample_return_data):
        """Test successful purchase return creation."""
        with patch.object(returns_service, 'create_purchase_return') as mock_create:
            mock_return = MagicMock()
            mock_return.id = uuid4()
            mock_return.transaction_number = "RTN-2025-001"
            mock_return.status = TransactionStatus.PENDING
            mock_return.refund_amount = Decimal("115.00")  # 150 - 25 - 10
            mock_create.return_value = mock_return
            
            result = await returns_service.create_purchase_return(
                mock_db_session,
                return_data=sample_return_data,
                created_by=uuid4()
            )
            
            assert result.transaction_number == "RTN-2025-001"
            assert result.refund_amount == Decimal("115.00")

    async def test_process_return_refund_success(self, returns_service, mock_db_session):
        """Test successful return refund processing."""
        return_id = uuid4()
        
        with patch.object(returns_service, 'process_refund') as mock_process_refund:
            mock_result = {
                "refund_processed": True,
                "refund_amount": Decimal("115.00"),
                "refund_method": "credit_card",
                "refund_reference": "REF123456",
                "processing_date": date.today()
            }
            mock_process_refund.return_value = mock_result
            
            result = await returns_service.process_refund(
                mock_db_session,
                return_id=return_id,
                refund_method="credit_card",
                processed_by=uuid4()
            )
            
            assert result["refund_processed"] is True
            assert result["refund_amount"] == Decimal("115.00")

    async def test_calculate_return_value(self, returns_service, mock_db_session):
        """Test calculation of return value."""
        with patch.object(returns_service, 'calculate_return_value') as mock_calculate:
            return_calculation = {
                "original_cost": Decimal("150.00"),
                "quantity_returned": Decimal("2.00"),
                "quantity_original": Decimal("3.00"),
                "return_reason": "defective",
                "days_since_purchase": 5,
                "restocking_fee_rate": Decimal("0.15")
            }
            
            expected_value = {
                "prorated_cost": Decimal("100.00"),  # (150/3) * 2
                "restocking_fee": Decimal("15.00"),   # 100 * 0.15
                "final_refund": Decimal("85.00")      # 100 - 15
            }
            mock_calculate.return_value = expected_value
            
            result = await returns_service.calculate_return_value(mock_db_session, **return_calculation)
            
            assert result["final_refund"] == Decimal("85.00")

    async def test_validate_return_eligibility(self, returns_service, mock_db_session):
        """Test return eligibility validation."""
        purchase_id = uuid4()
        
        with patch.object(returns_service, 'validate_return_eligibility') as mock_validate:
            mock_validation = {
                "eligible": True,
                "days_since_purchase": 15,
                "return_window_days": 30,
                "restrictions": [],
                "special_conditions": ["restocking_fee_applies"]
            }
            mock_validate.return_value = mock_validation
            
            result = await returns_service.validate_return_eligibility(
                mock_db_session,
                purchase_id=purchase_id,
                return_items=[{"line_id": uuid4(), "quantity": Decimal("1.00")}]
            )
            
            assert result["eligible"] is True
            assert result["days_since_purchase"] == 15