"""
Timezone-aware rental schemas.

This module provides updated rental schemas that use timezone-aware base models
for proper datetime handling with IST as the default timezone.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from uuid import UUID

from app.core.serializers import (
    TimezoneAwareModel,
    TimezoneAwareCreateModel,
    TimezoneAwareUpdateModel,
    TimezoneAwareResponseModel,
    timezone_aware_datetime_field
)
from app.modules.transactions.base.models.transaction_headers import (
    TransactionType, TransactionStatus, PaymentStatus, RentalStatus, RentalPeriodUnit
)


# Base nested schemas (no timezone fields needed)
class CustomerNestedResponse(BaseModel):
    """Schema for nested customer response in rental transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Customer name")
    email: Optional[str] = Field(None, description="Customer email")
    phone: Optional[str] = Field(None, description="Customer phone")


class ItemNestedResponse(BaseModel):
    """Schema for nested item response in rental transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Item name")
    sku: Optional[str] = Field(None, description="Item SKU")
    category_name: Optional[str] = Field(None, description="Category name")
    brand_name: Optional[str] = Field(None, description="Brand name")


class LocationNestedResponse(BaseModel):
    """Schema for nested location response in rental transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Location name")
    address: Optional[str] = Field(None, description="Location address")


# Rental Line Item Schemas
class RentalLineItemResponse(TimezoneAwareResponseModel):
    """Response schema for rental line items with timezone-aware datetimes."""
    
    id: UUID
    item_id: UUID
    item: ItemNestedResponse
    quantity: int
    unit_price: Decimal = Field(..., description="Price per unit per day")
    
    # Rental period with timezone awareness
    rental_start_date: datetime = timezone_aware_datetime_field(
        description="When the rental starts (in system timezone)"
    )
    rental_end_date: datetime = timezone_aware_datetime_field(
        description="When the rental ends (in system timezone)"
    )
    actual_return_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When the item was actually returned"
    )
    
    # Financial information
    total_amount: Decimal = Field(..., description="Total rental amount")
    security_deposit: Decimal = Field(default=Decimal('0'), description="Security deposit")
    late_fee: Decimal = Field(default=Decimal('0'), description="Late fees charged")
    damage_fee: Decimal = Field(default=Decimal('0'), description="Damage fees charged")
    
    # Status and notes
    current_rental_status: RentalStatus
    condition_notes: Optional[str] = Field(None, description="Item condition notes")
    return_notes: Optional[str] = Field(None, description="Return notes")
    
    # Audit fields
    created_at: datetime = timezone_aware_datetime_field()
    updated_at: datetime = timezone_aware_datetime_field()
    
    @property
    def rental_duration_days(self) -> int:
        """Calculate rental duration in days."""
        return (self.rental_end_date.date() - self.rental_start_date.date()).days + 1
    
    @property
    def is_overdue(self) -> bool:
        """Check if rental is overdue."""
        if self.actual_return_date:
            return False  # Already returned
        return datetime.now().date() > self.rental_end_date.date()
    
    @property
    def days_overdue(self) -> int:
        """Calculate days overdue."""
        if not self.is_overdue:
            return 0
        return (datetime.now().date() - self.rental_end_date.date()).days


class RentalLineItemCreateRequest(TimezoneAwareCreateModel):
    """Create request for rental line items with timezone handling."""
    
    item_id: UUID = Field(..., description="Item to rent")
    quantity: int = Field(..., gt=0, description="Quantity to rent")
    unit_price: Decimal = Field(..., gt=0, description="Price per unit per day")
    
    # Rental period - will be converted to UTC for database storage
    rental_start_date: datetime = timezone_aware_datetime_field(
        description="Rental start date and time"
    )
    rental_end_date: datetime = timezone_aware_datetime_field(
        description="Rental end date and time"
    )
    
    # Optional fields
    security_deposit: Decimal = Field(default=Decimal('0'), ge=0, description="Security deposit")
    condition_notes: Optional[str] = Field(None, description="Initial condition notes")
    
    @field_validator('rental_end_date')
    @classmethod
    def validate_rental_period(cls, v, info):
        """Ensure rental end date is after start date."""
        if 'rental_start_date' in info.data and info.data['rental_start_date']:
            if v <= info.data['rental_start_date']:
                raise ValueError('Rental end date must be after start date')
        return v
    
    @model_validator(mode='after')
    def validate_rental_dates(self):
        """Additional validation for rental dates."""
        if self.rental_start_date and self.rental_end_date:
            # Ensure minimum rental period (e.g., at least 1 hour)
            duration = self.rental_end_date - self.rental_start_date
            if duration.total_seconds() < 3600:  # 1 hour minimum
                raise ValueError('Minimum rental period is 1 hour')
        return self


class RentalLineItemUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for rental line items."""
    
    quantity: Optional[int] = Field(None, gt=0, description="Quantity to rent")
    unit_price: Optional[Decimal] = Field(None, gt=0, description="Price per unit per day")
    
    # Rental period updates
    rental_start_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Rental start date and time"
    )
    rental_end_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Rental end date and time"
    )
    actual_return_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Actual return date and time"
    )
    
    # Financial updates
    security_deposit: Optional[Decimal] = Field(None, ge=0, description="Security deposit")
    late_fee: Optional[Decimal] = Field(None, ge=0, description="Late fees")
    damage_fee: Optional[Decimal] = Field(None, ge=0, description="Damage fees")
    
    # Status and notes
    current_rental_status: Optional[RentalStatus] = Field(None, description="Rental status")
    condition_notes: Optional[str] = Field(None, description="Condition notes")
    return_notes: Optional[str] = Field(None, description="Return notes")


# Main Rental Transaction Schemas
class RentalTransactionResponse(TimezoneAwareResponseModel):
    """Response schema for rental transactions with timezone-aware datetimes."""
    
    # Basic transaction info
    id: UUID
    transaction_number: str
    transaction_type: TransactionType
    status: TransactionStatus
    
    # Customer and location
    customer_id: Optional[UUID]
    customer: Optional[CustomerNestedResponse]
    location_id: Optional[UUID]
    location: Optional[LocationNestedResponse]
    
    # Temporal information - timezone aware
    transaction_date: datetime = timezone_aware_datetime_field(
        description="When the transaction was created"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    # Rental-specific dates
    rental_start_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Overall rental start date"
    )
    rental_end_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Overall rental end date"
    )
    
    # Financial information
    currency: str = Field(default="INR", description="Currency code")
    subtotal: Decimal
    discount_amount: Decimal = Field(default=Decimal('0'))
    tax_amount: Decimal = Field(default=Decimal('0'))
    total_amount: Decimal
    paid_amount: Decimal = Field(default=Decimal('0'))
    deposit_amount: Decimal = Field(default=Decimal('0'))
    deposit_paid: bool = Field(default=False)
    
    # Payment information
    payment_status: PaymentStatus
    payment_method: Optional[str]
    payment_reference: Optional[str]
    
    # Rental line items
    rental_items: List[RentalLineItemResponse] = Field(default_factory=list)
    
    # Additional information
    notes: Optional[str]
    reference_number: Optional[str]
    
    # Delivery and pickup
    delivery_required: bool = Field(default=False)
    delivery_address: Optional[str]
    delivery_date: Optional[date]
    pickup_required: bool = Field(default=False)
    pickup_date: Optional[date]
    
    # Audit fields
    created_at: datetime = timezone_aware_datetime_field()
    updated_at: datetime = timezone_aware_datetime_field()
    created_by: Optional[str]
    updated_by: Optional[str]
    
    # Computed properties
    @property
    def balance_due(self) -> Decimal:
        """Calculate outstanding balance."""
        return self.total_amount - self.paid_amount
    
    @property
    def is_paid(self) -> bool:
        """Check if transaction is fully paid."""
        return self.paid_amount >= self.total_amount
    
    @property
    def total_items(self) -> int:
        """Total number of rental items."""
        return len(self.rental_items)
    
    @property
    def current_rental_status(self) -> Optional[RentalStatus]:
        """Aggregate rental status from line items."""
        if not self.rental_items:
            return None
        
        statuses = [item.current_rental_status for item in self.rental_items]
        
        # Status aggregation logic
        if RentalStatus.RENTAL_LATE in statuses:
            return RentalStatus.RENTAL_LATE
        elif RentalStatus.RENTAL_PARTIAL_RETURN in statuses:
            return RentalStatus.RENTAL_PARTIAL_RETURN
        elif all(status == RentalStatus.RENTAL_COMPLETED for status in statuses):
            return RentalStatus.RENTAL_COMPLETED
        elif RentalStatus.RENTAL_EXTENDED in statuses:
            return RentalStatus.RENTAL_EXTENDED
        else:
            return RentalStatus.RENTAL_INPROGRESS


class RentalTransactionCreateRequest(TimezoneAwareCreateModel):
    """Create request for rental transactions with timezone handling."""
    
    # Customer and location
    customer_id: UUID = Field(..., description="Customer ID")
    location_id: Optional[UUID] = Field(None, description="Location ID")
    
    # Transaction timing
    transaction_date: datetime = timezone_aware_datetime_field(
        description="Transaction date and time"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    # Financial information
    currency: str = Field(default="INR", description="Currency code")
    discount_amount: Decimal = Field(default=Decimal('0'), ge=0)
    tax_amount: Decimal = Field(default=Decimal('0'), ge=0)
    deposit_amount: Decimal = Field(default=Decimal('0'), ge=0)
    
    # Payment information
    payment_method: Optional[str] = Field(None, description="Payment method")
    payment_reference: Optional[str] = Field(None, description="Payment reference")
    
    # Rental items
    rental_items: List[RentalLineItemCreateRequest] = Field(
        ..., min_length=1, description="List of items to rent"
    )
    
    # Additional information
    notes: Optional[str] = Field(None, description="Transaction notes")
    reference_number: Optional[str] = Field(None, description="External reference")
    
    # Delivery and pickup
    delivery_required: bool = Field(default=False)
    delivery_address: Optional[str] = Field(None, description="Delivery address")
    delivery_date: Optional[date] = Field(None, description="Delivery date")
    pickup_required: bool = Field(default=False)
    pickup_date: Optional[date] = Field(None, description="Pickup date")
    
    @model_validator(mode='after')
    def validate_delivery_pickup(self):
        """Validate delivery and pickup requirements."""
        if self.delivery_required and not self.delivery_address:
            raise ValueError('Delivery address is required when delivery is requested')
        
        if self.delivery_required and not self.delivery_date:
            raise ValueError('Delivery date is required when delivery is requested')
        
        if self.pickup_required and not self.pickup_date:
            raise ValueError('Pickup date is required when pickup is requested')
        
        return self


class RentalTransactionUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for rental transactions."""
    
    # Status updates
    status: Optional[TransactionStatus] = Field(None, description="Transaction status")
    payment_status: Optional[PaymentStatus] = Field(None, description="Payment status")
    
    # Timing updates
    transaction_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Transaction date and time"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    # Financial updates
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    tax_amount: Optional[Decimal] = Field(None, ge=0)
    paid_amount: Optional[Decimal] = Field(None, ge=0)
    deposit_amount: Optional[Decimal] = Field(None, ge=0)
    deposit_paid: Optional[bool] = Field(None, description="Deposit payment status")
    
    # Payment updates
    payment_method: Optional[str] = Field(None, description="Payment method")
    payment_reference: Optional[str] = Field(None, description="Payment reference")
    
    # Additional information
    notes: Optional[str] = Field(None, description="Transaction notes")
    
    # Delivery and pickup updates
    delivery_address: Optional[str] = Field(None, description="Delivery address")
    delivery_date: Optional[date] = Field(None, description="Delivery date")
    pickup_date: Optional[date] = Field(None, description="Pickup date")


# Rental Return Schemas
class RentalReturnRequest(TimezoneAwareCreateModel):
    """Request schema for processing rental returns."""
    
    # Return processing time
    return_date: datetime = timezone_aware_datetime_field(
        description="When the return is being processed"
    )
    
    # Items being returned
    returned_items: List[Dict[str, Any]] = Field(
        ..., 
        description="List of items being returned with their details"
    )
    
    # Return processing details
    inspector_notes: Optional[str] = Field(None, description="Inspector's notes")
    customer_feedback: Optional[str] = Field(None, description="Customer feedback")
    
    # Financial adjustments
    late_fees: Decimal = Field(default=Decimal('0'), ge=0, description="Late fees charged")
    damage_fees: Decimal = Field(default=Decimal('0'), ge=0, description="Damage fees charged")
    deposit_refund: Decimal = Field(default=Decimal('0'), ge=0, description="Deposit refund amount")
    
    # Return completion
    partial_return: bool = Field(default=False, description="Whether this is a partial return")


class RentalReturnResponse(TimezoneAwareResponseModel):
    """Response schema for rental return processing."""
    
    id: UUID
    transaction_id: UUID
    return_number: str
    
    # Return timing
    return_date: datetime = timezone_aware_datetime_field(
        description="When the return was processed"
    )
    processed_at: datetime = timezone_aware_datetime_field(
        description="When the return processing was completed"
    )
    
    # Return details
    returned_items: List[Dict[str, Any]]
    inspector_notes: Optional[str]
    customer_feedback: Optional[str]
    
    # Financial summary
    original_total: Decimal
    late_fees: Decimal
    damage_fees: Decimal
    deposit_refund: Decimal
    final_amount: Decimal
    
    # Status
    return_status: str
    partial_return: bool
    
    # Audit
    processed_by: Optional[str]
    created_at: datetime = timezone_aware_datetime_field()
    updated_at: datetime = timezone_aware_datetime_field()


# List and filter schemas
class RentalTransactionListResponse(TimezoneAwareResponseModel):
    """List response for rental transactions."""
    
    transactions: List[RentalTransactionResponse]
    total_count: int
    page: int
    size: int
    
    # Aggregated information
    status_counts: Dict[str, int] = Field(..., description="Count by status")
    payment_status_counts: Dict[str, int] = Field(..., description="Count by payment status")
    total_value: Decimal = Field(..., description="Total value of all transactions")
    
    # Metadata
    retrieved_at: datetime = timezone_aware_datetime_field(
        description="When the list was retrieved"
    )
    filters_applied: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")


class RentalFilterRequest(TimezoneAwareModel):
    """Filter request for rental transactions."""
    
    # Date range filters
    date_from: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Filter transactions from this date"
    )
    date_to: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Filter transactions to this date"
    )
    
    # Status filters
    status: Optional[TransactionStatus] = Field(None, description="Filter by transaction status")
    payment_status: Optional[PaymentStatus] = Field(None, description="Filter by payment status")
    rental_status: Optional[RentalStatus] = Field(None, description="Filter by rental status")
    
    # Entity filters
    customer_id: Optional[UUID] = Field(None, description="Filter by customer")
    location_id: Optional[UUID] = Field(None, description="Filter by location")
    item_id: Optional[UUID] = Field(None, description="Filter by item")
    
    # Financial filters
    min_amount: Optional[Decimal] = Field(None, ge=0, description="Minimum transaction amount")
    max_amount: Optional[Decimal] = Field(None, ge=0, description="Maximum transaction amount")
    
    # Other filters
    overdue_only: bool = Field(default=False, description="Show only overdue rentals")
    has_late_fees: bool = Field(default=False, description="Show only rentals with late fees")
    
    @field_validator('date_to')
    @classmethod
    def validate_date_range(cls, v, info):
        """Ensure date_to is after date_from."""
        if v and 'date_from' in info.data and info.data['date_from']:
            if v <= info.data['date_from']:
                raise ValueError('End date must be after start date')
        return v