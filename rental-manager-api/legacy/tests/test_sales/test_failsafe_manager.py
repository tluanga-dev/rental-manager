"""
Tests for Sale Transition Failsafe Manager

Tests approval workflows, checkpoints, and rollback functionality.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
import json
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sales.failsafe_manager import (
    FailsafeManager,
    FailsafeConfiguration,
    ApprovalRequirement,
    ApprovalReason,
    CheckpointData,
    RollbackResult
)
from app.modules.sales.models import (
    SaleTransitionRequest,
    TransitionCheckpoint,
    TransitionStatus
)
from app.modules.sales.conflict_detection_engine import (
    ConflictReport,
    Conflict,
    ConflictType,
    ConflictSeverity
)
from app.modules.master_data.item_master.models import Item
from app.modules.users.models import User, Role
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingStatus
from app.modules.customers.models import Customer


@pytest.fixture
async def failsafe_config():
    """Create test failsafe configuration"""
    return FailsafeConfiguration(
        revenue_threshold=Decimal("1000.00"),
        customer_threshold=5,
        item_value_threshold=Decimal("5000.00"),
        future_booking_days_threshold=30,
        rollback_window_hours=24,
        notification_grace_period_hours=48,
        require_approval_for_critical_conflicts=True,
        auto_approve_no_conflicts=True
    )


@pytest.fixture
async def failsafe_manager(session: AsyncSession, failsafe_config: FailsafeConfiguration):
    """Create failsafe manager instance"""
    return FailsafeManager(session, failsafe_config)


@pytest.fixture
async def test_item(session: AsyncSession):
    """Create a test item"""
    item = Item(
        id=uuid4(),
        item_name="High Value Camera",
        item_code="CAM-002",
        category_id=uuid4(),
        brand_id=uuid4(),
        is_rentable=True,
        is_saleable=False,
        rental_rate=Decimal("200.00"),
        sale_price=Decimal("10000.00")  # High value item
    )
    session.add(item)
    await session.commit()
    return item


@pytest.fixture
async def test_user(session: AsyncSession):
    """Create a test user with role"""
    role = Role(
        id=uuid4(),
        name="USER",
        description="Regular user"
    )
    
    user = User(
        id=uuid4(),
        username="testuser",
        email="user@example.com",
        full_name="Test User",
        role_id=role.id,
        role=role
    )
    
    session.add(role)
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def manager_user(session: AsyncSession):
    """Create a manager user"""
    role = Role(
        id=uuid4(),
        name="MANAGER",
        description="Manager role"
    )
    
    user = User(
        id=uuid4(),
        username="manager",
        email="manager@example.com",
        full_name="Manager User",
        role_id=role.id,
        role=role
    )
    
    session.add(role)
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def test_customer(session: AsyncSession):
    """Create a test customer"""
    customer = Customer(
        id=uuid4(),
        name="Test Customer",
        email="customer@example.com",
        phone="1234567890"
    )
    session.add(customer)
    await session.commit()
    return customer


@pytest.mark.asyncio
class TestApprovalWorkflow:
    """Test approval requirement detection"""
    
    async def test_no_approval_required_for_no_conflicts(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_user: User
    ):
        """Test that no approval is required when there are no conflicts"""
        # Create empty conflict report
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[],
            revenue_impact=Decimal("0.00"),
            check_date=datetime.utcnow()
        )
        
        # Check approval requirements
        approval = await failsafe_manager.check_approval_requirements(
            test_item.id,
            conflicts,
            test_user
        )
        
        # Assertions
        assert approval.required is False
        assert len(approval.reasons) == 0
    
    async def test_approval_required_for_revenue_impact(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_user: User
    ):
        """Test approval required when revenue impact exceeds threshold"""
        # Create conflict with high revenue impact
        conflict = Conflict(
            conflict_type=ConflictType.ACTIVE_RENTAL,
            entity_id=uuid4(),
            entity_type="rental",
            severity=ConflictSeverity.HIGH,
            description="Active rental",
            financial_impact=Decimal("2000.00")
        )
        
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[conflict],
            revenue_impact=Decimal("2000.00"),  # Exceeds 1000 threshold
            check_date=datetime.utcnow()
        )
        
        # Check approval requirements
        approval = await failsafe_manager.check_approval_requirements(
            test_item.id,
            conflicts,
            test_user
        )
        
        # Assertions
        assert approval.required is True
        assert any(r.type == "REVENUE_IMPACT" for r in approval.reasons)
        assert approval.approver_level in ["MANAGER", "SENIOR_MANAGER"]
    
    async def test_approval_required_for_critical_conflicts(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_user: User
    ):
        """Test approval required for critical conflicts"""
        # Create critical conflict
        conflict = Conflict(
            conflict_type=ConflictType.ACTIVE_RENTAL,
            entity_id=uuid4(),
            entity_type="rental",
            severity=ConflictSeverity.CRITICAL,
            description="Late rental",
            financial_impact=Decimal("500.00")
        )
        
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[conflict],
            revenue_impact=Decimal("500.00"),
            check_date=datetime.utcnow()
        )
        
        # Check approval requirements
        approval = await failsafe_manager.check_approval_requirements(
            test_item.id,
            conflicts,
            test_user
        )
        
        # Assertions
        assert approval.required is True
        assert any(r.type == "CRITICAL_CONFLICTS" for r in approval.reasons)
        assert approval.approver_level == "SENIOR_MANAGER"
    
    async def test_approval_required_for_high_value_item(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_user: User
    ):
        """Test approval required for high-value items"""
        # Item has sale_price of 10000, exceeds 5000 threshold
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[],
            revenue_impact=Decimal("0.00"),
            check_date=datetime.utcnow()
        )
        
        # Check approval requirements
        approval = await failsafe_manager.check_approval_requirements(
            test_item.id,
            conflicts,
            test_user
        )
        
        # Assertions
        assert approval.required is True
        assert any(r.type == "HIGH_VALUE_ITEM" for r in approval.reasons)
    
    async def test_approval_required_for_insufficient_authority(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_user: User
    ):
        """Test approval required when user lacks authority"""
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[],
            revenue_impact=Decimal("0.00"),
            check_date=datetime.utcnow()
        )
        
        # Check approval requirements (regular user)
        approval = await failsafe_manager.check_approval_requirements(
            test_item.id,
            conflicts,
            test_user
        )
        
        # Assertions
        assert approval.required is True
        assert any(r.type == "INSUFFICIENT_AUTHORITY" for r in approval.reasons)


@pytest.mark.asyncio
class TestCheckpointAndRollback:
    """Test checkpoint creation and rollback functionality"""
    
    async def test_create_checkpoint(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        session: AsyncSession
    ):
        """Test checkpoint creation captures current state"""
        # Create checkpoint
        checkpoint = await failsafe_manager.create_checkpoint(test_item.id)
        
        # Assertions
        assert checkpoint.id is not None
        assert checkpoint.checkpoint_data is not None
        assert checkpoint.expires_at > datetime.utcnow()
        assert checkpoint.used is False
        
        # Verify checkpoint data structure
        data = checkpoint.checkpoint_data
        assert "item_state" in data
        assert "active_rentals" in data
        assert "active_bookings" in data
        assert "inventory_state" in data
        assert "timestamp" in data
    
    async def test_rollback_to_checkpoint_success(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        session: AsyncSession
    ):
        """Test successful rollback to checkpoint"""
        # Mark item as saleable first
        test_item.is_saleable = True
        test_item.is_rentable = False
        await session.commit()
        
        # Create checkpoint before changes
        checkpoint = await failsafe_manager.create_checkpoint(test_item.id)
        
        # Perform rollback
        result = await failsafe_manager.rollback_to_checkpoint(
            checkpoint,
            "Test rollback"
        )
        
        # Assertions
        assert result.success is True
        assert result.rollback_id == checkpoint.id
        assert result.items_restored == 1
        assert checkpoint.used is True
        assert checkpoint.used_at is not None
    
    async def test_rollback_expired_checkpoint_fails(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        session: AsyncSession
    ):
        """Test that expired checkpoints cannot be used"""
        # Create checkpoint with past expiry
        checkpoint = TransitionCheckpoint(
            checkpoint_data={"item_state": {"id": str(test_item.id)}},
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
            used=False
        )
        session.add(checkpoint)
        await session.commit()
        
        # Attempt rollback
        result = await failsafe_manager.rollback_to_checkpoint(
            checkpoint,
            "Test rollback"
        )
        
        # Assertions
        assert result.success is False
        assert "expired" in result.message.lower()
    
    async def test_rollback_used_checkpoint_fails(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        session: AsyncSession
    ):
        """Test that used checkpoints cannot be reused"""
        # Create used checkpoint
        checkpoint = TransitionCheckpoint(
            checkpoint_data={"item_state": {"id": str(test_item.id)}},
            expires_at=datetime.utcnow() + timedelta(hours=1),
            used=True,  # Already used
            used_at=datetime.utcnow()
        )
        session.add(checkpoint)
        await session.commit()
        
        # Attempt rollback
        result = await failsafe_manager.rollback_to_checkpoint(
            checkpoint,
            "Test rollback"
        )
        
        # Assertions
        assert result.success is False
        assert "already used" in result.message.lower()
    
    async def test_restore_booking_during_rollback(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test that cancelled bookings are restored during rollback"""
        # Create a booking
        booking = BookingHeader(
            id=uuid4(),
            booking_number="BOOK-100",
            customer_id=test_customer.id,
            pickup_date=(datetime.utcnow() + timedelta(days=5)).date(),
            return_date=(datetime.utcnow() + timedelta(days=10)).date(),
            status=BookingStatus.CONFIRMED,
            total_amount=Decimal("500.00")
        )
        session.add(booking)
        await session.commit()
        
        # Create checkpoint with booking data
        checkpoint_data = {
            "item_state": {"id": str(test_item.id), "is_saleable": False},
            "active_rentals": [],
            "active_bookings": [{
                "id": str(booking.id),
                "status": "CONFIRMED",
                "customer_id": str(booking.customer_id),
                "pickup_date": booking.pickup_date.isoformat()
            }],
            "inventory_state": {"stock_levels": []},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        checkpoint = TransitionCheckpoint(
            checkpoint_data=checkpoint_data,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        session.add(checkpoint)
        
        # Cancel the booking
        booking.status = BookingStatus.CANCELLED
        await session.commit()
        
        # Perform rollback
        result = await failsafe_manager.rollback_to_checkpoint(
            checkpoint,
            "Restore bookings"
        )
        
        # Assertions
        assert result.success is True
        assert result.bookings_restored == 1


@pytest.mark.asyncio
class TestBusinessValidation:
    """Test business rule validation"""
    
    async def test_validate_transition_with_existing_sale_status(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item,
        session: AsyncSession
    ):
        """Test validation fails for already saleable items"""
        # Mark item as already saleable
        test_item.is_saleable = True
        await session.commit()
        
        # Create transition request
        transition = SaleTransitionRequest(
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("5000.00"),
            request_status=TransitionStatus.PENDING
        )
        
        # Create empty conflicts
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[],
            revenue_impact=Decimal("0.00"),
            check_date=datetime.utcnow()
        )
        
        # Validate
        validation = await failsafe_manager.validate_transition(
            transition,
            conflicts
        )
        
        # Assertions
        assert validation["is_valid"] is False
        assert any("already marked for sale" in e for e in validation["errors"])
    
    async def test_validate_transition_with_invalid_price(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item
    ):
        """Test validation fails for invalid sale price"""
        # Create transition with negative price
        transition = SaleTransitionRequest(
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("-100.00"),  # Invalid
            request_status=TransitionStatus.PENDING
        )
        
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=[],
            revenue_impact=Decimal("0.00"),
            check_date=datetime.utcnow()
        )
        
        # Validate
        validation = await failsafe_manager.validate_transition(
            transition,
            conflicts
        )
        
        # Assertions
        assert validation["is_valid"] is False
        assert any("price must be positive" in e for e in validation["errors"])
    
    async def test_validate_high_risk_transition_warning(
        self,
        failsafe_manager: FailsafeManager,
        test_item: Item
    ):
        """Test that high-risk transitions generate warnings"""
        transition = SaleTransitionRequest(
            item_id=test_item.id,
            requested_by=uuid4(),
            sale_price=Decimal("5000.00"),
            request_status=TransitionStatus.PENDING
        )
        
        # Create high-risk conflicts (risk score > 90)
        critical_conflicts = [
            Conflict(
                conflict_type=ConflictType.ACTIVE_RENTAL,
                entity_id=uuid4(),
                entity_type="rental",
                severity=ConflictSeverity.CRITICAL,
                description="Critical conflict",
                financial_impact=Decimal("1000.00")
            ) for _ in range(3)
        ]
        
        conflicts = ConflictReport(
            item_id=test_item.id,
            conflicts=critical_conflicts,
            revenue_impact=Decimal("3000.00"),
            check_date=datetime.utcnow()
        )
        
        # Validate
        validation = await failsafe_manager.validate_transition(
            transition,
            conflicts
        )
        
        # Assertions
        assert validation["is_valid"] is True  # Still valid but has warnings
        assert len(validation["warnings"]) > 0
        assert any("high risk" in w.lower() for w in validation["warnings"])