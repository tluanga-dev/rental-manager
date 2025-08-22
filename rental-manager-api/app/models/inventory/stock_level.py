"""
Stock Level Model - Real-time inventory quantities per location.

This model maintains current stock quantities for each item at each location,
providing fast access to availability information and supporting multi-location
inventory management.
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Column, DateTime, ForeignKey, Index, 
    Numeric, String, UniqueConstraint, CheckConstraint, Integer
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.db.base import RentalManagerBaseModel
from app.models.inventory.enums import StockStatus

if TYPE_CHECKING:
    from app.models.inventory.stock_movement import StockMovement
    from app.models.item import Item
    from app.models.location import Location


class StockLevel(RentalManagerBaseModel):
    """
    Current stock quantities for an item at a location.
    
    This model provides:
    - Real-time inventory levels
    - Multi-location support
    - Separate tracking for different stock states
    - Performance-optimized queries
    - Automatic recalculation support
    """
    __tablename__ = "stock_levels"
    
    # Foreign Keys
    item_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("items.id", name="fk_stock_level_item"),
        nullable=False,
        comment="Item being tracked"
    )
    
    location_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("locations.id", name="fk_stock_level_location"),
        nullable=False,
        comment="Location where stock is held"
    )
    
    # Stock quantities - all must sum to quantity_on_hand
    quantity_on_hand = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Total physical quantity at location"
    )
    
    quantity_available = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity available for rental/sale"
    )
    
    quantity_reserved = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity reserved for pending transactions"
    )
    
    quantity_on_rent = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity currently rented out"
    )
    
    quantity_damaged = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity damaged but still in inventory"
    )
    
    quantity_under_repair = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity being repaired"
    )
    
    quantity_beyond_repair = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Quantity beyond repair awaiting write-off"
    )
    
    # Reorder information
    reorder_point = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Quantity at which to reorder"
    )
    
    reorder_quantity = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Quantity to order when reordering"
    )
    
    maximum_stock = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Maximum stock level to maintain"
    )
    
    # Valuation
    average_cost = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Average cost per unit for valuation"
    )
    
    last_purchase_cost = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Cost from last purchase"
    )
    
    total_value = Column(
        Numeric(12, 2),
        nullable=True,
        comment="Total inventory value at this location"
    )
    
    # Tracking dates
    last_counted_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last physical count date"
    )
    
    last_movement_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last stock movement date"
    )
    
    last_reorder_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last reorder date"
    )
    
    # Performance optimization fields
    stock_status = Column(
        String(20),
        nullable=False,
        default=StockStatus.OUT_OF_STOCK.value,
        comment="Cached stock status for quick filtering"
    )
    
    version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Version number for optimistic locking"
    )
    
    # Relationships
    item = relationship(
        "Item",
        back_populates="stock_levels",
        lazy="select"
    )
    
    location = relationship(
        "Location",
        back_populates="stock_levels",
        lazy="select"
    )
    
    stock_movements = relationship(
        "StockMovement",
        back_populates="stock_level",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="desc(StockMovement.movement_date)"
    )
    
    __table_args__ = (
        # Unique constraint - only one stock level per item/location
        UniqueConstraint(
            "item_id", "location_id",
            name="uq_stock_level_item_location"
        ),
        
        # Indexes for performance
        Index("idx_stock_level_item", "item_id"),
        Index("idx_stock_level_location", "location_id"),
        Index("idx_stock_level_status", "stock_status"),
        Index("idx_stock_level_available", "quantity_available"),
        Index("idx_stock_level_low_stock", "quantity_available", "reorder_point"),
        
        # Constraints
        CheckConstraint(
            "quantity_on_hand >= 0",
            name="check_quantity_on_hand_non_negative"
        ),
        CheckConstraint(
            "quantity_available >= 0",
            name="check_quantity_available_non_negative"
        ),
        CheckConstraint(
            "quantity_reserved >= 0",
            name="check_quantity_reserved_non_negative"
        ),
        CheckConstraint(
            "quantity_on_rent >= 0",
            name="check_quantity_on_rent_non_negative"
        ),
        CheckConstraint(
            "quantity_damaged >= 0",
            name="check_quantity_damaged_non_negative"
        ),
        CheckConstraint(
            "quantity_under_repair >= 0",
            name="check_quantity_under_repair_non_negative"
        ),
        CheckConstraint(
            "quantity_beyond_repair >= 0",
            name="check_quantity_beyond_repair_non_negative"
        ),
        CheckConstraint(
            "abs((quantity_available + quantity_reserved + quantity_on_rent + "
            "quantity_damaged + quantity_under_repair + quantity_beyond_repair) "
            "- quantity_on_hand) < 0.01",
            name="check_quantity_allocation"
        ),
    )
    
    def __init__(
        self,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity_on_hand: Decimal = Decimal("0"),
        quantity_available: Optional[Decimal] = None,
        quantity_reserved: Decimal = Decimal("0"),
        quantity_on_rent: Decimal = Decimal("0"),
        quantity_damaged: Decimal = Decimal("0"),
        quantity_under_repair: Decimal = Decimal("0"),
        quantity_beyond_repair: Decimal = Decimal("0"),
        reorder_point: Optional[Decimal] = None,
        reorder_quantity: Optional[Decimal] = None,
        maximum_stock: Optional[Decimal] = None,
        average_cost: Optional[Decimal] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.item_id = item_id
        self.location_id = location_id
        self.quantity_on_hand = quantity_on_hand
        
        # If available not specified, set to on_hand minus other allocations
        if quantity_available is None:
            self.quantity_available = quantity_on_hand - (
                quantity_reserved + quantity_on_rent + quantity_damaged + 
                quantity_under_repair + quantity_beyond_repair
            )
        else:
            self.quantity_available = quantity_available
        
        self.quantity_reserved = quantity_reserved
        self.quantity_on_rent = quantity_on_rent
        self.quantity_damaged = quantity_damaged
        self.quantity_under_repair = quantity_under_repair
        self.quantity_beyond_repair = quantity_beyond_repair
        self.reorder_point = reorder_point
        self.reorder_quantity = reorder_quantity
        self.maximum_stock = maximum_stock
        self.average_cost = average_cost
        
        # Update calculated fields
        self._update_stock_status()
        self._update_total_value()
    
    def validate(self) -> None:
        """Validate stock level data integrity."""
        # Check all quantities are non-negative
        if any(q < 0 for q in [
            self.quantity_on_hand, self.quantity_available, self.quantity_reserved,
            self.quantity_on_rent, self.quantity_damaged, self.quantity_under_repair,
            self.quantity_beyond_repair
        ]):
            raise ValueError("All quantities must be non-negative")
        
        # Validate quantity allocation
        total_allocated = (
            self.quantity_available + self.quantity_reserved + 
            self.quantity_on_rent + self.quantity_damaged + 
            self.quantity_under_repair + self.quantity_beyond_repair
        )
        
        if abs(total_allocated - self.quantity_on_hand) > Decimal("0.01"):
            raise ValueError(
                f"Allocated quantities ({total_allocated}) don't match "
                f"on-hand stock ({self.quantity_on_hand})"
            )
        
        # Validate reorder points if specified
        if self.reorder_point is not None and self.reorder_point < 0:
            raise ValueError("Reorder point cannot be negative")
        
        if self.maximum_stock is not None and self.maximum_stock < 0:
            raise ValueError("Maximum stock cannot be negative")
        
        if (self.reorder_point is not None and self.maximum_stock is not None and 
            self.reorder_point > self.maximum_stock):
            raise ValueError("Reorder point cannot exceed maximum stock")
    
    # Stock adjustment methods
    def adjust_quantity(
        self, 
        adjustment: Decimal,
        *,
        affect_available: bool = True
    ) -> None:
        """
        Adjust the on-hand quantity.
        
        Args:
            adjustment: Amount to adjust (positive or negative)
            affect_available: Whether to adjust available quantity too
        """
        new_qty = (self.quantity_on_hand + adjustment).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        
        if new_qty < 0:
            raise ValueError("Cannot reduce stock below zero")
        
        old_on_hand = self.quantity_on_hand
        self.quantity_on_hand = new_qty
        
        if affect_available:
            # Adjust available quantity proportionally
            if adjustment > 0:
                # Increase available by full amount
                self.quantity_available += adjustment
            else:
                # Decrease available, but not below zero
                self.quantity_available = max(
                    Decimal("0"),
                    self.quantity_available + adjustment
                )
        
        self._update_stock_status()
        self._update_total_value()
        self.last_movement_date = datetime.utcnow()
        self.version += 1
    
    def reserve_quantity(self, quantity: Decimal) -> None:
        """Reserve quantity for a pending transaction."""
        if quantity <= 0:
            raise ValueError("Reserve quantity must be positive")
        
        if quantity > self.quantity_available:
            raise ValueError(
                f"Cannot reserve {quantity}, only {self.quantity_available} available"
            )
        
        self.quantity_available -= quantity
        self.quantity_reserved += quantity
        self._update_stock_status()
        self.version += 1
    
    def release_reservation(self, quantity: Decimal) -> None:
        """Release a reservation back to available."""
        if quantity <= 0:
            raise ValueError("Release quantity must be positive")
        
        if quantity > self.quantity_reserved:
            raise ValueError(
                f"Cannot release {quantity}, only {self.quantity_reserved} reserved"
            )
        
        self.quantity_reserved -= quantity
        self.quantity_available += quantity
        self._update_stock_status()
        self.version += 1
    
    def rent_out_quantity(self, quantity: Decimal) -> None:
        """Move quantity from available to rented."""
        if quantity <= 0:
            raise ValueError("Rental quantity must be positive")
        
        if quantity > self.quantity_available:
            raise ValueError(
                f"Cannot rent {quantity}, only {self.quantity_available} available"
            )
        
        self.quantity_available -= quantity
        self.quantity_on_rent += quantity
        self._update_stock_status()
        self.last_movement_date = datetime.utcnow()
        self.version += 1
    
    def return_from_rent(
        self, 
        quantity: Decimal,
        *,
        damaged_quantity: Decimal = Decimal("0")
    ) -> None:
        """
        Return items from rental.
        
        Args:
            quantity: Total quantity being returned
            damaged_quantity: Portion that is damaged
        """
        if quantity <= 0:
            raise ValueError("Return quantity must be positive")
        
        if quantity > self.quantity_on_rent:
            raise ValueError(
                f"Cannot return {quantity}, only {self.quantity_on_rent} on rent"
            )
        
        if damaged_quantity > quantity:
            raise ValueError("Damaged quantity cannot exceed total return quantity")
        
        good_quantity = quantity - damaged_quantity
        
        self.quantity_on_rent -= quantity
        self.quantity_available += good_quantity
        self.quantity_damaged += damaged_quantity
        
        self._update_stock_status()
        self.last_movement_date = datetime.utcnow()
        self.version += 1
    
    def move_to_repair(self, quantity: Decimal) -> None:
        """Move damaged items to repair."""
        if quantity <= 0:
            raise ValueError("Repair quantity must be positive")
        
        if quantity > self.quantity_damaged:
            raise ValueError(
                f"Cannot repair {quantity}, only {self.quantity_damaged} damaged"
            )
        
        self.quantity_damaged -= quantity
        self.quantity_under_repair += quantity
        self.version += 1
    
    def complete_repair(self, quantity: Decimal) -> None:
        """Complete repair and return to available."""
        if quantity <= 0:
            raise ValueError("Repair quantity must be positive")
        
        if quantity > self.quantity_under_repair:
            raise ValueError(
                f"Cannot complete {quantity}, only {self.quantity_under_repair} under repair"
            )
        
        self.quantity_under_repair -= quantity
        self.quantity_available += quantity
        self._update_stock_status()
        self.version += 1
    
    def write_off_damaged(self, quantity: Decimal) -> None:
        """Write off beyond repair items."""
        if quantity <= 0:
            raise ValueError("Write-off quantity must be positive")
        
        if quantity > self.quantity_beyond_repair:
            raise ValueError(
                f"Cannot write off {quantity}, only {self.quantity_beyond_repair} beyond repair"
            )
        
        self.quantity_beyond_repair -= quantity
        self.quantity_on_hand -= quantity
        self._update_stock_status()
        self._update_total_value()
        self.last_movement_date = datetime.utcnow()
        self.version += 1
    
    # Helper methods
    def _update_stock_status(self) -> None:
        """Update the cached stock status."""
        if self.quantity_on_hand == 0:
            self.stock_status = StockStatus.OUT_OF_STOCK.value
        elif self.quantity_available == 0:
            self.stock_status = StockStatus.OUT_OF_STOCK.value
        elif (self.reorder_point and 
              self.quantity_available <= self.reorder_point):
            self.stock_status = StockStatus.LOW_STOCK.value
        elif (self.maximum_stock and 
              self.quantity_on_hand > self.maximum_stock):
            self.stock_status = StockStatus.OVERSTOCKED.value
        else:
            self.stock_status = StockStatus.IN_STOCK.value
    
    def _update_total_value(self) -> None:
        """Update the total inventory value."""
        if self.average_cost:
            self.total_value = (
                self.quantity_on_hand * self.average_cost
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    def update_average_cost(self, new_quantity: Decimal, new_cost: Decimal) -> None:
        """
        Update average cost using weighted average.
        
        Args:
            new_quantity: Quantity being added
            new_cost: Cost per unit of new quantity
        """
        if new_quantity <= 0 or new_cost < 0:
            raise ValueError("Quantity and cost must be positive")
        
        if self.average_cost is None or self.quantity_on_hand == 0:
            self.average_cost = new_cost
        else:
            total_cost = (self.quantity_on_hand * self.average_cost) + (new_quantity * new_cost)
            total_quantity = self.quantity_on_hand + new_quantity
            self.average_cost = (total_cost / total_quantity).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        
        self.last_purchase_cost = new_cost
        self._update_total_value()
    
    # Query helper methods
    def is_available_for_rent(self, quantity: Decimal = Decimal("1")) -> bool:
        """Check if sufficient quantity is available for rental."""
        return self.quantity_available >= quantity
    
    def is_low_stock(self) -> bool:
        """Check if stock is below reorder point."""
        return (
            self.reorder_point is not None and 
            self.quantity_available <= self.reorder_point
        )
    
    def is_overstocked(self) -> bool:
        """Check if stock exceeds maximum level."""
        return (
            self.maximum_stock is not None and 
            self.quantity_on_hand > self.maximum_stock
        )
    
    def can_fulfill_order(self, quantity: Decimal) -> bool:
        """Check if an order can be fulfilled."""
        return self.quantity_available >= quantity > 0
    
    def get_utilization_rate(self) -> Decimal:
        """Calculate the percentage of stock currently on rent."""
        if self.quantity_on_hand == 0:
            return Decimal("0")
        
        return (
            (self.quantity_on_rent / self.quantity_on_hand * 100)
            .quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )
    
    def get_availability_rate(self) -> Decimal:
        """Calculate the percentage of stock currently available."""
        if self.quantity_on_hand == 0:
            return Decimal("0")
        
        return (
            (self.quantity_available / self.quantity_on_hand * 100)
            .quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )
    
    @property
    def total_allocated(self) -> Decimal:
        """Get total allocated quantity (everything except available)."""
        return (
            self.quantity_reserved + self.quantity_on_rent + 
            self.quantity_damaged + self.quantity_under_repair + 
            self.quantity_beyond_repair
        )
    
    @property
    def stock_summary(self) -> str:
        """Get a summary of stock quantities."""
        return (
            f"On Hand: {self.quantity_on_hand}, "
            f"Available: {self.quantity_available}, "
            f"Reserved: {self.quantity_reserved}, "
            f"On Rent: {self.quantity_on_rent}, "
            f"Status: {self.stock_status}"
        )
    
    def __str__(self) -> str:
        return f"StockLevel: {self.stock_summary}"
    
    def __repr__(self) -> str:
        return (
            f"<StockLevel id={self.id} item={self.item_id} "
            f"location={self.location_id} on_hand={self.quantity_on_hand} "
            f"available={self.quantity_available}>"
        )