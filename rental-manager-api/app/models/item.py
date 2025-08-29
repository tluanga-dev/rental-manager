"""Item model for the rental manager system."""

from typing import Optional, TYPE_CHECKING, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from sqlalchemy import (
    Column, String, Text, Boolean, Numeric, DateTime, Integer, Index, ForeignKey, event
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID as SA_UUID

from app.db.base import RentalManagerBaseModel

if TYPE_CHECKING:
    from app.models.brand import Brand
    from app.models.category import Category
    from app.models.unit_of_measurement import UnitOfMeasurement
    from app.models.transaction import TransactionLine
    from app.models.inventory import InventoryUnit, StockMovement, StockLevel


class Item(RentalManagerBaseModel):
    """
    Item model representing products in the rental/sale inventory.
    
    Attributes:
        # Basic Information
        item_name: Name of the item
        sku: Stock Keeping Unit (auto-generated)
        description: Detailed description
        short_description: Brief description
        
        # Relationships
        brand_id: Foreign key to Brand
        category_id: Foreign key to Category
        unit_of_measurement_id: Foreign key to UnitOfMeasurement
        
        # Physical Properties
        weight: Item weight in kg
        dimensions_length: Length in cm
        dimensions_width: Width in cm
        dimensions_height: Height in cm
        color: Item color
        material: Material composition
        
        # Business Configuration
        is_rentable: Whether item can be rented
        is_salable: Whether item can be sold
        requires_serial_number: Whether serial numbers are required
        
        # Pricing
        cost_price: Cost to acquire the item
        sale_price: Selling price
        rental_rate_per_day: Daily rental rate
        security_deposit: Required deposit for rentals
        
        # Rental Blocking
        is_rental_blocked: Whether rental is blocked
        rental_block_reason: Reason for blocking
        rental_blocked_at: When rental was blocked
        rental_blocked_by: UUID of user who blocked
        
        # Inventory
        reorder_level: Minimum stock level
        maximum_stock_level: Maximum stock level
        
        # Status and Notes
        status: Current status
        notes: Additional notes
        tags: Comma-separated tags
        
        # Audit
        last_maintenance_date: Last maintenance performed
        warranty_expiry_date: Warranty expiration
    """
    
    __tablename__ = "items"
    
    # Basic Information
    item_name = Column(
        String(255), 
        nullable=False, 
        index=True,
        comment="Name of the item"
    )
    
    sku = Column(
        String(50), 
        nullable=False, 
        unique=True, 
        index=True,
        comment="Stock Keeping Unit (auto-generated)"
    )
    
    description = Column(
        Text, 
        nullable=True,
        comment="Detailed description of the item"
    )
    
    short_description = Column(
        String(500), 
        nullable=True,
        comment="Brief description for listings"
    )
    
    # Foreign Key Relationships
    brand_id = Column(
        SA_UUID(as_uuid=True), 
        ForeignKey("brands.id"), 
        nullable=True, 
        index=True,
        comment="Brand ID"
    )
    
    category_id = Column(
        SA_UUID(as_uuid=True), 
        ForeignKey("categories.id"), 
        nullable=True, 
        index=True,
        comment="Category ID"
    )
    
    unit_of_measurement_id = Column(
        SA_UUID(as_uuid=True), 
        ForeignKey("unit_of_measurements.id"), 
        nullable=True, 
        index=True,
        comment="Unit of measurement ID"
    )
    
    # Physical Properties
    weight = Column(
        Numeric(10, 3), 
        nullable=True,
        comment="Weight in kg"
    )
    
    dimensions_length = Column(
        Numeric(10, 2), 
        nullable=True,
        comment="Length in cm"
    )
    
    dimensions_width = Column(
        Numeric(10, 2), 
        nullable=True,
        comment="Width in cm"
    )
    
    dimensions_height = Column(
        Numeric(10, 2), 
        nullable=True,
        comment="Height in cm"
    )
    
    color = Column(
        String(50), 
        nullable=True,
        comment="Item color"
    )
    
    material = Column(
        String(100), 
        nullable=True,
        comment="Material composition"
    )
    
    # Business Configuration
    is_rentable = Column(
        Boolean, 
        nullable=False, 
        default=True, 
        index=True,
        comment="Whether item can be rented"
    )
    
    is_salable = Column(
        Boolean, 
        nullable=False, 
        default=True, 
        index=True,
        comment="Whether item can be sold"
    )
    
    requires_serial_number = Column(
        Boolean, 
        nullable=False, 
        default=False,
        comment="Whether serial numbers are required"
    )
    
    # Pricing (stored as integers to avoid decimal precision issues)
    cost_price = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Cost to acquire the item"
    )
    
    sale_price = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Selling price"
    )
    
    rental_rate_per_day = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Daily rental rate"
    )
    
    security_deposit = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Required deposit for rentals"
    )
    
    # Rental Blocking
    is_rental_blocked = Column(
        Boolean, 
        nullable=False, 
        default=False, 
        index=True,
        comment="Whether rental is currently blocked"
    )
    
    rental_block_reason = Column(
        String(500), 
        nullable=True,
        comment="Reason for blocking rental"
    )
    
    rental_blocked_at = Column(
        DateTime(timezone=True), 
        nullable=True,
        comment="When rental was blocked"
    )
    
    rental_blocked_by = Column(
        SA_UUID(as_uuid=True), 
        nullable=True,
        comment="UUID of user who blocked rental"
    )
    
    # Inventory Management
    reorder_level = Column(
        Integer, 
        nullable=True, 
        default=1,
        comment="Minimum stock level before reordering"
    )
    
    maximum_stock_level = Column(
        Integer, 
        nullable=True,
        comment="Maximum stock level"
    )
    
    # Status and Notes
    status = Column(
        String(50), 
        nullable=False, 
        default="ACTIVE", 
        index=True,
        comment="Current item status"
    )
    
    notes = Column(
        Text, 
        nullable=True,
        comment="Additional notes about the item"
    )
    
    tags = Column(
        String(1000), 
        nullable=True,
        comment="Comma-separated tags for search"
    )
    
    # Maintenance and Warranty
    last_maintenance_date = Column(
        DateTime(timezone=True), 
        nullable=True,
        comment="Last maintenance performed"
    )
    
    warranty_expiry_date = Column(
        DateTime(timezone=True), 
        nullable=True,
        comment="Warranty expiration date"
    )
    
    # Relationships
    brand = relationship("Brand", back_populates="items", lazy="select")
    category = relationship("Category", back_populates="items", lazy="select")
    unit_of_measurement = relationship("UnitOfMeasurement", back_populates="items", lazy="select")
    transaction_lines = relationship("TransactionLine", back_populates="item", lazy="dynamic")
    
    # Inventory relationships
    inventory_units = relationship("InventoryUnit", back_populates="item", lazy="select")
    stock_movements = relationship("StockMovement", back_populates="item", lazy="dynamic")
    stock_levels = relationship("StockLevel", back_populates="item", lazy="select")
    
    # Rental pricing relationship
    rental_pricing = relationship("RentalPricing", back_populates="item", lazy="select", cascade="all, delete-orphan")
    
    # Indexes for performance optimization
    __table_args__ = (
        # Core search indexes
        Index('idx_item_name_active', 'item_name', 'is_active'),
        Index('idx_item_sku_active', 'sku', 'is_active'),
        Index('idx_item_status_active', 'status', 'is_active'),
        
        # Relationship indexes
        Index('idx_item_brand_active', 'brand_id', 'is_active'),
        Index('idx_item_category_active', 'category_id', 'is_active'),
        Index('idx_item_unit_active', 'unit_of_measurement_id', 'is_active'),
        
        # Business logic indexes
        Index('idx_item_rentable_active', 'is_rentable', 'is_active'),
        Index('idx_item_salable_active', 'is_salable', 'is_active'),
        Index('idx_item_rental_blocked', 'is_rental_blocked', 'is_active'),
        
        # Pricing indexes
        Index('idx_item_sale_price', 'sale_price'),
        Index('idx_item_rental_rate', 'rental_rate_per_day'),
        
        # Composite indexes for common queries
        Index('idx_item_category_rentable', 'category_id', 'is_rentable', 'is_active'),
        Index('idx_item_brand_salable', 'brand_id', 'is_salable', 'is_active'),
        Index('idx_item_search_text', 'item_name', 'short_description'),
    )
    
    def __init__(
        self,
        item_name: str,
        sku: str,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        unit_of_measurement_id: Optional[UUID] = None,
        description: Optional[str] = None,
        short_description: Optional[str] = None,
        is_rentable: bool = True,
        is_salable: bool = True,
        cost_price: Optional[Decimal] = None,
        sale_price: Optional[Decimal] = None,
        rental_rate_per_day: Optional[Decimal] = None,
        security_deposit: Optional[Decimal] = None,
        **kwargs
    ):
        """
        Initialize an Item.
        
        Args:
            item_name: Name of the item
            sku: Stock Keeping Unit
            brand_id: Optional brand ID
            category_id: Optional category ID
            unit_of_measurement_id: Optional unit of measurement ID
            description: Detailed description
            short_description: Brief description
            is_rentable: Whether item can be rented
            is_salable: Whether item can be sold
            cost_price: Cost price
            sale_price: Selling price
            rental_rate_per_day: Daily rental rate
            security_deposit: Security deposit amount
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.item_name = item_name
        self.sku = sku
        self.brand_id = brand_id
        self.category_id = category_id
        self.unit_of_measurement_id = unit_of_measurement_id
        self.description = description
        self.short_description = short_description
        self.is_rentable = is_rentable
        self.is_salable = is_salable
        self.cost_price = cost_price
        self.sale_price = sale_price
        self.rental_rate_per_day = rental_rate_per_day
        self.security_deposit = security_deposit
        self._validate()
    
    def _validate(self):
        """Validate item business rules."""
        # Basic validation
        if not self.item_name or not self.item_name.strip():
            raise ValueError("Item name cannot be empty")
        
        if len(self.item_name) > 255:
            raise ValueError("Item name cannot exceed 255 characters")
        
        if not self.sku or not self.sku.strip():
            raise ValueError("SKU cannot be empty")
        
        if len(self.sku) > 50:
            raise ValueError("SKU cannot exceed 50 characters")
        
        # Pricing validation
        if self.cost_price and self.cost_price < 0:
            raise ValueError("Cost price cannot be negative")
        
        if self.sale_price and self.sale_price < 0:
            raise ValueError("Sale price cannot be negative")
        
        if self.rental_rate_per_day and self.rental_rate_per_day < 0:
            raise ValueError("Rental rate cannot be negative")
        
        if self.security_deposit and self.security_deposit < 0:
            raise ValueError("Security deposit cannot be negative")
        
        # Business logic validation
        if self.cost_price and self.sale_price:
            if self.sale_price <= self.cost_price:
                raise ValueError("Sale price must be greater than cost price")
        
        if not self.is_rentable and not self.is_salable:
            raise ValueError("Item must be either rentable or salable (or both)")
    
    @validates('item_name')
    def validate_item_name(self, key, value):
        """Validate item name."""
        if not value or not value.strip():
            raise ValueError("Item name cannot be empty")
        if len(value) > 255:
            raise ValueError("Item name cannot exceed 255 characters")
        return value.strip()
    
    @validates('sku')
    def validate_sku(self, key, value):
        """Validate SKU."""
        if not value or not value.strip():
            raise ValueError("SKU cannot be empty")
        if len(value) > 50:
            raise ValueError("SKU cannot exceed 50 characters")
        return value.strip().upper()
    
    @validates('cost_price', 'sale_price', 'rental_rate_per_day', 'security_deposit')
    def validate_prices(self, key, value):
        """Validate price fields."""
        if value is not None and value < 0:
            raise ValueError(f"{key.replace('_', ' ').title()} cannot be negative")
        return value
    
    def can_be_rented(self) -> bool:
        """Check if item can be rented."""
        return (
            self.is_active and 
            self.is_rentable and 
            not self.is_rental_blocked and
            self.status == "ACTIVE"
        )
    
    def can_be_sold(self) -> bool:
        """Check if item can be sold."""
        return (
            self.is_active and 
            self.is_salable and 
            self.status == "ACTIVE"
        )
    
    def block_rental(self, reason: str, blocked_by: UUID) -> None:
        """Block item from being rented."""
        self.is_rental_blocked = True
        self.rental_block_reason = reason
        self.rental_blocked_at = datetime.utcnow()
        self.rental_blocked_by = blocked_by
    
    def unblock_rental(self) -> None:
        """Unblock item for rental."""
        self.is_rental_blocked = False
        self.rental_block_reason = None
        self.rental_blocked_at = None
        self.rental_blocked_by = None
    
    def update_pricing(
        self,
        cost_price: Optional[Decimal] = None,
        sale_price: Optional[Decimal] = None,
        rental_rate_per_day: Optional[Decimal] = None,
        security_deposit: Optional[Decimal] = None,
        updated_by: Optional[str] = None
    ):
        """Update item pricing."""
        if cost_price is not None:
            if cost_price < 0:
                raise ValueError("Cost price cannot be negative")
            self.cost_price = cost_price
        
        if sale_price is not None:
            if sale_price < 0:
                raise ValueError("Sale price cannot be negative")
            self.sale_price = sale_price
        
        if rental_rate_per_day is not None:
            if rental_rate_per_day < 0:
                raise ValueError("Rental rate cannot be negative")
            self.rental_rate_per_day = rental_rate_per_day
        
        if security_deposit is not None:
            if security_deposit < 0:
                raise ValueError("Security deposit cannot be negative")
            self.security_deposit = security_deposit
        
        # Validate pricing rules
        if self.cost_price and self.sale_price:
            if self.sale_price <= self.cost_price:
                raise ValueError("Sale price must be greater than cost price")
        
        if updated_by:
            self.updated_by = updated_by
    
    def get_best_rental_rate(self, rental_days: int) -> Optional[Decimal]:
        """
        Get the best rental rate for a given duration.
        
        This method checks the rental pricing tiers first, then falls back to the
        daily rate if no structured pricing is available.
        
        Args:
            rental_days: Number of rental days
            
        Returns:
            Total rental cost for the period, or None if no pricing available
        """
        from datetime import date
        
        # Check if we have structured rental pricing
        if self.rental_pricing:
            applicable_pricing = []
            today = date.today()
            
            for pricing in self.rental_pricing:
                if pricing.is_applicable_for_duration(rental_days):
                    applicable_pricing.append(pricing)
            
            # Find the pricing tier with the lowest total cost
            if applicable_pricing:
                best_cost = None
                for pricing in applicable_pricing:
                    try:
                        cost = pricing.calculate_total_cost(rental_days)
                        if best_cost is None or cost < best_cost:
                            best_cost = cost
                    except ValueError:
                        continue
                
                if best_cost is not None:
                    return best_cost
        
        # Fallback to daily rate
        if self.rental_rate_per_day:
            return self.rental_rate_per_day * rental_days
        
        return None
    
    def get_daily_equivalent_rate(self, rental_days: int) -> Optional[Decimal]:
        """
        Get the daily equivalent rate for a given rental duration.
        
        Args:
            rental_days: Number of rental days
            
        Returns:
            Daily equivalent rate, or None if no pricing available
        """
        total_cost = self.get_best_rental_rate(rental_days)
        if total_cost and rental_days > 0:
            return total_cost / rental_days
        return None
    
    def has_structured_pricing(self) -> bool:
        """Check if item has structured rental pricing tiers."""
        return bool(self.rental_pricing and any(p.is_active for p in self.rental_pricing))
    
    @property
    def display_name(self) -> str:
        """Get display name for the item."""
        return f"{self.item_name} ({self.sku})"
    
    @property
    def profit_margin(self) -> Optional[Decimal]:
        """Calculate profit margin percentage."""
        if self.cost_price and self.sale_price and self.cost_price > 0:
            return ((self.sale_price - self.cost_price) / self.cost_price) * 100
        return None
    
    @property
    def dimensions(self) -> Optional[str]:
        """Get formatted dimensions string."""
        if all([self.dimensions_length, self.dimensions_width, self.dimensions_height]):
            return f"{self.dimensions_length} × {self.dimensions_width} × {self.dimensions_height} cm"
        return None
    
    @property
    def is_maintenance_due(self) -> bool:
        """Check if maintenance is due (more than 6 months since last maintenance)."""
        if not self.last_maintenance_date:
            return True
        
        from datetime import timedelta
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        return self.last_maintenance_date < six_months_ago
    
    @property
    def is_warranty_expired(self) -> bool:
        """Check if warranty has expired."""
        if not self.warranty_expiry_date:
            return False
        return self.warranty_expiry_date < datetime.utcnow()
    
    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "item_name": self.item_name,
            "sku": self.sku,
            "description": self.description,
            "short_description": self.short_description,
            "brand_id": str(self.brand_id) if self.brand_id else None,
            "category_id": str(self.category_id) if self.category_id else None,
            "unit_of_measurement_id": str(self.unit_of_measurement_id) if self.unit_of_measurement_id else None,
            "weight": float(self.weight) if self.weight else None,
            "dimensions": self.dimensions,
            "color": self.color,
            "material": self.material,
            "is_rentable": self.is_rentable,
            "is_salable": self.is_salable,
            "requires_serial_number": self.requires_serial_number,
            "cost_price": float(self.cost_price) if self.cost_price else None,
            "sale_price": float(self.sale_price) if self.sale_price else None,
            "rental_rate_per_day": float(self.rental_rate_per_day) if self.rental_rate_per_day else None,
            "security_deposit": float(self.security_deposit) if self.security_deposit else None,
            "profit_margin": float(self.profit_margin) if self.profit_margin else None,
            "is_rental_blocked": self.is_rental_blocked,
            "rental_block_reason": self.rental_block_reason,
            "rental_blocked_at": self.rental_blocked_at.isoformat() if self.rental_blocked_at else None,
            "reorder_level": self.reorder_level,
            "maximum_stock_level": self.maximum_stock_level,
            "status": self.status,
            "notes": self.notes,
            "tags": self.tags.split(",") if self.tags else [],
            "is_maintenance_due": self.is_maintenance_due,
            "is_warranty_expired": self.is_warranty_expired,
            "last_maintenance_date": self.last_maintenance_date.isoformat() if self.last_maintenance_date else None,
            "warranty_expiry_date": self.warranty_expiry_date.isoformat() if self.warranty_expiry_date else None,
            "can_be_rented": self.can_be_rented(),
            "can_be_sold": self.can_be_sold(),
            "display_name": self.display_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "updated_by": self.updated_by,
            "is_active": self.is_active
        }
    
    def __str__(self) -> str:
        """String representation of item."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of item."""
        return (
            f"Item(id={self.id}, name='{self.item_name}', "
            f"sku='{self.sku}', active={self.is_active})"
        )


# Auto-generate SKU if not provided
@event.listens_for(Item, "before_insert")
def generate_sku_on_insert(mapper, connection, target):
    """Auto-generate SKU if not provided during insert."""
    if not target.sku or target.sku == "AUTO":
        # SKU generation will be handled by the service layer
        # This is just a placeholder for now
        if not target.sku:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            target.sku = f"ITEM-{timestamp}"


# Update the related models to include the items relationship
# This will be needed after the Item model is created
def update_model_relationships():
    """Update related models with items relationship."""
    # This function should be called after all models are loaded
    # to establish bidirectional relationships
    pass