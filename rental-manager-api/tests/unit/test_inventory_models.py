"""
Unit tests for inventory models.

Tests model instantiation, validation, business logic methods,
and relationships for all inventory models.
"""

import pytest
from decimal import Decimal
from datetime import datetime, date, timezone
from uuid import uuid4, UUID

from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.stock_level import StockLevel
from app.models.inventory.inventory_unit import InventoryUnit
from app.models.inventory.sku_sequence import SKUSequence
from app.models.inventory.enums import (
    StockMovementType, InventoryUnitStatus, InventoryUnitCondition,
    get_inbound_movement_types, get_outbound_movement_types
)


class TestStockMovement:
    """Test StockMovement model."""
    
    def test_stock_movement_creation(self):
        """Test basic StockMovement creation."""
        movement = StockMovement()
        movement.movement_type = StockMovementType.PURCHASE
        movement.item_id = uuid4()
        movement.location_id = uuid4()
        movement.quantity_change = Decimal("50.00")
        movement.quantity_before = Decimal("100.00")
        movement.quantity_after = Decimal("150.00")
        movement.reason = "Test purchase"
        
        assert movement.movement_type == StockMovementType.PURCHASE
        assert movement.quantity_change == Decimal("50.00")
        assert movement.quantity_before == Decimal("100.00")
        assert movement.quantity_after == Decimal("150.00")
        assert movement.reason == "Test purchase"
    
    def test_movement_math_validation(self):
        """Test movement quantity math validation."""
        movement = StockMovement()
        movement.quantity_before = Decimal("100.00")
        movement.quantity_change = Decimal("25.00")
        movement.quantity_after = Decimal("125.00")
        
        # Should pass validation
        movement.validate_movement_math()
        
        # Test invalid math
        movement.quantity_after = Decimal("120.00")  # Wrong calculation
        with pytest.raises(ValueError, match="Movement math validation failed"):
            movement.validate_movement_math()
    
    def test_movement_type_validation(self):
        """Test movement type validation."""
        movement = StockMovement()
        movement.movement_type = StockMovementType.PURCHASE
        movement.quantity_change = Decimal("50.00")
        
        # Should pass for positive movement type
        movement.validate_movement_type()
        
        # Test negative movement with positive quantity
        movement.movement_type = StockMovementType.SALE
        with pytest.raises(ValueError, match="Sale movements must have negative quantity"):
            movement.validate_movement_type()
    
    def test_calculate_after_quantity(self):
        """Test automatic quantity calculation."""
        movement = StockMovement()
        movement.quantity_before = Decimal("100.00")
        movement.quantity_change = Decimal("-25.00")
        
        calculated = movement.calculate_after_quantity()
        assert calculated == Decimal("75.00")
    
    def test_is_inbound_outbound(self):
        """Test movement direction detection."""
        # Test inbound movement
        movement = StockMovement()
        movement.movement_type = StockMovementType.PURCHASE
        assert movement.is_inbound() == True
        assert movement.is_outbound() == False
        
        # Test outbound movement
        movement.movement_type = StockMovementType.SALE
        assert movement.is_inbound() == False
        assert movement.is_outbound() == True
    
    def test_get_reference_info(self):
        """Test reference information retrieval."""
        movement = StockMovement()
        movement.reference_type = "transaction"
        movement.reference_id = uuid4()
        
        ref_info = movement.get_reference_info()
        assert ref_info["type"] == "transaction"
        assert ref_info["id"] == movement.reference_id


class TestStockLevel:
    """Test StockLevel model."""
    
    def test_stock_level_creation(self):
        """Test basic StockLevel creation."""
        stock_level = StockLevel()
        stock_level.item_id = uuid4()
        stock_level.location_id = uuid4()
        stock_level.quantity_on_hand = Decimal("100.00")
        stock_level.quantity_available = Decimal("80.00")
        stock_level.quantity_reserved = Decimal("20.00")
        stock_level.reorder_point = Decimal("25.00")
        
        assert stock_level.quantity_on_hand == Decimal("100.00")
        assert stock_level.quantity_available == Decimal("80.00")
        assert stock_level.quantity_reserved == Decimal("20.00")
        assert stock_level.reorder_point == Decimal("25.00")
    
    def test_is_low_stock(self):
        """Test low stock detection."""
        stock_level = StockLevel()
        stock_level.quantity_available = Decimal("15.00")
        stock_level.reorder_point = Decimal("20.00")
        
        assert stock_level.is_below_reorder_point() == True
        
        stock_level.quantity_available = Decimal("25.00")
        assert stock_level.is_below_reorder_point() == False
    
    def test_calculate_total_allocated(self):
        """Test total allocated quantity calculation."""
        stock_level = StockLevel()
        stock_level.quantity_reserved = Decimal("20.00")
        stock_level.quantity_on_rent = Decimal("30.00")
        stock_level.quantity_in_maintenance = Decimal("5.00")
        
        total_allocated = stock_level.calculate_total_allocated()
        assert total_allocated == Decimal("55.00")
    
    def test_update_availability(self):
        """Test availability calculation update."""
        stock_level = StockLevel()
        stock_level.quantity_on_hand = Decimal("100.00")
        stock_level.quantity_reserved = Decimal("20.00")
        stock_level.quantity_on_rent = Decimal("30.00")
        stock_level.quantity_damaged = Decimal("5.00")
        stock_level.quantity_in_maintenance = Decimal("10.00")
        
        stock_level.update_availability()
        # Available = 100 - 20 - 30 - 5 - 10 = 35
        assert stock_level.quantity_available == Decimal("35.00")
    
    def test_adjust_quantity(self):
        """Test quantity adjustment."""
        stock_level = StockLevel()
        stock_level.quantity_on_hand = Decimal("100.00")
        stock_level.quantity_available = Decimal("80.00")
        
        # Test positive adjustment
        stock_level.adjust_quantity(Decimal("25.00"))
        assert stock_level.quantity_on_hand == Decimal("125.00")
        assert stock_level.quantity_available == Decimal("105.00")
        
        # Test negative adjustment
        stock_level.adjust_quantity(Decimal("-15.00"))
        assert stock_level.quantity_on_hand == Decimal("110.00")
        assert stock_level.quantity_available == Decimal("90.00")
    
    def test_reserve_quantity(self):
        """Test quantity reservation."""
        stock_level = StockLevel()
        stock_level.quantity_available = Decimal("50.00")
        stock_level.quantity_reserved = Decimal("10.00")
        
        # Test successful reservation
        success = stock_level.reserve_quantity(Decimal("20.00"))
        assert success == True
        assert stock_level.quantity_available == Decimal("30.00")
        assert stock_level.quantity_reserved == Decimal("30.00")
        
        # Test insufficient stock
        success = stock_level.reserve_quantity(Decimal("40.00"))
        assert success == False
    
    def test_release_reservation(self):
        """Test reservation release."""
        stock_level = StockLevel()
        stock_level.quantity_available = Decimal("30.00")
        stock_level.quantity_reserved = Decimal("30.00")
        
        stock_level.release_reservation(Decimal("15.00"))
        assert stock_level.quantity_available == Decimal("45.00")
        assert stock_level.quantity_reserved == Decimal("15.00")


class TestInventoryUnit:
    """Test InventoryUnit model."""
    
    def test_inventory_unit_creation(self):
        """Test basic InventoryUnit creation."""
        unit = InventoryUnit()
        unit.item_id = uuid4()
        unit.location_id = uuid4()
        unit.sku = "TEST-SKU-001"
        unit.serial_number = "SN123456789"
        unit.status = InventoryUnitStatus.AVAILABLE
        unit.condition = InventoryUnitCondition.NEW
        unit.purchase_price = Decimal("150.00")
        
        assert unit.sku == "TEST-SKU-001"
        assert unit.serial_number == "SN123456789"
        assert unit.status == InventoryUnitStatus.AVAILABLE
        assert unit.condition == InventoryUnitCondition.NEW
        assert unit.purchase_price == Decimal("150.00")
    
    def test_is_available_for_rental(self):
        """Test rental availability check."""
        unit = InventoryUnit()
        unit.status = InventoryUnitStatus.AVAILABLE
        unit.condition = InventoryUnitCondition.GOOD
        unit.is_rental_blocked = False
        
        assert unit.is_available_for_rental() == True
        
        # Test blocked unit
        unit.is_rental_blocked = True
        assert unit.is_available_for_rental() == False
        
        # Test poor condition
        unit.is_rental_blocked = False
        unit.condition = InventoryUnitCondition.POOR
        assert unit.is_available_for_rental() == False
        
        # Test unavailable status
        unit.condition = InventoryUnitCondition.GOOD
        unit.status = InventoryUnitStatus.ON_RENT
        assert unit.is_available_for_rental() == False
    
    def test_needs_maintenance(self):
        """Test maintenance requirement check."""
        unit = InventoryUnit()
        unit.next_maintenance_date = datetime.now(timezone.utc).date()
        
        assert unit.needs_maintenance() == True
        
        # Test future maintenance
        from datetime import timedelta
        unit.next_maintenance_date = (datetime.now(timezone.utc) + timedelta(days=30)).date()
        assert unit.needs_maintenance() == False
    
    def test_is_warranty_expired(self):
        """Test warranty expiration check."""
        unit = InventoryUnit()
        unit.warranty_end_date = datetime.now(timezone.utc).date()
        
        assert unit.is_warranty_expired() == True
        
        # Test future warranty
        from datetime import timedelta
        unit.warranty_end_date = (datetime.now(timezone.utc) + timedelta(days=365)).date()
        assert unit.is_warranty_expired() == False
    
    def test_update_status(self):
        """Test status update with history."""
        unit = InventoryUnit()
        unit.status = InventoryUnitStatus.AVAILABLE
        
        unit.update_status(InventoryUnitStatus.ON_RENT, "Rented to customer")
        assert unit.status == InventoryUnitStatus.ON_RENT
        # Status history should be updated (if implemented)
    
    def test_block_for_rental(self):
        """Test rental blocking."""
        unit = InventoryUnit()
        unit.is_rental_blocked = False
        
        from datetime import timedelta
        block_until = datetime.now(timezone.utc).date() + timedelta(days=7)
        
        unit.block_for_rental("Maintenance required", block_until)
        assert unit.is_rental_blocked == True
        assert unit.rental_block_reason == "Maintenance required"
        assert unit.rental_blocked_until == block_until
    
    def test_unblock_for_rental(self):
        """Test rental unblocking."""
        unit = InventoryUnit()
        unit.is_rental_blocked = True
        unit.rental_block_reason = "Maintenance required"
        
        unit.unblock_for_rental()
        assert unit.is_rental_blocked == False
        assert unit.rental_block_reason is None
        assert unit.rental_blocked_until is None
    
    def test_calculate_age_days(self):
        """Test age calculation."""
        unit = InventoryUnit()
        from datetime import timedelta
        unit.purchase_date = (datetime.now(timezone.utc) - timedelta(days=365)).date()
        
        age = unit.calculate_age_days()
        assert 364 <= age <= 366  # Allow for slight time differences
    
    def test_record_rental(self):
        """Test rental recording."""
        unit = InventoryUnit()
        unit.rental_count = 5
        unit.total_rental_days = 100
        
        unit.record_rental(customer_id=uuid4(), days=7)
        assert unit.rental_count == 6
        assert unit.total_rental_days == 107
        assert unit.current_customer_id is not None
        assert unit.last_rental_date is not None


class TestSKUSequence:
    """Test SKUSequence model."""
    
    def test_sku_sequence_creation(self):
        """Test basic SKUSequence creation."""
        sequence = SKUSequence()
        sequence.brand_id = uuid4()
        sequence.category_id = uuid4()
        sequence.prefix = "TST"
        sequence.suffix = "END"
        sequence.next_sequence = 1
        sequence.padding_length = 4
        
        assert sequence.prefix == "TST"
        assert sequence.suffix == "END"
        assert sequence.next_sequence == 1
        assert sequence.padding_length == 4
    
    def test_generate_sku_basic(self):
        """Test basic SKU generation."""
        sequence = SKUSequence()
        sequence.prefix = "TST"
        sequence.suffix = "END"
        sequence.next_sequence = 5
        sequence.padding_length = 3
        
        sku = sequence.generate_sku()
        assert sku == "TST-005-END"
        assert sequence.next_sequence == 6  # Should increment
        assert sequence.total_generated == 1
        assert sequence.last_generated_sku == sku
    
    def test_generate_sku_with_params(self):
        """Test SKU generation with parameters."""
        sequence = SKUSequence()
        sequence.next_sequence = 1
        sequence.padding_length = 4
        
        sku = sequence.generate_sku(
            brand_code="ACME",
            category_code="TOOLS",
            item_name="Hammer"
        )
        
        # Should contain brand, category, and item info
        assert "ACME" in sku
        assert "TOOLS" in sku
        assert "0001" in sku  # Padded sequence
    
    def test_generate_sku_with_template(self):
        """Test SKU generation with custom template."""
        sequence = SKUSequence()
        sequence.format_template = "{brand}-{category}-{sequence:05d}-{year}"
        sequence.next_sequence = 42
        
        sku = sequence.generate_sku(
            brand_code="ACME",
            category_code="TOOLS"
        )
        
        current_year = datetime.now().year
        expected = f"ACME-TOOLS-00042-{current_year}"
        assert sku == expected
    
    def test_reset_sequence(self):
        """Test sequence reset."""
        sequence = SKUSequence()
        sequence.next_sequence = 100
        sequence.total_generated = 50
        
        sequence.reset_sequence(1)
        assert sequence.next_sequence == 1
        # Note: total_generated should NOT reset
        assert sequence.total_generated == 50
    
    def test_is_unique_sku(self):
        """Test SKU uniqueness check."""
        sequence = SKUSequence()
        
        # This would typically check against database
        # For unit test, we test the method exists
        assert hasattr(sequence, 'is_unique_sku')
    
    def test_get_next_sku_preview(self):
        """Test SKU preview without incrementing."""
        sequence = SKUSequence()
        sequence.prefix = "PRV"
        sequence.suffix = "TST"
        sequence.next_sequence = 10
        sequence.padding_length = 3
        
        preview = sequence.get_next_sku_preview()
        assert preview == "PRV-010-TST"
        assert sequence.next_sequence == 10  # Should not increment
    
    def test_format_sequence_number(self):
        """Test sequence number formatting."""
        sequence = SKUSequence()
        sequence.padding_length = 5
        
        formatted = sequence.format_sequence_number(42)
        assert formatted == "00042"
        
        sequence.padding_length = 3
        formatted = sequence.format_sequence_number(999)
        assert formatted == "999"
        
        # Test overflow
        formatted = sequence.format_sequence_number(1000)
        assert formatted == "1000"  # Should not truncate


class TestInventoryEnums:
    """Test inventory enumeration helper functions."""
    
    def test_inbound_outbound_movement_types(self):
        """Test inbound and outbound movement type helpers."""
        inbound_types = get_inbound_movement_types()
        outbound_types = get_outbound_movement_types()
        
        # Check that we have both types
        assert len(inbound_types) > 0
        assert len(outbound_types) > 0
        
        # Check that PURCHASE is inbound
        assert StockMovementType.PURCHASE in inbound_types
        
        # Check that SALE is outbound
        assert StockMovementType.SALE in outbound_types
        
        # Check no overlap
        overlap = inbound_types.intersection(outbound_types)
        assert len(overlap) == 0
    
    def test_enum_consistency(self):
        """Test enum value consistency."""
        # Test that all enum values are strings
        for movement_type in StockMovementType:
            assert isinstance(movement_type.value, str)
        
        for status in InventoryUnitStatus:
            assert isinstance(status.value, str)
        
        for condition in InventoryUnitCondition:
            assert isinstance(condition.value, str)


@pytest.fixture
def sample_stock_movement():
    """Create a sample StockMovement for testing."""
    movement = StockMovement()
    movement.movement_type = StockMovementType.PURCHASE
    movement.item_id = uuid4()
    movement.location_id = uuid4()
    movement.quantity_change = Decimal("50.00")
    movement.quantity_before = Decimal("100.00")
    movement.quantity_after = Decimal("150.00")
    movement.reason = "Test purchase"
    return movement


@pytest.fixture
def sample_stock_level():
    """Create a sample StockLevel for testing."""
    stock_level = StockLevel()
    stock_level.item_id = uuid4()
    stock_level.location_id = uuid4()
    stock_level.quantity_on_hand = Decimal("100.00")
    stock_level.quantity_available = Decimal("80.00")
    stock_level.quantity_reserved = Decimal("20.00")
    stock_level.reorder_point = Decimal("25.00")
    return stock_level


@pytest.fixture
def sample_inventory_unit():
    """Create a sample InventoryUnit for testing."""
    unit = InventoryUnit()
    unit.item_id = uuid4()
    unit.location_id = uuid4()
    unit.sku = "TEST-SKU-001"
    unit.serial_number = "SN123456789"
    unit.status = InventoryUnitStatus.AVAILABLE
    unit.condition = InventoryUnitCondition.NEW
    unit.purchase_price = Decimal("150.00")
    return unit


@pytest.fixture
def sample_sku_sequence():
    """Create a sample SKUSequence for testing."""
    sequence = SKUSequence()
    sequence.brand_id = uuid4()
    sequence.category_id = uuid4()
    sequence.prefix = "TST"
    sequence.suffix = "END"
    sequence.next_sequence = 1
    sequence.padding_length = 4
    return sequence


class TestInventoryModelIntegration:
    """Test integration between inventory models."""
    
    def test_stock_movement_to_stock_level_integration(self, sample_stock_movement, sample_stock_level):
        """Test how stock movements integrate with stock levels."""
        # Test that movement quantities align with stock level changes
        initial_quantity = sample_stock_level.quantity_on_hand
        movement_quantity = sample_stock_movement.quantity_change
        
        # Simulate applying movement to stock level
        new_quantity = initial_quantity + movement_quantity
        sample_stock_level.quantity_on_hand = new_quantity
        sample_stock_level.update_availability()
        
        assert sample_stock_level.quantity_on_hand == new_quantity
    
    def test_inventory_unit_to_stock_level_relationship(self, sample_inventory_unit, sample_stock_level):
        """Test relationship between inventory units and stock levels."""
        # Units should belong to the same item/location as stock level
        sample_inventory_unit.item_id = sample_stock_level.item_id
        sample_inventory_unit.location_id = sample_stock_level.location_id
        
        assert sample_inventory_unit.item_id == sample_stock_level.item_id
        assert sample_inventory_unit.location_id == sample_stock_level.location_id
    
    def test_sku_generation_for_inventory_unit(self, sample_sku_sequence, sample_inventory_unit):
        """Test SKU generation for inventory units."""
        # Generate SKU and assign to unit
        generated_sku = sample_sku_sequence.generate_sku()
        sample_inventory_unit.sku = generated_sku
        
        assert sample_inventory_unit.sku == generated_sku
        assert sample_sku_sequence.total_generated == 1