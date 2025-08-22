# app/modules/inventory/models.py
"""
Domain models for the inventory module.

StockMovement – immutable ledger of every quantity change.
StockLevel     – per-item/location real-time stock summary.
InventoryUnit  – individual physical unit with serial/asset tracking.
SKUSequence    – counter table for SKU generation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text,
)
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType
from .enums import (
    StockMovementType,
    InventoryUnitStatus,
    InventoryUnitCondition,
)

if TYPE_CHECKING:
    from app.modules.transactions.base.models.transaction_headers import TransactionHeader
    from app.modules.transactions.base.models.transaction_lines import TransactionLine
    from app.modules.master_data.locations.models import Location
    from app.modules.master_data.item_master.models import Item

__all__ = [
    "StockMovement",
    "StockLevel",
    "InventoryUnit",
    "SKUSequence",
]


# ---------------------------------------------------------------------------
# StockMovement
# ---------------------------------------------------------------------------

class StockMovement(RentalManagerBaseModel):
    """Immutable audit record for every stock change."""
    __tablename__ = "stock_movements"

   

    # --- FKs
    stock_level_id = Column(
        UUIDType(), ForeignKey("stock_levels.id", name="fk_stock_movement_stock_level"), nullable=False
    )
    item_id = Column(UUIDType(), ForeignKey("items.id", name="fk_stock_movement_item"), nullable=False)
    location_id = Column(UUIDType(), ForeignKey("locations.id", name="fk_stock_movement_location"), nullable=False)
    transaction_header_id = Column(
        UUIDType(), ForeignKey("transaction_headers.id", name="fk_stock_movement_transaction_header"), nullable=True
    )
    transaction_line_id = Column(
        UUIDType(), ForeignKey("transaction_lines.id", name="fk_stock_movement_transaction_line"), nullable=True
    )

    # --- data
    movement_type = Column(
        Enum(StockMovementType, native_enum=False), nullable=False
    )
    quantity_change = Column(Numeric(10, 2), nullable=False)
    quantity_before = Column(Numeric(10, 2), nullable=False)
    quantity_after = Column(Numeric(10, 2), nullable=False)

    # --- relationships
    item = relationship("Item", back_populates="stock_movements", lazy="select")
    stock_level = relationship(
        "StockLevel", back_populates="stock_movements", lazy="select"
    )
    location = relationship(
        "Location", lazy="select"  # back_populates temporarily disabled to avoid circular dependency
    )
    # Using string references to avoid circular dependencies
    transaction_header = relationship(
        "TransactionHeader", back_populates="stock_movements", lazy="select",
        foreign_keys=[transaction_header_id]
    )
    transaction_line = relationship(
        "TransactionLine", back_populates="stock_movements", lazy="select"
    )

    __table_args__ = (
        Index("idx_sm_stock_level", "stock_level_id"),
        Index("idx_sm_item", "item_id"),
        Index("idx_sm_location", "location_id"),
        Index("idx_sm_type", "movement_type"),
        Index("idx_sm_created", "created_at"),
        Index("idx_sm_item_created", "item_id", "created_at"),
        Index("idx_sm_stock_created", "stock_level_id", "created_at"),
    )

    def __init__(
        self,
        *,
        stock_level_id: str | UUID,
        item_id: str | UUID,
        location_id: str | UUID,
        movement_type: StockMovementType,
        quantity_change: Decimal,
        quantity_before: Decimal,
        quantity_after: Decimal,
        transaction_header_id: Optional[str | UUID] = None,
        transaction_line_id: Optional[str | UUID] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.stock_level_id = stock_level_id
        self.item_id = item_id
        self.location_id = location_id
        self.movement_type = StockMovementType(movement_type)
        self.quantity_change = quantity_change
        self.quantity_before = quantity_before
        self.quantity_after = quantity_after
        self.transaction_header_id = transaction_header_id
        self.transaction_line_id = transaction_line_id
        self._validate()

    def _validate(self) -> None:
        if self.quantity_before < 0:
            raise ValueError("Quantity before cannot be negative")
        if self.quantity_after < 0:
            raise ValueError("Quantity after cannot be negative")
        if abs(self.quantity_before + self.quantity_change - self.quantity_after) > Decimal(
            "0.01"
        ):
            raise ValueError("Quantity math doesn't add up")

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
        rental_types = {
            StockMovementType.RENTAL_OUT,
            StockMovementType.RENTAL_RETURN
        }
        return self.movement_type in rental_types

    def is_purchase_related(self) -> bool:
        """Check if this movement is related to purchase operations."""
        purchase_types = {
            StockMovementType.PURCHASE,
            StockMovementType.PURCHASE_RETURN
        }
        return self.movement_type in purchase_types

    def is_sale_related(self) -> bool:
        """Check if this movement is related to sale operations."""
        sale_types = {
            StockMovementType.SALE,
            StockMovementType.SALE_RETURN
        }
        return self.movement_type in sale_types

    def is_adjustment(self) -> bool:
        """Check if this movement is an adjustment."""
        adjustment_types = {
            StockMovementType.ADJUSTMENT_POSITIVE,
            StockMovementType.ADJUSTMENT_NEGATIVE,
            StockMovementType.SYSTEM_CORRECTION
        }
        return self.movement_type in adjustment_types

    def is_transfer(self) -> bool:
        """Check if this movement is a transfer."""
        transfer_types = {
            StockMovementType.TRANSFER_IN,
            StockMovementType.TRANSFER_OUT
        }
        return self.movement_type in transfer_types

    def is_loss(self) -> bool:
        """Check if this movement represents a loss."""
        loss_types = {
            StockMovementType.DAMAGE_LOSS,
            StockMovementType.THEFT_LOSS
        }
        return self.movement_type in loss_types

    def get_movement_category(self) -> str:
        """Get the category of this movement."""
        if self.is_rental_related():
            return "RENTAL"
        elif self.is_purchase_related():
            return "PURCHASE"
        elif self.is_sale_related():
            return "SALE"
        elif self.is_transfer():
            return "TRANSFER"
        elif self.is_loss():
            return "LOSS"
        elif self.is_adjustment():
            return "ADJUSTMENT"
        else:
            return "OTHER"

    def get_impact_description(self) -> str:
        """Get a description of the movement's impact."""
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
        stock_level_id: str | UUID,
        item_id: str | UUID,
        location_id: str | UUID,
        quantity: Decimal,
        quantity_before: Decimal,
        transaction_header_id: Optional[str | UUID] = None,
        transaction_line_id: Optional[str | UUID] = None,
        **kwargs
    ) -> "StockMovement":
        """Create a rental out stock movement."""
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
            **kwargs
        )

    @classmethod
    def create_rental_return_movement(
        cls,
        *,
        stock_level_id: str | UUID,
        item_id: str | UUID,
        location_id: str | UUID,
        quantity: Decimal,
        quantity_before: Decimal,
        transaction_header_id: Optional[str | UUID] = None,
        transaction_line_id: Optional[str | UUID] = None,
        **kwargs
    ) -> "StockMovement":
        """Create a rental return stock movement."""
        return cls(
            stock_level_id=stock_level_id,
            item_id=item_id,
            location_id=location_id,
            movement_type=StockMovementType.RENTAL_RETURN,
            quantity_change=abs(quantity),  # Always positive for rental return
            quantity_before=quantity_before,
            quantity_after=quantity_before + abs(quantity),
            transaction_header_id=transaction_header_id,
            transaction_line_id=transaction_line_id,
            **kwargs
        )

    @property
    def display_name(self) -> str:
        direction = "+" if self.quantity_change >= 0 else ""
        return f"{self.movement_type.value}: {direction}{self.quantity_change}"

    @property
    def full_display_name(self) -> str:
        if self.item:
            return f"{self.item.item_name} – {self.display_name}"
        return self.display_name

    @property
    def movement_summary(self) -> str:
        """Get a comprehensive movement summary."""
        return (
            f"{self.movement_type.value} | "
            f"{self.get_impact_description()} | "
            f"Before: {self.quantity_before} → After: {self.quantity_after}"
        )

    def __str__(self) -> str:
        return self.full_display_name

    def __repr__(self) -> str:
        return (
            f"<StockMovement id={self.id} type={self.movement_type.value!r} "
            f"change={self.quantity_change} before={self.quantity_before} "
            f"after={self.quantity_after}>"
        )


# ---------------------------------------------------------------------------
# StockLevel
# ---------------------------------------------------------------------------

class StockLevel(RentalManagerBaseModel):
    """Current stock quantities for an item at a location."""
    __tablename__ = "stock_levels"

    item_id = Column(UUIDType(), ForeignKey("items.id", name="fk_stock_level_item"), nullable=False)
    location_id = Column(UUIDType(), ForeignKey("locations.id", name="fk_stock_level_location"), nullable=False)

    quantity_on_hand = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    quantity_available = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    quantity_on_rent = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    quantity_damaged = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    quantity_under_repair = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    quantity_beyond_repair = Column(Numeric(10, 2), nullable=False, default=Decimal("0"))

    # relationships
    item = relationship("Item", back_populates="stock_levels", lazy="select")
    location = relationship("Location", lazy="select")  # back_populates temporarily disabled
    stock_movements = relationship(
        "StockMovement",
        back_populates="stock_level",
        lazy="select",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_sl_item", "item_id"),
        Index("idx_sl_location", "location_id"),
        Index("idx_sl_item_location", "item_id", "location_id", unique=True),
    )

    def __init__(
        self,
        *,
        item_id: str | UUID,
        location_id: str | UUID,
        quantity_on_hand: Decimal = Decimal("0"),
        quantity_available: Optional[Decimal] = None,
        quantity_on_rent: Optional[Decimal] = None,
        quantity_damaged: Optional[Decimal] = None,
        quantity_under_repair: Optional[Decimal] = None,
        quantity_beyond_repair: Optional[Decimal] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.item_id = item_id
        self.location_id = location_id
        self.quantity_on_hand = quantity_on_hand
        self.quantity_available = (
            quantity_available if quantity_available is not None else quantity_on_hand
        )
        self.quantity_on_rent = quantity_on_rent if quantity_on_rent is not None else Decimal("0")
        self.quantity_damaged = quantity_damaged if quantity_damaged is not None else Decimal("0")
        self.quantity_under_repair = quantity_under_repair if quantity_under_repair is not None else Decimal("0")
        self.quantity_beyond_repair = quantity_beyond_repair if quantity_beyond_repair is not None else Decimal("0")
        self._validate()

    def _validate(self) -> None:
        if self.quantity_on_hand < 0:
            raise ValueError("Quantity on hand cannot be negative")
        if self.quantity_available < 0:
            raise ValueError("Available quantity cannot be negative")
        if self.quantity_on_rent < 0:
            raise ValueError("Quantity on rent cannot be negative")
        if self.quantity_damaged < 0:
            raise ValueError("Quantity damaged cannot be negative")
        if self.quantity_under_repair < 0:
            raise ValueError("Quantity under repair cannot be negative")
        if self.quantity_beyond_repair < 0:
            raise ValueError("Quantity beyond repair cannot be negative")
        
        # Validate that all quantities sum up correctly
        total_allocated = (
            self.quantity_available + 
            self.quantity_on_rent + 
            self.quantity_damaged + 
            self.quantity_under_repair + 
            self.quantity_beyond_repair
        )
        if abs(total_allocated - self.quantity_on_hand) > Decimal("0.01"):
            raise ValueError(f"Allocated quantities ({total_allocated}) don't match on-hand stock ({self.quantity_on_hand})")

    def adjust_quantity(
        self, adjustment: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        new_qty = (self.quantity_on_hand + adjustment).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if new_qty < 0:
            raise ValueError("Negative stock not allowed")

        if adjustment < 0 and self.quantity_on_hand > 0:
            ratio = new_qty / self.quantity_on_hand
            self.quantity_available = (self.quantity_available * ratio).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            self.quantity_on_rent = (self.quantity_on_rent * ratio).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        self.quantity_on_hand = new_qty

        # keep available + on_rent <= on_hand
        allocated = self.quantity_available + self.quantity_on_rent
        if allocated > self.quantity_on_hand:
            excess = allocated - self.quantity_on_hand
            self.quantity_available = max(
                (self.quantity_available - excess).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                Decimal("0"),
            )
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def rent_out_quantity(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        if quantity < 0 or quantity > self.quantity_available:
            raise ValueError("Invalid rental quantity")
        self.quantity_available -= quantity
        self.quantity_on_rent += quantity
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def return_from_rent(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        if quantity < 0 or quantity > self.quantity_on_rent:
            raise ValueError("Invalid return quantity")
        self.quantity_on_rent -= quantity
        self.quantity_available += quantity
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def return_damaged_from_rent(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        """Handle damaged returns - items go to damaged status, NOT available."""
        if quantity < 0 or quantity > self.quantity_on_rent:
            raise ValueError("Invalid return quantity")
        self.quantity_on_rent -= quantity
        self.quantity_damaged += quantity  # Goes to damaged, NOT available!
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def move_to_repair(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        """Move items from damaged to under repair."""
        if quantity < 0 or quantity > self.quantity_damaged:
            raise ValueError("Invalid repair quantity")
        self.quantity_damaged -= quantity
        self.quantity_under_repair += quantity
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def complete_repair(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        """Complete repair and return items to available inventory."""
        if quantity < 0 or quantity > self.quantity_under_repair:
            raise ValueError("Invalid repair completion quantity")
        self.quantity_under_repair -= quantity
        self.quantity_available += quantity  # Now available for rental again
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def write_off_damaged(
        self, quantity: Decimal, *, updated_by: Optional[str] = None
    ) -> None:
        """Write off beyond repair items."""
        if quantity < 0 or quantity > self.quantity_beyond_repair:
            raise ValueError("Invalid write-off quantity")
        self.quantity_beyond_repair -= quantity
        self.quantity_on_hand -= quantity  # Remove from total inventory
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def is_available_for_rent(self, quantity: Decimal = Decimal("1")) -> bool:
        """Check if sufficient quantity is available for rental."""
        return self.quantity_available >= quantity and self.is_active

    def has_rented_quantity(self, quantity: Decimal = Decimal("1")) -> bool:
        """Check if sufficient quantity is currently on rent."""
        return self.quantity_on_rent >= quantity

    def is_overstocked(self, threshold: Optional[Decimal] = None) -> bool:
        """Check if stock level exceeds a threshold (useful for reorder logic)."""
        if threshold is None:
            return False
        return self.quantity_on_hand > threshold

    def is_understocked(self, threshold: Optional[Decimal] = None) -> bool:
        """Check if stock level is below a threshold (useful for reorder logic)."""
        if threshold is None:
            return False
        return self.quantity_on_hand < threshold

    def get_utilization_rate(self) -> Decimal:
        """Get the percentage of stock currently on rent."""
        if self.quantity_on_hand == 0:
            return Decimal("0")
        return (Decimal(str(self.quantity_on_rent)) / Decimal(str(self.quantity_on_hand)) * 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def get_availability_rate(self) -> Decimal:
        """Get the percentage of stock currently available."""
        if self.quantity_on_hand == 0:
            return Decimal("0")
        return (Decimal(str(self.quantity_available)) / Decimal(str(self.quantity_on_hand)) * 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def can_fulfill_rental(self, quantity: Decimal) -> bool:
        """Check if a rental request can be fulfilled."""
        return (
            self.is_active and 
            self.quantity_available >= quantity and 
            quantity > 0
        )

    def get_stock_status(self) -> str:
        """Get a human-readable stock status."""
        if not self.is_active:
            return "INACTIVE"
        elif self.quantity_on_hand == 0:
            return "OUT_OF_STOCK"
        elif self.quantity_available == 0:
            return "FULLY_RENTED"
        elif self.quantity_available < Decimal(str(self.quantity_on_hand)) * Decimal("0.2"):
            return "LOW_AVAILABILITY"
        else:
            return "AVAILABLE"

    @property
    def display_name(self) -> str:
        item = getattr(self, "item", None)
        loc = getattr(self, "location", None)
        return (
            f"{item.item_name if item else 'Unknown'} @ "
            f"{loc.location_name if loc else 'Unknown'}"
        )

    @property
    def stock_summary(self) -> str:
        """Get a summary of stock quantities."""
        return (
            f"On Hand: {self.quantity_on_hand}, "
            f"Available: {self.quantity_available}, "
            f"On Rent: {self.quantity_on_rent}"
        )

    def __str__(self) -> str:
        return self.display_name

    def __repr__(self) -> str:
        return (
            f"<StockLevel id={self.id} item={self.item_id} "
            f"location={self.location_id} on_hand={self.quantity_on_hand} "
            f"available={self.quantity_available} on_rent={self.quantity_on_rent}>"
        )


# ---------------------------------------------------------------------------
# InventoryUnit
# ---------------------------------------------------------------------------

class InventoryUnit(RentalManagerBaseModel):
    """Individual physical unit of an item."""
    __tablename__ = "inventory_units"

    item_id = Column(UUIDType(), ForeignKey("items.id", name="fk_inventory_unit_item"), nullable=False)
    location_id = Column(UUIDType(), ForeignKey("locations.id", name="fk_inventory_unit_location"), nullable=False)

    sku = Column(String(50), nullable=False, unique=True, index=True)
    serial_number = Column(String(100))
    status = Column(
        String(20),
        nullable=False,
        default=InventoryUnitStatus.AVAILABLE.value,
    )
    condition = Column(
        String(20),
        nullable=False,
        default=InventoryUnitCondition.NEW.value,
    )
    purchase_date = Column(DateTime)
    purchase_price = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    warranty_expiry = Column(DateTime)
    last_maintenance_date = Column(DateTime)
    next_maintenance_date = Column(DateTime)
    notes = Column(Text)
    
    # New fields migrated from Item model
    sale_price = Column(Numeric(10, 2), nullable=True, comment="Sale price per unit")
    security_deposit = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"), comment="Security deposit per unit")
    rental_rate_per_period = Column(Numeric(10, 2), nullable=True, comment="Rental rate per period")
    rental_period = Column(Integer, nullable=False, default=1, comment="Rental period (number of periods)")
    model_number = Column(String(100), nullable=True, comment="Model number")
    warranty_period_days = Column(Integer, nullable=False, default=0, comment="Warranty period in days")
    
    # New batch tracking fields
    batch_code = Column(String(50), nullable=True, comment="Batch code for tracking")
    quantity = Column(Numeric(10, 2), nullable=False, default=Decimal("1.00"), comment="Quantity in this unit/batch")
    remarks = Column(Text, nullable=True, comment="Additional remarks or notes")
    
    # Rental blocking fields
    is_rental_blocked = Column(Boolean, nullable=False, default=False, comment="Unit blocked from rental")
    rental_block_reason = Column(Text, nullable=True, comment="Reason for blocking rental")
    rental_blocked_at = Column(DateTime, nullable=True, comment="When rental was blocked")
    rental_blocked_by = Column(UUIDType(), ForeignKey("users.id"), nullable=True, comment="User who blocked rental")

    # relationships
    item = relationship("Item", back_populates="inventory_units", lazy="select")
    location = relationship("Location", lazy="select")  # back_populates temporarily disabled

    __table_args__ = (
        Index("idx_inv_sku", "sku"),
        Index("idx_inv_item", "item_id"),
        Index("idx_inv_location", "location_id"),
        Index("idx_inv_status", "status"),
        Index("idx_inv_condition", "condition"),
        Index("idx_inv_serial", "serial_number"),
    )

    def __init__(
        self,
        *,
        item_id: str | UUID,
        location_id: str | UUID,
        sku: str,
        serial_number: Optional[str] = None,
        status: InventoryUnitStatus = InventoryUnitStatus.AVAILABLE,
        condition: InventoryUnitCondition = InventoryUnitCondition.NEW,
        purchase_price: Decimal = Decimal("0.00"),
        purchase_date: Optional[datetime] = None,
        warranty_expiry: Optional[datetime] = None,
        last_maintenance_date: Optional[datetime] = None,
        next_maintenance_date: Optional[datetime] = None,
        notes: Optional[str] = None,
        sale_price: Optional[Decimal] = None,
        security_deposit: Decimal = Decimal("0.00"),
        rental_rate_per_period: Optional[Decimal] = None,
        rental_period: int = 1,
        model_number: Optional[str] = None,
        warranty_period_days: int = 0,
        batch_code: Optional[str] = None,
        quantity: Decimal = Decimal("1.00"),
        remarks: Optional[str] = None,
        is_rental_blocked: bool = False,
        rental_block_reason: Optional[str] = None,
        rental_blocked_at: Optional[datetime] = None,
        rental_blocked_by: Optional[str | UUID] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.item_id = item_id
        self.location_id = location_id
        self.sku = sku
        self.serial_number = serial_number
        self.status = InventoryUnitStatus(status).value
        self.condition = InventoryUnitCondition(condition).value
        self.purchase_price = purchase_price
        self.purchase_date = purchase_date
        self.warranty_expiry = warranty_expiry
        self.last_maintenance_date = last_maintenance_date
        self.next_maintenance_date = next_maintenance_date
        self.notes = notes
        self.sale_price = sale_price
        self.security_deposit = security_deposit
        self.rental_rate_per_period = rental_rate_per_period
        self.rental_period = rental_period
        self.model_number = model_number
        self.warranty_period_days = warranty_period_days
        self.batch_code = batch_code
        self.quantity = quantity
        self.remarks = remarks
        self.is_rental_blocked = is_rental_blocked
        self.rental_block_reason = rental_block_reason
        self.rental_blocked_at = rental_blocked_at
        self.rental_blocked_by = rental_blocked_by
        self._validate()

    def _validate(self) -> None:
        if not self.sku or not self.sku.strip():
            raise ValueError("SKU required")
        if len(self.sku) > 50:
            raise ValueError("SKU too long")
        if self.serial_number and len(self.serial_number) > 100:
            raise ValueError("Serial number too long")
        
        # Ensure either serial number OR batch code is present (but not necessarily both)
        # Serialized items need serial numbers, non-serialized items need batch codes
        if not self.serial_number and not self.batch_code:
            raise ValueError("Either serial number or batch code is required")
        
        if self.status not in {s.value for s in InventoryUnitStatus}:
            raise ValueError("Invalid unit status")
        if self.condition not in {c.value for c in InventoryUnitCondition}:
            raise ValueError("Invalid unit condition")
        if self.purchase_price < 0:
            raise ValueError("Purchase price negative")
        
        # Validate new fields
        if self.sale_price is not None and self.sale_price < 0:
            raise ValueError("Sale price cannot be negative")
        if self.security_deposit < 0:
            raise ValueError("Security deposit cannot be negative")
        if self.rental_rate_per_period is not None and self.rental_rate_per_period < 0:
            raise ValueError("Rental rate cannot be negative")
        if self.rental_period <= 0:
            raise ValueError("Rental period must be positive")
        if self.warranty_period_days < 0:
            raise ValueError("Warranty period days cannot be negative")
        if self.quantity <= 0:
            raise ValueError("Quantity must be positive")
        if self.batch_code and len(self.batch_code) > 50:
            raise ValueError("Batch code too long")
        if self.model_number and len(self.model_number) > 100:
            raise ValueError("Model number too long")

        if (
            self.purchase_date
            and self.warranty_expiry
            and self.purchase_date > self.warranty_expiry
        ):
            raise ValueError("Warranty expires before purchase date")
        if (
            self.last_maintenance_date
            and self.next_maintenance_date
            and self.last_maintenance_date > self.next_maintenance_date
        ):
            raise ValueError("Next maintenance before last maintenance")

    # --- state helpers ----------------------------------------------------

    def is_available(self) -> bool:
        return self.status == InventoryUnitStatus.AVAILABLE.value and self.is_active

    def is_rented(self) -> bool:
        return self.status == InventoryUnitStatus.RENTED.value

    def is_sold(self) -> bool:
        return self.status == InventoryUnitStatus.SOLD.value

    def is_in_maintenance(self) -> bool:
        return self.status == InventoryUnitStatus.MAINTENANCE.value

    def is_damaged(self) -> bool:
        return self.status == InventoryUnitStatus.DAMAGED.value

    def is_retired(self) -> bool:
        return self.status == InventoryUnitStatus.RETIRED.value

    def can_be_rented(self) -> bool:
        """Check if unit can be rented (considers both item and unit blocks)."""
        # First check if unit itself is blocked
        if self.is_rental_blocked:
            return False
        
        # Then check if parent item is blocked (if loaded)
        if hasattr(self, 'item') and self.item and hasattr(self.item, 'is_rental_blocked'):
            if self.item.is_rental_blocked:
                return False
        
        # Finally check basic availability
        return self.is_available()

    # --- state mutators ---------------------------------------------------

    def rent_out(self, *, updated_by: Optional[str] = None) -> None:
        if not self.is_available():
            raise ValueError("Unit not available")
        self.status = InventoryUnitStatus.RENTED.value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def return_from_rent(
        self,
        *,
        condition: Optional[InventoryUnitCondition] = None,
        updated_by: Optional[str] = None,
    ) -> None:
        if not self.is_rented():
            raise ValueError("Unit not rented")
        self.status = InventoryUnitStatus.AVAILABLE.value
        if condition:
            self.condition = InventoryUnitCondition(condition).value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_sold(self, *, updated_by: Optional[str] = None) -> None:
        if not self.is_available():
            raise ValueError("Unit not available")
        self.status = InventoryUnitStatus.SOLD.value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def send_for_maintenance(self, *, updated_by: Optional[str] = None) -> None:
        self.status = InventoryUnitStatus.MAINTENANCE.value
        self.last_maintenance_date = datetime.now(timezone.utc)
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def return_from_maintenance(
        self,
        *,
        condition: InventoryUnitCondition,
        updated_by: Optional[str] = None,
    ) -> None:
        if not self.is_in_maintenance():
            raise ValueError("Unit not in maintenance")
        self.status = InventoryUnitStatus.AVAILABLE.value
        self.condition = InventoryUnitCondition(condition).value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_damaged(self, *, updated_by: Optional[str] = None) -> None:
        self.status = InventoryUnitStatus.DAMAGED.value
        self.condition = InventoryUnitCondition.DAMAGED.value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def retire(self, *, updated_by: Optional[str] = None) -> None:
        """Retire the unit from active use."""
        self.status = InventoryUnitStatus.RETIRED.value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    # --- maintenance helpers ----------------------------------------------

    def schedule_maintenance(
        self, 
        next_maintenance_date: datetime, 
        *, 
        updated_by: Optional[str] = None
    ) -> None:
        """Schedule next maintenance for the unit."""
        if next_maintenance_date <= datetime.now(timezone.utc):
            raise ValueError("Next maintenance date must be in the future")
        self.next_maintenance_date = next_maintenance_date
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def is_maintenance_due(self) -> bool:
        """Check if maintenance is due."""
        return (
            self.next_maintenance_date is not None and 
            self.next_maintenance_date <= datetime.now(timezone.utc)
        )

    def is_warranty_valid(self) -> bool:
        """Check if warranty is still valid."""
        return (
            self.warranty_expiry is not None and 
            self.warranty_expiry > datetime.now(timezone.utc)
        )

    def get_age_in_days(self) -> Optional[int]:
        """Get the age of the unit in days since purchase."""
        if self.purchase_date is None:
            return None
        return (datetime.now(timezone.utc) - self.purchase_date).days

    def get_warranty_days_remaining(self) -> Optional[int]:
        """Get the number of days remaining on warranty."""
        if self.warranty_expiry is None:
            return None
        remaining = (self.warranty_expiry - datetime.now(timezone.utc)).days
        return max(0, remaining)

    # --- condition helpers -----------------------------------------------

    def update_condition(
        self, 
        new_condition: InventoryUnitCondition, 
        *, 
        updated_by: Optional[str] = None
    ) -> None:
        """Update the condition of the unit."""
        self.condition = InventoryUnitCondition(new_condition).value
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)

    def is_condition_acceptable_for_rental(self) -> bool:
        """Check if the unit condition is acceptable for rental."""
        acceptable_conditions = {
            InventoryUnitCondition.NEW.value,
            InventoryUnitCondition.EXCELLENT.value,
            InventoryUnitCondition.GOOD.value,
            InventoryUnitCondition.FAIR.value
        }
        return self.condition in acceptable_conditions

    # --- business logic helpers -------------------------------------------

    def can_be_rented(self) -> bool:
        """Check if the unit can be rented out."""
        return (
            self.is_available() and 
            self.is_condition_acceptable_for_rental() and
            not self.is_maintenance_due()
        )

    def get_status_display(self) -> str:
        """Get a human-readable status."""
        status_map = {
            InventoryUnitStatus.AVAILABLE.value: "Available",
            InventoryUnitStatus.RENTED.value: "On Rent",
            InventoryUnitStatus.SOLD.value: "Sold",
            InventoryUnitStatus.MAINTENANCE.value: "In Maintenance",
            InventoryUnitStatus.DAMAGED.value: "Damaged",
            InventoryUnitStatus.RETIRED.value: "Retired"
        }
        return status_map.get(self.status, self.status)

    def get_condition_display(self) -> str:
        """Get a human-readable condition."""
        condition_map = {
            InventoryUnitCondition.NEW.value: "New",
            InventoryUnitCondition.EXCELLENT.value: "Excellent",
            InventoryUnitCondition.GOOD.value: "Good",
            InventoryUnitCondition.FAIR.value: "Fair",
            InventoryUnitCondition.POOR.value: "Poor",
            InventoryUnitCondition.DAMAGED.value: "Damaged"
        }
        return condition_map.get(self.condition, self.condition)

    # --- display helpers --------------------------------------------------

    @property
    def display_name(self) -> str:
        return self.sku

    @property
    def full_display_name(self) -> str:
        return f"{self.item.item_name} – {self.sku}" if self.item else self.sku

    @property
    def status_summary(self) -> str:
        """Get a comprehensive status summary."""
        parts = [self.get_status_display(), self.get_condition_display()]
        
        if self.is_maintenance_due():
            parts.append("Maintenance Due")
        elif self.next_maintenance_date:
            parts.append(f"Next Maintenance: {self.next_maintenance_date.strftime('%Y-%m-%d')}")
            
        if self.warranty_expiry:
            if self.is_warranty_valid():
                days_left = self.get_warranty_days_remaining()
                parts.append(f"Warranty: {days_left} days left")
            else:
                parts.append("Warranty Expired")
        
        return " | ".join(parts)

    def __str__(self) -> str:
        return self.full_display_name

    def __repr__(self) -> str:
        return (
            f"<InventoryUnit id={self.id} sku={self.sku!r} "
            f"status={self.status!r} condition={self.condition!r}>"
        )


# ---------------------------------------------------------------------------
# SKUSequence
# ---------------------------------------------------------------------------

class SKUSequence(RentalManagerBaseModel):
    """Generator bookkeeping for SKU codes."""
    __tablename__ = "sku_sequences"

    brand_code = Column(String(20))
    category_code = Column(String(20))
    next_sequence = Column(Integer, nullable=False, default=1)

    __table_args__ = (
        Index(
            "idx_sku_brand_category",
            "brand_code",
            "category_code",
            unique=True,
        ),
        Index("idx_sku_brand", "brand_code"),
        Index("idx_sku_category", "category_code"),
    )

    def __init__(
        self,
        *,
        brand_code: Optional[str] = None,
        category_code: Optional[str] = None,
        next_sequence: int = 1,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.brand_code = brand_code.upper().strip() if brand_code else None
        self.category_code = category_code.upper().strip() if category_code else None
        self.next_sequence = next_sequence
        self._validate()

    def _validate(self) -> None:
        if self.brand_code and len(self.brand_code) > 20:
            raise ValueError("Brand code too long")
        if self.category_code and len(self.category_code) > 20:
            raise ValueError("Category code too long")
        # Ensure next_sequence is converted to int for comparison
        next_seq_int = int(self.next_sequence) if isinstance(self.next_sequence, str) else self.next_sequence
        if next_seq_int < 1:
            raise ValueError("Next sequence must be positive")

    def get_next_sequence_number(self) -> int:
        """Get the next sequence number without incrementing."""
        return int(self.next_sequence) if isinstance(self.next_sequence, str) else self.next_sequence

    def increment_sequence(self) -> None:
        """Increment the sequence number by 1."""
        current_seq = int(self.next_sequence) if isinstance(self.next_sequence, str) else self.next_sequence
        self.next_sequence = current_seq + 1
        self.updated_at = datetime.now(timezone.utc)

    def get_and_increment_sequence(self) -> int:
        """Get the current sequence number and increment it."""
        current = int(self.next_sequence) if isinstance(self.next_sequence, str) else self.next_sequence
        self.increment_sequence()
        return current

    def reset_sequence(self, new_value: int = 1) -> None:
        """Reset the sequence to a specific value."""
        if new_value < 1:
            raise ValueError("Sequence value must be positive")
        self.next_sequence = new_value
        self.updated_at = datetime.now(timezone.utc)

    def generate_sku(self, item_name: Optional[str] = None) -> str:
        """Generate a SKU using the current sequence."""
        sequence_num = self.get_and_increment_sequence()
        
        # Build SKU components
        parts = []
        if self.brand_code:
            parts.append(self.brand_code)
        if self.category_code:
            parts.append(self.category_code)
        
        # Add item name abbreviation if provided
        if item_name:
            # Take first 3 characters of each word, uppercase
            name_parts = item_name.split()[:2]  # Max 2 words
            name_abbrev = ''.join(word[:3].upper() for word in name_parts if word)
            if name_abbrev:
                parts.append(name_abbrev)
        
        # Add sequence number with padding
        parts.append(f"{sequence_num:04d}")
        
        return "-".join(parts) if parts else f"SKU-{sequence_num:04d}"

    @property
    def sequence_key(self) -> str:
        """Get a unique key for this sequence configuration."""
        return f"{self.brand_code or 'NONE'}-{self.category_code or 'NONE'}"

    @classmethod
    def get_or_create_sequence(
        cls, 
        session, 
        brand_code: Optional[str] = None, 
        category_code: Optional[str] = None
    ) -> "SKUSequence":
        """Get existing sequence or create new one for brand/category combination."""
        # This would typically be implemented in a service layer
        # but included here for completeness
        from sqlalchemy import select
        
        stmt = select(cls).where(
            cls.brand_code == (brand_code.upper().strip() if brand_code else None),
            cls.category_code == (category_code.upper().strip() if category_code else None)
        )
        
        sequence = session.scalar(stmt)
        if not sequence:
            sequence = cls(
                brand_code=brand_code,
                category_code=category_code,
                next_sequence=1
            )
            session.add(sequence)
            session.flush()
        
        return sequence

    def __str__(self) -> str:
        return f"SKU Sequence: {self.sequence_key} → {self.next_sequence}"

    def __repr__(self) -> str:
        return (
            f"<SKUSequence id={self.id} brand_code={self.brand_code!r} "
            f"category_code={self.category_code!r} next_sequence={self.next_sequence}>"
        )