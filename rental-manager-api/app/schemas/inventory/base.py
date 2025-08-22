"""
Base schemas for inventory module.

Common schemas and mixins used across inventory operations.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.inventory.enums import (
    InventoryUnitStatus,
    InventoryUnitCondition,
    StockMovementType,
    StockStatus
)


class InventoryBaseSchema(BaseModel):
    """Base schema with common configuration."""
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: lambda v: v.isoformat(),
            Decimal: lambda v: float(v),
            UUID: lambda v: str(v)
        }
    )


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class AuditMixin(TimestampMixin):
    """Mixin for audit fields."""
    created_by: Optional[UUID] = Field(None, description="User who created the record")
    updated_by: Optional[UUID] = Field(None, description="User who last updated the record")


class PaginationParams(BaseModel):
    """Common pagination parameters."""
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")
    
    @property
    def offset(self) -> int:
        return self.skip


class FilterParams(BaseModel):
    """Common filter parameters."""
    search: Optional[str] = Field(None, description="Search term")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date")
    
    @field_validator('search')
    @classmethod
    def validate_search(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Search term must be at least 2 characters")
            if len(v) > 100:
                raise ValueError("Search term too long (max 100 characters)")
        return v


class SortParams(BaseModel):
    """Common sort parameters."""
    sort_by: str = Field("created_at", description="Field to sort by")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="Sort order")
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        allowed_fields = {
            'id', 'created_at', 'updated_at', 'name', 'code', 
            'quantity', 'status', 'price'
        }
        if v not in allowed_fields:
            raise ValueError(f"Invalid sort field. Allowed: {', '.join(allowed_fields)}")
        return v


class BulkOperationResult(BaseModel):
    """Result of a bulk operation."""
    total: int = Field(..., description="Total items processed")
    successful: int = Field(..., description="Successfully processed items")
    failed: int = Field(..., description="Failed items")
    errors: Optional[Dict[str, str]] = Field(None, description="Error details by item ID")
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        if self.total == 0:
            return 0.0
        return (self.successful / self.total) * 100


class QuantityAdjustment(BaseModel):
    """Schema for quantity adjustments."""
    quantity: Decimal = Field(..., gt=0, description="Quantity to adjust")
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for adjustment")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Quantity must be positive")
        if v > Decimal("99999.99"):
            raise ValueError("Quantity too large")
        return v.quantize(Decimal("0.01"))


class PriceUpdate(BaseModel):
    """Schema for price updates."""
    price: Decimal = Field(..., ge=0, description="New price")
    effective_date: Optional[datetime] = Field(None, description="When price becomes effective")
    
    @field_validator('price')
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price cannot be negative")
        if v > Decimal("999999.99"):
            raise ValueError("Price too large")
        return v.quantize(Decimal("0.01"))


class LocationTransfer(BaseModel):
    """Schema for location transfers."""
    from_location_id: UUID = Field(..., description="Source location")
    to_location_id: UUID = Field(..., description="Destination location")
    quantity: Decimal = Field(..., gt=0, description="Quantity to transfer")
    notes: Optional[str] = Field(None, max_length=1000, description="Transfer notes")
    
    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))
    
    def validate_locations(self) -> None:
        """Validate that source and destination are different."""
        if self.from_location_id == self.to_location_id:
            raise ValueError("Source and destination locations must be different")


class StockSummary(BaseModel):
    """Stock summary information."""
    total_on_hand: Decimal = Field(..., description="Total physical quantity")
    total_available: Decimal = Field(..., description="Total available for operations")
    total_reserved: Decimal = Field(..., description="Total reserved quantity")
    total_on_rent: Decimal = Field(..., description="Total quantity on rent")
    total_damaged: Decimal = Field(..., description="Total damaged quantity")
    total_value: Optional[Decimal] = Field(None, description="Total inventory value")
    location_count: int = Field(..., description="Number of locations with stock")
    
    @property
    def utilization_rate(self) -> float:
        """Calculate utilization rate."""
        if self.total_on_hand == 0:
            return 0.0
        return float((self.total_on_rent / self.total_on_hand) * 100)
    
    @property
    def availability_rate(self) -> float:
        """Calculate availability rate."""
        if self.total_on_hand == 0:
            return 0.0
        return float((self.total_available / self.total_on_hand) * 100)


class InventoryAlert(BaseModel):
    """Inventory alert/warning."""
    alert_type: str = Field(..., description="Type of alert")
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    message: str = Field(..., description="Alert message")
    item_id: Optional[UUID] = Field(None, description="Related item")
    location_id: Optional[UUID] = Field(None, description="Related location")
    quantity: Optional[Decimal] = Field(None, description="Related quantity")
    threshold: Optional[Decimal] = Field(None, description="Threshold that triggered alert")
    
    class Config:
        json_schema_extra = {
            "example": {
                "alert_type": "LOW_STOCK",
                "severity": "high",
                "message": "Item XYZ is below reorder point",
                "item_id": "123e4567-e89b-12d3-a456-426614174000",
                "quantity": 5,
                "threshold": 10
            }
        }