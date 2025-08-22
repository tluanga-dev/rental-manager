from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy import select, func, or_, and_, desc, asc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from pydantic import BaseModel, ConfigDict

from app.models.category import Category
from app.schemas.category import CategoryFilter, CategorySort
from app.core.errors import NotFoundError, ValidationError


class CategoryRepository:
    """Repository for category data access operations with hierarchical support."""

    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        self.session = session

    async def create(self, obj_data: Dict[str, Any]) -> Category:
        """Create a new category with proper handling of category_code."""
        # Ensure category_code is provided
        if 'category_code' not in obj_data or not obj_data['category_code']:
            raise ValidationError("category_code is required for category creation")
        
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

    async def get_by_id(self, id: UUID) -> Optional[Category]:
        """Get category by ID."""
        query = select(Category).where(Category.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[Category]:
        """Get all categories with pagination."""
        query = select(Category)
        
        if active_only:
            query = query.where(Category.is_active == True)
        
        query = query.order_by(asc(Category.category_level), asc(Category.display_order), asc(Category.name))
        query = query.offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def update(self, id: UUID, obj_data: Dict[str, Any]) -> Optional[Category]:
        """Update an existing category."""
        db_obj = await self.get_by_id(id)
        if not db_obj:
            return None
        
        # Update fields if provided
        for field, value in obj_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, id: UUID) -> bool:
        """Soft delete a category."""
        db_obj = await self.get_by_id(id)
        if not db_obj:
            return False
        
        db_obj.is_active = False
        await self.session.commit()
        return True

    async def count_all(self, active_only: bool = True) -> int:
        """Count all categories."""
        query = select(func.count()).select_from(Category)
        
        if active_only:
            query = query.where(Category.is_active == True)
        
        result = await self.session.execute(query)
        return result.scalar_one()

    async def exists(self, id: UUID) -> bool:
        """Check if category exists."""
        query = select(func.count()).select_from(Category).where(Category.id == id)
        result = await self.session.execute(query)
        count = result.scalar_one()
        return count > 0

    # Category-specific methods

    async def get_by_code(self, category_code: str) -> Optional[Category]:
        """Get category by code."""
        query = select(Category).where(Category.category_code == category_code)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

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
        """Get all categories that can be parents (is_leaf = False)."""
        query = select(Category).where(
            and_(
                Category.is_leaf == False,
                Category.is_active == True
            )
        ).order_by(asc(Category.display_order), asc(Category.name))
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_leaf_categories(self) -> List[Category]:
        """Get all leaf categories (is_leaf = True)."""
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
        ).where(Category.is_active == True).order_by(
            asc(Category.category_level), 
            asc(Category.display_order), 
            asc(Category.name)
        )
        
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
            SELECT * FROM ancestors WHERE id != :category_id ORDER BY category_level DESC;
        """)
        
        result = await self.session.execute(cte_query, {"category_id": str(category_id)})
        rows = result.fetchall()
        
        # Convert rows to Category objects
        categories = []
        for row in rows:
            # row.id is already a UUID object from asyncpg
            category = await self.get_by_id(row.id)
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
            SELECT * FROM descendants WHERE id != :category_id ORDER BY category_level ASC;
        """)
        
        result = await self.session.execute(cte_query, {"category_id": str(category_id)})
        rows = result.fetchall()
        
        # Convert rows to Category objects
        categories = []
        for row in rows:
            # row.id is already a UUID object from asyncpg
            category = await self.get_by_id(row.id)
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
        
        # Calculate new level
        if new_parent_id:
            parent = await self.get_by_id(new_parent_id)
            if not parent:
                return False
            new_level = parent.category_level + 1
        else:
            new_level = 1
        
        # Calculate new path
        if new_parent_id:
            parent = await self.get_by_id(new_parent_id)
            new_path = f"{parent.category_path}/{category.name}"
        else:
            new_path = category.name
        
        # Update category
        category.parent_category_id = new_parent_id
        category.category_level = new_level
        category.category_path = new_path
        
        await self.session.commit()
        
        # Update all descendants
        await self._update_descendant_paths(category)
        
        return True

    async def _update_descendant_paths(self, category: Category) -> None:
        """Update paths for all descendants when a category is moved."""
        descendants = await self.get_descendants(category.id)
        
        for descendant in descendants:
            # Recalculate path based on current hierarchy
            path_segments = []
            current = descendant
            
            # Build path from descendant to root
            while current.parent_category_id:
                parent = await self.get_by_id(current.parent_category_id)
                if not parent:
                    break
                path_segments.insert(0, parent.name)
                current = parent
            
            # Add descendant name
            path_segments.append(descendant.name)
            
            # Update descendant
            descendant.category_path = "/".join(path_segments)
            descendant.category_level = len(path_segments)
        
        await self.session.commit()

    async def get_item_count(self, category_id: UUID, include_descendants: bool = False) -> int:
        """Get count of items in a category."""
        if include_descendants:
            # Get all descendant category IDs
            descendants = await self.get_descendants(category_id)
            category_ids = [category_id] + [d.id for d in descendants]
            
            # Note: This would require the Item model to be available
            # For now, return 0 as placeholder
            return 0
        else:
            # Note: This would require the Item model to be available
            # For now, return 0 as placeholder
            return 0

    async def search(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[Category]:
        """Search categories by name, code, or path."""
        query = select(Category)
        
        if not include_inactive:
            query = query.where(Category.is_active == True)
        
        # Search in name, code, and path
        search_conditions = [
            Category.name.ilike(f"%{search_term}%"),
            Category.category_code.ilike(f"%{search_term}%"),
            Category.category_path.ilike(f"%{search_term}%")
        ]
        
        query = query.where(or_(*search_conditions))
        query = query.order_by(asc(Category.category_level), asc(Category.name))
        query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_breadcrumb(self, category_id: UUID) -> List[Dict[str, Any]]:
        """Get breadcrumb path for a category."""
        ancestors = await self.get_ancestors(category_id)
        category = await self.get_by_id(category_id)
        
        breadcrumb = []
        for ancestor in ancestors:
            breadcrumb.append({
                "id": str(ancestor.id),
                "name": ancestor.name,
                "category_code": ancestor.category_code,
                "category_path": ancestor.category_path
            })
        
        if category:
            breadcrumb.append({
                "id": str(category.id),
                "name": category.name,
                "category_code": category.category_code,
                "category_path": category.category_path
            })
        
        return breadcrumb

    async def get_filtered(
        self,
        filters: CategoryFilter,
        sort: CategorySort,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Category], int]:
        """Get filtered and sorted categories with total count."""
        query = select(Category)
        count_query = select(func.count()).select_from(Category)
        
        # Apply filters
        conditions = []
        
        if filters.name:
            conditions.append(Category.name.ilike(f"%{filters.name}%"))
        
        if filters.parent_id is not None:
            conditions.append(Category.parent_category_id == filters.parent_id)
        
        if filters.level is not None:
            conditions.append(Category.category_level == filters.level)
        
        if filters.is_leaf is not None:
            conditions.append(Category.is_leaf == filters.is_leaf)
        
        if filters.is_active is not None:
            conditions.append(Category.is_active == filters.is_active)
        
        if filters.search:
            search_conditions = [
                Category.name.ilike(f"%{filters.search}%"),
                Category.category_code.ilike(f"%{filters.search}%"),
                Category.category_path.ilike(f"%{filters.search}%")
            ]
            conditions.append(or_(*search_conditions))
        
        if filters.path_contains:
            conditions.append(Category.category_path.ilike(f"%{filters.path_contains}%"))
        
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # Apply sorting
        if sort.field == 'name':
            order_field = Category.name
        elif sort.field == 'category_path':
            order_field = Category.category_path
        elif sort.field == 'category_level':
            order_field = Category.category_level
        elif sort.field == 'display_order':
            order_field = Category.display_order
        elif sort.field == 'created_at':
            order_field = Category.created_at
        elif sort.field == 'updated_at':
            order_field = Category.updated_at
        elif sort.field == 'is_active':
            order_field = Category.is_active
        else:
            order_field = Category.name
        
        if sort.direction == 'desc':
            query = query.order_by(desc(order_field))
        else:
            query = query.order_by(asc(order_field))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute queries
        result = await self.session.execute(query)
        categories = result.scalars().all()
        
        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()
        
        return categories, total

    async def get_statistics(self) -> Dict[str, Any]:
        """Get category statistics."""
        # Total categories
        total_query = select(func.count()).select_from(Category)
        total_result = await self.session.execute(total_query)
        total_categories = total_result.scalar_one()
        
        # Active categories
        active_query = select(func.count()).select_from(Category).where(Category.is_active == True)
        active_result = await self.session.execute(active_query)
        active_categories = active_result.scalar_one()
        
        # Inactive categories
        inactive_categories = total_categories - active_categories
        
        # Root categories
        root_query = select(func.count()).select_from(Category).where(
            and_(Category.parent_category_id == None, Category.is_active == True)
        )
        root_result = await self.session.execute(root_query)
        root_categories = root_result.scalar_one()
        
        # Leaf categories
        leaf_query = select(func.count()).select_from(Category).where(
            and_(Category.is_leaf == True, Category.is_active == True)
        )
        leaf_result = await self.session.execute(leaf_query)
        leaf_categories = leaf_result.scalar_one()
        
        # Max depth
        max_depth_query = select(func.max(Category.category_level)).select_from(Category).where(
            Category.is_active == True
        )
        max_depth_result = await self.session.execute(max_depth_query)
        max_depth = max_depth_result.scalar_one() or 0
        
        # Average children per category (simplified calculation)
        avg_children = 0.0
        if total_categories > 0:
            avg_children = (total_categories - root_categories) / max(root_categories, 1)
        
        return {
            "total_categories": total_categories,
            "active_categories": active_categories,
            "inactive_categories": inactive_categories,
            "root_categories": root_categories,
            "leaf_categories": leaf_categories,
            "categories_with_items": 0,  # Placeholder until Item model is available
            "categories_without_items": active_categories,  # Placeholder
            "max_depth": max_depth,
            "avg_children_per_category": avg_children,
            "most_used_categories": []  # Placeholder until Item model is available
        }

    async def bulk_operation(
        self,
        category_ids: List[UUID],
        operation: str
    ) -> Dict[str, Any]:
        """Perform bulk operations on categories."""
        success_count = 0
        failure_count = 0
        errors = []
        
        for category_id in category_ids:
            try:
                category = await self.get_by_id(category_id)
                if not category:
                    errors.append({
                        "category_id": str(category_id),
                        "error": "Category not found"
                    })
                    failure_count += 1
                    continue
                
                if operation == "activate":
                    category.is_active = True
                    success_count += 1
                elif operation == "deactivate":
                    category.is_active = False
                    success_count += 1
                elif operation == "delete":
                    # Check if category can be deleted (no children, no items)
                    children = await self.get_by_parent_id(category_id)
                    if children:
                        errors.append({
                            "category_id": str(category_id),
                            "error": "Category has children and cannot be deleted"
                        })
                        failure_count += 1
                        continue
                    
                    category.is_active = False
                    success_count += 1
                else:
                    errors.append({
                        "category_id": str(category_id),
                        "error": f"Unknown operation: {operation}"
                    })
                    failure_count += 1
                    continue
                
            except Exception as e:
                errors.append({
                    "category_id": str(category_id),
                    "error": str(e)
                })
                failure_count += 1
        
        if success_count > 0:
            await self.session.commit()
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }