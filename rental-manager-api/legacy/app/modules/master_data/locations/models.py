from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Text, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship, validates
import re

from app.db.base import RentalManagerBaseModel, UUIDType
from app.core.postgres_enums import LocationTypeEnum

if TYPE_CHECKING:
    from app.modules.inventory.models import InventoryUnit, StockLevel


class LocationType(str, Enum):
    """Location type enumeration."""
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"
    SERVICE_CENTER = "SERVICE_CENTER"


class Location(RentalManagerBaseModel):
    """
    Location model representing physical locations.
    
    Attributes:
        location_code: Unique code for the location
        location_name: Name of the location
        location_type: Type of location (STORE, WAREHOUSE, SERVICE_CENTER)
        address: Street address
        city: City
        state: State/Province
        country: Country
        postal_code: Postal/ZIP code
        contact_number: Phone number
        email: Email address
        manager_user_id: UUID of the manager user
        inventory_units: Inventory units at this location
        stock_levels: Stock levels at this location
    """
    
    __tablename__ = "locations"
    
    location_code = Column(String(20), nullable=False, unique=True, index=True, comment="Unique location code")
    location_name = Column(String(100), nullable=False, comment="Location name")
    location_type = Column(LocationTypeEnum, nullable=False, comment="Location type")
    address = Column(Text, nullable=True, comment="Street address")
    city = Column(String(100), nullable=True, comment="City")
    state = Column(String(100), nullable=True, comment="State/Province")
    country = Column(String(100), nullable=True, comment="Country")
    postal_code = Column(String(20), nullable=True, comment="Postal/ZIP code")
    contact_number = Column(String(20), nullable=True, comment="Phone number")
    email = Column(String(255), nullable=True, comment="Email address")
    
    # Contact Person Fields - Temporarily disabled until DB migration completes successfully
    # contact_person_name = Column(String(255), nullable=True, comment="Primary contact person name")
    # contact_person_title = Column(String(100), nullable=True, comment="Contact person job title")
    # contact_person_phone = Column(String(20), nullable=True, comment="Contact person phone number")
    # contact_person_email = Column(String(255), nullable=True, comment="Contact person email address")
    # contact_person_notes = Column(Text, nullable=True, comment="Additional notes about contact person")
    
    manager_user_id = Column(UUIDType(), nullable=True, comment="Manager user ID")

    # Relationships (inventory and stock records point TO locations, not the other way around)
    # Re-enabled relationships with proper imports
    inventory_units = relationship("InventoryUnit", back_populates="location", lazy="select")
    stock_levels = relationship("StockLevel", back_populates="location", lazy="select")
    stock_movements = relationship("StockMovement", back_populates="location", lazy="select")
  
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_location_code', 'location_code'),
        Index('idx_location_name', 'location_name'),
        Index('idx_location_type', 'location_type'),
        Index('idx_location_city', 'city'),
        Index('idx_location_state', 'state'),
        Index('idx_location_country', 'country'),
        Index('idx_location_manager', 'manager_user_id'),

    )
    
    def __init__(
        self,
        location_code: str,
        location_name: str,
        location_type: LocationType,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        postal_code: Optional[str] = None,
        contact_number: Optional[str] = None,
        email: Optional[str] = None,
        # Contact person parameters temporarily disabled until DB migration completes
        # contact_person_name: Optional[str] = None,
        # contact_person_title: Optional[str] = None,
        # contact_person_phone: Optional[str] = None,
        # contact_person_email: Optional[str] = None,
        # contact_person_notes: Optional[str] = None,
        manager_user_id: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Location.
        
        Args:
            location_code: Unique code for the location
            location_name: Name of the location
            location_type: Type of location
            address: Street address
            city: City
            state: State/Province
            country: Country
            postal_code: Postal/ZIP code
            contact_number: Phone number
            email: Email address
            contact_person_name: Primary contact person name
            contact_person_title: Contact person job title
            contact_person_phone: Contact person phone number
            contact_person_email: Contact person email address
            contact_person_notes: Additional notes about contact person
            manager_user_id: Manager user ID
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.location_code = location_code
        self.location_name = location_name
        self.location_type = location_type
        self.address = address or ""  # Use empty string instead of None
        self.city = city or ""
        self.state = state or ""
        self.country = country or ""
        self.postal_code = postal_code or ""
        self.contact_number = contact_number or ""
        self.email = email or ""
        
        # Contact person fields temporarily disabled until DB migration completes
        # self.contact_person_name = contact_person_name or ""
        # self.contact_person_title = contact_person_title or ""
        # self.contact_person_phone = contact_person_phone or ""
        # self.contact_person_email = contact_person_email or ""
        # self.contact_person_notes = contact_person_notes or ""
        
        self.manager_user_id = manager_user_id
        self._validate()
    
    def _validate(self):
        """Validate location business rules."""
        # Code validation
        if not self.location_code or not self.location_code.strip():
            raise ValueError("Location code cannot be empty")
        
        if len(self.location_code) > 20:
            raise ValueError("Location code cannot exceed 20 characters")
        
        # Name validation
        if not self.location_name or not self.location_name.strip():
            raise ValueError("Location name cannot be empty")
        
        if len(self.location_name) > 100:
            raise ValueError("Location name cannot exceed 100 characters")
        
        # Type validation
        if self.location_type not in [lt.value for lt in LocationType]:
            raise ValueError(f"Invalid location type: {self.location_type}")
        
        # Address validation (optional)
        if self.address and len(self.address) > 500:
            raise ValueError("Address cannot exceed 500 characters")
        
        # City validation (optional)
        if self.city and len(self.city) > 100:
            raise ValueError("City cannot exceed 100 characters")
        
        # State validation (optional)
        if self.state and len(self.state) > 100:
            raise ValueError("State cannot exceed 100 characters")
        
        # Country validation (optional)
        if self.country and len(self.country) > 100:
            raise ValueError("Country cannot exceed 100 characters")
        
        # Postal code validation
        if self.postal_code and len(self.postal_code) > 20:
            raise ValueError("Postal code cannot exceed 20 characters")
        
        # Email validation
        if self.email:
            if len(self.email) > 255:
                raise ValueError("Email cannot exceed 255 characters")
            
            # Basic email format validation
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, self.email):
                raise ValueError("Invalid email format")
        
        # Contact number validation
        if self.contact_number:
            if len(self.contact_number) > 20:
                raise ValueError("Contact number cannot exceed 20 characters")
            
            # Basic phone number validation (digits, spaces, hyphens, parentheses, plus)
            phone_pattern = r'^[\+]?[0-9\s\-\(\)\.]+$'
            if not re.match(phone_pattern, self.contact_number):
                raise ValueError("Invalid contact number format")
    
    @validates('location_code')
    def validate_location_code(self, key, value):
        """Validate location code."""
        if not value or not value.strip():
            raise ValueError("Location code cannot be empty")
        if len(value) > 20:
            raise ValueError("Location code cannot exceed 20 characters")
        return value.strip().upper()
    
    @validates('location_name')
    def validate_location_name(self, key, value):
        """Validate location name."""
        if not value or not value.strip():
            raise ValueError("Location name cannot be empty")
        if len(value) > 100:
            raise ValueError("Location name cannot exceed 100 characters")
        return value.strip()
    
    @validates('location_type')
    def validate_location_type(self, key, value):
        """Validate location type."""
        if isinstance(value, LocationType):
            return value.value
        if value not in [lt.value for lt in LocationType]:
            raise ValueError(f"Invalid location type: {value}")
        return value
    
    @validates('email')
    def validate_email(self, key, value):
        """Validate email format."""
        if value:
            if len(value) > 255:
                raise ValueError("Email cannot exceed 255 characters")
            
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, value):
                raise ValueError("Invalid email format")
        return value
    
    @validates('contact_number')
    def validate_contact_number(self, key, value):
        """Validate contact number format."""
        if value:
            if len(value) > 20:
                raise ValueError("Contact number cannot exceed 20 characters")
            
            phone_pattern = r'^[\+]?[0-9\s\-\(\)\.]+$'
            if not re.match(phone_pattern, value):
                raise ValueError("Invalid contact number format")
        return value
    
    def update_details(
        self,
        location_name: Optional[str] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        postal_code: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """
        Update location details.
        
        Args:
            location_name: New location name
            address: New address
            city: New city
            state: New state
            country: New country
            postal_code: New postal code
            updated_by: User making the update
        """
        if location_name is not None:
            if not location_name or not location_name.strip():
                raise ValueError("Location name cannot be empty")
            if len(location_name) > 100:
                raise ValueError("Location name cannot exceed 100 characters")
            self.location_name = location_name.strip()
        
        if address is not None:
            if address and len(address) > 500:
                raise ValueError("Address cannot exceed 500 characters")
            self.address = address.strip() if address else None
        
        if city is not None:
            if city and len(city) > 100:
                raise ValueError("City cannot exceed 100 characters")
            self.city = city.strip() if city else None
        
        if state is not None:
            if state and len(state) > 100:
                raise ValueError("State cannot exceed 100 characters")
            self.state = state.strip() if state else None
        
        if country is not None:
            if country and len(country) > 100:
                raise ValueError("Country cannot exceed 100 characters")
            self.country = country.strip() if country else None
        
        if postal_code is not None:
            if postal_code and len(postal_code) > 20:
                raise ValueError("Postal code cannot exceed 20 characters")
            self.postal_code = postal_code.strip() if postal_code else None
        
        self.updated_by = updated_by
    
    def update_contact_info(
        self,
        contact_number: Optional[str] = None,
        email: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """
        Update location contact information.
        
        Args:
            contact_number: New contact number
            email: New email address
            updated_by: User making the update
        """
        if contact_number is not None:
            if contact_number:
                if len(contact_number) > 20:
                    raise ValueError("Contact number cannot exceed 20 characters")
                
                phone_pattern = r'^[\+]?[0-9\s\-\(\)\.]+$'
                if not re.match(phone_pattern, contact_number):
                    raise ValueError("Invalid contact number format")
            
            self.contact_number = contact_number.strip() if contact_number else None
        
        if email is not None:
            if email:
                if len(email) > 255:
                    raise ValueError("Email cannot exceed 255 characters")
                
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, email):
                    raise ValueError("Invalid email format")
            
            self.email = email.strip() if email else None
        
        self.updated_by = updated_by
    
    def update_contact_person(
        self,
        contact_person_name: Optional[str] = None,
        contact_person_title: Optional[str] = None,
        contact_person_phone: Optional[str] = None,
        contact_person_email: Optional[str] = None,
        contact_person_notes: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """
        Update contact person information.
        
        Args:
            contact_person_name: Contact person name
            contact_person_title: Contact person job title
            contact_person_phone: Contact person phone number
            contact_person_email: Contact person email address
            contact_person_notes: Additional notes about contact person
            updated_by: User making the update
        """
        if contact_person_name is not None:
            if contact_person_name and len(contact_person_name) > 255:
                raise ValueError("Contact person name cannot exceed 255 characters")
            self.contact_person_name = contact_person_name.strip() if contact_person_name else ""
        
        if contact_person_title is not None:
            if contact_person_title and len(contact_person_title) > 100:
                raise ValueError("Contact person title cannot exceed 100 characters")
            self.contact_person_title = contact_person_title.strip() if contact_person_title else ""
        
        if contact_person_phone is not None:
            if contact_person_phone:
                if len(contact_person_phone) > 20:
                    raise ValueError("Contact person phone cannot exceed 20 characters")
                
                phone_pattern = r'^[\+]?[0-9\s\-\(\)\.]+$'
                if not re.match(phone_pattern, contact_person_phone):
                    raise ValueError("Invalid contact person phone format")
            
            self.contact_person_phone = contact_person_phone.strip() if contact_person_phone else ""
        
        if contact_person_email is not None:
            if contact_person_email:
                if len(contact_person_email) > 255:
                    raise ValueError("Contact person email cannot exceed 255 characters")
                
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, contact_person_email):
                    raise ValueError("Invalid contact person email format")
            
            self.contact_person_email = contact_person_email.strip() if contact_person_email else ""
        
        if contact_person_notes is not None:
            self.contact_person_notes = contact_person_notes.strip() if contact_person_notes else ""
        
        self.updated_by = updated_by
    
    def assign_manager(self, manager_user_id: str, updated_by: Optional[str] = None):
        """
        Assign a manager to the location.
        
        Args:
            manager_user_id: Manager user ID
            updated_by: User making the update
        """
        self.manager_user_id = manager_user_id
        self.updated_by = updated_by
    
    def remove_manager(self, updated_by: Optional[str] = None):
        """
        Remove the manager from the location.
        
        Args:
            updated_by: User making the update
        """
        self.manager_user_id = None
        self.updated_by = updated_by
    
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
    
    def is_store(self) -> bool:
        """Check if location is a store."""
        return self.location_type == LocationType.STORE.value
    
    def is_warehouse(self) -> bool:
        """Check if location is a warehouse."""
        return self.location_type == LocationType.WAREHOUSE.value
    
    def is_service_center(self) -> bool:
        """Check if location is a service center."""
        return self.location_type == LocationType.SERVICE_CENTER.value
    
    def has_inventory(self) -> bool:
        """Check if location has inventory units."""
        # Temporarily disabled relationship - return False
        return False
    
    def has_stock(self) -> bool:
        """Check if location has stock levels."""
        # Temporarily disabled relationship - return False
        return False
    
    def can_delete(self) -> bool:
        """Check if location can be deleted."""
        # Can only delete if no inventory units or stock levels
        return (
            self.is_active and 
            not self.has_inventory() and 
            not self.has_stock()
        )
    
    def get_location_type_display(self) -> str:
        """Get display name for location type."""
        type_display = {
            LocationType.STORE.value: "Store",
            LocationType.WAREHOUSE.value: "Warehouse",
            LocationType.SERVICE_CENTER.value: "Service Center"
        }
        return type_display.get(self.location_type, self.location_type)
    
    @property
    def display_name(self) -> str:
        """Get display name for the location."""
        return f"{self.location_name} ({self.location_code})"
    
    @property
    def short_address(self) -> str:
        """Get short address (city, state, country)."""
        parts = []
        if self.city:
            parts.append(self.city)
        if self.state:
            parts.append(self.state)
        if self.country:
            parts.append(self.country)
        return ", ".join(parts) if parts else "No address provided"
    
    @property
    def inventory_count(self) -> int:
        """Get number of inventory units at this location."""
        # Temporarily disabled relationship - return 0
        return 0
    
    @property
    def stock_item_count(self) -> int:
        """Get number of stock items at this location."""
        # Temporarily disabled relationship - return 0
        return 0
    
    def __str__(self) -> str:
        """String representation of location."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of location."""
        return (
            f"Location(id={self.id}, code='{self.location_code}', "
            f"name='{self.location_name}', type='{self.location_type}', "
            f"city='{self.city}', active={self.is_active})"
        )