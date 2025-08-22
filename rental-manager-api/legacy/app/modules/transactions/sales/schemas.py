"""
Sales transaction schemas for request/response validation.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, validator
from uuid import UUID

from app.modules.transactions.base.models.transaction_headers import (
    TransactionStatus, 
    PaymentStatus, 
    PaymentMethod
)


# Saleable Items Schemas
class SaleableItemResponse(BaseModel):
    """Schema for saleable item with availability information"""
    id: UUID
    item_name: str
    sku: str
    sale_price: Optional[Decimal] = None
    purchase_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = Field(default=Decimal("0.00"))
    is_saleable: bool
    item_status: str
    
    # Category and Brand info
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    brand_id: Optional[UUID] = None
    brand_name: Optional[str] = None
    
    # Unit of measurement
    unit_of_measurement_id: UUID
    unit_name: str
    unit_abbreviation: str
    
    # Stock information
    available_quantity: int = Field(default=0, description="Available stock quantity")
    reserved_quantity: int = Field(default=0, description="Reserved stock quantity")
    total_stock: int = Field(default=0, description="Total stock across all locations")
    
    # Additional info
    model_number: Optional[str] = None
    description: Optional[str] = None
    specifications: Optional[str] = None


class SaleableItemsListResponse(BaseModel):
    """Schema for paginated saleable items list"""
    success: bool = True
    data: List[SaleableItemResponse]
    total: int
    skip: int
    limit: int
    message: str = "Saleable items retrieved successfully"


# Request Schemas
class CreateSaleItemRequest(BaseModel):
    """Schema for adding an item to a sale"""
    item_id: UUID = Field(..., description="UUID of the item being sold")
    quantity: int = Field(..., gt=0, description="Quantity being sold")
    unit_price: Decimal = Field(..., ge=0, description="Unit price for the item")
    tax_rate: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, le=100, description="Tax rate percentage")
    discount_amount: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, description="Discount amount for this line")
    notes: Optional[str] = Field(default=None, max_length=500, description="Notes for this line item")


class CreateSaleRequest(BaseModel):
    """Schema for creating a new sale transaction"""
    customer_id: UUID = Field(..., description="UUID of the customer")
    transaction_date: Optional[datetime] = Field(default_factory=datetime.utcnow, description="Transaction date and time")
    location_id: Optional[UUID] = Field(default=None, description="Location where sale is made")
    sales_person_id: Optional[UUID] = Field(default=None, description="Sales person handling the transaction")
    payment_method: Optional[PaymentMethod] = Field(default=PaymentMethod.CASH, description="Payment method")
    payment_status: Optional[PaymentStatus] = Field(default=PaymentStatus.PENDING, description="Payment status")
    notes: Optional[str] = Field(default=None, max_length=1000, description="Transaction notes")
    reference_number: Optional[str] = Field(default=None, max_length=100, description="External reference number")
    items: List[CreateSaleItemRequest] = Field(..., min_items=1, description="List of items being sold")
    
    # Financial overrides (optional)
    custom_discount: Optional[Decimal] = Field(default=None, ge=0, description="Custom discount amount")
    custom_tax: Optional[Decimal] = Field(default=None, ge=0, description="Custom tax amount")


# Response Schemas
class SaleItemResponse(BaseModel):
    """Schema for sale line item response"""
    id: UUID
    line_number: int
    item_id: UUID
    item_name: str
    item_sku: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    line_subtotal: Decimal
    line_total: Decimal
    notes: Optional[str] = None
    created_at: datetime


class SaleTransactionResponse(BaseModel):
    """Schema for sale transaction response"""
    id: UUID
    transaction_number: str
    transaction_type: str
    status: TransactionStatus
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    
    # Party information
    customer_id: UUID
    customer_name: str
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    sales_person_id: Optional[UUID] = None
    sales_person_name: Optional[str] = None
    
    # Temporal information
    transaction_date: datetime
    due_date: Optional[date] = None
    
    # Financial information
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    
    # Additional information
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None


class SaleTransactionWithLinesResponse(SaleTransactionResponse):
    """Schema for sale transaction with line items"""
    items: List[SaleItemResponse]


class CreateSaleResponse(BaseModel):
    """Schema for create sale response"""
    success: bool = True
    message: str = "Sale transaction created successfully"
    transaction_id: UUID
    transaction_number: str
    data: SaleTransactionWithLinesResponse


# Filter and List Schemas
class SaleFilters(BaseModel):
    """Schema for filtering sales transactions"""
    skip: Optional[int] = Field(default=0, ge=0)
    limit: Optional[int] = Field(default=100, ge=1, le=1000)
    customer_id: Optional[UUID] = None
    location_id: Optional[UUID] = None
    sales_person_id: Optional[UUID] = None
    status: Optional[TransactionStatus] = None
    payment_status: Optional[PaymentStatus] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = Field(default=None, max_length=255)
    
    @validator('date_to')
    def date_to_must_be_after_date_from(cls, v, values):
        if v and values.get('date_from') and v < values['date_from']:
            raise ValueError('date_to must be after date_from')
        return v


class SaleListResponse(BaseModel):
    """Schema for paginated sales list response"""
    success: bool = True
    data: List[SaleTransactionResponse]
    total: int
    skip: int
    limit: int
    message: str = "Sales retrieved successfully"


# Analytics Schemas
class SalesStats(BaseModel):
    """Schema for sales statistics"""
    today_sales: Decimal = Field(default=Decimal("0.00"))
    weekly_sales: Decimal = Field(default=Decimal("0.00"))
    monthly_sales: Decimal = Field(default=Decimal("0.00"))
    yearly_sales: Decimal = Field(default=Decimal("0.00"))
    total_transactions: int = Field(default=0)
    average_sale_amount: Decimal = Field(default=Decimal("0.00"))
    top_selling_items: List[Dict[str, Any]] = Field(default_factory=list)


class SalesDashboardData(BaseModel):
    """Schema for sales dashboard data"""
    stats: SalesStats
    recent_sales: List[SaleTransactionResponse]
    sales_trends: List[Dict[str, Any]] = Field(default_factory=list)


class SalesDashboardResponse(BaseModel):
    """Schema for sales dashboard response"""
    success: bool = True
    message: str = "Sales dashboard data retrieved successfully"
    data: SalesDashboardData
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Update Schemas
class UpdateSaleStatusRequest(BaseModel):
    """Schema for updating sale status"""
    status: TransactionStatus
    notes: Optional[str] = Field(default=None, max_length=500)


class ProcessRefundRequest(BaseModel):
    """Schema for processing sale refund"""
    refund_amount: Optional[Decimal] = Field(default=None, ge=0, description="Partial refund amount (full refund if not specified)")
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for refund")
    refund_method: Optional[PaymentMethod] = Field(default=PaymentMethod.CASH, description="Refund method")


# Receipt and Invoice Schemas
class SaleReceiptData(BaseModel):
    """Schema for sale receipt data"""
    transaction: SaleTransactionWithLinesResponse
    customer: Dict[str, Any]
    company: Dict[str, Any]
    totals_breakdown: Dict[str, Decimal]


class GenerateReceiptRequest(BaseModel):
    """Schema for receipt generation request"""
    format: str = Field(default="pdf", pattern="^(pdf|html|json)$")
    email_to: Optional[str] = Field(default=None, description="Email address to send receipt")
    include_company_logo: bool = Field(default=True)


# Validation Schemas
class SaleValidationResult(BaseModel):
    """Schema for sale validation results"""
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    stock_validation: Dict[UUID, Dict[str, Any]] = Field(default_factory=dict)