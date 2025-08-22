"""
Sales transaction schemas for request/response validation.
Includes schemas for sales orders, line items, payments, and discounts.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
from typing_extensions import Annotated

from app.models.transaction.enums import (
    TransactionStatus,
    PaymentMethod,
    PaymentStatus,
    DiscountType,
)


class SalesDiscountCreate(BaseModel):
    """Schema for creating a sales discount."""
    
    discount_type: DiscountType
    value: Annotated[Decimal, Field(ge=0, decimal_places=2)]
    reason: Optional[str] = Field(None, max_length=500)
    authorized_by: Optional[UUID] = None
    
    @field_validator("value")
    @classmethod
    def validate_discount_value(cls, v: Decimal, info) -> Decimal:
        """Validate discount value based on type."""
        if info.data.get("discount_type") == DiscountType.PERCENTAGE:
            if v > 100:
                raise ValueError("Percentage discount cannot exceed 100%")
        return v


class SalesItemCreate(BaseModel):
    """Schema for creating a sales line item."""
    
    item_id: UUID
    quantity: Annotated[int, Field(gt=0)]
    unit_price: Annotated[Decimal, Field(ge=0, decimal_places=2)]
    discount_amount: Annotated[Decimal, Field(ge=0, decimal_places=2)] = Decimal("0.00")
    tax_amount: Annotated[Decimal, Field(ge=0, decimal_places=2)] = Decimal("0.00")
    notes: Optional[str] = Field(None, max_length=1000)
    
    @model_validator(mode="after")
    def validate_amounts(self) -> "SalesItemCreate":
        """Validate that discount doesn't exceed item total."""
        item_total = self.quantity * self.unit_price
        if self.discount_amount > item_total:
            raise ValueError("Discount amount cannot exceed item total")
        return self


class SalesItemResponse(BaseModel):
    """Response schema for a sales line item."""
    
    id: UUID
    sales_id: UUID
    item_id: UUID
    item_name: str
    item_sku: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SalesCreate(BaseModel):
    """Schema for creating a sales transaction."""
    
    customer_id: UUID
    location_id: UUID
    reference_number: str = Field(..., min_length=1, max_length=100)
    sales_date: datetime
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=100)
    salesperson_id: Optional[UUID] = None
    items: List[SalesItemCreate] = Field(..., min_length=1)
    discounts: Optional[List[SalesDiscountCreate]] = None
    shipping_address: Optional[str] = Field(None, max_length=500)
    billing_address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    metadata: Optional[Dict[str, Any]] = None
    
    @model_validator(mode="after")
    def validate_dates(self) -> "SalesCreate":
        """Validate that due date is after sales date."""
        if self.due_date and self.due_date < self.sales_date:
            raise ValueError("Due date must be after sales date")
        return self


class SalesUpdate(BaseModel):
    """Schema for updating a sales transaction."""
    
    status: Optional[TransactionStatus] = None
    payment_terms: Optional[str] = Field(None, max_length=100)
    due_date: Optional[datetime] = None
    shipping_address: Optional[str] = Field(None, max_length=500)
    billing_address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    metadata: Optional[Dict[str, Any]] = None


class SalesPaymentCreate(BaseModel):
    """Schema for creating a sales payment."""
    
    amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    payment_method: PaymentMethod
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    processor_response: Optional[Dict[str, Any]] = None


class SalesPaymentResponse(BaseModel):
    """Response schema for a sales payment."""
    
    id: UUID
    sales_id: UUID
    amount: Decimal
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    payment_date: datetime
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    processor_response: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SalesResponse(BaseModel):
    """Response schema for a sales transaction."""
    
    id: UUID
    transaction_number: str
    customer_id: UUID
    customer_name: str
    location_id: UUID
    location_name: str
    reference_number: str
    sales_date: datetime
    due_date: Optional[datetime] = None
    status: TransactionStatus
    payment_status: PaymentStatus
    payment_terms: Optional[str] = None
    salesperson_id: Optional[UUID] = None
    salesperson_name: Optional[str] = None
    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    items: List[SalesItemResponse]
    payments: List[SalesPaymentResponse]
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    
    class Config:
        from_attributes = True


class SalesSummary(BaseModel):
    """Summary schema for sales listing."""
    
    id: UUID
    transaction_number: str
    customer_name: str
    sales_date: datetime
    status: TransactionStatus
    payment_status: PaymentStatus
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    item_count: int
    
    class Config:
        from_attributes = True


class SalesFilter(BaseModel):
    """Filter schema for sales queries."""
    
    customer_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    status: Optional[TransactionStatus] = None
    payment_status: Optional[PaymentStatus] = None
    salesperson_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    reference_number: Optional[str] = None
    has_balance: Optional[bool] = None


class CustomerCreditCheck(BaseModel):
    """Schema for customer credit check response."""
    
    customer_id: UUID
    credit_limit: Decimal
    available_credit: Decimal
    current_balance: Decimal
    order_amount: Decimal
    approved: bool
    reason: Optional[str] = None
    suggested_payment: Optional[Decimal] = None


class SalesInvoice(BaseModel):
    """Schema for sales invoice generation."""
    
    invoice_number: str
    invoice_date: datetime
    sales_transaction: SalesResponse
    company_details: Dict[str, str]
    payment_instructions: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    logo_url: Optional[str] = None


class SalesMetrics(BaseModel):
    """Schema for sales metrics and analytics."""
    
    period_start: datetime
    period_end: datetime
    total_sales: Decimal
    total_transactions: int
    average_transaction_value: Decimal
    total_items_sold: int
    top_customers: List[Dict[str, Any]]
    top_items: List[Dict[str, Any]]
    payment_method_breakdown: Dict[PaymentMethod, Decimal]
    status_breakdown: Dict[TransactionStatus, int]
    daily_sales: List[Dict[str, Any]]
    growth_rate: Optional[Decimal] = None


class SalesValidationError(BaseModel):
    """Schema for sales validation errors."""
    
    field: str
    message: str
    code: str
    value: Optional[Any] = None


class SalesUpdateStatus(BaseModel):
    """Schema for updating sales status."""
    
    status: TransactionStatus
    notes: Optional[str] = Field(None, max_length=1000)
    updated_by: UUID


class SalesReport(BaseModel):
    """Schema for sales reports."""
    
    report_type: str
    period_start: datetime
    period_end: datetime
    total_sales: Decimal
    transaction_count: int
    average_order_value: Decimal
    data: Dict[str, Any]
    generated_at: datetime = Field(default_factory=datetime.utcnow)