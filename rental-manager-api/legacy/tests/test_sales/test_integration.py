"""
Integration Tests for Sale Transition Feature

End-to-end tests demonstrating complete workflows.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sales.services import SaleTransitionService
from app.modules.sales.schemas import (
    SaleTransitionInitiateRequest,
    TransitionConfirmationRequest
)
from app.modules.sales.models import TransitionStatus
from app.modules.master_data.item_master.models import Item
from app.modules.users.models import User
from app.modules.customers.models import Customer
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType
from app.modules.transactions.base.models.transaction_headers import RentalStatus
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingLine, BookingStatus


@pytest.fixture
async def sale_service(session: AsyncSession):
    """Create sale transition service"""
    return SaleTransitionService(session)


@pytest.fixture
async def rental_scenario(session: AsyncSession):
    """Set up a complete rental scenario"""
    # Create customer
    customer = Customer(
        id=uuid4(),
        name="John Doe",
        email="john@example.com",
        phone="555-0123"
    )
    
    # Create item
    item = Item(
        id=uuid4(),
        item_name="Professional Camera Kit",
        item_code="CAM-PRO-001",
        category_id=uuid4(),
        brand_id=uuid4(),
        is_rentable=True,
        is_saleable=False,
        rental_rate=Decimal("250.00"),
        sale_price=Decimal("8000.00")
    )
    
    # Create active rental
    rental_transaction = TransactionHeader(
        id=uuid4(),
        transaction_number="RENT-2024-001",
        transaction_type=TransactionType.RENTAL,
        customer_id=customer.id,
        transaction_date=datetime.utcnow(),
        total_amount=Decimal("750.00")
    )
    
    rental_line = TransactionLine(
        id=uuid4(),
        transaction_id=rental_transaction.id,
        item_id=item.id,
        quantity=1,
        unit_price=Decimal("250.00"),
        line_total=Decimal("750.00"),
        rental_status=RentalStatus.RENTAL_INPROGRESS,
        rental_start_date=datetime.utcnow(),
        rental_end_date=datetime.utcnow() + timedelta(days=3)
    )
    
    # Create future booking from another customer
    customer2 = Customer(
        id=uuid4(),
        name="Jane Smith",
        email="jane@example.com",
        phone="555-0456"
    )
    
    booking = BookingHeader(
        id=uuid4(),
        booking_number="BOOK-2024-001",
        customer_id=customer2.id,
        pickup_date=(datetime.utcnow() + timedelta(days=7)).date(),
        return_date=(datetime.utcnow() + timedelta(days=10)).date(),
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("750.00")
    )
    
    booking_line = BookingLine(
        id=uuid4(),
        booking_id=booking.id,
        item_id=item.id,
        quantity=1,
        unit_price=Decimal("250.00"),
        line_total=Decimal("750.00")
    )
    
    # Save all entities
    session.add_all([
        customer, customer2, item,
        rental_transaction, rental_line,
        booking, booking_line
    ])
    await session.commit()
    
    return {
        "item": item,
        "customers": [customer, customer2],
        "rental": rental_transaction,
        "booking": booking
    }


@pytest.mark.asyncio
class TestCompleteWorkflow:
    """Test complete sale transition workflows"""
    
    async def test_simple_transition_no_conflicts(
        self,
        sale_service: SaleTransitionService,
        test_user: User,
        session: AsyncSession
    ):
        """Test simple transition with no conflicts"""
        # Create available item
        item = Item(
            id=uuid4(),
            item_name="Simple Equipment",
            item_code="EQ-SIMPLE-001",
            category_id=uuid4(),
            brand_id=uuid4(),
            is_rentable=True,
            is_saleable=False,
            rental_rate=Decimal("100.00"),
            sale_price=Decimal("2000.00")
        )
        session.add(item)
        await session.commit()
        
        # Step 1: Check eligibility
        eligibility = await sale_service.check_sale_eligibility(item.id, test_user)
        assert eligibility.eligible is True
        assert eligibility.conflicts is None
        assert eligibility.requires_approval is False
        
        # Step 2: Initiate transition
        request = SaleTransitionInitiateRequest(
            sale_price=Decimal("2500.00"),
            effective_date=None,
            resolution_strategy="WAIT_FOR_RETURN"
        )
        
        transition_response = await sale_service.initiate_sale_transition(
            item.id, request, test_user
        )
        
        assert transition_response.status == "COMPLETED"
        assert transition_response.conflicts_found == 0
        
        # Step 3: Verify item is marked for sale
        await session.refresh(item)
        assert item.is_saleable is True
        assert item.is_rentable is False
    
    async def test_transition_with_rental_conflicts(
        self,
        sale_service: SaleTransitionService,
        rental_scenario: dict,
        test_user: User,
        session: AsyncSession
    ):
        """Test transition with active rental conflicts"""
        item = rental_scenario["item"]
        
        # Step 1: Check eligibility
        eligibility = await sale_service.check_sale_eligibility(item.id, test_user)
        
        assert eligibility.eligible is True
        assert eligibility.conflicts is not None
        assert eligibility.conflicts.total_conflicts >= 2  # Rental + Booking
        assert eligibility.revenue_impact > Decimal("0")
        assert len(eligibility.affected_customers) == 2
        
        # Step 2: Initiate transition
        request = SaleTransitionInitiateRequest(
            sale_price=Decimal("9000.00"),
            effective_date=None,
            resolution_strategy="WAIT_FOR_RETURN"
        )
        
        transition_response = await sale_service.initiate_sale_transition(
            item.id, request, test_user
        )
        
        assert transition_response.status == "PENDING"  # Needs confirmation
        assert transition_response.conflicts_found >= 2
        assert transition_response.affected_customers == 2
        transition_id = transition_response.transition_id
        
        # Step 3: Confirm transition with resolution strategy
        confirmation = TransitionConfirmationRequest(
            confirmed=True,
            resolution_overrides={}  # Use default resolution
        )
        
        result = await sale_service.confirm_transition(
            transition_id, confirmation, test_user
        )
        
        assert result.success is True
        assert result.status == "COMPLETED"
        assert result.conflicts_resolved >= 2
        
        # Step 4: Verify item is marked for sale
        await session.refresh(item)
        assert item.is_saleable is True
        assert item.is_rentable is False
    
    async def test_transition_requiring_approval(
        self,
        sale_service: SaleTransitionService,
        manager_user: User,
        test_user: User,
        session: AsyncSession
    ):
        """Test transition that requires manager approval"""
        # Create high-value item
        item = Item(
            id=uuid4(),
            item_name="Luxury Equipment",
            item_code="LUX-001",
            category_id=uuid4(),
            brand_id=uuid4(),
            is_rentable=True,
            is_saleable=False,
            rental_rate=Decimal("500.00"),
            sale_price=Decimal("15000.00")  # High value
        )
        session.add(item)
        await session.commit()
        
        # Step 1: Regular user initiates transition
        request = SaleTransitionInitiateRequest(
            sale_price=Decimal("15000.00"),
            effective_date=None
        )
        
        transition_response = await sale_service.initiate_sale_transition(
            item.id, request, test_user
        )
        
        assert transition_response.status == "AWAITING_APPROVAL"
        assert transition_response.approval_request_id is not None
        transition_id = transition_response.transition_id
        
        # Step 2: Manager approves transition
        confirmation = TransitionConfirmationRequest(
            confirmed=True,
            manager_pin=None  # Not implemented in this version
        )
        
        result = await sale_service.confirm_transition(
            transition_id, confirmation, manager_user
        )
        
        assert result.success is True
        assert result.status == "COMPLETED"
        
        # Step 3: Verify item is marked for sale
        await session.refresh(item)
        assert item.is_saleable is True
    
    async def test_transition_with_rollback(
        self,
        sale_service: SaleTransitionService,
        test_user: User,
        session: AsyncSession
    ):
        """Test transition rollback functionality"""
        # Create item
        item = Item(
            id=uuid4(),
            item_name="Test Equipment",
            item_code="TEST-001",
            category_id=uuid4(),
            brand_id=uuid4(),
            is_rentable=True,
            is_saleable=False,
            rental_rate=Decimal("150.00"),
            sale_price=Decimal("3000.00")
        )
        session.add(item)
        await session.commit()
        
        # Step 1: Initiate and complete transition
        request = SaleTransitionInitiateRequest(
            sale_price=Decimal("3500.00"),
            effective_date=None
        )
        
        transition_response = await sale_service.initiate_sale_transition(
            item.id, request, test_user
        )
        transition_id = transition_response.transition_id
        
        # Item should be marked for sale
        await session.refresh(item)
        assert item.is_saleable is True
        assert item.is_rentable is False
        
        # Step 2: Rollback the transition
        rollback_result = await sale_service.rollback_transition(
            transition_id,
            "Customer changed their mind",
            test_user
        )
        
        assert rollback_result.success is True
        assert rollback_result.items_restored == 1
        
        # Step 3: Verify item is restored to original state
        await session.refresh(item)
        assert item.is_saleable is False
        assert item.is_rentable is True
    
    async def test_late_rental_creates_critical_conflict(
        self,
        sale_service: SaleTransitionService,
        test_user: User,
        session: AsyncSession
    ):
        """Test that late rentals create critical conflicts"""
        # Create customer and item
        customer = Customer(
            id=uuid4(),
            name="Late Customer",
            email="late@example.com",
            phone="555-LATE"
        )
        
        item = Item(
            id=uuid4(),
            item_name="Overdue Equipment",
            item_code="LATE-001",
            category_id=uuid4(),
            brand_id=uuid4(),
            is_rentable=True,
            is_saleable=False,
            rental_rate=Decimal("200.00"),
            sale_price=Decimal("4000.00")
        )
        
        # Create late rental
        rental = TransactionHeader(
            id=uuid4(),
            transaction_number="LATE-RENT-001",
            transaction_type=TransactionType.RENTAL,
            customer_id=customer.id,
            transaction_date=datetime.utcnow() - timedelta(days=10),
            total_amount=Decimal("2000.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=rental.id,
            item_id=item.id,
            quantity=1,
            unit_price=Decimal("200.00"),
            line_total=Decimal("2000.00"),
            rental_status=RentalStatus.RENTAL_LATE,
            rental_start_date=datetime.utcnow() - timedelta(days=10),
            rental_end_date=datetime.utcnow() - timedelta(days=3)  # 3 days overdue
        )
        
        session.add_all([customer, item, rental, rental_line])
        await session.commit()
        
        # Check eligibility
        eligibility = await sale_service.check_sale_eligibility(item.id, test_user)
        
        assert eligibility.eligible is True
        assert eligibility.conflicts is not None
        assert eligibility.conflicts.critical_conflicts is not None
        assert len(eligibility.conflicts.critical_conflicts) > 0
        assert "Critical conflicts" in eligibility.recommendation
        
        # Should require approval due to critical conflict
        assert eligibility.requires_approval is True
        assert any(
            r.type == "CRITICAL_CONFLICTS" 
            for r in eligibility.approval_reasons
        )
    
    async def test_affected_bookings_retrieval(
        self,
        sale_service: SaleTransitionService,
        rental_scenario: dict,
        test_user: User,
        session: AsyncSession
    ):
        """Test retrieval of affected bookings"""
        item = rental_scenario["item"]
        booking = rental_scenario["booking"]
        
        # Initiate transition
        request = SaleTransitionInitiateRequest(
            sale_price=Decimal("8500.00"),
            effective_date=None
        )
        
        transition_response = await sale_service.initiate_sale_transition(
            item.id, request, test_user
        )
        transition_id = transition_response.transition_id
        
        # Get affected bookings
        affected_bookings = await sale_service.get_affected_bookings(transition_id)
        
        assert len(affected_bookings) > 0
        
        # Find the booking we created
        booking_found = False
        for affected in affected_bookings:
            if affected.booking_id == booking.id:
                booking_found = True
                assert affected.customer_name == "Jane Smith"
                assert affected.booking_value == Decimal("750.00")
                assert affected.status == "CONFIRMED"
                break
        
        assert booking_found, "Expected booking not found in affected list"