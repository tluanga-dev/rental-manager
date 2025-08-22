from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID


class ContactPersonBase(BaseModel):
    """Base schema for contact person."""
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

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower() if v else v

    @field_validator('phone', 'mobile')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            # Remove common phone formatting characters
            clean_phone = v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            if not clean_phone.isdigit():
                raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

    @field_validator('postal_code')
    @classmethod
    def validate_postal_code(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v.strip()) < 3:
            raise ValueError('Postal code must be at least 3 characters')
        return v.upper() if v else v


class ContactPersonCreate(ContactPersonBase):
    """Schema for creating a contact person."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        frozen=False
    )


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

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower() if v else v

    @field_validator('phone', 'mobile')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            # Remove common phone formatting characters
            clean_phone = v.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            if not clean_phone.isdigit():
                raise ValueError('Phone number must contain only digits, spaces, hyphens, parentheses, and plus sign')
        return v

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Name cannot be empty')
            return v.strip()
        return v

    @field_validator('postal_code')
    @classmethod
    def validate_postal_code(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v.strip()) < 3:
            raise ValueError('Postal code must be at least 3 characters')
        return v.upper() if v else v


class ContactPersonResponse(ContactPersonBase):
    """Schema for contact person response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    full_name: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class ContactPersonNested(BaseModel):
    """Schema for nested contact person response (used in other entities)."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    is_primary: bool = False


class ContactPersonSearch(BaseModel):
    """Schema for contact person search parameters."""
    search_term: Optional[str] = Field(None, description="Search by name, email, phone, or company")
    company: Optional[str] = Field(None, description="Filter by company")
    is_primary: Optional[bool] = Field(None, description="Filter by primary status")
    city: Optional[str] = Field(None, description="Filter by city")
    state: Optional[str] = Field(None, description="Filter by state")
    country: Optional[str] = Field(None, description="Filter by country")
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(50, ge=1, le=1000, description="Number of records to return")
    active_only: bool = Field(True, description="Only return active contacts")


class ContactPersonStats(BaseModel):
    """Schema for contact person statistics."""
    total_contacts: int
    active_contacts: int
    inactive_contacts: int
    primary_contacts: int
    companies_count: int
    with_email: int
    with_phone: int