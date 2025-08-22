"""
Transaction Header model - main transaction records.
"""

from enum import Enum as PyEnum
from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime, date, time, timezone
from uuid import UUID, uuid4
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, Date, Time, ForeignKey, Integer, Index, Enum, CheckConstraint
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from .transaction_lines import TransactionLine
    from .rental_lifecycle import RentalLifecycle
    from .metadata import TransactionMetadata
    from app.modules.inventory.models import StockMovement


# Transaction Type Enum
class TransactionType(PyEnum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    RENTAL = "RENTAL"
    RETURN = "RETURN"
    ADJUSTMENT = "ADJUSTMENT"


# Transaction Status Enum
class TransactionStatus(PyEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"
    IN_PROGRESS = "IN_PROGRESS"  # For rentals


# Payment Method Enum
class PaymentMethod(PyEnum):
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    ONLINE = "ONLINE"
    CREDIT_ACCOUNT = "CREDIT_ACCOUNT"


# Payment Status Enum
class PaymentStatus(PyEnum):
    PENDING = "PENDING"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


# Rental Period Unit Enum
class RentalPeriodUnit(PyEnum):
    HOUR = "HOUR"
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"


# Rental Status Enum
class RentalStatus(PyEnum):
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
    transaction_number = Column(String(50), unique=True, nullable=False, comment="Human-readable transaction number")
    
    # Transaction categorization
    transaction_type = Column(Enum(TransactionType), nullable=False, comment="Type of transaction")
    # -- For rental- initial state it would be in Progress
    status = Column(Enum(TransactionStatus), nullable=False, default=TransactionStatus.PENDING, comment="Current status")
    
    
    # Temporal information
    transaction_date = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), comment="Transaction date and time")
    due_date = Column(Date, nullable=True, comment="Payment due date")
    
    # Parties involved
    customer_id = Column(
                UUIDType(),
                ForeignKey("customers.id", name="fk_transaction_header_customer"),
                nullable=True, comment="Customer/Supplier UUID as string"
            )
    supplier_id = Column(
        UUIDType(),
        ForeignKey("suppliers.id", name="fk_transaction_header_supplier"),
        nullable=True, comment="Supplier UUID as string"
    )
    location_id = Column(String(36), nullable=True, comment="Location UUID as string")
    sales_person_id = Column(UUIDType(), nullable=True, comment="Sales person handling transaction")
    
    # Financial information
    currency = Column(String(3), nullable=False, default="INR", comment="Currency code")
   

    
    # Amount calculations
    subtotal = Column(Numeric(15, 2), nullable=False, default=0, comment="Subtotal before discounts and taxes")
    discount_amount = Column(Numeric(15, 2), nullable=False, default=0, comment="Total discount amount")
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0, comment="Total tax amount")
    shipping_amount = Column(Numeric(15, 2), nullable=False, default=0, comment="Shipping charges")
    total_amount = Column(Numeric(15, 2), nullable=False, default=0, comment="Final total amount")
    paid_amount = Column(Numeric(15, 2), nullable=False, default=0, comment="Amount already paid")
    payment_status = Column(Enum(PaymentStatus), nullable=True,default=PaymentStatus.PAID, comment="Payment status")

    # Rental-specific fields (moved to TransactionLine level)
    deposit_amount = Column(Numeric(15, 2), nullable=True, comment="Security deposit for rentals")
    deposit_paid = Column(Boolean, nullable=False, default=False, comment="Whether deposit has been paid")
    customer_advance_balance = Column(Numeric(15, 2), nullable=False, default=0, comment="Customer advance payment balance")
    
    # Return handling
    reference_transaction_id = Column(UUIDType(), ForeignKey("transaction_headers.id", name="fk_transaction_header_reference"), nullable=True, comment="Reference to original transaction for returns")
    
    # Additional information
    notes = Column(Text, nullable=True, comment="Additional notes")
    reference_number = Column(String(50), nullable=True, comment="External reference number")
    payment_method = Column(Enum(PaymentMethod), nullable=True, default=PaymentMethod.CASH, comment="Payment method")
    payment_reference = Column(String(100), nullable=True, comment="Payment reference")
    return_workflow_state = Column(String(50), nullable=True, comment="Return workflow state")
    
    # Delivery fields
    delivery_required = Column(Boolean, nullable=False, default=False, comment="Whether delivery is required")
    delivery_address = Column(Text, nullable=True, comment="Delivery address if delivery is required")
    delivery_date = Column(Date, nullable=True, comment="Scheduled delivery date")
    delivery_time = Column(Time, nullable=True, comment="Scheduled delivery time")
    
    # Pickup fields
    pickup_required = Column(Boolean, nullable=False, default=False, comment="Whether pickup is required")
    pickup_date = Column(Date, nullable=True, comment="Scheduled pickup date")
    pickup_time = Column(Time, nullable=True, comment="Scheduled pickup time")
    
    # Extension tracking (for rentals)
    extension_count = Column(Integer, nullable=False, default=0, comment="Number of times this rental has been extended")
    total_extension_charges = Column(Numeric(15, 2), nullable=False, default=0, comment="Total accumulated extension charges")
    
    # Inventory tracking - relationships handle the connection

    # Relationships
    customer = relationship("Customer", lazy="select")
    supplier = relationship("Supplier", lazy="select")
    # location = relationship("Location", back_populates="transactions", lazy="select")  # Temporarily disabled
    # sales_person = relationship("User", back_populates="transactions", lazy="select")  # Temporarily disabled
    reference_transaction = relationship("TransactionHeader", remote_side="TransactionHeader.id", lazy="select")
    transaction_lines = relationship("TransactionLine", back_populates="transaction", lazy="select", cascade="all, delete-orphan")
    metadata_entries = relationship("TransactionMetadata", back_populates="transaction", lazy="select", cascade="all, delete-orphan")
    rental_lifecycle = relationship("RentalLifecycle", back_populates="transaction", uselist=False, lazy="select")
    events = relationship("TransactionEvent", back_populates="transaction", lazy="select", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="transaction_header", lazy="select")
    extensions = relationship("RentalExtension", back_populates="parent_rental", lazy="select", cascade="all, delete-orphan")
    
    # Indexes for efficient queries
    __table_args__ = (
        Index("idx_transaction_number", "transaction_number"),
        Index("idx_transaction_type", "transaction_type"),
        Index("idx_transaction_status", "status"),
        Index("idx_transaction_date", "transaction_date"),
        Index("idx_customer_id", "customer_id"),
        Index("idx_supplier_id", "supplier_id"),
        Index("idx_sales_person_id", "sales_person_id"),
        Index("idx_location_id", "location_id"),
        Index("idx_reference_transaction", "reference_transaction_id"),
        Index("idx_delivery_required", "delivery_required"),
        Index("idx_pickup_required", "pickup_required"),
        Index("idx_delivery_date", "delivery_date"),
        Index("idx_pickup_date", "pickup_date"),
        CheckConstraint("total_amount >= 0", name="check_positive_total"),
        CheckConstraint("paid_amount >= 0", name="check_positive_paid"),
        CheckConstraint("paid_amount <= total_amount", name="check_paid_not_exceed_total"),
    )
    
    def __init__(
        self,
        transaction_type: TransactionType,
        transaction_number: Optional[str] = None,
        status: TransactionStatus = TransactionStatus.PENDING,
        transaction_date: Optional[datetime] = None,
        customer_id: Optional[str | UUID] = None,
        supplier_id: Optional[str | UUID] = None,
        location_id: Optional[str | UUID] = None,
        sales_person_id: Optional[str | UUID] = None,
        currency: str = "INR",
        subtotal: Decimal = Decimal("0.00"),
        discount_amount: Decimal = Decimal("0.00"),
        tax_amount: Decimal = Decimal("0.00"),
        shipping_amount: Decimal = Decimal("0.00"),
        total_amount: Decimal = Decimal("0.00"),
        paid_amount: Decimal = Decimal("0.00"),
        payment_status: Optional[PaymentStatus] = PaymentStatus.PAID,
        deposit_amount: Optional[Decimal] = None,
        deposit_paid: bool = False,
        customer_advance_balance: Decimal = Decimal("0.00"),
        reference_transaction_id: Optional[str | UUID] = None,
        notes: Optional[str] = None,
        reference_number: Optional[str] = None,
        payment_method: Optional[PaymentMethod] = PaymentMethod.CASH,
        payment_reference: Optional[str] = None,
        return_workflow_state: Optional[str] = None,
        delivery_required: bool = False,
        delivery_address: Optional[str] = None,
        delivery_date: Optional[date] = None,
        delivery_time: Optional[time] = None,
        pickup_required: bool = False,
        pickup_date: Optional[date] = None,
        pickup_time: Optional[time] = None,
        due_date: Optional[date] = None,
        **kwargs
    ):
        """
        Initialize a Transaction Header.
        
        Args:
            transaction_type: Type of transaction (SALE, PURCHASE, RENTAL, etc.)
            transaction_number: Human-readable transaction number
            status: Current transaction status
            transaction_date: Transaction date and time
            customer_id: Customer UUID
            supplier_id: Supplier UUID
            location_id: Location UUID
            sales_person_id: Sales person UUID
            currency: Currency code
            subtotal: Subtotal before discounts and taxes
            discount_amount: Total discount amount
            tax_amount: Total tax amount
            shipping_amount: Shipping charges
            total_amount: Final total amount
            paid_amount: Amount already paid
            payment_status: Payment status
            deposit_amount: Security deposit for rentals
            deposit_paid: Whether deposit has been paid
            customer_advance_balance: Customer advance payment balance
            reference_transaction_id: Reference to original transaction for returns
            notes: Additional notes
            reference_number: External reference number
            payment_method: Payment method
            payment_reference: Payment reference
            return_workflow_state: Return workflow state
            delivery_required: Whether delivery is required
            delivery_address: Delivery address
            delivery_date: Scheduled delivery date
            delivery_time: Scheduled delivery time
            pickup_required: Whether pickup is required
            pickup_date: Scheduled pickup date
            pickup_time: Scheduled pickup time
            due_date: Payment due date
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.transaction_type = transaction_type if isinstance(transaction_type, TransactionType) else TransactionType(transaction_type)
        self.transaction_number = transaction_number or self._generate_transaction_number()
        self.status = status if isinstance(status, TransactionStatus) else TransactionStatus(status)
        self.transaction_date = transaction_date or datetime.now(timezone.utc)
        self.customer_id = customer_id
        self.supplier_id = supplier_id
        self.location_id = location_id
        self.sales_person_id = sales_person_id
        self.currency = currency
        self.subtotal = subtotal
        self.discount_amount = discount_amount
        self.tax_amount = tax_amount
        self.shipping_amount = shipping_amount
        self.total_amount = total_amount
        self.paid_amount = paid_amount
        self.payment_status = payment_status if isinstance(payment_status, PaymentStatus) else PaymentStatus(payment_status) if payment_status else None
        self.deposit_amount = deposit_amount
        self.deposit_paid = deposit_paid
        self.customer_advance_balance = customer_advance_balance
        self.reference_transaction_id = reference_transaction_id
        self.notes = notes
        self.reference_number = reference_number
        self.payment_method = payment_method if isinstance(payment_method, PaymentMethod) else PaymentMethod(payment_method) if payment_method else None
        self.payment_reference = payment_reference
        self.return_workflow_state = return_workflow_state
        self.delivery_required = delivery_required
        self.delivery_address = delivery_address
        self.delivery_date = delivery_date
        self.delivery_time = delivery_time
        self.pickup_required = pickup_required
        self.pickup_date = pickup_date
        self.pickup_time = pickup_time
        self.due_date = due_date
        self._validate()
    
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
    
    def _validate(self):
        """Validate transaction header business rules."""
        # Amount validations
        if self.subtotal < 0:
            raise ValueError("Subtotal cannot be negative")
        
        if self.discount_amount < 0:
            raise ValueError("Discount amount cannot be negative")
        
        if self.tax_amount < 0:
            raise ValueError("Tax amount cannot be negative")
        
        if self.shipping_amount < 0:
            raise ValueError("Shipping amount cannot be negative")
        
        if self.total_amount < 0:
            raise ValueError("Total amount cannot be negative")
        
        if self.paid_amount < 0:
            raise ValueError("Paid amount cannot be negative")
        
        if self.paid_amount > self.total_amount:
            raise ValueError("Paid amount cannot exceed total amount")
        
        if self.customer_advance_balance < 0:
            raise ValueError("Customer advance balance cannot be negative")
        
        # Deposit validations
        if self.deposit_amount and self.deposit_amount < 0:
            raise ValueError("Deposit amount cannot be negative")
        
        # Party validations
        if self.transaction_type in [TransactionType.SALE, TransactionType.RENTAL] and not self.customer_id:
            raise ValueError("Customer ID is required for sales and rentals")
        
        if self.transaction_type == TransactionType.PURCHASE and not self.supplier_id:
            raise ValueError("Supplier ID is required for purchases")
        
        # Delivery/pickup validations
        if self.delivery_required and not self.delivery_address:
            raise ValueError("Delivery address is required when delivery is required")
        
        if self.delivery_required and not self.delivery_date:
            raise ValueError("Delivery date is required when delivery is required")
        
        if self.pickup_required and not self.pickup_date:
            raise ValueError("Pickup date is required when pickup is required")
        
        # Currency validation
        if len(self.currency) != 3:
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
        self.total_amount = self.subtotal - self.discount_amount + self.tax_amount + self.shipping_amount
        
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
    
    def __repr__(self):
        return f"<TransactionHeader(id={self.id}, number={self.transaction_number}, type={self.transaction_type}, total={self.total_amount})>"
    
    @property
    def balance_due(self):
        """Calculate outstanding balance."""
        return self.total_amount - self.paid_amount
    
    @property
    def is_paid(self):
        """Check if transaction is fully paid."""
        return self.paid_amount >= self.total_amount
    
    def compute_payment_status(self):
        """Compute payment status based on amounts (for validation/comparison)."""
        if self.paid_amount == 0:
            return PaymentStatus.PENDING
        elif self.paid_amount >= self.total_amount:
            return PaymentStatus.PAID
        else:
            return PaymentStatus.PARTIAL
    
    @property
    def is_rental(self):
        """Check if this is a rental transaction."""
        return self.transaction_type == TransactionType.RENTAL
    
    @property
    def rental_duration_days(self):
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
    def rental_start_date(self):
        """Get the earliest rental start date from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return None
        
        start_dates = [line.rental_start_date for line in self.transaction_lines 
                      if line.rental_start_date]
        return min(start_dates) if start_dates else None
    
    @property
    def rental_end_date(self):
        """Get the latest rental end date from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return None
        
        end_dates = [line.rental_end_date for line in self.transaction_lines 
                    if line.rental_end_date]
        return max(end_dates) if end_dates else None
    
    @property
    def current_rental_status(self):
        """Aggregate rental status from transaction lines."""
        if not self.is_rental or not self.transaction_lines:
            return None
        
        # Use RentalStatus enum directly
        
        # Get all line statuses
        line_statuses = [line.current_rental_status for line in self.transaction_lines 
                        if line.current_rental_status]
        
        if not line_statuses:
            return None
        
        # Status aggregation logic:
        # - If any line is LATE, transaction is LATE
        # - If any line has PARTIAL_RETURN, transaction has partial returns
        # - If all lines are COMPLETED, transaction is COMPLETED
        # - Otherwise, transaction is ACTIVE
        
        if RentalStatus.LATE in line_statuses or RentalStatus.LATE_PARTIAL_RETURN in line_statuses:
            if RentalStatus.PARTIAL_RETURN in line_statuses or RentalStatus.LATE_PARTIAL_RETURN in line_statuses:
                return RentalStatus.LATE_PARTIAL_RETURN
            return RentalStatus.LATE
        
        if RentalStatus.PARTIAL_RETURN in line_statuses:
            return RentalStatus.PARTIAL_RETURN
        
        if all(status == RentalStatus.COMPLETED for status in line_statuses):
            return RentalStatus.COMPLETED
        
        if RentalStatus.EXTENDED in line_statuses:
            return RentalStatus.EXTENDED
        
        return RentalStatus.ACTIVE
    
    @property
    def is_overdue(self):
        """Check if rental is overdue based on line items."""
        if not self.is_rental:
            return False
        
        rental_end = self.rental_end_date
        if not rental_end:
            return False
        
        return rental_end < date.today()
    
    @property
    def days_overdue(self):
        """Calculate days overdue for rental."""
        if not self.is_overdue:
            return 0
        return (date.today() - self.rental_end_date).days