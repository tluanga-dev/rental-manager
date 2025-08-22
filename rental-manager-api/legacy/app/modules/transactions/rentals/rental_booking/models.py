"""
Unified Booking Models

Defines database models for the booking system using header-detail pattern.
All bookings (single or multi-item) use these models.
"""

from typing import Optional, List, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, date
from uuid import UUID
from sqlalchemy import (
    Column, String, Numeric, Boolean, Text, DateTime, Date, 
    ForeignKey, Integer, Index, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType
from .enums import BookingStatus, BookingPriority, RentalPeriodUnit, PaymentStatus

if TYPE_CHECKING:
    from app.modules.customers.models import Customer
    from app.modules.master_data.locations.models import Location
    from app.modules.master_data.item_master.models import Item
    from app.modules.users.models import User
    from app.modules.transactions.base.models.transaction_headers import TransactionHeader


class BookingHeader(RentalManagerBaseModel):
    """
    Main booking record - represents a complete booking transaction.
    Can contain one or multiple items (lines).
    """
    
    __tablename__ = "booking_headers"
    __table_args__ = {'extend_existing': True}
    
    # Primary identification
    booking_reference = Column(
        String(50), 
        unique=True, 
        nullable=False, 
        comment="Unique booking reference number"
    )
    
    # Customer and location
    customer_id = Column(
        UUIDType(), 
        ForeignKey("customers.id", name="fk_booking_customer"), 
        nullable=False,
        comment="Customer making the booking"
    )
    location_id = Column(
        UUIDType(), 
        ForeignKey("locations.id", name="fk_booking_location"), 
        nullable=False,
        comment="Pickup/return location"
    )
    
    # Booking dates
    booking_date = Column(
        Date, 
        nullable=False,
        default=date.today,
        comment="Date booking was created"
    )
    start_date = Column(
        Date, 
        nullable=False,
        comment="Rental start date"
    )
    end_date = Column(
        Date, 
        nullable=False,
        comment="Rental end date"
    )
    
    # Status
    booking_status = Column(
        Enum(BookingStatus), 
        nullable=False, 
        default=BookingStatus.PENDING,
        comment="Current booking status"
    )
    
    # Item count
    total_items = Column(
        Integer, 
        nullable=False, 
        default=0,
        comment="Total number of line items"
    )
    
    # Financial summary
    estimated_subtotal = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Subtotal before tax"
    )
    estimated_tax = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Tax amount"
    )
    estimated_total = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Total amount including tax"
    )
    
    # Deposit information
    deposit_required = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Required deposit amount"
    )
    deposit_paid = Column(
        Boolean, 
        nullable=False, 
        default=False,
        comment="Whether deposit has been paid"
    )
    
    # Notes
    notes = Column(
        Text, 
        nullable=True,
        comment="Booking notes"
    )
    
    # Conversion tracking (when converted to rental)
    converted_rental_id = Column(
        UUIDType(), 
        ForeignKey("transaction_headers.id", name="fk_booking_rental"), 
        nullable=True,
        comment="Rental transaction ID if converted"
    )
    
    # Cancellation tracking
    cancelled_reason = Column(
        Text, 
        nullable=True,
        comment="Reason for cancellation"
    )
    cancelled_at = Column(
        DateTime, 
        nullable=True,
        comment="Cancellation timestamp"
    )
    cancelled_by = Column(
        UUIDType(), 
        ForeignKey("users.id", name="fk_booking_cancelled_by"),
        nullable=True,
        comment="User who cancelled"
    )
    
    # Relationships
    lines = relationship(
        "BookingLine", 
        back_populates="header", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    customer = relationship("Customer", lazy="select")
    location = relationship("Location", lazy="select")
    converted_rental = relationship("TransactionHeader", lazy="select", foreign_keys=[converted_rental_id])
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_booking_header_customer", "customer_id"),
        Index("idx_booking_header_location", "location_id"),
        Index("idx_booking_header_status", "booking_status"),
        Index("idx_booking_header_dates", "start_date", "end_date"),
        Index("idx_booking_header_reference", "booking_reference"),
        {'extend_existing': True}
    )
    
    def __repr__(self):
        return f"<BookingHeader {self.booking_reference} - {self.booking_status.value}>"


class BookingLine(RentalManagerBaseModel):
    """
    Booking line items - represents individual items within a booking.
    Each booking can have one or more lines.
    """
    
    __tablename__ = "booking_lines"
    __table_args__ = {'extend_existing': True}
    
    # Foreign key to header
    booking_header_id = Column(
        UUIDType(), 
        ForeignKey("booking_headers.id", name="fk_booking_line_header", ondelete="CASCADE"), 
        nullable=False,
        comment="Parent booking header ID"
    )
    
    # Line identification
    line_number = Column(
        Integer, 
        nullable=False,
        comment="Line sequence number"
    )
    
    # Item information
    item_id = Column(
        UUIDType(), 
        ForeignKey("items.id", name="fk_booking_line_item"), 
        nullable=False,
        comment="Item being booked"
    )
    
    # Quantity
    quantity_reserved = Column(
        Numeric(10, 2), 
        nullable=False,
        comment="Quantity reserved"
    )
    
    # Rental period
    rental_period = Column(
        Integer, 
        nullable=False,
        default=1,
        comment="Number of rental periods"
    )
    rental_period_unit = Column(
        String(20), 
        nullable=False,
        default="DAILY",
        comment="Unit of rental period"
    )
    
    # Pricing
    unit_rate = Column(
        Numeric(15, 2), 
        nullable=False,
        comment="Rate per unit per period"
    )
    discount_amount = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Discount amount for this line"
    )
    line_total = Column(
        Numeric(15, 2), 
        nullable=True,
        comment="Total for this line"
    )
    
    # Notes
    notes = Column(
        Text, 
        nullable=True,
        comment="Line-specific notes"
    )
    
    # Relationships
    header = relationship("BookingHeader", back_populates="lines")
    item = relationship("Item", lazy="select")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("booking_header_id", "line_number", name="uq_booking_line_number"),
        Index("idx_booking_line_header", "booking_header_id"),
        Index("idx_booking_line_item", "item_id"),
        {'extend_existing': True}
    )
    
    def __repr__(self):
        return f"<BookingLine {self.line_number}: Item {self.item_id} x{self.quantity_reserved}>"