"""
Transaction Inspection model - inspection records for returned items.
Tracks condition assessment, damage, and return-to-stock decisions.
"""

from enum import Enum as PyEnum
from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import (
    Column, String, Text, Numeric, DateTime, Boolean, 
    ForeignKey, Enum, Index, CheckConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from .transaction_line import TransactionLine
    from app.models.user import User


# Inspection Status Enum
class InspectionStatus(str, PyEnum):
    """Status of the inspection process."""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# Condition Rating Enum
class ConditionRating(str, PyEnum):
    """Condition rating for returned items."""
    A = "A"  # Like new
    B = "B"  # Minor wear
    C = "C"  # Repairable damage
    D = "D"  # Major damage
    E = "E"  # Total loss


# Damage Type Enum
class DamageType(str, PyEnum):
    """Types of damage that can occur."""
    NONE = "NONE"
    COSMETIC = "COSMETIC"
    FUNCTIONAL = "FUNCTIONAL"
    STRUCTURAL = "STRUCTURAL"
    WATER_DAMAGE = "WATER_DAMAGE"
    PHYSICAL_DAMAGE = "PHYSICAL_DAMAGE"
    MISSING_PARTS = "MISSING_PARTS"
    CONTAMINATION = "CONTAMINATION"
    OTHER = "OTHER"


# Disposition Enum
class ItemDisposition(str, PyEnum):
    """What to do with the inspected item."""
    RETURN_TO_STOCK = "RETURN_TO_STOCK"
    SEND_TO_REPAIR = "SEND_TO_REPAIR"
    WRITE_OFF = "WRITE_OFF"
    RETURN_TO_VENDOR = "RETURN_TO_VENDOR"
    QUARANTINE = "QUARANTINE"
    DISPOSE = "DISPOSE"


class TransactionInspection(RentalManagerBaseModel):
    """
    Transaction Inspection model for tracking inspection of returned items.
    
    This model captures detailed inspection data for items being returned
    through purchase returns, rental returns, or damaged goods processing.
    """
    
    __tablename__ = "transaction_inspections"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    transaction_line_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_lines.id", name="fk_inspection_transaction_line"),
        nullable=False,
        comment="Transaction line being inspected"
    )
    
    # Inspection details
    inspection_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Date and time of inspection"
    )
    
    inspector_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", name="fk_inspection_inspector"),
        nullable=True,
        comment="User who performed the inspection"
    )
    
    status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus),
        nullable=False,
        default=InspectionStatus.PENDING,
        comment="Current status of inspection"
    )
    
    # Condition assessment
    condition_rating: Mapped[ConditionRating] = mapped_column(
        Enum(ConditionRating),
        nullable=False,
        default=ConditionRating.A,
        comment="Overall condition rating"
    )
    
    damage_type: Mapped[DamageType] = mapped_column(
        Enum(DamageType),
        nullable=False,
        default=DamageType.NONE,
        comment="Primary type of damage found"
    )
    
    damage_description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description of damage"
    )
    
    # Financial impact
    repair_cost_estimate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="Estimated cost to repair"
    )
    
    actual_repair_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Actual cost incurred for repair"
    )
    
    depreciation_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="Value depreciation due to damage"
    )
    
    refund_adjustment: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0,
        comment="Adjustment to refund amount based on condition"
    )
    
    # Disposition decision
    disposition: Mapped[ItemDisposition] = mapped_column(
        Enum(ItemDisposition),
        nullable=False,
        default=ItemDisposition.RETURN_TO_STOCK,
        comment="What to do with the item"
    )
    
    return_to_stock: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether item can be returned to sellable stock"
    )
    
    quarantine_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether item needs quarantine"
    )
    
    quarantine_days: Mapped[Optional[int]] = mapped_column(
        nullable=True,
        comment="Number of days in quarantine"
    )
    
    # Documentation
    photos_taken: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether photos were taken for documentation"
    )
    
    photo_urls: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of photo URLs"
    )
    
    inspection_checklist: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="JSON checklist of inspection points"
    )
    
    inspection_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Additional inspection notes"
    )
    
    # Quality control
    requires_secondary_inspection: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether a second inspection is required"
    )
    
    secondary_inspector_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", name="fk_inspection_secondary_inspector"),
        nullable=True,
        comment="User who performed secondary inspection"
    )
    
    secondary_inspection_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date of secondary inspection"
    )
    
    secondary_inspection_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notes from secondary inspection"
    )
    
    # Approval workflow
    approved: Mapped[Optional[bool]] = mapped_column(
        Boolean,
        nullable=True,
        comment="Whether disposition is approved"
    )
    
    approved_by_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", name="fk_inspection_approved_by"),
        nullable=True,
        comment="User who approved the disposition"
    )
    
    approval_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date of approval"
    )
    
    approval_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Notes from approver"
    )
    
    # Vendor return (if applicable)
    vendor_rma_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Vendor Return Merchandise Authorization number"
    )
    
    vendor_return_shipped_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date item was shipped back to vendor"
    )
    
    vendor_credit_received: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Credit received from vendor"
    )
    
    # Relationships
    transaction_line: Mapped["TransactionLine"] = relationship(
        "TransactionLine",
        lazy="select",
        back_populates="inspection"
    )
    
    inspector: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[inspector_id],
        lazy="select"
    )
    
    secondary_inspector: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[secondary_inspector_id],
        lazy="select"
    )
    
    approved_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[approved_by_id],
        lazy="select"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_inspection_transaction_line", "transaction_line_id"),
        Index("idx_inspection_date", "inspection_date"),
        Index("idx_inspection_status", "status"),
        Index("idx_condition_rating", "condition_rating"),
        Index("idx_disposition", "disposition"),
        Index("idx_inspector", "inspector_id"),
        CheckConstraint("repair_cost_estimate >= 0", name="check_non_negative_repair_estimate"),
        CheckConstraint("depreciation_amount >= 0", name="check_non_negative_depreciation"),
        CheckConstraint("refund_adjustment >= 0", name="check_non_negative_refund_adjustment"),
    )
    
    def __init__(
        self,
        transaction_line_id: UUID,
        condition_rating: ConditionRating = ConditionRating.A,
        inspector_id: Optional[UUID] = None,
        **kwargs
    ):
        """
        Initialize a Transaction Inspection.
        
        Args:
            transaction_line_id: ID of the transaction line being inspected
            condition_rating: Initial condition rating
            inspector_id: ID of the inspector
            **kwargs: Additional fields
        """
        super().__init__(**kwargs)
        self.transaction_line_id = transaction_line_id
        self.condition_rating = condition_rating
        self.inspector_id = inspector_id
        self.inspection_date = datetime.now(timezone.utc)
        self._apply_condition_defaults()
    
    def _apply_condition_defaults(self):
        """Apply default values based on condition rating."""
        defaults = {
            ConditionRating.A: {
                "damage_type": DamageType.NONE,
                "disposition": ItemDisposition.RETURN_TO_STOCK,
                "return_to_stock": True,
                "refund_adjustment": Decimal("0"),
            },
            ConditionRating.B: {
                "damage_type": DamageType.COSMETIC,
                "disposition": ItemDisposition.RETURN_TO_STOCK,
                "return_to_stock": True,
                "refund_adjustment": Decimal("0"),
            },
            ConditionRating.C: {
                "damage_type": DamageType.FUNCTIONAL,
                "disposition": ItemDisposition.SEND_TO_REPAIR,
                "return_to_stock": False,
                "refund_adjustment": Decimal("0"),
            },
            ConditionRating.D: {
                "damage_type": DamageType.STRUCTURAL,
                "disposition": ItemDisposition.WRITE_OFF,
                "return_to_stock": False,
                "refund_adjustment": Decimal("0"),
            },
            ConditionRating.E: {
                "damage_type": DamageType.PHYSICAL_DAMAGE,
                "disposition": ItemDisposition.DISPOSE,
                "return_to_stock": False,
                "refund_adjustment": Decimal("0"),
            },
        }
        
        if self.condition_rating in defaults:
            for key, value in defaults[self.condition_rating].items():
                if not getattr(self, key):
                    setattr(self, key, value)
    
    def complete_inspection(
        self,
        condition_rating: ConditionRating,
        disposition: ItemDisposition,
        damage_description: Optional[str] = None,
        repair_cost_estimate: Optional[Decimal] = None,
        updated_by: Optional[str] = None
    ):
        """Complete the inspection with final assessment."""
        self.status = InspectionStatus.COMPLETED
        self.condition_rating = condition_rating
        self.disposition = disposition
        
        if damage_description:
            self.damage_description = damage_description
        
        if repair_cost_estimate:
            self.repair_cost_estimate = repair_cost_estimate
        
        # Update return to stock based on disposition
        self.return_to_stock = disposition == ItemDisposition.RETURN_TO_STOCK
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def approve_disposition(
        self,
        approved_by_id: UUID,
        approval_notes: Optional[str] = None
    ):
        """Approve the inspection disposition."""
        self.approved = True
        self.approved_by_id = approved_by_id
        self.approval_date = datetime.now(timezone.utc)
        
        if approval_notes:
            self.approval_notes = approval_notes
        
        self.updated_at = datetime.now(timezone.utc)
    
    def reject_disposition(
        self,
        rejected_by_id: UUID,
        rejection_notes: str
    ):
        """Reject the inspection disposition."""
        self.approved = False
        self.approved_by_id = rejected_by_id
        self.approval_date = datetime.now(timezone.utc)
        self.approval_notes = f"REJECTED: {rejection_notes}"
        self.updated_at = datetime.now(timezone.utc)
    
    def add_secondary_inspection(
        self,
        secondary_inspector_id: UUID,
        notes: Optional[str] = None
    ):
        """Add secondary inspection details."""
        self.secondary_inspector_id = secondary_inspector_id
        self.secondary_inspection_date = datetime.now(timezone.utc)
        
        if notes:
            self.secondary_inspection_notes = notes
        
        self.updated_at = datetime.now(timezone.utc)
    
    def calculate_refund_impact(self, original_value: Decimal) -> Decimal:
        """Calculate the refund amount based on condition."""
        refund_percentages = {
            ConditionRating.A: Decimal("100"),  # Full refund
            ConditionRating.B: Decimal("90"),   # 90% refund
            ConditionRating.C: Decimal("50"),   # 50% refund
            ConditionRating.D: Decimal("25"),   # 25% refund
            ConditionRating.E: Decimal("0"),    # No refund
        }
        
        percentage = refund_percentages.get(self.condition_rating, Decimal("100"))
        base_refund = original_value * percentage / 100
        
        # Apply additional adjustments
        final_refund = base_refund - self.refund_adjustment - self.repair_cost_estimate
        
        return max(final_refund, Decimal("0"))  # Never negative refund
    
    def set_vendor_return(
        self,
        rma_number: str,
        shipped_date: Optional[datetime] = None
    ):
        """Set vendor return information."""
        self.disposition = ItemDisposition.RETURN_TO_VENDOR
        self.vendor_rma_number = rma_number
        self.vendor_return_shipped_date = shipped_date or datetime.now(timezone.utc)
        self.return_to_stock = False
        self.updated_at = datetime.now(timezone.utc)
    
    @property
    def is_completed(self) -> bool:
        """Check if inspection is completed."""
        return self.status == InspectionStatus.COMPLETED
    
    @property
    def is_approved(self) -> bool:
        """Check if disposition is approved."""
        return self.approved is True
    
    @property
    def needs_repair(self) -> bool:
        """Check if item needs repair."""
        return self.disposition == ItemDisposition.SEND_TO_REPAIR
    
    @property
    def is_write_off(self) -> bool:
        """Check if item is written off."""
        return self.disposition in [ItemDisposition.WRITE_OFF, ItemDisposition.DISPOSE]
    
    @property
    def has_damage(self) -> bool:
        """Check if item has any damage."""
        return self.damage_type != DamageType.NONE
    
    @property
    def requires_secondary_inspection(self) -> bool:
        """Check if secondary inspection is required."""
        return (
            self.requires_secondary_inspection and 
            self.secondary_inspection_date is None
        )
    
    @property
    def total_cost_impact(self) -> Decimal:
        """Calculate total cost impact of the inspection."""
        return (
            self.repair_cost_estimate + 
            self.depreciation_amount + 
            self.refund_adjustment
        )
    
    def __repr__(self) -> str:
        return (
            f"<TransactionInspection(id={self.id}, "
            f"line_id={self.transaction_line_id}, "
            f"condition={self.condition_rating}, "
            f"disposition={self.disposition})>"
        )