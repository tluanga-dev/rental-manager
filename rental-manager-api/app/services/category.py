from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime

from app.crud.category import CategoryRepository
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate, CategoryUpdate, CategoryMove, CategoryResponse, 
    CategorySummary, CategoryTree, CategoryList, CategoryFilter, 
    CategorySort, CategoryStats, CategoryBulkOperation, CategoryBulkResult,
    CategoryExport, CategoryImport, CategoryImportResult, CategoryHierarchy,
    CategoryValidation
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError, 
    BusinessRuleError
)


class CategoryCodeGenerator:
    """Simple category code generator for the new system."""
    
    def __init__(self, repository: CategoryRepository):
        self.repository = repository
    
    async def generate_category_code(
        self,
        category_name: str,
        parent_category_id: Optional[str] = None,
        category_level: int = 1
    ) -> str:
        """Generate a unique category code."""
        # Simple code generation: take first 3 letters + level + sequential number
        name_prefix = ''.join(c.upper() for c in category_name if c.isalpha())[:3]
        if len(name_prefix) < 3:
            name_prefix = name_prefix.ljust(3, 'X')
        
        # Try to find a unique code
        for i in range(1, 1000):
            code = f"{name_prefix}{category_level:01d}{i:02d}"
            if not await self.repository.exists_by_code(code):
                return code
        
        # Fallback
        import random
        return f"{name_prefix}{category_level:01d}{random.randint(10, 99)}"
    
    async def validate_category_code(self, category_code: str) -> Tuple[bool, str]:
        """Validate category code format and uniqueness."""
        if not category_code or len(category_code) > 15:
            return False, "Category code must be 1-15 characters"
        
        import re
        if not re.match(r'^[A-Z0-9\-]+$', category_code):
            return False, "Category code must contain only uppercase letters, numbers, and dashes"
        
        if await self.repository.exists_by_code(category_code):
            return False, "Category code already exists"
        
        return True, ""


class CategoryService:
    """Service layer for category business logic."""
    
    def __init__(self, repository: CategoryRepository):
        """Initialize service with repository."""
        self.repository = repository
    
    async def create_category(
        self,
        category_data: CategoryCreate,
        created_by: Optional[str] = None
    ) -> CategoryResponse:
        """Create a new category."""
        # Check if parent exists
        parent_category = None
        if category_data.parent_category_id:
            parent_category = await self.repository.get_by_id(category_data.parent_category_id)
            if not parent_category:
                raise NotFoundError(f"Parent category with id {category_data.parent_category_id} not found")
        
        # Check for duplicate name under same parent
        if await self.repository.exists_by_name_and_parent(
            category_data.name, 
            category_data.parent_category_id
        ):
            parent_name = parent_category.name if parent_category else "root"
            raise ConflictError(f"Category with name '{category_data.name}' already exists under '{parent_name}'")
        
        # Calculate hierarchy details
        if parent_category:
            category_level = parent_category.category_level + 1
            category_path = f"{parent_category.category_path}/{category_data.name}"
            
            # Update parent to mark as non-leaf
            if parent_category.is_leaf:
                await self.repository.update(
                    parent_category.id,
                    {"is_leaf": False, "updated_by": created_by}
                )
        else:
            category_level = 1
            category_path = category_data.name
        
        # Generate category code if not provided
        category_code = category_data.category_code
        if not category_code:
            code_generator = CategoryCodeGenerator(self.repository)
            category_code = await code_generator.generate_category_code(
                category_name=category_data.name,
                parent_category_id=str(category_data.parent_category_id) if category_data.parent_category_id else None,
                category_level=category_level
            )
        else:
            # Validate provided code
            code_generator = CategoryCodeGenerator(self.repository)
            is_valid, error_message = await code_generator.validate_category_code(category_code)
            if not is_valid:
                raise ValidationError(error_message)
        
        # Prepare category data
        create_data = category_data.model_dump()
        create_data.update({
            "category_code": category_code,
            "category_level": category_level,
            "category_path": category_path,
            # is_leaf comes from the request data now (defaults to False in schema)
            "created_by": created_by,
            "updated_by": created_by
        })
        
        # Create category
        category = await self.repository.create(create_data)
        
        # Convert to response
        return await self._to_response(category)
    
    async def get_category(self, category_id: UUID) -> CategoryResponse:
        """Get category by ID."""
        category = await self.repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        return await self._to_response(category)
    
    async def update_category(
        self,
        category_id: UUID,
        category_data: CategoryUpdate,
        updated_by: Optional[str] = None
    ) -> CategoryResponse:
        """Update an existing category."""
        # Get existing category
        existing_category = await self.repository.get_by_id(category_id)
        if not existing_category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        # Validate parent category change to prevent circular references
        new_parent_id = getattr(category_data, 'parent_category_id', None)
        if new_parent_id is not None and new_parent_id != existing_category.parent_category_id:
            await self._validate_parent_change(existing_category, new_parent_id)
        
        # Prepare update data
        update_data = {"updated_by": updated_by}
        path_update_needed = False
        parent_changed = False
        
        # Check name uniqueness if provided
        if category_data.name is not None and category_data.name != existing_category.name:
            if await self.repository.exists_by_name_and_parent(
                category_data.name, 
                existing_category.parent_category_id,
                exclude_id=category_id
            ):
                raise ConflictError(f"Category with name '{category_data.name}' already exists under same parent")
            
            update_data["name"] = category_data.name
            path_update_needed = True
        
        # Update display order
        if category_data.display_order is not None:
            update_data["display_order"] = category_data.display_order
        
        # Update active status
        if category_data.is_active is not None:
            update_data["is_active"] = category_data.is_active
        
        # Update leaf status
        if category_data.is_leaf is not None:
            update_data["is_leaf"] = category_data.is_leaf
        
        # Update parent category
        if new_parent_id is not None and new_parent_id != existing_category.parent_category_id:
            update_data["parent_category_id"] = new_parent_id
            parent_changed = True
            path_update_needed = True
        
        # Update path if name changed or parent changed
        if path_update_needed:
            # Determine the new name and parent for path calculation
            new_name = category_data.name if category_data.name is not None else existing_category.name
            path_parent_id = new_parent_id if new_parent_id is not None else existing_category.parent_category_id
            
            # Calculate new path based on new parent
            if path_parent_id:
                new_parent = await self.repository.get_by_id(path_parent_id)
                if new_parent:
                    new_path = f"{new_parent.category_path}/{new_name}"
                    new_level = new_parent.category_level + 1
                else:
                    raise NotFoundError(f"Parent category with id {path_parent_id} not found")
            else:
                new_path = new_name
                new_level = 1
            
            update_data["category_path"] = new_path
            update_data["category_level"] = new_level
        
        # Update category
        updated_category = await self.repository.update(category_id, update_data)
        if not updated_category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        # Update descendant paths if name or parent changed
        if path_update_needed:
            await self._update_descendant_paths(updated_category)
        
        # Update parent leaf statuses if parent changed
        if parent_changed:
            # Update old parent's leaf status
            if existing_category.parent_category_id:
                await self._update_parent_leaf_status(existing_category.parent_category_id)
            
            # Update new parent's leaf status
            if new_parent_id:
                await self._update_parent_leaf_status(new_parent_id)
        
        return await self._to_response(updated_category)
    
    async def move_category(
        self,
        category_id: UUID,
        move_data: CategoryMove,
        updated_by: Optional[str] = None
    ) -> CategoryResponse:
        """Move category to a new parent."""
        # Get existing category
        category = await self.repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        # Validate move operation
        await self._validate_move_operation(category, move_data.new_parent_id)
        
        # Update old parent if needed
        old_parent_id = category.parent_category_id
        if old_parent_id:
            await self._update_parent_leaf_status(old_parent_id)
        
        # Move category using repository method
        success = await self.repository.update_hierarchy(category_id, move_data.new_parent_id)
        if not success:
            raise BusinessRuleError("Failed to move category")
        
        # Get updated category
        moved_category = await self.repository.get_by_id(category_id)
        
        # Update display order
        if move_data.new_display_order != moved_category.display_order:
            await self.repository.update(
                category_id,
                {"display_order": move_data.new_display_order, "updated_by": updated_by}
            )
        
        # Update new parent if needed
        if move_data.new_parent_id:
            await self._update_parent_leaf_status(move_data.new_parent_id)
        
        return await self._to_response(moved_category)
    
    async def delete_category(self, category_id: UUID) -> bool:
        """Soft delete a category."""
        category = await self.repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        # Check if category can be deleted (no children and no items)
        children = await self.repository.get_by_parent_id(category_id)
        if children:
            raise BusinessRuleError("Cannot delete category with children")
        
        # Check for items would go here when Item model is available
        # For now, assume no items
        
        success = await self.repository.delete(category_id)
        
        # Update parent leaf status if needed
        if success and category.parent_category_id:
            await self._update_parent_leaf_status(category.parent_category_id)
        
        return success
    
    async def get_category_tree(
        self,
        root_id: Optional[UUID] = None,
        include_inactive: bool = False
    ) -> List[CategoryTree]:
        """Get hierarchical category tree."""
        # Get all categories in tree
        categories = await self.repository.get_full_tree()
        
        if not include_inactive:
            categories = [cat for cat in categories if cat.is_active]
        
        # Filter by root if specified
        if root_id:
            root_category = await self.repository.get_by_id(root_id)
            if not root_category:
                raise NotFoundError(f"Root category with id {root_id} not found")
            
            # Get descendants of root
            descendants = await self.repository.get_descendants(root_id)
            categories = [root_category] + descendants
            
            if not include_inactive:
                categories = [cat for cat in categories if cat.is_active]
        
        # Build tree structure
        category_dict = {cat.id: cat for cat in categories}
        tree_nodes = {}
        
        # Create tree nodes
        for category in categories:
            tree_node = CategoryTree(
                id=category.id,
                name=category.name,
                category_path=category.category_path,
                category_level=category.category_level,
                parent_category_id=category.parent_category_id,
                display_order=category.display_order,
                is_leaf=category.is_leaf,
                is_active=category.is_active,
                child_count=0,  # Will be calculated later
                item_count=0,   # Placeholder until Item model is available
                children=[]
            )
            tree_nodes[category.id] = tree_node
        
        # Build parent-child relationships
        root_nodes = []
        for category in categories:
            tree_node = tree_nodes[category.id]
            
            if category.parent_category_id and category.parent_category_id in tree_nodes:
                parent_node = tree_nodes[category.parent_category_id]
                parent_node.children.append(tree_node)
            else:
                root_nodes.append(tree_node)
        
        # Sort children by display order and name
        def sort_children(node):
            node.children.sort(key=lambda x: (x.display_order, x.name))
            for child in node.children:
                sort_children(child)
        
        for root in root_nodes:
            sort_children(root)
        
        # Sort root nodes
        root_nodes.sort(key=lambda x: (x.display_order, x.name))
        
        return root_nodes
    
    async def get_category_hierarchy(self, category_id: UUID) -> CategoryHierarchy:
        """Get category hierarchy information."""
        category = await self.repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category with id {category_id} not found")
        
        # Get ancestors
        ancestors = await self.repository.get_ancestors(category_id)
        ancestor_summaries = [await self._to_summary(cat) for cat in ancestors]
        
        # Get descendants
        descendants = await self.repository.get_descendants(category_id)
        descendant_summaries = [await self._to_summary(cat) for cat in descendants]
        
        # Get siblings
        siblings = []
        if category.parent_category_id:
            siblings = await self.repository.get_by_parent_id(category.parent_category_id)
            siblings = [s for s in siblings if s.id != category_id]
        sibling_summaries = [await self._to_summary(cat) for cat in siblings]
        
        # Build path to root
        path_to_root = ancestor_summaries + [await self._to_summary(category)]
        
        return CategoryHierarchy(
            category_id=category_id,
            ancestors=ancestor_summaries,
            descendants=descendant_summaries,
            siblings=sibling_summaries,
            depth=category.category_level,
            path_to_root=path_to_root
        )
    
    async def list_categories(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[CategoryFilter] = None,
        sort: Optional[CategorySort] = None,
        include_inactive: bool = False
    ) -> CategoryList:
        """List categories with pagination and filtering."""
        # Set default sort
        if not sort:
            sort = CategorySort()
        
        # Calculate skip
        skip = (page - 1) * page_size
        
        # Get filtered categories and total count
        if filters:
            categories, total = await self.repository.get_filtered(
                filters=filters,
                sort=sort,
                skip=skip,
                limit=page_size
            )
        else:
            categories = await self.repository.get_all(
                skip=skip,
                limit=page_size,
                active_only=not include_inactive
            )
            total = await self.repository.count_all(active_only=not include_inactive)
        
        # Convert to summaries
        category_summaries = [await self._to_summary(cat) for cat in categories]
        
        # Calculate pagination info
        total_pages = (total + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        # Return list response
        return CategoryList(
            items=category_summaries,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=has_next,
            has_previous=has_previous
        )
    
    async def search_categories(
        self,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[CategorySummary]:
        """Search categories by name or path."""
        categories = await self.repository.search(
            search_term=search_term,
            limit=limit,
            include_inactive=include_inactive
        )
        
        return [await self._to_summary(cat) for cat in categories]
    
    async def get_root_categories(self) -> List[CategorySummary]:
        """Get all root categories."""
        categories = await self.repository.get_root_categories()
        return [await self._to_summary(cat) for cat in categories]
    
    async def get_leaf_categories(self) -> List[CategorySummary]:
        """Get all leaf categories."""
        categories = await self.repository.get_leaf_categories()
        return [await self._to_summary(cat) for cat in categories]
    
    async def get_parent_categories(self) -> List[CategorySummary]:
        """Get all categories that are not marked as leaf."""
        categories = await self.repository.get_parent_categories()
        return [await self._to_summary(cat) for cat in categories]
    
    async def get_category_children(self, parent_id: UUID) -> List[CategorySummary]:
        """Get direct children of a category."""
        parent = await self.repository.get_by_id(parent_id)
        if not parent:
            raise NotFoundError(f"Parent category with id {parent_id} not found")
        
        children = await self.repository.get_by_parent_id(parent_id)
        return [await self._to_summary(cat) for cat in children]
    
    async def get_category_statistics(self) -> CategoryStats:
        """Get category statistics."""
        stats = await self.repository.get_statistics()
        
        return CategoryStats(
            total_categories=stats["total_categories"],
            active_categories=stats["active_categories"],
            inactive_categories=stats["inactive_categories"],
            root_categories=stats["root_categories"],
            leaf_categories=stats["leaf_categories"],
            categories_with_items=stats["categories_with_items"],
            categories_without_items=stats["categories_without_items"],
            max_depth=stats["max_depth"],
            avg_children_per_category=stats["avg_children_per_category"],
            most_used_categories=stats["most_used_categories"]
        )
    
    async def bulk_operation(
        self,
        operation: CategoryBulkOperation,
        updated_by: Optional[str] = None
    ) -> CategoryBulkResult:
        """Perform bulk operations on categories."""
        result = await self.repository.bulk_operation(
            category_ids=operation.category_ids,
            operation=operation.operation
        )
        
        return CategoryBulkResult(
            success_count=result["success_count"],
            failure_count=result["failure_count"],
            errors=result["errors"]
        )
    
    async def validate_category_operation(
        self,
        category_id: UUID,
        operation: str,
        data: Optional[Dict[str, Any]] = None
    ) -> CategoryValidation:
        """Validate category operation."""
        category = await self.repository.get_by_id(category_id)
        
        errors = []
        warnings = []
        can_create = True
        can_update = True
        can_delete = True
        can_move = True
        
        if operation == "delete":
            if category:
                # Check if category can be deleted (no children and no items)
                children = await self.repository.get_by_parent_id(category_id)
                if children:
                    can_delete = False
                    errors.append("Cannot delete category with children")
                # Item check would go here when Item model is available
            else:
                can_delete = False
                errors.append("Category not found")
        
        elif operation == "move":
            if category and data and "new_parent_id" in data:
                try:
                    await self._validate_move_operation(category, data["new_parent_id"])
                except Exception as e:
                    can_move = False
                    errors.append(str(e))
        
        return CategoryValidation(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            can_create=can_create,
            can_update=can_update,
            can_delete=can_delete,
            can_move=can_move
        )
    
    # Helper methods
    
    async def _validate_move_operation(
        self,
        category: Category,
        new_parent_id: Optional[UUID]
    ):
        """Validate move operation to prevent cycles."""
        if new_parent_id is None:
            return  # Moving to root is always valid
        
        # Check if new parent exists
        new_parent = await self.repository.get_by_id(new_parent_id)
        if not new_parent:
            raise NotFoundError(f"New parent category {new_parent_id} not found")
        
        # Check for cycle - new parent cannot be a descendant of current category
        if new_parent.category_path.startswith(f"{category.category_path}/"):
            raise BusinessRuleError("Cannot move category to its own descendant")
        
        # Check if moving to same parent
        if new_parent_id == category.parent_category_id:
            raise BusinessRuleError("Category is already under this parent")
    
    async def _validate_parent_change(
        self,
        category: Category,
        new_parent_id: Optional[UUID]
    ):
        """Validate parent category change to prevent cycles."""
        if new_parent_id is None:
            return  # Setting to root is always valid
        
        # Cannot set self as parent
        if new_parent_id == category.id:
            raise BusinessRuleError("Category cannot be its own parent")
        
        # Check if new parent exists
        new_parent = await self.repository.get_by_id(new_parent_id)
        if not new_parent:
            raise NotFoundError(f"Parent category with id {new_parent_id} not found")
        
        # Check for cycle - new parent cannot be a descendant of current category
        if new_parent.category_path.startswith(f"{category.category_path}/"):
            raise BusinessRuleError("Cannot set a descendant category as parent - this would create a circular reference")
    
    async def _update_parent_leaf_status(self, parent_id: UUID):
        """Update parent category leaf status based on children."""
        parent = await self.repository.get_by_id(parent_id)
        if not parent:
            return
        
        children = await self.repository.get_by_parent_id(parent_id)
        active_children = [child for child in children if child.is_active]
        
        should_be_leaf = len(active_children) == 0
        
        if parent.is_leaf != should_be_leaf:
            await self.repository.update(
                parent_id,
                {"is_leaf": should_be_leaf}
            )
    
    async def _update_descendant_paths(self, category: Category):
        """Update descendant paths after category changes."""
        descendants = await self.repository.get_descendants(category.id)
        
        for descendant in descendants:
            # Calculate new path based on current category hierarchy
            path_segments = []
            current = descendant
            
            # Build path from descendant to root
            while current.parent_category_id:
                parent = await self.repository.get_by_id(current.parent_category_id)
                if not parent:
                    break
                path_segments.insert(0, parent.name)
                current = parent
            
            # Add descendant name
            path_segments.append(descendant.name)
            
            # Update descendant
            new_path = "/".join(path_segments)
            new_level = len(path_segments)
            
            await self.repository.update(
                descendant.id,
                {
                    "category_path": new_path,
                    "category_level": new_level
                }
            )
    
    async def _to_response(self, category: Category) -> CategoryResponse:
        """Convert category model to response schema."""
        # Calculate derived properties
        child_count = 0
        item_count = 0  # Placeholder until Item model is available
        can_have_items = category.is_leaf
        can_have_children = True
        can_delete = category.is_active and child_count == 0 and item_count == 0
        is_root = category.category_level == 1 and category.parent_category_id is None
        has_children = not category.is_leaf
        has_items = item_count > 0
        breadcrumb = category.category_path.split("/") if category.category_path else []
        full_name = category.category_path
        
        return CategoryResponse(
            id=category.id,
            name=category.name,
            category_code=category.category_code,
            parent_category_id=category.parent_category_id,
            category_path=category.category_path,
            category_level=category.category_level,
            display_order=category.display_order,
            is_leaf=category.is_leaf,
            is_active=category.is_active,
            created_at=category.created_at,
            updated_at=category.updated_at,
            created_by=category.created_by,
            updated_by=category.updated_by,
            child_count=child_count,
            item_count=item_count,
            can_have_items=can_have_items,
            can_have_children=can_have_children,
            can_delete=can_delete,
            is_root=is_root,
            has_children=has_children,
            has_items=has_items,
            breadcrumb=breadcrumb,
            full_name=full_name
        )
    
    async def _to_summary(self, category: Category) -> CategorySummary:
        """Convert category model to summary schema."""
        # Calculate derived properties
        child_count = 0
        item_count = 0  # Placeholder until Item model is available
        
        return CategorySummary(
            id=category.id,
            name=category.name,
            category_code=category.category_code,
            category_path=category.category_path,
            category_level=category.category_level,
            parent_category_id=category.parent_category_id,
            display_order=category.display_order,
            is_leaf=category.is_leaf,
            is_active=category.is_active,
            created_at=category.created_at,
            updated_at=category.updated_at,
            child_count=child_count,
            item_count=item_count
        )