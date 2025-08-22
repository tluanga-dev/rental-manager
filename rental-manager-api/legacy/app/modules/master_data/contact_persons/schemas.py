from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, validator
from uuid import UUID


class ContactPersonCreate(BaseModel):
    """Schema for creating a contact person."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        frozen=False
    )
    
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    email: Optional[str] = Field(None, max_length=100, description="Primary email address")
    phone: Optional[str] = Field(None, max_length=20, description="Primary phone number")
    mobile: Optional[str] = Field(None, max_length=20, description="Mobile phone number")
    title: Optional[str] = Field(None, max_length=100, description="Job title or position")
    department: Optional[str] = Field(None, max_length=100, description="Department or division")
    company: Optional[str] = Field(None, max_length=255, description="Company name")
    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State or province")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal or ZIP code")
    notes: Optional[str] = Field(None, description="Additional notes or comments")
    is_primary: bool = Field(False, description="Is this the primary contact")

    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v

    @validator('phone', 'mobile')
    def validate_phone(cls, v):
        if v and not v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').isdigit():
            raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v


class ContactPersonUpdate(BaseModel):
    """Schema for updating a contact person."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        frozen=False
    )
    
    first_name: Optional[str] = Field(None, min_length=1, max_length=100, description="First name")
    last_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Last name")
    email: Optional[str] = Field(None, max_length=100, description="Primary email address")
    phone: Optional[str] = Field(None, max_length=20, description="Primary phone number")
    mobile: Optional[str] = Field(None, max_length=20, description="Mobile phone number")
    title: Optional[str] = Field(None, max_length=100, description="Job title or position")
    department: Optional[str] = Field(None, max_length=100, description="Department or division")
    company: Optional[str] = Field(None, max_length=255, description="Company name")
    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State or province")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal or ZIP code")
    notes: Optional[str] = Field(None, description="Additional notes or comments")
    is_primary: Optional[bool] = Field(None, description="Is this the primary contact")

    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v

    @validator('phone', 'mobile')
    def validate_phone(cls, v):
        if v and not v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').isdigit():
            raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v


class ContactPersonResponse(BaseModel):
    """Schema for contact person response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    notes: Optional[str] = None
    is_primary: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class ContactPersonNested(BaseModel):
    """Schema for nested contact person response (used in other entities)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
