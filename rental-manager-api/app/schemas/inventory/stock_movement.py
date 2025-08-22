"""
Stock Movement Schemas.

Pydantic schemas for stock movement operations.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.inventory.enums import StockMovementType
from app.schemas.inventory.base import InventoryBaseSchema, TimestampMixin


class StockMovementBase(InventoryBaseSchema):
    """Base schema for stock movement data."""
    movement_type: StockMovementType = Field(..., description="Type of stock movement")
    quantity_change: Decimal = Field(..., description="Quantity changed (+ or -)")
    quantity_before: Decimal = Field(..., ge=0, description="Stock quantity before movement")
    quantity_after: Decimal = Field(..., ge=0, description="Stock quantity after movement")
    
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Cost per unit")
    total_cost: Optional[Decimal] = Field(None, description="Total cost of movement")
    
    reference_number: Optional[str] = Field(None, max_length=100, description="External reference")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for movement")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    movement_date: datetime = Field(default_factory=datetime.utcnow, description="When movement occurred")
    
    @field_validator('quantity_change')
    @classmethod
    def validate_quantity_change(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    @field_validator('quantity_before', 'quantity_after')
    @classmethod
    def validate_quantities(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Quantities cannot be negative")
        return v.quantize(Decimal("0.01"))
    
    def validate_math(self) -> None:
        """Validate that quantity math is correct."""
        expected = self.quantity_before + self.quantity_change
        if abs(expected - self.quantity_after) > Decimal("0.01"):
            raise ValueError(
                f"Quantity math error: {self.quantity_before} + {self.quantity_change} "
                f"!= {self.quantity_after}"
            )


class StockMovementCreate(StockMovementBase):
    """Schema for creating a stock movement."""
    stock_level_id: UUID = Field(..., description="Stock level being modified")
    item_id: UUID = Field(..., description="Item being moved")
    location_id: UUID = Field(..., description="Location where movement occurred")
    
    transaction_header_id: Optional[UUID] = Field(None, description="Related transaction header")
    transaction_line_id: Optional[UUID] = Field(None, description="Related transaction line")
    
    performed_by_id: Optional[UUID] = Field(None, description="User performing movement")
    approved_by_id: Optional[UUID] = Field(None, description="User approving movement")
    
    def validate_for_adjustment(self) -> None:
        """Validate requirements for adjustment movements."""
        adjustment_types = {
            StockMovementType.ADJUSTMENT_POSITIVE,
            StockMovementType.ADJUSTMENT_NEGATIVE,
            StockMovementType.SYSTEM_CORRECTION
        }
        
        if self.movement_type in adjustment_types:
            if not self.reason:
                raise ValueError("Reason is required for adjustments")
            if not self.performed_by_id:
                raise ValueError("User ID is required for adjustments")


class StockMovementUpdate(BaseModel):
    """Schema for updating a stock movement (limited fields)."""
    notes: Optional[str] = Field(None, description="Update notes")
    approved_by_id: Optional[UUID] = Field(None, description="Approval user")
    
    class Config:
        json_schema_extra = {
            "example": {
                "notes": "Approved by manager",
                "approved_by_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }


class StockMovementResponse(StockMovementBase, TimestampMixin):
    """Schema for stock movement response."""
    id: UUID = Field(..., description="Movement ID")
    stock_level_id: UUID = Field(..., description="Stock level ID")
    item_id: UUID = Field(..., description="Item ID")
    location_id: UUID = Field(..., description="Location ID")
    
    transaction_header_id: Optional[UUID] = Field(None, description="Transaction header ID")
    transaction_line_id: Optional[UUID] = Field(None, description="Transaction line ID")
    
    performed_by_id: Optional[UUID] = Field(None, description="Performed by user ID")
    approved_by_id: Optional[UUID] = Field(None, description="Approved by user ID")
    
    # Computed properties
    is_increase: bool = Field(..., description="Whether movement increases stock")
    is_decrease: bool = Field(..., description="Whether movement decreases stock")
    movement_category: str = Field(..., description="Movement category")
    
    @classmethod
    def from_orm_with_computed(cls, obj) -> "StockMovementResponse":
        """Create response with computed fields."""
        data = {
            **obj.__dict__,
            'is_increase': obj.is_increase(),
            'is_decrease': obj.is_decrease(),
            'movement_category': obj.get_movement_category()
        }
        return cls(**data)


class StockMovementWithRelations(StockMovementResponse):
    """Stock movement with related data."""
    item_name: Optional[str] = Field(None, description="Item name")
    location_name: Optional[str] = Field(None, description="Location name")
    performed_by_name: Optional[str] = Field(None, description="User who performed movement")
    approved_by_name: Optional[str] = Field(None, description="User who approved movement")


class StockMovementFilter(BaseModel):
    """Filter parameters for stock movements."""
    item_id: Optional[UUID] = Field(None, description="Filter by item")
    location_id: Optional[UUID] = Field(None, description="Filter by location")
    movement_type: Optional[StockMovementType] = Field(None, description="Filter by movement type")
    movement_category: Optional[str] = Field(None, description="Filter by category")
    
    date_from: Optional[datetime] = Field(None, description="Start date")
    date_to: Optional[datetime] = Field(None, description="End date")
    
    performed_by_id: Optional[UUID] = Field(None, description="Filter by user")
    has_transaction: Optional[bool] = Field(None, description="Filter by transaction linkage")
    
    min_quantity: Optional[Decimal] = Field(None, ge=0, description="Minimum quantity")
    max_quantity: Optional[Decimal] = Field(None, ge=0, description="Maximum quantity")


class StockMovementSummary(BaseModel):
    """Summary of stock movements."""
    total_movements: int = Field(..., description="Total number of movements")
    total_increase: Decimal = Field(..., description="Total quantity increased")
    total_decrease: Decimal = Field(..., description="Total quantity decreased")
    net_change: Decimal = Field(..., description="Net quantity change")
    
    movements_by_type: dict[str, int] = Field(..., description="Count by movement type")
    quantity_by_type: dict[str, Decimal] = Field(..., description="Quantity by movement type")
    
    period_start: datetime = Field(..., description="Period start date")
    period_end: datetime = Field(..., description="Period end date")


class BulkStockMovementCreate(BaseModel):
    """Create multiple stock movements in one operation."""
    movements: List[StockMovementCreate] = Field(..., min_items=1, max_items=100)
    validate_all: bool = Field(True, description="Validate all before creating any")
    
    def validate_movements(self) -> None:
        """Validate all movements."""
        for i, movement in enumerate(self.movements):
            try:
                movement.validate_math()
                movement.validate_for_adjustment()
            except ValueError as e:
                raise ValueError(f"Movement {i+1}: {str(e)}")


class RentalMovementCreate(BaseModel):
    """Specialized schema for rental movements."""
    item_id: UUID = Field(..., description="Item being rented")
    location_id: UUID = Field(..., description="Rental location")
    quantity: Decimal = Field(..., gt=0, description="Quantity")
    transaction_header_id: UUID = Field(..., description="Rental transaction")
    transaction_line_id: Optional[UUID] = Field(None, description="Transaction line")
    performed_by_id: UUID = Field(..., description="User processing rental")
    notes: Optional[str] = Field(None, description="Rental notes")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class RentalReturnMovementCreate(RentalMovementCreate):
    """Specialized schema for rental return movements."""
    damaged_quantity: Decimal = Field(0, ge=0, description="Damaged quantity")
    damage_notes: Optional[str] = Field(None, description="Damage description")
    
    @field_validator('damaged_quantity')
    @classmethod
    def validate_damaged(cls, v: Decimal, values) -> Decimal:
        if 'quantity' in values and v > values['quantity']:
            raise ValueError("Damaged quantity cannot exceed total quantity")
        return v.quantize(Decimal("0.01"))


class StockMovementSummary(BaseModel):
    """Summary of stock movements over a period."""
    total_movements: int = Field(..., description="Total number of movements")
    total_quantity_in: Decimal = Field(..., description="Total quantity added")
    total_quantity_out: Decimal = Field(..., description="Total quantity removed")
    net_change: Decimal = Field(..., description="Net quantity change")
    movement_types: Dict[str, int] = Field(..., description="Count by movement type")
    period_start: datetime = Field(..., description="Period start date")
    period_end: datetime = Field(..., description="Period end date")


class MovementTypeStats(BaseModel):
    """Statistics grouped by movement type."""
    purchase_count: int = Field(0, description="Number of purchase movements")
    purchase_quantity: Decimal = Field(0, description="Total purchase quantity")
    sale_count: int = Field(0, description="Number of sale movements")
    sale_quantity: Decimal = Field(0, description="Total sale quantity")
    rental_out_count: int = Field(0, description="Number of rental out movements")
    rental_out_quantity: Decimal = Field(0, description="Total rental out quantity")
    rental_return_count: int = Field(0, description="Number of rental return movements")
    rental_return_quantity: Decimal = Field(0, description="Total rental return quantity")
    transfer_count: int = Field(0, description="Number of transfer movements")
    transfer_quantity: Decimal = Field(0, description="Total transfer quantity")
    adjustment_count: int = Field(0, description="Number of adjustment movements")
    adjustment_quantity: Decimal = Field(0, description="Total adjustment quantity")