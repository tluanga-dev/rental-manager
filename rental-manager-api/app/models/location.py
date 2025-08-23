"""
Location model for managing physical locations in the rental system.

This module defines the Location model with enhanced features including:
- Hierarchical location support
- Geospatial coordinates
- Operating hours management
- Capacity tracking
- Comprehensive validation
"""

from enum import Enum
from typing import Optional, TYPE_CHECKING, Dict, Any
from decimal import Decimal
from sqlalchemy import (
    Column, String, Text, ForeignKey, Index, Integer, 
    Boolean, Numeric, JSON, Enum as SQLEnum, CheckConstraint
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID
import re
import uuid

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.transaction import TransactionHeader, TransactionLine



class LocationType(str, Enum):
    """Location type enumeration."""
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"
    SERVICE_CENTER = "SERVICE_CENTER"
    DISTRIBUTION_CENTER = "DISTRIBUTION_CENTER"
    OFFICE = "OFFICE"


class Location(Base):
    """
    Location model representing physical locations with enhanced features.
    
    Attributes:
        Core Fields:
            location_code: Unique code for the location
            location_name: Name of the location
            location_type: Type of location (STORE, WAREHOUSE, etc.)
        
        Address Fields:
            address: Street address
            city: City
            state: State/Province
            country: Country
            postal_code: Postal/ZIP code
        
        Contact Fields:
            contact_number: Phone number
            email: Email address
            website: Website URL
        
        Geographic Fields:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            timezone: Timezone identifier
        
        Operational Fields:
            operating_hours: JSON structure for business hours
            capacity: Storage/operational capacity
            is_default: Default location flag
            is_active: Active status flag
        
        Hierarchical Fields:
            parent_location_id: Parent location for hierarchy
            parent_location: Parent location relationship
            child_locations: Child locations relationship
        
        Management Fields:
            location_metadata: Flexible JSON field for additional data
    """
    
    __tablename__ = "locations"
    
    
    # Core fields
    location_code = Column(
        String(20), 
        nullable=False, 
        unique=True, 
        index=True, 
        comment="Unique location code"
    )
    location_name = Column(
        String(100), 
        nullable=False, 
        index=True,
        comment="Location name"
    )
    location_type = Column(
        SQLEnum(LocationType), 
        nullable=False, 
        index=True,
        comment="Location type"
    )
    
    # Address fields
    address = Column(Text, nullable=True, comment="Street address")
    city = Column(String(100), nullable=True, index=True, comment="City")
    state = Column(String(100), nullable=True, index=True, comment="State/Province")
    country = Column(String(100), nullable=True, index=True, comment="Country")
    postal_code = Column(String(20), nullable=True, comment="Postal/ZIP code")
    
    # Contact fields
    contact_number = Column(String(30), nullable=True, comment="Phone number")
    email = Column(String(255), nullable=True, comment="Email address")
    website = Column(String(255), nullable=True, comment="Website URL")
    
    # Geographic fields
    latitude = Column(
        Numeric(10, 8), 
        nullable=True, 
        comment="Latitude coordinate"
    )
    longitude = Column(
        Numeric(11, 8), 
        nullable=True, 
        comment="Longitude coordinate"
    )
    timezone = Column(
        String(50), 
        nullable=False, 
        default='UTC', 
        comment="Timezone identifier"
    )
    
    # Operational fields
    operating_hours = Column(
        JSON, 
        nullable=True, 
        comment="Operating hours in JSON format"
    )
    capacity = Column(
        Integer, 
        nullable=True, 
        comment="Storage/operational capacity"
    )
    is_default = Column(
        Boolean, 
        nullable=False, 
        default=False, 
        comment="Default location flag"
    )
    
    # Hierarchical fields
    parent_location_id = Column(
        UUID(as_uuid=True), 
        ForeignKey('locations.id', ondelete='SET NULL'), 
        nullable=True,
        index=True,
        comment="Parent location ID for hierarchy"
    )
    
    
    # Flexible metadata
    location_metadata = Column(
        JSON, 
        nullable=True, 
        comment="Additional metadata in JSON format",
        name="metadata"
    )
    
    # Relationships
    transactions = relationship("TransactionHeader", back_populates="location", lazy="dynamic")
    transaction_lines = relationship("TransactionLine", back_populates="location", lazy="dynamic")
    stock_movements = relationship("StockMovement", back_populates="location", lazy="dynamic")
    stock_levels = relationship("StockLevel", back_populates="location", lazy="select")
    inventory_units = relationship("InventoryUnit", back_populates="location", lazy="select",
                                   foreign_keys="InventoryUnit.location_id")
    parent_location = relationship(
        "Location", 
        remote_side="Location.id", 
        backref="child_locations",
        foreign_keys=[parent_location_id]
    )
    
    # Table constraints and indexes
    __table_args__ = (
        CheckConstraint('capacity >= 0', name='check_capacity_positive'),
        CheckConstraint(
            "location_type IN ('STORE', 'WAREHOUSE', 'SERVICE_CENTER', 'DISTRIBUTION_CENTER', 'OFFICE')",
            name='check_location_type'
        ),
        Index('idx_location_code', 'location_code'),
        Index('idx_location_name', 'location_name'),
        Index('idx_location_type', 'location_type'),
        Index('idx_location_city_state', 'city', 'state'),
        Index('idx_location_country', 'country'),
        Index('idx_location_active', 'is_active'),
        Index('idx_location_default', 'is_default'),
        Index('idx_location_parent', 'parent_location_id'),
        Index('idx_location_coordinates', 'latitude', 'longitude'),
    )
    
    # Validation methods
    @validates('location_code')
    def validate_location_code(self, key: str, value: str) -> str:
        """Validate location code."""
        if not value or not value.strip():
            raise ValueError("Location code cannot be empty")
        if len(value) > 20:
            raise ValueError("Location code cannot exceed 20 characters")
        # Convert to uppercase for consistency
        return value.strip().upper()
    
    @validates('location_name')
    def validate_location_name(self, key: str, value: str) -> str:
        """Validate location name."""
        if not value or not value.strip():
            raise ValueError("Location name cannot be empty")
        if len(value) > 100:
            raise ValueError("Location name cannot exceed 100 characters")
        return value.strip()
    
    @validates('email')
    def validate_email(self, key: str, value: Optional[str]) -> Optional[str]:
        """Validate email format."""
        if value:
            value = value.strip().lower()
            if len(value) > 255:
                raise ValueError("Email cannot exceed 255 characters")
            
            # Basic email validation regex
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, value):
                raise ValueError(f"Invalid email format: {value}")
        return value
    
    @validates('contact_number')
    def validate_contact_number(self, key: str, value: Optional[str]) -> Optional[str]:
        """Validate contact number format."""
        if value:
            value = value.strip()
            if len(value) > 30:
                raise ValueError("Contact number cannot exceed 30 characters")
            
            # Basic phone validation (digits, spaces, hyphens, parentheses, plus)
            phone_pattern = r'^[\+]?[0-9\s\-\(\)\.ext]+$'
            if not re.match(phone_pattern, value, re.IGNORECASE):
                raise ValueError(f"Invalid contact number format: {value}")
        return value
    
    @validates('website')
    def validate_website(self, key: str, value: Optional[str]) -> Optional[str]:
        """Validate website URL format."""
        if value:
            value = value.strip().lower()
            if len(value) > 255:
                raise ValueError("Website URL cannot exceed 255 characters")
            
            # Basic URL validation
            url_pattern = r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$'
            if not re.match(url_pattern, value):
                # Allow URLs without protocol
                if not re.match(r'^[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$', value):
                    raise ValueError(f"Invalid website URL format: {value}")
                value = f"https://{value}"
        return value
    
    @validates('latitude')
    def validate_latitude(self, key: str, value: Optional[Decimal]) -> Optional[Decimal]:
        """Validate latitude coordinate."""
        if value is not None:
            if value < -90 or value > 90:
                raise ValueError("Latitude must be between -90 and 90")
        return value
    
    @validates('longitude')
    def validate_longitude(self, key: str, value: Optional[Decimal]) -> Optional[Decimal]:
        """Validate longitude coordinate."""
        if value is not None:
            if value < -180 or value > 180:
                raise ValueError("Longitude must be between -180 and 180")
        return value
    
    @validates('capacity')
    def validate_capacity(self, key: str, value: Optional[int]) -> Optional[int]:
        """Validate capacity value."""
        if value is not None and value < 0:
            raise ValueError("Capacity cannot be negative")
        return value
    
    @validates('postal_code')
    def validate_postal_code(self, key: str, value: Optional[str]) -> Optional[str]:
        """Validate postal code."""
        if value:
            value = value.strip().upper()
            if len(value) > 20:
                raise ValueError("Postal code cannot exceed 20 characters")
        return value
    
    # Utility methods
    def get_full_address(self) -> str:
        """Get the full formatted address."""
        parts = []
        if self.address:
            parts.append(self.address)
        if self.city:
            parts.append(self.city)
        if self.state:
            parts.append(self.state)
        if self.postal_code:
            parts.append(self.postal_code)
        if self.country:
            parts.append(self.country)
        return ", ".join(parts) if parts else "No address provided"
    
    def get_short_address(self) -> str:
        """Get short address (city, state, country)."""
        parts = []
        if self.city:
            parts.append(self.city)
        if self.state:
            parts.append(self.state)
        if self.country:
            parts.append(self.country)
        return ", ".join(parts) if parts else "No address"
    
    def get_coordinates(self) -> Optional[tuple]:
        """Get location coordinates as tuple."""
        if self.latitude is not None and self.longitude is not None:
            return (float(self.latitude), float(self.longitude))
        return None
    
    def has_coordinates(self) -> bool:
        """Check if location has geographic coordinates."""
        return self.latitude is not None and self.longitude is not None
    
    def is_store(self) -> bool:
        """Check if location is a store."""
        return self.location_type == LocationType.STORE
    
    def is_warehouse(self) -> bool:
        """Check if location is a warehouse."""
        return self.location_type == LocationType.WAREHOUSE
    
    def is_service_center(self) -> bool:
        """Check if location is a service center."""
        return self.location_type == LocationType.SERVICE_CENTER
    
    def is_distribution_center(self) -> bool:
        """Check if location is a distribution center."""
        return self.location_type == LocationType.DISTRIBUTION_CENTER
    
    def is_office(self) -> bool:
        """Check if location is an office."""
        return self.location_type == LocationType.OFFICE
    
    def has_children(self) -> bool:
        """Check if location has child locations."""
        return len(self.child_locations) > 0 if self.child_locations else False
    
    def get_hierarchy_level(self) -> int:
        """Get the hierarchy level of this location."""
        level = 0
        current = self.parent_location
        while current:
            level += 1
            current = current.parent_location
        return level
    
    def get_root_location(self) -> 'Location':
        """Get the root location in the hierarchy."""
        current = self
        while current.parent_location:
            current = current.parent_location
        return current
    
    def get_all_children(self, include_inactive: bool = False) -> list:
        """Get all child locations recursively."""
        children = []
        for child in self.child_locations:
            if include_inactive or child.is_active:
                children.append(child)
                children.extend(child.get_all_children(include_inactive))
        return children
    
    def update_operating_hours(self, operating_hours: Dict[str, Any]) -> None:
        """Update operating hours."""
        # Validate operating hours structure
        valid_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for day in operating_hours.keys():
            if day.lower() not in valid_days:
                raise ValueError(f"Invalid day: {day}")
        self.operating_hours = operating_hours
    
    def set_as_default(self) -> None:
        """Set this location as the default location."""
        self.is_default = True
    
    def activate(self) -> None:
        """Activate the location."""
        self.restore()
    
    def deactivate(self) -> None:
        """Deactivate the location."""
        self.soft_delete()
        self.is_default = False  # Cannot be default if inactive
    
    @property
    def display_name(self) -> str:
        """Get display name for the location."""
        return f"{self.location_name} ({self.location_code})"
    
    @property
    def location_type_display(self) -> str:
        """Get human-readable location type."""
        type_display = {
            LocationType.STORE: "Store",
            LocationType.WAREHOUSE: "Warehouse",
            LocationType.SERVICE_CENTER: "Service Center",
            LocationType.DISTRIBUTION_CENTER: "Distribution Center",
            LocationType.OFFICE: "Office"
        }
        return type_display.get(self.location_type, self.location_type.value)
    
    def __str__(self) -> str:
        """String representation of location."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of location."""
        return (
            f"<Location(id={self.id}, code='{self.location_code}', "
            f"name='{self.location_name}', type='{self.location_type.value}', "
            f"city='{self.city}', active={self.is_active})>"
        )