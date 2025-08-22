"""
Transaction Header schemas for request/response validation.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, validator

from app.models.transaction import (
    TransactionType, TransactionStatus, PaymentMethod, 
    PaymentStatus, RentalPeriodUnit, RentalStatus
)


class TransactionHeaderBase(BaseModel):
    """Base schema for transaction headers."""
    transaction_type: TransactionType
    transaction_number: Optional[str] = None
    status: TransactionStatus = TransactionStatus.PENDING
    transaction_date: Optional[datetime] = None
    due_date: Optional[date] = None
    
    # Parties
    customer_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    sales_person_id: Optional[UUID] = None
    
    # Financial
    currency: str = "INR"
    subtotal: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    shipping_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    payment_status: Optional[PaymentStatus] = PaymentStatus.PENDING
    
    # Additional
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    payment_method: Optional[PaymentMethod] = PaymentMethod.CASH
    payment_reference: Optional[str] = None
    
    # Delivery/Pickup
    delivery_required: bool = False
    delivery_address: Optional[str] = None
    delivery_date: Optional[date] = None
    delivery_time: Optional[time] = None
    pickup_required: bool = False
    pickup_date: Optional[date] = None
    pickup_time: Optional[time] = None
    
    # Rental specific
    deposit_amount: Optional[Decimal] = None
    deposit_paid: bool = False
    customer_advance_balance: Decimal = Decimal("0.00")
    
    model_config = ConfigDict(from_attributes=True)
    
    @validator('currency')
    def validate_currency(cls, v):
        if len(v) != 3:
            raise ValueError('Currency code must be 3 characters')
        return v.upper()
    
    @validator('total_amount', 'subtotal', 'paid_amount')
    def validate_amounts(cls, v):
        if v < 0:
            raise ValueError('Amount cannot be negative')
        return v
    
    @validator('delivery_address')
    def validate_delivery_address(cls, v, values):
        if values.get('delivery_required') and not v:
            raise ValueError('Delivery address is required when delivery is required')
        return v


class TransactionHeaderCreate(TransactionHeaderBase):
    """Schema for creating a transaction header."""
    lines: Optional[List["TransactionLineCreate"]] = Field(default_factory=list)
    
    @validator('customer_id')
    def validate_customer_for_sales(cls, v, values):
        if values.get('transaction_type') in [TransactionType.SALE, TransactionType.RENTAL] and not v:
            raise ValueError('Customer ID is required for sales and rentals')
        return v
    
    @validator('supplier_id')
    def validate_supplier_for_purchases(cls, v, values):
        if values.get('transaction_type') == TransactionType.PURCHASE and not v:
            raise ValueError('Supplier ID is required for purchases')
        return v


class TransactionHeaderUpdate(BaseModel):
    """Schema for updating a transaction header."""
    status: Optional[TransactionStatus] = None
    due_date: Optional[date] = None
    
    # Financial updates
    discount_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    shipping_amount: Optional[Decimal] = None
    payment_status: Optional[PaymentStatus] = None
    
    # Additional
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    
    # Delivery/Pickup updates
    delivery_required: Optional[bool] = None
    delivery_address: Optional[str] = None
    delivery_date: Optional[date] = None
    delivery_time: Optional[time] = None
    pickup_required: Optional[bool] = None
    pickup_date: Optional[date] = None
    pickup_time: Optional[time] = None
    
    model_config = ConfigDict(from_attributes=True)


class PaymentUpdate(BaseModel):
    """Schema for updating payment information."""
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    payment_method: PaymentMethod
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class TransactionHeaderResponse(TransactionHeaderBase):
    """Schema for transaction header response."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    is_active: bool = True
    
    # Calculated properties
    balance_due: Decimal = Field(default=Decimal("0.00"))
    is_paid: bool = Field(default=False)
    
    # Relationships
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    location_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_orm_with_relationships(cls, transaction):
        """Create response with relationship data."""
        data = {
            **transaction.__dict__,
            'balance_due': transaction.balance_due,
            'is_paid': transaction.is_paid,
        }
        
        # Add relationship data if available
        if transaction.customer:
            data['customer_name'] = f"{transaction.customer.first_name} {transaction.customer.last_name}"
        if transaction.supplier:
            data['supplier_name'] = transaction.supplier.company_name
        if transaction.location:
            data['location_name'] = transaction.location.location_name
        
        return cls(**data)


class TransactionHeaderDetail(TransactionHeaderResponse):
    """Detailed transaction header response with lines."""
    lines: List["TransactionLineResponse"] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    events: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    
    # Rental specific details
    rental_start_date: Optional[date] = None
    rental_end_date: Optional[date] = None
    rental_duration_days: Optional[int] = None
    current_rental_status: Optional[RentalStatus] = None
    is_overdue: Optional[bool] = None
    days_overdue: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class TransactionSummary(BaseModel):
    """Summary statistics for transactions."""
    total_count: int = 0
    total_amount: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    outstanding_amount: Decimal = Decimal("0.00")
    average_transaction_value: Decimal = Decimal("0.00")
    
    # By status
    pending_count: int = 0
    completed_count: int = 0
    cancelled_count: int = 0
    
    # By type
    sales_count: int = 0
    purchase_count: int = 0
    rental_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


# Import at the end to avoid circular imports
from .transaction_line import TransactionLineCreate, TransactionLineResponse