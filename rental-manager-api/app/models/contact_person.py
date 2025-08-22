from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Boolean, Text, Index, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
import re

from app.db.base import RentalManagerBaseModel

if TYPE_CHECKING:
    pass


class ContactPerson(RentalManagerBaseModel):
    """Contact person model for managing contact information."""
    
    # Basic Information
    first_name = Column(String(100), nullable=False, comment="First name")
    last_name = Column(String(100), nullable=False, comment="Last name")
    full_name = Column(String(255), nullable=False, comment="Full name (computed)")
    
    # Contact Information
    email = Column(String(100), nullable=True, comment="Primary email address")
    phone = Column(String(20), nullable=True, comment="Primary phone number")
    mobile = Column(String(20), nullable=True, comment="Mobile phone number")
    
    # Professional Information
    title = Column(String(100), nullable=True, comment="Job title or position")
    department = Column(String(100), nullable=True, comment="Department or division")
    company = Column(String(255), nullable=True, comment="Company name")
    
    # Address Information
    address = Column(Text, nullable=True, comment="Street address")
    city = Column(String(100), nullable=True, comment="City")
    state = Column(String(100), nullable=True, comment="State or province")
    country = Column(String(100), nullable=True, comment="Country")
    postal_code = Column(String(20), nullable=True, comment="Postal or ZIP code")
    
    # Additional Information
    notes = Column(Text, nullable=True, comment="Additional notes or comments")
    is_primary = Column(Boolean, default=False, comment="Is this the primary contact")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_contact_person_email', 'email'),
        Index('idx_contact_person_full_name', 'full_name'),
        Index('idx_contact_person_company', 'company'),
        Index('idx_contact_person_primary', 'is_primary'),
        Index('idx_contact_person_phone', 'phone'),
        Index('idx_contact_person_mobile', 'mobile'),
        Index('idx_contact_person_location', 'city', 'state', 'country'),
    )

    def __init__(
        self,
        first_name: str,
        last_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        mobile: Optional[str] = None,
        title: Optional[str] = None,
        department: Optional[str] = None,
        company: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        postal_code: Optional[str] = None,
        notes: Optional[str] = None,
        is_primary: bool = False,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.first_name = first_name
        self.last_name = last_name
        self.full_name = f"{first_name} {last_name}".strip()
        self.email = email
        self.phone = phone
        self.mobile = mobile
        self.title = title
        self.department = department
        self.company = company
        self.address = address
        self.city = city
        self.state = state
        self.country = country
        self.postal_code = postal_code
        self.notes = notes
        self.is_primary = is_primary

    @validates('email')
    def validate_email(self, key, email):
        """Validate email format."""
        if email and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            raise ValueError('Invalid email format')
        return email.lower() if email else email

    @validates('phone', 'mobile')
    def validate_phone(self, key, phone):
        """Validate phone number format."""
        if phone and not re.match(r'^\+?[1-9]\d{1,14}$', phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')):
            raise ValueError(f'Invalid {key} format')
        return phone

    @validates('first_name', 'last_name')
    def validate_names(self, key, name):
        """Validate name fields."""
        if not name or not name.strip():
            raise ValueError(f'{key} cannot be empty')
        return name.strip()

    @validates('postal_code')
    def validate_postal_code(self, key, postal_code):
        """Validate postal code."""
        if postal_code and not re.match(r'^[A-Za-z0-9\s-]{3,10}$', postal_code):
            raise ValueError('Invalid postal code format')
        return postal_code.upper() if postal_code else postal_code

    @hybrid_property
    def display_name(self) -> str:
        """Get display name with title if available."""
        if self.title:
            return f"{self.full_name} ({self.title})"
        return self.full_name

    @hybrid_property
    def primary_contact(self) -> str:
        """Get primary contact method (email or phone)."""
        return self.email or self.phone or self.mobile or "No contact info"

    @hybrid_property
    def full_address(self) -> str:
        """Get formatted full address."""
        if not self.address:
            return ""
        
        address_parts = [self.address]
        if self.city:
            address_parts.append(self.city)
        if self.state:
            address_parts.append(self.state)
        if self.postal_code:
            address_parts.append(self.postal_code)
        if self.country:
            address_parts.append(self.country)
        
        return ", ".join(address_parts)

    def update_full_name(self) -> None:
        """Update the computed full name field."""
        self.full_name = f"{self.first_name} {self.last_name}".strip()

    def __str__(self) -> str:
        return self.display_name

    def __repr__(self) -> str:
        return f"<ContactPerson(id={self.id}, name='{self.full_name}', email='{self.email}')>"