"""
Sale Transition Schemas

Pydantic schemas for sale transition request/response validation.
"""

from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from enum import Enum


class TransitionStatusEnum(str, Enum):
    """Status of a sale transition request"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class ConflictTypeEnum(str, Enum):
    """Types of conflicts"""
    ACTIVE_RENTAL = "ACTIVE_RENTAL"
    FUTURE_BOOKING = "FUTURE_BOOKING"
    PENDING_BOOKING = "PENDING_BOOKING"
    MAINTENANCE_SCHEDULED = "MAINTENANCE_SCHEDULED"
    CROSS_LOCATION = "CROSS_LOCATION"


class ResolutionActionEnum(str, Enum):
    """Resolution actions"""
    CANCEL_BOOKING = "CANCEL_BOOKING"
    WAIT_FOR_RETURN = "WAIT_FOR_RETURN"
    TRANSFER_TO_ALTERNATIVE = "TRANSFER_TO_ALTERNATIVE"
    OFFER_COMPENSATION = "OFFER_COMPENSATION"
    POSTPONE_SALE = "POSTPONE_SALE"
    FORCE_SALE = "FORCE_SALE"


class ConflictSeverityEnum(str, Enum):
    """Conflict severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Request Schemas
class SaleTransitionInitiateRequest(BaseModel):
    """Request to initiate a sale transition"""
    sale_price: Decimal = Field(..., gt=0, description="Sale price for the item")
    effective_date: Optional[date] = Field(None, description="Date when sale becomes effective")
    resolution_strategy: Optional[ResolutionActionEnum] = Field(
        ResolutionActionEnum.WAIT_FOR_RETURN,
        description="Default strategy for resolving conflicts"
    )
    notification_template: Optional[str] = Field(None, description="Template ID for notifications")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    
    model_config = ConfigDict(from_attributes=True)


class TransitionConfirmationRequest(BaseModel):
    """Request to confirm a pending transition"""
    confirmed: bool = Field(..., description="Whether to proceed with transition")
    resolution_overrides: Optional[Dict[UUID, ResolutionActionEnum]] = Field(
        None,
        description="Override resolution actions for specific conflicts"
    )
    notification_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Notification configuration"
    )
    manager_pin: Optional[str] = Field(None, description="Manager PIN for high-value items")
    
    model_config = ConfigDict(from_attributes=True)


class RollbackRequest(BaseModel):
    """Request to rollback a transition"""
    reason: str = Field(..., min_length=10, max_length=500, description="Reason for rollback")
    restore_bookings: bool = Field(True, description="Whether to restore cancelled bookings")
    
    model_config = ConfigDict(from_attributes=True)


class CustomerNotificationResponse(BaseModel):
    """Customer response to notification"""
    response: str = Field(..., description="ACCEPT, REJECT, REQUEST_ALTERNATIVE")
    feedback: Optional[str] = Field(None, max_length=500)
    preferred_alternative: Optional[UUID] = Field(None, description="Preferred alternative item")
    
    model_config = ConfigDict(from_attributes=True)


# Response Schemas
class ConflictDetail(BaseModel):
    """Detailed conflict information"""
    id: UUID
    conflict_type: ConflictTypeEnum
    entity_type: str
    entity_id: UUID
    severity: ConflictSeverityEnum
    description: str
    customer_id: Optional[UUID]
    customer_name: Optional[str]
    financial_impact: Optional[Decimal]
    detected_at: datetime
    resolved: bool
    resolution_action: Optional[ResolutionActionEnum]
    resolution_notes: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)


class ConflictSummary(BaseModel):
    """Summary of conflicts for an item"""
    total_conflicts: int
    by_type: Dict[ConflictTypeEnum, int]
    by_severity: Dict[ConflictSeverityEnum, int]
    total_revenue_impact: Decimal
    affected_customers: int
    critical_conflicts: List[ConflictDetail]
    
    model_config = ConfigDict(from_attributes=True)


class ApprovalReason(BaseModel):
    """Reason why approval is required"""
    type: str
    description: str
    threshold: Optional[Any]
    actual_value: Optional[Any]
    
    model_config = ConfigDict(from_attributes=True)


class SaleEligibilityResponse(BaseModel):
    """Response for sale eligibility check"""
    eligible: bool
    item_id: UUID
    item_name: str
    current_status: str
    conflicts: Optional[ConflictSummary]
    requires_approval: bool
    approval_reasons: Optional[List[ApprovalReason]]
    revenue_impact: Optional[Decimal]
    affected_customers: Optional[List[Dict[str, Any]]]
    recommendation: Optional[str]
    warnings: Optional[List[str]]
    
    model_config = ConfigDict(from_attributes=True)


class SaleTransitionResponse(BaseModel):
    """Response for sale transition initiation"""
    transition_id: UUID
    status: TransitionStatusEnum
    approval_request_id: Optional[UUID]
    conflicts_found: Optional[int]
    affected_customers: Optional[int]
    message: str
    next_steps: Optional[List[str]]
    completion_time: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)


class TransitionStatusResponse(BaseModel):
    """Current status of a transition"""
    transition_id: UUID
    item_id: UUID
    item_name: str
    status: TransitionStatusEnum
    progress_percentage: int
    current_step: str
    conflicts_resolved: int
    conflicts_pending: int
    notifications_sent: int
    customer_responses: int
    estimated_completion: Optional[datetime]
    can_rollback: bool
    rollback_deadline: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)


class ResolutionDetail(BaseModel):
    """Detail of a conflict resolution"""
    conflict_id: UUID
    action_taken: ResolutionActionEnum
    execution_status: str
    customer_notified: bool
    customer_response: Optional[str]
    compensation_amount: Optional[Decimal]
    alternative_item_id: Optional[UUID]
    notes: Optional[str]
    executed_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)


class NotificationDetail(BaseModel):
    """Detail of a notification"""
    id: UUID
    customer_id: UUID
    customer_name: str
    notification_type: str
    channel: str
    status: str
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    response_required: bool
    response_deadline: Optional[datetime]
    customer_response: Optional[str]
    responded_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)


class AffectedBooking(BaseModel):
    """Information about affected bookings"""
    booking_id: UUID
    booking_reference: str
    customer_id: UUID
    customer_name: str
    customer_email: str
    pickup_date: date
    return_date: date
    item_quantity: int
    booking_value: Decimal
    status: str
    resolution_action: Optional[ResolutionActionEnum]
    compensation_offered: Optional[Decimal]
    alternative_offered: Optional[Dict[str, Any]]
    
    model_config = ConfigDict(from_attributes=True)


class TransitionResult(BaseModel):
    """Result of a transition operation"""
    success: bool
    transition_id: UUID
    status: TransitionStatusEnum
    message: str
    conflicts_resolved: Optional[int]
    customers_notified: Optional[int]
    completion_time: Optional[datetime]
    errors: Optional[List[str]]
    
    model_config = ConfigDict(from_attributes=True)


class RollbackResult(BaseModel):
    """Result of a rollback operation"""
    success: bool
    rollback_id: UUID
    items_restored: int
    bookings_restored: int
    notifications_sent: int
    message: str
    errors: Optional[List[str]]
    
    model_config = ConfigDict(from_attributes=True)


class NotificationResponseResult(BaseModel):
    """Result of processing customer notification response"""
    success: bool
    notification_id: UUID
    action_taken: Optional[str]
    alternative_booking_id: Optional[UUID]
    compensation_processed: Optional[Decimal]
    message: str
    
    model_config = ConfigDict(from_attributes=True)


# Dashboard/Monitoring Schemas
class TransitionMetrics(BaseModel):
    """Metrics for transition monitoring"""
    active_transitions: int
    pending_approvals: int
    conflicts_detected_today: int
    conflicts_resolved_today: int
    average_resolution_time_hours: float
    customer_satisfaction_score: Optional[float]
    revenue_impact_today: Decimal
    successful_transitions_today: int
    failed_transitions_today: int
    rollbacks_today: int
    
    model_config = ConfigDict(from_attributes=True)


class TransitionListItem(BaseModel):
    """Item in transition list"""
    transition_id: UUID
    item_id: UUID
    item_name: str
    requested_by: str
    request_date: datetime
    status: TransitionStatusEnum
    conflicts: int
    revenue_impact: Optional[Decimal]
    approval_required: bool
    
    model_config = ConfigDict(from_attributes=True)


class PaginatedTransitions(BaseModel):
    """Paginated list of transitions"""
    items: List[TransitionListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    
    model_config = ConfigDict(from_attributes=True)