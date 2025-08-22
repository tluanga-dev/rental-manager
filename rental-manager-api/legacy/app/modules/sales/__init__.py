"""
Sales Transitions Module

This module handles sale transitions with rental conflict management.
It provides functionality to safely transition items from rental to sale status
while managing conflicts with active rentals and future bookings.

Features:
- Conflict detection (rentals, bookings, inventory)
- Approval workflows for high-value items
- Customer notification system
- Rollback capability with checkpoints
- Comprehensive audit logging
"""

from app.modules.sales.models import (
    SaleTransitionRequest,
    SaleConflict,
    SaleResolution,
    SaleNotification,
    TransitionCheckpoint,
    SaleTransitionAudit,
    TransitionStatus,
    ConflictType,
    ResolutionAction,
    ConflictSeverity
)

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
    PaginatedTransitions
)

from app.modules.sales.services import SaleTransitionService
from app.modules.sales.conflict_detection_engine import ConflictDetectionEngine
from app.modules.sales.failsafe_manager import FailsafeManager

__all__ = [
    # Models
    "SaleTransitionRequest",
    "SaleConflict",
    "SaleResolution",
    "SaleNotification",
    "TransitionCheckpoint",
    "SaleTransitionAudit",
    "TransitionStatus",
    "ConflictType",
    "ResolutionAction",
    "ConflictSeverity",
    # Schemas
    "SaleEligibilityResponse",
    "SaleTransitionInitiateRequest",
    "SaleTransitionResponse",
    "TransitionConfirmationRequest",
    "TransitionResult",
    "TransitionStatusResponse",
    "RollbackRequest",
    "RollbackResult",
    "AffectedBooking",
    "TransitionMetrics",
    "PaginatedTransitions",
    # Services
    "SaleTransitionService",
    "ConflictDetectionEngine",
    "FailsafeManager"
]