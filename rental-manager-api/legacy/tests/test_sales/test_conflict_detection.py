"""
Tests for Sale Transition Conflict Detection Engine

Tests conflict detection for rentals, bookings, and inventory.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sales.conflict_detection_engine import (
    ConflictDetectionEngine,
    Conflict,
    ConflictReport,
    ConflictSeverity,
    ConflictType
)
from app.modules.transactions.base.models import TransactionHeader, TransactionLine, TransactionType
from app.modules.transactions.base.models.transaction_headers import RentalStatus
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingLine, BookingStatus
from app.modules.master_data.item_master.models import Item
from app.modules.inventory.models import InventoryUnit
from app.modules.inventory.enums import InventoryUnitStatus
from app.modules.customers.models import Customer


@pytest.fixture
async def conflict_engine(session: AsyncSession):
    """Create conflict detection engine instance"""
    return ConflictDetectionEngine(session)


@pytest.fixture
async def test_item(session: AsyncSession):
    """Create a test item"""
    item = Item(
        id=uuid4(),
        item_name="Test Camera",
        item_code="CAM-001",
        category_id=uuid4(),
        brand_id=uuid4(),
        is_rentable=True,
        is_saleable=False,
        rental_rate=Decimal("100.00"),
        sale_price=Decimal("5000.00")
    )
    session.add(item)
    await session.commit()
    return item


@pytest.fixture
async def test_customer(session: AsyncSession):
    """Create a test customer"""
    customer = Customer(
        id=uuid4(),
        name="Test Customer",
        email="test@example.com",
        phone="1234567890"
    )
    session.add(customer)
    await session.commit()
    return customer


@pytest.mark.asyncio
class TestConflictDetection:
    """Test conflict detection functionality"""
    
    async def test_no_conflicts_for_available_item(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        session: AsyncSession
    ):
        """Test that available items have no conflicts"""
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is False
        assert report.total_conflicts == 0
        assert report.risk_score == 0
        assert "No conflicts detected" in report.recommendation
    
    async def test_active_rental_conflict_detection(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test detection of active rental conflicts"""
        # Create active rental
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-001",
            transaction_type=TransactionType.RENTAL,
            customer_id=test_customer.id,
            transaction_date=datetime.utcnow(),
            total_amount=Decimal("500.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("500.00"),
            rental_status=RentalStatus.RENTAL_INPROGRESS,
            rental_start_date=datetime.utcnow(),
            rental_end_date=datetime.utcnow() + timedelta(days=5)
        )
        
        session.add(transaction)
        session.add(rental_line)
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is True
        assert report.total_conflicts == 1
        assert report.conflicts[0].type == ConflictType.ACTIVE_RENTAL
        assert report.conflicts[0].severity in [ConflictSeverity.HIGH, ConflictSeverity.MEDIUM]
        assert report.conflicts[0].customer_id == test_customer.id
        assert report.risk_score > 0
    
    async def test_late_rental_critical_conflict(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test that late rentals create critical conflicts"""
        # Create late rental
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-002",
            transaction_type=TransactionType.RENTAL,
            customer_id=test_customer.id,
            transaction_date=datetime.utcnow() - timedelta(days=10),
            total_amount=Decimal("500.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("500.00"),
            rental_status=RentalStatus.RENTAL_LATE,
            rental_start_date=datetime.utcnow() - timedelta(days=10),
            rental_end_date=datetime.utcnow() - timedelta(days=3)  # Past due
        )
        
        session.add(transaction)
        session.add(rental_line)
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is True
        assert report.conflicts[0].severity == ConflictSeverity.CRITICAL
        assert "Critical conflicts detected" in report.recommendation
    
    async def test_future_booking_conflict_detection(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test detection of future booking conflicts"""
        # Create future booking
        booking = BookingHeader(
            id=uuid4(),
            booking_number="BOOK-001",
            customer_id=test_customer.id,
            pickup_date=(datetime.utcnow() + timedelta(days=2)).date(),
            return_date=(datetime.utcnow() + timedelta(days=7)).date(),
            status=BookingStatus.CONFIRMED,
            total_amount=Decimal("500.00")
        )
        
        booking_line = BookingLine(
            id=uuid4(),
            booking_id=booking.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("500.00")
        )
        
        session.add(booking)
        session.add(booking_line)
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is True
        assert report.total_conflicts == 1
        assert report.conflicts[0].type == ConflictType.FUTURE_BOOKING
        assert report.conflicts[0].severity == ConflictSeverity.CRITICAL  # 2 days away
        assert report.conflicts[0].customer_id == test_customer.id
    
    async def test_inventory_conflict_detection(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        session: AsyncSession
    ):
        """Test detection of inventory conflicts"""
        # Create inventory units with problems
        units = [
            InventoryUnit(
                id=uuid4(),
                item_id=test_item.id,
                serial_number="SN001",
                status=InventoryUnitStatus.RENTED,
                location_id=uuid4()
            ),
            InventoryUnit(
                id=uuid4(),
                item_id=test_item.id,
                serial_number="SN002",
                status=InventoryUnitStatus.MAINTENANCE,
                location_id=uuid4()
            ),
            InventoryUnit(
                id=uuid4(),
                item_id=test_item.id,
                serial_number="SN003",
                status=InventoryUnitStatus.DAMAGED,
                location_id=uuid4()
            )
        ]
        
        for unit in units:
            session.add(unit)
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is True
        assert any(c.type == ConflictType.CROSS_LOCATION for c in report.conflicts)
        inventory_conflict = next(c for c in report.conflicts if c.type == ConflictType.CROSS_LOCATION)
        assert inventory_conflict.severity == ConflictSeverity.HIGH  # Has rented units
    
    async def test_multiple_conflicts_aggregation(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test aggregation of multiple conflict types"""
        # Create active rental
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-003",
            transaction_type=TransactionType.RENTAL,
            customer_id=test_customer.id,
            transaction_date=datetime.utcnow(),
            total_amount=Decimal("300.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("300.00"),
            rental_status=RentalStatus.RENTAL_INPROGRESS,
            rental_start_date=datetime.utcnow(),
            rental_end_date=datetime.utcnow() + timedelta(days=3)
        )
        
        # Create future booking
        booking = BookingHeader(
            id=uuid4(),
            booking_number="BOOK-002",
            customer_id=test_customer.id,
            pickup_date=(datetime.utcnow() + timedelta(days=10)).date(),
            return_date=(datetime.utcnow() + timedelta(days=15)).date(),
            status=BookingStatus.PENDING,
            total_amount=Decimal("500.00")
        )
        
        booking_line = BookingLine(
            id=uuid4(),
            booking_id=booking.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("500.00")
        )
        
        session.add_all([transaction, rental_line, booking, booking_line])
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Assertions
        assert report.has_conflicts is True
        assert report.total_conflicts >= 2
        assert report.revenue_impact == Decimal("800.00")  # 300 + 500
        assert len(report.get_affected_customers()) == 1  # Same customer
        assert report.risk_score > 0
    
    async def test_conflict_severity_calculation(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test correct severity calculation based on timing"""
        # Create booking very close to current date (should be CRITICAL)
        booking_close = BookingHeader(
            id=uuid4(),
            booking_number="BOOK-003",
            customer_id=test_customer.id,
            pickup_date=(datetime.utcnow() + timedelta(days=1)).date(),
            return_date=(datetime.utcnow() + timedelta(days=3)).date(),
            status=BookingStatus.CONFIRMED,
            total_amount=Decimal("200.00")
        )
        
        booking_line_close = BookingLine(
            id=uuid4(),
            booking_id=booking_close.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("200.00")
        )
        
        session.add_all([booking_close, booking_line_close])
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Find the booking conflict
        booking_conflict = next(
            c for c in report.conflicts 
            if c.type == ConflictType.FUTURE_BOOKING
        )
        
        # Should be CRITICAL (1 day away)
        assert booking_conflict.severity == ConflictSeverity.CRITICAL
        assert report.risk_score >= 50  # High risk due to critical conflict
    
    async def test_save_conflicts_to_database(
        self,
        conflict_engine: ConflictDetectionEngine,
        test_item: Item,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test saving detected conflicts to database"""
        # Create a simple conflict scenario
        transaction = TransactionHeader(
            id=uuid4(),
            transaction_number="RENT-004",
            transaction_type=TransactionType.RENTAL,
            customer_id=test_customer.id,
            transaction_date=datetime.utcnow(),
            total_amount=Decimal("100.00")
        )
        
        rental_line = TransactionLine(
            id=uuid4(),
            transaction_id=transaction.id,
            item_id=test_item.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("100.00"),
            rental_status=RentalStatus.RENTAL_INPROGRESS,
            rental_start_date=datetime.utcnow(),
            rental_end_date=datetime.utcnow() + timedelta(days=5)
        )
        
        session.add_all([transaction, rental_line])
        await session.commit()
        
        # Detect conflicts
        report = await conflict_engine.detect_all_conflicts(test_item.id)
        
        # Save conflicts
        transition_request_id = uuid4()
        saved_conflicts = await conflict_engine.save_conflicts(
            transition_request_id,
            report.conflicts
        )
        
        # Assertions
        assert len(saved_conflicts) == report.total_conflicts
        for saved in saved_conflicts:
            assert saved.transition_request_id == transition_request_id
            assert saved.conflict_type is not None
            assert saved.severity is not None
            assert saved.entity_id is not None