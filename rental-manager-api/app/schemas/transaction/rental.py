"""
Rental transaction schemas for request/response validation.
Includes schemas for rental orders, returns, extensions, and lifecycle management.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
from typing_extensions import Annotated

from app.models.transaction.enums import (
    RentalStatus,
    PaymentMethod,
    PaymentStatus,
    RentalPricingType,
    DamageType,
    DamageSeverity,
)


class RentalItemCreate(BaseModel):
    """Schema for creating a rental line item."""
    
    item_id: UUID
    quantity: Annotated[int, Field(gt=0)]
    daily_rate: Annotated[Decimal, Field(ge=0, decimal_places=2)]
    weekly_rate: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    monthly_rate: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    deposit_amount: Annotated[Decimal, Field(ge=0, decimal_places=2)] = Decimal("0.00")
    insurance_amount: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    notes: Optional[str] = Field(None, max_length=1000)
    
    @model_validator(mode="after")
    def validate_rates(self) -> "RentalItemCreate":
        """Ensure weekly/monthly rates are lower than calculated daily rates."""
        if self.weekly_rate and self.weekly_rate > (self.daily_rate * 7):
            raise ValueError("Weekly rate should offer discount over daily rate")
        if self.monthly_rate and self.monthly_rate > (self.daily_rate * 30):
            raise ValueError("Monthly rate should offer discount over daily rate")
        return self


class RentalItemResponse(BaseModel):
    """Response schema for a rental line item."""
    
    id: UUID
    rental_id: UUID
    item_id: UUID
    item_name: str
    item_sku: str
    quantity: int
    daily_rate: Decimal
    weekly_rate: Optional[Decimal] = None
    monthly_rate: Optional[Decimal] = None
    actual_rate_applied: Decimal
    rental_days: int
    deposit_amount: Decimal
    insurance_amount: Optional[Decimal] = None
    line_total: Decimal
    return_date: Optional[datetime] = None
    return_condition: Optional[str] = None
    damage_charges: Decimal = Decimal("0.00")
    late_fees: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RentalCreate(BaseModel):
    """Schema for creating a rental transaction."""
    
    customer_id: UUID
    location_id: UUID
    reference_number: str = Field(..., min_length=1, max_length=100)
    rental_start_date: datetime
    rental_end_date: datetime
    pickup_location_id: Optional[UUID] = None
    return_location_id: Optional[UUID] = None
    items: List[RentalItemCreate] = Field(..., min_length=1)
    delivery_required: bool = False
    delivery_address: Optional[str] = Field(None, max_length=500)
    delivery_fee: Annotated[Decimal, Field(ge=0, decimal_places=2)] = Decimal("0.00")
    insurance_required: bool = False
    insurance_provider: Optional[str] = Field(None, max_length=200)
    insurance_policy_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)
    terms_accepted: bool = True
    metadata: Optional[Dict[str, Any]] = None
    
    @model_validator(mode="after")
    def validate_dates(self) -> "RentalCreate":
        """Validate rental dates."""
        if self.rental_end_date <= self.rental_start_date:
            raise ValueError("Rental end date must be after start date")
        if self.rental_start_date < datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
            raise ValueError("Rental start date cannot be in the past")
        return self
    
    @model_validator(mode="after")
    def validate_delivery(self) -> "RentalCreate":
        """Validate delivery requirements."""
        if self.delivery_required and not self.delivery_address:
            raise ValueError("Delivery address required when delivery is requested")
        return self


class RentalUpdate(BaseModel):
    """Schema for updating a rental transaction."""
    
    status: Optional[RentalStatus] = None
    return_location_id: Optional[UUID] = None
    delivery_address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    metadata: Optional[Dict[str, Any]] = None


class RentalPickupRequest(BaseModel):
    """Schema for rental pickup confirmation."""
    
    pickup_person_name: str = Field(..., min_length=1, max_length=200)
    pickup_person_id_type: str = Field(..., min_length=1, max_length=50)
    pickup_person_id_number: str = Field(..., min_length=1, max_length=100)
    pickup_notes: Optional[str] = Field(None, max_length=1000)
    items_condition_confirmed: bool = True
    deposit_collected: bool = True
    payment_collected: bool = True


class RentalDamageAssessment(BaseModel):
    """Schema for damage assessment during return."""
    
    item_id: UUID
    damage_type: DamageType
    damage_severity: DamageSeverity
    damage_description: str = Field(..., min_length=1, max_length=1000)
    repair_cost_estimate: Annotated[Decimal, Field(ge=0, decimal_places=2)]
    photos: Optional[List[str]] = None
    assessor_notes: Optional[str] = Field(None, max_length=1000)


class RentalReturnRequest(BaseModel):
    """Schema for rental return processing."""
    
    return_date: datetime = Field(default_factory=datetime.utcnow)
    return_person_name: str = Field(..., min_length=1, max_length=200)
    odometer_reading: Optional[int] = Field(None, ge=0)
    fuel_level: Optional[int] = Field(None, ge=0, le=100)
    damages: Optional[List[RentalDamageAssessment]] = None
    late_return: bool = False
    late_return_reason: Optional[str] = Field(None, max_length=500)
    return_notes: Optional[str] = Field(None, max_length=1000)
    items_returned: List[UUID]  # List of item IDs being returned


class RentalReturnResponse(BaseModel):
    """Response schema for rental return."""
    
    rental_id: UUID
    return_date: datetime
    items_returned: int
    items_pending: int
    base_rental_charge: Decimal
    late_fees: Decimal
    damage_charges: Decimal
    other_charges: Decimal
    total_charges: Decimal
    deposit_applied: Decimal
    deposit_refund: Decimal
    amount_due: Decimal
    return_status: str
    inspection_required: bool
    damage_report: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class RentalExtensionRequest(BaseModel):
    """Schema for rental extension request."""
    
    new_end_date: datetime
    reason: Optional[str] = Field(None, max_length=500)
    maintain_current_rate: bool = True
    new_rate: Optional[Annotated[Decimal, Field(ge=0, decimal_places=2)]] = None
    
    @field_validator("new_end_date")
    @classmethod
    def validate_extension_date(cls, v: datetime) -> datetime:
        """Ensure extension date is in the future."""
        if v <= datetime.now():
            raise ValueError("Extension date must be in the future")
        return v


class RentalExtensionResponse(BaseModel):
    """Response schema for rental extension."""
    
    rental_id: UUID
    original_end_date: datetime
    new_end_date: datetime
    extension_days: int
    rate_applied: Decimal
    additional_charge: Decimal
    new_total: Decimal
    approval_status: str
    approval_notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class RentalResponse(BaseModel):
    """Response schema for a rental transaction."""
    
    id: UUID
    transaction_number: str
    customer_id: UUID
    customer_name: str
    location_id: UUID
    location_name: str
    reference_number: str
    rental_start_date: datetime
    rental_end_date: datetime
    actual_return_date: Optional[datetime] = None
    status: RentalStatus
    payment_status: PaymentStatus
    pickup_location_id: Optional[UUID] = None
    return_location_id: Optional[UUID] = None
    delivery_required: bool
    delivery_address: Optional[str] = None
    delivery_fee: Decimal
    insurance_required: bool
    subtotal_amount: Decimal
    deposit_amount: Decimal
    insurance_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    late_fees: Decimal = Decimal("0.00")
    damage_charges: Decimal = Decimal("0.00")
    items: List[RentalItemResponse]
    pickup_confirmed: bool = False
    pickup_timestamp: Optional[datetime] = None
    return_confirmed: bool = False
    return_timestamp: Optional[datetime] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class RentalSummary(BaseModel):
    """Summary schema for rental listing."""
    
    id: UUID
    transaction_number: str
    customer_name: str
    rental_start_date: datetime
    rental_end_date: datetime
    status: RentalStatus
    payment_status: PaymentStatus
    total_amount: Decimal
    deposit_amount: Decimal
    balance_amount: Decimal
    item_count: int
    days_remaining: Optional[int] = None
    is_overdue: bool = False
    
    class Config:
        from_attributes = True


class RentalFilter(BaseModel):
    """Filter schema for rental queries."""
    
    customer_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    status: Optional[RentalStatus] = None
    payment_status: Optional[PaymentStatus] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    pickup_pending: Optional[bool] = None
    return_pending: Optional[bool] = None
    overdue_only: Optional[bool] = None
    reference_number: Optional[str] = None


class RentalAvailabilityCheck(BaseModel):
    """Schema for checking item availability."""
    
    item_id: UUID
    location_id: UUID
    start_date: datetime
    end_date: datetime
    quantity_needed: int


class RentalAvailabilityResponse(BaseModel):
    """Response schema for availability check."""
    
    item_id: UUID
    item_name: str
    location_id: UUID
    requested_quantity: int
    available_quantity: int
    is_available: bool
    conflicts: Optional[List[Dict[str, Any]]] = None
    suggested_alternatives: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        from_attributes = True


class RentalPricingRequest(BaseModel):
    """Schema for rental pricing calculation."""
    
    item_id: UUID
    quantity: int
    start_date: datetime
    end_date: datetime
    customer_id: Optional[UUID] = None
    apply_discounts: bool = True


class RentalPricingResponse(BaseModel):
    """Response schema for rental pricing."""
    
    item_id: UUID
    quantity: int
    rental_days: int
    base_daily_rate: Decimal
    applied_rate: Decimal
    pricing_type: RentalPricingType
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    insurance_amount: Decimal
    deposit_required: Decimal
    total_amount: Decimal
    breakdown: Dict[str, Decimal]
    
    class Config:
        from_attributes = True


class RentalMetrics(BaseModel):
    """Schema for rental metrics and analytics."""
    
    period_start: datetime
    period_end: datetime
    total_rentals: int
    active_rentals: int
    completed_rentals: int
    overdue_rentals: int
    total_revenue: Decimal
    average_rental_duration: float
    average_rental_value: Decimal
    utilization_rate: float
    top_items: List[Dict[str, Any]]
    top_customers: List[Dict[str, Any]]
    damage_incidents: int
    damage_costs: Decimal
    late_return_rate: float
    revenue_by_category: Dict[str, Decimal]


class RentalValidationError(BaseModel):
    """Schema for rental validation errors."""
    
    field: str
    message: str
    code: str
    value: Optional[Any] = None