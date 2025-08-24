from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Text, Index
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, NamedModelMixin, CodedModelMixin

if TYPE_CHECKING:
    from app.models.item import Item


class Brand(RentalManagerBaseModel, NamedModelMixin):
    """
    Brand model for product brands.
    
    Attributes:
        name: Brand name (from NamedModelMixin)
        code: Unique brand code (optional)
        description: Brand description
        items: Related items under this brand (future relationship)
    """
    
    __tablename__ = "brands"
    
    # Override name from mixin to include unique constraint
    name = Column(String(100), nullable=False, unique=True, index=True, comment="Brand name")
    code = Column(String(20), nullable=True, unique=True, index=True, comment="Unique brand code")
    description = Column(Text, nullable=True, comment="Brand description")
    
    # Relationship to items
    items = relationship("Item", back_populates="brand", lazy="select")
    sku_sequences = relationship("SKUSequence", back_populates="brand", lazy="dynamic")
    
    # Additional indexes for performance
    __table_args__ = (
        Index('idx_brand_name_active', 'name', 'is_active'),
        Index('idx_brand_code_active', 'code', 'is_active'),
    )
    
    def __init__(
        self,
        name: str,
        code: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize a Brand.
        
        Args:
            name: Brand name
            code: Optional unique brand code
            description: Optional brand description
            **kwargs: Additional BaseModel fields
        """
        # Ensure is_active defaults to True if not specified
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
            
        super().__init__(**kwargs)
        self.name = name
        self.code = code
        self.description = description
        self._validate()
    
    def _validate(self):
        """Validate brand business rules."""
        # Name validation
        if not self.name or not self.name.strip():
            raise ValueError("Brand name cannot be empty")
        
        if len(self.name) > 100:
            raise ValueError("Brand name cannot exceed 100 characters")
        
        # Code validation
        if self.code:
            if not self.code.strip():
                raise ValueError("Brand code cannot be empty if provided")
            
            if len(self.code) > 20:
                raise ValueError("Brand code cannot exceed 20 characters")
            
            # Brand code should be uppercase alphanumeric with hyphens/underscores
            if not self.code.replace("-", "").replace("_", "").isalnum():
                raise ValueError("Brand code must contain only letters, numbers, hyphens, and underscores")
            
            # Auto-uppercase the code
            self.code = self.code.upper()
        
        # Description validation
        if self.description and len(self.description) > 1000:
            raise ValueError("Brand description cannot exceed 1000 characters")
    
    def update_info(
        self,
        name: Optional[str] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
        updated_by: Optional[str] = None
    ):
        """
        Update brand information.
        
        Args:
            name: New brand name
            code: New brand code
            description: New description
            updated_by: User making the update
        """
        if name is not None:
            if not name or not name.strip():
                raise ValueError("Brand name cannot be empty")
            if len(name) > 100:
                raise ValueError("Brand name cannot exceed 100 characters")
            self.name = name.strip()
        
        if code is not None:
            if code and not code.strip():
                raise ValueError("Brand code cannot be empty if provided")
            if code and len(code) > 20:
                raise ValueError("Brand code cannot exceed 20 characters")
            if code and not code.replace("-", "").replace("_", "").isalnum():
                raise ValueError("Brand code must contain only letters, numbers, hyphens, and underscores")
            self.code = code.upper().strip() if code else None
        
        if description is not None:
            if description and len(description) > 1000:
                raise ValueError("Brand description cannot exceed 1000 characters")
            self.description = description.strip() if description else None
        
        self.updated_by = updated_by
    
    @property
    def display_name(self) -> str:
        """Get display name for the brand."""
        if self.code:
            return f"{self.name} ({self.code})"
        return self.name
    
    @property
    def has_items(self) -> bool:
        """Check if brand has associated items."""
        return bool(self.items)
    
    def can_delete(self) -> bool:
        """Check if brand can be deleted."""
        # Can only delete if no items are associated
        return not self.has_items and self.is_active
    
    def __str__(self) -> str:
        """String representation of brand."""
        return self.display_name
    
    def __repr__(self) -> str:
        """Developer representation of brand."""
        return f"<Brand(id={self.id}, name='{self.name}', code='{self.code}', active={self.is_active})>"