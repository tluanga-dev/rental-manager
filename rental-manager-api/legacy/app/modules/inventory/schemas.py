from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class StockSchema(BaseModel):
    total: int = Field(ge=0)
    available: int = Field(ge=0)
    rented: int = Field(ge=0)
    status: str


class ItemInventorySchema(BaseModel):
    sku: str
    item_name: str
    item_status: str
    brand: Optional[str] = None
    category: Optional[str] = None
    unit_of_measurement: Optional[str] = None
    rental_rate: Optional[float] = None
    sale_price: Optional[float] = None
    total_value: float = Field(ge=0, description="Total inventory value (quantity × valuation price)")
    stock: StockSchema


class InventoryFilterParams(BaseModel):
    """Query parameters for filtering and sorting inventory data."""
    
    # Search parameters
    search: Optional[str] = Field(None, description="Search across item_name, sku, brand, category")
    sku: Optional[str] = Field(None, description="Filter by SKU")
    item_name: Optional[str] = Field(None, description="Filter by item name (partial match)")
    brand: Optional[str] = Field(None, description="Filter by brand name")
    category: Optional[str] = Field(None, description="Filter by category name")
    item_status: Optional[str] = Field(None, description="Filter by item status")
    
    # Stock filters
    stock_status: Optional[str] = Field(None, description="Filter by stock status: IN_STOCK, LOW_STOCK, OUT_OF_STOCK")
    min_total: Optional[int] = Field(None, ge=0, description="Minimum total quantity")
    max_total: Optional[int] = Field(None, ge=0, description="Maximum total quantity")
    min_available: Optional[int] = Field(None, ge=0, description="Minimum available quantity")
    max_available: Optional[int] = Field(None, ge=0, description="Maximum available quantity")
    
    # Sorting parameters
    sort_by: Optional[str] = Field("item_name", description="Field to sort by")
    sort_order: Optional[str] = Field("asc", description="Sort order: asc or desc")
    
    # Pagination
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")


# InventoryUnit Schemas
class InventoryUnitBase(BaseModel):
    """Base schema for inventory unit data."""
    serial_number: Optional[str] = Field(None, max_length=100)
    status: str = Field(default="AVAILABLE")
    condition: str = Field(default="NEW")
    purchase_date: Optional[datetime] = None
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    warranty_expiry: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    notes: Optional[str] = None
    
    # New fields migrated from Item model
    sale_price: Optional[Decimal] = Field(None, ge=0, description="Sale price per unit")
    security_deposit: Decimal = Field(default=Decimal("0.00"), ge=0, description="Security deposit per unit")
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0, description="Rental rate per period")
    rental_period: int = Field(default=1, ge=1, description="Rental period (number of periods)")
    model_number: Optional[str] = Field(None, max_length=100, description="Model number")
    warranty_period_days: int = Field(default=0, ge=0, description="Warranty period in days")
    
    # New batch tracking fields
    batch_code: Optional[str] = Field(None, max_length=50, description="Batch code for tracking")
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0, description="Quantity in this unit/batch")
    remarks: Optional[str] = Field(None, description="Additional remarks or notes")
    
    model_config = ConfigDict(from_attributes=True)


class InventoryUnitCreate(InventoryUnitBase):
    """Schema for creating a new inventory unit."""
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    sku: str = Field(..., max_length=50, description="Stock Keeping Unit")


class InventoryUnitUpdate(BaseModel):
    """Schema for updating an inventory unit."""
    serial_number: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = None
    condition: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    warranty_expiry: Optional[datetime] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    notes: Optional[str] = None
    
    # Updatable pricing fields
    sale_price: Optional[Decimal] = Field(None, ge=0)
    security_deposit: Optional[Decimal] = Field(None, ge=0)
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0)
    rental_period: Optional[int] = Field(None, ge=1)
    model_number: Optional[str] = Field(None, max_length=100)
    warranty_period_days: Optional[int] = Field(None, ge=0)
    
    # Updatable batch fields
    batch_code: Optional[str] = Field(None, max_length=50)
    quantity: Optional[Decimal] = Field(None, gt=0)
    remarks: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class InventoryUnitResponse(InventoryUnitBase):
    """Schema for inventory unit response."""
    id: UUID
    item_id: UUID
    location_id: UUID
    sku: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Related item info (optional, for detailed responses)
    item_name: Optional[str] = None
    location_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class InventoryUnitWithRelations(InventoryUnitResponse):
    """Schema for inventory unit with related data."""
    item: Optional[dict] = None  # Item details
    location: Optional[dict] = None  # Location details
    
    model_config = ConfigDict(from_attributes=True)


# Batch operation schemas
class BatchInventoryCreate(BaseModel):
    """Schema for creating multiple inventory units in a batch."""
    item_id: UUID
    location_id: UUID
    batch_code: str = Field(..., max_length=50, description="Batch code for all units")
    quantity: int = Field(..., ge=1, description="Number of units to create")
    purchase_price: Decimal = Field(..., ge=0)
    sale_price: Optional[Decimal] = Field(None, ge=0)
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0)
    security_deposit: Decimal = Field(default=Decimal("0.00"), ge=0)
    rental_period: int = Field(default=1, ge=1)
    model_number: Optional[str] = Field(None, max_length=100)
    warranty_period_days: int = Field(default=0, ge=0)
    purchase_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    remarks: Optional[str] = None
    
    # Optional serial numbers for specific units
    serial_numbers: Optional[List[str]] = Field(None, description="Serial numbers for individual units")
    
    model_config = ConfigDict(from_attributes=True)


# Rental rate update schemas
class UpdateInventoryUnitRentalRateRequest(BaseModel):
    """Schema for updating rental rate of a specific inventory unit."""
    rental_rate_per_period: Decimal = Field(..., ge=0, description="New rental rate per period")


class BatchUpdateInventoryUnitRentalRateRequest(BaseModel):
    """Schema for batch updating rental rates for inventory units by item and location."""
    item_id: UUID = Field(..., description="Item ID to update")
    location_id: UUID = Field(..., description="Location ID to update")
    rental_rate_per_period: Decimal = Field(..., ge=0, description="New rental rate per period")