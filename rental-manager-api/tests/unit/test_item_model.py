"""
Comprehensive unit tests for Item model
Target: 100% coverage for Item model functionality
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import datetime

from app.models.item import Item
from tests.conftest import ItemFactory, BrandFactory, CategoryFactory, UnitFactory


@pytest.mark.unit
@pytest.mark.asyncio
class TestItemModel:
    """Test Item model functionality."""
    
    def test_item_creation_with_all_fields(self, test_brand, test_category, test_unit):
        """Test creating an item with all fields."""
        item = Item(
            item_name="Complete Test Item",
            sku="COMPLETE-001",
            description="Complete test item description",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_salable=True,
            cost_price=Decimal("100.00"),
            sale_price=Decimal("150.00"),
            rental_rate_per_day=Decimal("25.00"),
            stock_quantity=50,
            reserved_quantity=5,
            available_quantity=45,
            reorder_level=10,
            max_stock_level=100,
            location="A1-B2-C3",
            barcode="1234567890123",
            serial_number="SN-001",
            weight=Decimal("2.5"),
            dimensions="10x5x3",
            color="Blue",
            material="Steel",
            warranty_period=12,
            purchase_date=datetime.now().date(),
            supplier_item_code="SUP-001",
            internal_notes="Internal test notes",
            created_by="test_user",
            updated_by="test_user"
        )
        
        assert item.item_name == "Complete Test Item"
        assert item.sku == "COMPLETE-001"
        assert item.description == "Complete test item description"
        assert item.is_rentable is True
        assert item.is_salable is True
        assert item.cost_price == Decimal("100.00")
        assert item.sale_price == Decimal("150.00")
        assert item.rental_rate_per_day == Decimal("25.00")
        assert item.stock_quantity == 50
        assert item.available_quantity == 45
        assert item.created_by == "test_user"
    
    def test_item_creation_minimal_fields(self, test_brand, test_category, test_unit):
        """Test creating an item with minimal required fields."""
        item = Item(
            item_name="Minimal Item",
            sku="MIN-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_salable=False,
            cost_price=Decimal("50.00"),
            rental_rate_per_day=Decimal("10.00")
        )
        
        assert item.item_name == "Minimal Item"
        assert item.sku == "MIN-001"
        assert item.is_rentable is True
        assert item.is_salable is False
        assert item.sale_price is None
        assert item.description is None
    
    def test_item_rental_only(self, test_brand, test_category, test_unit):
        """Test rental-only item creation."""
        item = Item(
            item_name="Rental Only Item",
            sku="RENT-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_salable=False,
            cost_price=Decimal("200.00"),
            rental_rate_per_day=Decimal("50.00")
        )
        
        assert item.can_be_rented() is True
        assert item.can_be_sold() is False
        assert item.sale_price is None
    
    def test_item_sale_only(self, test_brand, test_category, test_unit):
        """Test sale-only item creation."""
        item = Item(
            item_name="Sale Only Item",
            sku="SALE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=False,
            is_salable=True,
            cost_price=Decimal("100.00"),
            sale_price=Decimal("150.00")
        )
        
        assert item.can_be_rented() is False
        assert item.can_be_sold() is True
        assert item.rental_rate_per_day is None
    
    def test_profit_margin_calculation(self, test_brand, test_category, test_unit):
        """Test profit margin calculation."""
        item = Item(
            item_name="Margin Test Item",
            sku="MARGIN-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_salable=True,
            cost_price=Decimal("100.00"),
            sale_price=Decimal("150.00")
        )
        
        assert item.profit_margin == 50.0
    
    def test_profit_margin_zero_cost(self, test_brand, test_category, test_unit):
        """Test profit margin with zero cost price."""
        item = Item(
            item_name="Zero Cost Item",
            sku="ZERO-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_salable=True,
            cost_price=Decimal("0.00"),
            sale_price=Decimal("100.00")
        )
        
        assert item.profit_margin == 100.0
    
    def test_profit_margin_no_sale_price(self, test_brand, test_category, test_unit):
        """Test profit margin when no sale price is set."""
        item = Item(
            item_name="No Sale Price Item",
            sku="NOSALE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            cost_price=Decimal("100.00"),
            rental_rate_per_day=Decimal("25.00")
        )
        
        assert item.profit_margin == 0.0
    
    def test_availability_checks(self, test_brand, test_category, test_unit):
        """Test item availability calculations."""
        item = Item(
            item_name="Availability Test",
            sku="AVAIL-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            stock_quantity=100,
            reserved_quantity=20,
            available_quantity=80,
            reorder_level=15
        )
        
        assert item.is_in_stock() is True
        assert item.needs_reorder() is False
        
        # Test low stock
        item.available_quantity = 10
        assert item.needs_reorder() is True
    
    def test_rental_blocking_functionality(self, test_brand, test_category, test_unit):
        """Test rental blocking and unblocking."""
        item = Item(
            item_name="Blocking Test",
            sku="BLOCK-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True
        )
        
        user_id = uuid4()
        
        # Test blocking
        item.block_rental("Maintenance required", user_id)
        assert item.is_rental_blocked is True
        assert item.rental_blocked_reason == "Maintenance required"
        assert item.rental_blocked_by == user_id
        assert item.rental_blocked_at is not None
        
        # Test unblocking
        item.unblock_rental()
        assert item.is_rental_blocked is False
        assert item.rental_blocked_reason is None
        assert item.rental_blocked_by is None
        assert item.rental_unblocked_at is not None
    
    def test_display_name_property(self, test_brand, test_category, test_unit):
        """Test display name generation."""
        item = Item(
            item_name="Display Name Test",
            sku="DISPLAY-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id
        )
        
        expected_display_name = "Display Name Test (DISPLAY-001)"
        assert item.display_name == expected_display_name
    
    def test_str_representation(self, test_brand, test_category, test_unit):
        """Test string representation."""
        item = Item(
            item_name="String Test",
            sku="STR-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id
        )
        
        assert str(item) == "String Test (STR-001)"
    
    def test_repr_representation(self, test_brand, test_category, test_unit):
        """Test repr representation."""
        item = Item(
            item_name="Repr Test",
            sku="REPR-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id
        )
        
        repr_str = repr(item)
        assert "Item" in repr_str
        assert "REPR-001" in repr_str
    
    def test_soft_delete_functionality(self, test_brand, test_category, test_unit):
        """Test soft delete operations."""
        item = Item(
            item_name="Soft Delete Test",
            sku="SOFT-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_active=True
        )
        
        # Test soft delete
        user_id = uuid4()
        item.soft_delete(user_id)
        assert item.is_active is False
        assert item.deleted_by == user_id
        assert item.deleted_at is not None
        
        # Test restore
        item.restore(user_id)
        assert item.is_active is True
        assert item.updated_by == user_id
    
    def test_update_stock_quantities(self, test_brand, test_category, test_unit):
        """Test stock quantity updates."""
        item = Item(
            item_name="Stock Test",
            sku="STOCK-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            stock_quantity=100,
            reserved_quantity=10,
            available_quantity=90
        )
        
        # Test stock increase
        item.update_stock(120)
        assert item.stock_quantity == 120
        assert item.available_quantity == 110  # Should update automatically
        
        # Test reservation
        item.reserve_quantity(20)
        assert item.reserved_quantity == 30
        assert item.available_quantity == 90
        
        # Test release reservation
        item.release_reservation(10)
        assert item.reserved_quantity == 20
        assert item.available_quantity == 100


@pytest.mark.unit
class TestItemValidation:
    """Test Item model validation logic."""
    
    def test_item_validation_empty_name(self, test_brand, test_category, test_unit):
        """Test validation with empty item name."""
        with pytest.raises(ValueError, match="Item name cannot be empty"):
            Item(
                item_name="",
                sku="EMPTY-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id
            )
    
    def test_item_validation_empty_sku(self, test_brand, test_category, test_unit):
        """Test validation with empty SKU."""
        with pytest.raises(ValueError, match="SKU cannot be empty"):
            Item(
                item_name="Test Item",
                sku="",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id
            )
    
    def test_item_validation_neither_rentable_nor_salable(self, test_brand, test_category, test_unit):
        """Test validation when item is neither rentable nor salable."""
        with pytest.raises(ValueError, match="Item must be either rentable or salable"):
            Item(
                item_name="Invalid Item",
                sku="INVALID-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_rentable=False,
                is_salable=False
            )
    
    def test_item_validation_negative_cost_price(self, test_brand, test_category, test_unit):
        """Test validation with negative cost price."""
        with pytest.raises(ValueError, match="Cost price cannot be negative"):
            Item(
                item_name="Negative Cost Item",
                sku="NEG-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_salable=True,
                cost_price=Decimal("-10.00"),
                sale_price=Decimal("50.00")
            )
    
    def test_item_validation_negative_sale_price(self, test_brand, test_category, test_unit):
        """Test validation with negative sale price."""
        with pytest.raises(ValueError, match="Sale price cannot be negative"):
            Item(
                item_name="Negative Sale Item",
                sku="NEGSALE-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_salable=True,
                cost_price=Decimal("50.00"),
                sale_price=Decimal("-10.00")
            )
    
    def test_item_validation_negative_rental_rate(self, test_brand, test_category, test_unit):
        """Test validation with negative rental rate."""
        with pytest.raises(ValueError, match="Rental rate cannot be negative"):
            Item(
                item_name="Negative Rental Item",
                sku="NEGRENT-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_rentable=True,
                rental_rate_per_day=Decimal("-5.00")
            )
    
    def test_item_validation_negative_stock_quantities(self, test_brand, test_category, test_unit):
        """Test validation with negative stock quantities."""
        with pytest.raises(ValueError, match="Stock quantities cannot be negative"):
            Item(
                item_name="Negative Stock Item",
                sku="NEGSTOCK-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                stock_quantity=-5
            )
    
    def test_item_validation_salable_without_price(self, test_brand, test_category, test_unit):
        """Test validation for salable item without sale price."""
        with pytest.raises(ValueError, match="Salable item must have a sale price"):
            Item(
                item_name="Salable No Price",
                sku="SALNOPRICE-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_salable=True,
                cost_price=Decimal("50.00")
                # Missing sale_price
            )
    
    def test_item_validation_rentable_without_rate(self, test_brand, test_category, test_unit):
        """Test validation for rentable item without rental rate."""
        with pytest.raises(ValueError, match="Rentable item must have a rental rate"):
            Item(
                item_name="Rentable No Rate",
                sku="RENTNORAT-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id,
                is_rentable=True
                # Missing rental_rate_per_day
            )
    
    def test_item_validation_long_name(self, test_brand, test_category, test_unit):
        """Test validation with item name too long."""
        long_name = "A" * 256
        with pytest.raises(ValueError, match="Item name cannot exceed 255 characters"):
            Item(
                item_name=long_name,
                sku="LONG-001",
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id
            )
    
    def test_item_validation_long_sku(self, test_brand, test_category, test_unit):
        """Test validation with SKU too long."""
        long_sku = "A" * 51
        with pytest.raises(ValueError, match="SKU cannot exceed 50 characters"):
            Item(
                item_name="Long SKU Item",
                sku=long_sku,
                brand_id=test_brand.id,
                category_id=test_category.id,
                unit_of_measurement_id=test_unit.id
            )


@pytest.mark.unit
class TestItemBusinessLogic:
    """Test Item model business logic methods."""
    
    def test_can_be_rented_active_rentable(self, test_brand, test_category, test_unit):
        """Test can_be_rented for active rentable item."""
        item = Item(
            item_name="Rentable Item",
            sku="RENT-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_active=True,
            rental_rate_per_day=Decimal("10.00")
        )
        
        assert item.can_be_rented() is True
    
    def test_can_be_rented_inactive(self, test_brand, test_category, test_unit):
        """Test can_be_rented for inactive item."""
        item = Item(
            item_name="Inactive Item",
            sku="INACTIVE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_active=False,
            rental_rate_per_day=Decimal("10.00")
        )
        
        assert item.can_be_rented() is False
    
    def test_can_be_rented_blocked(self, test_brand, test_category, test_unit):
        """Test can_be_rented for rental-blocked item."""
        item = Item(
            item_name="Blocked Item",
            sku="BLOCKED-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_active=True,
            is_rental_blocked=True,
            rental_rate_per_day=Decimal("10.00")
        )
        
        assert item.can_be_rented() is False
    
    def test_can_be_sold_active_salable(self, test_brand, test_category, test_unit):
        """Test can_be_sold for active salable item."""
        item = Item(
            item_name="Salable Item",
            sku="SALE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_salable=True,
            is_active=True,
            cost_price=Decimal("50.00"),
            sale_price=Decimal("75.00")
        )
        
        assert item.can_be_sold() is True
    
    def test_can_be_sold_inactive(self, test_brand, test_category, test_unit):
        """Test can_be_sold for inactive item."""
        item = Item(
            item_name="Inactive Sale Item",
            sku="INACTSALE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_salable=True,
            is_active=False,
            cost_price=Decimal("50.00"),
            sale_price=Decimal("75.00")
        )
        
        assert item.can_be_sold() is False
    
    def test_is_available_for_rent(self, test_brand, test_category, test_unit):
        """Test availability for rental."""
        item = Item(
            item_name="Available Rental",
            sku="AVAILRENT-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_rentable=True,
            is_active=True,
            available_quantity=5,
            rental_rate_per_day=Decimal("10.00")
        )
        
        assert item.is_available_for_rent() is True
        
        # Test with zero availability
        item.available_quantity = 0
        assert item.is_available_for_rent() is False
    
    def test_is_available_for_sale(self, test_brand, test_category, test_unit):
        """Test availability for sale."""
        item = Item(
            item_name="Available Sale",
            sku="AVAILSALE-001",
            brand_id=test_brand.id,
            category_id=test_category.id,
            unit_of_measurement_id=test_unit.id,
            is_salable=True,
            is_active=True,
            available_quantity=3,
            cost_price=Decimal("50.00"),
            sale_price=Decimal("75.00")
        )
        
        assert item.is_available_for_sale() is True
        
        # Test with zero availability
        item.available_quantity = 0
        assert item.is_available_for_sale() is False