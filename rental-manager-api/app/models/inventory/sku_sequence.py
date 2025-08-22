"""
SKU Sequence Model - SKU generation and tracking.

This model manages sequential SKU generation for inventory units,
supporting different numbering schemes based on brand and category.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Integer, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.db.base import RentalManagerBaseModel

if TYPE_CHECKING:
    from app.models.brand import Brand
    from app.models.category import Category


class SKUSequence(RentalManagerBaseModel):
    """
    Generator bookkeeping for SKU codes.
    
    This model provides:
    - Sequential SKU generation per brand/category
    - Thread-safe sequence incrementing
    - Customizable SKU formats
    - Automatic padding and formatting
    """
    __tablename__ = "sku_sequences"
    
    # Categorization (optional - can have global sequences too)
    brand_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("brands.id", name="fk_sku_sequence_brand"),
        nullable=True,
        comment="Brand for this sequence (optional)"
    )
    
    category_id = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("categories.id", name="fk_sku_sequence_category"),
        nullable=True,
        comment="Category for this sequence (optional)"
    )
    
    # Sequence configuration
    prefix = Column(
        String(20),
        nullable=True,
        comment="Prefix for generated SKUs"
    )
    
    suffix = Column(
        String(20),
        nullable=True,
        comment="Suffix for generated SKUs"
    )
    
    next_sequence = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Next sequence number to use"
    )
    
    padding_length = Column(
        Integer,
        nullable=False,
        default=4,
        comment="Number of digits to pad sequence to"
    )
    
    # Format template (e.g., "{prefix}-{category}-{sequence:04d}")
    format_template = Column(
        String(100),
        nullable=True,
        comment="Python format string for SKU generation"
    )
    
    # Tracking
    last_generated_sku = Column(
        String(50),
        nullable=True,
        comment="Last SKU generated from this sequence"
    )
    
    last_generated_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the last SKU was generated"
    )
    
    total_generated = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Total SKUs generated from this sequence"
    )
    
    # Configuration
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Whether this sequence is active"
    )
    
    description = Column(
        String(200),
        nullable=True,
        comment="Description of this sequence"
    )
    
    # For optimistic locking during concurrent generation
    version = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Version for optimistic locking"
    )
    
    # Relationships
    brand = relationship(
        "Brand",
        back_populates="sku_sequences",
        lazy="select"
    )
    
    category = relationship(
        "Category",
        back_populates="sku_sequences",
        lazy="select"
    )
    
    __table_args__ = (
        # Unique constraint - only one sequence per brand/category combination
        UniqueConstraint(
            "brand_id", "category_id",
            name="uq_sku_sequence_brand_category"
        ),
        
        # Indexes
        Index("idx_sku_sequence_brand", "brand_id"),
        Index("idx_sku_sequence_category", "category_id"),
        Index("idx_sku_sequence_active", "is_active"),
        Index("idx_sku_sequence_next", "next_sequence"),
        
        # Constraints
        CheckConstraint(
            "next_sequence > 0",
            name="check_next_sequence_positive"
        ),
        CheckConstraint(
            "padding_length >= 0 AND padding_length <= 10",
            name="check_padding_length_range"
        ),
        CheckConstraint(
            "total_generated >= 0",
            name="check_total_generated_non_negative"
        ),
    )
    
    def __init__(
        self,
        *,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        prefix: Optional[str] = None,
        suffix: Optional[str] = None,
        next_sequence: int = 1,
        padding_length: int = 4,
        format_template: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.brand_id = brand_id
        self.category_id = category_id
        self.prefix = prefix.upper().strip() if prefix else None
        self.suffix = suffix.upper().strip() if suffix else None
        self.next_sequence = next_sequence
        self.padding_length = padding_length
        self.format_template = format_template
        self.description = description
    
    def validate(self) -> None:
        """Validate sequence configuration."""
        if self.next_sequence < 1:
            raise ValueError("Next sequence must be positive")
        
        if self.padding_length < 0 or self.padding_length > 10:
            raise ValueError("Padding length must be between 0 and 10")
        
        if self.prefix and len(self.prefix) > 20:
            raise ValueError("Prefix too long (max 20 characters)")
        
        if self.suffix and len(self.suffix) > 20:
            raise ValueError("Suffix too long (max 20 characters)")
        
        if self.format_template and len(self.format_template) > 100:
            raise ValueError("Format template too long (max 100 characters)")
    
    def get_next_sequence_number(self) -> int:
        """Get the next sequence number without incrementing."""
        return self.next_sequence
    
    def increment_sequence(self) -> int:
        """
        Increment and return the current sequence number.
        
        Returns:
            The sequence number that was just used
        """
        current = self.next_sequence
        self.next_sequence += 1
        self.total_generated += 1
        self.version += 1
        return current
    
    def reset_sequence(self, new_value: int = 1) -> None:
        """
        Reset the sequence to a specific value.
        
        Args:
            new_value: The new starting sequence number
        """
        if new_value < 1:
            raise ValueError("Sequence value must be positive")
        
        self.next_sequence = new_value
        self.version += 1
    
    def generate_sku(
        self,
        *,
        brand_code: Optional[str] = None,
        category_code: Optional[str] = None,
        item_name: Optional[str] = None,
        custom_data: Optional[dict] = None
    ) -> str:
        """
        Generate a SKU using the current sequence.
        
        Args:
            brand_code: Brand code to include
            category_code: Category code to include
            item_name: Item name for abbreviation
            custom_data: Additional data for format template
            
        Returns:
            Generated SKU string
        """
        # Get and increment sequence
        sequence_num = self.increment_sequence()
        
        # If we have a format template, use it
        if self.format_template:
            format_data = {
                'prefix': self.prefix or '',
                'suffix': self.suffix or '',
                'sequence': sequence_num,
                'brand': brand_code or '',
                'category': category_code or '',
                'item': self._abbreviate_item_name(item_name) if item_name else '',
                'year': datetime.now().year,
                'month': datetime.now().month,
                'day': datetime.now().day,
            }
            
            # Add custom data if provided
            if custom_data:
                format_data.update(custom_data)
            
            try:
                sku = self.format_template.format(**format_data)
            except KeyError as e:
                # Fall back to default format if template fails
                sku = self._generate_default_sku(
                    sequence_num, brand_code, category_code, item_name
                )
        else:
            # Use default SKU generation
            sku = self._generate_default_sku(
                sequence_num, brand_code, category_code, item_name
            )
        
        # Update tracking
        self.last_generated_sku = sku
        self.last_generated_at = datetime.now(timezone.utc)
        
        return sku
    
    def _generate_default_sku(
        self,
        sequence_num: int,
        brand_code: Optional[str] = None,
        category_code: Optional[str] = None,
        item_name: Optional[str] = None
    ) -> str:
        """
        Generate SKU using default format.
        
        Default format: [PREFIX]-[BRAND]-[CATEGORY]-[ITEM]-[SEQUENCE][SUFFIX]
        """
        parts = []
        
        # Add prefix
        if self.prefix:
            parts.append(self.prefix)
        
        # Add brand code
        if brand_code:
            parts.append(brand_code.upper()[:4])
        
        # Add category code
        if category_code:
            parts.append(category_code.upper()[:4])
        
        # Add item abbreviation
        if item_name:
            parts.append(self._abbreviate_item_name(item_name))
        
        # Add padded sequence number
        if self.padding_length > 0:
            parts.append(str(sequence_num).zfill(self.padding_length))
        else:
            parts.append(str(sequence_num))
        
        # Join parts
        sku = "-".join(parts) if parts else f"SKU-{sequence_num:04d}"
        
        # Add suffix
        if self.suffix:
            sku = f"{sku}{self.suffix}"
        
        return sku
    
    def _abbreviate_item_name(self, item_name: str, max_length: int = 6) -> str:
        """
        Create an abbreviation from item name.
        
        Args:
            item_name: Full item name
            max_length: Maximum length of abbreviation
            
        Returns:
            Abbreviated item name
        """
        if not item_name:
            return ""
        
        # Remove special characters and split into words
        words = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in item_name).split()
        
        if not words:
            return ""
        
        if len(words) == 1:
            # Single word - take first characters
            return words[0][:max_length].upper()
        else:
            # Multiple words - take first letter of each word
            abbrev = ''.join(word[0] for word in words[:max_length] if word)
            return abbrev.upper()
    
    def can_generate(self) -> bool:
        """Check if this sequence can generate SKUs."""
        return self.is_active
    
    @classmethod
    def get_or_create_sequence(
        cls,
        session,
        *,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        prefix: Optional[str] = None,
        suffix: Optional[str] = None,
        padding_length: int = 4
    ) -> "SKUSequence":
        """
        Get existing sequence or create new one.
        
        This is typically implemented in the service/repository layer,
        but included here for reference.
        """
        from sqlalchemy import select
        
        # Try to find existing sequence
        stmt = select(cls).where(
            cls.brand_id == brand_id,
            cls.category_id == category_id
        )
        
        sequence = session.scalar(stmt)
        
        if not sequence:
            # Create new sequence
            sequence = cls(
                brand_id=brand_id,
                category_id=category_id,
                prefix=prefix,
                suffix=suffix,
                padding_length=padding_length,
                next_sequence=1
            )
            session.add(sequence)
            session.flush()
        
        return sequence
    
    @property
    def sequence_key(self) -> str:
        """Get a unique key for this sequence configuration."""
        brand_part = str(self.brand_id) if self.brand_id else "NONE"
        category_part = str(self.category_id) if self.category_id else "NONE"
        return f"{brand_part}-{category_part}"
    
    @property
    def display_name(self) -> str:
        """Get a display name for this sequence."""
        parts = []
        
        if self.description:
            return self.description
        
        if self.prefix:
            parts.append(f"Prefix: {self.prefix}")
        
        if self.brand:
            parts.append(f"Brand: {self.brand.name}")
        
        if self.category:
            parts.append(f"Category: {self.category.name}")
        
        if parts:
            return " | ".join(parts)
        else:
            return f"SKU Sequence #{self.id}"
    
    def __str__(self) -> str:
        return f"{self.display_name} (Next: {self.next_sequence})"
    
    def __repr__(self) -> str:
        return (
            f"<SKUSequence id={self.id} brand={self.brand_id} "
            f"category={self.category_id} next={self.next_sequence}>"
        )