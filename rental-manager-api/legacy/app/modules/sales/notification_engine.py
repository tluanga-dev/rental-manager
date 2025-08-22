"""
Notification Engine for Sale Transitions

Handles customer notifications for sale transition events including
booking cancellations, rental conflicts, and resolution updates.
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from enum import Enum
import json
import asyncio
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from app.modules.sales.models import (
    SaleNotification,
    SaleTransitionRequest,
    SaleConflict,
    SaleResolution,
    ResolutionAction
)
from app.modules.customers.models import Customer
from app.modules.transactions.rentals.rental_booking.models import BookingHeader
from app.modules.master_data.item_master.models import Item
from app.shared.exceptions import BusinessLogicError
import logging

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """Types of notifications"""
    BOOKING_CANCELLATION = "BOOKING_CANCELLATION"
    RENTAL_CONFLICT = "RENTAL_CONFLICT"
    TRANSITION_APPROVED = "TRANSITION_APPROVED"
    TRANSITION_COMPLETED = "TRANSITION_COMPLETED"
    ALTERNATIVE_OFFER = "ALTERNATIVE_OFFER"
    COMPENSATION_OFFER = "COMPENSATION_OFFER"
    ROLLBACK_NOTIFICATION = "ROLLBACK_NOTIFICATION"
    REMINDER = "REMINDER"
    ESCALATION = "ESCALATION"


class NotificationChannel(str, Enum):
    """Notification delivery channels"""
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"
    PUSH = "PUSH"


class NotificationPriority(str, Enum):
    """Notification priority levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NotificationStatus(str, Enum):
    """Notification delivery status"""
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    BOUNCED = "BOUNCED"


@dataclass
class NotificationTemplate:
    """Template for notifications"""
    type: NotificationType
    channel: NotificationChannel
    subject: str
    body_template: str
    variables: List[str]
    priority: NotificationPriority = NotificationPriority.MEDIUM
    
    def render(self, context: Dict[str, Any]) -> Dict[str, str]:
        """Render template with context variables"""
        subject = self.subject
        body = self.body_template
        
        for var in self.variables:
            placeholder = f"{{{var}}}"
            value = str(context.get(var, ""))
            subject = subject.replace(placeholder, value)
            body = body.replace(placeholder, value)
        
        return {
            "subject": subject,
            "body": body
        }


@dataclass
class NotificationRequest:
    """Request to send a notification"""
    customer_id: UUID
    notification_type: NotificationType
    channel: NotificationChannel
    context: Dict[str, Any]
    priority: NotificationPriority = NotificationPriority.MEDIUM
    response_required: bool = False
    response_deadline: Optional[datetime] = None
    related_entity_id: Optional[UUID] = None
    related_entity_type: Optional[str] = None


@dataclass
class NotificationResult:
    """Result of sending a notification"""
    success: bool
    notification_id: UUID
    status: NotificationStatus
    message: str
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class NotificationEngine:
    """Engine for managing and sending notifications"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.templates = self._initialize_templates()
        
    def _initialize_templates(self) -> Dict[NotificationType, NotificationTemplate]:
        """Initialize notification templates"""
        return {
            NotificationType.BOOKING_CANCELLATION: NotificationTemplate(
                type=NotificationType.BOOKING_CANCELLATION,
                channel=NotificationChannel.EMAIL,
                subject="Important: Your booking {booking_number} has been affected",
                body_template="""Dear {customer_name},

We regret to inform you that your booking {booking_number} for {item_name} 
scheduled from {pickup_date} to {return_date} has been affected due to the item 
being marked for sale.

We sincerely apologize for any inconvenience this may cause.

Options available to you:
1. Choose an alternative item from our inventory
2. Receive a full refund
3. Accept compensation of {compensation_amount}

Please respond within 48 hours to let us know your preference.

Best regards,
{company_name}
Customer Service Team""",
                variables=["customer_name", "booking_number", "item_name", 
                          "pickup_date", "return_date", "compensation_amount", "company_name"],
                priority=NotificationPriority.HIGH
            ),
            
            NotificationType.RENTAL_CONFLICT: NotificationTemplate(
                type=NotificationType.RENTAL_CONFLICT,
                channel=NotificationChannel.SMS,
                subject="Rental Update Required",
                body_template="""Hi {customer_name}, your rental of {item_name} ending {return_date} 
has an important update. Please call us at {contact_number} or check your email for details.""",
                variables=["customer_name", "item_name", "return_date", "contact_number"],
                priority=NotificationPriority.HIGH
            ),
            
            NotificationType.ALTERNATIVE_OFFER: NotificationTemplate(
                type=NotificationType.ALTERNATIVE_OFFER,
                channel=NotificationChannel.EMAIL,
                subject="Alternative items available for your booking",
                body_template="""Dear {customer_name},

Following up on our previous communication about your booking {booking_number}, 
we have identified the following alternative items that match your requirements:

{alternative_items}

These items are available for the same dates and we can offer them at:
- Same price as your original booking
- 10% discount as an apology for the inconvenience

Please let us know your preference by {response_deadline}.

Best regards,
{company_name}""",
                variables=["customer_name", "booking_number", "alternative_items", 
                          "response_deadline", "company_name"],
                priority=NotificationPriority.MEDIUM
            ),
            
            NotificationType.COMPENSATION_OFFER: NotificationTemplate(
                type=NotificationType.COMPENSATION_OFFER,
                channel=NotificationChannel.EMAIL,
                subject="Compensation offer for booking {booking_number}",
                body_template="""Dear {customer_name},

As discussed, we would like to offer you compensation for the cancellation of 
your booking {booking_number}.

Compensation Details:
- Refund Amount: {refund_amount}
- Additional Compensation: {compensation_amount}
- Future Booking Credit: {credit_amount}
- Total Value: {total_value}

This compensation will be processed within 3-5 business days upon your acceptance.

To accept this offer, please reply to this email or call us at {contact_number}.

Best regards,
{company_name}""",
                variables=["customer_name", "booking_number", "refund_amount", 
                          "compensation_amount", "credit_amount", "total_value", 
                          "contact_number", "company_name"],
                priority=NotificationPriority.HIGH
            ),
            
            NotificationType.TRANSITION_COMPLETED: NotificationTemplate(
                type=NotificationType.TRANSITION_COMPLETED,
                channel=NotificationChannel.IN_APP,
                subject="Sale transition completed for {item_name}",
                body_template="""The sale transition for {item_name} has been completed successfully.

Details:
- Item: {item_name}
- Sale Price: {sale_price}
- Effective Date: {effective_date}
- Conflicts Resolved: {conflicts_resolved}
- Customers Notified: {customers_notified}

The item is now marked for sale and removed from rental inventory.""",
                variables=["item_name", "sale_price", "effective_date", 
                          "conflicts_resolved", "customers_notified"],
                priority=NotificationPriority.LOW
            ),
            
            NotificationType.ROLLBACK_NOTIFICATION: NotificationTemplate(
                type=NotificationType.ROLLBACK_NOTIFICATION,
                channel=NotificationChannel.EMAIL,
                subject="Good news: Your booking {booking_number} has been reinstated",
                body_template="""Dear {customer_name},

Good news! Your previously cancelled booking {booking_number} for {item_name} 
has been reinstated.

Your booking details remain unchanged:
- Pickup Date: {pickup_date}
- Return Date: {return_date}
- Total Amount: {total_amount}

No further action is required from your side. We apologize for any confusion 
and look forward to serving you.

Best regards,
{company_name}""",
                variables=["customer_name", "booking_number", "item_name", 
                          "pickup_date", "return_date", "total_amount", "company_name"],
                priority=NotificationPriority.HIGH
            )
        }
    
    async def send_notification(
        self,
        request: NotificationRequest
    ) -> NotificationResult:
        """
        Send a notification to a customer
        
        Args:
            request: Notification request details
        
        Returns:
            NotificationResult
        """
        try:
            # Get customer details
            customer = await self._get_customer(request.customer_id)
            if not customer:
                return NotificationResult(
                    success=False,
                    notification_id=uuid4(),
                    status=NotificationStatus.FAILED,
                    message="Customer not found",
                    error="Customer not found"
                )
            
            # Get template
            template = self.templates.get(request.notification_type)
            if not template:
                return NotificationResult(
                    success=False,
                    notification_id=uuid4(),
                    status=NotificationStatus.FAILED,
                    message="Template not found",
                    error=f"No template for {request.notification_type}"
                )
            
            # Add customer info to context
            request.context["customer_name"] = customer.name
            request.context["customer_email"] = customer.email
            request.context["customer_phone"] = customer.phone
            
            # Render template
            rendered = template.render(request.context)
            
            # Create notification record
            notification = SaleNotification(
                id=uuid4(),
                customer_id=request.customer_id,
                notification_type=request.notification_type.value,
                channel=request.channel.value,
                status=NotificationStatus.PENDING.value,
                content={
                    "subject": rendered["subject"],
                    "body": rendered["body"],
                    "context": request.context
                },
                response_required=request.response_required,
                response_deadline=request.response_deadline
            )
            
            # Send based on channel
            send_result = await self._send_via_channel(
                notification,
                customer,
                rendered,
                request.channel
            )
            
            if send_result["success"]:
                notification.status = NotificationStatus.SENT.value
                notification.sent_at = datetime.utcnow()
            else:
                notification.status = NotificationStatus.FAILED.value
            
            self.session.add(notification)
            await self.session.flush()
            
            logger.info(f"Notification {notification.id} sent to customer {customer.name}")
            
            return NotificationResult(
                success=send_result["success"],
                notification_id=notification.id,
                status=NotificationStatus(notification.status),
                message=send_result.get("message", "Notification sent"),
                sent_at=notification.sent_at,
                error=send_result.get("error")
            )
            
        except Exception as e:
            logger.error(f"Failed to send notification: {str(e)}")
            return NotificationResult(
                success=False,
                notification_id=uuid4(),
                status=NotificationStatus.FAILED,
                message="Failed to send notification",
                error=str(e)
            )
    
    async def send_bulk_notifications(
        self,
        requests: List[NotificationRequest]
    ) -> List[NotificationResult]:
        """
        Send multiple notifications
        
        Args:
            requests: List of notification requests
        
        Returns:
            List of NotificationResults
        """
        results = []
        for request in requests:
            result = await self.send_notification(request)
            results.append(result)
        return results
    
    async def notify_affected_customers(
        self,
        transition_id: UUID,
        conflicts: List[SaleConflict],
        resolution_action: ResolutionAction
    ) -> Dict[str, Any]:
        """
        Notify all customers affected by a sale transition
        
        Args:
            transition_id: Sale transition ID
            conflicts: List of conflicts affecting customers
            resolution_action: How conflicts are being resolved
        
        Returns:
            Summary of notifications sent
        """
        notifications_sent = 0
        notifications_failed = 0
        customer_ids_notified = set()
        
        for conflict in conflicts:
            if conflict.customer_id and conflict.customer_id not in customer_ids_notified:
                # Determine notification type based on resolution
                if resolution_action == ResolutionAction.CANCEL_BOOKING:
                    notification_type = NotificationType.BOOKING_CANCELLATION
                elif resolution_action == ResolutionAction.TRANSFER_TO_ALTERNATIVE:
                    notification_type = NotificationType.ALTERNATIVE_OFFER
                elif resolution_action == ResolutionAction.OFFER_COMPENSATION:
                    notification_type = NotificationType.COMPENSATION_OFFER
                else:
                    notification_type = NotificationType.RENTAL_CONFLICT
                
                # Prepare context
                context = await self._build_conflict_context(conflict, transition_id)
                
                # Send notification
                request = NotificationRequest(
                    customer_id=conflict.customer_id,
                    notification_type=notification_type,
                    channel=NotificationChannel.EMAIL,
                    context=context,
                    priority=NotificationPriority.HIGH,
                    response_required=True,
                    response_deadline=datetime.utcnow() + timedelta(hours=48),
                    related_entity_id=conflict.id,
                    related_entity_type="sale_conflict"
                )
                
                result = await self.send_notification(request)
                
                if result.success:
                    notifications_sent += 1
                    customer_ids_notified.add(conflict.customer_id)
                else:
                    notifications_failed += 1
        
        return {
            "total_sent": notifications_sent,
            "total_failed": notifications_failed,
            "customers_notified": len(customer_ids_notified),
            "customer_ids": list(customer_ids_notified)
        }
    
    async def send_approval_notification(
        self,
        transition: SaleTransitionRequest,
        approver_id: UUID
    ) -> NotificationResult:
        """Send notification when transition is approved"""
        # Get transition details
        item = await self._get_item(transition.item_id)
        
        context = {
            "item_name": item.item_name if item else "Unknown",
            "sale_price": str(transition.sale_price),
            "effective_date": str(transition.effective_date or "Immediate"),
            "conflicts_resolved": "N/A",
            "customers_notified": "0"
        }
        
        request = NotificationRequest(
            customer_id=approver_id,  # Notify the approver
            notification_type=NotificationType.TRANSITION_APPROVED,
            channel=NotificationChannel.IN_APP,
            context=context,
            priority=NotificationPriority.LOW
        )
        
        return await self.send_notification(request)
    
    async def send_rollback_notifications(
        self,
        affected_bookings: List[UUID]
    ) -> Dict[str, Any]:
        """Send notifications when bookings are restored after rollback"""
        notifications_sent = 0
        
        for booking_id in affected_bookings:
            booking = await self._get_booking(booking_id)
            if booking:
                context = {
                    "booking_number": booking.booking_number,
                    "item_name": "Item",  # Would need to join with items
                    "pickup_date": str(booking.pickup_date),
                    "return_date": str(booking.return_date),
                    "total_amount": str(booking.total_amount),
                    "company_name": "Rental Company"
                }
                
                request = NotificationRequest(
                    customer_id=booking.customer_id,
                    notification_type=NotificationType.ROLLBACK_NOTIFICATION,
                    channel=NotificationChannel.EMAIL,
                    context=context,
                    priority=NotificationPriority.HIGH
                )
                
                result = await self.send_notification(request)
                if result.success:
                    notifications_sent += 1
        
        return {
            "total_sent": notifications_sent,
            "bookings_notified": len(affected_bookings)
        }
    
    async def check_notification_status(
        self,
        notification_id: UUID
    ) -> Dict[str, Any]:
        """Check the status of a notification"""
        query = select(SaleNotification).where(SaleNotification.id == notification_id)
        result = await self.session.execute(query)
        notification = result.scalar_one_or_none()
        
        if not notification:
            return {"found": False}
        
        return {
            "found": True,
            "id": notification.id,
            "status": notification.status,
            "sent_at": notification.sent_at,
            "delivered_at": notification.delivered_at,
            "read_at": notification.read_at,
            "response_received": notification.responded_at is not None,
            "customer_response": notification.customer_response
        }
    
    async def mark_notification_delivered(
        self,
        notification_id: UUID
    ) -> bool:
        """Mark a notification as delivered"""
        query = update(SaleNotification).where(
            SaleNotification.id == notification_id
        ).values(
            status=NotificationStatus.DELIVERED.value,
            delivered_at=datetime.utcnow()
        )
        
        await self.session.execute(query)
        await self.session.flush()
        return True
    
    async def mark_notification_read(
        self,
        notification_id: UUID
    ) -> bool:
        """Mark a notification as read"""
        query = update(SaleNotification).where(
            SaleNotification.id == notification_id
        ).values(
            status=NotificationStatus.READ.value,
            read_at=datetime.utcnow()
        )
        
        await self.session.execute(query)
        await self.session.flush()
        return True
    
    async def get_pending_notifications(self) -> List[SaleNotification]:
        """Get all pending notifications for processing"""
        query = select(SaleNotification).where(
            SaleNotification.status == NotificationStatus.PENDING.value
        ).order_by(SaleNotification.created_at)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def retry_failed_notifications(self) -> Dict[str, int]:
        """Retry sending failed notifications"""
        query = select(SaleNotification).where(
            and_(
                SaleNotification.status == NotificationStatus.FAILED.value,
                SaleNotification.created_at > datetime.utcnow() - timedelta(hours=24)
            )
        )
        
        result = await self.session.execute(query)
        failed_notifications = result.scalars().all()
        
        retry_count = 0
        success_count = 0
        
        for notification in failed_notifications:
            retry_count += 1
            
            # Recreate request from stored data
            request = NotificationRequest(
                customer_id=notification.customer_id,
                notification_type=NotificationType(notification.notification_type),
                channel=NotificationChannel(notification.channel),
                context=notification.content.get("context", {}),
                response_required=notification.response_required,
                response_deadline=notification.response_deadline
            )
            
            result = await self.send_notification(request)
            if result.success:
                success_count += 1
        
        return {
            "total_retried": retry_count,
            "successful": success_count,
            "failed": retry_count - success_count
        }
    
    # Private helper methods
    
    async def _get_customer(self, customer_id: UUID) -> Optional[Customer]:
        """Get customer by ID"""
        query = select(Customer).where(Customer.id == customer_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_item(self, item_id: UUID) -> Optional[Item]:
        """Get item by ID"""
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_booking(self, booking_id: UUID) -> Optional[BookingHeader]:
        """Get booking by ID"""
        query = select(BookingHeader).where(BookingHeader.id == booking_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _build_conflict_context(
        self,
        conflict: SaleConflict,
        transition_id: UUID
    ) -> Dict[str, Any]:
        """Build context for conflict notification"""
        context = {
            "conflict_type": conflict.conflict_type.value,
            "conflict_description": conflict.description,
            "financial_impact": str(conflict.financial_impact or 0),
            "company_name": "Rental Company",
            "contact_number": "1-800-RENTALS",
            "response_deadline": (datetime.utcnow() + timedelta(hours=48)).strftime("%Y-%m-%d %H:%M")
        }
        
        # Add entity-specific context
        if conflict.entity_type == "booking":
            booking = await self._get_booking(conflict.entity_id)
            if booking:
                context.update({
                    "booking_number": booking.booking_number,
                    "pickup_date": str(booking.pickup_date),
                    "return_date": str(booking.return_date),
                    "total_amount": str(booking.total_amount)
                })
        
        return context
    
    async def _send_via_channel(
        self,
        notification: SaleNotification,
        customer: Customer,
        rendered: Dict[str, str],
        channel: NotificationChannel
    ) -> Dict[str, Any]:
        """
        Send notification via specific channel
        
        This is where actual email/SMS providers would be integrated
        """
        if channel == NotificationChannel.EMAIL:
            return await self._send_email(
                customer.email,
                rendered["subject"],
                rendered["body"]
            )
        elif channel == NotificationChannel.SMS:
            return await self._send_sms(
                customer.phone,
                rendered["body"]
            )
        elif channel == NotificationChannel.IN_APP:
            return await self._send_in_app(
                customer.id,
                rendered["subject"],
                rendered["body"]
            )
        else:
            return {
                "success": False,
                "error": f"Channel {channel} not implemented"
            }
    
    async def _send_email(self, to: str, subject: str, body: str) -> Dict[str, Any]:
        """
        Send email notification
        
        Uses configured email provider from app.core.notifications
        """
        try:
            from app.core.notifications import notification_manager
            
            result = await notification_manager.send_email(
                to_email=to,
                subject=subject,
                body=body
            )
            
            if result["success"]:
                logger.info(f"Email sent to {to}: {subject}")
            else:
                logger.error(f"Failed to send email to {to}: {result.get('error')}")
            
            return result
            
        except ImportError:
            # Fallback to simulation if notification manager not available
            logger.warning("Notification manager not available, simulating email")
            await asyncio.sleep(0.1)  # Simulate network delay
            return {
                "success": True,
                "message": f"Email sent to {to} (simulated)"
            }
    
    async def _send_sms(self, to: str, message: str) -> Dict[str, Any]:
        """
        Send SMS notification
        
        Uses configured SMS provider from app.core.notifications
        """
        try:
            from app.core.notifications import notification_manager
            
            result = await notification_manager.send_sms(
                to_phone=to,
                message=message
            )
            
            if result["success"]:
                logger.info(f"SMS sent to {to}: {message[:50]}...")
            else:
                logger.error(f"Failed to send SMS to {to}: {result.get('error')}")
            
            return result
            
        except ImportError:
            # Fallback to simulation if notification manager not available
            logger.warning("Notification manager not available, simulating SMS")
            await asyncio.sleep(0.1)  # Simulate network delay
            return {
                "success": True,
                "message": f"SMS sent to {to} (simulated)"
            }
    
    async def _send_in_app(self, user_id: UUID, title: str, message: str) -> Dict[str, Any]:
        """
        Send in-app notification
        
        In production, this would:
        - Store in a notifications table
        - Send real-time update via WebSocket
        - Update notification badge count
        """
        logger.info(f"Creating in-app notification for user {user_id}")
        
        # In production, store in app notification system
        await asyncio.sleep(0.05)  # Simulate database write
        
        return {
            "success": True,
            "message": f"In-app notification created for user {user_id}"
        }