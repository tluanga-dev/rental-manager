"""
Tests for Sale Transition Notification Engine

Tests notification sending, templates, and customer communication.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sales.notification_engine import (
    NotificationEngine,
    NotificationType,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus,
    NotificationRequest,
    NotificationTemplate
)
from app.modules.sales.models import (
    SaleNotification,
    SaleConflict,
    ConflictType,
    ConflictSeverity,
    ResolutionAction
)
from app.modules.customers.models import Customer
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingStatus


@pytest.fixture
async def notification_engine(session: AsyncSession):
    """Create notification engine instance"""
    return NotificationEngine(session)


@pytest.fixture
async def test_customer(session: AsyncSession):
    """Create a test customer"""
    customer = Customer(
        id=uuid4(),
        name="Test Customer",
        email="test@example.com",
        phone="555-0123"
    )
    session.add(customer)
    await session.commit()
    return customer


@pytest.fixture
async def test_booking(session: AsyncSession, test_customer: Customer):
    """Create a test booking"""
    booking = BookingHeader(
        id=uuid4(),
        booking_number="BOOK-TEST-001",
        customer_id=test_customer.id,
        location_id=uuid4(),
        pickup_date=(datetime.utcnow() + timedelta(days=5)).date(),
        return_date=(datetime.utcnow() + timedelta(days=10)).date(),
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("500.00")
    )
    session.add(booking)
    await session.commit()
    return booking


@pytest.mark.asyncio
class TestNotificationTemplates:
    """Test notification template rendering"""
    
    async def test_booking_cancellation_template(self, notification_engine: NotificationEngine):
        """Test booking cancellation template rendering"""
        template = notification_engine.templates[NotificationType.BOOKING_CANCELLATION]
        
        context = {
            "customer_name": "John Doe",
            "booking_number": "BOOK-001",
            "item_name": "Canon EOS R5",
            "pickup_date": "2024-12-15",
            "return_date": "2024-12-20",
            "compensation_amount": "$100",
            "company_name": "Rental Co"
        }
        
        rendered = template.render(context)
        
        assert "John Doe" in rendered["body"]
        assert "BOOK-001" in rendered["subject"]
        assert "BOOK-001" in rendered["body"]
        assert "Canon EOS R5" in rendered["body"]
        assert "$100" in rendered["body"]
    
    async def test_alternative_offer_template(self, notification_engine: NotificationEngine):
        """Test alternative offer template rendering"""
        template = notification_engine.templates[NotificationType.ALTERNATIVE_OFFER]
        
        context = {
            "customer_name": "Jane Smith",
            "booking_number": "BOOK-002",
            "alternative_items": "1. Canon EOS R6\n2. Sony A7 IV",
            "response_deadline": "2024-12-10 18:00",
            "company_name": "Rental Co"
        }
        
        rendered = template.render(context)
        
        assert "alternative items" in rendered["subject"].lower()
        assert "Canon EOS R6" in rendered["body"]
        assert "Sony A7 IV" in rendered["body"]
        assert "10% discount" in rendered["body"]
    
    async def test_rollback_notification_template(self, notification_engine: NotificationEngine):
        """Test rollback notification template"""
        template = notification_engine.templates[NotificationType.ROLLBACK_NOTIFICATION]
        
        context = {
            "customer_name": "Bob Wilson",
            "booking_number": "BOOK-003",
            "item_name": "Professional Camera",
            "pickup_date": "2024-12-18",
            "return_date": "2024-12-22",
            "total_amount": "$750",
            "company_name": "Rental Co"
        }
        
        rendered = template.render(context)
        
        assert "Good news" in rendered["subject"]
        assert "reinstated" in rendered["body"].lower()
        assert "BOOK-003" in rendered["body"]
        assert "$750" in rendered["body"]


@pytest.mark.asyncio
class TestNotificationSending:
    """Test notification sending functionality"""
    
    async def test_send_simple_notification(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test sending a simple notification"""
        request = NotificationRequest(
            customer_id=test_customer.id,
            notification_type=NotificationType.TRANSITION_COMPLETED,
            channel=NotificationChannel.IN_APP,
            context={
                "item_name": "Test Item",
                "sale_price": "1000",
                "effective_date": "2024-12-01",
                "conflicts_resolved": "2",
                "customers_notified": "1"
            },
            priority=NotificationPriority.LOW
        )
        
        result = await notification_engine.send_notification(request)
        
        assert result.success is True
        assert result.status == NotificationStatus.SENT
        assert result.notification_id is not None
        
        # Verify notification was saved
        query = select(SaleNotification).where(
            SaleNotification.id == result.notification_id
        )
        saved = await session.execute(query)
        notification = saved.scalar_one_or_none()
        
        assert notification is not None
        assert notification.customer_id == test_customer.id
        assert notification.notification_type == NotificationType.TRANSITION_COMPLETED.value
    
    async def test_send_email_notification(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        test_booking: BookingHeader
    ):
        """Test sending email notification"""
        request = NotificationRequest(
            customer_id=test_customer.id,
            notification_type=NotificationType.BOOKING_CANCELLATION,
            channel=NotificationChannel.EMAIL,
            context={
                "booking_number": test_booking.booking_number,
                "item_name": "Camera Equipment",
                "pickup_date": str(test_booking.pickup_date),
                "return_date": str(test_booking.return_date),
                "compensation_amount": "$150",
                "company_name": "Rental Co"
            },
            priority=NotificationPriority.HIGH,
            response_required=True,
            response_deadline=datetime.utcnow() + timedelta(hours=48)
        )
        
        result = await notification_engine.send_notification(request)
        
        assert result.success is True
        assert result.status == NotificationStatus.SENT
        assert result.sent_at is not None
    
    async def test_send_sms_notification(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer
    ):
        """Test sending SMS notification"""
        request = NotificationRequest(
            customer_id=test_customer.id,
            notification_type=NotificationType.RENTAL_CONFLICT,
            channel=NotificationChannel.SMS,
            context={
                "item_name": "Canon R5",
                "return_date": "2024-12-15",
                "contact_number": "1-800-RENTAL"
            },
            priority=NotificationPriority.HIGH
        )
        
        result = await notification_engine.send_notification(request)
        
        assert result.success is True
        assert result.status == NotificationStatus.SENT
    
    async def test_send_bulk_notifications(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test sending multiple notifications"""
        # Create multiple customers
        customers = [test_customer]
        for i in range(2):
            customer = Customer(
                id=uuid4(),
                name=f"Customer {i+2}",
                email=f"customer{i+2}@example.com",
                phone=f"555-010{i+2}"
            )
            session.add(customer)
            customers.append(customer)
        await session.commit()
        
        # Create notification requests
        requests = []
        for customer in customers:
            request = NotificationRequest(
                customer_id=customer.id,
                notification_type=NotificationType.TRANSITION_COMPLETED,
                channel=NotificationChannel.EMAIL,
                context={
                    "item_name": "Test Item",
                    "sale_price": "1000",
                    "effective_date": "2024-12-01",
                    "conflicts_resolved": "0",
                    "customers_notified": "3"
                }
            )
            requests.append(request)
        
        results = await notification_engine.send_bulk_notifications(requests)
        
        assert len(results) == 3
        assert all(r.success for r in results)
    
    async def test_notification_with_invalid_customer(
        self,
        notification_engine: NotificationEngine
    ):
        """Test notification fails gracefully with invalid customer"""
        request = NotificationRequest(
            customer_id=uuid4(),  # Non-existent customer
            notification_type=NotificationType.TRANSITION_COMPLETED,
            channel=NotificationChannel.EMAIL,
            context={}
        )
        
        result = await notification_engine.send_notification(request)
        
        assert result.success is False
        assert result.status == NotificationStatus.FAILED
        assert "Customer not found" in result.message


@pytest.mark.asyncio
class TestConflictNotifications:
    """Test notifications for conflict resolution"""
    
    async def test_notify_affected_customers(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test notifying customers affected by conflicts"""
        # Create another customer
        customer2 = Customer(
            id=uuid4(),
            name="Second Customer",
            email="second@example.com",
            phone="555-0456"
        )
        session.add(customer2)
        
        # Create conflicts
        transition_id = uuid4()
        conflicts = [
            SaleConflict(
                id=uuid4(),
                transition_request_id=transition_id,
                conflict_type=ConflictType.FUTURE_BOOKING,
                entity_type="booking",
                entity_id=uuid4(),
                severity=ConflictSeverity.HIGH,
                description="Future booking conflict",
                customer_id=test_customer.id,
                financial_impact=Decimal("300.00")
            ),
            SaleConflict(
                id=uuid4(),
                transition_request_id=transition_id,
                conflict_type=ConflictType.ACTIVE_RENTAL,
                entity_type="rental",
                entity_id=uuid4(),
                severity=ConflictSeverity.MEDIUM,
                description="Active rental conflict",
                customer_id=customer2.id,
                financial_impact=Decimal("200.00")
            )
        ]
        
        for conflict in conflicts:
            session.add(conflict)
        await session.commit()
        
        # Notify affected customers
        result = await notification_engine.notify_affected_customers(
            transition_id,
            conflicts,
            ResolutionAction.CANCEL_BOOKING
        )
        
        assert result["total_sent"] == 2
        assert result["customers_notified"] == 2
        assert test_customer.id in result["customer_ids"]
        assert customer2.id in result["customer_ids"]
    
    async def test_send_rollback_notifications(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        test_booking: BookingHeader,
        session: AsyncSession
    ):
        """Test sending notifications when bookings are restored"""
        # Create another booking
        booking2 = BookingHeader(
            id=uuid4(),
            booking_number="BOOK-TEST-002",
            customer_id=test_customer.id,
            location_id=uuid4(),
            pickup_date=(datetime.utcnow() + timedelta(days=8)).date(),
            return_date=(datetime.utcnow() + timedelta(days=12)).date(),
            status=BookingStatus.CANCELLED,
            total_amount=Decimal("400.00")
        )
        session.add(booking2)
        await session.commit()
        
        # Send rollback notifications
        result = await notification_engine.send_rollback_notifications(
            [test_booking.id, booking2.id]
        )
        
        assert result["total_sent"] == 2
        assert result["bookings_notified"] == 2


@pytest.mark.asyncio
class TestNotificationManagement:
    """Test notification status management"""
    
    async def test_check_notification_status(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test checking notification status"""
        # Send a notification
        request = NotificationRequest(
            customer_id=test_customer.id,
            notification_type=NotificationType.TRANSITION_COMPLETED,
            channel=NotificationChannel.EMAIL,
            context={"item_name": "Test"}
        )
        
        result = await notification_engine.send_notification(request)
        
        # Check status
        status = await notification_engine.check_notification_status(result.notification_id)
        
        assert status["found"] is True
        assert status["id"] == result.notification_id
        assert status["status"] == NotificationStatus.SENT.value
        assert status["sent_at"] is not None
    
    async def test_mark_notification_delivered(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test marking notification as delivered"""
        # Create notification
        notification = SaleNotification(
            id=uuid4(),
            customer_id=test_customer.id,
            notification_type=NotificationType.TRANSITION_COMPLETED.value,
            channel=NotificationChannel.EMAIL.value,
            status=NotificationStatus.SENT.value,
            content={"subject": "Test", "body": "Test"}
        )
        session.add(notification)
        await session.commit()
        
        # Mark as delivered
        success = await notification_engine.mark_notification_delivered(notification.id)
        assert success is True
        
        # Verify status
        await session.refresh(notification)
        assert notification.status == NotificationStatus.DELIVERED.value
        assert notification.delivered_at is not None
    
    async def test_mark_notification_read(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test marking notification as read"""
        # Create notification
        notification = SaleNotification(
            id=uuid4(),
            customer_id=test_customer.id,
            notification_type=NotificationType.TRANSITION_COMPLETED.value,
            channel=NotificationChannel.IN_APP.value,
            status=NotificationStatus.DELIVERED.value,
            content={"subject": "Test", "body": "Test"}
        )
        session.add(notification)
        await session.commit()
        
        # Mark as read
        success = await notification_engine.mark_notification_read(notification.id)
        assert success is True
        
        # Verify status
        await session.refresh(notification)
        assert notification.status == NotificationStatus.READ.value
        assert notification.read_at is not None
    
    async def test_get_pending_notifications(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test retrieving pending notifications"""
        # Create notifications with different statuses
        notifications = [
            SaleNotification(
                id=uuid4(),
                customer_id=test_customer.id,
                notification_type=NotificationType.TRANSITION_COMPLETED.value,
                channel=NotificationChannel.EMAIL.value,
                status=NotificationStatus.PENDING.value,
                content={}
            ),
            SaleNotification(
                id=uuid4(),
                customer_id=test_customer.id,
                notification_type=NotificationType.BOOKING_CANCELLATION.value,
                channel=NotificationChannel.EMAIL.value,
                status=NotificationStatus.PENDING.value,
                content={}
            ),
            SaleNotification(
                id=uuid4(),
                customer_id=test_customer.id,
                notification_type=NotificationType.TRANSITION_COMPLETED.value,
                channel=NotificationChannel.EMAIL.value,
                status=NotificationStatus.SENT.value,  # Not pending
                content={}
            )
        ]
        
        for n in notifications:
            session.add(n)
        await session.commit()
        
        # Get pending notifications
        pending = await notification_engine.get_pending_notifications()
        
        assert len(pending) == 2
        assert all(n.status == NotificationStatus.PENDING.value for n in pending)
    
    async def test_retry_failed_notifications(
        self,
        notification_engine: NotificationEngine,
        test_customer: Customer,
        session: AsyncSession
    ):
        """Test retrying failed notifications"""
        # Create failed notifications
        failed_notification = SaleNotification(
            id=uuid4(),
            customer_id=test_customer.id,
            notification_type=NotificationType.BOOKING_CANCELLATION.value,
            channel=NotificationChannel.EMAIL.value,
            status=NotificationStatus.FAILED.value,
            content={
                "context": {
                    "booking_number": "BOOK-RETRY",
                    "item_name": "Test Item",
                    "pickup_date": "2024-12-20",
                    "return_date": "2024-12-25",
                    "compensation_amount": "$200",
                    "company_name": "Rental Co"
                }
            },
            response_required=True,
            response_deadline=datetime.utcnow() + timedelta(days=2)
        )
        session.add(failed_notification)
        await session.commit()
        
        # Retry failed notifications
        result = await notification_engine.retry_failed_notifications()
        
        assert result["total_retried"] == 1
        assert result["successful"] == 1
        assert result["failed"] == 0