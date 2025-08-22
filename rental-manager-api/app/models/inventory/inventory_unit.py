"""
Inventory Unit Model - Individual physical unit tracking.

This model tracks individual units of inventory items, supporting both
serialized items (with unique serial numbers) and non-serialized items
(tracked by batch codes).
"""

from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index, 
    Numeric, String, Text, UniqueConstraint, CheckConstraint, Integer
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.db.base import RentalManagerBaseModel
from app.models.inventory.enums import (
    InventoryUnitStatus, 
    InventoryUnitCondition,
    get_acceptable_rental_conditions
)

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.location import Location
    from app.models.user import User


class InventoryUnit(RentalManagerBaseModel):
    """
    Individual physical unit of an item.
    
    This model provides:
    - Serial number tracking for serialized items
    - Batch tracking for non-serialized items
    - Individual unit status and condition
    - Maintenance and warranty tracking
    - Rental blocking at unit level
    - Cost and pricing at unit level
    """
    __tablename__ = "inventory_units"
    
    # Foreign Keys
    item_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("items.id", name="fk_inventory_unit_item"),
        nullable=False,
        comment="Parent item this unit belongs to"
    )
    
    location_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("locations.id", name="fk_inventory_unit_location"),
        nullable=False,
        comment="Current location of this unit"
    )
    
    # Identification
    sku = Column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
        comment="Unique SKU for this unit"
    )
    
    serial_number = Column(
        String(100),
        nullable=True,
        unique=True,
        index=True,
        comment="Serial number for serialized items"
    )
    
    batch_code = Column(
        String(50),
        nullable=True,
        index=True,
        comment="Batch code for non-serialized items"
    )
    
    barcode = Column(
        String(100),
        nullable=True,
        unique=True,
        index=True,
        comment="Barcode for scanning"
    )
    
    # Status and condition
    status = Column(
        String(20),
        nullable=False,
        default=InventoryUnitStatus.AVAILABLE.value,
        comment="Current status of the unit"
    )
    
    condition = Column(
        String(20),
        nullable=False,
        default=InventoryUnitCondition.NEW.value,
        comment="Physical condition of the unit"
    )
    
    # Quantity (for batch tracking)
    quantity = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("1.00"),
        comment="Quantity in this unit/batch"
    )
    
    # Purchase information
    purchase_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this unit was purchased"
    )
    
    purchase_price = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Purchase price per unit"
    )
    
    supplier_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("suppliers.id", name="fk_inventory_unit_supplier"),
        nullable=True,
        comment="Supplier this unit was purchased from"
    )
    
    purchase_order_number = Column(
        String(100),
        nullable=True,
        comment="PO number for this purchase"
    )
    
    # Pricing (can override item master pricing)
    sale_price = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Sale price per unit"
    )
    
    rental_rate_per_period = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Rental rate per period"
    )
    
    rental_period = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Rental period in days"
    )
    
    security_deposit = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        comment="Security deposit per unit"
    )
    
    # Product details
    model_number = Column(
        String(100),
        nullable=True,
        comment="Model number"
    )
    
    manufacturer = Column(
        String(100),
        nullable=True,
        comment="Manufacturer name"
    )
    
    color = Column(
        String(50),
        nullable=True,
        comment="Color variant"
    )
    
    size = Column(
        String(50),
        nullable=True,
        comment="Size variant"
    )
    
    # Warranty information
    warranty_expiry = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Warranty expiration date"
    )
    
    warranty_provider = Column(
        String(100),
        nullable=True,
        comment="Warranty provider"
    )
    
    warranty_terms = Column(
        Text,
        nullable=True,
        comment="Warranty terms and conditions"
    )
    
    # Maintenance tracking
    last_maintenance_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last maintenance performed"
    )
    
    next_maintenance_date = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Next scheduled maintenance"
    )
    
    maintenance_history = Column(
        Text,
        nullable=True,
        comment="JSON history of maintenance"
    )
    
    total_rental_hours = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
        comment="Total hours/days rented"
    )
    
    total_rental_count = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of times rented"
    )
    
    # Rental blocking
    is_rental_blocked = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Unit blocked from rental"
    )
    
    rental_block_reason = Column(
        Text,
        nullable=True,
        comment="Reason for blocking rental"
    )
    
    rental_blocked_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When rental was blocked"
    )
    
    rental_blocked_by_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_inventory_unit_blocked_by"),
        nullable=True,
        comment="User who blocked rental"
    )
    
    # Location tracking
    original_location_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("locations.id", name="fk_inventory_unit_original_location"),
        nullable=True,
        comment="Original/home location"
    )
    
    current_holder_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", name="fk_inventory_unit_current_holder"),
        nullable=True,
        comment="Current customer holding this unit"
    )
    
    # Additional fields
    notes = Column(
        Text,
        nullable=True,
        comment="General notes about this unit"
    )
    
    custom_fields = Column(
        Text,
        nullable=True,
        comment="JSON for custom fields"
    )
    
    # Optimistic locking
    version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Version for optimistic locking"
    )
    
    # Relationships
    item = relationship(
        "Item",
        back_populates="inventory_units",
        lazy="select"
    )
    
    location = relationship(
        "Location",
        foreign_keys=[location_id],
        back_populates="inventory_units",
        lazy="select"
    )
    
    original_location = relationship(
        "Location",
        foreign_keys=[original_location_id],
        lazy="select"
    )
    
    supplier = relationship(
        "Supplier",
        back_populates="inventory_units",
        lazy="select"
    )
    
    current_holder = relationship(
        "Customer",
        back_populates="held_inventory_units",
        lazy="select"
    )
    
    rental_blocked_by = relationship(
        "User",
        foreign_keys=[rental_blocked_by_id],
        lazy="select"
    )
    
    __table_args__ = (
        # Indexes for performance
        Index("idx_inventory_unit_item", "item_id"),
        Index("idx_inventory_unit_location", "location_id"),
        Index("idx_inventory_unit_status", "status"),
        Index("idx_inventory_unit_condition", "condition"),
        Index("idx_inventory_unit_batch", "batch_code"),
        Index("idx_inventory_unit_available", "item_id", "location_id", "status"),
        Index("idx_inventory_unit_rental_blocked", "is_rental_blocked"),
        
        # Constraints
        CheckConstraint(
            "(serial_number IS NOT NULL) OR (batch_code IS NOT NULL)",
            name="check_serial_or_batch"
        ),
        CheckConstraint(
            "NOT (serial_number IS NOT NULL AND batch_code IS NOT NULL AND serial_number != '')",
            name="check_not_both_serial_and_batch"
        ),
        CheckConstraint(
            "quantity > 0",
            name="check_quantity_positive"
        ),
        CheckConstraint(
            "purchase_price >= 0",
            name="check_purchase_price_non_negative"
        ),
        CheckConstraint(
            "sale_price IS NULL OR sale_price >= 0",
            name="check_sale_price_non_negative"
        ),
        CheckConstraint(
            "rental_rate_per_period IS NULL OR rental_rate_per_period >= 0",
            name="check_rental_rate_non_negative"
        ),
        CheckConstraint(
            "security_deposit >= 0",
            name="check_security_deposit_non_negative"
        ),
        CheckConstraint(
            "rental_period > 0",
            name="check_rental_period_positive"
        ),
    )
    
    def __init__(
        self,
        *,
        item_id: UUID,
        location_id: UUID,
        sku: str,
        serial_number: Optional[str] = None,
        batch_code: Optional[str] = None,
        status: InventoryUnitStatus = InventoryUnitStatus.AVAILABLE,
        condition: InventoryUnitCondition = InventoryUnitCondition.NEW,
        quantity: Decimal = Decimal("1.00"),
        purchase_price: Decimal = Decimal("0.00"),
        purchase_date: Optional[datetime] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.item_id = item_id
        self.location_id = location_id
        self.sku = sku
        self.serial_number = serial_number
        self.batch_code = batch_code
        self.status = status.value if isinstance(status, InventoryUnitStatus) else status
        self.condition = condition.value if isinstance(condition, InventoryUnitCondition) else condition
        self.quantity = quantity
        self.purchase_price = purchase_price
        self.purchase_date = purchase_date
        
        # Set original location if not specified
        if not hasattr(self, 'original_location_id') or self.original_location_id is None:
            self.original_location_id = location_id
    
    def validate(self) -> None:
        """Validate inventory unit data."""
        # Ensure either serial number or batch code is present
        if not self.serial_number and not self.batch_code:
            raise ValueError("Either serial number or batch code is required")
        
        # For serialized items, quantity should be 1
        if self.serial_number and self.quantity != Decimal("1"):
            raise ValueError("Serialized items must have quantity of 1")
        
        # Validate SKU
        if not self.sku or not self.sku.strip():
            raise ValueError("SKU is required")
        
        if len(self.sku) > 50:
            raise ValueError("SKU too long (max 50 characters)")
        
        # Validate status and condition
        if self.status not in {s.value for s in InventoryUnitStatus}:
            raise ValueError(f"Invalid status: {self.status}")
        
        if self.condition not in {c.value for c in InventoryUnitCondition}:
            raise ValueError(f"Invalid condition: {self.condition}")
        
        # Validate dates
        if (self.purchase_date and self.warranty_expiry and 
            self.purchase_date > self.warranty_expiry):
            raise ValueError("Warranty expires before purchase date")
        
        if (self.last_maintenance_date and self.next_maintenance_date and 
            self.last_maintenance_date > self.next_maintenance_date):
            raise ValueError("Next maintenance before last maintenance")
        
        # Validate numeric fields
        if self.quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if self.purchase_price < 0:
            raise ValueError("Purchase price cannot be negative")
        
        if self.rental_period <= 0:
            raise ValueError("Rental period must be positive")
    
    # Status management methods
    def is_available(self) -> bool:
        """Check if unit is available for operations."""
        return (
            self.status == InventoryUnitStatus.AVAILABLE.value and 
            self.is_active and
            not self.is_rental_blocked
        )
    
    def is_rented(self) -> bool:
        """Check if unit is currently rented."""
        return self.status == InventoryUnitStatus.RENTED.value
    
    def is_damaged(self) -> bool:
        """Check if unit is damaged."""
        return self.status in {
            InventoryUnitStatus.DAMAGED.value,
            InventoryUnitStatus.BEYOND_REPAIR.value
        }
    
    def can_be_rented(self) -> bool:
        """Check if unit can be rented (considers status, condition, and blocks)."""
        if self.is_rental_blocked:
            return False
        
        if not self.is_available():
            return False
        
        if self.condition not in {c.value for c in get_acceptable_rental_conditions()}:
            return False
        
        if self.is_maintenance_due():
            return False
        
        return True
    
    # State transition methods
    def rent_out(self, *, customer_id: UUID, updated_by: Optional[UUID] = None) -> None:
        """Mark unit as rented out."""
        if not self.can_be_rented():
            raise ValueError("Unit cannot be rented in current state")
        
        self.status = InventoryUnitStatus.RENTED.value
        self.current_holder_id = customer_id
        self.total_rental_count += 1
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    def return_from_rent(
        self,
        *,
        condition: Optional[InventoryUnitCondition] = None,
        rental_hours: Decimal = Decimal("0"),
        updated_by: Optional[UUID] = None
    ) -> None:
        """Return unit from rental."""
        if not self.is_rented():
            raise ValueError("Unit is not currently rented")
        
        self.status = InventoryUnitStatus.AVAILABLE.value
        
        if condition:
            self.condition = condition.value if isinstance(condition, InventoryUnitCondition) else condition
        
        self.current_holder_id = None
        self.total_rental_hours += rental_hours
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    def mark_as_damaged(
        self,
        *,
        severity: str = InventoryUnitCondition.DAMAGED.value,
        notes: Optional[str] = None,
        updated_by: Optional[UUID] = None
    ) -> None:
        """Mark unit as damaged."""
        self.status = InventoryUnitStatus.DAMAGED.value
        self.condition = severity
        
        if notes:
            self.notes = f"{self.notes}\n{notes}" if self.notes else notes
        
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    def send_for_repair(self, *, updated_by: Optional[UUID] = None) -> None:
        """Send unit for repair."""
        if self.status not in {InventoryUnitStatus.DAMAGED.value, InventoryUnitStatus.AVAILABLE.value}:
            raise ValueError("Unit must be damaged or available to send for repair")
        
        self.status = InventoryUnitStatus.UNDER_REPAIR.value
        self.last_maintenance_date = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    def complete_repair(
        self,
        *,
        new_condition: InventoryUnitCondition = InventoryUnitCondition.GOOD,
        updated_by: Optional[UUID] = None
    ) -> None:
        """Complete repair and return to available."""
        if self.status != InventoryUnitStatus.UNDER_REPAIR.value:
            raise ValueError("Unit must be under repair")
        
        self.status = InventoryUnitStatus.AVAILABLE.value
        self.condition = new_condition.value if isinstance(new_condition, InventoryUnitCondition) else new_condition
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    def retire(self, *, reason: Optional[str] = None, updated_by: Optional[UUID] = None) -> None:
        """Retire unit from active use."""
        self.status = InventoryUnitStatus.RETIRED.value
        
        if reason:
            self.notes = f"{self.notes}\nRetired: {reason}" if self.notes else f"Retired: {reason}"
        
        self.is_active = False
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    # Rental blocking methods
    def block_rental(
        self,
        *,
        reason: str,
        blocked_by: UUID
    ) -> None:
        """Block unit from being rented."""
        self.is_rental_blocked = True
        self.rental_block_reason = reason
        self.rental_blocked_at = datetime.now(timezone.utc)
        self.rental_blocked_by_id = blocked_by
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
    
    def unblock_rental(self, *, updated_by: UUID) -> None:
        """Remove rental block."""
        self.is_rental_blocked = False
        self.rental_block_reason = None
        self.rental_blocked_at = None
        self.rental_blocked_by_id = None
        self.updated_at = datetime.now(timezone.utc)
        self.updated_by = updated_by
        self.version += 1
    
    # Maintenance methods
    def schedule_maintenance(
        self,
        next_date: datetime,
        *,
        updated_by: Optional[UUID] = None
    ) -> None:
        """Schedule next maintenance."""
        if next_date <= datetime.now(timezone.utc):
            raise ValueError("Maintenance date must be in the future")
        
        self.next_maintenance_date = next_date
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
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
        """Get age of unit since purchase."""
        if self.purchase_date is None:
            return None
        return (datetime.now(timezone.utc) - self.purchase_date).days
    
    def get_warranty_days_remaining(self) -> Optional[int]:
        """Get remaining warranty days."""
        if self.warranty_expiry is None:
            return None
        remaining = (self.warranty_expiry - datetime.now(timezone.utc)).days
        return max(0, remaining)
    
    # Transfer methods
    def transfer_to_location(
        self,
        new_location_id: UUID,
        *,
        updated_by: Optional[UUID] = None
    ) -> None:
        """Transfer unit to a different location."""
        if self.status != InventoryUnitStatus.AVAILABLE.value:
            raise ValueError("Only available units can be transferred")
        
        self.location_id = new_location_id
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
        
        if updated_by:
            self.updated_by = updated_by
    
    # Display properties
    @property
    def display_name(self) -> str:
        """Get display name for the unit."""
        if self.serial_number:
            return f"{self.sku} (S/N: {self.serial_number})"
        elif self.batch_code:
            return f"{self.sku} (Batch: {self.batch_code})"
        else:
            return self.sku
    
    @property
    def status_display(self) -> str:
        """Get human-readable status."""
        status_map = {
            InventoryUnitStatus.AVAILABLE.value: "Available",
            InventoryUnitStatus.RENTED.value: "On Rent",
            InventoryUnitStatus.SOLD.value: "Sold",
            InventoryUnitStatus.MAINTENANCE.value: "In Maintenance",
            InventoryUnitStatus.DAMAGED.value: "Damaged",
            InventoryUnitStatus.UNDER_REPAIR.value: "Under Repair",
            InventoryUnitStatus.BEYOND_REPAIR.value: "Beyond Repair",
            InventoryUnitStatus.RETIRED.value: "Retired",
            InventoryUnitStatus.RESERVED.value: "Reserved"
        }
        return status_map.get(self.status, self.status)
    
    @property
    def condition_display(self) -> str:
        """Get human-readable condition."""
        condition_map = {
            InventoryUnitCondition.NEW.value: "New",
            InventoryUnitCondition.EXCELLENT.value: "Excellent",
            InventoryUnitCondition.GOOD.value: "Good",
            InventoryUnitCondition.FAIR.value: "Fair",
            InventoryUnitCondition.POOR.value: "Poor",
            InventoryUnitCondition.DAMAGED.value: "Damaged"
        }
        return condition_map.get(self.condition, self.condition)
    
    def __str__(self) -> str:
        return f"{self.display_name} - {self.status_display}"
    
    def __repr__(self) -> str:
        return (
            f"<InventoryUnit id={self.id} sku={self.sku} "
            f"status={self.status} condition={self.condition}>"
        )