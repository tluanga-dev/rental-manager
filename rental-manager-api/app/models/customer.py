from enum import Enum
from typing import Optional, TYPE_CHECKING
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, Boolean, Text, Index, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
import re

from app.db.base import RentalManagerBaseModel
# Remove postgres_enums import - we'll use string columns with check constraints

if TYPE_CHECKING:
    from app.models.transaction.transaction_header import TransactionHeader


class CustomerType(str, Enum):
    """Customer type enumeration."""
    INDIVIDUAL = "INDIVIDUAL"
    BUSINESS = "BUSINESS"


class CustomerTier(str, Enum):
    """Customer tier enumeration."""
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"


class CustomerStatus(str, Enum):
    """Customer status enumeration."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class BlacklistStatus(str, Enum):
    """Blacklist status enumeration."""
    CLEAR = "CLEAR"
    WARNING = "WARNING"
    BLACKLISTED = "BLACKLISTED"


class CreditRating(str, Enum):
    """Credit rating enumeration."""
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    NO_RATING = "NO_RATING"


class Customer(RentalManagerBaseModel):
    """Customer model with comprehensive customer information."""
    
    # Unique customer code
    customer_code = Column(String(50), nullable=False, unique=True, index=True)
    
    # Customer type (Individual or Business) - using String with check constraint
    customer_type = Column(String(20), nullable=False, default=CustomerType.INDIVIDUAL.value)
    
    # Business information (for business customers)
    business_name = Column(String(200), nullable=True)
    
    # Personal information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    
    # Contact information
    email = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=False)
    mobile = Column(String(20), nullable=True)
    
    # Address information
    address_line1 = Column(String(200), nullable=False)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), nullable=False, default="India")
    
    # Business information
    tax_number = Column(String(50), nullable=True)
    
    # Customer status and tier - using String with check constraints
    status = Column(String(20), nullable=False, default=CustomerStatus.ACTIVE.value)
    customer_tier = Column(String(20), nullable=False, default=CustomerTier.BRONZE.value)
    
    # Credit information
    credit_limit = Column(Numeric(10, 2), nullable=True, default=0.00)
    credit_rating = Column(String(20), nullable=False, default=CreditRating.GOOD.value)
    payment_terms = Column(String(50), nullable=True, default="NET_30")
    
    # Blacklist information
    blacklist_status = Column(String(20), nullable=False, default=BlacklistStatus.CLEAR.value)
    blacklist_reason = Column(Text, nullable=True)
    blacklist_date = Column(DateTime(timezone=True), nullable=True)
    
    # Analytics and statistics
    total_rentals = Column(Numeric(10, 0), nullable=False, default=0)
    total_spent = Column(Numeric(12, 2), nullable=False, default=0.00)
    lifetime_value = Column(Numeric(12, 2), nullable=False, default=0.00)
    last_rental_date = Column(DateTime(timezone=True), nullable=True)
    last_transaction_date = Column(DateTime(timezone=True), nullable=True)
    
    # Additional notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    transactions = relationship("TransactionHeader", back_populates="customer", lazy="dynamic", 
                               foreign_keys="TransactionHeader.customer_id")
    held_inventory_units = relationship("InventoryUnit", back_populates="current_holder", lazy="dynamic")
    
    # Indexes and constraints for performance and data integrity
    __table_args__ = (
        Index('idx_customer_email', 'email'),
        Index('idx_customer_code', 'customer_code'),
        Index('idx_customer_type_status', 'customer_type', 'status'),
        Index('idx_customer_blacklist', 'blacklist_status'),
        Index('idx_customer_tier', 'customer_tier'),
        Index('idx_customer_location', 'city', 'state', 'country'),
        CheckConstraint("customer_type IN ('INDIVIDUAL', 'BUSINESS')", name='check_customer_type'),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING')", name='check_customer_status'),
        CheckConstraint("customer_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')", name='check_customer_tier'),
        CheckConstraint("credit_rating IN ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NO_RATING')", name='check_credit_rating'),
        CheckConstraint("blacklist_status IN ('CLEAR', 'WARNING', 'BLACKLISTED')", name='check_blacklist_status'),
    )
    
    @validates('email')
    def validate_email(self, key, address):
        """Validate email format."""
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', address):
            raise ValueError('Invalid email format')
        return address.lower()
    
    @validates('phone', 'mobile')
    def validate_phone(self, key, phone):
        """Validate phone number format."""
        if phone and not re.match(r'^\+?[1-9]\d{1,14}$', phone.replace(' ', '').replace('-', '')):
            raise ValueError(f'Invalid {key} format')
        return phone
    
    @validates('customer_code')
    def validate_customer_code(self, key, code):
        """Validate customer code format."""
        if not re.match(r'^[A-Z0-9_-]+$', code):
            raise ValueError('Customer code must contain only uppercase letters, numbers, underscores, and hyphens')
        return code.upper()
    
    @validates('postal_code')
    def validate_postal_code(self, key, postal_code):
        """Validate postal code."""
        if postal_code and not re.match(r'^[A-Za-z0-9\s-]{3,10}$', postal_code):
            raise ValueError('Invalid postal code format')
        return postal_code.upper()
    
    @validates('credit_limit')
    def validate_credit_limit(self, key, credit_limit):
        """Validate credit limit is non-negative."""
        if credit_limit is not None and credit_limit < 0:
            raise ValueError('Credit limit cannot be negative')
        return credit_limit
    
    @hybrid_property
    def full_name(self) -> str:
        """Get full name of customer."""
        return f"{self.first_name} {self.last_name}"
    
    @hybrid_property
    def display_name(self) -> str:
        """Get display name - business name for business customers, full name for individuals."""
        if self.customer_type == CustomerType.BUSINESS and self.business_name:
            return self.business_name
        return self.full_name
    
    @hybrid_property
    def full_address(self) -> str:
        """Get formatted full address."""
        address_parts = [self.address_line1]
        if self.address_line2:
            address_parts.append(self.address_line2)
        address_parts.extend([self.city, self.state, self.postal_code, self.country])
        return ", ".join(address_parts)
    
    @hybrid_property
    def is_blacklisted(self) -> bool:
        """Check if customer is blacklisted."""
        return self.blacklist_status == BlacklistStatus.BLACKLISTED
    
    @hybrid_property
    def can_transact(self) -> bool:
        """Check if customer can perform transactions."""
        return (
            self.status == CustomerStatus.ACTIVE and 
            not self.is_blacklisted and 
            self.is_active
        )
    
    def blacklist(self, reason: str, by_user: Optional[str] = None) -> None:
        """Blacklist the customer."""
        self.blacklist_status = BlacklistStatus.BLACKLISTED
        self.blacklist_reason = reason
        self.blacklist_date = datetime.utcnow()
        self.status = CustomerStatus.SUSPENDED
        self.updated_by = by_user
    
    def clear_blacklist(self, by_user: Optional[str] = None) -> None:
        """Clear customer blacklist."""
        self.blacklist_status = BlacklistStatus.CLEAR
        self.blacklist_reason = None
        self.blacklist_date = None
        if self.status == CustomerStatus.SUSPENDED:
            self.status = CustomerStatus.ACTIVE
        self.updated_by = by_user
    
    def update_tier(self) -> None:
        """Update customer tier based on lifetime value."""
        if self.lifetime_value >= 100000:
            self.customer_tier = CustomerTier.PLATINUM
        elif self.lifetime_value >= 50000:
            self.customer_tier = CustomerTier.GOLD
        elif self.lifetime_value >= 20000:
            self.customer_tier = CustomerTier.SILVER
        else:
            self.customer_tier = CustomerTier.BRONZE
    
    def update_statistics(self, rental_amount: Decimal) -> None:
        """Update customer statistics after a transaction."""
        self.total_rentals += 1
        self.total_spent += rental_amount
        self.lifetime_value += rental_amount
        self.last_rental_date = datetime.utcnow()
        self.last_transaction_date = datetime.utcnow()
        self.update_tier()
    
    def __str__(self) -> str:
        return f"{self.customer_code} - {self.display_name}"
    
    def __repr__(self) -> str:
        return f"<Customer(id={self.id}, code='{self.customer_code}', name='{self.display_name}')>"