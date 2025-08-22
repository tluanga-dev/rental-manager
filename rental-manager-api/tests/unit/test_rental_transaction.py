"""
Unit tests for rental transaction service.
Tests rental lifecycle, returns, extensions, and damage assessment.
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, date
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.transaction.rental_service import RentalService, RentalPricingStrategy
from app.schemas.transaction.rental import (
    RentalCreate,
    RentalItemCreate,
    RentalPickupRequest,
    RentalReturnRequest,
    RentalExtensionRequest,
    RentalDamageAssessment,
    RentalAvailabilityCheck,
)
from app.models.transaction.enums import (
    RentalStatus,
    PaymentStatus,
    RentalPricingType,
    DamageType,
    DamageSeverity,
)


@pytest.fixture
def rental_service():
    """Create rental service instance with mocked dependencies."""
    mock_db = AsyncMock()
    mock_crud = MagicMock()
    mock_event_service = AsyncMock()
    mock_cache = AsyncMock()
    
    service = RentalService(mock_db)
    service.crud = mock_crud
    service.event_service = mock_event_service
    service.cache = mock_cache
    service.pricing_strategy = RentalPricingStrategy()
    
    return service


@pytest.fixture
def sample_rental_data():
    """Sample rental transaction data for testing."""
    start_date = datetime.now() + timedelta(days=1)
    end_date = start_date + timedelta(days=7)
    
    return RentalCreate(
        customer_id=uuid4(),
        location_id=uuid4(),
        reference_number="RNT-2024-001",
        rental_start_date=start_date,
        rental_end_date=end_date,
        pickup_location_id=uuid4(),
        return_location_id=uuid4(),
        items=[
            RentalItemCreate(
                item_id=uuid4(),
                quantity=2,
                daily_rate=Decimal("50.00"),
                weekly_rate=Decimal("300.00"),
                monthly_rate=Decimal("1000.00"),
                deposit_amount=Decimal("100.00"),
                insurance_amount=Decimal("25.00"),
            ),
            RentalItemCreate(
                item_id=uuid4(),
                quantity=1,
                daily_rate=Decimal("100.00"),
                weekly_rate=Decimal("600.00"),
                deposit_amount=Decimal("200.00"),
            ),
        ],
        delivery_required=True,
        delivery_address="123 Main St, City, State 12345",
        delivery_fee=Decimal("50.00"),
        insurance_required=True,
        insurance_provider="SafeRent Insurance",
        insurance_policy_number="POL-123456",
        notes="Handle with care - fragile equipment",
    )


@pytest.fixture
def mock_customer():
    """Mock customer data."""
    customer = MagicMock()
    customer.id = uuid4()
    customer.name = "Test Customer"
    customer.phone = "+1234567890"
    customer.email = "customer@test.com"
    customer.is_active = True
    customer.rental_deposit_required = True
    return customer


@pytest.fixture
def mock_items():
    """Mock item data."""
    items = []
    for i in range(2):
        item = MagicMock()
        item.id = uuid4()
        item.name = f"Rental Item {i+1}"
        item.sku = f"RENT-{i+1:03d}"
        item.quantity_available = 10
        item.daily_rate = Decimal("50.00") if i == 0 else Decimal("100.00")
        item.is_rentable = True
        item.requires_deposit = True
        items.append(item)
    return items


class TestRentalService:
    """Test suite for rental service."""
    
    @pytest.mark.asyncio
    async def test_create_rental_success(
        self, rental_service, sample_rental_data, mock_customer, mock_items
    ):
        """Test successful rental creation."""
        # Setup mocks
        rental_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        rental_service.crud.item.get_multi = AsyncMock(return_value=mock_items)
        rental_service.check_availability = AsyncMock(return_value=True)
        
        mock_rental = MagicMock()
        mock_rental.id = uuid4()
        mock_rental.transaction_number = "RNT-2024-001"
        mock_rental.total_amount = Decimal("950.00")
        mock_rental.deposit_amount = Decimal("300.00")
        rental_service.crud.rental.create = AsyncMock(return_value=mock_rental)
        
        # Execute
        result = await rental_service.create_rental(
            sample_rental_data, user_id=uuid4()
        )
        
        # Assert
        assert result.id == mock_rental.id
        assert result.transaction_number == "RNT-2024-001"
        rental_service.check_availability.assert_called()
        rental_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_create_rental_unavailable_items(
        self, rental_service, sample_rental_data, mock_customer, mock_items
    ):
        """Test rental creation with unavailable items."""
        # Setup mocks
        rental_service.crud.customer.get = AsyncMock(return_value=mock_customer)
        rental_service.crud.item.get_multi = AsyncMock(return_value=mock_items)
        rental_service.check_availability = AsyncMock(
            return_value={"available": False, "conflicts": ["Booking conflict"]}
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Items not available"):
            await rental_service.create_rental(
                sample_rental_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_process_pickup_success(self, rental_service):
        """Test successful rental pickup processing."""
        rental_id = uuid4()
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.RESERVED
        mock_rental.deposit_amount = Decimal("300.00")
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        rental_service.crud.rental.update = AsyncMock(return_value=mock_rental)
        
        pickup_data = RentalPickupRequest(
            pickup_person_name="John Doe",
            pickup_person_id_type="Driver License",
            pickup_person_id_number="DL123456",
            pickup_notes="All items in good condition",
            items_condition_confirmed=True,
            deposit_collected=True,
            payment_collected=True,
        )
        
        # Execute
        result = await rental_service.process_pickup(
            rental_id, pickup_data, user_id=uuid4()
        )
        
        # Assert
        assert result.status == RentalStatus.ACTIVE
        assert result.pickup_confirmed is True
        rental_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_pickup_invalid_status(self, rental_service):
        """Test pickup processing with invalid rental status."""
        rental_id = uuid4()
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.COMPLETED
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        
        pickup_data = RentalPickupRequest(
            pickup_person_name="John Doe",
            pickup_person_id_type="Driver License",
            pickup_person_id_number="DL123456",
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Cannot process pickup"):
            await rental_service.process_pickup(
                rental_id, pickup_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_process_return_with_damages(self, rental_service):
        """Test rental return with damage assessment."""
        rental_id = uuid4()
        item_id = uuid4()
        
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.ACTIVE
        mock_rental.rental_end_date = datetime.now() - timedelta(days=1)
        mock_rental.deposit_amount = Decimal("300.00")
        mock_rental.items = [
            MagicMock(
                item_id=item_id,
                quantity=1,
                daily_rate=Decimal("50.00"),
            )
        ]
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        rental_service.crud.rental.update = AsyncMock(return_value=mock_rental)
        rental_service._calculate_late_fees = AsyncMock(
            return_value=Decimal("50.00")
        )
        
        return_data = RentalReturnRequest(
            return_person_name="Jane Smith",
            damages=[
                RentalDamageAssessment(
                    item_id=item_id,
                    damage_type=DamageType.PHYSICAL,
                    damage_severity=DamageSeverity.MODERATE,
                    damage_description="Scratch on surface",
                    repair_cost_estimate=Decimal("75.00"),
                )
            ],
            late_return=True,
            late_return_reason="Traffic delay",
            items_returned=[item_id],
        )
        
        # Execute
        result = await rental_service.process_return(
            rental_id, return_data, user_id=uuid4()
        )
        
        # Assert
        assert result.late_fees == Decimal("50.00")
        assert result.damage_charges == Decimal("75.00")
        assert result.deposit_refund == Decimal("175.00")  # 300 - 50 - 75
        rental_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_process_return_no_damages(self, rental_service):
        """Test rental return without damages."""
        rental_id = uuid4()
        item_id = uuid4()
        
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.ACTIVE
        mock_rental.rental_end_date = datetime.now() + timedelta(days=1)
        mock_rental.deposit_amount = Decimal("300.00")
        mock_rental.items = [
            MagicMock(item_id=item_id, quantity=1)
        ]
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        rental_service.crud.rental.update = AsyncMock(return_value=mock_rental)
        
        return_data = RentalReturnRequest(
            return_person_name="Jane Smith",
            late_return=False,
            items_returned=[item_id],
        )
        
        # Execute
        result = await rental_service.process_return(
            rental_id, return_data, user_id=uuid4()
        )
        
        # Assert
        assert result.late_fees == Decimal("0.00")
        assert result.damage_charges == Decimal("0.00")
        assert result.deposit_refund == Decimal("300.00")
    
    @pytest.mark.asyncio
    async def test_extend_rental_success(self, rental_service):
        """Test successful rental extension."""
        rental_id = uuid4()
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.ACTIVE
        mock_rental.rental_end_date = datetime.now() + timedelta(days=2)
        mock_rental.daily_rate = Decimal("100.00")
        mock_rental.total_amount = Decimal("700.00")
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        rental_service.crud.rental.update = AsyncMock(return_value=mock_rental)
        rental_service.check_availability = AsyncMock(return_value=True)
        
        extension_data = RentalExtensionRequest(
            new_end_date=datetime.now() + timedelta(days=7),
            reason="Need equipment for longer",
            maintain_current_rate=True,
        )
        
        # Execute
        result = await rental_service.extend_rental(
            rental_id, extension_data, user_id=uuid4()
        )
        
        # Assert
        assert result.extension_days == 5
        assert result.additional_charge == Decimal("500.00")
        assert result.new_total == Decimal("1200.00")
        rental_service.check_availability.assert_called()
        rental_service.event_service.publish.assert_called()
    
    @pytest.mark.asyncio
    async def test_extend_rental_unavailable(self, rental_service):
        """Test rental extension with availability conflict."""
        rental_id = uuid4()
        mock_rental = MagicMock()
        mock_rental.id = rental_id
        mock_rental.status = RentalStatus.ACTIVE
        
        rental_service.crud.rental.get = AsyncMock(return_value=mock_rental)
        rental_service.check_availability = AsyncMock(
            return_value={"available": False, "conflicts": ["Another booking"]}
        )
        
        extension_data = RentalExtensionRequest(
            new_end_date=datetime.now() + timedelta(days=7),
        )
        
        # Execute and assert
        with pytest.raises(ValueError, match="Cannot extend"):
            await rental_service.extend_rental(
                rental_id, extension_data, user_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_check_availability_available(self, rental_service):
        """Test availability check for available items."""
        mock_conflicts = []
        rental_service.crud.rental.get_overlapping = AsyncMock(
            return_value=mock_conflicts
        )
        
        mock_item = MagicMock()
        mock_item.id = uuid4()
        mock_item.name = "Test Item"
        mock_item.quantity_available = 5
        rental_service.crud.item.get = AsyncMock(return_value=mock_item)
        
        check_data = RentalAvailabilityCheck(
            item_id=mock_item.id,
            location_id=uuid4(),
            start_date=datetime.now() + timedelta(days=1),
            end_date=datetime.now() + timedelta(days=7),
            quantity_needed=2,
        )
        
        # Execute
        result = await rental_service.check_availability(
            check_data.item_id,
            check_data.start_date,
            check_data.end_date,
            check_data.quantity_needed,
        )
        
        # Assert
        assert result.is_available is True
        assert result.available_quantity == 5
        assert result.conflicts is None
    
    @pytest.mark.asyncio
    async def test_check_availability_conflict(self, rental_service):
        """Test availability check with conflicts."""
        mock_conflict = MagicMock()
        mock_conflict.quantity = 4
        mock_conflicts = [mock_conflict]
        
        rental_service.crud.rental.get_overlapping = AsyncMock(
            return_value=mock_conflicts
        )
        
        mock_item = MagicMock()
        mock_item.id = uuid4()
        mock_item.quantity_available = 5
        rental_service.crud.item.get = AsyncMock(return_value=mock_item)
        
        check_data = RentalAvailabilityCheck(
            item_id=mock_item.id,
            location_id=uuid4(),
            start_date=datetime.now() + timedelta(days=1),
            end_date=datetime.now() + timedelta(days=7),
            quantity_needed=2,
        )
        
        # Execute
        result = await rental_service.check_availability(
            check_data.item_id,
            check_data.start_date,
            check_data.end_date,
            check_data.quantity_needed,
        )
        
        # Assert
        assert result.is_available is False
        assert result.available_quantity == 1  # 5 - 4
        assert len(result.conflicts) == 1
    
    @pytest.mark.asyncio
    async def test_calculate_late_fees(self, rental_service):
        """Test late fee calculation."""
        rental = MagicMock()
        rental.rental_end_date = datetime.now() - timedelta(days=3)
        rental.daily_rate = Decimal("100.00")
        rental.late_fee_rate = Decimal("1.5")  # 150% of daily rate
        
        return_date = datetime.now()
        
        # Execute
        late_fees = rental_service._calculate_late_fees(rental, return_date)
        
        # Assert
        assert late_fees == Decimal("450.00")  # 3 days * 100 * 1.5
    
    @pytest.mark.asyncio
    async def test_pricing_strategy_daily(self, rental_service):
        """Test daily pricing calculation."""
        strategy = rental_service.pricing_strategy
        
        # Execute
        price = strategy.calculate_price(
            daily_rate=Decimal("100.00"),
            weekly_rate=Decimal("600.00"),
            monthly_rate=Decimal("2000.00"),
            rental_days=5,
        )
        
        # Assert
        assert price["applied_rate"] == Decimal("100.00")
        assert price["pricing_type"] == RentalPricingType.DAILY
        assert price["total"] == Decimal("500.00")
    
    @pytest.mark.asyncio
    async def test_pricing_strategy_weekly(self, rental_service):
        """Test weekly pricing calculation."""
        strategy = rental_service.pricing_strategy
        
        # Execute
        price = strategy.calculate_price(
            daily_rate=Decimal("100.00"),
            weekly_rate=Decimal("600.00"),
            monthly_rate=Decimal("2000.00"),
            rental_days=7,
        )
        
        # Assert
        assert price["applied_rate"] == Decimal("85.71")  # 600/7 rounded
        assert price["pricing_type"] == RentalPricingType.WEEKLY
        assert price["total"] == Decimal("600.00")
    
    @pytest.mark.asyncio
    async def test_pricing_strategy_monthly(self, rental_service):
        """Test monthly pricing calculation."""
        strategy = rental_service.pricing_strategy
        
        # Execute
        price = strategy.calculate_price(
            daily_rate=Decimal("100.00"),
            weekly_rate=Decimal("600.00"),
            monthly_rate=Decimal("2000.00"),
            rental_days=30,
        )
        
        # Assert
        assert price["applied_rate"] == Decimal("66.67")  # 2000/30 rounded
        assert price["pricing_type"] == RentalPricingType.MONTHLY
        assert price["total"] == Decimal("2000.00")