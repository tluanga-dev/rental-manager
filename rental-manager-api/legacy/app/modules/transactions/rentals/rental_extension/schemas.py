"""
Pydantic schemas for rental extension operations
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from enum import Enum


class PaymentOption(str, Enum):
    """Payment options for extensions"""
    PAY_NOW = "PAY_NOW"
    PAY_LATER = "PAY_LATER"


class ItemAction(str, Enum):
    """Actions for individual items in extension"""
    EXTEND = "EXTEND"
    PARTIAL_RETURN = "PARTIAL_RETURN"
    FULL_RETURN = "FULL_RETURN"


class ItemCondition(str, Enum):
    """Condition of returned items"""
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"
    BEYOND_REPAIR = "BEYOND_REPAIR"


class ExtensionItemRequest(BaseModel):
    """Request for extending/returning individual item"""
    line_id: str = Field(..., description="Transaction line ID")
    action: ItemAction = Field(..., description="Action to take for this item")
    extend_quantity: Optional[Decimal] = Field(None, ge=0, description="Quantity to extend")
    return_quantity: Optional[Decimal] = Field(0, ge=0, description="Quantity to return")
    new_end_date: Optional[date] = Field(None, description="Item-specific end date (optional)")
    return_condition: Optional[ItemCondition] = Field(None, description="Condition of returned items")
    condition_notes: Optional[str] = Field(None, description="Notes about item condition")
    damage_assessment: Optional[Decimal] = Field(0, ge=0, description="Damage charge if applicable")
    
    @field_validator("extend_quantity", "return_quantity")
    @classmethod
    def validate_quantities(cls, v):
        if v is not None and v < 0:
            raise ValueError("Quantity cannot be negative")
        return v


class RentalExtensionRequest(BaseModel):
    """Request for extending a rental"""
    new_end_date: date = Field(..., description="New end date for the rental")
    items: List[ExtensionItemRequest] = Field(..., description="Items to extend/return")
    payment_option: PaymentOption = Field(PaymentOption.PAY_LATER, description="Payment option")
    payment_amount: Optional[Decimal] = Field(0, ge=0, description="Amount to pay now (optional)")
    notes: Optional[str] = Field(None, description="Extension notes")
    
    @field_validator("new_end_date")
    @classmethod
    def validate_end_date(cls, v):
        if v <= date.today():
            raise ValueError("New end date must be in the future")
        return v
    
    @field_validator("payment_amount")
    @classmethod
    def validate_payment(cls, v, values):
        if "payment_option" in values and values["payment_option"] == PaymentOption.PAY_NOW:
            if v is None or v <= 0:
                raise ValueError("Payment amount required when PAY_NOW is selected")
        return v


class ExtensionAvailabilityRequest(BaseModel):
    """Request to check extension availability"""
    new_end_date: date = Field(..., description="Proposed new end date")
    items: Optional[List[Dict[str, Any]]] = Field(None, description="Specific items to check")


class BookingConflict(BaseModel):
    """Information about a booking conflict"""
    item_id: str
    item_name: str
    conflicting_bookings: int
    earliest_conflict_date: date
    conflicting_customer: str
    max_extendable_date: date
    requested_quantity: float
    available_quantity: float


class ItemAvailability(BaseModel):
    """Availability information for an item"""
    line_id: str
    item_id: str
    item_name: str
    current_end_date: date
    can_extend_to: Optional[date]
    max_extension_date: Optional[date]
    has_conflict: bool


class ExtensionAvailabilityResponse(BaseModel):
    """Response for extension availability check"""
    can_extend: bool = Field(..., description="Whether extension is possible")
    conflicts: Dict[str, BookingConflict] = Field(default_factory=dict, description="Booking conflicts if any")
    extension_charges: float = Field(..., description="Calculated extension charges")
    current_balance: float = Field(..., description="Current balance due")
    total_with_extension: float = Field(..., description="Total balance after extension")
    payment_required: bool = Field(False, description="Whether payment is required (always false)")
    items: List[ItemAvailability] = Field(default_factory=list, description="Item-level availability")


class ExtensionLineResponse(BaseModel):
    """Response for individual extension line"""
    line_id: str
    item_id: str
    item_name: str
    original_quantity: float
    extended_quantity: float
    returned_quantity: float
    new_end_date: date
    return_condition: Optional[str]
    damage_assessment: Optional[float]


class RentalExtensionResponse(BaseModel):
    """Response after processing extension"""
    success: bool
    extension_id: str
    rental_id: str
    transaction_number: str
    original_end_date: date
    new_end_date: date
    extension_type: str
    extension_charges: float
    payment_received: float
    total_balance: float
    payment_status: str
    extension_count: int
    lines: Optional[List[ExtensionLineResponse]] = None
    message: Optional[str] = None


class RentalBalanceResponse(BaseModel):
    """Current balance information for a rental"""
    rental_id: str
    transaction_number: str
    original_rental: float
    extension_charges: float
    late_fees: float
    damage_fees: float
    total_charges: float
    payments_received: float
    balance_due: float
    payment_status: str
    extension_count: int


class ExtensionHistoryItem(BaseModel):
    """Historical extension record"""
    extension_id: str
    extension_date: datetime
    original_end_date: date
    new_end_date: date
    extension_type: str
    extension_charges: float
    payment_received: float
    payment_status: str
    extended_by: Optional[str]
    notes: Optional[str]


class ExtensionHistoryResponse(BaseModel):
    """Response for extension history query"""
    rental_id: str
    transaction_number: str
    total_extensions: int
    extensions: List[ExtensionHistoryItem]