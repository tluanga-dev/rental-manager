"""
Stock Level Schemas.

Pydantic schemas for stock level operations.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.inventory.enums import StockStatus
from app.schemas.inventory.base import InventoryBaseSchema, TimestampMixin


class StockLevelBase(InventoryBaseSchema):
    """Base schema for stock level data."""
    quantity_on_hand: Decimal = Field(0, ge=0, description="Total physical quantity")
    quantity_available: Decimal = Field(0, ge=0, description="Available for operations")
    quantity_reserved: Decimal = Field(0, ge=0, description="Reserved quantity")
    quantity_on_rent: Decimal = Field(0, ge=0, description="Currently on rent")
    quantity_damaged: Decimal = Field(0, ge=0, description="Damaged quantity")
    quantity_under_repair: Decimal = Field(0, ge=0, description="Under repair")
    quantity_beyond_repair: Decimal = Field(0, ge=0, description="Beyond repair")
    
    reorder_point: Optional[Decimal] = Field(None, ge=0, description="Reorder trigger point")
    reorder_quantity: Optional[Decimal] = Field(None, ge=0, description="Quantity to reorder")
    maximum_stock: Optional[Decimal] = Field(None, ge=0, description="Maximum stock level")
    
    average_cost: Optional[Decimal] = Field(None, ge=0, description="Average cost per unit")
    last_purchase_cost: Optional[Decimal] = Field(None, ge=0, description="Last purchase cost")
    total_value: Optional[Decimal] = Field(None, ge=0, description="Total inventory value")
    
    @field_validator('quantity_on_hand', 'quantity_available', 'quantity_reserved',
                    'quantity_on_rent', 'quantity_damaged', 'quantity_under_repair',
                    'quantity_beyond_repair')
    @classmethod
    def validate_quantities(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Quantities cannot be negative")
        return v.quantize(Decimal("0.01"))
    
    @model_validator(mode='after')
    def validate_allocation(self) -> 'StockLevelBase':
        """Validate that allocated quantities match on-hand."""
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
        
        return self
    
    @model_validator(mode='after')
    def validate_reorder_settings(self) -> 'StockLevelBase':
        """Validate reorder settings."""
        if self.reorder_point is not None and self.maximum_stock is not None:
            if self.reorder_point > self.maximum_stock:
                raise ValueError("Reorder point cannot exceed maximum stock")
        
        return self


class StockLevelCreate(BaseModel):
    """Schema for creating a stock level."""
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    
    quantity_on_hand: Decimal = Field(0, ge=0, description="Initial quantity")
    reorder_point: Optional[Decimal] = Field(None, ge=0, description="Reorder point")
    reorder_quantity: Optional[Decimal] = Field(None, ge=0, description="Reorder quantity")
    maximum_stock: Optional[Decimal] = Field(None, ge=0, description="Maximum stock")
    
    average_cost: Optional[Decimal] = Field(None, ge=0, description="Initial average cost")
    
    @field_validator('quantity_on_hand')
    @classmethod
    def validate_initial_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class StockLevelUpdate(BaseModel):
    """Schema for updating stock level settings."""
    reorder_point: Optional[Decimal] = Field(None, ge=0, description="New reorder point")
    reorder_quantity: Optional[Decimal] = Field(None, ge=0, description="New reorder quantity")
    maximum_stock: Optional[Decimal] = Field(None, ge=0, description="New maximum stock")
    
    @model_validator(mode='after')
    def validate_settings(self) -> 'StockLevelUpdate':
        """Validate updated settings."""
        if self.reorder_point is not None and self.maximum_stock is not None:
            if self.reorder_point > self.maximum_stock:
                raise ValueError("Reorder point cannot exceed maximum stock")
        return self


class StockLevelResponse(StockLevelBase, TimestampMixin):
    """Schema for stock level response."""
    id: UUID = Field(..., description="Stock level ID")
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    
    last_counted_date: Optional[datetime] = Field(None, description="Last physical count")
    last_movement_date: Optional[datetime] = Field(None, description="Last movement")
    last_reorder_date: Optional[datetime] = Field(None, description="Last reorder")
    
    stock_status: StockStatus = Field(..., description="Current stock status")
    version: int = Field(..., description="Version for optimistic locking")
    
    # Computed properties
    utilization_rate: float = Field(..., description="Percentage on rent")
    availability_rate: float = Field(..., description="Percentage available")
    is_low_stock: bool = Field(..., description="Whether stock is low")
    is_overstocked: bool = Field(..., description="Whether overstocked")


class StockLevelWithRelations(StockLevelResponse):
    """Stock level with related data."""
    item_name: str = Field(..., description="Item name")
    item_sku: str = Field(..., description="Item SKU")
    location_name: str = Field(..., description="Location name")
    location_code: str = Field(..., description="Location code")


class StockLevelFilter(BaseModel):
    """Filter parameters for stock levels."""
    item_id: Optional[UUID] = Field(None, description="Filter by item")
    location_id: Optional[UUID] = Field(None, description="Filter by location")
    stock_status: Optional[StockStatus] = Field(None, description="Filter by status")
    
    has_stock: Optional[bool] = Field(None, description="Has any stock")
    is_available: Optional[bool] = Field(None, description="Has available stock")
    is_low_stock: Optional[bool] = Field(None, description="Below reorder point")
    is_overstocked: Optional[bool] = Field(None, description="Above maximum")
    
    min_quantity: Optional[Decimal] = Field(None, ge=0, description="Minimum on-hand")
    max_quantity: Optional[Decimal] = Field(None, ge=0, description="Maximum on-hand")


class StockAdjustment(BaseModel):
    """Schema for stock adjustments."""
    adjustment: Decimal = Field(..., description="Adjustment amount (+ or -)")
    reason: str = Field(..., min_length=3, max_length=500, description="Adjustment reason")
    affect_available: bool = Field(True, description="Adjust available quantity")
    performed_by_id: UUID = Field(..., description="User performing adjustment")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    @field_validator('adjustment')
    @classmethod
    def validate_adjustment(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("Adjustment cannot be zero")
        return v.quantize(Decimal("0.01"))


class StockReservation(BaseModel):
    """Schema for stock reservation."""
    quantity: Decimal = Field(..., gt=0, description="Quantity to reserve")
    transaction_id: Optional[UUID] = Field(None, description="Related transaction")
    expires_at: Optional[datetime] = Field(None, description="Reservation expiry")
    notes: Optional[str] = Field(None, description="Reservation notes")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    @field_validator('expires_at')
    @classmethod
    def validate_expiry(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v and v <= datetime.utcnow():
            raise ValueError("Expiry must be in the future")
        return v


class RentalOperation(BaseModel):
    """Schema for rental operations."""
    quantity: Decimal = Field(..., gt=0, description="Quantity for rental")
    customer_id: UUID = Field(..., description="Customer renting")
    transaction_id: UUID = Field(..., description="Rental transaction")
    expected_return_date: Optional[datetime] = Field(None, description="Expected return")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class RentalReturn(BaseModel):
    """Schema for rental returns."""
    quantity: Decimal = Field(..., gt=0, description="Total return quantity")
    damaged_quantity: Decimal = Field(0, ge=0, description="Damaged quantity")
    transaction_id: UUID = Field(..., description="Return transaction")
    condition_notes: Optional[str] = Field(None, description="Condition notes")
    
    @field_validator('quantity', 'damaged_quantity')
    @classmethod
    def validate_quantities(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    @model_validator(mode='after')
    def validate_damaged(self) -> 'RentalReturn':
        """Validate damaged quantity."""
        if self.damaged_quantity > self.quantity:
            raise ValueError("Damaged quantity cannot exceed total return")
        return self


class RepairOperation(BaseModel):
    """Schema for repair operations."""
    quantity: Decimal = Field(..., gt=0, description="Quantity for repair")
    repair_type: str = Field(..., description="Type of repair")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion")
    vendor_id: Optional[UUID] = Field(None, description="Repair vendor")
    cost_estimate: Optional[Decimal] = Field(None, ge=0, description="Estimated cost")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class StockTransfer(BaseModel):
    """Schema for stock transfers between locations."""
    from_location_id: UUID = Field(..., description="Source location")
    to_location_id: UUID = Field(..., description="Destination location")
    quantity: Decimal = Field(..., gt=0, description="Transfer quantity")
    transfer_reason: str = Field(..., min_length=3, description="Transfer reason")
    expected_arrival: Optional[datetime] = Field(None, description="Expected arrival")
    performed_by_id: UUID = Field(..., description="User performing transfer")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    @model_validator(mode='after')
    def validate_locations(self) -> 'StockTransfer':
        """Validate locations are different."""
        if self.from_location_id == self.to_location_id:
            raise ValueError("Source and destination must be different")
        return self


class MultiLocationStock(BaseModel):
    """Stock levels across multiple locations."""
    item_id: UUID = Field(..., description="Item ID")
    item_name: str = Field(..., description="Item name")
    item_sku: str = Field(..., description="Item SKU")
    
    total_on_hand: Decimal = Field(..., description="Total across locations")
    total_available: Decimal = Field(..., description="Total available")
    total_reserved: Decimal = Field(..., description="Total reserved")
    total_on_rent: Decimal = Field(..., description="Total on rent")
    
    locations: List[Dict[str, Any]] = Field(..., description="Stock by location")
    location_count: int = Field(..., description="Number of locations")
    
    primary_location_id: Optional[UUID] = Field(None, description="Primary location")
    primary_location_stock: Optional[Decimal] = Field(None, description="Primary location stock")


class StockAdjustment(BaseModel):
    """Schema for stock adjustments."""
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    adjustment_type: str = Field(..., description="Type of adjustment")
    quantity: Decimal = Field(..., description="Quantity to adjust")
    reason: str = Field(..., description="Reason for adjustment")
    reference_number: Optional[str] = Field(None, description="Reference number")


class TransferRequest(BaseModel):
    """Schema for stock transfer requests."""
    item_id: UUID = Field(..., description="Item ID")
    from_location_id: UUID = Field(..., description="Source location")
    to_location_id: UUID = Field(..., description="Destination location")
    quantity: Decimal = Field(..., gt=0, description="Quantity to transfer")
    reason: str = Field(..., description="Transfer reason")


class StockSummaryResponse(BaseModel):
    """Response schema for stock summary."""
    total_value: Decimal = Field(..., description="Total inventory value")
    total_units: Decimal = Field(..., description="Total units")
    total_available: Decimal = Field(..., description="Total available units")
    total_on_rent: Decimal = Field(..., description="Total units on rent")
    total_reserved: Decimal = Field(..., description="Total reserved units")
    total_damaged: Decimal = Field(..., description="Total damaged units")
    low_stock_items: int = Field(..., description="Number of low stock items")
    location_count: int = Field(..., description="Number of locations")


class LowStockAlert(BaseModel):
    """Schema for low stock alerts."""
    item_id: UUID = Field(..., description="Item ID")
    item_name: str = Field(..., description="Item name")
    location_id: UUID = Field(..., description="Location ID")
    location_name: str = Field(..., description="Location name")
    current_stock: Decimal = Field(..., description="Current stock level")
    reorder_point: Decimal = Field(..., description="Reorder point")
    severity: str = Field(..., description="Alert severity")
    days_until_stockout: Optional[int] = Field(None, description="Estimated days until stockout")