from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import RentalManagerBaseModel
from typing import Optional
import uuid


class ContactPerson(RentalManagerBaseModel):
    """Contact person model for managing contact information."""
    
    __tablename__ = "contact_persons"
    
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
    
    # Relationships
    # One contact person can be associated with multiple locations
    locations = relationship("Location", back_populates="contact_person_obj", foreign_keys="Location.contact_person_id")
    
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

    @property
    def display_name(self) -> str:
        """Get display name with title if available."""
        if self.title:
            return f"{self.full_name} ({self.title})"
        return self.full_name

    @property
    def primary_contact(self) -> str:
        """Get primary contact method (email or phone)."""
        return self.email or self.phone or self.mobile or "No contact info"

    def __str__(self) -> str:
        return self.display_name

    def __repr__(self) -> str:
        return f"<ContactPerson(id={self.id}, name='{self.full_name}', email='{self.email}')>"
