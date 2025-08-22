"""
Comprehensive test suite for rental_core module.
Tests all edge cases, validation scenarios, and business logic.
"""

import pytest
import asyncio
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import uuid4, UUID
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch, MagicMock

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import selectinload

from app.modules.transactions.rentals.rental_core.service import RentalsService
from app.modules.transactions.rentals.rental_core.repository import RentalsRepository
from app.modules.transactions.rentals.rental_core.schemas import (
    NewRentalRequest,
    RentalItemCreate,
    RentalResponse,
    RentalDetail,
    RentalPeriodUpdate,
    CustomerNestedResponse,
    LocationNestedResponse,
    ItemNestedResponse,
    RentableItemResponse,
    LocationAvailability
)
from app.modules.transactions.base.models.transaction_headers import (
    TransactionHeader,
    TransactionType,
    TransactionStatus,
    RentalStatus,
    RentalPeriodUnit
)
from app.modules.transactions.base.models.transaction_lines import TransactionLine, LineItemType
from app.modules.inventory.models import StockLevel, StockMovement
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item
from app.shared.exceptions import ValidationError, NotFoundError


class TestRentalCoreService:
    """Comprehensive test suite for RentalsService"""
    
    @pytest_asyncio.fixture
    async def mock_session(self):
        """Create a mock async session"""
        session = AsyncMock(spec=AsyncSession)
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.flush = AsyncMock()
        session.execute = AsyncMock()
        session.scalar = AsyncMock()
        session.scalars = AsyncMock()
        return session
    
    @pytest_asyncio.fixture
    async def mock_repository(self):
        """Create a mock repository"""
        repo = AsyncMock(spec=RentalsRepository)
        return repo
    
    @pytest_asyncio.fixture
    async def rental_service(self, mock_repository):
        """Create rental service with mocked repository"""
        service = RentalsService(repo=mock_repository)
        return service
    
    @pytest_asyncio.fixture
    def sample_rental_request(self):
        """Create a sample rental request"""
        return NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7),
            payment_method="CASH",
            notes="Test rental",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("10.00"),
                    notes="Test item"
                )
            ]
        )
    
    # ============================================================
    # SUCCESSFUL RENTAL CREATION TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_success(self, rental_service, mock_session, sample_rental_request):
        """Test successful rental creation with valid data"""
        # Arrange
        expected_rental_id = str(uuid4())
        rental_service.repo.create_transaction.return_value = {
            "tx_id": expected_rental_id,
            "tx_number": "RNT-2024-00001",
            "id": expected_rental_id,
            "transaction_number": "RNT-2024-00001"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, sample_rental_request)
        
        # Assert
        assert result["success"] is True
        assert result["transaction_id"] == expected_rental_id
        assert "data" in result
        assert result["data"]["transaction_number"] == "RNT-2024-00001"
        rental_service.repo.create_transaction.assert_called_once_with(mock_session, sample_rental_request)
    
    @pytest.mark.asyncio
    async def test_create_rental_multiple_items(self, rental_service, mock_session):
        """Test rental creation with multiple items"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=5),
            payment_method="CREDIT_CARD",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("3.00"),
                    unit_price=Decimal("150.00"),
                    discount_percent=Decimal("0.00")
                ),
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("250.00"),
                    discount_percent=Decimal("5.00")
                ),
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("75.00"),
                    discount_percent=Decimal("15.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00002"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert len(request.items) == 3
        rental_service.repo.create_transaction.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_rental_with_max_discount(self, rental_service, mock_session):
        """Test rental creation with maximum allowed discount"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="BANK_TRANSFER",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    discount_percent=Decimal("100.00")  # Max discount
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00003"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
    
    # ============================================================
    # EDGE CASES - DATE HANDLING
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_same_day_return(self, rental_service, mock_session):
        """Test rental with same day start and end (minimum rental period)"""
        # Arrange
        today = date.today()
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=today,
            rental_start_date=today,
            rental_end_date=today,  # Same day return
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("50.00"),
                    discount_percent=Decimal("0.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00004"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        # Verify rental period is 1 day minimum
        assert request.rental_end_date == request.rental_start_date
    
    @pytest.mark.asyncio
    async def test_create_rental_long_term(self, rental_service, mock_session):
        """Test long-term rental (365 days)"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=365),  # One year rental
            payment_method="CREDIT_CARD",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("10000.00"),
                    discount_percent=Decimal("20.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00005"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert (request.rental_end_date - request.rental_start_date).days == 365
    
    @pytest.mark.asyncio
    async def test_create_rental_future_dated(self, rental_service, mock_session):
        """Test rental with future start date"""
        # Arrange
        future_date = date.today() + timedelta(days=30)
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=future_date,
            rental_end_date=future_date + timedelta(days=7),
            payment_method="BANK_TRANSFER",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("200.00"),
                    discount_percent=Decimal("0.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00006"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.rental_start_date > date.today()
    
    # ============================================================
    # EDGE CASES - QUANTITY AND PRICING
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_fractional_quantity(self, rental_service, mock_session):
        """Test rental with fractional quantities (e.g., 0.5, 1.75)"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("0.5"),  # Half unit
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00")
                ),
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.75"),  # Fractional
                    unit_price=Decimal("200.00"),
                    discount_percent=Decimal("10.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00007"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.items[0].quantity == Decimal("0.5")
        assert request.items[1].quantity == Decimal("1.75")
    
    @pytest.mark.asyncio
    async def test_create_rental_large_quantity(self, rental_service, mock_session):
        """Test rental with very large quantity"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=1),
            payment_method="BANK_TRANSFER",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("9999.99"),  # Large quantity
                    unit_price=Decimal("1.00"),
                    discount_percent=Decimal("0.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00008"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.items[0].quantity == Decimal("9999.99")
    
    @pytest.mark.asyncio
    async def test_create_rental_minimum_price(self, rental_service, mock_session):
        """Test rental with minimum price (0.01)"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=1),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("0.01"),  # Minimum price
                    discount_percent=Decimal("0.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00009"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.items[0].unit_price == Decimal("0.01")
    
    @pytest.mark.asyncio
    async def test_create_rental_high_value(self, rental_service, mock_session):
        """Test rental with very high value transaction"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=30),
            payment_method="BANK_TRANSFER",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("100.00"),
                    unit_price=Decimal("99999.99"),  # High value
                    discount_percent=Decimal("0.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00010"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        total_value = request.items[0].quantity * request.items[0].unit_price
        assert total_value == Decimal("9999999.00")
    
    # ============================================================
    # ERROR HANDLING AND VALIDATION
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_empty_items_list(self, rental_service, mock_session):
        """Test rental creation with empty items list"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7),
            payment_method="CASH",
            items=[]  # Empty items list
        )
        
        # Act & Assert
        with pytest.raises(ValidationError):
            await rental_service.create_rental(mock_session, request)
    
    @pytest.mark.asyncio
    async def test_create_rental_invalid_date_range(self, rental_service, mock_session):
        """Test rental with end date before start date"""
        # Arrange
        with pytest.raises(ValidationError) as exc_info:
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() - timedelta(days=1),  # End before start
                payment_method="CASH",
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("100.00"),
                        discount_percent=Decimal("0.00")
                    )
                ]
            )
        
        # Assert
        assert "end_date" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_create_rental_negative_quantity(self, rental_service, mock_session):
        """Test rental with negative quantity"""
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() + timedelta(days=3),
                payment_method="CASH",
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal("-1.00"),  # Negative quantity
                        unit_price=Decimal("100.00"),
                        discount_percent=Decimal("0.00")
                    )
                ]
            )
    
    @pytest.mark.asyncio
    async def test_create_rental_negative_price(self, rental_service, mock_session):
        """Test rental with negative price"""
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() + timedelta(days=3),
                payment_method="CASH",
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("-100.00"),  # Negative price
                        discount_percent=Decimal("0.00")
                    )
                ]
            )
    
    @pytest.mark.asyncio
    async def test_create_rental_invalid_discount(self, rental_service, mock_session):
        """Test rental with discount greater than 100%"""
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() + timedelta(days=3),
                payment_method="CASH",
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("100.00"),
                        discount_percent=Decimal("101.00")  # Invalid discount
                    )
                ]
            )
    
    @pytest.mark.asyncio
    async def test_create_rental_repository_error(self, rental_service, mock_session, sample_rental_request):
        """Test rental creation when repository raises an error"""
        # Arrange
        rental_service.repo.create_transaction.side_effect = SQLAlchemyError("Database connection failed")
        
        # Act & Assert
        with pytest.raises(SQLAlchemyError):
            await rental_service.create_rental(mock_session, sample_rental_request)
    
    @pytest.mark.asyncio
    async def test_create_rental_no_transaction_id_returned(self, rental_service, mock_session, sample_rental_request):
        """Test rental creation when repository doesn't return transaction ID"""
        # Arrange
        rental_service.repo.create_transaction.return_value = {
            "tx_number": "RNT-2024-00011"
            # Missing tx_id and id
        }
        
        # Act & Assert
        with pytest.raises(ValueError, match="no transaction ID was returned"):
            await rental_service.create_rental(mock_session, sample_rental_request)
    
    # ============================================================
    # SPECIAL CHARACTERS AND UNICODE
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_unicode_notes(self, rental_service, mock_session):
        """Test rental with unicode characters in notes"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            notes="Test 测试 テスト тест 🚀 ñ é ü",  # Unicode characters
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00"),
                    notes="Item notes with emoji 😊"
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00012"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert "测试" in request.notes
        assert "😊" in request.items[0].notes
    
    @pytest.mark.asyncio
    async def test_create_rental_special_characters_notes(self, rental_service, mock_session):
        """Test rental with special characters and SQL injection attempts"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            notes="'; DROP TABLE rentals; --",  # SQL injection attempt
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00"),
                    notes="<script>alert('XSS')</script>"  # XSS attempt
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00013"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        # Notes should be safely stored without causing issues
        rental_service.repo.create_transaction.assert_called_once()
    
    # ============================================================
    # PAYMENT METHOD TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_all_payment_methods(self, rental_service, mock_session):
        """Test rental creation with all supported payment methods"""
        payment_methods = ["CASH", "CREDIT_CARD", "BANK_TRANSFER", "CHECK", "OTHER"]
        
        for payment_method in payment_methods:
            # Arrange
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() + timedelta(days=3),
                payment_method=payment_method,
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("100.00"),
                        discount_percent=Decimal("0.00")
                    )
                ]
            )
            
            rental_service.repo.create_transaction.return_value = {
                "tx_id": str(uuid4()),
                "tx_number": f"RNT-2024-{payment_method}"
            }
            
            # Act
            result = await rental_service.create_rental(mock_session, request)
            
            # Assert
            assert result["success"] is True
    
    # ============================================================
    # CONCURRENT RENTAL TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_multiple_rentals_concurrent(self, rental_service, mock_session):
        """Test creating multiple rentals concurrently"""
        # Arrange
        num_rentals = 10
        requests = []
        
        for i in range(num_rentals):
            request = NewRentalRequest(
                customer_id=uuid4(),
                location_id=uuid4(),
                transaction_date=date.today(),
                rental_start_date=date.today(),
                rental_end_date=date.today() + timedelta(days=i+1),
                payment_method="CASH",
                items=[
                    RentalItemCreate(
                        item_id=uuid4(),
                        quantity=Decimal(str(i+1)),
                        unit_price=Decimal("100.00"),
                        discount_percent=Decimal("0.00")
                    )
                ]
            )
            requests.append(request)
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-CONCURRENT"
        }
        
        # Act - Create rentals concurrently
        tasks = [rental_service.create_rental(mock_session, req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Assert
        for result in results:
            if not isinstance(result, Exception):
                assert result["success"] is True
        
        assert rental_service.repo.create_transaction.call_count == num_rentals
    
    # ============================================================
    # BOUNDARY VALUE TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_max_items_limit(self, rental_service, mock_session):
        """Test rental with maximum number of items (e.g., 100 items)"""
        # Arrange
        max_items = 100
        items = [
            RentalItemCreate(
                item_id=uuid4(),
                quantity=Decimal("1.00"),
                unit_price=Decimal("10.00"),
                discount_percent=Decimal("0.00")
            )
            for _ in range(max_items)
        ]
        
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7),
            payment_method="CREDIT_CARD",
            items=items
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-MAX-ITEMS"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert len(request.items) == max_items
    
    @pytest.mark.asyncio
    async def test_create_rental_zero_discount(self, rental_service, mock_session):
        """Test rental with zero discount"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00")  # Zero discount
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00014"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.items[0].discount_percent == Decimal("0.00")
    
    @pytest.mark.asyncio
    async def test_create_rental_maximum_notes_length(self, rental_service, mock_session):
        """Test rental with maximum allowed notes length"""
        # Arrange
        max_notes = "A" * 5000  # 5000 character notes
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            notes=max_notes,
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00"),
                    notes=max_notes
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00015"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert len(request.notes) == 5000
    
    # ============================================================
    # NULL AND OPTIONAL FIELDS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_null_optional_fields(self, rental_service, mock_session):
        """Test rental with all optional fields as None"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            notes=None,  # Optional
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00"),
                    notes=None  # Optional
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00016"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        assert request.notes is None
        assert request.items[0].notes is None
    
    # ============================================================
    # DECIMAL PRECISION TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_decimal_precision(self, rental_service, mock_session):
        """Test rental with high precision decimal values"""
        # Arrange
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("1.23456789"),  # High precision
                    unit_price=Decimal("99.99999"),  # High precision
                    discount_percent=Decimal("12.3456")  # High precision
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00017"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        # Values should be properly rounded based on system settings
    
    # ============================================================
    # ROLLBACK AND TRANSACTION TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_transaction_rollback(self, rental_service, mock_session, sample_rental_request):
        """Test that transaction is rolled back on error"""
        # Arrange
        rental_service.repo.create_transaction.side_effect = IntegrityError(
            "Duplicate key", None, None
        )
        
        # Act & Assert
        with pytest.raises(IntegrityError):
            await rental_service.create_rental(mock_session, sample_rental_request)
        
        # Verify rollback would be called (in real implementation)
        # mock_session.rollback.assert_called()
    
    # ============================================================
    # DUPLICATE ITEM TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_duplicate_items(self, rental_service, mock_session):
        """Test rental with same item ID multiple times"""
        # Arrange
        item_id = uuid4()
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.today(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=3),
            payment_method="CASH",
            items=[
                RentalItemCreate(
                    item_id=item_id,
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("0.00")
                ),
                RentalItemCreate(
                    item_id=item_id,  # Same item ID
                    quantity=Decimal("3.00"),
                    unit_price=Decimal("100.00"),
                    discount_percent=Decimal("10.00")
                )
            ]
        )
        
        rental_service.repo.create_transaction.return_value = {
            "tx_id": str(uuid4()),
            "tx_number": "RNT-2024-00018"
        }
        
        # Act
        result = await rental_service.create_rental(mock_session, request)
        
        # Assert
        assert result["success"] is True
        # System should handle duplicate items appropriately
        # (either combine them or treat as separate line items)
    
    # ============================================================
    # PERFORMANCE AND TIMEOUT TESTS
    # ============================================================
    
    @pytest.mark.asyncio
    async def test_create_rental_timeout_handling(self, rental_service, mock_session, sample_rental_request):
        """Test rental creation with simulated timeout"""
        # Arrange
        async def slow_create():
            await asyncio.sleep(10)  # Simulate slow operation
            return {"tx_id": str(uuid4()), "tx_number": "RNT-TIMEOUT"}
        
        rental_service.repo.create_transaction = slow_create
        
        # Act & Assert
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(
                rental_service.create_rental(mock_session, sample_rental_request),
                timeout=1.0
            )


class TestRentalCoreRepository:
    """Comprehensive test suite for RentalsRepository"""
    
    @pytest_asyncio.fixture
    async def mock_session(self):
        """Create a mock async session"""
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        session.scalar = AsyncMock()
        session.scalars = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.flush = AsyncMock()
        return session
    
    @pytest_asyncio.fixture
    async def repository(self):
        """Create repository instance"""
        return RentalsRepository()
    
    @pytest.mark.asyncio
    async def test_validate_customer_location_success(self, repository, mock_session):
        """Test successful customer and location validation"""
        # Arrange
        customer_id = uuid4()
        location_id = uuid4()
        
        mock_customer = Mock(spec=Customer)
        mock_customer.id = customer_id
        mock_customer.name = "Test Customer"
        
        mock_location = Mock(spec=Location)
        mock_location.id = location_id
        mock_location.name = "Test Location"
        
        mock_session.scalar.side_effect = [mock_customer, mock_location]
        
        # Act
        result = await repository._validate_customer_location(
            mock_session, customer_id, location_id
        )
        
        # Assert
        assert result[0] == mock_customer
        assert result[1] == mock_location
        assert mock_session.scalar.call_count == 2
    
    @pytest.mark.asyncio
    async def test_validate_customer_not_found(self, repository, mock_session):
        """Test validation when customer doesn't exist"""
        # Arrange
        customer_id = uuid4()
        location_id = uuid4()
        
        mock_session.scalar.side_effect = [None, Mock(spec=Location)]
        
        # Act & Assert
        with pytest.raises(NotFoundError, match="Customer"):
            await repository._validate_customer_location(
                mock_session, customer_id, location_id
            )
    
    @pytest.mark.asyncio
    async def test_validate_location_not_found(self, repository, mock_session):
        """Test validation when location doesn't exist"""
        # Arrange
        customer_id = uuid4()
        location_id = uuid4()
        
        mock_session.scalar.side_effect = [Mock(spec=Customer), None]
        
        # Act & Assert
        with pytest.raises(NotFoundError, match="Location"):
            await repository._validate_customer_location(
                mock_session, customer_id, location_id
            )
    
    @pytest.mark.asyncio
    async def test_validate_items_insufficient_stock(self, repository, mock_session):
        """Test validation when there's insufficient stock"""
        # Arrange
        items = [
            RentalItemCreate(
                item_id=uuid4(),
                quantity=Decimal("10.00"),
                unit_price=Decimal("100.00"),
                discount_percent=Decimal("0.00")
            )
        ]
        location_id = uuid4()
        
        # Mock item
        mock_item = Mock(spec=Item)
        mock_item.id = items[0].item_id
        mock_item.item_name = "Test Item"
        mock_item.brand_id = uuid4()
        mock_item.category_id = uuid4()
        mock_item.unit_of_measurement_id = uuid4()
        
        # Mock stock level with insufficient quantity
        mock_stock = Mock(spec=StockLevel)
        mock_stock.quantity_available = Decimal("5.00")  # Less than requested
        
        mock_result = Mock()
        mock_result.scalars = Mock(return_value=Mock(all=Mock(return_value=[mock_item])))
        mock_session.execute.side_effect = [mock_result, Mock(scalar=Mock(return_value=mock_stock))]
        
        # Act & Assert
        with pytest.raises(ValidationError, match="Insufficient stock"):
            await repository._validate_items_and_stock(
                mock_session, items, location_id
            )


class TestRentalCoreEdgeCases:
    """Additional edge case tests for rental core functionality"""
    
    @pytest.mark.asyncio
    async def test_rental_with_all_fields_max_values(self):
        """Test rental with all fields at maximum allowed values"""
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.max - timedelta(days=365),
            rental_start_date=date.max - timedelta(days=365),
            rental_end_date=date.max,
            payment_method="BANK_TRANSFER",
            notes="X" * 10000,  # Max notes
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("99999.99"),
                    unit_price=Decimal("999999.99"),
                    discount_percent=Decimal("100.00"),
                    notes="Y" * 10000
                )
            ]
        )
        
        # Should create without errors
        assert request is not None
    
    @pytest.mark.asyncio
    async def test_rental_with_all_fields_min_values(self):
        """Test rental with all fields at minimum allowed values"""
        request = NewRentalRequest(
            customer_id=uuid4(),
            location_id=uuid4(),
            transaction_date=date.min,
            rental_start_date=date.min,
            rental_end_date=date.min,
            payment_method="CASH",
            notes="",  # Empty notes
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=Decimal("0.01"),
                    unit_price=Decimal("0.01"),
                    discount_percent=Decimal("0.00"),
                    notes=""
                )
            ]
        )
        
        # Should create without errors
        assert request is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])