from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy import select, func, or_, and_, desc, asc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel, ConfigDict
from math import ceil

from .models import Category, CategoryPath
from app.shared.repository import BaseRepository


class PageInfo(BaseModel):
    """Pagination information."""

    total_items: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class PaginationResult(BaseModel):
    """Pagination result container."""

    items: List[Category]
    page_info: PageInfo

    model_config = ConfigDict(arbitrary_types_allowed=True)


class CategoryRepository(BaseRepository[Category]):
    """Repository for category data access operations."""

    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        super().__init__(Category, session)
    
    async def create(self, obj_data: Dict[str, Any]) -> Category:
        """Create a new category with proper handling of category_code."""
        # Ensure category_code is provided
        if 'category_code' not in obj_data or not obj_data['category_code']:
            raise ValueError("category_code is required for category creation")
        
        # Create category instance
        db_obj = Category(
            name=obj_data['name'],
            category_code=obj_data['category_code'],
            parent_category_id=obj_data.get('parent_category_id'),
            category_path=obj_data.get('category_path', obj_data['name']),
            category_level=obj_data.get('category_level', 1),
            display_order=obj_data.get('display_order', 0),
            is_leaf=obj_data.get('is_leaf', True),
            created_by=obj_data.get('created_by'),
            updated_by=obj_data.get('updated_by')
        )
        
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    # Methods inherited from BaseRepository:
    # - create(obj_data: Dict[str, Any]) -> Category
    # - get_by_id(id: UUID) -> Optional[Category]
    # - get_all(...) -> List[Category]
    # - update(id: UUID, obj_data: Dict[str, Any]) -> Optional[Category]
    # - delete(id: UUID) -> bool  (soft delete)
    # - count_all(...) -> int
    # - exists(id: UUID) -> bool
    # - search(...) -> List[Category]
    # - get_paginated(...) -> Dict[str, Any]

    # Category-specific methods

    async def get_by_code(self, category_code: str) -> Optional[Category]:
        """Get category by code."""
        return await self.get_by_field("category_code", category_code)

    async def get_by_slug(self, slug: str) -> Optional[Category]:
        """Get category by slug."""
        return await self.get_by_field("slug", slug)

    async def get_by_parent_id(self, parent_id: UUID) -> List[Category]:
        """Get all categories by parent ID."""
        query = select(Category).where(
            and_(
                Category.parent_category_id == parent_id,
                Category.is_active == True
            )
        ).order_by(asc(Category.display_order), asc(Category.name))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_root_categories(self) -> List[Category]:
        """Get all root categories (categories with no parent)."""
        query = select(Category).where(
            and_(
                Category.parent_category_id == None,
                Category.is_active == True
            )
        ).order_by(asc(Category.display_order), asc(Category.name))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_parent_categories(self) -> List[Category]:
        """Get all categories that can be parents (is_leaf = False).
        
        This includes both categories that currently have children and categories
        that are marked as non-leaf but don't currently have subcategories.
        
        Returns:
            List of non-leaf categories ordered by display_order and name
        """
        query = select(Category).where(
            and_(
                Category.is_leaf == False,
                Category.is_active == True
            )
        ).order_by(asc(Category.display_order), asc(Category.name))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_leaf_categories(self) -> List[Category]:
        """Get all leaf categories (is_leaf = True).
        
        Leaf categories are categories that cannot have subcategories
        and are typically used to contain items directly.
        
        Returns:
            List of leaf categories ordered by display_order and name
        """
        query = select(Category).where(
            and_(
                Category.is_leaf == True,
                Category.is_active == True
            )
        ).order_by(asc(Category.display_order), asc(Category.name))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_with_children(self, category_id: UUID) -> Optional[Category]:
        """Get category with its children loaded."""
        query = select(Category).options(
            selectinload(Category.children)
        ).where(Category.id == category_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_with_parent(self, category_id: UUID) -> Optional[Category]:
        """Get category with its parent loaded."""
        query = select(Category).options(
            selectinload(Category.parent)
        ).where(Category.id == category_id)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_full_tree(self) -> List[Category]:
        """Get all categories with parent-child relationships loaded."""
        query = select(Category).options(
            selectinload(Category.children),
            selectinload(Category.parent)
        ).where(Category.is_active == True)
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_ancestors(self, category_id: UUID) -> List[Category]:
        """Get all ancestors of a category (parent, grandparent, etc.)."""
        # Use recursive CTE
        cte_query = text("""
            WITH RECURSIVE ancestors AS (
                SELECT c.* 
                FROM categories c 
                WHERE c.id = :category_id
                
                UNION ALL
                
                SELECT c.* 
                FROM categories c 
                INNER JOIN ancestors a ON c.id = a.parent_category_id
            )
            SELECT * FROM ancestors WHERE id != :category_id ORDER BY level DESC;
        """)
        
        result = await self.session.execute(cte_query, {"category_id": str(category_id)})
        rows = result.fetchall()
        
        # Convert rows to Category objects
        categories = []
        for row in rows:
            category = await self.get_by_id(UUID(row.id))
            if category:
                categories.append(category)
        
        return categories

    async def get_descendants(self, category_id: UUID) -> List[Category]:
        """Get all descendants of a category (children, grandchildren, etc.)."""
        # Use recursive CTE
        cte_query = text("""
            WITH RECURSIVE descendants AS (
                SELECT c.* 
                FROM categories c 
                WHERE c.id = :category_id
                
                UNION ALL
                
                SELECT c.* 
                FROM categories c 
                INNER JOIN descendants d ON c.parent_category_id = d.id
            )
            SELECT * FROM descendants WHERE id != :category_id;
        """)
        
        result = await self.session.execute(cte_query, {"category_id": str(category_id)})
        rows = result.fetchall()
        
        # Convert rows to Category objects
        categories = []
        for row in rows:
            category = await self.get_by_id(UUID(row.id))
            if category:
                categories.append(category)
        
        return categories

    async def exists_by_code(self, category_code: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a category with the given code exists."""
        query = select(func.count()).select_from(Category).where(
            Category.category_code == category_code
        )
        
        if exclude_id:
            query = query.where(Category.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0

    async def exists_by_slug(self, slug: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a category with the given slug exists."""
        query = select(func.count()).select_from(Category).where(
            Category.slug == slug
        )
        
        if exclude_id:
            query = query.where(Category.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0

    async def exists_by_name_and_parent(
        self, 
        name: str, 
        parent_id: Optional[UUID] = None, 
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if a category with the given name exists under the specified parent."""
        query = select(func.count()).select_from(Category).where(
            Category.name == name,
            Category.parent_category_id == parent_id,
            Category.is_active == True
        )
        
        if exclude_id:
            query = query.where(Category.id != exclude_id)
        
        result = await self.session.execute(query)
        count = result.scalar_one()
        
        return count > 0

    async def update_hierarchy(self, category_id: UUID, new_parent_id: Optional[UUID]) -> bool:
        """Update category hierarchy by changing its parent."""
        category = await self.get_by_id(category_id)
        if not category:
            return False
        
        # Prevent setting self as parent
        if new_parent_id and new_parent_id == category_id:
            return False
        
        # Prevent creating circular references
        if new_parent_id:
            ancestors = await self.get_ancestors(new_parent_id)
            if any(a.id == category_id for a in ancestors):
                return False
        
        category.parent_category_id = new_parent_id
        await self.session.commit()
        
        return True

    async def get_category_paths(self, category_id: UUID) -> List[CategoryPath]:
        """Get all paths for a category."""
        query = select(CategoryPath).where(
            CategoryPath.descendant_id == category_id
        ).order_by(asc(CategoryPath.depth))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def rebuild_paths(self) -> None:
        """Rebuild the category paths table (closure table)."""
        # Clear existing paths
        await self.session.execute(text("DELETE FROM category_paths"))
        
        # Rebuild paths using recursive CTE
        rebuild_query = text("""
            INSERT INTO category_paths (ancestor_id, descendant_id, depth)
            WITH RECURSIVE category_tree AS (
                -- Base case: each category is its own ancestor at depth 0
                SELECT id as ancestor_id, id as descendant_id, 0 as depth
                FROM categories
                
                UNION ALL
                
                -- Recursive case: find all ancestor-descendant relationships
                SELECT ct.ancestor_id, c.id as descendant_id, ct.depth + 1
                FROM categories c
                INNER JOIN category_tree ct ON c.parent_category_id = ct.descendant_id
            )
            SELECT ancestor_id, descendant_id, depth FROM category_tree;
        """)
        
        await self.session.execute(rebuild_query)
        await self.session.commit()

    async def get_item_count(self, category_id: UUID, include_descendants: bool = False) -> int:
        """Get count of items in a category."""
        if include_descendants:
            # Get all descendant category IDs
            descendants = await self.get_descendants(category_id)
            category_ids = [category_id] + [d.id for d in descendants]
            
            query = text("""
                SELECT COUNT(DISTINCT i.id) 
                FROM items i 
                WHERE i.category_id = ANY(:category_ids) 
                AND i.is_active = true
            """)
            
            result = await self.session.execute(
                query, 
                {"category_ids": category_ids}
            )
        else:
            query = text("""
                SELECT COUNT(*) 
                FROM items 
                WHERE category_id = :category_id 
                AND is_active = true
            """)
            
            result = await self.session.execute(
                query, 
                {"category_id": category_id}
            )
        
        return result.scalar_one()

    async def search(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[Category]:
        """Search categories by name, code, or description.
        
        Overrides base search to search specific Category fields.
        """
        search_fields = ["name", "category_code", "description"]
        return await super().search(
            search_term=search_term,
            search_fields=search_fields,
            limit=limit,
            active_only=not include_inactive
        )

    async def get_breadcrumb(self, category_id: UUID) -> List[Dict[str, Any]]:
        """Get breadcrumb path for a category."""
        ancestors = await self.get_ancestors(category_id)
        category = await self.get_by_id(category_id)
        
        breadcrumb = []
        for ancestor in ancestors:
            breadcrumb.append({
                "id": str(ancestor.id),
                "name": ancestor.name,
                "slug": ancestor.slug
            })
        
        if category:
            breadcrumb.append({
                "id": str(category.id),
                "name": category.name,
                "slug": category.slug
            })
        
        return breadcrumb