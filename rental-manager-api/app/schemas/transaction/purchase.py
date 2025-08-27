"""
Purchase transaction schemas for request/response validation.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, validator, model_validator

from app.models.transaction import TransactionType, TransactionStatus, PaymentMethod


class PurchaseItemCreate(BaseModel):
    """Schema for creating a purchase item."""
    item_id: UUID
    quantity: Decimal = Field(..., gt=0, description="Quantity to purchase")
    unit_price: Decimal = Field(..., ge=0, description="Unit purchase price")
    
    # Optional fields
    discount_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    
    # Inventory specific
    serial_numbers: Optional[List[str]] = Field(default_factory=list)
    batch_code: Optional[str] = None
    expiry_date: Optional[date] = None
    warranty_months: Optional[int] = Field(None, ge=0)
    condition_code: Optional[str] = Field("A", pattern="^[A-D]$")
    
    # Location
    location_id: UUID
    warehouse_location: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @validator('serial_numbers')
    def validate_serial_numbers(cls, v, values):
        """Validate serial numbers are unique and match quantity for serialized items."""
        if v:
            # Check for duplicates
            if len(v) != len(set(v)):
                raise ValueError('Serial numbers must be unique')
            
            # Validate each serial number format
            for serial in v:
                if not serial or not serial.strip():
                    raise ValueError('Serial numbers cannot be empty')
                if len(serial) > 100:
                    raise ValueError('Serial number too long (max 100 characters)')
        
        return v
    
    @model_validator(mode='after')
    def validate_serialization(self):
        """Validate serialization requirements."""
        # If serial numbers provided, quantity must match
        if self.serial_numbers:
            if len(self.serial_numbers) != int(self.quantity):
                raise ValueError(f'Number of serial numbers ({len(self.serial_numbers)}) must match quantity ({self.quantity})')
        
        # Batch code and serial numbers are mutually exclusive
        if self.batch_code and self.serial_numbers:
            raise ValueError('Cannot specify both batch code and serial numbers')
        
        return self


class PurchaseCreate(BaseModel):
    """Schema for creating a purchase transaction."""
    supplier_id: UUID
    location_id: UUID
    
    # Purchase details
    reference_number: Optional[str] = Field(None, max_length=50)
    purchase_date: Optional[datetime] = None
    due_date: Optional[date] = None
    
    # Payment
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    payment_terms: Optional[str] = "NET30"
    payment_reference: Optional[str] = None
    
    # Financial
    currency: str = Field("INR", min_length=3, max_length=3)
    shipping_amount: Optional[Decimal] = Field(Decimal("0.00"), ge=0)
    other_charges: Optional[Decimal] = Field(Decimal("0.00"), ge=0)
    
    # Items
    items: List[PurchaseItemCreate] = Field(..., min_length=1)
    
    # Additional
    notes: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    
    # Delivery
    delivery_required: bool = False
    delivery_address: Optional[str] = None
    delivery_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @validator('items')
    def validate_items_not_empty(cls, v):
        if not v:
            raise ValueError('At least one item is required')
        return v
    
    @validator('currency')
    def validate_currency(cls, v):
        return v.upper()
    
    @model_validator(mode='after')
    def validate_delivery(self):
        """Validate delivery requirements."""
        if self.delivery_required and not self.delivery_address:
            raise ValueError('Delivery address is required when delivery is required')
        return self


class PurchaseUpdate(BaseModel):
    """Schema for updating a purchase."""
    status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseBulkCreate(BaseModel):
    """Schema for bulk purchase creation."""
    purchases: List["PurchaseCreate"]
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseValidationError(BaseModel):
    """Schema for purchase validation errors."""
    field: str
    message: str
    code: str
    details: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseItemResponse(BaseModel):
    """Schema for purchase item in response."""
    id: UUID
    item_id: UUID
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    discount_amount: Optional[Decimal] = Decimal("0.00")
    tax_rate: Optional[Decimal] = Decimal("0.00")
    tax_amount: Optional[Decimal] = Decimal("0.00")
    condition_code: Optional[str] = None
    serial_numbers: List[str] = Field(default_factory=list)
    batch_code: Optional[str] = None
    location_id: Optional[UUID] = None
    location_name: Optional[str] = None
    warehouse_location: Optional[str] = None
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PurchaseResponse(BaseModel):
    """Schema for purchase transaction response."""
    id: UUID
    transaction_number: str
    transaction_type: TransactionType = TransactionType.PURCHASE
    status: TransactionStatus
    
    # Dates
    transaction_date: datetime
    due_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    
    # Parties
    supplier_id: UUID
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    
    # Supplier object (for frontend compatibility)
    supplier: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    
    # Financial
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    
    # Payment
    payment_method: PaymentMethod
    payment_status: str
    payment_reference: Optional[str] = None
    
    # Reference
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    
    # Items summary
    total_items: int = 0
    total_quantity: Decimal = Decimal("0.00")
    
    # Items detail
    items: List[PurchaseItemResponse] = Field(default_factory=list)
    
    # Delivery
    delivery_required: bool
    delivery_address: Optional[str] = None
    delivery_date: Optional[date] = None
    delivery_status: Optional[str] = None
    
    # Audit
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_transaction(cls, transaction, include_details: bool = False):
        """Create response from transaction model."""
        data = {
            'id': transaction.id,
            'transaction_number': transaction.transaction_number,
            'transaction_type': transaction.transaction_type,
            'status': transaction.status,
            'transaction_date': transaction.transaction_date,
            'due_date': transaction.due_date,
            'created_at': transaction.created_at,
            'updated_at': transaction.updated_at,
            'supplier_id': transaction.supplier_id,
            'location_id': transaction.location_id,
            'currency': transaction.currency,
            'subtotal': transaction.subtotal,
            'discount_amount': transaction.discount_amount,
            'tax_amount': transaction.tax_amount,
            'shipping_amount': transaction.shipping_amount,
            'total_amount': transaction.total_amount,
            'paid_amount': transaction.paid_amount,
            'balance_due': transaction.balance_due,
            'payment_method': transaction.payment_method,
            'payment_status': transaction.payment_status.value if transaction.payment_status else 'PENDING',
            'payment_reference': transaction.payment_reference,
            'reference_number': transaction.reference_number,
            'notes': transaction.notes,
            'delivery_required': transaction.delivery_required,
            'delivery_address': transaction.delivery_address,
            'delivery_date': transaction.delivery_date,
            'created_by': transaction.created_by,
            'updated_by': transaction.updated_by,
        }
        
        # Add relationship data if available and loaded
        try:
            if hasattr(transaction, 'supplier') and transaction.supplier:
                data['supplier_name'] = getattr(transaction.supplier, 'company_name', None)
                data['supplier_code'] = getattr(transaction.supplier, 'supplier_code', None)
                # Add supplier object for frontend compatibility
                data['supplier'] = {
                    'id': str(transaction.supplier_id),
                    'name': getattr(transaction.supplier, 'company_name', None),
                    'company_name': getattr(transaction.supplier, 'company_name', None),
                    'supplier_code': getattr(transaction.supplier, 'supplier_code', None),
                    'display_name': getattr(transaction.supplier, 'company_name', None)
                }
        except:
            # Relationship not loaded or accessible
            pass
        
        try:
            if hasattr(transaction, 'location') and transaction.location:
                data['location_name'] = getattr(transaction.location, 'location_name', None)
                # Add location object for frontend compatibility
                data['location'] = {
                    'id': str(transaction.location_id),
                    'name': getattr(transaction.location, 'location_name', None),
                    'location_code': getattr(transaction.location, 'location_code', None) if hasattr(transaction.location, 'location_code') else None
                }
        except:
            # Relationship not loaded or accessible
            pass
        
        # Add items detail if lines are loaded and include_details is True
        if include_details:
            try:
                if hasattr(transaction, 'transaction_lines') and transaction.transaction_lines:
                    items = []
                    for line in transaction.transaction_lines:
                        item_data = {
                            'id': line.id,
                            'item_id': line.item_id,
                            'quantity': line.quantity,
                            'unit_price': line.unit_price,
                            'line_total': line.line_total,
                            'discount_amount': line.discount_amount,
                            'tax_rate': line.tax_rate,
                            'tax_amount': line.tax_amount,
                            'condition_code': getattr(line, 'condition', 'A'),
                            'serial_numbers': getattr(line, 'serial_numbers', []) or [],
                            'batch_code': getattr(line, 'batch_code', None),
                            'location_id': line.location_id,
                            'warehouse_location': getattr(line, 'warehouse_location', None),
                            'notes': getattr(line, 'notes', None)
                        }
                        
                        # Add item details if relationship is loaded
                        if hasattr(line, 'item') and line.item:
                            item_data['item_name'] = getattr(line.item, 'item_name', None)
                            item_data['item_sku'] = getattr(line.item, 'sku', None)
                        
                        # Add location name if relationship is loaded
                        if hasattr(line, 'location') and line.location:
                            item_data['location_name'] = getattr(line.location, 'location_name', None)
                        
                        items.append(PurchaseItemResponse(**item_data))
                    
                    data['items'] = items
                    data['total_items'] = len(items)
                    data['total_quantity'] = sum(item.quantity for item in items)
            except Exception as e:
                # Transaction lines not loaded or accessible
                print(f"Error loading transaction lines: {e}")
                pass
        else:
            # Add items summary if lines are loaded
            try:
                if hasattr(transaction, 'transaction_lines') and transaction.transaction_lines:
                    data['total_items'] = len(transaction.transaction_lines)
                    data['total_quantity'] = sum(getattr(line, 'quantity', 0) for line in transaction.transaction_lines)
            except:
                # Transaction lines not loaded or accessible
                pass
        
        return cls(**data)


class PurchaseListResponse(BaseModel):
    """Schema for purchase list response."""
    items: List[PurchaseResponse]
    total: int
    page: int
    size: int
    pages: int
    
    model_config = ConfigDict(from_attributes=True)