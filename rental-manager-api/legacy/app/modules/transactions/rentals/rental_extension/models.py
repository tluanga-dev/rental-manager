"""
Rental Extension Models for managing rental extensions
"""

from enum import Enum as PyEnum
from typing import Optional
from decimal import Decimal
from datetime import datetime, date
from uuid import UUID
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, Date, ForeignKey, Index, Enum
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType


class ExtensionType(PyEnum):
    """Type of rental extension"""
    FULL = "FULL"  # All items extended
    PARTIAL = "PARTIAL"  # Some items extended, some returned


class ReturnCondition(PyEnum):
    """Condition of returned items"""
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"
    BEYOND_REPAIR = "BEYOND_REPAIR"


class PaymentStatus(PyEnum):
    """Payment status for extensions"""
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"


class RentalExtension(RentalManagerBaseModel):
    """
    Model for tracking rental extensions.
    Each rental can have multiple extensions.
    """
    
    __tablename__ = "rental_extensions"
    
    # Link to parent rental
    parent_rental_id = Column(UUIDType(), ForeignKey("transaction_headers.id", name="fk_extension_rental"), nullable=False, comment="Parent rental transaction")
    
    # Extension dates
    extension_date = Column(DateTime, nullable=False, default=datetime.utcnow, comment="When extension was processed")
    original_end_date = Column(Date, nullable=False, comment="Original rental end date before extension")
    new_end_date = Column(Date, nullable=False, comment="New rental end date after extension")
    
    # Extension type
    extension_type = Column(Enum(ExtensionType), nullable=False, comment="Type of extension (FULL or PARTIAL)")
    
    # Financial information
    extension_charges = Column(Numeric(15, 2), nullable=False, default=0, comment="Total charges for this extension")
    payment_received = Column(Numeric(15, 2), nullable=False, default=0, comment="Amount paid at extension time")
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING, comment="Payment status")
    
    # User tracking
    extended_by = Column(UUIDType(), ForeignKey("users.id", name="fk_extension_user"), nullable=False, comment="User who processed the extension")
    
    # Notes
    notes = Column(Text, nullable=True, comment="Extension notes")
    
    # Relationships
    parent_rental = relationship("TransactionHeader", back_populates="extensions", lazy="select")
    extension_lines = relationship("RentalExtensionLine", back_populates="extension", lazy="select", cascade="all, delete-orphan")
    extended_by_user = relationship("User", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index("idx_extension_rental", "parent_rental_id"),
        Index("idx_extension_date", "extension_date"),
        Index("idx_extension_payment_status", "payment_status"),
    )
    
    def __init__(
        self,
        parent_rental_id: str | UUID,
        original_end_date: date,
        new_end_date: date,
        extension_type: ExtensionType,
        extended_by: str | UUID,
        extension_charges: Decimal = Decimal("0.00"),
        payment_received: Decimal = Decimal("0.00"),
        payment_status: PaymentStatus = PaymentStatus.PENDING,
        notes: Optional[str] = None,
        **kwargs
    ):
        """Initialize a rental extension"""
        super().__init__(**kwargs)
        self.parent_rental_id = parent_rental_id
        self.original_end_date = original_end_date
        self.new_end_date = new_end_date
        self.extension_type = extension_type
        self.extended_by = extended_by
        self.extension_charges = extension_charges
        self.payment_received = payment_received
        self.payment_status = self._determine_payment_status(extension_charges, payment_received)
        self.notes = notes
        self._validate()
    
    def _validate(self):
        """Validate extension data"""
        if not self.parent_rental_id:
            raise ValueError("Parent rental ID is required")
        
        if not self.extended_by:
            raise ValueError("Extended by user is required")
        
        if self.new_end_date <= self.original_end_date:
            raise ValueError("New end date must be after original end date")
        
        if self.extension_charges < 0:
            raise ValueError("Extension charges cannot be negative")
        
        if self.payment_received < 0:
            raise ValueError("Payment received cannot be negative")
        
        if self.payment_received > self.extension_charges:
            raise ValueError("Payment received cannot exceed extension charges")
    
    def _determine_payment_status(self, charges: Decimal, paid: Decimal) -> PaymentStatus:
        """Determine payment status based on charges and payment"""
        if charges == 0 or paid >= charges:
            return PaymentStatus.PAID
        elif paid > 0:
            return PaymentStatus.PARTIAL
        else:
            return PaymentStatus.PENDING
    
    def add_payment(self, amount: Decimal):
        """Add a payment to this extension"""
        self.payment_received += amount
        self.payment_status = self._determine_payment_status(self.extension_charges, self.payment_received)
        self.updated_at = datetime.utcnow()
    
    def __repr__(self):
        return f"<RentalExtension {self.id}: {self.original_end_date} -> {self.new_end_date}>"


class RentalExtensionLine(RentalManagerBaseModel):
    """
    Model for tracking individual item extensions within a rental extension.
    Tracks which items were extended and which were returned.
    """
    
    __tablename__ = "rental_extension_lines"
    
    # Link to extension and transaction line
    extension_id = Column(UUIDType(), ForeignKey("rental_extensions.id", name="fk_extension_line_extension"), nullable=False, comment="Parent extension")
    transaction_line_id = Column(UUIDType(), ForeignKey("transaction_lines.id", name="fk_extension_line_transaction"), nullable=False, comment="Original transaction line")
    
    # Quantities
    original_quantity = Column(Numeric(10, 2), nullable=False, comment="Original rental quantity")
    extended_quantity = Column(Numeric(10, 2), nullable=False, default=0, comment="Quantity being extended")
    returned_quantity = Column(Numeric(10, 2), nullable=False, default=0, comment="Quantity being returned")
    
    # Return condition (if items are returned)
    return_condition = Column(Enum(ReturnCondition), nullable=True, comment="Condition of returned items")
    condition_notes = Column(Text, nullable=True, comment="Notes about item condition")
    
    # Damage assessment (if applicable)
    damage_assessment = Column(Numeric(15, 2), nullable=True, comment="Damage charges if applicable")
    
    # Item-specific end date (can differ from main extension)
    item_new_end_date = Column(Date, nullable=True, comment="Item-specific new end date")
    
    # Relationships
    extension = relationship("RentalExtension", back_populates="extension_lines", lazy="select")
    transaction_line = relationship("TransactionLine", lazy="select")
    
    # Indexes
    __table_args__ = (
        Index("idx_extension_line_extension", "extension_id"),
        Index("idx_extension_line_transaction", "transaction_line_id"),
    )
    
    def __init__(
        self,
        extension_id: str | UUID,
        transaction_line_id: str | UUID,
        original_quantity: Decimal,
        extended_quantity: Decimal = Decimal("0.00"),
        returned_quantity: Decimal = Decimal("0.00"),
        return_condition: Optional[ReturnCondition] = None,
        condition_notes: Optional[str] = None,
        damage_assessment: Optional[Decimal] = None,
        item_new_end_date: Optional[date] = None,
        **kwargs
    ):
        """Initialize a rental extension line"""
        super().__init__(**kwargs)
        self.extension_id = extension_id
        self.transaction_line_id = transaction_line_id
        self.original_quantity = original_quantity
        self.extended_quantity = extended_quantity
        self.returned_quantity = returned_quantity
        self.return_condition = return_condition
        self.condition_notes = condition_notes
        self.damage_assessment = damage_assessment
        self.item_new_end_date = item_new_end_date
        self._validate()
    
    def _validate(self):
        """Validate extension line data"""
        if not self.extension_id:
            raise ValueError("Extension ID is required")
        
        if not self.transaction_line_id:
            raise ValueError("Transaction line ID is required")
        
        if self.original_quantity <= 0:
            raise ValueError("Original quantity must be positive")
        
        if self.extended_quantity < 0:
            raise ValueError("Extended quantity cannot be negative")
        
        if self.returned_quantity < 0:
            raise ValueError("Returned quantity cannot be negative")
        
        if self.extended_quantity + self.returned_quantity > self.original_quantity:
            raise ValueError("Extended + returned quantity cannot exceed original quantity")
        
        if self.returned_quantity > 0 and not self.return_condition:
            raise ValueError("Return condition is required when returning items")
        
        if self.damage_assessment and self.damage_assessment < 0:
            raise ValueError("Damage assessment cannot be negative")
    
    def __repr__(self):
        return f"<RentalExtensionLine {self.id}: Extend {self.extended_quantity}, Return {self.returned_quantity}>"