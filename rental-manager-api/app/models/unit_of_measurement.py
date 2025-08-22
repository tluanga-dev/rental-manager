"""Unit of Measurement model for the rental manager system."""

from typing import Optional, TYPE_CHECKING, List
from sqlalchemy import Column, String, Text, Index
from sqlalchemy.orm import relationship, validates
from app.db.base import RentalManagerBaseModel

if TYPE_CHECKING:
    from app.models.item import Item


class UnitOfMeasurement(RentalManagerBaseModel):
    """
    Unit of measurement model for items in the inventory.
    
    Attributes:
        name: Unit name
        code: Unit code/abbreviation (e.g., "kg", "pcs", "m")
        description: Unit description
        items: Items using this unit
        is_active: Whether the unit is active (inherited from base)
    """
    
    __tablename__ = "unit_of_measurements"
    
    name = Column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
        comment="Unit name"
    )
    
    code = Column(
        String(10),
        nullable=True,
        unique=True,
        index=True,
        comment="Unit code/abbreviation"
    )
    
    description = Column(
        Text,
        nullable=True,
        comment="Unit description"
    )
    
    # Relationships
    items = relationship(
        "Item",
        back_populates="unit_of_measurement",
        lazy="select"
    )
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_uom_name_active', 'name', 'is_active'),
        Index('idx_uom_code_active', 'code', 'is_active'),
        Index('idx_uom_created_at', 'created_at'),
    )
    
    def __init__(
        self,
        name: str,
        code: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Unit of Measurement.
        
        Args:
            name: Unit name
            code: Unit code/abbreviation
            description: Unit description
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.name = name
        self.code = code
        self.description = description
        self._validate()
    
    def _validate(self):
        """Validate unit business rules."""
        # Name validation
        if not self.name or not self.name.strip():
            raise ValueError("Unit name cannot be empty")
        
        if len(self.name) > 50:
            raise ValueError("Unit name cannot exceed 50 characters")
        
        # Code validation
        if self.code:
            if not self.code.strip():
                raise ValueError("Unit code cannot be empty if provided")
            
            if len(self.code) > 10:
                raise ValueError("Unit code cannot exceed 10 characters")
        
        # Description validation
        if self.description and len(self.description) > 500:
            raise ValueError("Unit description cannot exceed 500 characters")
    
    @validates('name')
    def validate_name(self, key, value):
        """Validate unit name."""
        if not value or not value.strip():
            raise ValueError("Unit name cannot be empty")
        if len(value) > 50:
            raise ValueError("Unit name cannot exceed 50 characters")
        return value.strip()
    
    @validates('code')
    def validate_code(self, key, value):
        """Validate unit code."""
        if value is not None:
            if not value.strip():
                raise ValueError("Unit code cannot be empty if provided")
            if len(value) > 10:
                raise ValueError("Unit code cannot exceed 10 characters")
            return value.strip().upper()
        return value
    
    @validates('description')
    def validate_description(self, key, value):
        """Validate unit description."""
        if value is not None:
            if len(value) > 500:
                raise ValueError("Unit description cannot exceed 500 characters")
            return value.strip() if value.strip() else None
        return value
    
    def update_details(
        self,
        name: Optional[str] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """
        Update unit details.
        
        Args:
            name: New unit name
            code: New unit code
            description: New unit description
            updated_by: User making the update
        """
        if name is not None:
            if not name or not name.strip():
                raise ValueError("Unit name cannot be empty")
            if len(name) > 50:
                raise ValueError("Unit name cannot exceed 50 characters")
            self.name = name.strip()
        
        if code is not None:
            if code and not code.strip():
                raise ValueError("Unit code cannot be empty if provided")
            if code and len(code) > 10:
                raise ValueError("Unit code cannot exceed 10 characters")
            self.code = code.strip().upper() if code else None
        
        if description is not None:
            if description and len(description) > 500:
                raise ValueError("Unit description cannot exceed 500 characters")
            self.description = description.strip() if description else None
        
        if updated_by:
            self.updated_by = updated_by
    
    def has_items(self) -> bool:
        """Check if unit has associated items."""
        return bool(self.items)
    
    def can_delete(self) -> bool:
        """Check if unit can be deleted."""
        # Can only delete if no items are associated
        return not self.has_items() and self.is_active
    
    @property
    def display_name(self) -> str:
        """Get display name for the unit."""
        if self.code:
            return f"{self.name} ({self.code})"
        return self.name
    
    @property
    def item_count(self) -> int:
        """Get number of items using this unit."""
        return len(self.items) if self.items else 0
    
    def to_dict(self) -> dict:
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "is_active": self.is_active,
            "display_name": self.display_name,
            "item_count": self.item_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "updated_by": self.updated_by
        }
    
    def __str__(self) -> str:
        """String representation of unit."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of unit."""
        return (
            f"UnitOfMeasurement(id={self.id}, name='{self.name}', "
            f"code='{self.code}', active={self.is_active})"
        )