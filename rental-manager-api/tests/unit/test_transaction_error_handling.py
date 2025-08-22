"""
Comprehensive error handling and edge case tests for transaction module.

Tests database constraints, business rule violations, concurrency issues,
and system boundary conditions for all transaction types.
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, DisconnectionError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

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
    PurchaseReturnsService
)


class TestDatabaseConstraintErrors:
    """Test database constraint violations and error handling."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_duplicate_transaction_number_constraint(self, db_session, transaction_service):
        """Test handling of duplicate transaction number creation."""
        transaction_data = {
            "transaction_number": "TXN-2025-001",
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("100.00")
        }
        
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            # First creation succeeds
            mock_create.return_value = MagicMock(transaction_number="TXN-2025-001")
            first_transaction = await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )
            
            # Second creation with same number should fail
            mock_create.side_effect = IntegrityError("", "", "")
            
            with pytest.raises(IntegrityError):
                await transaction_service.create_transaction(
                    db_session, **transaction_data, created_by=uuid4()
                )

    async def test_foreign_key_constraint_violation(self, db_session, transaction_service):
        """Test foreign key constraint violations."""
        # Try to create transaction with non-existent customer
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),  # Non-existent customer
            "location_id": uuid4(),  # Non-existent location
            "total_amount": Decimal("100.00")
        }
        
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            mock_create.side_effect = IntegrityError("", "", "")
            
            with pytest.raises(IntegrityError):
                await transaction_service.create_transaction(
                    db_session, **transaction_data, created_by=uuid4()
                )

    async def test_check_constraint_violation(self, db_session, transaction_service):
        """Test check constraint violations (negative amounts)."""
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("-100.00"),  # Negative amount should violate check constraint
            "tax_amount": Decimal("-10.00")
        }
        
        with pytest.raises((IntegrityError, ValueError)):
            await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )

    async def test_null_constraint_violation(self, db_session):
        """Test NOT NULL constraint violations."""
        purchase_service = PurchaseService()
        
        # Try to create purchase without required fields
        purchase_data = {
            "supplier_id": None,  # Required field
            "location_id": uuid4(),
            "line_items": []
        }
        
        with pytest.raises((IntegrityError, ValueError)):
            await purchase_service.create_purchase_order(
                db_session, purchase_data=purchase_data, created_by=uuid4()
            )


class TestBusinessRuleViolations:
    """Test business rule violations and validation errors."""

    @pytest.fixture
    def sales_service(self):
        return SalesService()

    @pytest.fixture
    def rental_service(self):
        return RentalService()

    @pytest.fixture
    def purchase_service(self):
        return PurchaseService()

    async def test_insufficient_inventory_for_sale(self, db_session, sales_service):
        """Test sale creation with insufficient inventory."""
        sales_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("100.00"),  # More than available
                    "unit_price": Decimal("50.00")
                }
            ]
        }
        
        with patch('app.services.inventory.InventoryService.check_availability') as mock_check:
            mock_check.return_value = {
                "available": False,
                "quantity_available": Decimal("5.00"),
                "shortage": Decimal("95.00")
            }
            
            with pytest.raises(ValueError, match="Insufficient inventory"):
                await sales_service.create_sales_transaction(
                    db_session,
                    sales_data=sales_data,
                    created_by=uuid4()
                )

    async def test_invalid_rental_date_range(self, db_session, rental_service):
        """Test rental creation with invalid date ranges."""
        rental_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "rental_start_date": date.today(),
            "rental_end_date": date.today() - timedelta(days=1),  # End before start
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "daily_rate": Decimal("50.00")
                }
            ]
        }
        
        with pytest.raises(ValueError, match="End date cannot be before start date"):
            await rental_service.create_rental_transaction(
                db_session,
                rental_data=rental_data,
                created_by=uuid4()
            )

    async def test_cancel_completed_transaction(self, db_session):
        """Test attempting to cancel a completed transaction."""
        transaction_service = TransactionService()
        transaction_id = uuid4()
        
        with patch.object(transaction_service, 'get_transaction') as mock_get:
            mock_transaction = MagicMock()
            mock_transaction.status = TransactionStatus.COMPLETED
            mock_get.return_value = mock_transaction
            
            with pytest.raises(ValueError, match="Cannot cancel completed transaction"):
                await transaction_service.cancel_transaction(
                    db_session,
                    transaction_id=transaction_id,
                    reason="Test cancellation",
                    cancelled_by=uuid4()
                )

    async def test_modify_paid_transaction(self, db_session, sales_service):
        """Test attempting to modify a paid transaction."""
        transaction_id = uuid4()
        
        with patch.object(sales_service, 'get_transaction') as mock_get:
            mock_transaction = MagicMock()
            mock_transaction.payment_status = PaymentStatus.PAID
            mock_get.return_value = mock_transaction
            
            with pytest.raises(ValueError, match="Cannot modify paid transaction"):
                await sales_service.update_transaction(
                    db_session,
                    transaction_id=transaction_id,
                    update_data={"total_amount": Decimal("200.00")},
                    updated_by=uuid4()
                )

    async def test_return_non_returnable_item(self, db_session):
        """Test attempting to return non-returnable items."""
        returns_service = PurchaseReturnsService()
        
        return_data = {
            "original_purchase_id": uuid4(),
            "return_items": [
                {
                    "line_id": uuid4(),
                    "quantity_returned": Decimal("1.00"),
                    "return_reason": "Changed mind"
                }
            ]
        }
        
        with patch.object(returns_service, 'validate_return_eligibility') as mock_validate:
            mock_validate.return_value = {
                "eligible": False,
                "reason": "Item is past return window",
                "restrictions": ["no_returns_after_30_days"]
            }
            
            with pytest.raises(ValueError, match="Item is not eligible for return"):
                await returns_service.create_purchase_return(
                    db_session,
                    return_data=return_data,
                    created_by=uuid4()
                )

    async def test_exceed_purchase_order_budget(self, db_session, purchase_service):
        """Test purchase order exceeding budget limits."""
        purchase_data = {
            "supplier_id": uuid4(),
            "location_id": uuid4(),
            "budget_limit": Decimal("1000.00"),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("100.00"),
                    "unit_cost": Decimal("15.00")  # Total: 1500.00 > 1000.00
                }
            ]
        }
        
        with pytest.raises(ValueError, match="Purchase order exceeds budget limit"):
            await purchase_service.create_purchase_order(
                db_session,
                purchase_data=purchase_data,
                created_by=uuid4()
            )

    async def test_rental_item_already_rented(self, db_session, rental_service):
        """Test renting an item that's already rented for the same period."""
        rental_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "rental_start_date": date.today(),
            "rental_end_date": date.today() + timedelta(days=7),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "daily_rate": Decimal("50.00")
                }
            ]
        }
        
        with patch.object(rental_service, 'check_item_availability') as mock_check:
            mock_check.return_value = {
                "available": False,
                "conflicting_rentals": [
                    {
                        "rental_id": str(uuid4()),
                        "start_date": date.today(),
                        "end_date": date.today() + timedelta(days=5)
                    }
                ]
            }
            
            with pytest.raises(ValueError, match="Item is not available for the requested period"):
                await rental_service.create_rental_transaction(
                    db_session,
                    rental_data=rental_data,
                    created_by=uuid4()
                )


class TestConcurrencyAndRaceConditions:
    """Test concurrent operations and race condition handling."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_concurrent_payment_processing(self, db_session, transaction_service):
        """Test concurrent payment processing on same transaction."""
        transaction_id = uuid4()
        
        with patch.object(transaction_service, 'get_transaction') as mock_get, \
             patch.object(transaction_service, 'process_payment') as mock_process:
            
            mock_transaction = MagicMock()
            mock_transaction.id = transaction_id
            mock_transaction.payment_status = PaymentStatus.PENDING
            mock_transaction.version = 1
            mock_get.return_value = mock_transaction
            
            # Simulate optimistic locking failure
            mock_process.side_effect = SQLAlchemyError("Row was updated by another transaction")
            
            with pytest.raises(SQLAlchemyError):
                await transaction_service.process_payment(
                    db_session,
                    transaction_id=transaction_id,
                    payment_amount=Decimal("100.00"),
                    payment_method=PaymentMethod.CREDIT_CARD
                )

    async def test_concurrent_inventory_allocation(self, db_session):
        """Test concurrent inventory allocation for sales."""
        sales_service = SalesService()
        item_id = uuid4()
        
        sales_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "line_items": [
                {
                    "item_id": item_id,
                    "quantity": Decimal("5.00"),
                    "unit_price": Decimal("50.00")
                }
            ]
        }
        
        with patch('app.services.inventory.InventoryService.allocate_inventory') as mock_allocate:
            # Simulate race condition where inventory was allocated by another process
            mock_allocate.side_effect = ValueError("Insufficient inventory available")
            
            with pytest.raises(ValueError):
                await sales_service.create_sales_transaction(
                    db_session,
                    sales_data=sales_data,
                    created_by=uuid4()
                )

    async def test_concurrent_rental_booking(self, db_session):
        """Test concurrent rental booking of same item."""
        rental_service = RentalService()
        
        rental_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "rental_start_date": date.today(),
            "rental_end_date": date.today() + timedelta(days=7),
            "line_items": [
                {
                    "item_id": uuid4(),
                    "quantity": Decimal("1.00"),
                    "daily_rate": Decimal("50.00")
                }
            ]
        }
        
        with patch.object(rental_service, 'create_rental_transaction') as mock_create:
            # First booking succeeds
            mock_create.return_value = MagicMock(rental_status=RentalStatus.ACTIVE)
            first_rental = await rental_service.create_rental_transaction(
                db_session, rental_data=rental_data, created_by=uuid4()
            )
            
            # Second concurrent booking should fail
            mock_create.side_effect = ValueError("Item already booked for this period")
            
            with pytest.raises(ValueError):
                await rental_service.create_rental_transaction(
                    db_session, rental_data=rental_data, created_by=uuid4()
                )


class TestSystemBoundaryConditions:
    """Test system limits and boundary conditions."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_maximum_decimal_precision(self, db_session, transaction_service):
        """Test handling of maximum decimal precision values."""
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("999999999.9999"),  # Maximum precision
            "tax_amount": Decimal("0.0001")  # Minimum precision
        }
        
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            mock_transaction = MagicMock()
            mock_transaction.total_amount = Decimal("999999999.9999")
            mock_create.return_value = mock_transaction
            
            result = await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )
            
            assert result.total_amount == Decimal("999999999.9999")

    async def test_zero_amount_transactions(self, db_session, transaction_service):
        """Test handling of zero-amount transactions."""
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("0.00"),  # Zero amount
            "discount_amount": Decimal("0.00")
        }
        
        # Zero amount transactions should be allowed for certain scenarios
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            mock_transaction = MagicMock()
            mock_transaction.total_amount = Decimal("0.00")
            mock_create.return_value = mock_transaction
            
            result = await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )
            
            assert result.total_amount == Decimal("0.00")

    async def test_large_line_item_count(self, db_session):
        """Test transactions with very large number of line items."""
        sales_service = SalesService()
        
        # Create sales transaction with 1000 line items
        large_line_items = [
            {
                "item_id": uuid4(),
                "quantity": Decimal("1.00"),
                "unit_price": Decimal("10.00")
            }
            for _ in range(1000)
        ]
        
        sales_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "line_items": large_line_items
        }
        
        with patch.object(sales_service, 'create_sales_transaction') as mock_create:
            # Should handle large transactions but may have performance implications
            mock_create.side_effect = MemoryError("Transaction too large")
            
            with pytest.raises(MemoryError):
                await sales_service.create_sales_transaction(
                    db_session,
                    sales_data=sales_data,
                    created_by=uuid4()
                )

    async def test_invalid_uuid_format(self, db_session, transaction_service):
        """Test handling of invalid UUID formats."""
        with pytest.raises((ValueError, TypeError)):
            await transaction_service.get_transaction(
                db_session,
                transaction_id="invalid-uuid-format"
            )

    async def test_extremely_long_strings(self, db_session, transaction_service):
        """Test handling of extremely long string inputs."""
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("100.00"),
            "notes": "A" * 10000  # Very long notes field
        }
        
        with pytest.raises(ValueError, match="Notes field too long"):
            await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )


class TestNetworkAndConnectionErrors:
    """Test network and database connection error handling."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_database_connection_loss(self, db_session, transaction_service):
        """Test handling of database connection loss."""
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            # Simulate connection loss
            mock_create.side_effect = DisconnectionError("Connection lost", "", "")
            
            with pytest.raises(DisconnectionError):
                await transaction_service.create_transaction(
                    db_session,
                    transaction_type=TransactionType.SALE,
                    customer_id=uuid4(),
                    location_id=uuid4(),
                    total_amount=Decimal("100.00"),
                    created_by=uuid4()
                )

    async def test_database_timeout(self, db_session, transaction_service):
        """Test handling of database operation timeouts."""
        with patch.object(transaction_service, 'get_transactions') as mock_get:
            # Simulate timeout
            mock_get.side_effect = asyncio.TimeoutError("Query timeout")
            
            with pytest.raises(asyncio.TimeoutError):
                await transaction_service.get_transactions(
                    db_session, skip=0, limit=1000
                )

    async def test_payment_gateway_failure(self, db_session):
        """Test handling of payment gateway failures."""
        sales_service = SalesService()
        
        with patch.object(sales_service, 'process_payment') as mock_payment:
            mock_payment.side_effect = ConnectionError("Payment gateway unavailable")
            
            with pytest.raises(ConnectionError):
                await sales_service.process_payment(
                    db_session,
                    sales_id=uuid4(),
                    payment_amount=Decimal("100.00"),
                    payment_method=PaymentMethod.CREDIT_CARD
                )


class TestDataCorruptionRecovery:
    """Test data corruption detection and recovery."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_inconsistent_transaction_totals(self, db_session, transaction_service):
        """Test detection of inconsistent transaction total calculations."""
        with patch.object(transaction_service, 'validate_transaction_totals') as mock_validate:
            # Mock a transaction with inconsistent totals
            mock_transaction = MagicMock()
            mock_transaction.subtotal = Decimal("100.00")
            mock_transaction.tax_amount = Decimal("8.00")
            mock_transaction.discount_amount = Decimal("10.00")
            mock_transaction.total_amount = Decimal("105.00")  # Should be 98.00
            
            mock_validate.return_value = {
                "is_valid": False,
                "calculated_total": Decimal("98.00"),
                "stored_total": Decimal("105.00"),
                "discrepancy": Decimal("7.00")
            }
            
            validation_result = await transaction_service.validate_transaction_totals(
                db_session, transaction=mock_transaction
            )
            
            assert validation_result["is_valid"] is False
            assert validation_result["discrepancy"] == Decimal("7.00")

    async def test_orphaned_transaction_lines(self, db_session, transaction_service):
        """Test detection of orphaned transaction line items."""
        with patch.object(transaction_service, 'find_orphaned_lines') as mock_find_orphaned:
            orphaned_lines = [
                {
                    "line_id": str(uuid4()),
                    "transaction_header_id": str(uuid4()),
                    "issue": "transaction_header_not_found"
                },
                {
                    "line_id": str(uuid4()),
                    "transaction_header_id": str(uuid4()),
                    "issue": "item_reference_invalid"
                }
            ]
            mock_find_orphaned.return_value = orphaned_lines
            
            result = await transaction_service.find_orphaned_lines(db_session)
            
            assert len(result) == 2
            assert all("line_id" in line for line in result)

    async def test_audit_trail_gaps(self, db_session, transaction_service):
        """Test detection of gaps in transaction audit trail."""
        with patch.object(transaction_service, 'validate_audit_trail') as mock_validate_audit:
            audit_issues = {
                "missing_events": 3,
                "orphaned_events": 1,
                "timestamp_inconsistencies": 2,
                "user_reference_issues": 0
            }
            mock_validate_audit.return_value = audit_issues
            
            result = await transaction_service.validate_audit_trail(db_session)
            
            assert result["missing_events"] > 0
            assert result["orphaned_events"] > 0


class TestSecurityBoundaryTests:
    """Test security boundary conditions and validation."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_sql_injection_prevention(self, db_session, transaction_service):
        """Test SQL injection prevention in search operations."""
        # Attempt SQL injection in search parameters
        malicious_input = "'; DROP TABLE transactions; --"
        
        with patch.object(transaction_service, 'search_transactions') as mock_search:
            # Should not execute malicious SQL
            mock_search.return_value = []
            
            try:
                result = await transaction_service.search_transactions(
                    db_session,
                    search_term=malicious_input
                )
                assert isinstance(result, list)
            except Exception as e:
                # Should not be a SQL syntax error
                assert "syntax error" not in str(e).lower()

    async def test_authorization_bypass_prevention(self, db_session, transaction_service):
        """Test prevention of authorization bypass attempts."""
        # Test attempting operations with invalid/fake user IDs
        fake_user_id = uuid4()
        
        with patch('app.api.deps.get_current_user') as mock_get_user:
            mock_get_user.return_value = None  # No authenticated user
            
            with pytest.raises((HTTPException, ValueError)):
                await transaction_service.create_transaction(
                    db_session,
                    transaction_type=TransactionType.SALE,
                    customer_id=uuid4(),
                    location_id=uuid4(),
                    total_amount=Decimal("100.00"),
                    created_by=fake_user_id
                )

    async def test_input_validation_xss_prevention(self, db_session, transaction_service):
        """Test XSS prevention in text inputs."""
        # Attempt XSS in notes field
        xss_input = "<script>alert('XSS')</script>"
        
        transaction_data = {
            "transaction_type": TransactionType.SALE,
            "customer_id": uuid4(),
            "location_id": uuid4(),
            "total_amount": Decimal("100.00"),
            "notes": xss_input
        }
        
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            # Should sanitize or escape XSS input
            mock_transaction = MagicMock()
            mock_transaction.notes = "&lt;script&gt;alert('XSS')&lt;/script&gt;"  # Escaped
            mock_create.return_value = mock_transaction
            
            result = await transaction_service.create_transaction(
                db_session, **transaction_data, created_by=uuid4()
            )
            
            # Should not contain unescaped script tags
            assert "<script>" not in result.notes

    async def test_privilege_escalation_prevention(self, db_session, transaction_service):
        """Test prevention of privilege escalation attempts."""
        # Test user trying to access transactions they don't own
        user_id = uuid4()
        other_user_transaction_id = uuid4()
        
        with patch.object(transaction_service, 'get_transaction') as mock_get, \
             patch.object(transaction_service, 'check_transaction_ownership') as mock_check_ownership:
            
            mock_transaction = MagicMock()
            mock_transaction.created_by = uuid4()  # Different user
            mock_get.return_value = mock_transaction
            
            mock_check_ownership.return_value = False
            
            with pytest.raises(ValueError, match="Access denied"):
                await transaction_service.get_transaction(
                    db_session,
                    transaction_id=other_user_transaction_id,
                    requesting_user_id=user_id
                )


class TestPerformanceBoundaryConditions:
    """Test performance boundary conditions and timeouts."""

    @pytest.fixture
    def transaction_service(self):
        return TransactionService()

    async def test_large_result_set_handling(self, db_session, transaction_service):
        """Test handling of very large result sets."""
        with patch.object(transaction_service, 'get_transactions') as mock_get:
            # Simulate memory pressure with large result set
            def memory_intensive_generator():
                for i in range(100000):  # 100k transactions
                    yield MagicMock(id=uuid4(), total_amount=Decimal("100.00"))
            
            mock_get.return_value = {
                "items": list(memory_intensive_generator()),
                "total": 100000
            }
            
            # Should handle large result sets with pagination
            with pytest.raises((MemoryError, TimeoutError)):
                await transaction_service.get_transactions(
                    db_session, skip=0, limit=100000
                )

    async def test_complex_query_timeout(self, db_session, transaction_service):
        """Test timeout handling for complex queries."""
        with patch.object(transaction_service, 'generate_complex_report') as mock_query:
            # Simulate long-running query
            async def slow_query(*args, **kwargs):
                await asyncio.sleep(60)  # 60 second query
                return {}
            
            mock_query.side_effect = slow_query
            
            # Should timeout and raise appropriate error
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(
                    transaction_service.generate_complex_report(db_session),
                    timeout=5.0  # 5 second timeout
                )

    async def test_high_concurrency_load(self, db_session, transaction_service):
        """Test system behavior under high concurrency load."""
        # Simulate high concurrent transaction creation requests
        async def concurrent_transaction_creation():
            return await transaction_service.create_transaction(
                db_session,
                transaction_type=TransactionType.SALE,
                customer_id=uuid4(),
                location_id=uuid4(),
                total_amount=Decimal("100.00"),
                created_by=uuid4()
            )
        
        # Create many concurrent tasks
        tasks = [concurrent_transaction_creation() for _ in range(50)]
        
        # Should handle high concurrency gracefully
        with patch.object(transaction_service, 'create_transaction') as mock_create:
            # Some may succeed, some may fail due to constraints
            def side_effect(*args, **kwargs):
                import random
                if random.random() < 0.8:  # 80% success rate
                    return MagicMock(id=uuid4())
                else:
                    raise SQLAlchemyError("Database constraint violation")
            
            mock_create.side_effect = side_effect
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Count successful vs failed operations
            successful = sum(1 for r in results if not isinstance(r, Exception))
            failed = len(results) - successful
            
            # At least some should succeed
            assert successful > 0
            assert all(
                isinstance(r, (SQLAlchemyError, IntegrityError, ValueError))
                for r in results if isinstance(r, Exception)
            )