"""
Inventory Unit Schemas.

Pydantic schemas for inventory unit operations.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.inventory.enums import InventoryUnitStatus, InventoryUnitCondition
from app.schemas.inventory.base import InventoryBaseSchema, TimestampMixin


class InventoryUnitBase(InventoryBaseSchema):
    """Base schema for inventory unit data."""
    serial_number: Optional[str] = Field(None, max_length=100, description="Serial number")
    batch_code: Optional[str] = Field(None, max_length=50, description="Batch code")
    barcode: Optional[str] = Field(None, max_length=100, description="Barcode")
    
    status: InventoryUnitStatus = Field(
        InventoryUnitStatus.AVAILABLE,
        description="Unit status"
    )
    condition: InventoryUnitCondition = Field(
        InventoryUnitCondition.NEW,
        description="Unit condition"
    )
    
    quantity: Decimal = Field(1, gt=0, description="Quantity in unit/batch")
    
    # Purchase information
    purchase_date: Optional[datetime] = Field(None, description="Purchase date")
    purchase_price: Decimal = Field(0, ge=0, description="Purchase price")
    supplier_id: Optional[UUID] = Field(None, description="Supplier ID")
    purchase_order_number: Optional[str] = Field(None, max_length=100)
    
    # Pricing
    sale_price: Optional[Decimal] = Field(None, ge=0, description="Sale price")
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0, description="Rental rate")
    rental_period: int = Field(1, gt=0, description="Rental period in days")
    security_deposit: Decimal = Field(0, ge=0, description="Security deposit")
    
    # Product details
    model_number: Optional[str] = Field(None, max_length=100)
    manufacturer: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    
    # Warranty
    warranty_expiry: Optional[datetime] = Field(None, description="Warranty expiry")
    warranty_provider: Optional[str] = Field(None, max_length=100)
    warranty_terms: Optional[str] = Field(None, description="Warranty terms")
    
    # Maintenance
    last_maintenance_date: Optional[datetime] = Field(None)
    next_maintenance_date: Optional[datetime] = Field(None)
    
    notes: Optional[str] = Field(None, description="General notes")
    
    @field_validator('quantity', 'purchase_price', 'security_deposit')
    @classmethod
    def validate_decimals(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    @field_validator('sale_price', 'rental_rate_per_period')
    @classmethod
    def validate_optional_decimals(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return v.quantize(Decimal("0.01"))
        return v
    
    @model_validator(mode='after')
    def validate_identification(self) -> 'InventoryUnitBase':
        """Ensure either serial or batch is provided."""
        if not self.serial_number and not self.batch_code:
            raise ValueError("Either serial number or batch code is required")
        
        # Serialized items should have quantity of 1
        if self.serial_number and self.quantity != Decimal("1"):
            raise ValueError("Serialized items must have quantity of 1")
        
        return self
    
    @model_validator(mode='after')
    def validate_dates(self) -> 'InventoryUnitBase':
        """Validate date relationships."""
        if self.purchase_date and self.warranty_expiry:
            if self.purchase_date > self.warranty_expiry:
                raise ValueError("Warranty expires before purchase date")
        
        if self.last_maintenance_date and self.next_maintenance_date:
            if self.last_maintenance_date > self.next_maintenance_date:
                raise ValueError("Next maintenance before last maintenance")
        
        return self


class InventoryUnitCreate(InventoryUnitBase):
    """Schema for creating inventory units."""
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    sku: str = Field(..., max_length=50, description="Unit SKU")
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("SKU is required")
        if len(v) > 50:
            raise ValueError("SKU too long (max 50 characters)")
        return v


class InventoryUnitUpdate(BaseModel):
    """Schema for updating inventory units."""
    status: Optional[InventoryUnitStatus] = Field(None)
    condition: Optional[InventoryUnitCondition] = Field(None)
    
    location_id: Optional[UUID] = Field(None, description="New location")
    
    sale_price: Optional[Decimal] = Field(None, ge=0)
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0)
    rental_period: Optional[int] = Field(None, gt=0)
    security_deposit: Optional[Decimal] = Field(None, ge=0)
    
    model_number: Optional[str] = Field(None, max_length=100)
    manufacturer: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    
    warranty_expiry: Optional[datetime] = Field(None)
    next_maintenance_date: Optional[datetime] = Field(None)
    
    notes: Optional[str] = Field(None)


class InventoryUnitResponse(InventoryUnitBase, TimestampMixin):
    """Schema for inventory unit response."""
    id: UUID = Field(..., description="Unit ID")
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    sku: str = Field(..., description="Unit SKU")
    
    original_location_id: Optional[UUID] = Field(None)
    current_holder_id: Optional[UUID] = Field(None)
    
    total_rental_hours: Decimal = Field(0, description="Total rental time")
    total_rental_count: int = Field(0, description="Times rented")
    
    is_rental_blocked: bool = Field(False)
    rental_block_reason: Optional[str] = Field(None)
    rental_blocked_at: Optional[datetime] = Field(None)
    rental_blocked_by_id: Optional[UUID] = Field(None)
    
    version: int = Field(1, description="Version for locking")
    
    # Computed properties
    is_available: bool = Field(..., description="Available for operations")
    can_be_rented: bool = Field(..., description="Can be rented")
    is_maintenance_due: bool = Field(..., description="Maintenance due")
    is_warranty_valid: bool = Field(..., description="Warranty valid")
    age_in_days: Optional[int] = Field(None, description="Age since purchase")


class InventoryUnitWithRelations(InventoryUnitResponse):
    """Inventory unit with related data."""
    item_name: str = Field(..., description="Item name")
    item_sku: str = Field(..., description="Item SKU")
    location_name: str = Field(..., description="Current location")
    original_location_name: Optional[str] = Field(None)
    supplier_name: Optional[str] = Field(None)
    current_holder_name: Optional[str] = Field(None)


class InventoryUnitFilter(BaseModel):
    """Filter parameters for inventory units."""
    item_id: Optional[UUID] = Field(None)
    location_id: Optional[UUID] = Field(None)
    supplier_id: Optional[UUID] = Field(None)
    
    status: Optional[InventoryUnitStatus] = Field(None)
    condition: Optional[InventoryUnitCondition] = Field(None)
    
    serial_number: Optional[str] = Field(None)
    batch_code: Optional[str] = Field(None)
    barcode: Optional[str] = Field(None)
    
    is_available: Optional[bool] = Field(None)
    is_rental_blocked: Optional[bool] = Field(None)
    is_maintenance_due: Optional[bool] = Field(None)
    has_valid_warranty: Optional[bool] = Field(None)
    
    purchase_date_from: Optional[datetime] = Field(None)
    purchase_date_to: Optional[datetime] = Field(None)
    
    min_price: Optional[Decimal] = Field(None, ge=0)
    max_price: Optional[Decimal] = Field(None, ge=0)


class BatchInventoryUnitCreate(BaseModel):
    """Create multiple inventory units in batch."""
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    
    quantity: int = Field(..., ge=1, le=1000, description="Number of units")
    
    # Common data for all units
    batch_code: Optional[str] = Field(None, max_length=50)
    purchase_date: Optional[datetime] = Field(None)
    purchase_price: Decimal = Field(0, ge=0)
    supplier_id: Optional[UUID] = Field(None)
    purchase_order_number: Optional[str] = Field(None, max_length=100)
    
    sale_price: Optional[Decimal] = Field(None, ge=0)
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0)
    security_deposit: Decimal = Field(0, ge=0)
    
    warranty_expiry: Optional[datetime] = Field(None)
    
    # Optional serial numbers
    serial_numbers: Optional[List[str]] = Field(None, max_items=1000)
    
    @model_validator(mode='after')
    def validate_serial_numbers(self) -> 'BatchInventoryUnitCreate':
        """Validate serial numbers if provided."""
        if self.serial_numbers:
            if len(self.serial_numbers) != self.quantity:
                raise ValueError(
                    f"Number of serial numbers ({len(self.serial_numbers)}) "
                    f"must match quantity ({self.quantity})"
                )
            
            # Check for duplicates
            if len(set(self.serial_numbers)) != len(self.serial_numbers):
                raise ValueError("Duplicate serial numbers found")
        
        return self


class UnitStatusChange(BaseModel):
    """Change unit status."""
    status: InventoryUnitStatus = Field(..., description="New status")
    reason: str = Field(..., min_length=3, max_length=500)
    notes: Optional[str] = Field(None)
    
    # For specific status changes
    customer_id: Optional[UUID] = Field(None, description="For rental")
    repair_vendor_id: Optional[UUID] = Field(None, description="For repair")
    new_condition: Optional[InventoryUnitCondition] = Field(None)


class UnitTransfer(BaseModel):
    """Transfer unit to another location."""
    new_location_id: UUID = Field(..., description="Destination location")
    reason: str = Field(..., min_length=3, max_length=500)
    transfer_date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = Field(None)


class RentalBlock(BaseModel):
    """Block/unblock unit from rental."""
    block: bool = Field(..., description="Block or unblock")
    reason: str = Field(..., min_length=3, max_length=500)
    
    @model_validator(mode='after')
    def validate_block(self) -> 'RentalBlock':
        """Validate block operation."""
        if self.block and not self.reason:
            raise ValueError("Reason required for blocking")
        return self


class MaintenanceSchedule(BaseModel):
    """Schedule maintenance for unit."""
    next_maintenance_date: datetime = Field(..., description="Next maintenance")
    maintenance_type: str = Field(..., min_length=3, max_length=100)
    estimated_duration_hours: Optional[int] = Field(None, gt=0)
    vendor_id: Optional[UUID] = Field(None)
    notes: Optional[str] = Field(None)
    
    @field_validator('next_maintenance_date')
    @classmethod
    def validate_future_date(cls, v: datetime) -> datetime:
        if v <= datetime.utcnow():
            raise ValueError("Maintenance date must be in the future")
        return v


class UnitValuation(BaseModel):
    """Valuation information for unit."""
    unit_id: UUID = Field(..., description="Unit ID")
    purchase_price: Decimal = Field(..., description="Original price")
    current_value: Decimal = Field(..., description="Current value")
    depreciation_rate: float = Field(..., description="Annual depreciation %")
    age_in_days: int = Field(..., description="Age of unit")
    total_rental_revenue: Decimal = Field(..., description="Total rental income")
    roi_percentage: float = Field(..., description="Return on investment %")


# Alias for API compatibility
InventoryUnitBulkCreate = BatchInventoryUnitCreate


class InventoryUnitStatusUpdate(BaseModel):
    """Schema for updating unit status."""
    status: InventoryUnitStatus = Field(..., description="New status")
    reason: str = Field(..., min_length=3, description="Reason for status change")


class RentalBlock(BaseModel):
    """Schema for rental block information."""
    reason: str = Field(..., description="Reason for blocking")
    blocked_until: Optional[datetime] = Field(None, description="Block end date")


class MaintenanceRecord(BaseModel):
    """Schema for maintenance record."""
    maintenance_type: str = Field(..., description="Type of maintenance")
    description: str = Field(..., description="Maintenance description")
    cost: Optional[Decimal] = Field(None, ge=0, description="Maintenance cost")
    performed_by: Optional[str] = Field(None, description="Who performed maintenance")
    next_maintenance_date: Optional[datetime] = Field(None, description="Next maintenance date")