"""
Transaction Line schemas for request/response validation.
"""

from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, validator

from app.models.transaction import LineItemType, RentalPeriodUnit, RentalStatus


class TransactionLineBase(BaseModel):
    """Base schema for transaction lines."""
    line_number: int = Field(..., gt=0)
    line_type: LineItemType = LineItemType.PRODUCT
    
    # Item identification
    item_id: Optional[UUID] = None
    inventory_unit_id: Optional[UUID] = None
    sku: Optional[str] = None
    description: str
    category: Optional[str] = None
    
    # Quantity and pricing
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_of_measure: Optional[str] = None
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_price: Optional[Decimal] = None
    discount_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    line_total: Optional[Decimal] = None
    
    # Rental specific
    rental_start_date: Optional[date] = None
    rental_end_date: Optional[date] = None
    rental_period: Optional[int] = Field(None, gt=0)
    rental_period_unit: Optional[RentalPeriodUnit] = None
    current_rental_status: Optional[RentalStatus] = None
    daily_rate: Optional[Decimal] = Field(None, ge=0)
    
    # Location and fulfillment
    location_id: Optional[UUID] = None
    warehouse_location: Optional[str] = None
    status: str = "PENDING"
    fulfillment_status: str = "PENDING"
    
    # Return handling
    returned_quantity: Decimal = Field(default=Decimal("0.00"), ge=0)
    return_date: Optional[date] = None
    notes: Optional[str] = None
    return_condition: Optional[str] = Field(None, pattern="^[A-D]$")
    return_to_stock: Optional[bool] = True
    inspection_status: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @validator('returned_quantity')
    def validate_returned_quantity(cls, v, values):
        if 'quantity' in values and v > values['quantity']:
            raise ValueError('Returned quantity cannot exceed ordered quantity')
        return v
    
    @validator('rental_end_date')
    def validate_rental_dates(cls, v, values):
        if v and 'rental_start_date' in values and values['rental_start_date']:
            if v < values['rental_start_date']:
                raise ValueError('Rental end date must be after start date')
        return v
    
    @validator('description')
    def validate_description(cls, v):
        if not v or not v.strip():
            raise ValueError('Description cannot be empty')
        return v


class TransactionLineCreate(TransactionLineBase):
    """Schema for creating a transaction line."""
    transaction_header_id: Optional[UUID] = None  # Set by service
    
    def calculate_totals(self) -> None:
        """Calculate line totals based on quantity and pricing."""
        if self.total_price is None:
            self.total_price = self.quantity * self.unit_price
        
        # Calculate discount amount if percentage given
        if self.discount_percent > 0 and self.discount_amount == 0:
            self.discount_amount = self.total_price * self.discount_percent / 100
        
        # Calculate tax amount if rate given
        if self.tax_rate > 0 and self.tax_amount == 0:
            taxable = self.total_price - self.discount_amount
            self.tax_amount = taxable * self.tax_rate / 100
        
        # Calculate line total
        if self.line_total is None:
            extended = self.total_price
            
            # For rentals, multiply by period
            if self.rental_period and self.rental_period > 0:
                extended = extended * self.rental_period
            elif self.rental_start_date and self.rental_end_date:
                days = (self.rental_end_date - self.rental_start_date).days
                if days > 0:
                    extended = extended * days
            
            self.line_total = extended - self.discount_amount + self.tax_amount


class TransactionLineUpdate(BaseModel):
    """Schema for updating a transaction line."""
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit_price: Optional[Decimal] = Field(None, ge=0)
    discount_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Optional[Decimal] = Field(None, ge=0)
    tax_amount: Optional[Decimal] = Field(None, ge=0)
    
    # Rental updates
    rental_end_date: Optional[date] = None
    current_rental_status: Optional[RentalStatus] = None
    
    # Fulfillment updates
    warehouse_location: Optional[str] = None
    status: Optional[str] = None
    fulfillment_status: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ReturnLineRequest(BaseModel):
    """Schema for processing a line return."""
    line_id: UUID
    return_quantity: Decimal = Field(..., gt=0)
    return_condition: str = Field(..., pattern="^[A-D]$")
    return_to_stock: bool = True
    notes: Optional[str] = None
    damage_fee: Optional[Decimal] = Field(None, ge=0)
    cleaning_fee: Optional[Decimal] = Field(None, ge=0)
    
    model_config = ConfigDict(from_attributes=True)


class TransactionLineResponse(TransactionLineBase):
    """Schema for transaction line response."""
    id: UUID
    transaction_header_id: UUID
    created_at: datetime
    updated_at: datetime
    
    # Calculated properties
    extended_price: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    remaining_quantity: Optional[Decimal] = None
    return_percentage: Optional[Decimal] = None
    is_fully_returned: Optional[bool] = None
    is_partially_returned: Optional[bool] = None
    
    # Rental calculated properties
    rental_duration_days: Optional[int] = None
    is_rental_overdue: Optional[bool] = None
    days_overdue: Optional[int] = None
    
    # Item details (if joined)
    item_name: Optional[str] = None
    item_sku: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_orm_with_calculations(cls, line):
        """Create response with calculated properties."""
        data = line.__dict__.copy()
        
        # Add calculated properties
        data['extended_price'] = line.extended_price
        data['net_amount'] = line.net_amount
        data['remaining_quantity'] = line.remaining_quantity
        data['return_percentage'] = line.return_percentage
        data['is_fully_returned'] = line.is_fully_returned
        data['is_partially_returned'] = line.is_partially_returned
        
        # Add rental calculations
        if line.rental_start_date and line.rental_end_date:
            data['rental_duration_days'] = line.rental_duration_days
            data['is_rental_overdue'] = line.is_rental_overdue
            data['days_overdue'] = line.days_overdue
        
        # Add item details if available
        if hasattr(line, 'item') and line.item:
            data['item_name'] = line.item.item_name
            data['item_sku'] = line.item.sku
        
        return cls(**data)