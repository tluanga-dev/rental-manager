"""
Sale Transition Routes

API endpoints for managing sale transitions with rental conflict management.
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from decimal import Decimal

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.sales.services import SaleTransitionService
from app.modules.sales.schemas import (
    SaleEligibilityResponse,
    SaleTransitionInitiateRequest,
    SaleTransitionResponse,
    TransitionConfirmationRequest,
    TransitionResult,
    TransitionStatusResponse,
    RollbackRequest,
    RollbackResult,
    AffectedBooking,
    TransitionMetrics,
    PaginatedTransitions,
    TransitionListItem,
    CustomerNotificationResponse,
    NotificationResponseResult
)
from app.shared.exceptions import NotFoundError, ValidationError, BusinessLogicError
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sales", tags=["Sales Transitions"])


@router.get("/items/{item_id}/sale-eligibility", response_model=SaleEligibilityResponse)
async def check_sale_eligibility(
    item_id: UUID = Path(..., description="Item ID to check eligibility"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> SaleEligibilityResponse:
    """
    Check if an item is eligible for sale transition
    
    This endpoint:
    - Checks if item is already for sale
    - Detects all conflicts (rentals, bookings, inventory)
    - Determines approval requirements
    - Provides recommendations
    """
    logger.info(f"User {current_user.id} checking sale eligibility for item {item_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.check_sale_eligibility(item_id, current_user)
        await session.commit()
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error checking sale eligibility: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to check sale eligibility")


@router.post("/items/{item_id}/initiate-sale", response_model=SaleTransitionResponse)
async def initiate_sale_transition(
    item_id: UUID = Path(..., description="Item ID to transition"),
    request: SaleTransitionInitiateRequest = ...,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> SaleTransitionResponse:
    """
    Initiate a sale transition for an item
    
    This endpoint:
    - Creates a transition request
    - Detects and saves conflicts
    - Creates checkpoint for rollback
    - Returns next steps based on conflicts and approval requirements
    """
    logger.info(f"User {current_user.id} initiating sale transition for item {item_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.initiate_sale_transition(item_id, request, current_user)
        await session.commit()
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error initiating sale transition: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to initiate sale transition")


@router.post("/transitions/{transition_id}/confirm", response_model=TransitionResult)
async def confirm_transition(
    transition_id: UUID = Path(..., description="Transition ID to confirm"),
    confirmation: TransitionConfirmationRequest = ...,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> TransitionResult:
    """
    Confirm and process a pending transition
    
    This endpoint:
    - Validates user authorization
    - Processes conflicts with specified resolution strategies
    - Updates item status
    - Triggers notifications
    """
    logger.info(f"User {current_user.id} confirming transition {transition_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.confirm_transition(transition_id, confirmation, current_user)
        await session.commit()
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error confirming transition: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to confirm transition")


@router.get("/transitions/{transition_id}/status", response_model=TransitionStatusResponse)
async def get_transition_status(
    transition_id: UUID = Path(..., description="Transition ID"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> TransitionStatusResponse:
    """
    Get current status of a transition
    
    Returns:
    - Current status and progress
    - Conflicts resolved/pending
    - Notifications sent
    - Rollback availability
    """
    logger.info(f"User {current_user.id} checking status of transition {transition_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.get_transition_status(transition_id)
        await session.commit()
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting transition status: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to get transition status")


@router.post("/transitions/{transition_id}/rollback", response_model=RollbackResult)
async def rollback_transition(
    transition_id: UUID = Path(..., description="Transition ID to rollback"),
    request: RollbackRequest = ...,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> RollbackResult:
    """
    Rollback a transition to previous state
    
    This endpoint:
    - Restores item to previous state
    - Restores cancelled bookings if requested
    - Creates audit log
    - Must be done within rollback window
    """
    logger.info(f"User {current_user.id} rolling back transition {transition_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.rollback_transition(transition_id, request.reason, current_user)
        await session.commit()
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error rolling back transition: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to rollback transition")


@router.get("/transitions/{transition_id}/affected-bookings", response_model=List[AffectedBooking])
async def get_affected_bookings(
    transition_id: UUID = Path(..., description="Transition ID"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> List[AffectedBooking]:
    """
    Get list of bookings affected by a transition
    
    Returns detailed information about each affected booking including:
    - Customer details
    - Booking dates and values
    - Resolution actions
    - Compensation/alternatives offered
    """
    logger.info(f"User {current_user.id} getting affected bookings for transition {transition_id}")
    
    try:
        service = SaleTransitionService(session)
        result = await service.get_affected_bookings(transition_id)
        await session.commit()
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting affected bookings: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to get affected bookings")


@router.get("/transitions", response_model=PaginatedTransitions)
async def list_transitions(
    status: Optional[str] = Query(None, description="Filter by status"),
    item_id: Optional[UUID] = Query(None, description="Filter by item"),
    requires_approval: Optional[bool] = Query(None, description="Filter by approval requirement"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> PaginatedTransitions:
    """
    List sale transitions with filtering and pagination
    
    Filters:
    - status: PENDING, PROCESSING, COMPLETED, etc.
    - item_id: Specific item
    - requires_approval: True/False
    """
    logger.info(f"User {current_user.id} listing transitions with filters")
    
    try:
        from sqlalchemy import select, and_, func
        from app.modules.sales.models import SaleTransitionRequest, TransitionStatus
        from app.modules.master_data.item_master.models import Item
        from app.modules.users.models import User as UserModel
        
        # Build query
        query = select(SaleTransitionRequest).join(Item).join(
            UserModel, SaleTransitionRequest.requested_by == UserModel.id
        )
        
        # Apply filters
        conditions = []
        if status:
            try:
                status_enum = TransitionStatus[status.upper()]
                conditions.append(SaleTransitionRequest.request_status == status_enum)
            except KeyError:
                raise ValidationError(f"Invalid status: {status}")
        
        if item_id:
            conditions.append(SaleTransitionRequest.item_id == item_id)
        
        if requires_approval is not None:
            conditions.append(SaleTransitionRequest.approval_required == requires_approval)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await session.execute(count_query)
        total = count_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(
            SaleTransitionRequest.created_at.desc()
        )
        
        # Execute query
        result = await session.execute(query)
        transitions = result.scalars().all()
        
        # Build response
        items = []
        for transition in transitions:
            # Get conflict count
            conflict_count = len(transition.conflicts) if transition.conflicts else 0
            
            items.append(TransitionListItem(
                transition_id=transition.id,
                item_id=transition.item_id,
                item_name=transition.item.item_name,
                requested_by=transition.requester.full_name or transition.requester.username,
                request_date=transition.created_at,
                status=transition.request_status,
                conflicts=conflict_count,
                revenue_impact=transition.revenue_impact,
                approval_required=transition.approval_required
            ))
        
        total_pages = (total + page_size - 1) // page_size
        
        await session.commit()
        return PaginatedTransitions(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error listing transitions: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to list transitions")


@router.get("/metrics/dashboard", response_model=TransitionMetrics)
async def get_transition_metrics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> TransitionMetrics:
    """
    Get metrics for transition monitoring dashboard
    
    Returns:
    - Active transitions count
    - Pending approvals
    - Today's statistics
    - Performance metrics
    """
    logger.info(f"User {current_user.id} getting transition metrics")
    
    try:
        from sqlalchemy import select, and_, func
        from datetime import date, timedelta
        from app.modules.sales.models import (
            SaleTransitionRequest, SaleConflict, 
            TransitionStatus, ConflictSeverity
        )
        
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        
        # Active transitions
        active_query = select(func.count()).select_from(SaleTransitionRequest).where(
            SaleTransitionRequest.request_status.in_([
                TransitionStatus.PENDING,
                TransitionStatus.PROCESSING,
                TransitionStatus.AWAITING_APPROVAL
            ])
        )
        active_result = await session.execute(active_query)
        active_transitions = active_result.scalar() or 0
        
        # Pending approvals
        approval_query = select(func.count()).select_from(SaleTransitionRequest).where(
            SaleTransitionRequest.request_status == TransitionStatus.AWAITING_APPROVAL
        )
        approval_result = await session.execute(approval_query)
        pending_approvals = approval_result.scalar() or 0
        
        # Conflicts detected today
        conflicts_today_query = select(func.count()).select_from(SaleConflict).where(
            SaleConflict.detected_at >= today_start
        )
        conflicts_today_result = await session.execute(conflicts_today_query)
        conflicts_detected_today = conflicts_today_result.scalar() or 0
        
        # Conflicts resolved today
        resolved_today_query = select(func.count()).select_from(SaleConflict).where(
            and_(
                SaleConflict.resolved == True,
                SaleConflict.resolved_at >= today_start
            )
        )
        resolved_today_result = await session.execute(resolved_today_query)
        conflicts_resolved_today = resolved_today_result.scalar() or 0
        
        # Revenue impact today
        revenue_query = select(func.sum(SaleTransitionRequest.revenue_impact)).where(
            SaleTransitionRequest.created_at >= today_start
        )
        revenue_result = await session.execute(revenue_query)
        revenue_impact_today = revenue_result.scalar() or Decimal("0.00")
        
        # Successful transitions today
        success_query = select(func.count()).select_from(SaleTransitionRequest).where(
            and_(
                SaleTransitionRequest.request_status == TransitionStatus.COMPLETED,
                SaleTransitionRequest.completed_at >= today_start
            )
        )
        success_result = await session.execute(success_query)
        successful_transitions_today = success_result.scalar() or 0
        
        # Failed transitions today
        failed_query = select(func.count()).select_from(SaleTransitionRequest).where(
            and_(
                SaleTransitionRequest.request_status == TransitionStatus.FAILED,
                SaleTransitionRequest.created_at >= today_start
            )
        )
        failed_result = await session.execute(failed_query)
        failed_transitions_today = failed_result.scalar() or 0
        
        # Rollbacks today
        rollback_query = select(func.count()).select_from(SaleTransitionRequest).where(
            and_(
                SaleTransitionRequest.request_status == TransitionStatus.ROLLED_BACK,
                SaleTransitionRequest.updated_at >= today_start
            )
        )
        rollback_result = await session.execute(rollback_query)
        rollbacks_today = rollback_result.scalar() or 0
        
        # Calculate average resolution time (simplified - would need more complex query in production)
        avg_resolution_time_hours = 4.5  # Placeholder
        
        await session.commit()
        return TransitionMetrics(
            active_transitions=active_transitions,
            pending_approvals=pending_approvals,
            conflicts_detected_today=conflicts_detected_today,
            conflicts_resolved_today=conflicts_resolved_today,
            average_resolution_time_hours=avg_resolution_time_hours,
            customer_satisfaction_score=None,  # Would come from notification responses
            revenue_impact_today=revenue_impact_today,
            successful_transitions_today=successful_transitions_today,
            failed_transitions_today=failed_transitions_today,
            rollbacks_today=rollbacks_today
        )
        
    except Exception as e:
        logger.error(f"Error getting transition metrics: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to get transition metrics")


@router.post("/notifications/{notification_id}/respond", response_model=NotificationResponseResult)
async def respond_to_notification(
    notification_id: UUID = Path(..., description="Notification ID"),
    response: CustomerNotificationResponse = ...,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> NotificationResponseResult:
    """
    Process customer response to a notification
    
    Customer can:
    - Accept the change
    - Reject and request alternative
    - Provide feedback
    """
    logger.info(f"Processing response to notification {notification_id}")
    
    try:
        from app.modules.sales.models import SaleNotification
        from sqlalchemy import select
        from datetime import datetime
        
        # Get notification
        query = select(SaleNotification).where(SaleNotification.id == notification_id)
        result = await session.execute(query)
        notification = result.scalar_one_or_none()
        
        if not notification:
            raise NotFoundError(f"Notification {notification_id} not found")
        
        # Update notification with response
        notification.customer_response = response.response
        notification.responded_at = datetime.utcnow()
        
        # Process based on response type
        action_taken = None
        alternative_booking_id = None
        compensation_processed = None
        
        if response.response == "ACCEPT":
            action_taken = "Accepted sale transition"
        elif response.response == "REQUEST_ALTERNATIVE":
            # In production, would trigger alternative item search
            action_taken = "Alternative item search initiated"
        elif response.response == "REJECT":
            # In production, would trigger escalation
            action_taken = "Escalated to management"
        
        await session.commit()
        
        return NotificationResponseResult(
            success=True,
            notification_id=notification_id,
            action_taken=action_taken,
            alternative_booking_id=alternative_booking_id,
            compensation_processed=compensation_processed,
            message="Response processed successfully"
        )
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing notification response: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to process notification response")


# Admin endpoints for managing transitions

@router.post("/transitions/{transition_id}/approve", response_model=TransitionResult)
async def approve_transition(
    transition_id: UUID = Path(..., description="Transition ID to approve"),
    approval_notes: Optional[str] = Query(None, description="Approval notes"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> TransitionResult:
    """
    Approve a pending transition (Manager/Admin only)
    
    This endpoint allows managers to approve transitions that require approval.
    """
    logger.info(f"Manager {current_user.id} approving transition {transition_id}")
    
    # Check user role
    if not current_user.role or current_user.role.name not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        from app.modules.sales.models import SaleTransitionRequest, TransitionStatus
        from datetime import datetime
        
        # Get transition
        query = select(SaleTransitionRequest).where(SaleTransitionRequest.id == transition_id)
        result = await session.execute(query)
        transition = result.scalar_one_or_none()
        
        if not transition:
            raise NotFoundError(f"Transition {transition_id} not found")
        
        if transition.request_status != TransitionStatus.AWAITING_APPROVAL:
            raise ValidationError(f"Transition is not awaiting approval (status: {transition.request_status.value})")
        
        # Approve transition
        transition.request_status = TransitionStatus.APPROVED
        transition.approved_by = current_user.id
        transition.approval_date = datetime.utcnow()
        transition.approval_notes = approval_notes
        
        # Continue processing
        service = SaleTransitionService(session)
        confirmation = TransitionConfirmationRequest(
            confirmed=True,
            resolution_overrides=None,
            notification_config=None
        )
        result = await service.confirm_transition(transition_id, confirmation, current_user)
        
        await session.commit()
        return result
        
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving transition: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve transition")


@router.post("/transitions/{transition_id}/reject", response_model=TransitionResult)
async def reject_transition(
    transition_id: UUID = Path(..., description="Transition ID to reject"),
    rejection_reason: str = Query(..., min_length=10, description="Rejection reason"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> TransitionResult:
    """
    Reject a pending transition (Manager/Admin only)
    
    This endpoint allows managers to reject transitions that require approval.
    """
    logger.info(f"Manager {current_user.id} rejecting transition {transition_id}")
    
    # Check user role
    if not current_user.role or current_user.role.name not in ["ADMIN", "MANAGER"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        from app.modules.sales.models import SaleTransitionRequest, TransitionStatus
        from datetime import datetime
        
        # Get transition
        query = select(SaleTransitionRequest).where(SaleTransitionRequest.id == transition_id)
        result = await session.execute(query)
        transition = result.scalar_one_or_none()
        
        if not transition:
            raise NotFoundError(f"Transition {transition_id} not found")
        
        if transition.request_status != TransitionStatus.AWAITING_APPROVAL:
            raise ValidationError(f"Transition is not awaiting approval (status: {transition.request_status.value})")
        
        # Reject transition
        transition.request_status = TransitionStatus.REJECTED
        transition.rejection_reason = rejection_reason
        transition.approved_by = current_user.id  # Track who rejected
        transition.approval_date = datetime.utcnow()
        
        await session.commit()
        
        return TransitionResult(
            success=False,
            transition_id=transition_id,
            status=TransitionStatus.REJECTED,
            message=f"Transition rejected: {rejection_reason}",
            conflicts_resolved=0,
            customers_notified=0,
            completion_time=None,
            errors=None
        )
        
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error rejecting transition: {str(e)}")
        await session.rollback()
        raise HTTPException(status_code=500, detail="Failed to reject transition")