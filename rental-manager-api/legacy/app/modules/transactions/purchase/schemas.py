"""
Purchase Schemas

Pydantic schemas for purchase-related operations.
"""

from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID

from app.modules.transactions.base.models import TransactionType, TransactionStatus, PaymentStatus


# Nested response schemas for purchase details
class SupplierNestedResponse(BaseModel):
    """Schema for nested supplier response in purchase transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Supplier name")


class LocationNestedResponse(BaseModel):
    """Schema for nested location response in purchase transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Location name")


class ItemNestedResponse(BaseModel):
    """Schema for nested item response in purchase transactions."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str = Field(..., description="Item name")


class PurchaseItemCreate(BaseModel):
    """Schema for creating a purchase item."""

    item_id: UUID = Field(..., description="Item ID")
    quantity: int = Field(..., ge=1, description="Quantity")
    unit_cost: Decimal = Field(..., ge=0, description="Unit cost")
    tax_rate: Optional[Decimal] = Field(0, ge=0, le=100, description="Tax rate percentage")
    discount_amount: Optional[Decimal] = Field(0, ge=0, description="Discount amount")
    condition: str = Field(..., pattern="^[A-D]$", description="Item condition (A, B, C, or D)")
    notes: Optional[str] = Field("", description="Additional notes")
    serial_numbers: Optional[List[str]] = Field(None, description="Serial numbers for serialized items")
    
    # New batch-specific fields
    batch_code: Optional[str] = Field(None, max_length=50, description="Batch code for tracking")
    sale_price: Optional[Decimal] = Field(None, ge=0, description="Sale price per unit")
    rental_rate_per_period: Optional[Decimal] = Field(None, ge=0, description="Rental rate per period")
    rental_period: Optional[int] = Field(None, ge=1, description="Rental period (number of periods)")
    security_deposit: Optional[Decimal] = Field(None, ge=0, description="Security deposit per unit")
    model_number: Optional[str] = Field(None, max_length=100, description="Model number")
    warranty_period_days: Optional[int] = Field(None, ge=0, description="Warranty period in days")
    remarks: Optional[str] = Field(None, description="Additional remarks for this batch")

    @field_validator('serial_numbers')
    @classmethod
    def validate_serial_numbers(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        """Validate serial numbers list."""
        if v is None:
            return v
        
        # Remove empty/whitespace entries
        cleaned = [sn.strip() for sn in v if sn and sn.strip()]
        
        if not cleaned:
            return None
        
        # Check for duplicates within the list
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Duplicate serial numbers are not allowed")
        
        # Validate serial number format (basic validation)
        for sn in cleaned:
            if len(sn) < 1 or len(sn) > 100:
                raise ValueError(f"Serial number '{sn}' must be between 1 and 100 characters")
        
        return cleaned

    @field_validator('quantity')
    @classmethod
    def validate_quantity_with_serials(cls, v: int, info) -> int:
        """Validate quantity matches serial numbers count for serialized items."""
        values = info.data
        serial_numbers = values.get('serial_numbers')
        
        if serial_numbers:
            # If serial numbers are provided, quantity must match count
            serial_count = len([sn for sn in serial_numbers if sn and sn.strip()])
            if v != serial_count:
                raise ValueError(
                    f"Quantity ({v}) must match number of serial numbers ({serial_count})"
                )
        
        return v

    @field_validator('batch_code')
    @classmethod
    def validate_batch_code(cls, v: Optional[str], info) -> Optional[str]:
        """Validate batch code format and mutual exclusivity with serial numbers."""
        if v is None:
            return v
        
        values = info.data
        serial_numbers = values.get('serial_numbers')
        
        # Batch code and serial numbers are mutually exclusive
        if serial_numbers and any(sn.strip() for sn in serial_numbers if sn):
            raise ValueError("Cannot specify both batch_code and serial_numbers")
        
        # Clean and validate batch code
        cleaned = v.strip()
        if not cleaned:
            return None
            
        if len(cleaned) > 50:
            raise ValueError("Batch code cannot exceed 50 characters")
        
        return cleaned


class PurchaseLineItemResponse(BaseModel):
    """Schema for purchase line item response with purchase-specific fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item: ItemNestedResponse = Field(..., description="Item details")
    quantity: Decimal
    unit_cost: Decimal = Field(..., description="Unit cost per item")
    tax_rate: Decimal = Field(..., description="Tax rate percentage")
    discount_amount: Decimal = Field(..., description="Discount amount")
    condition: str = Field(..., description="Item condition (A, B, C, or D)")
    notes: str = Field(default="", description="Additional notes")
    tax_amount: Decimal = Field(..., description="Calculated tax amount")
    line_total: Decimal = Field(..., description="Total line amount")
    serial_numbers: Optional[List[str]] = Field(None, description="Serial numbers for serialized items")
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_transaction_line(cls, line: dict, item_details: dict = None, inventory_units: List = None) -> "PurchaseLineItemResponse":
        """Create PurchaseLineItemResponse from TransactionLine data."""
        # Extract condition from description if available
        condition = "A"  # Default condition
        description = line.get("description", "")
        if "(Condition: " in description and ")" in description:
            condition_start = description.find("(Condition: ") + len("(Condition: ")
            condition_end = description.find(")", condition_start)
            condition = description[condition_start:condition_end].strip()
        
        # Create item nested response
        item_nested = ItemNestedResponse(
            id=item_details["id"] if item_details else line["item_id"],
            name=item_details["name"] if item_details else "Unknown Item"
        )
        
        # Extract serial numbers from inventory units
        serial_numbers = None
        if inventory_units:
            serial_numbers = [unit.serial_number for unit in inventory_units if unit.serial_number]
            if not serial_numbers:  # Empty list means no serial numbers
                serial_numbers = None
        
        return cls(
            id=line["id"],
            item=item_nested,
            quantity=line["quantity"],
            unit_cost=line["unit_price"],  # Map unit_price to unit_cost
            tax_rate=line["tax_rate"],
            discount_amount=line["discount_amount"],
            condition=condition,
            notes=line.get("notes", ""),
            tax_amount=line["tax_amount"],
            line_total=line["line_total"],
            serial_numbers=serial_numbers,
            created_at=line["created_at"],
            updated_at=line["updated_at"],
        )


class PurchaseCreate(BaseModel):
    """Schema for creating a purchase transaction."""

    supplier_id: UUID = Field(..., description="Supplier ID")
    location_id: UUID = Field(..., description="Location ID")
    purchase_date: date = Field(..., description="Purchase date")
    notes: Optional[str] = Field("", description="Additional notes")
    reference_number: Optional[str] = Field("", max_length=50, description="Reference number")
    payment_status: Optional[PaymentStatus] = Field(PaymentStatus.PAID, description="Payment status")
    items: List[PurchaseItemCreate] = Field(..., min_length=1, description="Purchase items")


class PurchaseLineRequest(BaseModel):
    """Schema for purchase line item request."""
    
    item_id: UUID = Field(..., description="Item ID")
    quantity: Decimal = Field(..., gt=0, description="Quantity")
    unit_cost: Decimal = Field(..., ge=0, description="Unit cost")
    tax_rate: Optional[Decimal] = Field(0, ge=0, le=100, description="Tax rate percentage")
    discount_amount: Optional[Decimal] = Field(0, ge=0, description="Discount amount")
    condition: str = Field("A", pattern="^[A-D]$", description="Item condition (A, B, C, or D)")
    notes: Optional[str] = Field("", description="Additional notes")
    serial_numbers: Optional[List[str]] = Field(None, description="Serial numbers for serialized items")


class NewPurchaseRequest(BaseModel):
    """Schema for the new-purchase endpoint - matches frontend JSON structure exactly."""

    supplier_id: str = Field(..., description="Supplier ID")
    location_id: str = Field(..., description="Location ID")
    purchase_date: str = Field(..., description="Purchase date in YYYY-MM-DD format")
    notes: str = Field("", description="Additional notes")
    reference_number: str = Field("", description="Reference number")
    payment_status: Optional[PaymentStatus] = Field(PaymentStatus.PAID, description="Payment status")
    items: List[PurchaseItemCreate] = Field(..., min_length=1, description="Purchase items")

    @field_validator("purchase_date")
    @classmethod
    def validate_purchase_date(cls, v):
        """Validate and parse the purchase date."""
        try:
            from datetime import datetime

            return datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD format.")

    @field_validator("supplier_id", "location_id")
    @classmethod
    def validate_uuids(cls, v):
        """Validate UUID strings."""
        try:
            from uuid import UUID

            return UUID(v)
        except ValueError:
            raise ValueError(f"Invalid UUID format: {v}")


class NewPurchaseResponse(BaseModel):
    """Schema for new-purchase response."""

    model_config = ConfigDict(from_attributes=True)

    success: bool = Field(True, description="Operation success status")
    message: str = Field("Purchase created successfully", description="Response message")
    data: dict = Field(..., description="Purchase transaction data")
    transaction_id: UUID = Field(..., description="Created transaction ID")
    transaction_number: str = Field(..., description="Generated transaction number")


class PurchaseResponse(BaseModel):
    """Schema for purchase response - maps transaction data to purchase format."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    supplier: SupplierNestedResponse = Field(..., description="Supplier details")
    location: LocationNestedResponse = Field(..., description="Location details")
    purchase_date: date = Field(..., description="Purchase date (mapped from transaction_date)")
    reference_number: Optional[str] = Field(
        None, description="Reference number (mapped from transaction_number)"
    )
    notes: Optional[str] = Field(None, description="Additional notes")
    subtotal: Decimal = Field(..., description="Subtotal amount")
    tax_amount: Decimal = Field(..., description="Tax amount")
    discount_amount: Decimal = Field(..., description="Discount amount")
    total_amount: Decimal = Field(..., description="Total amount")
    status: str = Field(..., description="Purchase status")
    payment_status: str = Field(..., description="Payment status")
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseLineItemResponse] = Field(default_factory=list, description="Purchase items")

    @classmethod
    def from_transaction(cls, transaction: dict, supplier_details: dict = None, location_details: dict = None, items_details: dict = None) -> "PurchaseResponse":
        """Create PurchaseResponse from TransactionHeaderResponse data."""
        # Create nested supplier response
        supplier_nested = SupplierNestedResponse(
            id=supplier_details["id"] if supplier_details else transaction["supplier_id"],
            name=supplier_details["name"] if supplier_details else "Unknown Supplier"
        )
        
        # Create nested location response
        location_nested = LocationNestedResponse(
            id=location_details["id"] if location_details else transaction["location_id"],
            name=location_details["name"] if location_details else "Unknown Location"
        )
        
        # Transform transaction lines to purchase line items
        purchase_items = []
        items_details = items_details or {}
        for line in transaction.get("transaction_lines", []):
            item_detail = items_details.get(str(line["item_id"]), None)
            purchase_items.append(PurchaseLineItemResponse.from_transaction_line(line, item_detail))
        
        return cls(
            id=transaction["id"],
            supplier=supplier_nested,
            location=location_nested,
            purchase_date=transaction["transaction_date"].date()
            if isinstance(transaction["transaction_date"], datetime)
            else transaction["transaction_date"],
            reference_number=transaction.get("transaction_number"),
            notes=transaction.get("notes"),
            subtotal=transaction["subtotal"],
            tax_amount=transaction["tax_amount"],
            discount_amount=transaction["discount_amount"],
            total_amount=transaction["total_amount"],
            status=transaction["status"],
            payment_status=transaction["payment_status"] or "PENDING",
            created_at=transaction["created_at"],
            updated_at=transaction["updated_at"],
            items=purchase_items,
        )


class PurchaseDetail(BaseModel):
    """Schema for detailed purchase information."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    transaction_number: str
    supplier_id: UUID
    supplier_name: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    purchase_date: date
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    status: TransactionStatus
    payment_status: PaymentStatus
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseLineItemResponse] = Field(default_factory=list)


class PurchaseListResponse(BaseModel):
    """Response schema for purchase list."""
    
    purchases: List[PurchaseResponse] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    total_pages: int