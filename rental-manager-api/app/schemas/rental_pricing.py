"""
Pydantic schemas for Rental Pricing operations.

These schemas handle validation and serialization for rental pricing tiers,
supporting complex pricing strategies and business rules.
"""

from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum


class PricingStrategy(str, Enum):
    """Pricing strategy types."""
    FIXED = "FIXED"
    TIERED = "TIERED"
    SEASONAL = "SEASONAL"
    DYNAMIC = "DYNAMIC"


class PeriodType(str, Enum):
    """Period type definitions."""
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


# Base schemas
class RentalPricingBase(BaseModel):
    """Base schema for rental pricing."""
    
    tier_name: str = Field(..., min_length=1, max_length=100, description="Name for this pricing tier")
    period_type: PeriodType = Field(default=PeriodType.DAILY, description="Type of rental period")
    period_days: int = Field(default=1, ge=1, description="Number of days this pricing period represents")
    rate_per_period: Decimal = Field(..., ge=0, decimal_places=2, description="Rate charged per period")
    min_rental_days: Optional[int] = Field(None, ge=1, description="Minimum rental duration in days")
    max_rental_days: Optional[int] = Field(None, ge=1, description="Maximum rental duration in days")
    effective_date: date = Field(default_factory=date.today, description="When this pricing becomes effective")
    expiry_date: Optional[date] = Field(None, description="When this pricing expires")
    is_default: bool = Field(default=False, description="Whether this is the default pricing tier")
    pricing_strategy: PricingStrategy = Field(default=PricingStrategy.FIXED, description="Pricing strategy used")
    seasonal_multiplier: Decimal = Field(default=Decimal("1.00"), ge=0.01, le=10.00, decimal_places=2, description="Seasonal adjustment multiplier")
    priority: int = Field(default=100, ge=1, le=1000, description="Priority for pricing selection")
    description: Optional[str] = Field(None, max_length=500, description="Detailed description")
    notes: Optional[str] = Field(None, max_length=1000, description="Internal notes")
    
    @field_validator('tier_name')
    @classmethod
    def validate_tier_name(cls, v):
        """Validate tier name is not empty."""
        if not v.strip():
            raise ValueError('Tier name cannot be empty')
        return v.strip()
    
    @model_validator(mode='after')
    def validate_rental_days_logic(self):
        """Validate min/max rental days logic."""
        if self.min_rental_days is not None and self.max_rental_days is not None:
            if self.min_rental_days > self.max_rental_days:
                raise ValueError('Minimum rental days cannot be greater than maximum rental days')
        return self
    
    @model_validator(mode='after')
    def validate_date_logic(self):
        """Validate effective/expiry date logic."""
        if self.effective_date and self.expiry_date and self.effective_date > self.expiry_date:
            raise ValueError('Effective date cannot be after expiry date')
        return self


class RentalPricingCreate(RentalPricingBase):
    """Schema for creating rental pricing."""
    
    item_id: UUID = Field(..., description="ID of the item this pricing applies to")


class RentalPricingUpdate(BaseModel):
    """Schema for updating rental pricing."""
    
    tier_name: Optional[str] = Field(None, min_length=1, max_length=100)
    period_type: Optional[PeriodType] = None
    period_days: Optional[int] = Field(None, ge=1)
    rate_per_period: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    min_rental_days: Optional[int] = Field(None, ge=1)
    max_rental_days: Optional[int] = Field(None, ge=1)
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    pricing_strategy: Optional[PricingStrategy] = None
    seasonal_multiplier: Optional[Decimal] = Field(None, ge=0.01, le=10.00, decimal_places=2)
    priority: Optional[int] = Field(None, ge=1, le=1000)
    description: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('tier_name')
    @classmethod
    def validate_tier_name(cls, v):
        """Validate tier name if provided."""
        if v is not None and not v.strip():
            raise ValueError('Tier name cannot be empty')
        return v.strip() if v else v
    
    @model_validator(mode='after')
    def validate_rental_days_logic(self):
        """Validate min/max rental days logic."""
        if self.min_rental_days is not None and self.max_rental_days is not None:
            if self.min_rental_days > self.max_rental_days:
                raise ValueError('Minimum rental days cannot be greater than maximum rental days')
        return self


class RentalPricingInDB(RentalPricingBase):
    """Schema for rental pricing in database."""
    
    id: UUID
    item_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    model_config = {"from_attributes": True}


class RentalPricingResponse(RentalPricingInDB):
    """Schema for rental pricing API responses."""
    
    display_name: Optional[str] = Field(None, description="Display name for this pricing tier")
    duration_description: Optional[str] = Field(None, description="Human-readable duration description")
    daily_equivalent_rate: Optional[Decimal] = Field(None, description="Equivalent daily rate for comparison")


# Bulk operations
class RentalPricingBulkCreate(BaseModel):
    """Schema for bulk creating rental pricing."""
    
    item_id: UUID = Field(..., description="ID of the item these pricing tiers apply to")
    pricing_tiers: List[RentalPricingBase] = Field(..., min_items=1, description="List of pricing tiers to create")
    
    @field_validator('pricing_tiers')
    @classmethod
    def validate_unique_tiers(cls, v):
        """Ensure tier names are unique within the request."""
        tier_names = [tier.tier_name for tier in v]
        if len(tier_names) != len(set(tier_names)):
            raise ValueError('Tier names must be unique within the request')
        return v
    
    @field_validator('pricing_tiers')
    @classmethod
    def validate_single_default(cls, v):
        """Ensure only one default tier."""
        default_count = sum(1 for tier in v if tier.is_default)
        if default_count > 1:
            raise ValueError('Only one pricing tier can be marked as default')
        return v


class RentalPricingBulkUpdate(BaseModel):
    """Schema for bulk updating rental pricing."""
    
    updates: List[tuple[UUID, RentalPricingUpdate]] = Field(..., min_items=1, description="List of (pricing_id, update_data) tuples")


# Calculation schemas
class RentalPricingCalculationRequest(BaseModel):
    """Schema for rental pricing calculation requests."""
    
    item_id: UUID = Field(..., description="ID of the item to calculate pricing for")
    rental_days: int = Field(..., ge=1, description="Number of rental days")
    calculation_date: Optional[date] = Field(default_factory=date.today, description="Date to calculate pricing for")


class RentalPricingCalculationResponse(BaseModel):
    """Schema for rental pricing calculation responses."""
    
    item_id: UUID
    rental_days: int
    applicable_tiers: List[RentalPricingResponse] = Field(..., description="All applicable pricing tiers")
    recommended_tier: Optional[RentalPricingResponse] = Field(None, description="Recommended pricing tier")
    total_cost: Decimal = Field(..., description="Total cost using recommended tier")
    daily_equivalent_rate: Decimal = Field(..., description="Daily equivalent rate")
    savings_compared_to_daily: Optional[Decimal] = Field(None, description="Savings compared to daily rate")


# Search and filter schemas
class RentalPricingFilter(BaseModel):
    """Schema for filtering rental pricing."""
    
    item_ids: Optional[List[UUID]] = None
    period_type: Optional[PeriodType] = None
    pricing_strategy: Optional[PricingStrategy] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    effective_after: Optional[date] = None
    effective_before: Optional[date] = None
    min_rate: Optional[Decimal] = Field(None, ge=0)
    max_rate: Optional[Decimal] = Field(None, ge=0)
    
    @model_validator(mode='after')
    def validate_rate_range(self):
        """Validate rate range."""
        if self.min_rate is not None and self.max_rate is not None:
            if self.min_rate > self.max_rate:
                raise ValueError('Minimum rate cannot be greater than maximum rate')
        return self


class RentalPricingSort(str, Enum):
    """Sorting options for rental pricing."""
    PRIORITY_ASC = "priority"
    PRIORITY_DESC = "-priority"
    RATE_ASC = "rate_per_period"
    RATE_DESC = "-rate_per_period"
    PERIOD_ASC = "period_days"
    PERIOD_DESC = "-period_days"
    CREATED_ASC = "created_at"
    CREATED_DESC = "-created_at"


class RentalPricingListRequest(BaseModel):
    """Schema for listing rental pricing with filters."""
    
    filters: Optional[RentalPricingFilter] = None
    sort: RentalPricingSort = RentalPricingSort.PRIORITY_ASC
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=1000)


class RentalPricingListResponse(BaseModel):
    """Schema for rental pricing list responses."""
    
    items: List[RentalPricingResponse]
    total: int
    skip: int
    limit: int


# Item-specific pricing schemas
class ItemRentalPricingSummary(BaseModel):
    """Summary of rental pricing for an item."""
    
    item_id: UUID
    default_tier: Optional[RentalPricingResponse] = None
    available_tiers: List[RentalPricingResponse] = []
    daily_rate_range: tuple[Decimal, Decimal] = Field(..., description="Min and max daily equivalent rates")
    has_tiered_pricing: bool = Field(..., description="Whether item has multiple pricing tiers")


# Template schemas for common pricing patterns
class StandardPricingTemplate(BaseModel):
    """Template for creating standard daily/weekly/monthly pricing."""
    
    daily_rate: Decimal = Field(..., ge=0, decimal_places=2, description="Daily rental rate")
    weekly_rate: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Weekly rental rate (optional)")
    monthly_rate: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Monthly rental rate (optional)")
    weekly_discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2, description="Weekly discount percentage if no weekly rate provided")
    monthly_discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2, description="Monthly discount percentage if no monthly rate provided")
    
    @model_validator(mode='after')
    def calculate_discounted_rates(self):
        """Calculate weekly/monthly rates from daily rate and discount percentages."""
        if self.daily_rate:
            # Calculate weekly rate if not provided but discount is
            if self.weekly_rate is None and self.weekly_discount_percentage is not None:
                weekly_base = self.daily_rate * 7
                discount_amount = weekly_base * (self.weekly_discount_percentage / 100)
                self.weekly_rate = weekly_base - discount_amount
            
            # Calculate monthly rate if not provided but discount is
            if self.monthly_rate is None and self.monthly_discount_percentage is not None:
                monthly_base = self.daily_rate * 30
                discount_amount = monthly_base * (self.monthly_discount_percentage / 100)
                self.monthly_rate = monthly_base - discount_amount
        
        return self


class StandardPricingTemplateResponse(BaseModel):
    """Response schema for applying standard pricing template."""
    
    created_tiers: List[RentalPricingResponse] = Field(..., description="Created pricing tiers")
    item_id: UUID = Field(..., description="Item ID the pricing was applied to")
    summary: str = Field(..., description="Summary of created pricing structure")