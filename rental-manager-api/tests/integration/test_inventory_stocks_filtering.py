"""
Test to verify that inventory stocks endpoint only returns items with inventory units.

This test ensures that the /api/v1/inventory/stocks endpoint correctly filters
to show only items that have associated inventory units through the JOIN operation.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.models.item import Item
from app.models.inventory_unit import InventoryUnit
from app.models.category import Category
from app.models.brand import Brand
from app.models.location import Location
from app.models.unit_of_measurement import UnitOfMeasurement


@pytest.mark.asyncio
async def test_inventory_stocks_filtering(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
):
    """Test that inventory stocks endpoint only returns items with inventory units."""
    
    # Create test data
    # 1. Create necessary master data
    category = Category(
        id=uuid4(),
        name="Test Category",
        code="TEST",
        created_by=1,
        updated_by=1
    )
    db_session.add(category)
    
    brand = Brand(
        id=uuid4(),
        name="Test Brand",
        created_by=1,
        updated_by=1
    )
    db_session.add(brand)
    
    location = Location(
        id=uuid4(),
        name="Test Location",
        code="LOC001",
        type="WAREHOUSE",
        created_by=1,
        updated_by=1
    )
    db_session.add(location)
    
    uom = UnitOfMeasurement(
        id=uuid4(),
        name="Piece",
        abbreviation="PC",
        created_by=1,
        updated_by=1
    )
    db_session.add(uom)
    
    await db_session.flush()
    
    # 2. Create items - some with inventory units, some without
    # Item WITH inventory units
    item_with_units = Item(
        id=uuid4(),
        name="Item With Units",
        sku=f"SKU-WITH-{uuid4().hex[:6]}",
        category_id=category.id,
        brand_id=brand.id,
        unit_of_measurement_id=uom.id,
        is_rentable=True,
        is_salable=True,
        is_serializable=True,
        created_by=1,
        updated_by=1
    )
    db_session.add(item_with_units)
    
    # Item WITHOUT inventory units
    item_without_units = Item(
        id=uuid4(),
        name="Item Without Units",
        sku=f"SKU-WITHOUT-{uuid4().hex[:6]}",
        category_id=category.id,
        brand_id=brand.id,
        unit_of_measurement_id=uom.id,
        is_rentable=True,
        is_salable=True,
        is_serializable=False,
        created_by=1,
        updated_by=1
    )
    db_session.add(item_without_units)
    
    await db_session.flush()
    
    # 3. Create inventory units only for the first item
    for i in range(3):
        unit = InventoryUnit(
            id=uuid4(),
            item_id=item_with_units.id,
            serial_number=f"SN-{uuid4().hex[:8]}",
            location_id=location.id,
            status="AVAILABLE",
            condition_grade="A",
            created_by=1,
            updated_by=1
        )
        db_session.add(unit)
    
    await db_session.commit()
    
    # 4. Test the inventory stocks endpoint
    response = await async_client.get(
        "/api/v1/inventory/stocks",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert data["success"] is True
    assert "data" in data
    assert isinstance(data["data"], list)
    
    # Filter test items from results (in case there's other data)
    test_items = [
        item for item in data["data"] 
        if item["item_name"] in ["Item With Units", "Item Without Units"]
    ]
    
    # Verify filtering: only item with units should be returned
    assert len(test_items) == 1, "Should only return items with inventory units"
    assert test_items[0]["item_name"] == "Item With Units"
    assert test_items[0]["total_units"] == 3
    assert test_items[0]["sku"].startswith("SKU-WITH-")
    
    # Verify the item without units is NOT in the results
    item_names = [item["item_name"] for item in data["data"]]
    assert "Item Without Units" not in item_names
    
    # 5. Test with search filter to ensure filtering still works
    response = await async_client.get(
        "/api/v1/inventory/stocks?search=Item",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    search_data = response.json()
    
    # Filter test items from search results
    search_test_items = [
        item for item in search_data["data"]
        if item["item_name"] in ["Item With Units", "Item Without Units"]
    ]
    
    # Should still only get the item with units
    assert len(search_test_items) == 1
    assert search_test_items[0]["item_name"] == "Item With Units"


@pytest.mark.asyncio
async def test_inventory_stocks_with_bulk_stock(
    async_client: AsyncClient,
    db_session: AsyncSession,
    auth_headers: dict,
):
    """Test that inventory stocks endpoint includes items with bulk stock (non-serialized)."""
    
    # Create test data for bulk (non-serialized) items
    category = Category(
        id=uuid4(),
        name="Bulk Category",
        code="BULK",
        created_by=1,
        updated_by=1
    )
    db_session.add(category)
    
    brand = Brand(
        id=uuid4(),
        name="Bulk Brand",
        created_by=1,
        updated_by=1
    )
    db_session.add(brand)
    
    location = Location(
        id=uuid4(),
        name="Bulk Location",
        code="BULK001",
        type="WAREHOUSE",
        created_by=1,
        updated_by=1
    )
    db_session.add(location)
    
    uom = UnitOfMeasurement(
        id=uuid4(),
        name="Kilogram",
        abbreviation="KG",
        created_by=1,
        updated_by=1
    )
    db_session.add(uom)
    
    await db_session.flush()
    
    # Create a non-serializable item (bulk stock)
    bulk_item = Item(
        id=uuid4(),
        name="Bulk Item With Stock",
        sku=f"BULK-{uuid4().hex[:6]}",
        category_id=category.id,
        brand_id=brand.id,
        unit_of_measurement_id=uom.id,
        is_rentable=False,
        is_salable=True,
        is_serializable=False,  # Non-serialized bulk item
        created_by=1,
        updated_by=1
    )
    db_session.add(bulk_item)
    
    await db_session.flush()
    
    # For bulk items, we would typically have inventory_stock_levels
    # or inventory_units with quantity > 1
    # Creating a single inventory unit to represent bulk stock
    bulk_unit = InventoryUnit(
        id=uuid4(),
        item_id=bulk_item.id,
        serial_number=None,  # No serial for bulk
        location_id=location.id,
        status="AVAILABLE",
        quantity=100.0,  # Bulk quantity
        created_by=1,
        updated_by=1
    )
    db_session.add(bulk_unit)
    
    await db_session.commit()
    
    # Test the endpoint
    response = await async_client.get(
        f"/api/v1/inventory/stocks?search={bulk_item.sku}",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Find our bulk item in results
    bulk_items = [
        item for item in data["data"]
        if item["sku"] == bulk_item.sku
    ]
    
    assert len(bulk_items) == 1
    assert bulk_items[0]["item_name"] == "Bulk Item With Stock"
    assert bulk_items[0]["total_quantity"] == 100.0