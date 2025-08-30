"""
Rental Pricing model for flexible pricing strategies.

This model supports tiered pricing, seasonal adjustments, and complex rental pricing strategies
while maintaining performance through proper indexing and relationships.
"""

from typing import Optional, TYPE_CHECKING, List
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from sqlalchemy import (
    Column, String, Boolean, Numeric, Integer, DateTime, Date, Index, ForeignKey,
    UniqueConstraint, CheckConstraint, event
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID as SA_UUID
from enum import Enum as PyEnum

from app.db.base import RentalManagerBaseModel

if TYPE_CHECKING:
    from app.models.item import Item


class PricingStrategy(str, PyEnum):
    """Pricing strategy types."""
    FIXED = "FIXED"          # Fixed rate regardless of duration
    TIERED = "TIERED"        # Different rates for different durations
    SEASONAL = "SEASONAL"    # Season-based adjustments
    DYNAMIC = "DYNAMIC"      # Demand-based pricing


class PeriodType(str, PyEnum):
    """Period type definitions."""
    HOURLY = "HOURLY"
    DAILY = "DAILY" 
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


class PeriodUnit(str, PyEnum):
    """Period unit definitions for flexible pricing."""
    HOUR = "HOUR"
    DAY = "DAY"


class RentalPricing(RentalManagerBaseModel):
    """
    Rental pricing tiers for items.
    
    This model provides flexible pricing strategies:
    - Tiered pricing (e.g., daily, weekly, monthly rates)
    - Minimum and maximum rental periods
    - Seasonal adjustments
    - Custom pricing rules
    
    Attributes:
        item_id: Foreign key to Item
        tier_name: Human-readable name for this pricing tier
        period_type: Type of period (DAILY, WEEKLY, MONTHLY, etc.)
        period_days: Number of days this pricing applies to
        rate_per_period: Rate for this period
        min_rental_days: Minimum rental duration in days
        max_rental_days: Maximum rental duration in days (null = unlimited)
        effective_date: When this pricing becomes effective
        expiry_date: When this pricing expires (null = never)
        is_default: Whether this is the default pricing tier
        pricing_strategy: Strategy used for this tier
        seasonal_multiplier: Multiplier for seasonal adjustments
        priority: Priority order for pricing selection (lower = higher priority)
    """
    
    __tablename__ = "rental_pricing"
    
    # Foreign Key Relationships
    item_id = Column(
        SA_UUID(as_uuid=True),
        ForeignKey("items.id", name="fk_rental_pricing_item"),
        nullable=False,
        index=True,
        comment="Parent item this pricing applies to"
    )
    
    # Pricing Tier Configuration
    tier_name = Column(
        String(100),
        nullable=False,
        comment="Human-readable name for this pricing tier (e.g., 'Daily Rate', 'Weekly Discount')"
    )
    
    period_type = Column(
        String(20),
        nullable=False,
        default=PeriodType.DAILY.value,
        comment="Type of rental period"
    )
    
    period_days = Column(
        Integer,
        nullable=True,
        comment="Number of days this pricing period represents (for DAY unit)"
    )
    
    period_hours = Column(
        Integer,
        nullable=True,
        comment="Number of hours this pricing period represents (for HOUR unit)"
    )
    
    period_unit = Column(
        String(10),
        nullable=False,
        default=PeriodUnit.DAY.value,
        comment="Unit of measure for the rental period (HOUR or DAY)"
    )
    
    rate_per_period = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Rate charged per period"
    )
    
    # Rental Duration Constraints
    min_rental_days = Column(
        Integer,
        nullable=True,
        comment="Minimum rental duration in days to qualify for this rate (deprecated - use min_rental_periods)"
    )
    
    max_rental_days = Column(
        Integer,
        nullable=True,
        comment="Maximum rental duration in days for this rate (deprecated - use max_rental_periods)"
    )
    
    min_rental_periods = Column(
        Integer,
        nullable=True,
        comment="Minimum rental duration in periods to qualify for this rate"
    )
    
    max_rental_periods = Column(
        Integer,
        nullable=True,
        comment="Maximum rental duration in periods for this rate (null = unlimited)"
    )
    
    # Effective Period
    effective_date = Column(
        Date,
        nullable=False,
        default=lambda: datetime.utcnow().date(),
        comment="Date when this pricing becomes effective"
    )
    
    expiry_date = Column(
        Date,
        nullable=True,
        comment="Date when this pricing expires (null = never expires)"
    )
    
    # Configuration Flags
    is_default = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this is the default pricing tier for the item"
    )
    
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether this pricing tier is currently active"
    )
    
    # Pricing Strategy
    pricing_strategy = Column(
        String(20),
        nullable=False,
        default=PricingStrategy.FIXED.value,
        comment="Pricing strategy used"
    )
    
    seasonal_multiplier = Column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("1.00"),
        comment="Seasonal adjustment multiplier (1.00 = no adjustment)"
    )
    
    priority = Column(
        Integer,
        nullable=False,
        default=100,
        comment="Priority for pricing selection (lower number = higher priority)"
    )
    
    # Additional Configuration
    description = Column(
        String(500),
        nullable=True,
        comment="Detailed description of this pricing tier"
    )
    
    notes = Column(
        String(1000),
        nullable=True,
        comment="Internal notes about this pricing tier"
    )
    
    # Relationships
    item = relationship("Item", back_populates="rental_pricing", lazy="select")
    
    # Constraints and Indexes
    __table_args__ = (
        # Ensure logical constraints
        CheckConstraint(
            '(period_unit = \'DAY\' AND period_days > 0 AND period_hours IS NULL) OR (period_unit = \'HOUR\' AND period_hours > 0 AND period_days IS NULL)',
            name='ck_rental_pricing_period_unit_consistency'
        ),
        CheckConstraint(
            'rate_per_period >= 0',
            name='ck_rental_pricing_rate_non_negative'
        ),
        CheckConstraint(
            'min_rental_days IS NULL OR min_rental_days > 0',
            name='ck_rental_pricing_min_days_positive'
        ),
        CheckConstraint(
            'max_rental_days IS NULL OR max_rental_days > 0',
            name='ck_rental_pricing_max_days_positive'
        ),
        CheckConstraint(
            'min_rental_days IS NULL OR max_rental_days IS NULL OR min_rental_days <= max_rental_days',
            name='ck_rental_pricing_min_max_days_logical'
        ),
        CheckConstraint(
            'min_rental_periods IS NULL OR min_rental_periods > 0',
            name='ck_rental_pricing_min_periods_positive'
        ),
        CheckConstraint(
            'max_rental_periods IS NULL OR max_rental_periods > 0',
            name='ck_rental_pricing_max_periods_positive'
        ),
        CheckConstraint(
            'min_rental_periods IS NULL OR max_rental_periods IS NULL OR min_rental_periods <= max_rental_periods',
            name='ck_rental_pricing_min_max_periods_logical'
        ),
        CheckConstraint(
            'seasonal_multiplier > 0',
            name='ck_rental_pricing_seasonal_multiplier_positive'
        ),
        CheckConstraint(
            'expiry_date IS NULL OR effective_date <= expiry_date',
            name='ck_rental_pricing_effective_expiry_logical'
        ),
        
        # Unique constraints
        UniqueConstraint(
            'item_id', 'tier_name', 'effective_date',
            name='uq_rental_pricing_item_tier_effective'
        ),
        
        # Performance indexes
        Index('idx_rental_pricing_item_active', 'item_id', 'is_active'),
        Index('idx_rental_pricing_item_default', 'item_id', 'is_default'),
        Index('idx_rental_pricing_item_priority', 'item_id', 'priority', 'is_active'),
        Index('idx_rental_pricing_effective_expiry', 'effective_date', 'expiry_date'),
        Index('idx_rental_pricing_period_days', 'period_days', 'is_active'),
        Index('idx_rental_pricing_min_max_days', 'min_rental_days', 'max_rental_days', 'is_active'),
        
        # Composite indexes for common queries
        Index('idx_rental_pricing_lookup', 'item_id', 'is_active', 'effective_date', 'expiry_date', 'priority'),
        Index('idx_rental_pricing_duration_match', 'item_id', 'min_rental_days', 'max_rental_days', 'is_active'),
    )
    
    def __init__(
        self,
        item_id: UUID,
        tier_name: str,
        rate_per_period: Decimal,
        period_days: Optional[int] = None,
        period_hours: Optional[int] = None,
        period_unit: PeriodUnit = PeriodUnit.DAY,
        period_type: PeriodType = PeriodType.DAILY,
        min_rental_days: Optional[int] = None,
        max_rental_days: Optional[int] = None,
        min_rental_periods: Optional[int] = None,
        max_rental_periods: Optional[int] = None,
        is_default: bool = False,
        pricing_strategy: PricingStrategy = PricingStrategy.FIXED,
        **kwargs
    ):
        """
        Initialize a RentalPricing instance.
        
        Args:
            item_id: ID of the item this pricing applies to
            tier_name: Name of this pricing tier
            rate_per_period: Rate charged per period
            period_days: Number of days this period represents (for DAY unit)
            period_hours: Number of hours this period represents (for HOUR unit)
            period_unit: Unit of measure for the rental period (HOUR or DAY)
            period_type: Type of period
            min_rental_days: Minimum rental duration in days (deprecated)
            max_rental_days: Maximum rental duration in days (deprecated)
            min_rental_periods: Minimum rental duration in periods
            max_rental_periods: Maximum rental duration in periods
            is_default: Whether this is the default pricing tier
            pricing_strategy: Strategy used for this tier
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.item_id = item_id
        self.tier_name = tier_name
        self.rate_per_period = rate_per_period
        self.period_days = period_days if period_unit == PeriodUnit.DAY else None
        self.period_hours = period_hours if period_unit == PeriodUnit.HOUR else None
        self.period_unit = period_unit.value if isinstance(period_unit, PeriodUnit) else period_unit
        self.period_type = period_type.value if isinstance(period_type, PeriodType) else period_type
        self.min_rental_days = min_rental_days
        self.max_rental_days = max_rental_days
        self.min_rental_periods = min_rental_periods
        self.max_rental_periods = max_rental_periods
        self.is_default = is_default
        self.pricing_strategy = pricing_strategy.value if isinstance(pricing_strategy, PricingStrategy) else pricing_strategy
        self._validate()
    
    def _validate(self):
        """Validate pricing rules."""
        if self.rate_per_period < 0:
            raise ValueError("Rate per period cannot be negative")
        
        # Validate period unit consistency
        if self.period_unit == PeriodUnit.DAY.value:
            if self.period_days is None or self.period_days <= 0:
                raise ValueError("Period days must be positive for DAY unit")
            if self.period_hours is not None:
                raise ValueError("Period hours must be None for DAY unit")
        elif self.period_unit == PeriodUnit.HOUR.value:
            if self.period_hours is None or self.period_hours <= 0:
                raise ValueError("Period hours must be positive for HOUR unit")
            if self.period_days is not None:
                raise ValueError("Period days must be None for HOUR unit")
        else:
            raise ValueError(f"Invalid period unit: {self.period_unit}")
        
        # Legacy validation for backward compatibility
        if self.min_rental_days is not None and self.min_rental_days <= 0:
            raise ValueError("Minimum rental days must be positive")
        
        if self.max_rental_days is not None and self.max_rental_days <= 0:
            raise ValueError("Maximum rental days must be positive")
        
        if (self.min_rental_days is not None and 
            self.max_rental_days is not None and 
            self.min_rental_days > self.max_rental_days):
            raise ValueError("Minimum rental days cannot be greater than maximum rental days")
        
        # New period-based validation
        if self.min_rental_periods is not None and self.min_rental_periods <= 0:
            raise ValueError("Minimum rental periods must be positive")
        
        if self.max_rental_periods is not None and self.max_rental_periods <= 0:
            raise ValueError("Maximum rental periods must be positive")
        
        if (self.min_rental_periods is not None and 
            self.max_rental_periods is not None and 
            self.min_rental_periods > self.max_rental_periods):
            raise ValueError("Minimum rental periods cannot be greater than maximum rental periods")
    
    @validates('rate_per_period')
    def validate_rate(self, key, value):
        """Validate rate is non-negative."""
        if value < 0:
            raise ValueError("Rate per period cannot be negative")
        return value
    
    @validates('period_days')
    def validate_period_days(self, key, value):
        """Validate period days is positive when provided."""
        if value is not None and value <= 0:
            raise ValueError("Period days must be positive")
        return value
    
    @validates('period_hours')
    def validate_period_hours(self, key, value):
        """Validate period hours is positive when provided."""
        if value is not None and value <= 0:
            raise ValueError("Period hours must be positive")
        return value
    
    @validates('min_rental_days', 'max_rental_days')
    def validate_rental_days(self, key, value):
        """Validate rental days constraints."""
        if value is not None and value <= 0:
            raise ValueError(f"{key.replace('_', ' ').title()} must be positive")
        return value
    
    def is_applicable_for_duration(self, rental_days: int) -> bool:
        """
        Check if this pricing tier applies to a given rental duration.
        
        Args:
            rental_days: Number of rental days
            
        Returns:
            True if this pricing applies to the given duration
        """
        if not self.is_active:
            return False
        
        # Check date range
        today = datetime.utcnow().date()
        if self.effective_date > today:
            return False
        if self.expiry_date and self.expiry_date < today:
            return False
        
        # Check duration constraints
        if self.min_rental_days is not None and rental_days < self.min_rental_days:
            return False
        if self.max_rental_days is not None and rental_days > self.max_rental_days:
            return False
        
        return True
    
    def calculate_total_cost(self, rental_days: int) -> Decimal:
        """
        Calculate total rental cost for given duration.
        
        Args:
            rental_days: Number of rental days
            
        Returns:
            Total cost for the rental period
        """
        if not self.is_applicable_for_duration(rental_days):
            raise ValueError(f"This pricing tier does not apply to {rental_days} days")
        
        # Calculate number of periods needed
        periods = rental_days / self.period_days
        
        # Apply seasonal multiplier
        base_cost = self.rate_per_period * Decimal(str(periods))
        total_cost = base_cost * self.seasonal_multiplier
        
        return total_cost.quantize(Decimal('0.01'))
    
    def get_period_value(self) -> int:
        """
        Get the period value (days or hours) based on the unit.
        
        Returns:
            Period value in the appropriate unit
        """
        if self.period_unit == PeriodUnit.DAY.value:
            return self.period_days or 1
        else:  # HOUR
            return self.period_hours or 1
    
    def get_period_hours(self) -> int:
        """
        Get the period duration in hours for calculations.
        
        Returns:
            Period duration in hours
        """
        if self.period_unit == PeriodUnit.DAY.value:
            return (self.period_days or 1) * 24
        else:  # HOUR
            return self.period_hours or 1
    
    def get_daily_equivalent_rate(self) -> Decimal:
        """
        Get the equivalent daily rate for comparison.
        
        Returns:
            Daily equivalent rate
        """
        if self.period_unit == PeriodUnit.DAY.value:
            daily_rate = (self.rate_per_period / Decimal(str(self.period_days or 1))) * self.seasonal_multiplier
        else:  # HOUR
            hours_per_day = 24
            daily_rate = (self.rate_per_period / Decimal(str(self.period_hours or 1)) * hours_per_day) * self.seasonal_multiplier
        
        return daily_rate.quantize(Decimal('0.01'))
    
    @property
    def display_name(self) -> str:
        """Get display name for this pricing tier."""
        period_value = self.get_period_value()
        unit = "hour" if self.period_unit == PeriodUnit.HOUR.value else "day"
        unit_suffix = "s" if period_value > 1 else ""
        return f"{self.tier_name} ({period_value} {unit}{unit_suffix})"
    
    @property
    def duration_description(self) -> str:
        """Get human-readable duration description."""
        # Use new period-based constraints if available
        min_periods = self.min_rental_periods
        max_periods = self.max_rental_periods
        
        # Fallback to legacy day-based constraints
        if min_periods is None and max_periods is None:
            min_periods = self.min_rental_days
            max_periods = self.max_rental_days
        
        if min_periods is None and max_periods is None:
            return "Any duration"
        elif min_periods is None:
            period_desc = f"{max_periods} period{'s' if max_periods and max_periods > 1 else ''}"
            return f"Up to {period_desc}"
        elif max_periods is None:
            period_desc = f"{min_periods} period{'s' if min_periods and min_periods > 1 else ''}"
            return f"{period_desc}+ minimum"
        else:
            return f"{min_periods}-{max_periods} periods"
    
    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "item_id": str(self.item_id),
            "tier_name": self.tier_name,
            "period_type": self.period_type,
            "period_days": self.period_days,
            "period_hours": self.period_hours,
            "period_unit": self.period_unit,
            "period_value": self.get_period_value(),
            "rate_per_period": float(self.rate_per_period),
            "min_rental_days": self.min_rental_days,
            "max_rental_days": self.max_rental_days,
            "min_rental_periods": self.min_rental_periods,
            "max_rental_periods": self.max_rental_periods,
            "effective_date": self.effective_date.isoformat() if self.effective_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "is_default": self.is_default,
            "is_active": self.is_active,
            "pricing_strategy": self.pricing_strategy,
            "seasonal_multiplier": float(self.seasonal_multiplier),
            "priority": self.priority,
            "description": self.description,
            "notes": self.notes,
            "display_name": self.display_name,
            "duration_description": self.duration_description,
            "daily_equivalent_rate": float(self.get_daily_equivalent_rate()),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "updated_by": self.updated_by,
        }
    
    def __str__(self) -> str:
        """String representation of pricing tier."""
        period_value = self.get_period_value()
        unit = "h" if self.period_unit == PeriodUnit.HOUR.value else "d"
        return f"{self.tier_name} - ${self.rate_per_period}/{period_value}{unit}"
    
    def __repr__(self) -> str:
        """Developer representation of pricing tier."""
        period_value = self.get_period_value()
        unit = "h" if self.period_unit == PeriodUnit.HOUR.value else "d"
        return (
            f"RentalPricing(id={self.id}, item_id={self.item_id}, "
            f"tier='{self.tier_name}', rate={self.rate_per_period}, "
            f"period={period_value}{unit}, active={self.is_active})"
        )


# Auto-set priority if not provided
@event.listens_for(RentalPricing, "before_insert")
def set_default_priority(mapper, connection, target):
    """Set default priority based on period days if not provided."""
    if target.priority == 100:  # Default value
        # Shorter periods get higher priority (lower number)
        if target.period_days == 1:
            target.priority = 10  # Daily - highest priority
        elif target.period_days == 7:
            target.priority = 20  # Weekly
        elif target.period_days == 30:
            target.priority = 30  # Monthly
        else:
            target.priority = 50  # Custom periods