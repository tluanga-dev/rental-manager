"""
Failsafe Manager

Manages failsafe mechanisms for sale transitions including approval requirements,
rollback capability, and business rule validation.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
import json
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.modules.sales.models import (
    SaleTransitionRequest, TransitionCheckpoint, SaleTransitionAudit,
    TransitionStatus
)
from app.modules.sales.conflict_detection_engine import ConflictReport, ConflictSeverity
from app.modules.master_data.item_master.models import Item
from app.modules.users.models import User
from app.modules.transactions.base.models import TransactionLine
from app.modules.transactions.rentals.rental_booking.models import BookingHeader
import logging

logger = logging.getLogger(__name__)


@dataclass
class FailsafeConfiguration:
    """Configuration for failsafe thresholds"""
    revenue_threshold: Decimal = Decimal("1000.00")
    customer_threshold: int = 5
    item_value_threshold: Decimal = Decimal("5000.00")
    future_booking_days_threshold: int = 30
    rollback_window_hours: int = 24
    notification_grace_period_hours: int = 48
    require_approval_for_critical_conflicts: bool = True
    auto_approve_no_conflicts: bool = True
    
    @classmethod
    def default(cls):
        """Get default configuration"""
        return cls()
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        """Create configuration from dictionary"""
        return cls(**data)


@dataclass
class ApprovalReason:
    """Reason why approval is required"""
    type: str
    description: str
    threshold: Any
    actual_value: Any
    severity: str = "MEDIUM"


@dataclass
class ApprovalRequirement:
    """Approval requirement details"""
    required: bool
    reasons: List[ApprovalReason]
    approver_level: str
    urgency: str
    deadline: Optional[datetime] = None


@dataclass
class CheckpointData:
    """Data stored in a checkpoint for rollback"""
    item_state: Dict[str, Any]
    active_rentals: List[Dict[str, Any]]
    active_bookings: List[Dict[str, Any]]
    inventory_state: Dict[str, Any]
    timestamp: str


@dataclass
class RollbackResult:
    """Result of a rollback operation"""
    success: bool
    rollback_id: Optional[UUID]
    message: str
    items_restored: int = 0
    bookings_restored: int = 0
    errors: List[str] = None
    
    @classmethod
    def success_result(cls, rollback_id: UUID, items: int = 0, bookings: int = 0):
        return cls(
            success=True,
            rollback_id=rollback_id,
            message="Rollback completed successfully",
            items_restored=items,
            bookings_restored=bookings
        )
    
    @classmethod
    def failed_result(cls, error: str):
        return cls(
            success=False,
            rollback_id=None,
            message=f"Rollback failed: {error}",
            errors=[error]
        )


class FailsafeManager:
    """Manages failsafe mechanisms for sale transitions"""
    
    def __init__(self, session: AsyncSession, config: Optional[FailsafeConfiguration] = None):
        self.session = session
        self.config = config or FailsafeConfiguration.default()
    
    async def check_approval_requirements(
        self,
        item_id: UUID,
        conflicts: ConflictReport,
        user: User
    ) -> ApprovalRequirement:
        """
        Check if approval is required for the transition
        
        Args:
            item_id: Item being transitioned
            conflicts: Detected conflicts
            user: User initiating the transition
        
        Returns:
            ApprovalRequirement with details
        """
        reasons = []
        
        # Check revenue impact
        if conflicts.revenue_impact > self.config.revenue_threshold:
            reasons.append(ApprovalReason(
                type="REVENUE_IMPACT",
                description=f"Revenue impact ${conflicts.revenue_impact:.2f} exceeds threshold",
                threshold=self.config.revenue_threshold,
                actual_value=conflicts.revenue_impact,
                severity="HIGH"
            ))
        
        # Check customer impact
        affected_customers = len(conflicts.get_affected_customers())
        if affected_customers > self.config.customer_threshold:
            reasons.append(ApprovalReason(
                type="CUSTOMER_IMPACT",
                description=f"{affected_customers} customers affected exceeds threshold",
                threshold=self.config.customer_threshold,
                actual_value=affected_customers,
                severity="HIGH"
            ))
        
        # Check for critical conflicts
        critical_conflicts = [c for c in conflicts.conflicts if c.severity == ConflictSeverity.CRITICAL]
        if critical_conflicts and self.config.require_approval_for_critical_conflicts:
            reasons.append(ApprovalReason(
                type="CRITICAL_CONFLICTS",
                description=f"{len(critical_conflicts)} critical conflicts require approval",
                threshold=0,
                actual_value=len(critical_conflicts),
                severity="CRITICAL"
            ))
        
        # Check item value
        item = await self._get_item(item_id)
        if item and item.sale_price and item.sale_price > self.config.item_value_threshold:
            reasons.append(ApprovalReason(
                type="HIGH_VALUE_ITEM",
                description=f"Item value ${item.sale_price:.2f} requires approval",
                threshold=self.config.item_value_threshold,
                actual_value=item.sale_price,
                severity="MEDIUM"
            ))
        
        # Check user authority
        if not await self._user_has_authority(user, item):
            reasons.append(ApprovalReason(
                type="INSUFFICIENT_AUTHORITY",
                description="User lacks authority for this operation",
                threshold="MANAGER",
                actual_value=user.role.name if user.role else "USER",
                severity="HIGH"
            ))
        
        # Determine approver level
        approver_level = self._determine_approver_level(reasons)
        urgency = self._calculate_urgency(conflicts)
        
        return ApprovalRequirement(
            required=len(reasons) > 0,
            reasons=reasons,
            approver_level=approver_level,
            urgency=urgency,
            deadline=datetime.utcnow() + timedelta(hours=24) if reasons else None
        )
    
    async def create_checkpoint(self, item_id: UUID) -> TransitionCheckpoint:
        """
        Create a checkpoint for rollback capability
        
        Args:
            item_id: Item to checkpoint
        
        Returns:
            Created checkpoint
        """
        logger.info(f"Creating checkpoint for item {item_id}")
        
        # Capture current state
        item_state = await self._capture_item_state(item_id)
        active_rentals = await self._capture_active_rentals(item_id)
        active_bookings = await self._capture_active_bookings(item_id)
        inventory_state = await self._capture_inventory_state(item_id)
        
        checkpoint_data = CheckpointData(
            item_state=item_state,
            active_rentals=active_rentals,
            active_bookings=active_bookings,
            inventory_state=inventory_state,
            timestamp=datetime.utcnow().isoformat()
        )
        
        # Create checkpoint record
        checkpoint = TransitionCheckpoint(
            checkpoint_data=json.loads(json.dumps(checkpoint_data.__dict__, default=str)),
            expires_at=datetime.utcnow() + timedelta(hours=self.config.rollback_window_hours)
        )
        
        self.session.add(checkpoint)
        await self.session.flush()
        
        logger.info(f"Checkpoint {checkpoint.id} created for item {item_id}")
        return checkpoint
    
    async def rollback_to_checkpoint(
        self,
        checkpoint: TransitionCheckpoint,
        reason: str
    ) -> RollbackResult:
        """
        Rollback to a previous checkpoint
        
        Args:
            checkpoint: Checkpoint to rollback to
            reason: Reason for rollback
        
        Returns:
            RollbackResult
        """
        logger.info(f"Starting rollback to checkpoint {checkpoint.id}")
        
        if checkpoint.used:
            return RollbackResult.failed_result("Checkpoint already used")
        
        if checkpoint.expires_at and checkpoint.expires_at < datetime.utcnow():
            return RollbackResult.failed_result("Checkpoint expired")
        
        try:
            # Parse checkpoint data
            data = checkpoint.checkpoint_data
            
            # Restore item state
            item_id = UUID(data['item_state']['id'])
            await self._restore_item_state(item_id, data['item_state'])
            
            # Restore bookings
            bookings_restored = 0
            for booking_data in data['active_bookings']:
                if await self._restore_booking(booking_data):
                    bookings_restored += 1
            
            # Mark checkpoint as used
            checkpoint.used = True
            checkpoint.used_at = datetime.utcnow()
            
            # Create audit log
            await self._create_audit_log(
                action="ROLLBACK",
                details={
                    "checkpoint_id": str(checkpoint.id),
                    "reason": reason,
                    "bookings_restored": bookings_restored
                }
            )
            
            await self.session.flush()
            
            logger.info(f"Rollback completed successfully")
            return RollbackResult.success_result(
                rollback_id=checkpoint.id,
                items=1,
                bookings=bookings_restored
            )
            
        except Exception as e:
            logger.error(f"Rollback failed: {str(e)}")
            return RollbackResult.failed_result(str(e))
    
    async def validate_transition(
        self,
        transition_request: SaleTransitionRequest,
        conflicts: ConflictReport
    ) -> Dict[str, Any]:
        """
        Validate a transition request against business rules
        
        Args:
            transition_request: Transition to validate
            conflicts: Detected conflicts
        
        Returns:
            Validation result
        """
        validations = {
            "is_valid": True,
            "warnings": [],
            "errors": []
        }
        
        # Check if item is already for sale
        item = await self._get_item(transition_request.item_id)
        if item.is_saleable:
            validations["errors"].append("Item is already marked for sale")
            validations["is_valid"] = False
        
        # Check for active transitions
        existing = await self._check_existing_transitions(transition_request.item_id)
        if existing:
            validations["errors"].append("Another transition is already in progress")
            validations["is_valid"] = False
        
        # Validate price
        if transition_request.sale_price <= 0:
            validations["errors"].append("Sale price must be positive")
            validations["is_valid"] = False
        
        # Check conflict severity
        if conflicts.risk_score > 90:
            validations["warnings"].append("Very high risk transition")
        
        # Check effective date
        if transition_request.effective_date and transition_request.effective_date < datetime.utcnow().date():
            validations["errors"].append("Effective date cannot be in the past")
            validations["is_valid"] = False
        
        return validations
    
    async def can_rollback(self, transition_id: UUID) -> bool:
        """Check if a transition can be rolled back"""
        transition = await self._get_transition(transition_id)
        if not transition:
            return False
        
        # Check if already rolled back
        if transition.request_status == TransitionStatus.ROLLED_BACK:
            return False
        
        # Check if checkpoint exists and is valid
        checkpoint = await self._get_valid_checkpoint(transition_id)
        return checkpoint is not None
    
    # Private helper methods
    
    async def _get_item(self, item_id: UUID) -> Optional[Item]:
        """Get item by ID"""
        query = select(Item).where(Item.id == item_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _user_has_authority(self, user: User, item: Optional[Item]) -> bool:
        """Check if user has authority for the operation"""
        if not user.role:
            return False
        
        # Check role permissions
        if user.role.name in ["ADMIN", "MANAGER"]:
            return True
        
        # Additional checks based on item category, value, etc.
        return False
    
    def _determine_approver_level(self, reasons: List[ApprovalReason]) -> str:
        """Determine required approver level"""
        if any(r.severity == "CRITICAL" for r in reasons):
            return "SENIOR_MANAGER"
        elif any(r.severity == "HIGH" for r in reasons):
            return "MANAGER"
        else:
            return "SUPERVISOR"
    
    def _calculate_urgency(self, conflicts: ConflictReport) -> str:
        """Calculate urgency level"""
        if conflicts.risk_score > 80:
            return "URGENT"
        elif conflicts.risk_score > 50:
            return "HIGH"
        elif conflicts.risk_score > 20:
            return "MEDIUM"
        else:
            return "LOW"
    
    async def _capture_item_state(self, item_id: UUID) -> Dict[str, Any]:
        """Capture current item state"""
        item = await self._get_item(item_id)
        if not item:
            return {}
        
        return {
            "id": str(item.id),
            "is_saleable": item.is_saleable,
            "is_rentable": item.is_rentable,
            "sale_status": getattr(item, 'sale_status', None),
            "sale_price": float(item.sale_price) if item.sale_price else None,
            "status": item.item_status.value if item.item_status else None
        }
    
    async def _capture_active_rentals(self, item_id: UUID) -> List[Dict[str, Any]]:
        """Capture active rental information"""
        # Query active rentals
        query = select(TransactionLine).where(
            and_(
                TransactionLine.item_id == item_id,
                TransactionLine.rental_status.isnot(None)
            )
        )
        result = await self.session.execute(query)
        rentals = result.scalars().all()
        
        return [
            {
                "id": str(rental.id),
                "transaction_id": str(rental.transaction_id),
                "rental_status": rental.rental_status.value if rental.rental_status else None,
                "rental_end_date": rental.rental_end_date.isoformat() if rental.rental_end_date else None
            }
            for rental in rentals
        ]
    
    async def _capture_active_bookings(self, item_id: UUID) -> List[Dict[str, Any]]:
        """Capture active booking information"""
        from app.modules.transactions.rentals.rental_booking.models import BookingLine, BookingStatus
        
        query = select(BookingLine).join(BookingHeader).where(
            and_(
                BookingLine.item_id == item_id,
                BookingHeader.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
            )
        )
        result = await self.session.execute(query)
        bookings = result.scalars().all()
        
        return [
            {
                "id": str(booking.booking_id),
                "status": booking.booking.status.value,
                "customer_id": str(booking.booking.customer_id),
                "pickup_date": booking.booking.pickup_date.isoformat()
            }
            for booking in bookings
        ]
    
    async def _capture_inventory_state(self, item_id: UUID) -> Dict[str, Any]:
        """Capture inventory state"""
        from app.modules.inventory.models import StockLevel
        
        query = select(StockLevel).where(StockLevel.item_id == item_id)
        result = await self.session.execute(query)
        stock_levels = result.scalars().all()
        
        return {
            "stock_levels": [
                {
                    "location_id": str(sl.location_id),
                    "on_hand": sl.on_hand,
                    "available": sl.available,
                    "on_rent": sl.on_rent
                }
                for sl in stock_levels
            ]
        }
    
    async def _restore_item_state(self, item_id: UUID, state: Dict[str, Any]) -> bool:
        """Restore item to previous state"""
        item = await self._get_item(item_id)
        if not item:
            return False
        
        item.is_saleable = state.get('is_saleable', False)
        item.is_rentable = state.get('is_rentable', True)
        if hasattr(item, 'sale_status'):
            item.sale_status = state.get('sale_status', 'NOT_FOR_SALE')
        
        return True
    
    async def _restore_booking(self, booking_data: Dict[str, Any]) -> bool:
        """Restore a cancelled booking"""
        from app.modules.transactions.rentals.rental_booking.models import BookingHeader, BookingStatus
        
        booking_id = UUID(booking_data['id'])
        query = select(BookingHeader).where(BookingHeader.id == booking_id)
        result = await self.session.execute(query)
        booking = result.scalar_one_or_none()
        
        if booking and booking.status == BookingStatus.CANCELLED:
            # Restore to previous status
            booking.status = BookingStatus[booking_data['status']]
            if hasattr(booking, 'cancelled_due_to_sale'):
                booking.cancelled_due_to_sale = False
            return True
        
        return False
    
    async def _check_existing_transitions(self, item_id: UUID) -> bool:
        """Check if there are existing active transitions"""
        query = select(SaleTransitionRequest).where(
            and_(
                SaleTransitionRequest.item_id == item_id,
                SaleTransitionRequest.request_status.in_([
                    TransitionStatus.PENDING,
                    TransitionStatus.PROCESSING,
                    TransitionStatus.AWAITING_APPROVAL
                ])
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None
    
    async def _get_transition(self, transition_id: UUID) -> Optional[SaleTransitionRequest]:
        """Get transition by ID"""
        query = select(SaleTransitionRequest).where(SaleTransitionRequest.id == transition_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_valid_checkpoint(self, transition_id: UUID) -> Optional[TransitionCheckpoint]:
        """Get valid checkpoint for a transition"""
        query = select(TransitionCheckpoint).where(
            and_(
                TransitionCheckpoint.transition_request_id == transition_id,
                TransitionCheckpoint.used == False,
                or_(
                    TransitionCheckpoint.expires_at.is_(None),
                    TransitionCheckpoint.expires_at > datetime.utcnow()
                )
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _create_audit_log(self, action: str, details: Dict[str, Any]) -> None:
        """Create audit log entry"""
        audit = SaleTransitionAudit(
            action=action,
            details=details
        )
        self.session.add(audit)
        await self.session.flush()