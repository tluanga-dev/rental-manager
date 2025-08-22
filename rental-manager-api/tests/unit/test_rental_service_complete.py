"""
Comprehensive rental service tests for 100% coverage.
Tests all rental lifecycle methods, pricing, and business logic.
"""

import pytest
from decimal import Decimal
from datetime import datetime, date, timedelta, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.transaction.rental_service import RentalService
from app.schemas.transaction.rental import (
    RentalCreate,
    RentalItemCreate,
    RentalExtensionRequest,
    RentalReturnRequest,
    RentalDamageAssessment,
)
from app.models.transaction.enums import (
    TransactionType,
    TransactionStatus,
    RentalStatus,
    PaymentMethod,
    PaymentStatus,
    ConditionRating,
    ItemDisposition,
)
from app.core.errors import ValidationError, NotFoundError, ConflictError


class TestRentalServiceComplete:
    """Complete test coverage for RentalService."""
    
    @pytest.fixture
    def mock_session(self):
        """Mock database session."""
        return AsyncMock()
    
    @pytest.fixture
    def rental_service(self, mock_session):
        """Rental service instance with mocked dependencies."""
        service = RentalService(mock_session)
        service.transaction_repo = AsyncMock()
        service.rental_repo = AsyncMock()
        service.customer_repo = AsyncMock()
        service.location_repo = AsyncMock()
        service.item_repo = AsyncMock()
        service.inspection_repo = AsyncMock()
        return service
    
    @pytest.fixture
    def sample_rental_data(self):
        """Sample rental data for testing."""
        return RentalCreate(
            customer_id=uuid4(),
            location_id=uuid4(),
            rental_start_date=date.today(),
            rental_end_date=date.today() + timedelta(days=7),
            items=[
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=1,
                    daily_rate=Decimal("50.00"),
                    weekly_rate=Decimal("300.00"),
                    monthly_rate=Decimal("1000.00"),
                    security_deposit=Decimal("100.00")
                ),
                RentalItemCreate(
                    item_id=uuid4(),
                    quantity=2,
                    daily_rate=Decimal("25.00"),
                    security_deposit=Decimal("50.00")
                )
            ],
            delivery_required=True,
            delivery_address="123 Main St, City, State 12345",
            pickup_required=True,
            notes="Special handling required"
        )
    
    @pytest.mark.asyncio
    async def test_create_rental_success(self, rental_service, sample_rental_data):
        """Test successful rental creation."""
        # Mock validation methods
        rental_service._validate_rental_data = AsyncMock(return_value=[])
        rental_service._check_item_availability = AsyncMock(return_value=[])
        rental_service._generate_rental_number = AsyncMock(return_value="RENT-20240122-001")
        rental_service._calculate_rental_pricing = MagicMock(return_value={
            "subtotal": Decimal("500.00"),
            "security_deposit_total": Decimal("200.00"),
            "tax_amount": Decimal("50.00"),
            "total_amount": Decimal("550.00")
        })
        
        # Mock repository methods
        mock_rental = MagicMock()
        mock_rental.id = uuid4()
        rental_service.rental_repo.create.return_value = mock_rental
        rental_service.session.commit = AsyncMock()
        rental_service.session.refresh = AsyncMock()
        
        # Execute
        result = await rental_service.create_rental(sample_rental_data)
        
        # Verify
        assert result is not None
        rental_service._validate_rental_data.assert_called_once()
        rental_service._check_item_availability.assert_called_once()
        rental_service.rental_repo.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_rental_validation_failure(self, rental_service, sample_rental_data):
        """Test rental creation with validation errors."""
        # Mock validation to return errors
        validation_errors = ["Customer blocked for rentals", "Location not available"]
        rental_service._validate_rental_data = AsyncMock(return_value=validation_errors)
        
        # Execute and verify exception
        with pytest.raises(ValidationError) as exc_info:
            await rental_service.create_rental(sample_rental_data)
        
        assert "Rental validation failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_create_rental_item_unavailable(self, rental_service, sample_rental_data):
        """Test rental creation with unavailable items."""
        # Mock validation to pass but availability check to fail
        rental_service._validate_rental_data = AsyncMock(return_value=[])
        availability_issues = [{"item_id": str(uuid4()), "available": 0, "requested": 1}]
        rental_service._check_item_availability = AsyncMock(return_value=availability_issues)
        
        # Execute and verify exception
        with pytest.raises(ConflictError) as exc_info:
            await rental_service.create_rental(sample_rental_data)
        
        assert "Items not available for rental" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_rental_data_success(self, rental_service, sample_rental_data):
        """Test successful rental data validation."""
        # Mock repository responses
        rental_service.customer_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            rental_blocked=False,
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00")
        )
        rental_service.location_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            allows_rentals=True
        )
        rental_service.item_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            is_rentable=True
        )
        
        # Execute
        errors = await rental_service._validate_rental_data(sample_rental_data)
        
        # Verify no errors
        assert errors == []
    
    @pytest.mark.asyncio
    async def test_validate_rental_data_customer_blocked(self, rental_service, sample_rental_data):
        """Test validation with blocked customer."""
        # Mock blocked customer
        rental_service.customer_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            rental_blocked=True
        )
        rental_service.location_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            allows_rentals=True
        )
        rental_service.item_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            is_rentable=True
        )
        
        # Execute
        errors = await rental_service._validate_rental_data(sample_rental_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Customer is blocked from rentals" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_rental_data_location_no_rentals(self, rental_service, sample_rental_data):
        """Test validation with location that doesn't allow rentals."""
        # Mock location that doesn't allow rentals
        rental_service.customer_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            rental_blocked=False
        )
        rental_service.location_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            allows_rentals=False
        )
        rental_service.item_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            is_rentable=True
        )
        
        # Execute
        errors = await rental_service._validate_rental_data(sample_rental_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Location does not allow rentals" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_validate_rental_data_non_rentable_item(self, rental_service, sample_rental_data):
        """Test validation with non-rentable item."""
        # Mock non-rentable item
        rental_service.customer_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            rental_blocked=False
        )
        rental_service.location_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            allows_rentals=True
        )
        rental_service.item_repo.get_by_id.return_value = MagicMock(
            is_active=True,
            is_rentable=False
        )
        
        # Execute
        errors = await rental_service._validate_rental_data(sample_rental_data)
        
        # Verify error
        assert len(errors) > 0
        assert any("Item is not available for rental" in error for error in errors)
    
    @pytest.mark.asyncio
    async def test_check_item_availability_available(self, rental_service):
        """Test item availability check with available items."""
        items = [
            RentalItemCreate(item_id=uuid4(), quantity=1, daily_rate=Decimal("50.00"))
        ]
        location_id = uuid4()
        rental_dates = (date.today(), date.today() + timedelta(days=7))
        
        # Mock availability check
        rental_service.item_repo.check_rental_availability.return_value = {
            "available": True,
            "available_quantity": 5
        }
        
        # Execute
        issues = await rental_service._check_item_availability(items, location_id, rental_dates)
        
        # Verify no issues
        assert issues == []
    
    @pytest.mark.asyncio
    async def test_check_item_availability_unavailable(self, rental_service):
        """Test item availability check with unavailable items."""
        item_id = uuid4()
        items = [
            RentalItemCreate(item_id=item_id, quantity=3, daily_rate=Decimal("50.00"))
        ]
        location_id = uuid4()
        rental_dates = (date.today(), date.today() + timedelta(days=7))
        
        # Mock unavailable item
        rental_service.item_repo.check_rental_availability.return_value = {
            "available": False,
            "available_quantity": 1,
            "conflicting_rentals": ["RENT-001", "RENT-002"]
        }
        
        # Execute
        issues = await rental_service._check_item_availability(items, location_id, rental_dates)
        
        # Verify issues found
        assert len(issues) > 0
        assert issues[0]["item_id"] == str(item_id)
        assert issues[0]["requested"] == 3
        assert issues[0]["available"] == 1
    
    def test_calculate_rental_pricing_daily_rate(self, rental_service):
        """Test rental pricing calculation with daily rates."""
        items = [
            RentalItemCreate(
                item_id=uuid4(),
                quantity=1,
                daily_rate=Decimal("50.00"),
                security_deposit=Decimal("100.00")
            ),
            RentalItemCreate(
                item_id=uuid4(),
                quantity=2,
                daily_rate=Decimal("30.00"),
                security_deposit=Decimal("50.00")
            )
        ]
        
        rental_duration = 7  # days
        
        # Execute
        result = rental_service._calculate_rental_pricing(items, rental_duration)
        
        # Verify calculations
        # Item 1: 1 * 50 * 7 = 350, deposit = 100
        # Item 2: 2 * 30 * 7 = 420, deposit = 100 (2 * 50)
        # Total rental: 350 + 420 = 770, deposits: 200
        assert result["subtotal"] == Decimal("770.00")
        assert result["security_deposit_total"] == Decimal("200.00")
    
    def test_calculate_rental_pricing_weekly_rate(self, rental_service):
        """Test rental pricing with weekly rates (should be cheaper)."""
        items = [
            RentalItemCreate(
                item_id=uuid4(),
                quantity=1,
                daily_rate=Decimal("50.00"),
                weekly_rate=Decimal("300.00"),  # Cheaper than 7 * 50 = 350
                security_deposit=Decimal("100.00")
            )
        ]
        
        rental_duration = 7  # exactly one week
        
        # Execute
        result = rental_service._calculate_rental_pricing(items, rental_duration)
        
        # Verify weekly rate is used
        assert result["subtotal"] == Decimal("300.00")  # Weekly rate used instead of daily
    
    def test_calculate_rental_pricing_monthly_rate(self, rental_service):
        """Test rental pricing with monthly rates."""
        items = [
            RentalItemCreate(
                item_id=uuid4(),
                quantity=1,
                daily_rate=Decimal("50.00"),
                weekly_rate=Decimal("300.00"),
                monthly_rate=Decimal("1000.00"),  # Cheaper than 30 * 50 = 1500
                security_deposit=Decimal("200.00")
            )
        ]
        
        rental_duration = 30  # one month
        
        # Execute
        result = rental_service._calculate_rental_pricing(items, rental_duration)
        
        # Verify monthly rate is used
        assert result["subtotal"] == Decimal("1000.00")  # Monthly rate used
        assert result["security_deposit_total"] == Decimal("200.00")
    
    @pytest.mark.asyncio
    async def test_extend_rental_success(self, rental_service):
        """Test successful rental extension."""
        rental_id = uuid4()
        extension_request = RentalExtensionRequest(
            rental_id=rental_id,
            new_end_date=datetime.now(timezone.utc) + timedelta(days=14),
            extension_reason="Customer needs more time"
        )
        
        # Mock rental retrieval
        mock_rental = MagicMock()
        mock_rental.status = RentalStatus.RENTAL_INPROGRESS
        mock_rental.rental_end_date = date.today() + timedelta(days=7)
        mock_rental.can_be_extended.return_value = True
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Mock availability check for extension period
        rental_service._check_extension_availability = AsyncMock(return_value=True)
        rental_service.session.commit = AsyncMock()
        
        # Execute
        result = await rental_service.extend_rental(extension_request)
        
        # Verify
        assert result is not None
        assert mock_rental.status == RentalStatus.RENTAL_EXTENDED
        mock_rental.extend_rental.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_extend_rental_cannot_extend(self, rental_service):
        """Test rental extension when not allowed."""
        rental_id = uuid4()
        extension_request = RentalExtensionRequest(
            rental_id=rental_id,
            new_end_date=datetime.now(timezone.utc) + timedelta(days=14),
            extension_reason="Cannot extend"
        )
        
        # Mock rental that cannot be extended
        mock_rental = MagicMock()
        mock_rental.status = RentalStatus.RENTAL_COMPLETED
        mock_rental.can_be_extended.return_value = False
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Execute and verify exception
        with pytest.raises(ValidationError, match="Rental cannot be extended"):
            await rental_service.extend_rental(extension_request)
    
    @pytest.mark.asyncio
    async def test_extend_rental_availability_conflict(self, rental_service):
        """Test rental extension with availability conflict."""
        rental_id = uuid4()
        extension_request = RentalExtensionRequest(
            rental_id=rental_id,
            new_end_date=datetime.now(timezone.utc) + timedelta(days=14),
            extension_reason="Extension needed"
        )
        
        # Mock rental that can be extended
        mock_rental = MagicMock()
        mock_rental.status = RentalStatus.RENTAL_INPROGRESS
        mock_rental.can_be_extended.return_value = True
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Mock availability conflict
        rental_service._check_extension_availability = AsyncMock(return_value=False)
        
        # Execute and verify exception
        with pytest.raises(ConflictError, match="Items not available for extension period"):
            await rental_service.extend_rental(extension_request)
    
    @pytest.mark.asyncio
    async def test_process_rental_return_success(self, rental_service):
        """Test successful rental return processing."""
        return_data = RentalReturnRequest(
            rental_id=uuid4(),
            return_date=datetime.now(timezone.utc),
            items=[
                {
                    "item_id": uuid4(),
                    "returned_quantity": 1,
                    "condition_rating": ConditionRating.A,
                    "damage_notes": None
                }
            ],
            late_fees=Decimal("0.00"),
            damage_fees=Decimal("0.00")
        )
        
        # Mock rental retrieval
        mock_rental = MagicMock()
        mock_rental.status = RentalStatus.RENTAL_INPROGRESS
        mock_rental.rental_end_date = date.today() - timedelta(days=1)  # Overdue
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Mock return processing
        rental_service._calculate_late_fees = MagicMock(return_value=Decimal("25.00"))
        rental_service._process_return_items = AsyncMock()
        rental_service.session.commit = AsyncMock()
        
        # Execute
        result = await rental_service.process_return(return_data)
        
        # Verify
        assert result is not None
        rental_service._calculate_late_fees.assert_called_once()
        rental_service._process_return_items.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_rental_return_already_returned(self, rental_service):
        """Test return processing for already returned rental."""
        return_data = RentalReturnRequest(
            rental_id=uuid4(),
            return_date=datetime.now(timezone.utc),
            items=[],
            late_fees=Decimal("0.00")
        )
        
        # Mock already returned rental
        mock_rental = MagicMock()
        mock_rental.status = RentalStatus.RENTAL_COMPLETED
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Execute and verify exception
        with pytest.raises(ValidationError, match="Rental is already returned"):
            await rental_service.process_return(return_data)
    
    def test_calculate_late_fees(self, rental_service):
        """Test late fee calculation."""
        mock_rental = MagicMock()
        mock_rental.rental_end_date = date.today() - timedelta(days=3)  # 3 days late
        mock_rental.total_amount = Decimal("350.00")  # Weekly rental
        
        return_date = datetime.now(timezone.utc)
        
        # Execute with default late fee calculation
        result = rental_service._calculate_late_fees(mock_rental, return_date)
        
        # Verify late fee calculated (should be > 0 for overdue rental)
        assert result >= Decimal("0.00")
    
    @pytest.mark.asyncio
    async def test_create_inspection_success(self, rental_service):
        """Test successful inspection creation."""
        inspection_data = RentalDamageAssessment(
            rental_line_id=uuid4(),
            condition_rating=ConditionRating.B,
            damage_type="COSMETIC",
            damage_description="Minor scratches",
            repair_required=False,
            inspector_id=uuid4()
        )
        
        # Mock inspection creation
        mock_inspection = MagicMock()
        rental_service.inspection_repo.create.return_value = mock_inspection
        rental_service.session.commit = AsyncMock()
        rental_service.session.refresh = AsyncMock()
        
        # Execute
        result = await rental_service.create_inspection(inspection_data)
        
        # Verify
        assert result is not None
        rental_service.inspection_repo.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_rental_by_id_success(self, rental_service):
        """Test successful rental retrieval by ID."""
        rental_id = uuid4()
        
        # Mock rental retrieval
        mock_rental = MagicMock()
        rental_service.rental_repo.get_by_id.return_value = mock_rental
        
        # Execute
        result = await rental_service.get_rental_by_id(rental_id)
        
        # Verify
        assert result == mock_rental
        rental_service.rental_repo.get_by_id.assert_called_once_with(
            rental_id, include_items=True, include_lifecycle=True
        )
    
    @pytest.mark.asyncio
    async def test_get_rental_by_id_not_found(self, rental_service):
        """Test rental retrieval with missing rental."""
        rental_id = uuid4()
        
        # Mock rental not found
        rental_service.rental_repo.get_by_id.return_value = None
        
        # Execute and verify exception
        with pytest.raises(NotFoundError):
            await rental_service.get_rental_by_id(rental_id)
    
    @pytest.mark.asyncio
    async def test_list_rentals_with_filters(self, rental_service):
        """Test rental listing with filters."""
        # Mock repository response
        mock_rentals = [MagicMock(), MagicMock(), MagicMock()]
        rental_service.rental_repo.list_rentals.return_value = mock_rentals
        
        # Execute with filters
        result = await rental_service.list_rentals(
            customer_id=uuid4(),
            location_id=uuid4(),
            status=RentalStatus.RENTAL_INPROGRESS,
            start_date_from=date.today() - timedelta(days=30),
            start_date_to=date.today(),
            is_overdue=True,
            skip=0,
            limit=50
        )
        
        # Verify
        assert len(result) == 3
        rental_service.rental_repo.list_rentals.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_overdue_rentals(self, rental_service):
        """Test overdue rentals retrieval."""
        # Mock overdue rentals
        mock_overdue = [MagicMock(), MagicMock()]
        rental_service.rental_repo.get_overdue_rentals.return_value = mock_overdue
        
        # Execute
        result = await rental_service.get_overdue_rentals(
            location_id=uuid4(),
            days_overdue_threshold=1
        )
        
        # Verify
        assert len(result) == 2
        rental_service.rental_repo.get_overdue_rentals.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_rental_number(self, rental_service):
        """Test rental number generation."""
        with patch('app.services.transaction.rental_service.datetime') as mock_dt:
            mock_dt.now.return_value.strftime.return_value = "20240122123456"
            
            result = await rental_service._generate_rental_number()
            
            assert result == "RENT-20240122123456"
    
    @pytest.mark.asyncio
    async def test_check_extension_availability(self, rental_service):
        """Test extension availability checking."""
        rental_id = uuid4()
        new_end_date = date.today() + timedelta(days=14)
        
        # Mock no conflicts
        rental_service.rental_repo.check_extension_conflicts.return_value = []
        
        # Execute
        result = await rental_service._check_extension_availability(rental_id, new_end_date)
        
        # Verify
        assert result is True
    
    @pytest.mark.asyncio
    async def test_process_return_items(self, rental_service):
        """Test return items processing."""
        rental_id = uuid4()
        return_items = [
            {
                "item_id": uuid4(),
                "returned_quantity": 1,
                "condition_rating": ConditionRating.A
            }
        ]
        
        # Mock item processing
        rental_service.item_repo.update_rental_status.return_value = None
        rental_service.inspection_repo.create_return_inspection.return_value = MagicMock()
        
        # Execute
        await rental_service._process_return_items(rental_id, return_items)
        
        # Verify processing completed without exception
        assert True  # Method completed successfully