"""
Rental lifecycle models for tracking rental operations and returns.
"""

from enum import Enum as PyEnum
from typing import Optional, List, TYPE_CHECKING, Dict, Any
from decimal import Decimal
from datetime import datetime, date
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, Date, ForeignKey, Integer, Index, JSON
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from .transaction_headers import TransactionHeader
    from .transaction_lines import TransactionLine


class ReturnEventType(PyEnum):
    """Types of return events."""
    PARTIAL_RETURN = "PARTIAL_RETURN"
    FULL_RETURN = "FULL_RETURN"
    EXTENSION = "EXTENSION"
    STATUS_CHANGE = "STATUS_CHANGE"


class InspectionCondition(PyEnum):
    """Item condition after inspection."""
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    DAMAGED = "DAMAGED"


class RentalLifecycle(RentalManagerBaseModel):
    """
    Tracks the operational lifecycle of a rental transaction.
    
    This model separates rental operations from financial records,
    allowing for complex rental workflows while keeping transaction
    data clean and focused on financial aspects.
    """
    
    __tablename__ = "rental_lifecycles"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    transaction_id = Column(UUIDType(), ForeignKey("transaction_headers.id", name="fk_rental_lifecycle_transaction"), nullable=False, unique=True, comment="Associated transaction")
    
    # Status tracking
    current_status = Column(String(30), nullable=False, comment="Current rental status")
    last_status_change = Column(DateTime, nullable=False, default=datetime.utcnow, comment="Last status change timestamp")
    status_changed_by = Column(UUIDType(), nullable=True, comment="User who changed status")
    
    # Return tracking
    total_returned_quantity = Column(Numeric(10, 2), nullable=False, default=0, comment="Total quantity returned across all events")
    expected_return_date = Column(Date, nullable=True, comment="Expected return date (may change with extensions)")
    
    # Fee accumulation
    total_late_fees = Column(Numeric(15, 2), nullable=False, default=0, comment="Accumulated late fees")
    total_damage_fees = Column(Numeric(15, 2), nullable=False, default=0, comment="Accumulated damage fees")
    total_other_fees = Column(Numeric(15, 2), nullable=False, default=0, comment="Other fees (cleaning, restocking, etc.)")
    
    # Notes and metadata
    notes = Column(Text, nullable=True, comment="General notes about the rental")
    
    # Relationships
    transaction = relationship("TransactionHeader", back_populates="rental_lifecycle", lazy="select")
    return_events = relationship("RentalReturnEvent", back_populates="rental_lifecycle", lazy="select", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_lifecycle_transaction", "transaction_id"),
        Index("idx_lifecycle_status", "current_status"),
        Index("idx_lifecycle_expected_return", "expected_return_date"),
    )
    
    def __init__(
        self,
        transaction_id: str | UUID,
        current_status: str,
        last_status_change: Optional[datetime] = None,
        status_changed_by: Optional[str | UUID] = None,
        total_returned_quantity: Decimal = Decimal("0.00"),
        expected_return_date: Optional[date] = None,
        total_late_fees: Decimal = Decimal("0.00"),
        total_damage_fees: Decimal = Decimal("0.00"),
        total_other_fees: Decimal = Decimal("0.00"),
        notes: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Rental Lifecycle.
        
        Args:
            transaction_id: Associated transaction ID
            current_status: Current rental status
            last_status_change: Last status change timestamp
            status_changed_by: User who changed status
            total_returned_quantity: Total quantity returned across all events
            expected_return_date: Expected return date
            total_late_fees: Accumulated late fees
            total_damage_fees: Accumulated damage fees
            total_other_fees: Other fees
            notes: General notes about the rental
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.transaction_id = transaction_id
        self.current_status = current_status
        self.last_status_change = last_status_change or datetime.now(timezone.utc)
        self.status_changed_by = status_changed_by
        self.total_returned_quantity = total_returned_quantity
        self.expected_return_date = expected_return_date
        self.total_late_fees = total_late_fees
        self.total_damage_fees = total_damage_fees
        self.total_other_fees = total_other_fees
        self.notes = notes
        self._validate()
    
    def _validate(self):
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
    
    def update_status(self, new_status: str, changed_by: Optional[str | UUID] = None):
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
    
    def __repr__(self):
        return f"<RentalLifecycle(id={self.id}, transaction_id={self.transaction_id}, status={self.current_status})>"
    
    @property
    def total_fees(self):
        """Calculate total accumulated fees."""
        return self.total_late_fees + self.total_damage_fees + self.total_other_fees


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
    rental_lifecycle_id = Column(UUIDType(), ForeignKey("rental_lifecycles.id", name="fk_rental_status_log_lifecycle"), nullable=False, comment="Associated rental lifecycle")
    
    # Event details
    event_type = Column(String(20), nullable=False, comment="Type of return event")
    event_date = Column(Date, nullable=False, comment="Date of the event")
    processed_by = Column(UUIDType(), nullable=True, comment="User who processed this event")
    processed_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="When the event was processed")
    
    # Return details (for return events)
    items_returned = Column(JSON, nullable=True, comment="JSON array of returned items with quantities and conditions")
    total_quantity_returned = Column(Numeric(10, 2), nullable=False, default=0, comment="Total quantity returned in this event")
    
    # Financial details
    late_fees_charged = Column(Numeric(15, 2), nullable=False, default=0, comment="Late fees charged in this event")
    damage_fees_charged = Column(Numeric(15, 2), nullable=False, default=0, comment="Damage fees charged in this event")
    other_fees_charged = Column(Numeric(15, 2), nullable=False, default=0, comment="Other fees charged in this event")
    payment_collected = Column(Numeric(15, 2), nullable=False, default=0, comment="Payment collected during this event")
    refund_issued = Column(Numeric(15, 2), nullable=False, default=0, comment="Refund issued during this event")
    
    # Extension details (for extension events)
    new_return_date = Column(Date, nullable=True, comment="New return date for extensions")
    extension_reason = Column(String(200), nullable=True, comment="Reason for extension")
    
    # Notes and documentation
    notes = Column(Text, nullable=True, comment="Notes about this event")
    receipt_number = Column(String(50), nullable=True, comment="Receipt number for payments/refunds")
    
    # Relationships
    rental_lifecycle = relationship("RentalLifecycle", back_populates="return_events", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index("idx_return_event_lifecycle", "rental_lifecycle_id"),
        Index("idx_return_event_date", "event_date"),
        Index("idx_return_event_type", "event_type"),
        Index("idx_return_event_processed", "processed_at"),
    )
    
    def __init__(
        self,
        rental_lifecycle_id: str | UUID,
        event_type: str,
        event_date: date,
        processed_by: Optional[str | UUID] = None,
        processed_at: Optional[datetime] = None,
        items_returned: Optional[List[Dict]] = None,
        total_quantity_returned: Decimal = Decimal("0.00"),
        late_fees_charged: Decimal = Decimal("0.00"),
        damage_fees_charged: Decimal = Decimal("0.00"),
        other_fees_charged: Decimal = Decimal("0.00"),
        payment_collected: Decimal = Decimal("0.00"),
        refund_issued: Decimal = Decimal("0.00"),
        new_return_date: Optional[date] = None,
        extension_reason: Optional[str] = None,
        notes: Optional[str] = None,
        receipt_number: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Rental Return Event.
        
        Args:
            rental_lifecycle_id: Associated rental lifecycle ID
            event_type: Type of return event
            event_date: Date of the event
            processed_by: User who processed this event
            processed_at: When the event was processed
            items_returned: JSON array of returned items
            total_quantity_returned: Total quantity returned in this event
            late_fees_charged: Late fees charged in this event
            damage_fees_charged: Damage fees charged in this event
            other_fees_charged: Other fees charged in this event
            payment_collected: Payment collected during this event
            refund_issued: Refund issued during this event
            new_return_date: New return date for extensions
            extension_reason: Reason for extension
            notes: Notes about this event
            receipt_number: Receipt number for payments/refunds
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.rental_lifecycle_id = rental_lifecycle_id
        self.event_type = event_type
        self.event_date = event_date
        self.processed_by = processed_by
        self.processed_at = processed_at or datetime.now(timezone.utc)
        self.items_returned = items_returned or []
        self.total_quantity_returned = total_quantity_returned
        self.late_fees_charged = late_fees_charged
        self.damage_fees_charged = damage_fees_charged
        self.other_fees_charged = other_fees_charged
        self.payment_collected = payment_collected
        self.refund_issued = refund_issued
        self.new_return_date = new_return_date
        self.extension_reason = extension_reason
        self.notes = notes
        self.receipt_number = receipt_number
        self._validate()
    
    def _validate(self):
        """Validate return event data."""
        if not self.rental_lifecycle_id:
            raise ValueError("Rental lifecycle ID is required")
        
        if not self.event_type or not self.event_type.strip():
            raise ValueError("Event type cannot be empty")
        
        if self.total_quantity_returned < 0:
            raise ValueError("Total quantity returned cannot be negative")
        
        if self.late_fees_charged < 0:
            raise ValueError("Late fees charged cannot be negative")
        
        if self.damage_fees_charged < 0:
            raise ValueError("Damage fees charged cannot be negative")
        
        if self.other_fees_charged < 0:
            raise ValueError("Other fees charged cannot be negative")
        
        if self.payment_collected < 0:
            raise ValueError("Payment collected cannot be negative")
        
        if self.refund_issued < 0:
            raise ValueError("Refund issued cannot be negative")
    
    def __repr__(self):
        return f"<RentalReturnEvent(id={self.id}, type={self.event_type}, date={self.event_date})>"
    
    @property
    def total_fees_charged(self):
        """Calculate total fees charged in this event."""
        return self.late_fees_charged + self.damage_fees_charged + self.other_fees_charged
    
    @property
    def net_amount(self):
        """Calculate net amount (payment collected minus refund issued)."""
        return self.payment_collected - self.refund_issued


class RentalItemInspection(RentalManagerBaseModel):
    """
    Records inspection details for individual items during returns.
    
    Each item returned gets inspected and its condition recorded.
    This enables per-item damage tracking and fee calculation.
    """
    
    __tablename__ = "rental_item_inspections"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    return_event_id = Column(UUIDType(), ForeignKey("rental_return_events.id", name="fk_rental_item_inspection_return_event"), nullable=False, comment="Associated return event")
    transaction_line_id = Column(UUIDType(), ForeignKey("transaction_lines.id", name="fk_rental_item_inspection_transaction_line"), nullable=False, comment="Transaction line being inspected")
    
    # Inspection details
    quantity_inspected = Column(Numeric(10, 2), nullable=False, comment="Quantity of this item inspected")
    condition = Column(String(20), nullable=False, comment="Overall condition assessment")
    inspected_by = Column(UUIDType(), nullable=True, comment="User who performed inspection")
    inspected_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="Inspection timestamp")
    
    # Condition details
    has_damage = Column(Boolean, nullable=False, default=False, comment="Whether item has damage")
    damage_description = Column(Text, nullable=True, comment="Description of any damage")
    damage_photos = Column(JSON, nullable=True, comment="JSON array of damage photo URLs")
    
    # Financial impact
    damage_fee_assessed = Column(Numeric(15, 2), nullable=False, default=0, comment="Damage fee assessed for this item")
    cleaning_fee_assessed = Column(Numeric(15, 2), nullable=False, default=0, comment="Cleaning fee assessed for this item")
    replacement_required = Column(Boolean, nullable=False, default=False, comment="Whether item needs replacement")
    replacement_cost = Column(Numeric(15, 2), nullable=True, comment="Cost of replacement if required")
    
    # Stock handling
    return_to_stock = Column(Boolean, nullable=False, default=True, comment="Whether item can be returned to stock")
    stock_location = Column(String(100), nullable=True, comment="Where item was returned to stock")
    
    # Notes
    inspection_notes = Column(Text, nullable=True, comment="Detailed inspection notes")
    
    # Relationships
    return_event = relationship("RentalReturnEvent", lazy="select")
    transaction_line = relationship("TransactionLine", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index("idx_inspection_return_event", "return_event_id"),
        Index("idx_inspection_transaction_line", "transaction_line_id"),
        Index("idx_inspection_condition", "condition"),
        Index("idx_inspection_damage", "has_damage"),
    )
    
    def __init__(
        self,
        return_event_id: str | UUID,
        transaction_line_id: str | UUID,
        quantity_inspected: Decimal,
        condition: str,
        inspected_by: Optional[str | UUID] = None,
        inspected_at: Optional[datetime] = None,
        has_damage: bool = False,
        damage_description: Optional[str] = None,
        damage_photos: Optional[List[str]] = None,
        damage_fee_assessed: Decimal = Decimal("0.00"),
        cleaning_fee_assessed: Decimal = Decimal("0.00"),
        replacement_required: bool = False,
        replacement_cost: Optional[Decimal] = None,
        return_to_stock: bool = True,
        stock_location: Optional[str] = None,
        inspection_notes: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Rental Item Inspection.
        
        Args:
            return_event_id: Associated return event ID
            transaction_line_id: Transaction line being inspected
            quantity_inspected: Quantity of this item inspected
            condition: Overall condition assessment
            inspected_by: User who performed inspection
            inspected_at: Inspection timestamp
            has_damage: Whether item has damage
            damage_description: Description of any damage
            damage_photos: JSON array of damage photo URLs
            damage_fee_assessed: Damage fee assessed for this item
            cleaning_fee_assessed: Cleaning fee assessed for this item
            replacement_required: Whether item needs replacement
            replacement_cost: Cost of replacement if required
            return_to_stock: Whether item can be returned to stock
            stock_location: Where item was returned to stock
            inspection_notes: Detailed inspection notes
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.return_event_id = return_event_id
        self.transaction_line_id = transaction_line_id
        self.quantity_inspected = quantity_inspected
        self.condition = condition
        self.inspected_by = inspected_by
        self.inspected_at = inspected_at or datetime.now(timezone.utc)
        self.has_damage = has_damage
        self.damage_description = damage_description
        self.damage_photos = damage_photos or []
        self.damage_fee_assessed = damage_fee_assessed
        self.cleaning_fee_assessed = cleaning_fee_assessed
        self.replacement_required = replacement_required
        self.replacement_cost = replacement_cost
        self.return_to_stock = return_to_stock
        self.stock_location = stock_location
        self.inspection_notes = inspection_notes
        self._validate()
    
    def _validate(self):
        """Validate inspection data."""
        if not self.return_event_id:
            raise ValueError("Return event ID is required")
        
        if not self.transaction_line_id:
            raise ValueError("Transaction line ID is required")
        
        if self.quantity_inspected <= 0:
            raise ValueError("Quantity inspected must be positive")
        
        if not self.condition or not self.condition.strip():
            raise ValueError("Condition cannot be empty")
        
        if self.damage_fee_assessed < 0:
            raise ValueError("Damage fee assessed cannot be negative")
        
        if self.cleaning_fee_assessed < 0:
            raise ValueError("Cleaning fee assessed cannot be negative")
        
        if self.replacement_cost and self.replacement_cost < 0:
            raise ValueError("Replacement cost cannot be negative")
    
    def __repr__(self):
        return f"<RentalItemInspection(id={self.id}, condition={self.condition}, quantity={self.quantity_inspected})>"
    
    @property
    def total_fees_assessed(self):
        """Calculate total fees assessed for this inspection."""
        return self.damage_fee_assessed + self.cleaning_fee_assessed + (self.replacement_cost or 0)


class RentalStatusChangeReason(PyEnum):
    """Reasons for rental status changes."""
    SCHEDULED_UPDATE = "SCHEDULED_UPDATE"
    RETURN_EVENT = "RETURN_EVENT"
    MANUAL_UPDATE = "MANUAL_UPDATE"
    EXTENSION = "EXTENSION"
    LATE_FEE_APPLIED = "LATE_FEE_APPLIED"
    DAMAGE_ASSESSMENT = "DAMAGE_ASSESSMENT"


class RentalStatusLog(RentalManagerBaseModel):
    """
    Historical log of rental status changes for both headers and line items.
    
    Tracks all status transitions with context about why they occurred,
    enabling comprehensive audit trails and status history reporting.
    """
    
    __tablename__ = "rental_status_logs"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    
    # Entity identification
    transaction_id = Column(UUIDType(), ForeignKey("transaction_headers.id", name="fk_rental_status_log_transaction"), nullable=False, comment="Transaction being tracked")
    transaction_line_id = Column(UUIDType(), ForeignKey("transaction_lines.id", name="fk_rental_status_log_transaction_line"), nullable=True, comment="Specific line item (null for header-level changes)")
    rental_lifecycle_id = Column(UUIDType(), ForeignKey("rental_lifecycles.id", name="fk_rental_status_log_rental_lifecycle"), nullable=True, comment="Associated rental lifecycle")
    
    # Status change details
    old_status = Column(String(30), nullable=True, comment="Previous status (null for initial status)")
    new_status = Column(String(30), nullable=False, comment="New status after change")
    change_reason = Column(String(30), nullable=False, comment="Reason for the status change")
    change_trigger = Column(String(50), nullable=True, comment="What triggered the change (scheduled_job, return_event_id, etc.)")
    
    # Change context
    changed_by = Column(UUIDType(), nullable=True, comment="User who initiated the change (null for system changes)")
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow, comment="When the change occurred")
    
    # Additional context
    notes = Column(Text, nullable=True, comment="Additional notes about the status change")
    status_metadata = Column(JSON, nullable=True, comment="Additional context data (overdue days, return quantities, etc.)")
    
    # System tracking
    system_generated = Column(Boolean, nullable=False, default=False, comment="Whether this change was system-generated")
    batch_id = Column(String(50), nullable=True, comment="Batch ID for scheduled updates")
    
    # Relationships
    transaction = relationship("TransactionHeader", lazy="select")
    transaction_line = relationship("TransactionLine", lazy="select")
    rental_lifecycle = relationship("RentalLifecycle", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index("idx_status_log_transaction", "transaction_id"),
        Index("idx_status_log_line", "transaction_line_id"),
        Index("idx_status_log_changed_at", "changed_at"),
        Index("idx_status_log_reason", "change_reason"),
        Index("idx_status_log_batch", "batch_id"),
        Index("idx_status_log_system", "system_generated"),
    )
    
    def __init__(
        self,
        transaction_id: str | UUID,
        new_status: str,
        change_reason: str,
        transaction_line_id: Optional[str | UUID] = None,
        rental_lifecycle_id: Optional[str | UUID] = None,
        old_status: Optional[str] = None,
        change_trigger: Optional[str] = None,
        changed_by: Optional[str | UUID] = None,
        changed_at: Optional[datetime] = None,
        notes: Optional[str] = None,
        status_metadata: Optional[Dict[str, Any]] = None,
        system_generated: bool = False,
        batch_id: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Rental Status Log.
        
        Args:
            transaction_id: Transaction being tracked
            new_status: New status after change
            change_reason: Reason for the status change
            transaction_line_id: Specific line item (null for header-level changes)
            rental_lifecycle_id: Associated rental lifecycle
            old_status: Previous status (null for initial status)
            change_trigger: What triggered the change
            changed_by: User who initiated the change
            changed_at: When the change occurred
            notes: Additional notes about the status change
            status_metadata: Additional context data
            system_generated: Whether this change was system-generated
            batch_id: Batch ID for scheduled updates
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.transaction_id = transaction_id
        self.transaction_line_id = transaction_line_id
        self.rental_lifecycle_id = rental_lifecycle_id
        self.old_status = old_status
        self.new_status = new_status
        self.change_reason = change_reason
        self.change_trigger = change_trigger
        self.changed_by = changed_by
        self.changed_at = changed_at or datetime.now(timezone.utc)
        self.notes = notes
        self.status_metadata = status_metadata or {}
        self.system_generated = system_generated
        self.batch_id = batch_id
        self._validate()
    
    def _validate(self):
        """Validate status log data."""
        if not self.transaction_id:
            raise ValueError("Transaction ID is required")
        
        if not self.new_status or not self.new_status.strip():
            raise ValueError("New status cannot be empty")
        
        if not self.change_reason or not self.change_reason.strip():
            raise ValueError("Change reason cannot be empty")
    
    def __repr__(self):
        entity_type = "line" if self.transaction_line_id else "header"
        return f"<RentalStatusLog(id={self.id}, {entity_type}, {self.old_status}->{self.new_status})>"
    
    @property
    def is_header_change(self) -> bool:
        """Check if this is a header-level status change."""
        return self.transaction_line_id is None
    
    @property
    def is_line_change(self) -> bool:
        """Check if this is a line-level status change."""
        return self.transaction_line_id is not None