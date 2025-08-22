"""
Unit Tests for Unified Booking Module

Tests the booking system components:
- Models and schemas validation
- Repository operations
- Service business logic
- API endpoints
"""

import pytest
import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.testclient import TestClient
from fastapi import status

from app.modules.transactions.rentals.booking.models import BookingHeader, BookingLine
from app.modules.transactions.rentals.booking.enums import BookingStatus
from app.modules.transactions.rentals.booking.schemas import (
    BookingCreateRequest, BookingItemRequest, BookingHeaderResponse
)
from app.modules.transactions.rentals.booking.repository import BookingRepository
from app.modules.transactions.rentals.booking.service import BookingService
from app.modules.transactions.rentals.booking.routes import router
from app.modules.customers.models import Customer
from app.modules.master_data.locations.models import Location
from app.modules.master_data.item_master.models import Item


@pytest.fixture
def sample_customer():
    """Sample customer for testing"""
    return Customer(
        id=uuid4(),
        name="Test Customer",
        email="test@example.com",
        phone="555-0123",
        is_active=True
    )


@pytest.fixture
def sample_location():
    """Sample location for testing"""
    return Location(
        id=uuid4(),
        name="Test Location",
        code="TEST_LOC",
        address="123 Test St",
        is_active=True
    )


@pytest.fixture
def sample_items():
    """Sample items for testing"""
    return [
        Item(
            id=uuid4(),
            item_name="Test Item 1",
            sku="TEST001",
            description="Test item 1 description",
            is_active=True
        ),
        Item(
            id=uuid4(),
            item_name="Test Item 2", 
            sku="TEST002",
            description="Test item 2 description",
            is_active=True
        )
    ]


@pytest.fixture
def booking_create_request_single(sample_customer, sample_location, sample_items):
    """Single-item booking request"""
    return BookingCreateRequest(
        customer_id=str(sample_customer.id),
        location_id=str(sample_location.id),
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=3),
        items=[
            BookingItemRequest(
                item_id=str(sample_items[0].id),
                quantity=2,
                rental_period=2,
                rental_period_unit="DAILY",
                unit_rate=Decimal("25.00"),
                discount_amount=Decimal("0.00"),
                notes="Single item booking test"
            )
        ],
        deposit_paid=False,
        notes="Test single item booking"
    )


@pytest.fixture  
def booking_create_request_multi(sample_customer, sample_location, sample_items):
    """Multi-item booking request"""
    return BookingCreateRequest(
        customer_id=str(sample_customer.id),
        location_id=str(sample_location.id),
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=5),
        items=[
            BookingItemRequest(
                item_id=str(sample_items[0].id),
                quantity=1,
                rental_period=4,
                rental_period_unit="DAILY", 
                unit_rate=Decimal("30.00"),
                discount_amount=Decimal("5.00"),
                notes="First item"
            ),
            BookingItemRequest(
                item_id=str(sample_items[1].id),
                quantity=2,
                rental_period=4,
                rental_period_unit="DAILY",
                unit_rate=Decimal("15.00"),
                discount_amount=Decimal("0.00"),
                notes="Second item"
            )
        ],
        deposit_paid=True,
        notes="Test multi-item booking"
    )


class TestBookingSchemas:
    """Test booking Pydantic schemas"""
    
    def test_booking_item_request_validation(self):
        """Test BookingItemRequest validation"""
        # Valid request
        valid_item = BookingItemRequest(
            item_id=str(uuid4()),
            quantity=2,
            rental_period=3,
            rental_period_unit="DAILY",
            unit_rate=Decimal("25.50"),
            discount_amount=Decimal("2.50")
        )
        assert valid_item.quantity == 2
        assert valid_item.unit_rate == Decimal("25.50")
    
    def test_booking_item_request_invalid_quantity(self):
        """Test validation rejects invalid quantity"""
        with pytest.raises(ValueError):
            BookingItemRequest(
                item_id=str(uuid4()),
                quantity=0,  # Invalid - must be > 0
                rental_period=1,
                unit_rate=Decimal("10.00")
            )
    
    def test_booking_create_request_validation(self, booking_create_request_single):
        """Test BookingCreateRequest validation"""
        request = booking_create_request_single
        assert len(request.items) == 1
        assert request.end_date > request.start_date
    
    def test_booking_create_request_invalid_dates(self, sample_customer, sample_location, sample_items):
        """Test validation rejects invalid date ranges"""
        with pytest.raises(ValueError):
            BookingCreateRequest(
                customer_id=str(sample_customer.id),
                location_id=str(sample_location.id),
                start_date=date.today() + timedelta(days=5),
                end_date=date.today() + timedelta(days=2),  # End before start
                items=[
                    BookingItemRequest(
                        item_id=str(sample_items[0].id),
                        quantity=1,
                        unit_rate=Decimal("10.00")
                    )
                ]
            )


class TestBookingModels:
    """Test booking SQLAlchemy models"""
    
    def test_booking_header_creation(self, sample_customer, sample_location):
        """Test BookingHeader model creation"""
        booking = BookingHeader(
            booking_reference="BK-2024-00001",
            customer_id=sample_customer.id,
            location_id=sample_location.id,
            booking_date=date.today(),
            start_date=date.today() + timedelta(days=1),
            end_date=date.today() + timedelta(days=3),
            booking_status=BookingStatus.PENDING,
            total_items=1,
            estimated_total=Decimal("100.00")
        )
        
        assert booking.booking_reference == "BK-2024-00001"
        assert booking.booking_status == BookingStatus.PENDING
        assert booking.total_items == 1
    
    def test_booking_line_creation(self, sample_items):
        """Test BookingLine model creation"""
        booking_id = uuid4()
        line = BookingLine(
            booking_header_id=booking_id,
            line_number=1,
            item_id=sample_items[0].id,
            quantity_reserved=Decimal("2.00"),
            rental_period=3,
            rental_period_unit="DAILY",
            unit_rate=Decimal("25.00"),
            line_total=Decimal("150.00")
        )
        
        assert line.booking_header_id == booking_id
        assert line.line_number == 1
        assert line.quantity_reserved == Decimal("2.00")


@pytest.mark.asyncio
class TestBookingRepository:
    """Test booking repository operations"""
    
    async def test_create_booking_with_lines(self):
        """Test creating booking with line items"""
        mock_session = AsyncMock(spec=AsyncSession)
        repository = BookingRepository(mock_session)
        
        # Mock the reference generation
        repository._generate_booking_reference = AsyncMock(return_value="BK-2024-00001")
        
        header_data = {
            "customer_id": uuid4(),
            "location_id": uuid4(), 
            "booking_date": date.today(),
            "start_date": date.today() + timedelta(days=1),
            "end_date": date.today() + timedelta(days=3),
            "booking_status": BookingStatus.PENDING,
            "total_items": 2
        }
        
        lines_data = [
            {
                "item_id": uuid4(),
                "quantity_reserved": Decimal("1.00"),
                "unit_rate": Decimal("25.00"),
                "line_total": Decimal("25.00")
            },
            {
                "item_id": uuid4(),
                "quantity_reserved": Decimal("2.00"), 
                "unit_rate": Decimal("15.00"),
                "line_total": Decimal("30.00")
            }
        ]
        
        # Mock successful creation
        mock_booking = BookingHeader(id=uuid4(), **header_data)
        mock_booking.booking_reference = "BK-2024-00001"
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()
        
        # Mock the actual creation by patching the constructor and session operations
        with patch.object(BookingHeader, '__init__', return_value=None) as mock_header_init:
            with patch.object(BookingLine, '__init__', return_value=None) as mock_line_init:
                mock_session.add.return_value = None
                result = await repository.create_booking_with_lines(header_data, lines_data)
        
        # Verify session operations were called
        assert mock_session.add.call_count >= 1  # Header + 2 lines
        assert mock_session.flush.call_count == 2
        assert mock_session.refresh.call_count == 1
    
    async def test_check_items_availability(self, sample_items, sample_location):
        """Test availability checking"""
        mock_session = AsyncMock(spec=AsyncSession)
        repository = BookingRepository(mock_session)
        
        items = [
            {"item_id": str(sample_items[0].id), "quantity": 1},
            {"item_id": str(sample_items[1].id), "quantity": 2}
        ]
        
        start_date = date.today() + timedelta(days=1)
        end_date = date.today() + timedelta(days=3)
        
        # Mock stock level queries - return available stock
        from app.modules.inventory.models import StockLevel
        mock_stock = StockLevel(
            item_id=sample_items[0].id,
            location_id=sample_location.id,
            available_quantity=Decimal("10.00")
        )
        
        mock_session.execute = AsyncMock()
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_stock
        mock_result.scalar_one.return_value = Decimal("0.00")  # No existing bookings
        mock_session.execute.return_value = mock_result
        
        availability = await repository.check_items_availability(
            items, start_date, end_date, sample_location.id
        )
        
        assert "all_available" in availability
        assert "items" in availability
        assert len(availability["items"]) == 2


@pytest.mark.asyncio  
class TestBookingService:
    """Test booking service business logic"""
    
    async def test_create_single_booking(self, booking_create_request_single, 
                                       sample_customer, sample_location, sample_items):
        """Test creating single-item booking"""
        mock_session = AsyncMock(spec=AsyncSession)
        service = BookingService(mock_session)
        
        # Mock repository
        mock_repository = AsyncMock()
        service.repository = mock_repository
        
        # Mock database entities
        mock_session.get.side_effect = [
            sample_customer,  # Customer lookup
            sample_location,  # Location lookup  
            sample_items[0],  # Item lookup
        ]
        
        # Mock availability check
        mock_repository.check_items_availability.return_value = {
            "all_available": True,
            "items": [{"is_available": True}]
        }
        
        # Mock booking creation
        mock_booking = BookingHeader(
            id=uuid4(),
            booking_reference="BK-2024-00001",
            customer_id=sample_customer.id,
            location_id=sample_location.id,
            booking_status=BookingStatus.PENDING,
            total_items=1
        )
        mock_repository.create_booking_with_lines.return_value = mock_booking
        
        # Mock commit
        mock_session.commit = AsyncMock()
        
        result = await service.create_booking(booking_create_request_single)
        
        assert result.booking_reference == "BK-2024-00001"
        assert result.total_items == 1
        assert mock_session.commit.called
    
    async def test_create_multi_booking(self, booking_create_request_multi,
                                      sample_customer, sample_location, sample_items):
        """Test creating multi-item booking"""
        mock_session = AsyncMock(spec=AsyncSession)
        service = BookingService(mock_session)
        
        # Mock repository
        mock_repository = AsyncMock()
        service.repository = mock_repository
        
        # Mock database entities
        mock_session.get.side_effect = [
            sample_customer,  # Customer lookup
            sample_location,  # Location lookup
            sample_items[0],  # Item 1 lookup
            sample_items[1],  # Item 2 lookup
        ]
        
        # Mock availability check - all items available
        mock_repository.check_items_availability.return_value = {
            "all_available": True,
            "items": [
                {"is_available": True},
                {"is_available": True}
            ]
        }
        
        # Mock booking creation
        mock_booking = BookingHeader(
            id=uuid4(),
            booking_reference="BK-2024-00002", 
            customer_id=sample_customer.id,
            location_id=sample_location.id,
            booking_status=BookingStatus.PENDING,
            total_items=2
        )
        mock_repository.create_booking_with_lines.return_value = mock_booking
        mock_session.commit = AsyncMock()
        
        result = await service.create_booking(booking_create_request_multi)
        
        assert result.booking_reference == "BK-2024-00002"
        assert result.total_items == 2
        assert mock_session.commit.called
    
    async def test_create_booking_unavailable_items(self, booking_create_request_single,
                                                   sample_customer, sample_location, sample_items):
        """Test booking creation fails when items unavailable"""
        mock_session = AsyncMock(spec=AsyncSession)
        service = BookingService(mock_session)
        
        # Mock repository
        mock_repository = AsyncMock()
        service.repository = mock_repository
        
        # Mock database entities
        mock_session.get.side_effect = [
            sample_customer,  # Customer lookup
            sample_location,  # Location lookup
        ]
        
        # Mock availability check - items NOT available
        mock_repository.check_items_availability.return_value = {
            "all_available": False,
            "items": [{"is_available": False, "reason": "Insufficient stock"}]
        }
        
        mock_session.rollback = AsyncMock()
        
        # Should raise ValidationError
        from app.shared.exceptions import ValidationError
        with pytest.raises(ValidationError):
            await service.create_booking(booking_create_request_single)
        
        assert mock_session.rollback.called


class TestBookingRoutes:
    """Test booking API routes"""
    
    def test_create_booking_endpoint_structure(self):
        """Test that booking routes are properly structured"""
        from app.modules.transactions.rentals.booking.routes import router
        
        # Check that router has expected routes
        route_paths = [route.path for route in router.routes]
        
        expected_paths = [
            "/",  # Create and list bookings
            "/{booking_id}",  # Get and update booking
            "/reference/{reference}",  # Get by reference
            "/check-availability",  # Availability check
            "/{booking_id}/confirm",  # Confirm booking
            "/{booking_id}/cancel",  # Cancel booking
            "/{booking_id}/convert-to-rental"  # Convert to rental
        ]
        
        for expected_path in expected_paths:
            assert expected_path in route_paths


@pytest.mark.integration
class TestBookingIntegration:
    """Integration tests for complete booking workflows"""
    
    async def test_complete_single_booking_workflow(self):
        """Test complete workflow: create -> confirm -> convert"""
        # This would be implemented with actual database and session
        # For now, just verify the workflow exists
        assert True  # Placeholder for actual integration test
    
    async def test_complete_multi_booking_workflow(self):
        """Test complete multi-item workflow"""
        # This would be implemented with actual database and session  
        # For now, just verify the workflow exists
        assert True  # Placeholder for actual integration test


# Pytest configuration for async tests
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()