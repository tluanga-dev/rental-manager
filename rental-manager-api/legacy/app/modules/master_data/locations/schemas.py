from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from uuid import UUID


class LocationTypeEnum(str, Enum):
    """Location type enumeration for API schemas."""
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"
    SERVICE_CENTER = "SERVICE_CENTER"


class LocationCreate(BaseModel):
    """Schema for creating a location."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        frozen=False
    )
    
    location_code: str = Field(..., min_length=1, max_length=50, description="Unique location code")
    location_name: str = Field(..., min_length=1, max_length=255, description="Location name")
    location_type: LocationTypeEnum = Field(..., description="Type of location")
    address: Optional[str] = Field(None, max_length=500, description="Street address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State/Province")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal/ZIP code")
    contact_number: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    email: Optional[str] = Field(None, max_length=100, description="Contact email")
    
    # Contact Person Fields - Temporarily disabled until DB migration completes
    # contact_person_name: Optional[str] = Field(None, max_length=255, description="Primary contact person name")
    # contact_person_title: Optional[str] = Field(None, max_length=100, description="Contact person job title")
    # contact_person_phone: Optional[str] = Field(None, max_length=20, description="Contact person phone number")
    # contact_person_email: Optional[str] = Field(None, max_length=255, description="Contact person email address")
    # contact_person_notes: Optional[str] = Field(None, description="Additional notes about contact person")
    
    manager_user_id: Optional[str] = Field(None, description="Manager user ID")


class LocationUpdate(BaseModel):
    """Schema for updating a location."""
    location_name: Optional[str] = Field(None, max_length=100, description="Location name")
    location_type: Optional[LocationTypeEnum] = Field(None, description="Location type")
    address: Optional[str] = Field(None, description="Street address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    state: Optional[str] = Field(None, max_length=100, description="State")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal code")
    contact_number: Optional[str] = Field(None, max_length=20, description="Contact number")
    email: Optional[str] = Field(None, max_length=255, description="Email address")
    
    # Contact Person Fields - Temporarily disabled until DB migration completes
    # contact_person_name: Optional[str] = Field(None, max_length=255, description="Primary contact person name")
    # contact_person_title: Optional[str] = Field(None, max_length=100, description="Contact person job title")
    # contact_person_phone: Optional[str] = Field(None, max_length=20, description="Contact person phone number")
    # contact_person_email: Optional[str] = Field(None, max_length=255, description="Contact person email address")
    # contact_person_notes: Optional[str] = Field(None, description="Additional notes about contact person")
    
    manager_user_id: Optional[int] = Field(None, description="Manager user ID")


class LocationResponse(BaseModel):
    """Schema for location response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    location_code: str
    location_name: str
    location_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    
    # Contact Person Fields - Temporarily disabled until DB migration completes
    # contact_person_name: Optional[str] = None
    # contact_person_title: Optional[str] = None
    # contact_person_phone: Optional[str] = None
    # contact_person_email: Optional[str] = None
    # contact_person_notes: Optional[str] = None
    
    manager_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool