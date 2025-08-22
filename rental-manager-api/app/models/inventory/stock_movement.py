"""
Stock Movement Model - Immutable audit ledger for inventory changes.

This model tracks every change to inventory quantities, providing a complete
audit trail and enabling historical analysis of stock movements.
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, 
    Numeric, String, Text, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.db.base import RentalManagerBaseModel
from app.models.inventory.enums import StockMovementType

if TYPE_CHECKING:
    from app.models.inventory.stock_level import StockLevel
    from app.models.item import Item
    from app.models.location import Location
    from app.models.transaction.transaction_header import TransactionHeader
    from app.models.transaction.transaction_line import TransactionLine
    from app.models.user import User


class StockMovement(RentalManagerBaseModel):
    """
    Immutable audit record for every stock change.
    
    This model provides:
    - Complete audit trail of all inventory changes
    - Transaction linkage for traceability
    - Before/after quantity snapshots
    - Reason tracking and notes
    - User accountability
    """
    __tablename__ = "stock_movements"
    
    # Foreign Keys
    stock_level_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("stock_levels.id", name="fk_stock_movement_stock_level"),
        nullable=False,
        comment="Reference to the stock level being modified"
    )
    
    item_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("items.id", name="fk_stock_movement_item"),
        nullable=False,
        comment="Item being moved"
    )
    
    location_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("locations.id", name="fk_stock_movement_location"),
        nullable=False,
        comment="Location where movement occurred"
    )
    
    # Optional transaction linkage for traceability
    transaction_header_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("transaction_headers.id", name="fk_stock_movement_transaction_header"),
        nullable=True,
        comment="Optional link to transaction header"
    )
    
    transaction_line_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("transaction_lines.id", name="fk_stock_movement_transaction_line"),
        nullable=True,
        comment="Optional link to specific transaction line"
    )
    
    # Movement details
    movement_type = Column(
        Enum(StockMovementType, native_enum=False),
        nullable=False,
        comment="Type of stock movement"
    )
    
    quantity_change = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Quantity changed (positive for increase, negative for decrease)"
    )
    
    quantity_before = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Stock quantity before movement"
    )
    
    quantity_after = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Stock quantity after movement"
    )
    
    # Additional tracking fields
    unit_cost = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Cost per unit for this movement (for valuation)"
    )
    
    total_cost = Column(
        Numeric(12, 2),
        nullable=True,
        comment="Total cost of this movement"
    )
    
    reference_number = Column(
        String(100),
        nullable=True,
        comment="External reference number (PO, Invoice, etc.)"
    )
    
    reason = Column(
        String(500),
        nullable=True,
        comment="Reason for movement (especially for adjustments)"
    )
    
    notes = Column(
        Text,
        nullable=True,
        comment="Additional notes about this movement"
    )
    
    # User tracking
    performed_by_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_stock_movement_performed_by"),
        nullable=True,
        comment="User who performed this movement"
    )
    
    approved_by_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_stock_movement_approved_by"),
        nullable=True,
        comment="User who approved this movement (for adjustments)"
    )
    
    # Timestamps
    movement_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        comment="When the movement occurred"
    )
    
    # Relationships
    stock_level = relationship(
        "StockLevel",
        back_populates="stock_movements",
        lazy="select"
    )
    
    item = relationship(
        "Item",
        back_populates="stock_movements",
        lazy="select"
    )
    
    location = relationship(
        "Location",
        back_populates="stock_movements",
        lazy="select"
    )
    
    transaction_header = relationship(
        "TransactionHeader",
        back_populates="stock_movements",
        lazy="select",
        foreign_keys=[transaction_header_id]
    )
    
    transaction_line = relationship(
        "TransactionLine",
        back_populates="stock_movements",
        lazy="select"
    )
    
    performed_by = relationship(
        "User",
        foreign_keys=[performed_by_id],
        lazy="select"
    )
    
    approved_by = relationship(
        "User",
        foreign_keys=[approved_by_id],
        lazy="select"
    )
    
    __table_args__ = (
        # Indexes for performance
        Index("idx_stock_movement_stock_level", "stock_level_id"),
        Index("idx_stock_movement_item", "item_id"),
        Index("idx_stock_movement_location", "location_id"),
        Index("idx_stock_movement_type", "movement_type"),
        Index("idx_stock_movement_date", "movement_date"),
        Index("idx_stock_movement_item_date", "item_id", "movement_date"),
        Index("idx_stock_movement_location_date", "location_id", "movement_date"),
        Index("idx_stock_movement_transaction", "transaction_header_id", "transaction_line_id"),
        
        # Constraints
        CheckConstraint(
            "quantity_before >= 0",
            name="check_quantity_before_non_negative"
        ),
        CheckConstraint(
            "quantity_after >= 0",
            name="check_quantity_after_non_negative"
        ),
        CheckConstraint(
            "abs(quantity_before + quantity_change - quantity_after) < 0.01",
            name="check_quantity_math"
        ),
    )
    
    def __init__(
        self,
        *,
        stock_level_id: UUID,
        item_id: UUID,
        location_id: UUID,
        movement_type: StockMovementType,
        quantity_change: Decimal,
        quantity_before: Decimal,
        quantity_after: Decimal,
        transaction_header_id: Optional[UUID] = None,
        transaction_line_id: Optional[UUID] = None,
        unit_cost: Optional[Decimal] = None,
        reference_number: Optional[str] = None,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        performed_by_id: Optional[UUID] = None,
        approved_by_id: Optional[UUID] = None,
        movement_date: Optional[datetime] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.stock_level_id = stock_level_id
        self.item_id = item_id
        self.location_id = location_id
        self.movement_type = movement_type
        self.quantity_change = quantity_change
        self.quantity_before = quantity_before
        self.quantity_after = quantity_after
        self.transaction_header_id = transaction_header_id
        self.transaction_line_id = transaction_line_id
        self.unit_cost = unit_cost
        self.reference_number = reference_number
        self.reason = reason
        self.notes = notes
        self.performed_by_id = performed_by_id
        self.approved_by_id = approved_by_id
        self.movement_date = movement_date or datetime.utcnow()
        
        # Calculate total cost if unit cost is provided
        if self.unit_cost and self.quantity_change:
            self.total_cost = abs(self.quantity_change) * self.unit_cost
    
    def validate(self) -> None:
        """Validate the stock movement data."""
        if self.quantity_before < 0:
            raise ValueError("Quantity before cannot be negative")
        
        if self.quantity_after < 0:
            raise ValueError("Quantity after cannot be negative")
        
        # Verify quantity math
        expected_after = self.quantity_before + self.quantity_change
        if abs(expected_after - self.quantity_after) > Decimal("0.01"):
            raise ValueError(
                f"Quantity math doesn't add up: {self.quantity_before} + "
                f"{self.quantity_change} != {self.quantity_after}"
            )
        
        # Validate unit cost if provided
        if self.unit_cost is not None and self.unit_cost < 0:
            raise ValueError("Unit cost cannot be negative")
    
    # Helper methods
    def is_increase(self) -> bool:
        """Check if this movement increases stock."""
        return self.quantity_change > 0
    
    def is_decrease(self) -> bool:
        """Check if this movement decreases stock."""
        return self.quantity_change < 0
    
    def is_neutral(self) -> bool:
        """Check if this movement has no quantity impact."""
        return self.quantity_change == 0
    
    def is_rental_related(self) -> bool:
        """Check if this movement is related to rental operations."""
        from app.models.inventory.enums import get_movement_category
        return get_movement_category(self.movement_type) == "RENTAL"
    
    def is_purchase_related(self) -> bool:
        """Check if this movement is related to purchase operations."""
        from app.models.inventory.enums import get_movement_category
        return get_movement_category(self.movement_type) == "PURCHASE"
    
    def is_adjustment(self) -> bool:
        """Check if this movement is an adjustment."""
        from app.models.inventory.enums import get_movement_category
        return get_movement_category(self.movement_type) == "ADJUSTMENT"
    
    def get_impact_description(self) -> str:
        """Get a human-readable description of the movement's impact."""
        if self.is_increase():
            return f"Increased stock by {abs(self.quantity_change)}"
        elif self.is_decrease():
            return f"Decreased stock by {abs(self.quantity_change)}"
        else:
            return "No quantity change"
    
    @classmethod
    def create_rental_out_movement(
        cls,
        *,
        stock_level_id: UUID,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        quantity_before: Decimal,
        transaction_header_id: Optional[UUID] = None,
        transaction_line_id: Optional[UUID] = None,
        performed_by_id: Optional[UUID] = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> "StockMovement":
        """Factory method to create a rental out stock movement."""
        return cls(
            stock_level_id=stock_level_id,
            item_id=item_id,
            location_id=location_id,
            movement_type=StockMovementType.RENTAL_OUT,
            quantity_change=-abs(quantity),  # Always negative for rental out
            quantity_before=quantity_before,
            quantity_after=quantity_before - abs(quantity),
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id,
            performed_by_id=performed_by_id,
            notes=notes,
            **kwargs
        )
    
    @classmethod
    def create_rental_return_movement(
        cls,
        *,
        stock_level_id: UUID,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        quantity_before: Decimal,
        transaction_header_id: Optional[UUID] = None,
        transaction_line_id: Optional[UUID] = None,
        performed_by_id: Optional[UUID] = None,
        notes: Optional[str] = None,
        is_damaged: bool = False,
        **kwargs
    ) -> "StockMovement":
        """Factory method to create a rental return stock movement."""
        movement_type = (
            StockMovementType.RENTAL_RETURN_DAMAGED 
            if is_damaged 
            else StockMovementType.RENTAL_RETURN
        )
        
        return cls(
            stock_level_id=stock_level_id,
            item_id=item_id,
            location_id=location_id,
            movement_type=movement_type,
            quantity_change=abs(quantity),  # Always positive for rental return
            quantity_before=quantity_before,
            quantity_after=quantity_before + abs(quantity),
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id,
            performed_by_id=performed_by_id,
            notes=notes,
            **kwargs
        )
    
    @classmethod
    def create_purchase_movement(
        cls,
        *,
        stock_level_id: UUID,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        quantity_before: Decimal,
        unit_cost: Decimal,
        transaction_header_id: Optional[UUID] = None,
        transaction_line_id: Optional[UUID] = None,
        reference_number: Optional[str] = None,
        performed_by_id: Optional[UUID] = None,
        **kwargs
    ) -> "StockMovement":
        """Factory method to create a purchase stock movement."""
        return cls(
            stock_level_id=stock_level_id,
            item_id=item_id,
            location_id=location_id,
            movement_type=StockMovementType.PURCHASE,
            quantity_change=abs(quantity),  # Always positive for purchase
            quantity_before=quantity_before,
            quantity_after=quantity_before + abs(quantity),
            unit_cost=unit_cost,
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id,
            reference_number=reference_number,
            performed_by_id=performed_by_id,
            **kwargs
        )
    
    @property
    def display_name(self) -> str:
        """Get a display name for the movement."""
        direction = "+" if self.quantity_change >= 0 else ""
        return f"{self.movement_type.value}: {direction}{self.quantity_change}"
    
    @property
    def movement_summary(self) -> str:
        """Get a comprehensive movement summary."""
        return (
            f"{self.movement_type.value} | "
            f"{self.get_impact_description()} | "
            f"Before: {self.quantity_before} → After: {self.quantity_after}"
        )
    
    def __str__(self) -> str:
        return self.movement_summary
    
    def __repr__(self) -> str:
        return (
            f"<StockMovement id={self.id} type={self.movement_type.value} "
            f"change={self.quantity_change} before={self.quantity_before} "
            f"after={self.quantity_after}>"
        )