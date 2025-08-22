"""
Booking Module Schemas

Pydantic schemas for request validation and response serialization.
"""

from typing import List, Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from uuid import UUID

from .enums import BookingStatus, BookingPriority, RentalPeriodUnit, PaymentStatus


# ============= Request Schemas =============

class BookingItemRequest(BaseModel):
    """Schema for a booking line item in requests"""
    
    item_id: str = Field(..., description="Item UUID")
    quantity: int = Field(..., gt=0, description="Quantity to book")
    rental_period: int = Field(1, gt=0, description="Number of rental periods")
    rental_period_unit: str = Field("DAILY", description="Unit of rental period")
    unit_rate: Decimal = Field(..., ge=0, description="Rate per unit per period")
    discount_amount: Optional[Decimal] = Field(0, ge=0, description="Discount amount")
    notes: Optional[str] = Field(None, description="Item-specific notes")


class BookingCreateRequest(BaseModel):
    """Schema for creating a new booking (single or multi-item)"""
    
    customer_id: str = Field(..., description="Customer UUID")
    location_id: str = Field(..., description="Location UUID")
    start_date: date = Field(..., description="Rental start date")
    end_date: date = Field(..., description="Rental end date")
    
    # Items array - can contain 1 or many items
    items: List[BookingItemRequest] = Field(..., min_length=1, description="Booking items")
    
    # Optional fields
    deposit_paid: bool = Field(False, description="Whether deposit is paid")
    notes: Optional[str] = Field(None, description="Booking notes")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Ensure end date is after or equal to start date"""
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v
    
    @field_validator('items')
    @classmethod
    def validate_items(cls, v):
        """Validate items list"""
        if not v:
            raise ValueError('At least one item is required')
        return v


class BookingUpdateRequest(BaseModel):
    """Schema for updating an existing booking"""
    
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    deposit_paid: Optional[bool] = None
    
    @model_validator(mode='after')
    def validate_dates(self):
        """Validate dates if both provided"""
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("End date must be after start date")
        return self


class AvailabilityCheckRequest(BaseModel):
    """Schema for checking item availability"""
    
    items: List[Dict[str, Any]] = Field(..., description="Items to check")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    location_id: str = Field(..., description="Location UUID")
    exclude_booking_id: Optional[str] = Field(None, description="Booking ID to exclude")


# ============= Response Schemas =============

class CustomerInfo(BaseModel):
    """Nested customer information"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class LocationInfo(BaseModel):
    """Nested location information"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    code: Optional[str] = None


class ItemInfo(BaseModel):
    """Nested item information"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    item_name: str
    sku: Optional[str] = None
    description: Optional[str] = None


class BookingLineResponse(BaseModel):
    """Schema for booking line item in responses"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    line_number: int
    item_id: UUID
    item: Optional[ItemInfo] = None
    quantity_reserved: Decimal
    rental_period: int
    rental_period_unit: str
    unit_rate: Decimal
    discount_amount: Optional[Decimal]
    line_total: Optional[Decimal]
    notes: Optional[str]


class BookingHeaderResponse(BaseModel):
    """Complete booking response with all details"""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    booking_reference: str
    
    # Related entities
    customer_id: UUID
    customer: Optional[CustomerInfo] = None
    location_id: UUID
    location: Optional[LocationInfo] = None
    
    # Dates
    booking_date: date
    start_date: date
    end_date: date
    
    # Status
    booking_status: BookingStatus
    
    # Financial summary
    total_items: int
    estimated_subtotal: Optional[Decimal]
    estimated_tax: Optional[Decimal]
    estimated_total: Optional[Decimal]
    deposit_required: Optional[Decimal]
    deposit_paid: bool
    
    # Notes
    notes: Optional[str]
    
    # Line items
    lines: List[BookingLineResponse]
    
    # Conversion info
    converted_rental_id: Optional[UUID]
    
    # Cancellation info
    cancelled_at: Optional[datetime]
    cancelled_reason: Optional[str]
    
    # Timestamps
    created_at: datetime
    updated_at: datetime


class BookingListResponse(BaseModel):
    """Paginated list of bookings"""
    
    bookings: List[BookingHeaderResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AvailabilityCheckResponse(BaseModel):
    """Response for availability check"""
    
    all_available: bool
    items: List[Dict[str, Any]]
    unavailable_items: List[Dict[str, Any]]
    partially_available_items: List[Dict[str, Any]]


class BookingConfirmResponse(BaseModel):
    """Response for booking confirmation"""
    
    success: bool
    message: str
    booking: BookingHeaderResponse


class BookingCancelResponse(BaseModel):
    """Response for booking cancellation"""
    
    success: bool
    message: str
    booking_id: UUID
    refund_amount: Optional[Decimal] = None


class ConvertToRentalResponse(BaseModel):
    """Response for converting booking to rental"""
    
    success: bool
    message: str
    booking_id: UUID
    rental_id: UUID
    rental_number: str