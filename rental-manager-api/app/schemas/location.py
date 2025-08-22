"""
Pydantic schemas for Location model validation.

This module defines request/response schemas for the Location API with:
- Comprehensive field validation
- Type safety
- Clear documentation
- Support for hierarchical locations and geospatial data
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from enum import Enum
from uuid import UUID
import re


class LocationTypeEnum(str, Enum):
    """Location type enumeration for API schemas."""
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"
    SERVICE_CENTER = "SERVICE_CENTER"
    DISTRIBUTION_CENTER = "DISTRIBUTION_CENTER"
    OFFICE = "OFFICE"


class OperatingHours(BaseModel):
    """Schema for operating hours."""
    open: str = Field(..., pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', description="Opening time (HH:MM)")
    close: str = Field(..., pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', description="Closing time (HH:MM)")
    closed: bool = Field(False, description="Whether closed on this day")


class WeeklyOperatingHours(BaseModel):
    """Schema for weekly operating hours."""
    monday: Optional[OperatingHours] = None
    tuesday: Optional[OperatingHours] = None
    wednesday: Optional[OperatingHours] = None
    thursday: Optional[OperatingHours] = None
    friday: Optional[OperatingHours] = None
    saturday: Optional[OperatingHours] = None
    sunday: Optional[OperatingHours] = None


class LocationBase(BaseModel):
    """Base schema for Location with common fields."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        use_enum_values=True
    )
    
    location_code: str = Field(
        ...,
        min_length=1,
        max_length=20,
        pattern=r'^[A-Z0-9\-_]+$',
        description="Unique location code (uppercase alphanumeric with hyphens/underscores)"
    )
    location_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Location name"
    )
    location_type: LocationTypeEnum = Field(
        ...,
        description="Type of location"
    )
    
    # Address fields
    address: Optional[str] = Field(
        None,
        max_length=500,
        description="Street address"
    )
    city: Optional[str] = Field(
        None,
        max_length=100,
        description="City"
    )
    state: Optional[str] = Field(
        None,
        max_length=100,
        description="State/Province"
    )
    country: Optional[str] = Field(
        None,
        max_length=100,
        description="Country"
    )
    postal_code: Optional[str] = Field(
        None,
        max_length=20,
        description="Postal/ZIP code"
    )
    
    # Contact fields
    contact_number: Optional[str] = Field(
        None,
        max_length=30,
        description="Contact phone number"
    )
    email: Optional[str] = Field(
        None,
        max_length=255,
        description="Contact email address"
    )
    website: Optional[str] = Field(
        None,
        max_length=255,
        description="Website URL"
    )
    
    @field_validator('location_code')
    @classmethod
    def validate_location_code(cls, v: str) -> str:
        """Validate and normalize location code."""
        if v:
            v = v.strip().upper()
            if not re.match(r'^[A-Z0-9\-_]+$', v):
                raise ValueError("Location code must contain only uppercase letters, numbers, hyphens, and underscores")
        return v
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format."""
        if v:
            v = v.strip().lower()
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError("Invalid email format")
        return v
    
    @field_validator('contact_number')
    @classmethod
    def validate_contact_number(cls, v: Optional[str]) -> Optional[str]:
        """Validate contact number format."""
        if v:
            v = v.strip()
            # Allow digits, spaces, hyphens, parentheses, plus, and extension
            phone_pattern = r'^[\+]?[0-9\s\-\(\)\.ext]+$'
            if not re.match(phone_pattern, v, re.IGNORECASE):
                raise ValueError("Invalid phone number format")
        return v
    
    @field_validator('website')
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize website URL."""
        if v:
            v = v.strip().lower()
            # Add https:// if no protocol specified
            if not v.startswith(('http://', 'https://')):
                v = f'https://{v}'
            
            # Basic URL validation
            url_pattern = r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$'
            if not re.match(url_pattern, v):
                raise ValueError("Invalid website URL format")
        return v
    
    @field_validator('postal_code')
    @classmethod
    def validate_postal_code(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize postal code."""
        if v:
            v = v.strip().upper()
        return v


class LocationCreate(LocationBase):
    """Schema for creating a new location."""
    
    # Geographic fields
    latitude: Optional[Decimal] = Field(
        None,
        ge=-90,
        le=90,
        decimal_places=8,
        description="Latitude coordinate"
    )
    longitude: Optional[Decimal] = Field(
        None,
        ge=-180,
        le=180,
        decimal_places=8,
        description="Longitude coordinate"
    )
    timezone: str = Field(
        "UTC",
        max_length=50,
        description="Timezone identifier (e.g., 'America/New_York')"
    )
    
    # Operational fields
    operating_hours: Optional[Dict[str, Any]] = Field(
        None,
        description="Operating hours in JSON format"
    )
    capacity: Optional[int] = Field(
        None,
        ge=0,
        description="Storage/operational capacity"
    )
    is_default: bool = Field(
        False,
        description="Set as default location"
    )
    
    # Hierarchical fields
    parent_location_id: Optional[UUID] = Field(
        None,
        description="Parent location ID for hierarchy"
    )
    
    # Management fields
    manager_user_id: Optional[UUID] = Field(
        None,
        description="Manager user ID"
    )
    
    # Flexible metadata
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata"
    )
    
    @model_validator(mode='after')
    def validate_coordinates(self) -> 'LocationCreate':
        """Validate that both coordinates are provided if any."""
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together")
        return self


class LocationUpdate(BaseModel):
    """Schema for updating a location."""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        use_enum_values=True
    )
    
    location_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Location name"
    )
    location_type: Optional[LocationTypeEnum] = Field(
        None,
        description="Type of location"
    )
    
    # Address fields
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    # Contact fields
    contact_number: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    
    # Geographic fields
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90, decimal_places=8)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180, decimal_places=8)
    timezone: Optional[str] = Field(None, max_length=50)
    
    # Operational fields
    operating_hours: Optional[Dict[str, Any]] = None
    capacity: Optional[int] = Field(None, ge=0)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    
    # Hierarchical fields
    parent_location_id: Optional[UUID] = None
    
    # Management fields
    manager_user_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format."""
        if v:
            v = v.strip().lower()
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError("Invalid email format")
        return v
    
    @field_validator('contact_number')
    @classmethod
    def validate_contact_number(cls, v: Optional[str]) -> Optional[str]:
        """Validate contact number format."""
        if v:
            v = v.strip()
            phone_pattern = r'^[\+]?[0-9\s\-\(\)\.ext]+$'
            if not re.match(phone_pattern, v, re.IGNORECASE):
                raise ValueError("Invalid phone number format")
        return v
    
    @field_validator('website')
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize website URL."""
        if v:
            v = v.strip().lower()
            if not v.startswith(('http://', 'https://')):
                v = f'https://{v}'
            
            url_pattern = r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$'
            if not re.match(url_pattern, v):
                raise ValueError("Invalid website URL format")
        return v
    
    @model_validator(mode='after')
    def validate_coordinates(self) -> 'LocationUpdate':
        """Validate that both coordinates are provided if any."""
        if self.latitude is not None or self.longitude is not None:
            if (self.latitude is None) != (self.longitude is None):
                raise ValueError("Both latitude and longitude must be provided together")
        return self


class LocationResponse(BaseModel):
    """Schema for location response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    location_code: str
    location_name: str
    location_type: str
    
    # Address fields
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Contact fields
    contact_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    
    # Geographic fields
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    timezone: str = "UTC"
    
    # Operational fields
    operating_hours: Optional[Dict[str, Any]] = None
    capacity: Optional[int] = None
    is_default: bool = False
    is_active: bool = True
    
    # Hierarchical fields
    parent_location_id: Optional[UUID] = None
    
    # Management fields
    manager_user_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None
    
    # Audit fields
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    # Computed fields
    full_address: Optional[str] = None
    display_name: Optional[str] = None
    location_type_display: Optional[str] = None
    has_coordinates: bool = False
    
    @model_validator(mode='after')
    def compute_fields(self) -> 'LocationResponse':
        """Compute derived fields."""
        # Compute full address
        address_parts = []
        if self.address:
            address_parts.append(self.address)
        if self.city:
            address_parts.append(self.city)
        if self.state:
            address_parts.append(self.state)
        if self.postal_code:
            address_parts.append(self.postal_code)
        if self.country:
            address_parts.append(self.country)
        self.full_address = ", ".join(address_parts) if address_parts else None
        
        # Compute display name
        self.display_name = f"{self.location_name} ({self.location_code})"
        
        # Compute location type display
        type_display = {
            "STORE": "Store",
            "WAREHOUSE": "Warehouse",
            "SERVICE_CENTER": "Service Center",
            "DISTRIBUTION_CENTER": "Distribution Center",
            "OFFICE": "Office"
        }
        self.location_type_display = type_display.get(self.location_type, self.location_type)
        
        # Check if has coordinates
        self.has_coordinates = self.latitude is not None and self.longitude is not None
        
        return self


class LocationWithChildren(LocationResponse):
    """Schema for location with children."""
    child_locations: List['LocationResponse'] = Field(default_factory=list)


class LocationStatistics(BaseModel):
    """Schema for location statistics."""
    total_locations: int = Field(..., description="Total number of locations")
    active_locations: int = Field(..., description="Number of active locations")
    locations_by_type: Dict[str, int] = Field(..., description="Count by location type")
    locations_by_country: Dict[str, int] = Field(..., description="Count by country")
    locations_by_state: Dict[str, int] = Field(..., description="Count by state")
    default_location_id: Optional[UUID] = Field(None, description="Default location ID")
    
    # Capacity statistics
    total_capacity: Optional[int] = Field(None, description="Total capacity across all locations")
    average_capacity: Optional[float] = Field(None, description="Average capacity per location")
    
    # Geographic statistics
    locations_with_coordinates: int = Field(0, description="Locations with GPS coordinates")
    

class LocationSearch(BaseModel):
    """Schema for location search parameters."""
    search_term: Optional[str] = Field(None, min_length=2, description="Search term")
    location_type: Optional[LocationTypeEnum] = Field(None, description="Filter by type")
    city: Optional[str] = Field(None, description="Filter by city")
    state: Optional[str] = Field(None, description="Filter by state")
    country: Optional[str] = Field(None, description="Filter by country")
    is_active: Optional[bool] = Field(True, description="Filter by active status")
    is_default: Optional[bool] = Field(None, description="Filter by default status")
    has_coordinates: Optional[bool] = Field(None, description="Filter by coordinate availability")
    parent_location_id: Optional[UUID] = Field(None, description="Filter by parent location")
    
    # Pagination
    skip: int = Field(0, ge=0, description="Number of records to skip")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of records to return")
    
    # Sorting
    sort_by: str = Field("location_name", description="Field to sort by")
    sort_order: str = Field("asc", pattern="^(asc|desc)$", description="Sort order")


class LocationNearby(BaseModel):
    """Schema for finding nearby locations."""
    latitude: Decimal = Field(..., ge=-90, le=90, description="Reference latitude")
    longitude: Decimal = Field(..., ge=-180, le=180, description="Reference longitude")
    radius_km: float = Field(10.0, gt=0, le=1000, description="Search radius in kilometers")
    location_type: Optional[LocationTypeEnum] = Field(None, description="Filter by type")
    limit: int = Field(10, ge=1, le=100, description="Maximum results to return")


class LocationBulkCreate(BaseModel):
    """Schema for bulk location creation."""
    locations: List[LocationCreate] = Field(..., min_length=1, max_length=1000)
    skip_duplicates: bool = Field(True, description="Skip locations with duplicate codes")
    
    @field_validator('locations')
    @classmethod
    def validate_unique_codes(cls, v: List[LocationCreate]) -> List[LocationCreate]:
        """Ensure location codes are unique within the batch."""
        codes = [loc.location_code for loc in v]
        if len(codes) != len(set(codes)):
            raise ValueError("Duplicate location codes found in batch")
        return v


class LocationBulkUpdate(BaseModel):
    """Schema for bulk location updates."""
    location_ids: List[UUID] = Field(..., min_length=1, max_length=100)
    update_data: LocationUpdate = Field(..., description="Update data to apply")


class LocationCapacityUpdate(BaseModel):
    """Schema for updating location capacity."""
    capacity: int = Field(..., ge=0, description="New capacity value")
    notes: Optional[str] = Field(None, max_length=500, description="Notes about the update")