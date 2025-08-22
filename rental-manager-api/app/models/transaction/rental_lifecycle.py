"""
Rental lifecycle models for tracking rental operations and returns.
Migrated from legacy system with modern FastAPI patterns.
"""

from enum import Enum as PyEnum
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, date, timezone
from uuid import UUID

from sqlalchemy import (
    Column, String, Numeric, Boolean, Text, DateTime, Date, 
    ForeignKey, Integer, Index, JSON
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from .transaction_header import TransactionHeader
    from .transaction_line import TransactionLine


class ReturnEventType(str, PyEnum):
    """Types of return events."""
    PARTIAL_RETURN = "PARTIAL_RETURN"
    FULL_RETURN = "FULL_RETURN"
    EXTENSION = "EXTENSION"
    STATUS_CHANGE = "STATUS_CHANGE"


class InspectionCondition(str, PyEnum):
    """Item condition after inspection."""
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    DAMAGED = "DAMAGED"


class RentalStatusChangeReason(str, PyEnum):
    """Reasons for rental status changes."""
    SCHEDULED_UPDATE = "SCHEDULED_UPDATE"
    RETURN_EVENT = "RETURN_EVENT"
    MANUAL_UPDATE = "MANUAL_UPDATE"
    EXTENSION = "EXTENSION"
    LATE_FEE_APPLIED = "LATE_FEE_APPLIED"
    DAMAGE_ASSESSMENT = "DAMAGE_ASSESSMENT"


class RentalLifecycle(RentalManagerBaseModel):
    """
    Tracks the operational lifecycle of a rental transaction.
    
    This model separates rental operations from financial records,
    allowing for complex rental workflows while keeping transaction
    data clean and focused on financial aspects.
    """
    
    __tablename__ = "rental_lifecycles"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    transaction_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_headers.id", name="fk_rental_lifecycle_transaction"),
        nullable=False, unique=True,
        comment="Associated transaction"
    )
    
    # Status tracking
    current_status: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="Current rental status"
    )
    last_status_change: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Last status change timestamp"
    )
    status_changed_by: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="User who changed status"
    )
    
    # Return tracking
    total_returned_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Total quantity returned across all events"
    )
    expected_return_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Expected return date (may change with extensions)"
    )
    
    # Fee accumulation
    total_late_fees: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Accumulated late fees"
    )
    total_damage_fees: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Accumulated damage fees"
    )
    total_other_fees: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Other fees (cleaning, restocking, etc.)"
    )
    
    # Notes and metadata
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="General notes about the rental"
    )
    
    # Relationships
    transaction: Mapped["TransactionHeader"] = relationship(
        "TransactionHeader", back_populates="rental_lifecycle", lazy="select"
    )
    return_events: Mapped[List["RentalReturnEvent"]] = relationship(
        "RentalReturnEvent", back_populates="rental_lifecycle",
        lazy="select", cascade="all, delete-orphan"
    )
    status_logs: Mapped[List["RentalStatusLog"]] = relationship(
        "RentalStatusLog", back_populates="rental_lifecycle",
        lazy="select", cascade="all, delete-orphan"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_lifecycle_transaction", "transaction_id"),
        Index("idx_lifecycle_status", "current_status"),
        Index("idx_lifecycle_expected_return", "expected_return_date"),
    )
    
    def __init__(
        self,
        transaction_id: UUID,
        current_status: str,
        **kwargs
    ):
        """
        Initialize a Rental Lifecycle.
        
        Args:
            transaction_id: Associated transaction ID
            current_status: Current rental status
            **kwargs: Additional fields
        """
        super().__init__(**kwargs)
        self.transaction_id = transaction_id
        self.current_status = current_status
        self.last_status_change = self.last_status_change or datetime.now(timezone.utc)
        self._validate_business_rules()
    
    def _validate_business_rules(self):
        """Validate rental lifecycle data."""
        if not self.transaction_id:
            raise ValueError("Transaction ID is required")
        
        if not self.current_status or not self.current_status.strip():
            raise ValueError("Current status cannot be empty")
        
        if self.total_returned_quantity < 0:
            raise ValueError("Total returned quantity cannot be negative")
        
        if self.total_late_fees < 0:
            raise ValueError("Total late fees cannot be negative")
        
        if self.total_damage_fees < 0:
            raise ValueError("Total damage fees cannot be negative")
        
        if self.total_other_fees < 0:
            raise ValueError("Total other fees cannot be negative")
    
    def update_status(self, new_status: str, changed_by: Optional[UUID] = None):
        """Update the rental status."""
        self.current_status = new_status
        self.last_status_change = datetime.now(timezone.utc)
        self.status_changed_by = changed_by
        self.updated_at = datetime.now(timezone.utc)
    
    def add_fees(
        self,
        late_fees: Decimal = Decimal("0.00"),
        damage_fees: Decimal = Decimal("0.00"),
        other_fees: Decimal = Decimal("0.00")
    ):
        """Add fees to the rental."""
        if late_fees < 0 or damage_fees < 0 or other_fees < 0:
            raise ValueError("Fees cannot be negative")
        
        self.total_late_fees += late_fees
        self.total_damage_fees += damage_fees
        self.total_other_fees += other_fees
        self.updated_at = datetime.now(timezone.utc)
    
    @property
    def total_fees(self) -> Decimal:
        """Calculate total accumulated fees."""
        return self.total_late_fees + self.total_damage_fees + self.total_other_fees
    
    def __repr__(self) -> str:
        return f"<RentalLifecycle(id={self.id}, transaction_id={self.transaction_id}, status={self.current_status})>"


class RentalReturnEvent(RentalManagerBaseModel):
    """
    Records individual return events during the rental lifecycle.
    
    A rental may have multiple return events:
    - Partial returns (some items returned)
    - Extensions (changing return date)
    - Final return (completing the rental)
    """
    
    __tablename__ = "rental_return_events"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    rental_lifecycle_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("rental_lifecycles.id", name="fk_rental_return_event_lifecycle"),
        nullable=False,
        comment="Associated rental lifecycle"
    )
    
    # Event details
    event_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Type of return event"
    )
    event_date: Mapped[date] = mapped_column(
        Date, nullable=False,
        comment="Date of the event"
    )
    processed_by: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="User who processed this event"
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="When the event was processed"
    )
    
    # Return details (for return events)
    items_returned: Mapped[Optional[List[Dict]]] = mapped_column(
        JSON, nullable=True,
        comment="JSON array of returned items with quantities and conditions"
    )
    total_quantity_returned: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Total quantity returned in this event"
    )
    
    # Financial details
    late_fees_charged: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Late fees charged in this event"
    )
    damage_fees_charged: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Damage fees charged in this event"
    )
    other_fees_charged: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Other fees charged in this event"
    )
    payment_collected: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Payment collected during this event"
    )
    refund_issued: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Refund issued during this event"
    )
    
    # Extension details (for extension events)
    new_return_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="New return date for extensions"
    )
    extension_reason: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True,
        comment="Reason for extension"
    )
    
    # Notes and documentation
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Notes about this event"
    )
    receipt_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Receipt number for payments/refunds"
    )
    
    # Relationships
    rental_lifecycle: Mapped["RentalLifecycle"] = relationship(
        "RentalLifecycle", back_populates="return_events", lazy="select"
    )
    item_inspections: Mapped[List["RentalItemInspection"]] = relationship(
        "RentalItemInspection", back_populates="return_event",
        lazy="select", cascade="all, delete-orphan"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_return_event_lifecycle", "rental_lifecycle_id"),
        Index("idx_return_event_date", "event_date"),
        Index("idx_return_event_type", "event_type"),
        Index("idx_return_event_processed", "processed_at"),
    )
    
    @property
    def total_fees_charged(self) -> Decimal:
        """Calculate total fees charged in this event."""
        return self.late_fees_charged + self.damage_fees_charged + self.other_fees_charged
    
    @property
    def net_amount(self) -> Decimal:
        """Calculate net amount (payment collected minus refund issued)."""
        return self.payment_collected - self.refund_issued
    
    def __repr__(self) -> str:
        return f"<RentalReturnEvent(id={self.id}, type={self.event_type}, date={self.event_date})>"


class RentalItemInspection(RentalManagerBaseModel):
    """
    Records inspection details for individual items during returns.
    
    Each item returned gets inspected and its condition recorded.
    This enables per-item damage tracking and fee calculation.
    """
    
    __tablename__ = "rental_item_inspections"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    return_event_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("rental_return_events.id", name="fk_inspection_return_event"),
        nullable=False,
        comment="Associated return event"
    )
    transaction_line_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_lines.id", name="fk_inspection_transaction_line"),
        nullable=False,
        comment="Transaction line being inspected"
    )
    
    # Inspection details
    quantity_inspected: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False,
        comment="Quantity of this item inspected"
    )
    condition: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="Overall condition assessment"
    )
    inspected_by: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="User who performed inspection"
    )
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Inspection timestamp"
    )
    
    # Condition details
    has_damage: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether item has damage"
    )
    damage_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Description of any damage"
    )
    damage_photos: Mapped[Optional[List[str]]] = mapped_column(
        JSON, nullable=True,
        comment="JSON array of damage photo URLs"
    )
    
    # Financial impact
    damage_fee_assessed: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Damage fee assessed for this item"
    )
    cleaning_fee_assessed: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Cleaning fee assessed for this item"
    )
    replacement_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether item needs replacement"
    )
    replacement_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True,
        comment="Cost of replacement if required"
    )
    
    # Stock handling
    return_to_stock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Whether item can be returned to stock"
    )
    stock_location: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Where item was returned to stock"
    )
    
    # Notes
    inspection_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Detailed inspection notes"
    )
    
    # Relationships
    return_event: Mapped["RentalReturnEvent"] = relationship(
        "RentalReturnEvent", back_populates="item_inspections", lazy="select"
    )
    transaction_line: Mapped["TransactionLine"] = relationship(
        "TransactionLine", lazy="select"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_inspection_return_event", "return_event_id"),
        Index("idx_inspection_transaction_line", "transaction_line_id"),
        Index("idx_inspection_condition", "condition"),
        Index("idx_inspection_damage", "has_damage"),
    )
    
    @property
    def total_fees_assessed(self) -> Decimal:
        """Calculate total fees assessed for this inspection."""
        return self.damage_fee_assessed + self.cleaning_fee_assessed + (self.replacement_cost or 0)
    
    def __repr__(self) -> str:
        return f"<RentalItemInspection(id={self.id}, condition={self.condition}, quantity={self.quantity_inspected})>"


class RentalStatusLog(RentalManagerBaseModel):
    """
    Historical log of rental status changes for both headers and line items.
    
    Tracks all status transitions with context about why they occurred,
    enabling comprehensive audit trails and status history reporting.
    """
    
    __tablename__ = "rental_status_logs"
    
    # Entity identification
    transaction_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_headers.id", name="fk_status_log_transaction"),
        nullable=False,
        comment="Transaction being tracked"
    )
    transaction_line_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_lines.id", name="fk_status_log_line"),
        nullable=True,
        comment="Specific line item (null for header-level changes)"
    )
    rental_lifecycle_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("rental_lifecycles.id", name="fk_status_log_lifecycle"),
        nullable=True,
        comment="Associated rental lifecycle"
    )
    
    # Status change details
    old_status: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True,
        comment="Previous status (null for initial status)"
    )
    new_status: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="New status after change"
    )
    change_reason: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="Reason for the status change"
    )
    change_trigger: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="What triggered the change"
    )
    
    # Change context
    changed_by: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="User who initiated the change"
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="When the change occurred"
    )
    
    # Additional context
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Additional notes about the status change"
    )
    status_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True,
        comment="Additional context data"
    )
    
    # System tracking
    system_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether this change was system-generated"
    )
    batch_id: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Batch ID for scheduled updates"
    )
    
    # Relationships
    transaction: Mapped["TransactionHeader"] = relationship(
        "TransactionHeader", lazy="select"
    )
    transaction_line: Mapped[Optional["TransactionLine"]] = relationship(
        "TransactionLine", lazy="select"
    )
    rental_lifecycle: Mapped[Optional["RentalLifecycle"]] = relationship(
        "RentalLifecycle", back_populates="status_logs", lazy="select"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_status_log_transaction", "transaction_id"),
        Index("idx_status_log_line", "transaction_line_id"),
        Index("idx_status_log_changed_at", "changed_at"),
        Index("idx_status_log_reason", "change_reason"),
        Index("idx_status_log_batch", "batch_id"),
        Index("idx_status_log_system", "system_generated"),
    )
    
    @property
    def is_header_change(self) -> bool:
        """Check if this is a header-level status change."""
        return self.transaction_line_id is None
    
    @property
    def is_line_change(self) -> bool:
        """Check if this is a line-level status change."""
        return self.transaction_line_id is not None
    
    def __repr__(self) -> str:
        entity_type = "line" if self.transaction_line_id else "header"
        return f"<RentalStatusLog(id={self.id}, {entity_type}, {self.old_status}->{self.new_status})>"