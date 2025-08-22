"""
Rental Return schemas for processing rental returns
"""

from typing import List, Optional, Dict, Any, Union
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum


class ReturnAction(str, Enum):
    """Return action types"""
    COMPLETE_RETURN = "COMPLETE_RETURN"
    PARTIAL_RETURN = "PARTIAL_RETURN"
    MARK_LATE = "MARK_LATE"
    MARK_DAMAGED = "MARK_DAMAGED"


class DamageDetail(BaseModel):
    """Details for damaged items"""
    quantity: Union[int, float, Decimal] = Field(gt=0, description="Quantity damaged")
    damage_type: str = Field(description="Type of damage (PHYSICAL, WATER, ELECTRICAL, etc.)")
    damage_severity: str = Field(description="Severity (MINOR, MODERATE, SEVERE, BEYOND_REPAIR)")
    estimated_repair_cost: Optional[Union[int, float, Decimal]] = Field(None, description="Estimated repair cost")
    description: str = Field(description="Damage description")
    serial_numbers: Optional[List[str]] = Field(None, description="Serial numbers for serialized items")
    
    @field_validator('quantity', mode='before')
    def convert_quantity(cls, v):
        return Decimal(str(v))
    
    @field_validator('estimated_repair_cost', mode='before')
    def convert_repair_cost(cls, v):
        if v is None:
            return None
        return Decimal(str(v))


class ItemReturnRequest(BaseModel):
    """Individual item return request with mixed condition support"""
    line_id: str = Field(description="Transaction line ID")
    item_id: str = Field(description="Item ID")
    
    # Total quantity being returned
    total_return_quantity: Union[int, float, Decimal] = Field(gt=0, description="Total quantity being returned")
    
    # Breakdown by condition
    quantity_good: Union[int, float, Decimal] = Field(default=0, ge=0, description="Quantity in good condition")
    quantity_damaged: Union[int, float, Decimal] = Field(default=0, ge=0, description="Quantity damaged but repairable")
    quantity_beyond_repair: Union[int, float, Decimal] = Field(default=0, ge=0, description="Quantity beyond repair")
    quantity_lost: Union[int, float, Decimal] = Field(default=0, ge=0, description="Quantity lost/missing")
    
    # Details for damaged items
    damage_details: Optional[List[DamageDetail]] = Field(None, description="Details for damaged items")
    
    return_date: Union[str, date] = Field(description="Actual return date")
    return_action: ReturnAction = Field(description="Return action type")
    condition_notes: Optional[str] = Field(None, description="General condition notes")
    damage_notes: Optional[str] = Field(None, description="Overall damage notes")
    damage_penalty: Optional[Union[int, float, Decimal]] = Field(0, description="Total damage penalty amount")
    
    @field_validator('total_return_quantity', 'quantity_good', 'quantity_damaged', 
                     'quantity_beyond_repair', 'quantity_lost', mode='before')
    def convert_quantities(cls, v):
        """Convert all quantities to Decimal"""
        return Decimal(str(v))
    
    @model_validator(mode='after')
    def ensure_quantity_breakdown(self):
        """Auto-populate quantity breakdown if not provided, then validate totals"""
        total_qty = self.total_return_quantity
        if not total_qty:
            return self
        
        # Get existing breakdown values
        breakdown_total = self.quantity_good + self.quantity_damaged + self.quantity_beyond_repair + self.quantity_lost
        
        # If no breakdown provided, auto-populate based on return action
        if breakdown_total == 0:
            if self.return_action == ReturnAction.MARK_DAMAGED:
                self.quantity_damaged = total_qty
            else:
                # Default to good condition for all other actions
                self.quantity_good = total_qty
                
        else:
            # Validate that breakdown matches total
            if abs(total_qty - breakdown_total) > Decimal('0.01'):
                raise ValueError(f"Total quantity {total_qty} doesn't match breakdown {breakdown_total}")
        
        return self
    
    @field_validator('damage_penalty', mode='before')
    def convert_damage_penalty(cls, v):
        """Convert damage penalty to Decimal"""
        if v is None:
            return Decimal('0')
        return Decimal(str(v))
    
    @field_validator('return_date', mode='before')
    def convert_return_date(cls, v):
        """Convert return date string to date object"""
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v
    
    @field_validator('damage_details')
    def validate_damage_details(cls, v, info):
        """Validate damage details match damaged quantities"""
        if v and len(v) > 0 and info.data:
            damaged_qty = info.data.get('quantity_damaged', Decimal('0'))
            beyond_repair_qty = info.data.get('quantity_beyond_repair', Decimal('0'))
            total_damaged = damaged_qty + beyond_repair_qty
            
            detail_qty = sum(d.quantity for d in v)
            if abs(detail_qty - total_damaged) > Decimal('0.01'):
                raise ValueError(f"Damage detail quantities {detail_qty} don't match damaged total {total_damaged}")
        return v


class RentalReturnRequest(BaseModel):
    """Complete rental return request"""
    rental_id: str = Field(description="Rental transaction ID")
    return_date: Union[str, date] = Field(description="Return processing date")
    items: List[ItemReturnRequest] = Field(description="Items being returned")
    notes: Optional[str] = Field(None, description="General return notes")
    processed_by: Optional[str] = Field(None, description="User processing the return")
    
    @field_validator('return_date', mode='before')
    def convert_return_date(cls, v):
        """Convert return date string to date object"""
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v


class ItemReturnResponse(BaseModel):
    """Individual item return response"""
    line_id: str
    item_name: str
    sku: str
    original_quantity: Decimal
    returned_quantity: Decimal
    remaining_quantity: Decimal
    return_date: date
    new_status: str
    condition_notes: Optional[str] = None


class RentalReturnResponse(BaseModel):
    """Complete rental return response"""
    success: bool = True
    message: str = "Return processed successfully" 
    rental_id: str
    transaction_number: str
    return_date: date
    items_returned: List[ItemReturnResponse]
    rental_status: str
    financial_impact: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)