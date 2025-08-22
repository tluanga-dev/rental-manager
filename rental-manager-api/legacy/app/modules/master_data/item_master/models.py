from enum import Enum
from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from uuid import UUID
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Text, ForeignKey, Index, Integer, CheckConstraint, DateTime
from sqlalchemy.orm import relationship, validates

from app.db.base import RentalManagerBaseModel, UUIDType
from app.core.postgres_enums import ItemStatusEnum

if TYPE_CHECKING:
    from app.modules.master_data.brands.models import Brand
    from app.modules.master_data.categories.models import Category
    from app.modules.master_data.units.models import UnitOfMeasurement
    from app.modules.inventory.models import InventoryUnit, StockLevel, StockMovement
    from app.modules.transactions.base.models import TransactionLine




class ItemStatus(str, Enum):
    """Item status enumeration."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DISCONTINUED = "DISCONTINUED"


class Item(RentalManagerBaseModel):
    """
    Item model for master data management.
    
    Attributes:
        sku: Stock Keeping Unit
        item_name: Item name
        item_status: Status of item (ACTIVE, INACTIVE, DISCONTINUED)
        brand_id: Brand ID
        category_id: Category ID
        unit_of_measurement_id: Unit of measurement ID
        rental_rate_per_period: Rental rate per period
        rental_period: Rental period specification
        sale_price: Sale price
        security_deposit: Security deposit amount
        description: Item description
        specifications: Item specifications
        model_number: Model number
        serial_number_required: Whether serial number is required
        warranty_period_days: Warranty period in days
        reorder_level: Reorder level
        reorder_quantity: Reorder quantity
        is_rentable: Item can be rented (default: True)
        is_saleable: Item can be sold (default: False)
        brand: Brand relationship
        category: Category relationship
        unit_of_measurement: Unit of measurement relationship
        inventory_units: Inventory units
        stock_levels: Stock levels
        
    Note:
        is_rentable and is_saleable are mutually exclusive - both cannot be True at the same time.
    """
    
    __tablename__ = "items"
    
    sku = Column(String(50), nullable=False, unique=True, index=True, comment="Stock Keeping Unit")
    item_name = Column(String(200), nullable=False, comment="Item name")
    item_status = Column(ItemStatusEnum, nullable=False, default=ItemStatus.ACTIVE.value, comment="Item status")
    brand_id = Column(UUIDType(), ForeignKey("brands.id"), nullable=True, comment="Brand ID")
    category_id = Column(UUIDType(), ForeignKey("categories.id"), nullable=True, comment="Category ID")
    unit_of_measurement_id = Column(UUIDType(), ForeignKey("units_of_measurement.id"), nullable=False, comment="Unit of measurement ID")
    rental_rate_per_period = Column(Numeric(10, 2), nullable=True, comment="Rental rate per period")
    rental_period = Column(Integer, nullable=False, default=1, comment="Rental period (number of periods)")
    sale_price = Column(Numeric(10, 2), nullable=True, comment="Sale price")
    purchase_price = Column(Numeric(10, 2), nullable=True, comment="Purchase price")
    security_deposit = Column(Numeric(10, 2), nullable=False, default=0.00, comment="Security deposit")
    description = Column(Text, nullable=True, comment="Item description")
    specifications = Column(Text, nullable=True, comment="Item specifications")
    model_number = Column(String(100), nullable=True, comment="Model number")
    serial_number_required = Column(Boolean, nullable=False, default=False, comment="Serial number required")
    warranty_period_days = Column(Integer, nullable=False, default=0, comment="Warranty period in days")
    reorder_point = Column(Integer, nullable=False, comment="Reorder point threshold")
    is_rentable = Column(Boolean, nullable=False, default=True, comment="Item can be rented")
    is_saleable = Column(Boolean, nullable=False, default=False, comment="Item can be sold")
    
    # Rental blocking fields
    is_rental_blocked = Column(Boolean, nullable=False, default=False, comment="Item blocked from rental")
    rental_block_reason = Column(Text, nullable=True, comment="Reason for blocking rental")
    rental_blocked_at = Column(DateTime, nullable=True, comment="When rental was blocked")
    rental_blocked_by = Column(UUIDType(), ForeignKey("users.id"), nullable=True, comment="User who blocked rental")
    
    # Relationships - re-enabled with proper foreign keys
    brand = relationship("Brand", back_populates="items", lazy="select")
    category = relationship("Category", back_populates="items", lazy="select")
    unit_of_measurement = relationship("UnitOfMeasurement", back_populates="items", lazy="select")
    # Re-enabled inventory relationships with proper imports
    inventory_units = relationship("InventoryUnit", back_populates="item", lazy="select")
    stock_levels = relationship("StockLevel", back_populates="item", lazy="select")
    stock_movements = relationship("StockMovement", back_populates="item", lazy="select")
    # transaction_lines = relationship("TransactionLine", back_populates="item", lazy="select")  # Temporarily disabled
    
    # Indexes for efficient queries (constraints are managed via migrations)
    __table_args__ = (
        Index('idx_item_sku', 'sku'),
        Index('idx_item_name', 'item_name'),
        Index('idx_item_status', 'item_status'),
        Index('idx_item_brand', 'brand_id'),
        Index('idx_item_category', 'category_id'),
    )
    
    def __init__(
        self,
        sku: str,
        item_name: str,
        unit_of_measurement_id: str | UUID,
        item_status: ItemStatus = ItemStatus.ACTIVE,
        brand_id: Optional[str | UUID] = None,
        category_id: Optional[str | UUID] = None,
        rental_rate_per_period: Optional[Decimal] = None,
        rental_period: int = 1,
        sale_price: Optional[Decimal] = None,
        purchase_price: Optional[Decimal] = None,
        security_deposit: Decimal = Decimal("0.00"),
        description: Optional[str] = None,
        specifications: Optional[str] = None,
        model_number: Optional[str] = None,
        serial_number_required: bool = False,
        warranty_period_days: int = 0,
        reorder_point: int = 0,
        is_rentable: bool = True,
        is_saleable: bool = False,
        is_rental_blocked: bool = False,
        rental_block_reason: Optional[str] = None,
        rental_blocked_at: Optional[datetime] = None,
        rental_blocked_by: Optional[str | UUID] = None,
        **kwargs
    ):
        """
        Initialize an Item.
        
        Args:
            sku: Stock Keeping Unit
            item_name: Item name
            unit_of_measurement_id: Unit of measurement ID (required)
            item_status: Status of item
            brand_id: Brand ID
            category_id: Category ID
            rental_rate_per_period: Rental rate per period
            rental_period: Rental period specification
            sale_price: Sale price
            purchase_price: Purchase price
            security_deposit: Security deposit amount
            description: Item description
            specifications: Item specifications
            model_number: Model number
            serial_number_required: Whether serial number is required
            warranty_period_days: Warranty period in days
            reorder_point: Reorder point threshold
            is_rentable: Item can be rented (default: True)
            is_saleable: Item can be sold (default: False)
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.sku = sku
        self.item_name = item_name
        self.unit_of_measurement_id = unit_of_measurement_id
        self.item_status = item_status.value if isinstance(item_status, ItemStatus) else item_status
        self.brand_id = brand_id
        self.category_id = category_id
        self.rental_rate_per_period = rental_rate_per_period
        self.rental_period = rental_period
        self.sale_price = sale_price
        self.purchase_price = purchase_price
        self.security_deposit = security_deposit
        self.description = description
        self.specifications = specifications
        self.model_number = model_number
        self.serial_number_required = serial_number_required
        self.warranty_period_days = warranty_period_days
        self.reorder_point = reorder_point
        self.is_rentable = is_rentable
        self.is_saleable = is_saleable
        self.is_rental_blocked = is_rental_blocked
        self.rental_block_reason = rental_block_reason
        self.rental_blocked_at = rental_blocked_at
        self.rental_blocked_by = rental_blocked_by
        self._validate()
    
    def _validate(self):
        """Validate item business rules."""
        # Name validation
        if not self.item_name or not self.item_name.strip():
            raise ValueError("Item name cannot be empty")
        
        if len(self.item_name) > 200:
            raise ValueError("Item name cannot exceed 200 characters")
        
        # Status validation
        if self.item_status not in [status.value for status in ItemStatus]:
            raise ValueError(f"Invalid item status: {self.item_status}")
        
        # Boolean field validation
        if hasattr(self, 'is_rentable') and hasattr(self, 'is_saleable'):
            if self.is_rentable and self.is_saleable:
                raise ValueError("Item cannot be both rentable and saleable - these are mutually exclusive")
            if not self.is_rentable and not self.is_saleable:
                raise ValueError("Item must be either rentable or saleable")
        
        # Price validation
        if self.rental_rate_per_period and self.rental_rate_per_period < 0:
            raise ValueError("Rental rate per period cannot be negative")
        
        if self.sale_price and self.sale_price < 0:
            raise ValueError("Sale price cannot be negative")
        
        if self.purchase_price and self.purchase_price < 0:
            raise ValueError("Purchase price cannot be negative")
        
        if self.security_deposit < 0:
            raise ValueError("Security deposit cannot be negative")
        
        # Rental period validation
        if self.rental_period is not None:
            if not isinstance(self.rental_period, int) or self.rental_period <= 0:
                raise ValueError("Rental period must be a positive integer")
        
        # Warranty period validation
        if self.warranty_period_days is not None:
            if not isinstance(self.warranty_period_days, int) or self.warranty_period_days < 0:
                raise ValueError("Warranty period must be a non-negative integer")
        
        # Reorder point validation
        if hasattr(self, 'reorder_point'):
            # Convert to int if it's a string
            if isinstance(self.reorder_point, str):
                try:
                    self.reorder_point = int(self.reorder_point)
                except ValueError:
                    raise ValueError("Reorder point must be a valid integer")
            if self.reorder_point < 0:
                raise ValueError("Reorder point cannot be negative")
    
    
    def is_rental_item(self) -> bool:
        """Check if item is available for rental."""
        return self.is_rentable
    
    def is_sale_item(self) -> bool:
        """Check if item is available for sale."""
        return self.is_saleable
    
    def is_item_active(self) -> bool:
        """Check if item is active."""
        return self.item_status == ItemStatus.ACTIVE.value and super().is_active
    
    def is_discontinued(self) -> bool:
        """Check if item is discontinued."""
        return self.item_status == ItemStatus.DISCONTINUED.value
    
    def can_be_rented(self) -> bool:
        """Check if item can be rented (includes rental block check)."""
        return (
            self.is_rental_item() and 
            self.is_item_active() and 
            self.rental_rate_per_period and 
            not self.is_rental_blocked
        )
    
    def can_be_sold(self) -> bool:
        """Check if item can be sold."""
        # Allow items to be sold even with zero or null price
        # Business may want to give items for free or set price dynamically
        return self.is_sale_item() and self.is_item_active()
    
    @property
    def display_name(self) -> str:
        """Get item display name."""
        return f"{self.item_name} ({self.sku})"
    
    @property
    def total_inventory_units(self) -> int:
        """Get total number of inventory units."""
        return len(self.inventory_units) if self.inventory_units else 0
    
    @property
    def available_units(self) -> int:
        """Get number of available inventory units."""
        if not self.inventory_units:
            return 0
        from app.modules.inventory.models import InventoryUnitStatus
        return len([unit for unit in self.inventory_units if unit.status == InventoryUnitStatus.AVAILABLE.value])
    
    @property
    def rented_units(self) -> int:
        """Get number of rented inventory units."""
        if not self.inventory_units:
            return 0
        from app.modules.inventory.models import InventoryUnitStatus
        return len([unit for unit in self.inventory_units if unit.status == InventoryUnitStatus.RENTED.value])
    
    def is_low_stock(self) -> bool:
        """Check if item stock is below reorder point."""
        if not hasattr(self, 'reorder_point') or self.reorder_point is None:
            return False
        # Ensure reorder_point is converted to int for comparison
        reorder_point_int = int(self.reorder_point) if isinstance(self.reorder_point, str) else self.reorder_point
        return self.available_units <= reorder_point_int
    
    @property
    def stock_status(self) -> str:
        """Get current stock status."""
        if self.available_units == 0:
            return "OUT_OF_STOCK"
        elif self.is_low_stock():
            return "LOW_STOCK"
        else:
            return "IN_STOCK"
    
    def __str__(self) -> str:
        """String representation of item."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of item."""
        return (
            f"Item(id={self.id}, sku='{self.sku}', "
            f"name='{self.item_name}', status='{self.item_status}', "
            f"rentable={self.is_rentable}, saleable={self.is_saleable}, active={self.is_active})"
        )