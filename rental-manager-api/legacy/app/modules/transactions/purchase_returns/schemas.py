"""
Purchase Returns Schemas

Pydantic models for purchase return operations.
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum


class ReturnStatus(str, Enum):
    """Return status enum"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING" 
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReturnReason(str, Enum):
    """Return reason enum"""
    DEFECTIVE = "DEFECTIVE"
    WRONG_ITEM = "WRONG_ITEM"
    OVERSTOCKED = "OVERSTOCKED"
    QUALITY_ISSUE = "QUALITY_ISSUE"
    DAMAGED = "DAMAGED"
    OTHER = "OTHER"


class PaymentStatus(str, Enum):
    """Payment status enum"""
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class ItemCondition(str, Enum):
    """Item condition grade"""
    A = "A"  # Excellent
    B = "B"  # Good
    C = "C"  # Fair
    D = "D"  # Poor


# Base Schemas
class PurchaseReturnItemBase(BaseModel):
    """Base schema for purchase return items"""
    item_id: UUID = Field(..., description="Item being returned")
    quantity: int = Field(..., gt=0, description="Quantity to return")
    unit_cost: Decimal = Field(..., ge=0, description="Unit cost of item")
    return_reason: ReturnReason = Field(..., description="Reason for return")
    condition: Optional[ItemCondition] = Field(None, description="Item condition")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    serial_numbers: Optional[List[str]] = Field(default_factory=list, description="Serial numbers if applicable")


class PurchaseReturnBase(BaseModel):
    """Base schema for purchase returns"""
    supplier_id: UUID = Field(..., description="Supplier ID")
    original_purchase_id: UUID = Field(..., description="Original purchase transaction ID")
    return_date: date = Field(..., description="Date of return")
    return_authorization: Optional[str] = Field(None, max_length=100, description="RMA number if applicable")
    notes: Optional[str] = Field(None, max_length=500, description="Return notes")
    status: ReturnStatus = Field(default=ReturnStatus.PENDING, description="Return status")
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING, description="Refund payment status")


# Create Schemas
class PurchaseReturnItemCreate(PurchaseReturnItemBase):
    """Schema for creating purchase return items"""
    pass


class PurchaseReturnCreate(PurchaseReturnBase):
    """Schema for creating a purchase return"""
    items: List[PurchaseReturnItemCreate] = Field(..., min_length=1, description="Items being returned")
    
    @field_validator('items')
    @classmethod
    def validate_items_unique(cls, v):
        """Ensure no duplicate items in return"""
        item_ids = [item.item_id for item in v]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("Duplicate items not allowed in return")
        return v


# Update Schemas
class PurchaseReturnUpdate(BaseModel):
    """Schema for updating a purchase return"""
    status: Optional[ReturnStatus] = None
    payment_status: Optional[PaymentStatus] = None
    return_authorization: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    
    model_config = ConfigDict(from_attributes=True)


# Response Schemas
class SupplierSummary(BaseModel):
    """Supplier summary for response"""
    id: UUID
    name: str
    supplier_code: Optional[str] = None
    contact_person: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ItemSummary(BaseModel):
    """Item summary for response"""
    id: UUID
    item_name: str
    sku: str
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseSummary(BaseModel):
    """Purchase summary for response"""
    id: UUID
    transaction_number: str
    transaction_date: datetime
    total_amount: Decimal
    supplier_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseReturnItemResponse(BaseModel):
    """Response schema for purchase return items"""
    id: UUID
    item_id: UUID
    item: ItemSummary
    quantity: int
    unit_cost: Decimal
    total_cost: Decimal
    return_reason: ReturnReason
    condition: Optional[ItemCondition]
    notes: Optional[str]
    serial_numbers: List[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseReturnResponse(BaseModel):
    """Response schema for purchase returns"""
    id: UUID
    transaction_number: str
    supplier_id: UUID
    supplier: Optional[SupplierSummary]
    original_purchase_id: UUID
    original_purchase: Optional[PurchaseSummary]
    return_date: date
    return_authorization: Optional[str]
    notes: Optional[str]
    status: ReturnStatus
    payment_status: PaymentStatus
    total_items: int
    refund_amount: Decimal
    items: List[PurchaseReturnItemResponse]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    updated_by: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseReturnListResponse(BaseModel):
    """Response schema for list of purchase returns"""
    items: List[PurchaseReturnResponse]
    total: int
    skip: int
    limit: int
    
    model_config = ConfigDict(from_attributes=True)


# Filter Schemas
class PurchaseReturnFilters(BaseModel):
    """Schema for filtering purchase returns"""
    supplier_id: Optional[UUID] = None
    original_purchase_id: Optional[UUID] = None
    status: Optional[ReturnStatus] = None
    payment_status: Optional[PaymentStatus] = None
    return_reason: Optional[ReturnReason] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    search: Optional[str] = Field(None, description="Search in transaction number, notes, or RMA")
    skip: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)
    sort_by: Optional[str] = Field("return_date", description="Field to sort by")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$")


# Validation Schemas
class PurchaseReturnValidation(BaseModel):
    """Schema for validating a purchase return"""
    is_valid: bool
    available_items: List[Dict[str, Any]]
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    
    model_config = ConfigDict(from_attributes=True)


# Analytics Schemas
class PurchaseReturnAnalytics(BaseModel):
    """Schema for purchase return analytics"""
    total_returns: int
    total_refund_amount: Decimal
    returns_by_status: Dict[str, int]
    returns_by_reason: Dict[str, int]
    top_returned_items: List[Dict[str, Any]]
    returns_trend: List[Dict[str, Any]]
    
    model_config = ConfigDict(from_attributes=True)