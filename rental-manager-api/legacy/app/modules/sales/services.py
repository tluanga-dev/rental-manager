"""
Sale Transition Service

Main service layer for managing sale transitions with conflict resolution.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from app.modules.sales.models import (
    SaleTransitionRequest, SaleConflict, SaleResolution,
    TransitionStatus, ResolutionAction, ConflictType
)
from app.modules.sales.schemas import (
    SaleEligibilityResponse, SaleTransitionInitiateRequest,
    SaleTransitionResponse, TransitionConfirmationRequest,
    TransitionStatusResponse, RollbackRequest, RollbackResult,
    ConflictDetail, ConflictSummary, ApprovalReason,
    AffectedBooking, TransitionResult, TransitionStatusEnum,
    ConflictTypeEnum, ConflictSeverityEnum
)
from app.modules.sales.conflict_detection_engine import ConflictDetectionEngine
from app.modules.sales.failsafe_manager import FailsafeManager, FailsafeConfiguration
from app.modules.sales.notification_engine import NotificationEngine
from app.modules.master_data.item_master.models import Item
from app.modules.users.models import User
from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingStatus
from app.modules.customers.models import Customer
from app.shared.exceptions import NotFoundError, ValidationError, BusinessLogicError
import logging

logger = logging.getLogger(__name__)


class SaleTransitionService:
    """Main service for handling sale transitions"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.conflict_detector = ConflictDetectionEngine(session)
        self.failsafe_manager = FailsafeManager(session)
        self.notification_engine = NotificationEngine(session)
    
    async def check_sale_eligibility(
        self,
        item_id: UUID,
        user: User
    ) -> SaleEligibilityResponse:
        """
        Check if an item is eligible for sale transition
        
        Args:
            item_id: Item to check
            user: User making the request
        
        Returns:
            SaleEligibilityResponse with eligibility details
        """
        logger.info(f"Checking sale eligibility for item {item_id}")
        
        # Get item
        item = await self._get_item(item_id)
        if not item:
            raise NotFoundError(f"Item {item_id} not found")
        
        # Basic eligibility checks
        if item.is_saleable:
            return SaleEligibilityResponse(
                eligible=False,
                item_id=item_id,
                item_name=item.item_name,
                current_status=item.item_status.value if item.item_status else "UNKNOWN",
                conflicts=None,
                requires_approval=False,
                approval_reasons=None,
                revenue_impact=None,
                affected_customers=None,
                recommendation="Item is already marked for sale",
                warnings=["Item is already for sale"]
            )
        
        if not item.is_rentable:
            # If item is not rentable, it can be sold without conflicts
            return SaleEligibilityResponse(
                eligible=True,
                item_id=item_id,
                item_name=item.item_name,
                current_status=item.item_status.value if item.item_status else "UNKNOWN",
                conflicts=None,
                requires_approval=False,
                approval_reasons=None,
                revenue_impact=Decimal("0.00"),
                affected_customers=[],
                recommendation="Item can be marked for sale without conflicts",
                warnings=[]
            )
        
        # Detect conflicts
        conflict_report = await self.conflict_detector.detect_all_conflicts(item_id)
        
        # Check approval requirements
        approval_check = await self.failsafe_manager.check_approval_requirements(
            item_id, conflict_report, user
        )
        
        # Build conflict summary
        conflict_summary = None
        if conflict_report.has_conflicts:
            conflict_summary = ConflictSummary(
                total_conflicts=conflict_report.total_conflicts,
                by_type=self._group_conflicts_by_type(conflict_report.conflicts),
                by_severity=self._group_conflicts_by_severity(conflict_report.conflicts),
                total_revenue_impact=conflict_report.revenue_impact,
                affected_customers=len(conflict_report.get_affected_customers()),
                critical_conflicts=self._get_critical_conflicts(conflict_report.conflicts)
            )
        
        # Get affected customers
        affected_customers = []
        if conflict_report.has_conflicts:
            affected_customers = await self._get_affected_customers_details(
                conflict_report.get_affected_customers()
            )
        
        # Build warnings
        warnings = []
        if conflict_report.risk_score > 75:
            warnings.append("High risk transition - review carefully")
        if approval_check.required:
            warnings.append("Manager approval required")
        
        # Build approval reasons
        approval_reasons = None
        if approval_check.required:
            approval_reasons = [
                ApprovalReason(
                    type=reason.type,
                    description=reason.description,
                    threshold=reason.threshold,
                    actual_value=reason.actual_value
                )
                for reason in approval_check.reasons
            ]
        
        return SaleEligibilityResponse(
            eligible=True,
            item_id=item_id,
            item_name=item.item_name,
            current_status=item.item_status.value if item.item_status else "UNKNOWN",
            conflicts=conflict_summary,
            requires_approval=approval_check.required,
            approval_reasons=approval_reasons,
            revenue_impact=conflict_report.revenue_impact,
            affected_customers=affected_customers,
            recommendation=conflict_report.recommendation,
            warnings=warnings
        )
    
    async def initiate_sale_transition(
        self,
        item_id: UUID,
        request: SaleTransitionInitiateRequest,
        user: User
    ) -> SaleTransitionResponse:
        """
        Initiate a sale transition for an item
        
        Args:
            item_id: Item to transition
            request: Transition request details
            user: User initiating the transition
        
        Returns:
            SaleTransitionResponse
        """
        logger.info(f"Initiating sale transition for item {item_id} by user {user.id}")
        
        # Check eligibility
        eligibility = await self.check_sale_eligibility(item_id, user)
        if not eligibility.eligible:
            raise ValidationError(f"Item not eligible for sale: {eligibility.recommendation}")
        
        # Create transition request
        transition_request = SaleTransitionRequest(
            item_id=item_id,
            requested_by=user.id,
            sale_price=request.sale_price,
            effective_date=request.effective_date,
            request_status=TransitionStatus.PENDING
        )
        
        # Detect and save conflicts
        conflict_report = await self.conflict_detector.detect_all_conflicts(item_id)
        if conflict_report.has_conflicts:
            transition_request.conflict_summary = conflict_report.to_dict()
            transition_request.revenue_impact = conflict_report.revenue_impact
        
        # Check approval requirements
        approval_check = await self.failsafe_manager.check_approval_requirements(
            item_id, conflict_report, user
        )
        transition_request.approval_required = approval_check.required
        
        # Save transition request
        self.session.add(transition_request)
        await self.session.flush()
        
        # Save conflicts to database
        if conflict_report.has_conflicts:
            await self.conflict_detector.save_conflicts(
                transition_request.id,
                conflict_report.conflicts
            )
        
        # Create checkpoint for rollback
        checkpoint = await self.failsafe_manager.create_checkpoint(item_id)
        checkpoint.transition_request_id = transition_request.id
        await self.session.flush()
        
        # Determine response based on state
        if approval_check.required:
            transition_request.request_status = TransitionStatus.AWAITING_APPROVAL
            await self.session.flush()
            
            return SaleTransitionResponse(
                transition_id=transition_request.id,
                status=TransitionStatusEnum.AWAITING_APPROVAL,
                approval_request_id=transition_request.id,
                conflicts_found=conflict_report.total_conflicts,
                affected_customers=len(conflict_report.get_affected_customers()),
                message="Transition requires approval due to business rules",
                next_steps=["Wait for manager approval", "Monitor status"],
                completion_time=None
            )
        
        if not conflict_report.has_conflicts:
            # No conflicts, can complete immediately
            await self._complete_transition(transition_request)
            
            return SaleTransitionResponse(
                transition_id=transition_request.id,
                status=TransitionStatusEnum.COMPLETED,
                approval_request_id=None,
                conflicts_found=0,
                affected_customers=0,
                message="Item successfully marked for sale",
                next_steps=None,
                completion_time=datetime.utcnow()
            )
        
        # Has conflicts, needs confirmation
        return SaleTransitionResponse(
            transition_id=transition_request.id,
            status=TransitionStatusEnum.PENDING,
            approval_request_id=None,
            conflicts_found=conflict_report.total_conflicts,
            affected_customers=len(conflict_report.get_affected_customers()),
            message="Conflicts detected. Please review and confirm resolution strategy.",
            next_steps=[
                "Review detected conflicts",
                "Choose resolution strategy",
                "Confirm transition"
            ],
            completion_time=None
        )
    
    async def confirm_transition(
        self,
        transition_id: UUID,
        confirmation: TransitionConfirmationRequest,
        user: User
    ) -> TransitionResult:
        """
        Confirm and process a pending transition
        
        Args:
            transition_id: Transition to confirm
            confirmation: Confirmation details
            user: User confirming
        
        Returns:
            TransitionResult
        """
        logger.info(f"Confirming transition {transition_id}")
        
        # Get transition
        transition = await self._get_transition(transition_id)
        if not transition:
            raise NotFoundError(f"Transition {transition_id} not found")
        
        # Validate state
        if transition.request_status not in [TransitionStatus.PENDING, TransitionStatus.AWAITING_APPROVAL]:
            raise ValidationError(f"Cannot confirm transition in {transition.request_status.value} state")
        
        # Handle approval if needed
        if transition.request_status == TransitionStatus.AWAITING_APPROVAL:
            if not await self._user_can_approve(user, transition):
                raise ValidationError("User not authorized to approve this transition")
            
            transition.approved_by = user.id
            transition.approval_date = datetime.utcnow()
            transition.request_status = TransitionStatus.PROCESSING
        
        if not confirmation.confirmed:
            # User rejected the transition
            transition.request_status = TransitionStatus.REJECTED
            transition.rejection_reason = "User cancelled transition"
            await self.session.flush()
            
            return TransitionResult(
                success=False,
                transition_id=transition_id,
                status=TransitionStatusEnum.REJECTED,
                message="Transition cancelled by user",
                conflicts_resolved=0,
                customers_notified=0,
                completion_time=None,
                errors=None
            )
        
        # Process conflicts
        transition.request_status = TransitionStatus.PROCESSING
        await self.session.flush()
        
        try:
            # Get conflicts
            conflicts = await self._get_transition_conflicts(transition_id)
            
            # Process each conflict
            resolved_count = 0
            for conflict in conflicts:
                resolution_action = confirmation.resolution_overrides.get(
                    conflict.id,
                    ResolutionAction.WAIT_FOR_RETURN
                ) if confirmation.resolution_overrides else ResolutionAction.WAIT_FOR_RETURN
                
                await self._resolve_conflict(conflict, resolution_action, user)
                resolved_count += 1
            
            # Send notifications to affected customers
            notification_result = await self.notification_engine.notify_affected_customers(
                transition_id,
                conflicts,
                resolution_action
            )
            customers_notified = notification_result.get("customers_notified", 0)
            
            # Complete transition
            await self._complete_transition(transition)
            
            return TransitionResult(
                success=True,
                transition_id=transition_id,
                status=TransitionStatusEnum.COMPLETED,
                message="Transition completed successfully",
                conflicts_resolved=resolved_count,
                customers_notified=customers_notified,
                completion_time=datetime.utcnow(),
                errors=None
            )
            
        except Exception as e:
            logger.error(f"Error processing transition: {str(e)}")
            transition.request_status = TransitionStatus.FAILED
            await self.session.flush()
            
            return TransitionResult(
                success=False,
                transition_id=transition_id,
                status=TransitionStatusEnum.FAILED,
                message=f"Transition failed: {str(e)}",
                conflicts_resolved=0,
                customers_notified=0,
                completion_time=None,
                errors=[str(e)]
            )
    
    async def get_transition_status(self, transition_id: UUID) -> TransitionStatusResponse:
        """Get current status of a transition"""
        transition = await self._get_transition(transition_id)
        if not transition:
            raise NotFoundError(f"Transition {transition_id} not found")
        
        item = await self._get_item(transition.item_id)
        conflicts = await self._get_transition_conflicts(transition_id)
        
        resolved_count = sum(1 for c in conflicts if c.resolved)
        pending_count = len(conflicts) - resolved_count
        
        # Calculate progress
        if len(conflicts) == 0:
            progress = 100
        else:
            progress = int((resolved_count / len(conflicts)) * 100)
        
        # Determine current step
        current_step = self._get_current_step(transition.request_status)
        
        # Check rollback capability
        can_rollback = await self.failsafe_manager.can_rollback(transition_id)
        
        return TransitionStatusResponse(
            transition_id=transition_id,
            item_id=transition.item_id,
            item_name=item.item_name if item else "Unknown",
            status=TransitionStatusEnum(transition.request_status.value),
            progress_percentage=progress,
            current_step=current_step,
            conflicts_resolved=resolved_count,
            conflicts_pending=pending_count,
            notifications_sent=0,  # TODO: Implement notification tracking
            customer_responses=0,
            estimated_completion=None,
            can_rollback=can_rollback,
            rollback_deadline=None  # TODO: Calculate from checkpoint
        )
    
    async def rollback_transition(
        self,
        transition_id: UUID,
        reason: str,
        user: User
    ) -> RollbackResult:
        """Rollback a transition"""
        logger.info(f"Rolling back transition {transition_id}")
        
        transition = await self._get_transition(transition_id)
        if not transition:
            raise NotFoundError(f"Transition {transition_id} not found")
        
        # Get checkpoint
        checkpoint = await self._get_checkpoint(transition_id)
        if not checkpoint:
            raise ValidationError("No checkpoint available for rollback")
        
        # Perform rollback
        result = await self.failsafe_manager.rollback_to_checkpoint(checkpoint, reason)
        
        if result.success:
            transition.request_status = TransitionStatus.ROLLED_BACK
            await self.session.flush()
            
            # Send notifications about restored bookings
            if result.bookings_restored > 0:
                # Get restored booking IDs from checkpoint
                checkpoint_data = checkpoint.checkpoint_data
                booking_ids = [UUID(b["id"]) for b in checkpoint_data.get("active_bookings", [])]
                notification_result = await self.notification_engine.send_rollback_notifications(booking_ids)
                logger.info(f"Sent {notification_result['total_sent']} rollback notifications")
        
        return RollbackResult(
            success=result.success,
            rollback_id=result.rollback_id,
            items_restored=result.items_restored,
            bookings_restored=result.bookings_restored,
            notifications_sent=0,
            message=result.message,
            errors=result.errors
        )
    
    async def get_affected_bookings(self, transition_id: UUID) -> List[AffectedBooking]:
        """Get list of bookings affected by a transition"""
        conflicts = await self._get_transition_conflicts(transition_id)
        
        booking_conflicts = [
            c for c in conflicts 
            if c.conflict_type in [ConflictType.FUTURE_BOOKING, ConflictType.PENDING_BOOKING]
        ]
        
        affected_bookings = []
        for conflict in booking_conflicts:
            booking = await self._get_booking(conflict.entity_id)
            if booking:
                customer = await self._get_customer(booking.customer_id)
                
                affected_bookings.append(AffectedBooking(
                    booking_id=booking.id,
                    booking_reference=booking.booking_number,
                    customer_id=booking.customer_id,
                    customer_name=customer.name if customer else "Unknown",
                    customer_email=customer.email if customer else "",
                    pickup_date=booking.pickup_date,
                    return_date=booking.return_date,
                    item_quantity=1,  # TODO: Get from booking lines
                    booking_value=booking.total_amount,
                    status=booking.status.value,
                    resolution_action=conflict.resolution_action.value if conflict.resolution_action else None,
                    compensation_offered=None,  # TODO: Get from resolutions
                    alternative_offered=None
                ))
        
        return affected_bookings
    
    # Private helper methods
    
    async def _get_item(self, item_id: UUID) -> Optional[Item]:
        """Get item by ID"""
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_transition(self, transition_id: UUID) -> Optional[SaleTransitionRequest]:
        """Get transition by ID"""
        query = select(SaleTransitionRequest).where(SaleTransitionRequest.id == transition_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_transition_conflicts(self, transition_id: UUID) -> List[SaleConflict]:
        """Get conflicts for a transition"""
        query = select(SaleConflict).where(SaleConflict.transition_request_id == transition_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def _get_booking(self, booking_id: UUID) -> Optional[BookingHeader]:
        """Get booking by ID"""
        query = select(BookingHeader).where(BookingHeader.id == booking_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_customer(self, customer_id: UUID) -> Optional[Customer]:
        """Get customer by ID"""
        query = select(Customer).where(Customer.id == customer_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_checkpoint(self, transition_id: UUID):
        """Get checkpoint for a transition"""
        from app.modules.sales.models import TransitionCheckpoint
        
        query = select(TransitionCheckpoint).where(
            and_(
                TransitionCheckpoint.transition_request_id == transition_id,
                TransitionCheckpoint.used == False
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _complete_transition(self, transition: SaleTransitionRequest):
        """Complete a transition by marking item for sale"""
        item = await self._get_item(transition.item_id)
        if item:
            item.is_saleable = True
            item.is_rentable = False
            if hasattr(item, 'sale_status'):
                item.sale_status = 'FOR_SALE'
            if hasattr(item, 'sale_listed_at'):
                item.sale_listed_at = datetime.utcnow()
            if hasattr(item, 'sale_price_override'):
                item.sale_price_override = transition.sale_price
        
        transition.request_status = TransitionStatus.COMPLETED
        transition.completed_at = datetime.utcnow()
        await self.session.flush()
    
    async def _resolve_conflict(
        self,
        conflict: SaleConflict,
        action: ResolutionAction,
        user: User
    ):
        """Resolve a single conflict"""
        resolution = SaleResolution(
            conflict_id=conflict.id,
            action_taken=action,
            executed_by=user.id,
            execution_status="COMPLETED",
            executed_at=datetime.utcnow()
        )
        
        # Handle different resolution actions
        if action == ResolutionAction.CANCEL_BOOKING:
            await self._cancel_booking(conflict.entity_id)
        elif action == ResolutionAction.WAIT_FOR_RETURN:
            # No immediate action needed
            pass
        # Add more resolution handlers as needed
        
        conflict.resolved = True
        conflict.resolved_at = datetime.utcnow()
        conflict.resolution_action = action
        
        self.session.add(resolution)
        await self.session.flush()
    
    async def _cancel_booking(self, booking_id: UUID):
        """Cancel a booking"""
        booking = await self._get_booking(booking_id)
        if booking:
            booking.status = BookingStatus.CANCELLED
            if hasattr(booking, 'cancellation_reason'):
                booking.cancellation_reason = "Item marked for sale"
            if hasattr(booking, 'cancelled_due_to_sale'):
                booking.cancelled_due_to_sale = True
    
    async def _user_can_approve(self, user: User, transition: SaleTransitionRequest) -> bool:
        """Check if user can approve a transition"""
        if not user.role:
            return False
        return user.role.name in ["ADMIN", "MANAGER"]
    
    async def _get_affected_customers_details(self, customer_ids: List[UUID]) -> List[Dict[str, Any]]:
        """Get details of affected customers"""
        if not customer_ids:
            return []
        
        query = select(Customer).where(Customer.id.in_(customer_ids))
        result = await self.session.execute(query)
        customers = result.scalars().all()
        
        return [
            {
                "id": str(c.id),
                "name": c.name,
                "email": c.email,
                "phone": c.phone
            }
            for c in customers
        ]
    
    def _group_conflicts_by_type(self, conflicts) -> Dict[ConflictTypeEnum, int]:
        """Group conflicts by type"""
        groups = {}
        for conflict in conflicts:
            type_enum = ConflictTypeEnum(conflict.type.value)
            groups[type_enum] = groups.get(type_enum, 0) + 1
        return groups
    
    def _group_conflicts_by_severity(self, conflicts) -> Dict[ConflictSeverityEnum, int]:
        """Group conflicts by severity"""
        groups = {}
        for conflict in conflicts:
            severity_enum = ConflictSeverityEnum(conflict.severity.value)
            groups[severity_enum] = groups.get(severity_enum, 0) + 1
        return groups
    
    def _get_critical_conflicts(self, conflicts) -> List[ConflictDetail]:
        """Get critical conflicts as ConflictDetail objects"""
        from app.modules.sales.conflict_detection_engine import ConflictSeverity
        
        critical = [c for c in conflicts if c.severity == ConflictSeverity.CRITICAL]
        
        return [
            ConflictDetail(
                id=UUID('00000000-0000-0000-0000-000000000000'),  # Placeholder as conflicts don't have IDs yet
                conflict_type=ConflictTypeEnum(c.type.value),
                entity_type=c.entity_type,
                entity_id=c.entity_id,
                severity=ConflictSeverityEnum(c.severity.value),
                description=c.description,
                customer_id=c.customer_id,
                customer_name=None,
                financial_impact=c.financial_impact,
                detected_at=datetime.utcnow(),
                resolved=False,
                resolution_action=None,
                resolution_notes=None
            )
            for c in critical[:5]  # Limit to 5 critical conflicts
        ]
    
    def _get_current_step(self, status: TransitionStatus) -> str:
        """Get current step description"""
        steps = {
            TransitionStatus.PENDING: "Awaiting confirmation",
            TransitionStatus.PROCESSING: "Processing conflicts",
            TransitionStatus.AWAITING_APPROVAL: "Awaiting approval",
            TransitionStatus.APPROVED: "Approved, processing",
            TransitionStatus.COMPLETED: "Completed",
            TransitionStatus.FAILED: "Failed",
            TransitionStatus.REJECTED: "Rejected",
            TransitionStatus.ROLLED_BACK: "Rolled back"
        }
        return steps.get(status, "Unknown")