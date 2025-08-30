"""SKU Generator Service for automatic SKU generation based on categories."""

from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import re

from app.models.item import Item
from app.models.category import Category


class SKUGenerator:
    """Service for generating unique SKUs for items."""
    
    # Default SKU patterns
    DEFAULT_PATTERN = "ITEM-{counter:05d}"
    CATEGORY_PATTERN = "{category_code}-{counter:05d}"
    TIMESTAMP_PATTERN = "ITEM-{timestamp}-{counter:03d}"
    
    def __init__(self):
        """Initialize SKU generator."""
        pass
    
    async def generate_sku(
        self,
        session: AsyncSession,
        category_id: Optional[UUID] = None,
        pattern: Optional[str] = None,
        prefix: Optional[str] = None
    ) -> str:
        """Generate a unique SKU.
        
        Args:
            category_id: Optional category ID to use category-based generation
            pattern: Optional custom pattern for SKU generation
            prefix: Optional prefix for the SKU
            
        Returns:
            Generated unique SKU
        """
        if category_id:
            return await self._generate_category_based_sku(session, category_id, pattern)
        elif pattern:
            return await self._generate_custom_pattern_sku(session, pattern, prefix)
        else:
            return await self._generate_default_sku(session, prefix)
    
    async def generate_bulk_skus(
        self,
        session: AsyncSession,
        count: int,
        category_id: Optional[UUID] = None,
        pattern: Optional[str] = None,
        prefix: Optional[str] = None
    ) -> list[str]:
        """Generate multiple unique SKUs efficiently.
        
        Args:
            count: Number of SKUs to generate
            category_id: Optional category ID for category-based generation
            pattern: Optional custom pattern
            prefix: Optional prefix
            
        Returns:
            List of generated unique SKUs
        """
        skus = []
        for i in range(count):
            sku = await self.generate_sku(session, category_id, pattern, prefix)
            skus.append(sku)
        
        return skus
    
    async def _generate_category_based_sku(
        self,
        session: AsyncSession,
        category_id: UUID,
        pattern: Optional[str] = None
    ) -> str:
        """Generate SKU based on category information.
        
        Args:
            category_id: Category ID
            pattern: Optional custom pattern
            
        Returns:
            Generated SKU
        """
        # Get category information
        category = await self._get_category(session, category_id)
        if not category:
            # Fall back to default generation if category not found
            return await self._generate_default_sku(session)
        
        # Use category code or create one from name
        category_code = category.category_code or self._create_category_code(category.name)
        
        # Get next counter for this category
        next_counter = await self._get_next_category_counter(session, category_id)
        
        # Use provided pattern or default category pattern
        sku_pattern = pattern or self.CATEGORY_PATTERN
        
        # Generate SKU
        sku = sku_pattern.format(
            category_code=category_code,
            category_name=category.name,
            counter=next_counter,
            category_id=str(category_id)[:8].upper()
        )
        
        # Ensure uniqueness
        return await self._ensure_unique_sku(session, sku)
    
    async def _generate_default_sku(self, session: AsyncSession, prefix: Optional[str] = None) -> str:
        """Generate default SKU with sequential numbering.
        
        Args:
            session: Database session
            prefix: Optional prefix
            
        Returns:
            Generated SKU
        """
        # Get next counter
        next_counter = await self._get_next_global_counter(session)
        
        # Use prefix or default
        sku_prefix = prefix or "ITEM"
        
        # Generate SKU
        sku = f"{sku_prefix}-{next_counter:05d}"
        
        # Ensure uniqueness
        return await self._ensure_unique_sku(session, sku)
    
    async def _generate_custom_pattern_sku(
        self,
        session: AsyncSession,
        pattern: str,
        prefix: Optional[str] = None
    ) -> str:
        """Generate SKU using custom pattern.
        
        Args:
            session: Database session
            pattern: Custom pattern string
            prefix: Optional prefix
            
        Returns:
            Generated SKU
        """
        # Get current timestamp
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Get next counter
        next_counter = await self._get_next_global_counter(session)
        
        # Replace pattern placeholders
        sku = pattern.format(
            prefix=prefix or "ITEM",
            timestamp=timestamp,
            counter=next_counter,
            date=datetime.now().strftime("%Y%m%d"),
            time=datetime.now().strftime("%H%M%S"),
            year=datetime.now().year,
            month=datetime.now().month,
            day=datetime.now().day
        )
        
        # Ensure uniqueness
        return await self._ensure_unique_sku(session, sku)
    
    async def _generate_timestamp_sku(self, session: AsyncSession, prefix: Optional[str] = None) -> str:
        """Generate timestamp-based SKU.
        
        Args:
            session: Database session
            prefix: Optional prefix
            
        Returns:
            Generated SKU
        """
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        sku_prefix = prefix or "ITEM"
        
        # Generate base SKU
        base_sku = f"{sku_prefix}-{timestamp}"
        
        # Add counter if needed for uniqueness
        counter = 1
        sku = base_sku
        
        while await self._sku_exists(session, sku):
            sku = f"{base_sku}-{counter:03d}"
            counter += 1
        
        return sku
    
    async def _get_category(self, session: AsyncSession, category_id: UUID) -> Optional[Category]:
        """Get category by ID.
        
        Args:
            session: Database session
            category_id: Category ID
            
        Returns:
            Category model or None
        """
        query = select(Category).where(Category.id == category_id)
        result = await session.execute(query)
        return result.scalar_one_or_none()
    
    async def _get_next_category_counter(self, session: AsyncSession, category_id: UUID) -> int:
        """Get next counter value for a specific category.
        
        Args:
            session: Database session
            category_id: Category ID
            
        Returns:
            Next counter value
        """
        # Get the highest counter for items in this category
        query = select(
            func.count(Item.id).label("count")
        ).where(
            Item.category_id == category_id
        )
        
        result = await session.execute(query)
        current_count = result.scalar_one()
        
        return current_count + 1
    
    async def _get_next_global_counter(self, session: AsyncSession) -> int:
        """Get next global counter value.
        
        Args:
            session: Database session
            
        Returns:
            Next counter value
        """
        # Get total count of items
        query = select(func.count(Item.id))
        result = await session.execute(query)
        current_count = result.scalar_one()
        
        return current_count + 1
    
    async def _ensure_unique_sku(self, session: AsyncSession, sku: str) -> str:
        """Ensure SKU is unique by adding counter if needed.
        
        Args:
            session: Database session
            sku: Base SKU
            
        Returns:
            Unique SKU
        """
        if not await self._sku_exists(session, sku):
            return sku
        
        # Add counter to make it unique
        counter = 1
        base_sku = sku
        
        while await self._sku_exists(session, sku):
            sku = f"{base_sku}-{counter:03d}"
            counter += 1
            
            # Prevent infinite loops
            if counter > 999:
                # Use timestamp as additional uniqueness
                timestamp = datetime.now().strftime("%H%M%S")
                sku = f"{base_sku}-{timestamp}"
                break
        
        return sku
    
    async def _sku_exists(self, session: AsyncSession, sku: str) -> bool:
        """Check if SKU already exists.
        
        Args:
            session: Database session
            sku: SKU to check
            
        Returns:
            True if SKU exists
        """
        query = select(func.count()).select_from(Item).where(
            func.upper(Item.sku) == sku.upper()
        )
        result = await session.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    def _create_category_code(self, category_name: str) -> str:
        """Create a category code from category name.
        
        Args:
            category_name: Category name
            
        Returns:
            Generated category code
        """
        if not category_name:
            return "UNK"
        
        # Clean the name and take first few characters
        clean_name = re.sub(r'[^A-Za-z0-9]', '', category_name)
        
        if len(clean_name) >= 3:
            return clean_name[:4].upper()
        else:
            # Pad with numbers if too short
            return f"{clean_name.upper()}01"
    
    async def validate_sku_pattern(self, session: AsyncSession, pattern: str) -> Dict[str, Any]:
        """Validate a custom SKU pattern.
        
        Args:
            pattern: Pattern to validate
            
        Returns:
            Validation result with details
        """
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "sample_sku": None
        }
        
        # Check for required placeholders
        valid_placeholders = {
            "{counter}", "{timestamp}", "{prefix}", "{category_code}",
            "{category_name}", "{date}", "{time}", "{year}", "{month}", "{day}",
            "{category_id}"
        }
        
        # Find all placeholders in pattern
        placeholders = set(re.findall(r'\{[^}]+\}', pattern))
        
        # Check for invalid placeholders
        invalid_placeholders = placeholders - valid_placeholders
        if invalid_placeholders:
            validation_result["is_valid"] = False
            validation_result["errors"].append(
                f"Invalid placeholders: {', '.join(invalid_placeholders)}"
            )
        
        # Check pattern length
        if len(pattern) > 50:
            validation_result["warnings"].append(
                "Pattern is quite long, consider shorter format"
            )
        
        # Generate sample SKU if pattern is valid
        if validation_result["is_valid"]:
            try:
                sample_sku = pattern.format(
                    counter=1,
                    timestamp="20240101120000",
                    prefix="SAMPLE",
                    category_code="ELEC",
                    category_name="Electronics",
                    date="20240101",
                    time="120000",
                    year=2024,
                    month=1,
                    day=1,
                    category_id="12345678"
                )
                validation_result["sample_sku"] = sample_sku
            except Exception as e:
                validation_result["is_valid"] = False
                validation_result["errors"].append(f"Pattern formatting error: {str(e)}")
        
        return validation_result
    
    async def get_sku_statistics(self, session: AsyncSession) -> Dict[str, Any]:
        """Get statistics about existing SKUs.
        
        Args:
            session: Database session
            
        Returns:
            SKU statistics
        """
        # Get total SKU count
        total_query = select(func.count()).select_from(Item)
        total_result = await session.execute(total_query)
        total_skus = total_result.scalar_one()
        
        # Get SKU patterns (simplified analysis)
        pattern_query = select(
            func.substring(Item.sku, 1, 4).label("prefix"),
            func.count().label("count")
        ).group_by(
            func.substring(Item.sku, 1, 4)
        ).order_by(
            func.count().desc()
        ).limit(10)
        
        pattern_result = await session.execute(pattern_query)
        pattern_stats = [
            {"prefix": row.prefix, "count": row.count} 
            for row in pattern_result.fetchall()
        ]
        
        return {
            "total_skus": total_skus,
            "common_prefixes": pattern_stats,
            "last_generated": datetime.now().isoformat()
        }
    
    async def regenerate_sku(
        self,
        session: AsyncSession,
        item_id: UUID,
        new_category_id: Optional[UUID] = None,
        pattern: Optional[str] = None
    ) -> str:
        """Regenerate SKU for an existing item.
        
        Args:
            session: Database session
            item_id: Item ID to regenerate SKU for
            new_category_id: Optional new category ID
            pattern: Optional custom pattern
            
        Returns:
            New generated SKU
        """
        # Get existing item
        query = select(Item).where(Item.id == item_id)
        result = await session.execute(query)
        item = result.scalar_one_or_none()
        
        if not item:
            raise ValueError(f"Item with ID {item_id} not found")
        
        # Use new category or existing one
        category_id = new_category_id or item.category_id
        
        # Generate new SKU
        new_sku = await self.generate_sku(session, category_id, pattern)
        
        # Update item with new SKU
        item.sku = new_sku
        await session.commit()
        
        return new_sku
    
    async def batch_regenerate_skus(
        self,
        session: AsyncSession,
        item_ids: list[UUID],
        pattern: Optional[str] = None
    ) -> Dict[str, str]:
        """Regenerate SKUs for multiple items.
        
        Args:
            session: Database session
            item_ids: List of item IDs
            pattern: Optional custom pattern
            
        Returns:
            Dictionary mapping item_id to new_sku
        """
        results = {}
        
        for item_id in item_ids:
            try:
                new_sku = await self.regenerate_sku(session, item_id, pattern=pattern)
                results[str(item_id)] = new_sku
            except Exception as e:
                results[str(item_id)] = f"ERROR: {str(e)}"
        
        return results
    
    def get_available_patterns(self) -> Dict[str, str]:
        """Get available SKU patterns with descriptions.
        
        Returns:
            Dictionary of pattern names and descriptions
        """
        return {
            "default": "Default pattern: ITEM-{counter:05d}",
            "category": "Category-based: {category_code}-{counter:05d}",
            "timestamp": "Timestamp-based: ITEM-{timestamp}-{counter:03d}",
            "date_counter": "Date with counter: ITEM-{date}-{counter:04d}",
            "category_date": "Category with date: {category_code}-{date}-{counter:03d}",
            "hierarchical": "Hierarchical: {category_code}-{year}-{counter:04d}"
        }
    
    def get_pattern_by_name(self, pattern_name: str) -> str:
        """Get pattern string by name.
        
        Args:
            pattern_name: Name of the pattern
            
        Returns:
            Pattern string
        """
        patterns = {
            "default": "ITEM-{counter:05d}",
            "category": "{category_code}-{counter:05d}",
            "timestamp": "ITEM-{timestamp}-{counter:03d}",
            "date_counter": "ITEM-{date}-{counter:04d}",
            "category_date": "{category_code}-{date}-{counter:03d}",
            "hierarchical": "{category_code}-{year}-{counter:04d}"
        }
        
        return patterns.get(pattern_name, patterns["default"])