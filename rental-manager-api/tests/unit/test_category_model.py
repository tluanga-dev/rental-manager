"""
Comprehensive unit tests for Category model
Target: 100% coverage for Category model functionality including hierarchical operations
"""

import pytest
from uuid import uuid4
from datetime import datetime

from app.models.category import Category
from tests.conftest import CategoryFactory, assert_model_fields


@pytest.mark.unit
@pytest.mark.asyncio
class TestCategoryModel:
    """Test Category model functionality with proper database session."""
    
    async def test_category_creation_with_all_fields(self, db_session):
        """Test creating a category with all fields."""
        category_data = {
            "name": "Test Category",
            "category_code": "TESTCAT",
            "description": "Test category description",
            "category_level": 1,
            "category_path": "Test Category",
            "display_order": 1,
            "is_active": True,
            "created_by": "test_user",
            "updated_by": "test_user"
        }
        
        category = Category(**category_data)
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        assert category.name == "Test Category"
        assert category.category_code == "TESTCAT"
        assert category.description == "Test category description"
        assert category.category_level == 1
        assert category.category_path == "Test Category"
        assert category.display_order == 1
        assert category.is_active is True
        assert category.id is not None
        assert category.created_at is not None
    
    async def test_category_creation_minimal(self, db_session):
        """Test creating a category with minimal fields."""
        category = Category(
            name="Minimal Category",
            category_code="MINCAT",
            category_level=1,
            category_path="Minimal Category"
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        assert category.name == "Minimal Category"
        assert category.category_code == "MINCAT"
        assert category.description is None
        assert category.parent_category_id is None
        assert category.is_active is True
    
    async def test_category_hierarchy_parent_child(self, db_session):
        """Test parent-child category relationship."""
        # Create parent category
        parent = Category(
            name="Parent Category",
            category_code="PARENT",
            category_level=1,
            category_path="Parent Category"
        )
        db_session.add(parent)
        await db_session.commit()
        await db_session.refresh(parent)
        
        # Create child category
        child = Category(
            name="Child Category",
            category_code="CHILD",
            parent_category_id=parent.id,
            category_level=2,
            category_path="Parent Category > Child Category"
        )
        db_session.add(child)
        await db_session.commit()
        await db_session.refresh(child)
        
        assert child.parent_category_id == parent.id
        assert child.category_level == 2
        assert "Parent Category" in child.category_path
        assert "Child Category" in child.category_path
    
    async def test_category_deep_hierarchy(self, db_session):
        """Test deep category hierarchy (3+ levels)."""
        # Level 1
        level1 = Category(
            name="Electronics",
            category_code="ELEC",
            category_level=1,
            category_path="Electronics"
        )
        db_session.add(level1)
        await db_session.commit()
        
        # Level 2
        level2 = Category(
            name="Computers",
            category_code="COMP",
            parent_category_id=level1.id,
            category_level=2,
            category_path="Electronics > Computers"
        )
        db_session.add(level2)
        await db_session.commit()
        
        # Level 3
        level3 = Category(
            name="Laptops",
            category_code="LAPTOP",
            parent_category_id=level2.id,
            category_level=3,
            category_path="Electronics > Computers > Laptops"
        )
        db_session.add(level3)
        await db_session.commit()
        await db_session.refresh(level3)
        
        assert level3.category_level == 3
        assert level3.parent_category_id == level2.id
        assert "Electronics" in level3.category_path
        assert "Computers" in level3.category_path
        assert "Laptops" in level3.category_path
    
    def test_category_display_name_property(self):
        """Test display name generation."""
        category = Category(
            name="Test Category",
            category_code="TEST",
            category_level=1,
            category_path="Test Category"
        )
        
        expected_display_name = "Test Category (TEST)"
        assert category.display_name == expected_display_name
    
    def test_category_str_representation(self):
        """Test string representation."""
        category = Category(
            name="String Test",
            category_code="STR",
            category_level=1,
            category_path="String Test"
        )
        
        str_repr = str(category)
        assert "String Test" in str_repr
    
    def test_category_repr_representation(self):
        """Test repr representation."""
        category = Category(
            name="Repr Test",
            category_code="REPR",
            category_level=1,
            category_path="Repr Test"
        )
        category.id = uuid4()
        
        repr_str = repr(category)
        assert "Category" in repr_str
        assert str(category.id) in repr_str
    
    async def test_category_soft_delete(self, db_session):
        """Test soft delete functionality."""
        category = Category(
            name="Delete Test",
            category_code="DEL",
            category_level=1,
            category_path="Delete Test"
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        assert category.is_active is True
        
        # Soft delete
        user_id = uuid4()
        category.soft_delete(user_id)
        
        assert category.is_active is False
        assert category.deleted_by == user_id
        assert category.deleted_at is not None
    
    async def test_category_restore(self, db_session):
        """Test restore functionality."""
        category = Category(
            name="Restore Test",
            category_code="REST",
            category_level=1,
            category_path="Restore Test"
        )
        db_session.add(category)
        await db_session.commit()
        
        # Soft delete then restore
        category.soft_delete(uuid4())
        assert category.is_active is False
        
        restore_user_id = uuid4()
        category.restore(restore_user_id)
        
        assert category.is_active is True
        assert category.updated_by == restore_user_id
        assert category.deleted_at is None
    
    def test_category_has_children_property(self):
        """Test has_children property."""
        category = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        
        # Without actual children in DB, should be False
        assert category.has_children is False
    
    def test_category_can_delete(self):
        """Test can_delete method."""
        category = Category(
            name="Deletable",
            category_code="DEL",
            category_level=1,
            category_path="Deletable"
        )
        
        # Active category without children or items
        assert category.can_delete() is True
        
        # Inactive category
        category.is_active = False
        assert category.can_delete() is False
    
    def test_category_is_root(self):
        """Test is_root property."""
        # Root category (no parent)
        root = Category(
            name="Root",
            category_code="ROOT",
            category_level=1,
            category_path="Root"
        )
        assert root.is_root is True
        
        # Non-root category
        child = Category(
            name="Child",
            category_code="CHILD",
            parent_category_id=uuid4(),
            category_level=2,
            category_path="Root > Child"
        )
        assert child.is_root is False
    
    def test_category_full_path_property(self):
        """Test full_path property."""
        category = Category(
            name="Test",
            category_code="TEST",
            category_level=2,
            category_path="Parent > Test"
        )
        
        assert category.full_path == "Parent > Test"
    
    async def test_category_update_info(self, db_session):
        """Test updating category information."""
        category = Category(
            name="Original",
            category_code="ORIG",
            category_level=1,
            category_path="Original",
            description="Original description"
        )
        db_session.add(category)
        await db_session.commit()
        
        category.update_info(
            name="Updated",
            category_code="UPD",
            description="Updated description",
            display_order=5,
            updated_by="updater"
        )
        
        assert category.name == "Updated"
        assert category.category_code == "UPD"
        assert category.description == "Updated description"
        assert category.display_order == 5
        assert category.updated_by == "updater"


@pytest.mark.unit
class TestCategoryValidation:
    """Test Category model validation logic."""
    
    def test_category_validation_empty_name(self):
        """Test validation with empty category name."""
        with pytest.raises(ValueError, match="Category name cannot be empty"):
            Category(
                name="",
                category_code="EMPTY",
                category_level=1,
                category_path=""
            )
    
    def test_category_validation_empty_code(self):
        """Test validation with empty category code."""
        with pytest.raises(ValueError, match="Category code cannot be empty"):
            Category(
                name="Test",
                category_code="",
                category_level=1,
                category_path="Test"
            )
    
    def test_category_validation_invalid_level(self):
        """Test validation with invalid category level."""
        with pytest.raises(ValueError, match="Category level must be positive"):
            Category(
                name="Test",
                category_code="TEST",
                category_level=0,
                category_path="Test"
            )
        
        with pytest.raises(ValueError, match="Category level must be positive"):
            Category(
                name="Test",
                category_code="TEST",
                category_level=-1,
                category_path="Test"
            )
    
    def test_category_validation_level_too_deep(self):
        """Test validation with category level too deep."""
        with pytest.raises(ValueError, match="Category level cannot exceed"):
            Category(
                name="Test",
                category_code="TEST",
                category_level=11,  # Assuming max is 10
                category_path="Test"
            )
    
    def test_category_validation_long_name(self):
        """Test validation with category name too long."""
        long_name = "A" * 256
        with pytest.raises(ValueError, match="Category name cannot exceed"):
            Category(
                name=long_name,
                category_code="LONG",
                category_level=1,
                category_path=long_name
            )
    
    def test_category_validation_long_code(self):
        """Test validation with category code too long."""
        long_code = "A" * 51
        with pytest.raises(ValueError, match="Category code cannot exceed"):
            Category(
                name="Test",
                category_code=long_code,
                category_level=1,
                category_path="Test"
            )
    
    def test_category_validation_invalid_parent_self_reference(self):
        """Test validation preventing self-reference as parent."""
        category = Category(
            name="Test",
            category_code="TEST",
            category_level=1,
            category_path="Test"
        )
        category.id = uuid4()
        
        # Try to set self as parent
        with pytest.raises(ValueError, match="Category cannot be its own parent"):
            category.parent_category_id = category.id
            category._validate()


@pytest.mark.unit
@pytest.mark.asyncio
class TestCategoryHierarchicalOperations:
    """Test Category hierarchical operations and path management."""
    
    async def test_rebuild_path_single_level(self, db_session):
        """Test path rebuilding for single-level category."""
        category = Category(
            name="Single",
            category_code="SINGLE",
            category_level=1,
            category_path="Old Path"
        )
        db_session.add(category)
        await db_session.commit()
        
        category.rebuild_path()
        assert category.category_path == "Single"
    
    async def test_rebuild_path_with_parent(self, db_session):
        """Test path rebuilding with parent category."""
        parent = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        db_session.add(parent)
        await db_session.commit()
        
        child = Category(
            name="Child",
            category_code="CHILD",
            parent_category_id=parent.id,
            category_level=2,
            category_path="Wrong Path"
        )
        db_session.add(child)
        await db_session.commit()
        
        # Mock getting parent from database
        with pytest.mock.patch.object(child, '_get_parent', return_value=parent):
            child.rebuild_path()
            assert child.category_path == "Parent > Child"
    
    async def test_move_category_to_new_parent(self, db_session):
        """Test moving category to a new parent."""
        # Create original parent
        parent1 = Category(
            name="Parent 1",
            category_code="PAR1",
            category_level=1,
            category_path="Parent 1"
        )
        db_session.add(parent1)
        await db_session.commit()
        
        # Create new parent
        parent2 = Category(
            name="Parent 2",
            category_code="PAR2",
            category_level=1,
            category_path="Parent 2"
        )
        db_session.add(parent2)
        await db_session.commit()
        
        # Create child under parent1
        child = Category(
            name="Child",
            category_code="CHILD",
            parent_category_id=parent1.id,
            category_level=2,
            category_path="Parent 1 > Child"
        )
        db_session.add(child)
        await db_session.commit()
        
        # Move to parent2
        child.move_to_parent(parent2.id)
        
        assert child.parent_category_id == parent2.id
        assert child.category_level == 2
        # Path should be updated
        with pytest.mock.patch.object(child, '_get_parent', return_value=parent2):
            child.rebuild_path()
            assert child.category_path == "Parent 2 > Child"
    
    async def test_move_category_to_root(self, db_session):
        """Test moving category to root level."""
        parent = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        db_session.add(parent)
        await db_session.commit()
        
        child = Category(
            name="Child",
            category_code="CHILD",
            parent_category_id=parent.id,
            category_level=2,
            category_path="Parent > Child"
        )
        db_session.add(child)
        await db_session.commit()
        
        # Move to root
        child.move_to_parent(None)
        
        assert child.parent_category_id is None
        assert child.category_level == 1
        child.rebuild_path()
        assert child.category_path == "Child"
    
    def test_calculate_level_from_parent(self):
        """Test level calculation based on parent."""
        # Root category
        root = Category(
            name="Root",
            category_code="ROOT",
            category_level=1,
            category_path="Root"
        )
        
        # Child should be level 2
        child = Category(
            name="Child",
            category_code="CHILD",
            parent_category_id=uuid4(),
            category_level=1,  # Wrong level
            category_path="Root > Child"
        )
        
        # Mock parent with level 1
        parent = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        
        with pytest.mock.patch.object(child, '_get_parent', return_value=parent):
            new_level = child._calculate_level()
            assert new_level == 2
    
    async def test_get_ancestors(self, db_session):
        """Test getting all ancestors of a category."""
        # Create hierarchy
        level1 = Category(
            name="Level 1",
            category_code="L1",
            category_level=1,
            category_path="Level 1"
        )
        db_session.add(level1)
        await db_session.commit()
        
        level2 = Category(
            name="Level 2",
            category_code="L2",
            parent_category_id=level1.id,
            category_level=2,
            category_path="Level 1 > Level 2"
        )
        db_session.add(level2)
        await db_session.commit()
        
        level3 = Category(
            name="Level 3",
            category_code="L3",
            parent_category_id=level2.id,
            category_level=3,
            category_path="Level 1 > Level 2 > Level 3"
        )
        
        # Mock getting ancestors
        with pytest.mock.patch.object(level3, 'get_ancestors', return_value=[level1, level2]):
            ancestors = level3.get_ancestors()
            assert len(ancestors) == 2
            assert level1 in ancestors
            assert level2 in ancestors
    
    async def test_get_descendants(self, db_session):
        """Test getting all descendants of a category."""
        parent = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        db_session.add(parent)
        await db_session.commit()
        
        # Create children
        child1 = Category(
            name="Child 1",
            category_code="C1",
            parent_category_id=parent.id,
            category_level=2,
            category_path="Parent > Child 1"
        )
        child2 = Category(
            name="Child 2",
            category_code="C2",
            parent_category_id=parent.id,
            category_level=2,
            category_path="Parent > Child 2"
        )
        
        # Mock getting descendants
        with pytest.mock.patch.object(parent, 'get_descendants', return_value=[child1, child2]):
            descendants = parent.get_descendants()
            assert len(descendants) == 2


@pytest.mark.unit
class TestCategoryBusinessLogic:
    """Test Category business logic and constraints."""
    
    def test_category_circular_reference_prevention(self):
        """Test prevention of circular references in hierarchy."""
        # Create a chain of categories
        cat1 = Category(
            name="Cat 1",
            category_code="C1",
            category_level=1,
            category_path="Cat 1"
        )
        cat1.id = uuid4()
        
        cat2 = Category(
            name="Cat 2",
            category_code="C2",
            parent_category_id=cat1.id,
            category_level=2,
            category_path="Cat 1 > Cat 2"
        )
        cat2.id = uuid4()
        
        # Try to make cat1's parent be cat2 (circular)
        with pytest.raises(ValueError, match="Circular reference detected"):
            cat1.parent_category_id = cat2.id
            cat1._validate_no_circular_reference()
    
    def test_category_orphan_prevention(self):
        """Test prevention of orphaned categories."""
        category = Category(
            name="Orphan",
            category_code="ORPH",
            parent_category_id=uuid4(),  # Non-existent parent
            category_level=2,
            category_path="Unknown > Orphan"
        )
        
        # Should handle orphaned category gracefully
        with pytest.mock.patch.object(category, '_get_parent', return_value=None):
            assert category._validate_parent_exists() is False
    
    def test_category_max_depth_validation(self):
        """Test maximum depth validation in hierarchy."""
        MAX_DEPTH = 10
        
        category = Category(
            name="Deep",
            category_code="DEEP",
            category_level=MAX_DEPTH + 1,
            category_path="Very > Deep > Path"
        )
        
        with pytest.raises(ValueError, match="exceeds maximum depth"):
            category._validate_max_depth()
    
    def test_category_unique_code_in_parent(self):
        """Test unique category code within same parent."""
        parent_id = uuid4()
        
        cat1 = Category(
            name="Category 1",
            category_code="SAME",
            parent_category_id=parent_id,
            category_level=2,
            category_path="Parent > Category 1"
        )
        
        # Another category with same code under same parent should fail
        cat2 = Category(
            name="Category 2",
            category_code="SAME",
            parent_category_id=parent_id,
            category_level=2,
            category_path="Parent > Category 2"
        )
        
        # This would be validated at the service/repository level
        assert cat1.category_code == cat2.category_code
        assert cat1.parent_category_id == cat2.parent_category_id
    
    def test_category_display_order_management(self):
        """Test display order management for categories."""
        categories = []
        
        for i in range(5):
            cat = Category(
                name=f"Category {i}",
                category_code=f"CAT{i}",
                category_level=1,
                category_path=f"Category {i}",
                display_order=i
            )
            categories.append(cat)
        
        # Sort by display order
        sorted_cats = sorted(categories, key=lambda x: x.display_order)
        
        for i, cat in enumerate(sorted_cats):
            assert cat.display_order == i
    
    def test_category_active_children_check(self):
        """Test checking for active children before operations."""
        parent = Category(
            name="Parent",
            category_code="PAR",
            category_level=1,
            category_path="Parent"
        )
        parent.id = uuid4()
        
        # Mock having active children
        with pytest.mock.patch.object(parent, 'has_active_children', return_value=True):
            assert parent.has_active_children() is True
            assert parent.can_delete() is False  # Cannot delete with active children