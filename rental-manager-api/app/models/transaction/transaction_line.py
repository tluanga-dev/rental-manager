"""
Transaction Line model - individual line items within transactions.
Migrated from legacy system with modern FastAPI patterns.
"""

from enum import Enum as PyEnum
from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, date, timezone
from uuid import UUID

from sqlalchemy import (
    Column, String, Text, Numeric, DateTime, Date, Boolean, Integer, 
    ForeignKey, Enum, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.ext.hybrid import hybrid_property

from app.db.base import RentalManagerBaseModel, UUIDType
from .transaction_header import RentalPeriodUnit, RentalStatus

if TYPE_CHECKING:
    from .transaction_header import TransactionHeader
    from .transaction_inspection import TransactionInspection
    from app.models.item import Item
    from app.models.location import Location


# Line Item Type Enum
class LineItemType(str, PyEnum):
    """Types of line items supported."""
    PRODUCT = "PRODUCT"
    SERVICE = "SERVICE"
    DISCOUNT = "DISCOUNT"
    TAX = "TAX"
    SHIPPING = "SHIPPING"
    FEE = "FEE"


class TransactionLine(RentalManagerBaseModel):
    """
    Transaction Line Item model for detailed transaction components.
    
    Each line represents a specific item, service, or fee within a transaction.
    For rentals, tracks item-specific rental periods and return status.
    """
    
    __tablename__ = "transaction_lines"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    transaction_header_id: Mapped[UUID] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_headers.id", name="fk_transaction_line_header"),
        nullable=False,
        comment="Parent transaction ID"
    )
    line_number: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Line sequence number within transaction"
    )
    
    # Item identification
    line_type: Mapped[LineItemType] = mapped_column(
        Enum(LineItemType), nullable=False, default=LineItemType.PRODUCT,
        comment="Type of line item"
    )
    item_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("items.id", name="fk_transaction_line_item"),
        nullable=True,
        comment="Item/Product UUID"
    )
    inventory_unit_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="Specific inventory unit for serialized items"
    )
    sku: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Stock Keeping Unit"
    )
    
    # Description and categorization
    description: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Line item description"
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Item category"
    )
    
    # Quantity and measurements
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=1,
        comment="Quantity ordered/sold"
    )
    unit_of_measure: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Unit of measurement"
    )
    
    # Pricing information
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Price per unit"
    )
    total_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Total price before tax/discount"
    )
    discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0,
        comment="Discount percentage"
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Discount amount"
    )
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0,
        comment="Tax rate percentage"
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Tax amount"
    )
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Total for this line item"
    )
    
    # Rental-specific fields
    rental_start_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Item rental start date"
    )
    rental_end_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Item rental end date"
    )
    rental_period: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True,
        comment="Rental period for this item"
    )
    rental_period_unit: Mapped[Optional[RentalPeriodUnit]] = mapped_column(
        Enum(RentalPeriodUnit), nullable=True,
        comment="Rental period unit"
    )
    current_rental_status: Mapped[Optional[RentalStatus]] = mapped_column(
        Enum(RentalStatus), nullable=True,
        comment="Current rental status for this item"
    )
    daily_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True,
        comment="Daily rental rate"
    )
    
    # Inventory and fulfillment
    location_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("locations.id", name="fk_transaction_line_location"),
        nullable=True,
        comment="Fulfillment location UUID"
    )
    warehouse_location: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Specific warehouse location"
    )
    
    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING",
        comment="Line item status"
    )
    fulfillment_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PENDING",
        comment="Fulfillment status"
    )
    
    # Return handling
    returned_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0,
        comment="Returned quantity"
    )
    return_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Return date"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Additional notes"
    )
    return_condition: Mapped[Optional[str]] = mapped_column(
        String(1), nullable=True, default="A",
        comment="Return condition (A-D)"
    )
    return_to_stock: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=True,
        comment="Whether to return to stock"
    )
    inspection_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="Inspection status for returns"
    )
    
    # Relationships
    transaction: Mapped["TransactionHeader"] = relationship(
        "TransactionHeader", back_populates="transaction_lines", lazy="select"
    )
    item: Mapped[Optional["Item"]] = relationship(
        "Item", lazy="select", back_populates="transaction_lines"
    )
    location: Mapped[Optional["Location"]] = relationship(
        "Location", lazy="select", back_populates="transaction_lines"
    )
    inspection: Mapped[Optional["TransactionInspection"]] = relationship(
        "TransactionInspection", back_populates="transaction_line", lazy="select", uselist=False
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_transaction_header_id", "transaction_header_id"),
        Index("idx_line_number", "transaction_header_id", "line_number"),
        Index("idx_item_id", "item_id"),
        Index("idx_inventory_unit_id", "inventory_unit_id"),
        Index("idx_sku", "sku"),
        Index("idx_status", "status"),
        Index("idx_fulfillment_status", "fulfillment_status"),
        Index("idx_rental_dates", "rental_start_date", "rental_end_date"),
        Index("idx_rental_status", "current_rental_status"),
        UniqueConstraint(
            "transaction_header_id", "line_number",
            name="uq_transaction_line_number"
        ),
        CheckConstraint("quantity > 0", name="check_positive_quantity"),
        CheckConstraint("unit_price >= 0", name="check_non_negative_price"),
        CheckConstraint(
            "discount_percent >= 0 AND discount_percent <= 100",
            name="check_valid_discount_percent"
        ),
        CheckConstraint("tax_rate >= 0", name="check_non_negative_tax_rate"),
        CheckConstraint("returned_quantity >= 0", name="check_non_negative_returned"),
        CheckConstraint(
            "returned_quantity <= quantity",
            name="check_returned_not_exceed_quantity"
        ),
    )
    
    def __init__(
        self,
        transaction_header_id: UUID,
        line_number: int,
        description: str,
        line_type: LineItemType = LineItemType.PRODUCT,
        quantity: Decimal = Decimal("1.00"),
        unit_price: Decimal = Decimal("0.00"),
        **kwargs
    ):
        """
        Initialize a Transaction Line.
        
        Args:
            transaction_header_id: Parent transaction ID
            line_number: Line sequence number within transaction
            description: Line item description
            line_type: Type of line item
            quantity: Quantity ordered/sold
            unit_price: Price per unit
            **kwargs: Additional fields
        """
        super().__init__(**kwargs)
        self.transaction_header_id = transaction_header_id
        self.line_number = line_number
        self.line_type = line_type
        self.description = description
        self.quantity = quantity
        self.unit_price = unit_price
        self.total_price = self.total_price or (quantity * unit_price)
        self.line_total = self.line_total or self._calculate_line_total()
        self._validate_business_rules()
    
    def _calculate_line_total(self) -> Decimal:
        """Calculate line total based on quantity, price, discount, tax, and rental period."""
        # Base calculation: quantity * unit_price
        extended = self.quantity * self.unit_price
        
        # For rentals, multiply by rental period (days)
        if self.rental_period and self.rental_period > 0:
            extended = extended * self.rental_period
        elif self.rental_start_date and self.rental_end_date:
            # Calculate days if rental_period not set but dates are available
            rental_days = (self.rental_end_date - self.rental_start_date).days
            if rental_days > 0:
                extended = extended * rental_days
        
        # Apply discount and tax
        after_discount = extended - self.discount_amount
        return after_discount + self.tax_amount
    
    def _validate_business_rules(self):
        """Validate transaction line business rules."""
        # Quantity validations
        if self.quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if self.returned_quantity < 0:
            raise ValueError("Returned quantity cannot be negative")
        
        if self.returned_quantity > self.quantity:
            raise ValueError("Returned quantity cannot exceed ordered quantity")
        
        # Price validations
        if self.unit_price < 0:
            raise ValueError("Unit price cannot be negative")
        
        if self.discount_amount < 0:
            raise ValueError("Discount amount cannot be negative")
        
        if self.tax_amount < 0:
            raise ValueError("Tax amount cannot be negative")
        
        # Percentage validations
        if self.discount_percent < 0 or self.discount_percent > 100:
            raise ValueError("Discount percent must be between 0 and 100")
        
        if self.tax_rate < 0:
            raise ValueError("Tax rate cannot be negative")
        
        # Description validation
        if not self.description or not self.description.strip():
            raise ValueError("Description cannot be empty")
        
        # Line number validation
        if self.line_number <= 0:
            raise ValueError("Line number must be positive")
        
        # Rental validations
        if self.rental_start_date and self.rental_end_date:
            if self.rental_start_date > self.rental_end_date:
                raise ValueError("Rental start date cannot be after end date")
        
        if self.rental_period and self.rental_period <= 0:
            raise ValueError("Rental period must be positive")
        
        # Return condition validation
        if self.return_condition and self.return_condition not in ['A', 'B', 'C', 'D']:
            raise ValueError("Return condition must be A, B, C, or D")
    
    def update_pricing(
        self,
        unit_price: Optional[Decimal] = None,
        discount_percent: Optional[Decimal] = None,
        discount_amount: Optional[Decimal] = None,
        tax_rate: Optional[Decimal] = None,
        updated_by: Optional[str] = None
    ):
        """Update line pricing and recalculate totals."""
        if unit_price is not None:
            if unit_price < 0:
                raise ValueError("Unit price cannot be negative")
            self.unit_price = unit_price
        
        if discount_percent is not None:
            if discount_percent < 0 or discount_percent > 100:
                raise ValueError("Discount percent must be between 0 and 100")
            self.discount_percent = discount_percent
            # Recalculate discount amount
            self.discount_amount = (self.quantity * self.unit_price * discount_percent / 100)
        
        if discount_amount is not None:
            if discount_amount < 0:
                raise ValueError("Discount amount cannot be negative")
            self.discount_amount = discount_amount
        
        if tax_rate is not None:
            if tax_rate < 0:
                raise ValueError("Tax rate cannot be negative")
            self.tax_rate = tax_rate
            # Recalculate tax amount
            taxable_amount = (self.quantity * self.unit_price) - self.discount_amount
            self.tax_amount = taxable_amount * tax_rate / 100
        
        # Recalculate totals
        self.total_price = self.quantity * self.unit_price
        self.line_total = self._calculate_line_total()
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def process_return(
        self,
        return_quantity: Decimal,
        return_condition: str = "A",
        return_to_stock: bool = True,
        notes: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """Process a return for this line item."""
        if return_quantity <= 0:
            raise ValueError("Return quantity must be positive")
        
        if return_quantity > self.remaining_quantity:
            raise ValueError("Return quantity exceeds remaining quantity")
        
        if return_condition not in ['A', 'B', 'C', 'D']:
            raise ValueError("Return condition must be A, B, C, or D")
        
        self.returned_quantity += return_quantity
        self.return_date = date.today()
        self.return_condition = return_condition
        self.return_to_stock = return_to_stock
        
        if notes:
            self.notes = f"{self.notes or ''}\nReturn: {notes}".strip()
        
        # Update rental status if applicable
        if self.current_rental_status:
            if self.is_fully_returned:
                self.current_rental_status = RentalStatus.RENTAL_COMPLETED
            else:
                self.current_rental_status = RentalStatus.RENTAL_PARTIAL_RETURN
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def extend_rental(
        self,
        new_end_date: date,
        updated_by: Optional[str] = None
    ):
        """Extend the rental period for this line."""
        if not self.rental_end_date:
            raise ValueError("Cannot extend rental without existing end date")
        
        if new_end_date <= self.rental_end_date:
            raise ValueError("New end date must be after current end date")
        
        self.rental_end_date = new_end_date
        
        # Recalculate rental period
        if self.rental_start_date:
            self.rental_period = (new_end_date - self.rental_start_date).days
        
        # Update status
        if self.current_rental_status == RentalStatus.RENTAL_LATE:
            self.current_rental_status = RentalStatus.RENTAL_EXTENDED
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    @hybrid_property
    def extended_price(self) -> Decimal:
        """Calculate extended price before discount."""
        return self.quantity * self.unit_price
    
    @hybrid_property
    def net_amount(self) -> Decimal:
        """Calculate net amount after discount but before tax."""
        return self.extended_price - self.discount_amount
    
    @hybrid_property
    def remaining_quantity(self) -> Decimal:
        """Calculate quantity not yet returned."""
        return self.quantity - self.returned_quantity
    
    @property
    def return_percentage(self) -> Decimal:
        """Calculate percentage of quantity returned."""
        if self.quantity == 0:
            return Decimal('0')
        return (self.returned_quantity / self.quantity) * 100
    
    @property
    def is_fully_returned(self) -> bool:
        """Check if all quantity has been returned."""
        return self.returned_quantity >= self.quantity
    
    @property
    def is_partially_returned(self) -> bool:
        """Check if some but not all quantity has been returned."""
        return 0 < self.returned_quantity < self.quantity
    
    @property
    def rental_duration_days(self) -> int:
        """Calculate rental duration in days for this line."""
        if self.rental_start_date and self.rental_end_date:
            return (self.rental_end_date - self.rental_start_date).days
        return 0
    
    @property
    def is_rental_overdue(self) -> bool:
        """Check if this rental line is overdue."""
        if not self.rental_end_date:
            return False
        return self.rental_end_date < date.today() and not self.is_fully_returned
    
    @property
    def days_overdue(self) -> int:
        """Calculate days overdue for this rental line."""
        if not self.is_rental_overdue:
            return 0
        return (date.today() - self.rental_end_date).days
    
    @property
    def is_active_rental(self) -> bool:
        """Check if this line represents an active rental."""
        return (self.current_rental_status == RentalStatus.RENTAL_INPROGRESS and 
                self.rental_start_date and self.rental_end_date)
    
    @property
    def is_completed_rental(self) -> bool:
        """Check if this rental line is completed."""
        return self.current_rental_status == RentalStatus.RENTAL_COMPLETED
    
    @property
    def is_late_rental(self) -> bool:
        """Check if this rental line is late."""
        return (self.current_rental_status == RentalStatus.RENTAL_LATE or 
                self.current_rental_status == RentalStatus.RENTAL_LATE_PARTIAL_RETURN)
    
    @property
    def has_partial_return(self) -> bool:
        """Check if this rental line has partial returns."""
        return (self.current_rental_status == RentalStatus.RENTAL_PARTIAL_RETURN or 
                self.current_rental_status == RentalStatus.RENTAL_LATE_PARTIAL_RETURN)
    
    def calculate_line_total(self) -> Decimal:
        """Calculate and update line total."""
        self.line_total = self._calculate_line_total()
        return self.line_total
    
    def can_return_quantity(self, quantity: Decimal) -> bool:
        """Check if specified quantity can be returned."""
        return quantity <= self.remaining_quantity
    
    def calculate_daily_rate(self) -> Decimal:
        """Calculate daily rental rate for this line."""
        if self.daily_rate:
            return self.daily_rate
        
        if self.rental_duration_days > 0:
            return self.line_total / self.rental_duration_days
        
        return Decimal('0')
    
    def __repr__(self) -> str:
        return (f"<TransactionLine(id={self.id}, transaction_id={self.transaction_header_id}, "
                f"line={self.line_number}, item={self.description})>")