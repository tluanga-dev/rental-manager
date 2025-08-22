"""
Sale Transition Models

Models for managing sale transitions with rental conflict management.
"""

from sqlalchemy import (
    Column, String, Boolean, Text, ForeignKey, 
    Numeric, Date, DateTime, Enum as SQLEnum, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.db.base import Base


class TransitionStatus(enum.Enum):
    """Status of a sale transition request"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class ConflictType(enum.Enum):
    """Types of conflicts that can prevent sale transition"""
    ACTIVE_RENTAL = "ACTIVE_RENTAL"
    FUTURE_BOOKING = "FUTURE_BOOKING"
    PENDING_BOOKING = "PENDING_BOOKING"
    MAINTENANCE_SCHEDULED = "MAINTENANCE_SCHEDULED"
    CROSS_LOCATION = "CROSS_LOCATION"


class ResolutionAction(enum.Enum):
    """Actions that can be taken to resolve conflicts"""
    CANCEL_BOOKING = "CANCEL_BOOKING"
    WAIT_FOR_RETURN = "WAIT_FOR_RETURN"
    TRANSFER_TO_ALTERNATIVE = "TRANSFER_TO_ALTERNATIVE"
    OFFER_COMPENSATION = "OFFER_COMPENSATION"
    POSTPONE_SALE = "POSTPONE_SALE"
    FORCE_SALE = "FORCE_SALE"


class ConflictSeverity(enum.Enum):
    """Severity levels for conflicts"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SaleTransitionRequest(Base):
    """Main table for tracking sale transition requests"""
    __tablename__ = "sale_transition_requests"
    
    item_id = Column(UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    request_status = Column(
        SQLEnum(TransitionStatus, name="transition_status"),
        nullable=False,
        default=TransitionStatus.PENDING
    )
    sale_price = Column(Numeric(10, 2), nullable=False)
    effective_date = Column(Date, nullable=True)
    conflict_summary = Column(JSON, nullable=True)
    revenue_impact = Column(Numeric(10, 2), nullable=True)
    approval_required = Column(Boolean, nullable=False, default=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approval_date = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    item = relationship("Item", backref="sale_transitions")
    requester = relationship("User", foreign_keys=[requested_by], backref="sale_requests")
    approver = relationship("User", foreign_keys=[approved_by], backref="sale_approvals")
    conflicts = relationship("SaleConflict", back_populates="transition_request", cascade="all, delete-orphan")
    checkpoints = relationship("TransitionCheckpoint", back_populates="transition_request", cascade="all, delete-orphan")
    audit_logs = relationship("SaleTransitionAudit", back_populates="transition_request", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<SaleTransitionRequest(id={self.id}, item_id={self.item_id}, status={self.request_status})>"


class SaleConflict(Base):
    """Table for tracking conflicts detected during sale transition"""
    __tablename__ = "sale_conflicts"
    
    transition_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_transition_requests.id", ondelete="CASCADE"),
        nullable=False
    )
    conflict_type = Column(
        SQLEnum(ConflictType, name="conflict_type"),
        nullable=False
    )
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    severity = Column(
        SQLEnum(ConflictSeverity, name="conflict_severity"),
        nullable=False
    )
    description = Column(Text, nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    financial_impact = Column(Numeric(10, 2), nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    resolved = Column(Boolean, nullable=False, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_action = Column(
        SQLEnum(ResolutionAction, name="resolution_action"),
        nullable=True
    )
    resolution_notes = Column(Text, nullable=True)
    
    # Relationships
    transition_request = relationship("SaleTransitionRequest", back_populates="conflicts")
    customer = relationship("Customer", backref="sale_conflicts")
    resolutions = relationship("SaleResolution", back_populates="conflict", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<SaleConflict(id={self.id}, type={self.conflict_type}, severity={self.severity})>"


class SaleResolution(Base):
    """Table for tracking conflict resolutions"""
    __tablename__ = "sale_resolutions"
    
    conflict_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_conflicts.id", ondelete="CASCADE"),
        nullable=False
    )
    action_taken = Column(
        SQLEnum(ResolutionAction, name="resolution_action"),
        nullable=False
    )
    executed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    execution_status = Column(String(50), nullable=False)
    customer_notified = Column(Boolean, nullable=False, default=False)
    customer_response = Column(String(50), nullable=True)
    compensation_amount = Column(Numeric(10, 2), nullable=True)
    alternative_item_id = Column(UUID(as_uuid=True), ForeignKey("items.id"), nullable=True)
    notes = Column(Text, nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conflict = relationship("SaleConflict", back_populates="resolutions")
    executor = relationship("User", backref="sale_resolutions")
    alternative_item = relationship("Item", backref="sale_resolution_alternatives")
    notifications = relationship("SaleNotification", back_populates="resolution", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<SaleResolution(id={self.id}, action={self.action_taken}, status={self.execution_status})>"


class SaleNotification(Base):
    """Table for tracking customer notifications"""
    __tablename__ = "sale_notifications"
    
    resolution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_resolutions.id"),
        nullable=True
    )
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    notification_type = Column(String(50), nullable=False)
    channel = Column(String(20), nullable=False)  # EMAIL, SMS, IN_APP
    status = Column(String(50), nullable=False)  # PENDING, SENT, DELIVERED, FAILED
    content = Column(JSON, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    response_required = Column(Boolean, nullable=False, default=False)
    response_deadline = Column(DateTime(timezone=True), nullable=True)
    customer_response = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    resolution = relationship("SaleResolution", back_populates="notifications")
    customer = relationship("Customer", backref="sale_notifications")
    
    def __repr__(self):
        return f"<SaleNotification(id={self.id}, type={self.notification_type}, status={self.status})>"


class TransitionCheckpoint(Base):
    """Table for storing checkpoints for rollback capability"""
    __tablename__ = "transition_checkpoints"
    
    transition_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_transition_requests.id"),
        nullable=False
    )
    checkpoint_data = Column(JSON, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    used = Column(Boolean, nullable=False, default=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    transition_request = relationship("SaleTransitionRequest", back_populates="checkpoints")
    
    def __repr__(self):
        return f"<TransitionCheckpoint(id={self.id}, used={self.used})>"


class SaleTransitionAudit(Base):
    """Audit log for all sale transition actions"""
    __tablename__ = "sale_transition_audit"
    
    transition_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sale_transition_requests.id"),
        nullable=True
    )
    action = Column(String(100), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Relationships
    transition_request = relationship("SaleTransitionRequest", back_populates="audit_logs")
    actor = relationship("User", backref="sale_transition_audits")
    
    def __repr__(self):
        return f"<SaleTransitionAudit(id={self.id}, action={self.action})>"