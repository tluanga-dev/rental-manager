"""
Transaction Header model - main transaction records.
Migrated from legacy system with modern FastAPI patterns.
"""

from enum import Enum as PyEnum
from typing import Optional, List, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, date, time, timezone
from uuid import UUID

from sqlalchemy import (
    Column, String, Numeric, Boolean, Text, DateTime, Date, Time, 
    ForeignKey, Integer, Index, Enum, CheckConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.ext.hybrid import hybrid_property

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from .transaction_line import TransactionLine
    from .transaction_event import TransactionEvent
    from .transaction_metadata import TransactionMetadata
    from .rental_lifecycle import RentalLifecycle
    from app.models.customer import Customer
    from app.models.supplier import Supplier
    from app.models.location import Location


# Transaction Type Enum
class TransactionType(str, PyEnum):
    """Types of transactions supported by the system."""
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    RENTAL = "RENTAL"
    RETURN = "RETURN"
    ADJUSTMENT = "ADJUSTMENT"


# Transaction Status Enum
class TransactionStatus(str, PyEnum):
    """Current processing status of a transaction."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"
    IN_PROGRESS = "IN_PROGRESS"  # For rentals


# Payment Method Enum
class PaymentMethod(str, PyEnum):
    """Payment methods supported by the system."""
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    ONLINE = "ONLINE"
    CREDIT_ACCOUNT = "CREDIT_ACCOUNT"


# Payment Status Enum
class PaymentStatus(str, PyEnum):
    """Payment status tracking."""
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


# Rental Period Unit Enum
class RentalPeriodUnit(str, PyEnum):
    """Units for rental periods."""
    HOUR = "HOUR"
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"


# Rental Status Enum
class RentalStatus(str, PyEnum):
    """Rental status tracking."""
    RENTAL_INPROGRESS = "RENTAL_INPROGRESS"  # The rental is in progress
    RENTAL_COMPLETED = "RENTAL_COMPLETED"    # Rental is completed and returned without late fee
    RENTAL_LATE = "RENTAL_LATE"             # Rental is late, passed beyond the last date
    RENTAL_EXTENDED = "RENTAL_EXTENDED"     # Extended the rental period
    RENTAL_PARTIAL_RETURN = "RENTAL_PARTIAL_RETURN"
    RENTAL_LATE_PARTIAL_RETURN = "RENTAL_LATE_PARTIAL_RETURN"


class TransactionHeader(RentalManagerBaseModel):
    """
    Transaction Header model for managing sales, purchases, and rentals.
    
    This is the main financial record that tracks all monetary aspects of transactions.
    For rentals, it works with RentalLifecycle for operational tracking.
    """
    
    __tablename__ = "transaction_headers"
    
    # Primary identification - id inherited from RentalManagerBaseModel
    transaction_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="Human-readable transaction number"
    )
    
    # Transaction categorization
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False,
        comment="Type of transaction"
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus), nullable=False, default=TransactionStatus.PENDING,
        comment="Current status"
    )
    
    # Temporal information
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Transaction date and time"
    )
    due_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Payment due date"
    )
    
    # Parties involved
    customer_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("customers.id", name="fk_transaction_header_customer"),
        nullable=True,
        comment="Customer UUID"
    )
    supplier_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("suppliers.id", name="fk_transaction_header_supplier"),
        nullable=True,
        comment="Supplier UUID"
    )
    location_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("locations.id", name="fk_transaction_header_location"),
        nullable=True,
        comment="Location UUID"
    )
    sales_person_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(), nullable=True,
        comment="Sales person handling transaction"
    )
    
    # Financial information
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR",
        comment="Currency code"
    )
    
    # Amount calculations
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Subtotal before discounts and taxes"
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Total discount amount"
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Total tax amount"
    )
    shipping_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Shipping charges"
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Final total amount"
    )
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Amount already paid"
    )
    payment_status: Mapped[Optional[PaymentStatus]] = mapped_column(
        Enum(PaymentStatus), nullable=True, default=PaymentStatus.PENDING,
        comment="Payment status"
    )

    # Rental-specific fields
    deposit_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True,
        comment="Security deposit for rentals"
    )
    deposit_paid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether deposit has been paid"
    )
    customer_advance_balance: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Customer advance payment balance"
    )
    
    # Return handling
    reference_transaction_id: Mapped[Optional[UUID]] = mapped_column(
        UUIDType(),
        ForeignKey("transaction_headers.id", name="fk_transaction_header_reference"),
        nullable=True,
        comment="Reference to original transaction for returns"
    )
    
    # Additional information
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Additional notes"
    )
    reference_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="External reference number"
    )
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(
        Enum(PaymentMethod), nullable=True, default=PaymentMethod.CASH,
        comment="Payment method"
    )
    payment_reference: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True,
        comment="Payment reference"
    )
    return_workflow_state: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True,
        comment="Return workflow state"
    )
    
    # Delivery fields
    delivery_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether delivery is required"
    )
    delivery_address: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Delivery address if delivery is required"
    )
    delivery_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Scheduled delivery date"
    )
    delivery_time: Mapped[Optional[time]] = mapped_column(
        Time, nullable=True,
        comment="Scheduled delivery time"
    )
    
    # Pickup fields
    pickup_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="Whether pickup is required"
    )
    pickup_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True,
        comment="Scheduled pickup date"
    )
    pickup_time: Mapped[Optional[time]] = mapped_column(
        Time, nullable=True,
        comment="Scheduled pickup time"
    )
    
    # Extension tracking (for rentals)
    extension_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="Number of times this rental has been extended"
    )
    total_extension_charges: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0,
        comment="Total accumulated extension charges"
    )
    
    # Relationships - using lazy="noload" to prevent accidental lazy loading in async contexts
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", lazy="noload", back_populates="transactions"
    )
    supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", lazy="noload", back_populates="transactions"
    )
    location: Mapped[Optional["Location"]] = relationship(
        "Location", lazy="noload", back_populates="transactions"
    )
    reference_transaction: Mapped[Optional["TransactionHeader"]] = relationship(
        "TransactionHeader", remote_side="TransactionHeader.id", lazy="noload"
    )
    transaction_lines: Mapped[List["TransactionLine"]] = relationship(
        "TransactionLine", back_populates="transaction", lazy="noload",
        cascade="all, delete-orphan"
    )
    metadata_entries: Mapped[List["TransactionMetadata"]] = relationship(
        "TransactionMetadata", back_populates="transaction", lazy="noload",
        cascade="all, delete-orphan"
    )
    rental_lifecycle: Mapped[Optional["RentalLifecycle"]] = relationship(
        "RentalLifecycle", back_populates="transaction", uselist=False, lazy="noload"
    )
    events: Mapped[List["TransactionEvent"]] = relationship(
        "TransactionEvent", back_populates="transaction", lazy="noload",
        cascade="all, delete-orphan"
    )
    stock_movements: Mapped[List["StockMovement"]] = relationship(
        "StockMovement", back_populates="transaction_header", lazy="noload"
    )
    
    # Table constraints and indexes
    __table_args__ = (
        Index("idx_transaction_number", "transaction_number"),
        Index("idx_transaction_type", "transaction_type"),
        Index("idx_transaction_status", "status"),
        Index("idx_transaction_date", "transaction_date"),
        Index("idx_customer_id", "customer_id"),
        Index("idx_supplier_id", "supplier_id"),
        Index("idx_location_id", "location_id"),
        Index("idx_reference_transaction", "reference_transaction_id"),
        Index("idx_delivery_date", "delivery_date"),
        Index("idx_pickup_date", "pickup_date"),
        CheckConstraint("total_amount >= 0", name="check_positive_total"),
        CheckConstraint("paid_amount >= 0", name="check_positive_paid"),
        CheckConstraint("paid_amount <= total_amount", name="check_paid_not_exceed_total"),
    )
    
    # Custom __init__ removed to avoid greenlet_spawn errors with async SQLAlchemy
    # All fields should be set via attribute assignment after object creation
    # Validation should be done explicitly after adding to session if needed
    
    def _generate_transaction_number(self) -> str:
        """Generate a transaction number based on type and timestamp."""
        prefix_map = {
            TransactionType.SALE: "SALE",
            TransactionType.PURCHASE: "PURCH",
            TransactionType.RENTAL: "RENT",
            TransactionType.RETURN: "RET",
            TransactionType.ADJUSTMENT: "ADJ"
        }
        prefix = prefix_map.get(self.transaction_type, "TXN")
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"{prefix}-{timestamp}"
    
    def _validate_business_rules(self):
        """Validate transaction header business rules."""
        # Amount validations
        if self.subtotal and self.subtotal < 0:
            raise ValueError("Subtotal cannot be negative")
        
        if self.discount_amount and self.discount_amount < 0:
            raise ValueError("Discount amount cannot be negative")
        
        if self.tax_amount and self.tax_amount < 0:
            raise ValueError("Tax amount cannot be negative")
        
        if self.shipping_amount and self.shipping_amount < 0:
            raise ValueError("Shipping amount cannot be negative")
        
        if self.total_amount and self.total_amount < 0:
            raise ValueError("Total amount cannot be negative")
        
        if self.paid_amount and self.paid_amount < 0:
            raise ValueError("Paid amount cannot be negative")
        
        if (self.paid_amount and self.total_amount and 
            self.paid_amount > self.total_amount):
            raise ValueError("Paid amount cannot exceed total amount")
        
        # Party validations
        if (self.transaction_type in [TransactionType.SALE, TransactionType.RENTAL] 
            and not self.customer_id):
            raise ValueError("Customer ID is required for sales and rentals")
        
        if (self.transaction_type == TransactionType.PURCHASE 
            and not self.supplier_id):
            raise ValueError("Supplier ID is required for purchases")
        
        # Delivery/pickup validations
        if self.delivery_required and not self.delivery_address:
            raise ValueError("Delivery address is required when delivery is required")
        
        if self.delivery_required and not self.delivery_date:
            raise ValueError("Delivery date is required when delivery is required")
        
        if self.pickup_required and not self.pickup_date:
            raise ValueError("Pickup date is required when pickup is required")
        
        # Currency validation
        if self.currency and len(self.currency) != 3:
            raise ValueError("Currency code must be 3 characters")
    
    def update_amounts(
        self,
        subtotal: Optional[Decimal] = None,
        discount_amount: Optional[Decimal] = None,
        tax_amount: Optional[Decimal] = None,
        shipping_amount: Optional[Decimal] = None,
        updated_by: Optional[str] = None
    ):
        """Update transaction amounts and recalculate total."""
        if subtotal is not None:
            if subtotal < 0:
                raise ValueError("Subtotal cannot be negative")
            self.subtotal = subtotal
        
        if discount_amount is not None:
            if discount_amount < 0:
                raise ValueError("Discount amount cannot be negative")
            self.discount_amount = discount_amount
        
        if tax_amount is not None:
            if tax_amount < 0:
                raise ValueError("Tax amount cannot be negative")
            self.tax_amount = tax_amount
        
        if shipping_amount is not None:
            if shipping_amount < 0:
                raise ValueError("Shipping amount cannot be negative")
            self.shipping_amount = shipping_amount
        
        # Recalculate total
        self.total_amount = (
            self.subtotal - self.discount_amount + 
            self.tax_amount + self.shipping_amount
        )
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def add_payment(self, amount: Decimal, updated_by: Optional[str] = None):
        """Add a payment to the transaction."""
        if amount <= 0:
            raise ValueError("Payment amount must be positive")
        
        new_paid_amount = self.paid_amount + amount
        if new_paid_amount > self.total_amount:
            raise ValueError("Payment would exceed total amount")
        
        self.paid_amount = new_paid_amount
        
        # Update payment status
        if self.paid_amount >= self.total_amount:
            self.payment_status = PaymentStatus.PAID
        elif self.paid_amount > 0:
            self.payment_status = PaymentStatus.PARTIAL
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def mark_as_completed(self, updated_by: Optional[str] = None):
        """Mark transaction as completed."""
        self.status = TransactionStatus.COMPLETED
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def cancel_transaction(self, updated_by: Optional[str] = None):
        """Cancel the transaction."""
        self.status = TransactionStatus.CANCELLED
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def schedule_delivery(
        self,
        delivery_address: str,
        delivery_date: date,
        delivery_time: Optional[time] = None,
        updated_by: Optional[str] = None
    ):
        """Schedule delivery for the transaction."""
        self.delivery_required = True
        self.delivery_address = delivery_address
        self.delivery_date = delivery_date
        self.delivery_time = delivery_time
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    def schedule_pickup(
        self,
        pickup_date: date,
        pickup_time: Optional[time] = None,
        updated_by: Optional[str] = None
    ):
        """Schedule pickup for the transaction."""
        self.pickup_required = True
        self.pickup_date = pickup_date
        self.pickup_time = pickup_time
        
        if updated_by:
            self.updated_by = updated_by
        self.updated_at = datetime.now(timezone.utc)
    
    @hybrid_property
    def balance_due(self) -> Decimal:
        """Calculate outstanding balance."""
        return self.total_amount - self.paid_amount
    
    @hybrid_property
    def is_paid(self) -> bool:
        """Check if transaction is fully paid."""
        return self.paid_amount >= self.total_amount
    
    @hybrid_property
    def is_rental(self) -> bool:
        """Check if this is a rental transaction."""
        return self.transaction_type == TransactionType.RENTAL
    
    @property
    def rental_duration_days(self) -> int:
        """Calculate rental duration in days from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return 0
        
        # Get the maximum rental duration from all lines
        max_duration = 0
        for line in self.transaction_lines:
            if line.rental_start_date and line.rental_end_date:
                duration = (line.rental_end_date - line.rental_start_date).days
                max_duration = max(max_duration, duration)
        return max_duration
    
    @property
    def rental_start_date(self) -> Optional[date]:
        """Get the earliest rental start date from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return None
        
        start_dates = [line.rental_start_date for line in self.transaction_lines 
                      if line.rental_start_date]
        return min(start_dates) if start_dates else None
    
    @property
    def rental_end_date(self) -> Optional[date]:
        """Get the latest rental end date from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return None
        
        end_dates = [line.rental_end_date for line in self.transaction_lines 
                    if line.rental_end_date]
        return max(end_dates) if end_dates else None
    
    @property
    def is_overdue(self) -> bool:
        """Check if rental is overdue based on line items."""
        if not self.is_rental:
            return False
        
        rental_end = self.rental_end_date
        if not rental_end:
            return False
        
        return rental_end < date.today()
    
    @property
    def days_overdue(self) -> int:
        """Calculate days overdue for rental."""
        if not self.is_overdue:
            return 0
        return (date.today() - self.rental_end_date).days
    
    def __repr__(self) -> str:
        return (f"<TransactionHeader(id={self.id}, number={self.transaction_number}, "
                f"type={self.transaction_type}, total={self.total_amount})>")