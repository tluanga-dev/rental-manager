from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.db.base import RentalManagerBaseModel, UUIDType

if TYPE_CHECKING:
    from app.models.item import Item


class Category(RentalManagerBaseModel):
    """
    Category model with hierarchical support.
    
    Attributes:
        name: Category name
        category_code: Unique category code (max 15 chars)
        parent_category_id: UUID of parent category (None for root categories)
        category_path: Full path like "Electronics/Computers/Laptops"
        category_level: Hierarchy level (1=root, 2=sub, etc.)
        display_order: Sort order within parent
        is_leaf: True if category has no children
    """
    
    __tablename__ = "categories"
    
    name = Column(String(100), nullable=False, comment="Category name")
    category_code = Column(String(15), nullable=False, unique=True, index=True, comment="Unique category code (max 15 chars)")
    parent_category_id = Column(UUIDType(as_uuid=True), ForeignKey("categories.id"), nullable=True, comment="Parent category ID")
    category_path = Column(String(500), nullable=False, index=True, comment="Full category path")
    category_level = Column(Integer, nullable=False, default=1, comment="Hierarchy level")
    display_order = Column(Integer, nullable=False, default=0, comment="Display order within parent")
    is_leaf = Column(Boolean, nullable=False, default=True, comment="True if category has no children")
    
    # Self-referential relationships for hierarchy
    parent = relationship("Category", remote_side="Category.id", back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    
    # Relationship to items
    items = relationship("Item", back_populates="category", lazy="select")
    sku_sequences = relationship("SKUSequence", back_populates="category", lazy="dynamic")
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('idx_category_parent', 'parent_category_id'),
        Index('idx_category_path', 'category_path'),
        Index('idx_category_active_leaf', 'is_active', 'is_leaf'),
        Index('idx_category_level', 'category_level'),
        Index('idx_category_display_order', 'display_order'),
        Index('idx_category_parent_order', 'parent_category_id', 'display_order'),
        # Unique constraint: category name must be unique within parent
        Index('uk_category_name_parent', 'name', 'parent_category_id', unique=True),
    )
    
    def __init__(
        self,
        name: str,
        category_code: str,
        parent_category_id: Optional[str] = None,
        category_path: Optional[str] = None,
        category_level: int = 1,
        display_order: int = 0,
        is_leaf: bool = True,
        **kwargs
    ):
        """
        Initialize a Category.
        
        Args:
            name: Category name
            category_code: Unique category code (max 15 chars)
            parent_category_id: UUID of parent category (None for root categories)
            category_path: Full path like "Electronics/Computers/Laptops"
            category_level: Hierarchy level (1=root, 2=sub, etc.)
            display_order: Sort order within parent
            is_leaf: True if category has no children
            **kwargs: Additional BaseModel fields
        """
        super().__init__(**kwargs)
        self.name = name
        self.category_code = category_code
        self.parent_category_id = parent_category_id
        self.category_path = category_path or name
        self.category_level = category_level
        self.display_order = display_order
        self.is_leaf = is_leaf