"""
Transaction enums - Centralized enum definitions for all transaction types.
Consolidates enums from different transaction models for easy import.
"""

from enum import Enum as PyEnum

# Import existing enums from transaction models
from .transaction_header import (
    TransactionType,
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    RentalPeriodUnit,
    RentalStatus,
)
from .transaction_line import LineItemType
from .transaction_inspection import (
    InspectionStatus,
    ConditionRating,
    DamageType,
    ItemDisposition,
)
from .rental_lifecycle import (
    ReturnEventType,
    InspectionCondition,
    RentalStatusChangeReason,
)


# Additional enums for transaction services and schemas

class DiscountType(str, PyEnum):
    """Types of discounts that can be applied."""
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"
    BOGO = "BOGO"  # Buy One Get One
    QUANTITY = "QUANTITY"  # Quantity-based discount


class RentalPricingType(str, PyEnum):
    """Pricing types for rental calculations."""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    HOURLY = "HOURLY"
    FLAT_RATE = "FLAT_RATE"


class DamageSeverity(str, PyEnum):
    """Severity levels for damage assessment."""
    NONE = "NONE"
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    MAJOR = "MAJOR"
    SEVERE = "SEVERE"
    TOTAL_LOSS = "TOTAL_LOSS"


class ReturnType(str, PyEnum):
    """Types of returns for purchase returns."""
    DEFECTIVE = "DEFECTIVE"
    WRONG_ITEM = "WRONG_ITEM"
    DAMAGED_IN_TRANSIT = "DAMAGED_IN_TRANSIT"
    NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED"
    CUSTOMER_CHANGE_MIND = "CUSTOMER_CHANGE_MIND"
    WARRANTY_CLAIM = "WARRANTY_CLAIM"
    RECALL = "RECALL"
    OVERSTOCK = "OVERSTOCK"
    EXPIRED = "EXPIRED"
    OTHER = "OTHER"


class ReturnStatus(str, PyEnum):
    """Status tracking for returns."""
    PENDING = "PENDING"
    PENDING_INSPECTION = "PENDING_INSPECTION"
    INSPECTED = "INSPECTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROCESSED = "PROCESSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PhysicalDamageType(str, PyEnum):
    """Specific types of physical damage."""
    SCRATCH = "SCRATCH"
    DENT = "DENT"
    CRACK = "CRACK"
    BREAK = "BREAK"
    STAIN = "STAIN"
    WEAR = "WEAR"
    CORROSION = "CORROSION"
    MISSING_PART = "MISSING_PART"


# Re-export all enums for easy access
__all__ = [
    # Transaction header enums
    "TransactionType",
    "TransactionStatus", 
    "PaymentMethod",
    "PaymentStatus",
    "RentalPeriodUnit",
    "RentalStatus",
    
    # Transaction line enums
    "LineItemType",
    
    # Inspection enums
    "InspectionStatus",
    "ConditionRating",
    "DamageType",
    "ItemDisposition",
    
    # Rental lifecycle enums
    "ReturnEventType",
    "InspectionCondition",
    "RentalStatusChangeReason",
    
    # Additional service enums
    "DiscountType",
    "RentalPricingType", 
    "DamageSeverity",
    "ReturnType",
    "ReturnStatus",
    "PhysicalDamageType",
]