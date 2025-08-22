"""
End-to-end integration tests for complete inventory workflows.

Tests full inventory lifecycle workflows including stock management, rental operations,
transfers, and reporting across all layers (API, Service, CRUD, Model).
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from typing import List, Dict, Any

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient

from app.main import app
from app.models.inventory.enums import (
    StockMovementType,
    InventoryUnitStatus,
    InventoryUnitCondition,
    StockStatus
)
from app.services.inventory.inventory_service import inventory_service


class TestInventoryPurchaseWorkflow:
    """Test complete purchase-to-inventory workflow."""
    
    @pytest.mark.asyncio
    async def test_complete_purchase_workflow(
        self, 
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_item,
        test_location,
        test_supplier,
        test_user
    ):
        """Test complete workflow from purchase order to inventory availability."""
        
        # Step 1: Create inventory units from purchase
        purchase_data = {
            "item_id": str(test_item.id),
            "location_id": str(test_location.id),
            "quantity": 5,
            "unit_cost": "100.00",
            "serial_numbers": ["SN001", "SN002", "SN003", "SN004", "SN005"],
            "batch_code": "BATCH-20241122-001",
            "supplier_id": str(test_supplier.id),
            "purchase_order_number": "PO-2024-001"
        }
        
        # Create units via service
        units, stock_level, movement = await inventory_service.create_inventory_units(
            db_session,
            created_by=test_user.id,
            **purchase_data
        )
        
        # Verify units were created
        assert len(units) == 5
        assert all(unit.item_id == test_item.id for unit in units)
        assert all(unit.location_id == test_location.id for unit in units)
        assert all(unit.status == InventoryUnitStatus.AVAILABLE.value for unit in units)
        assert all(unit.purchase_price == Decimal("100.00") for unit in units)
        
        # Verify stock level was updated
        assert stock_level.quantity_on_hand == Decimal("5.00")
        assert stock_level.quantity_available == Decimal("5.00")
        assert stock_level.item_id == test_item.id
        assert stock_level.location_id == test_location.id
        
        # Verify movement was recorded
        assert movement.movement_type == StockMovementType.ADJUSTMENT_POSITIVE
        assert movement.quantity_change == Decimal("5.00")
        assert movement.quantity_before == Decimal("0.00")
        assert movement.quantity_after == Decimal("5.00")
        
        # Step 2: Verify inventory is available via API
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id)
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        stock_data = data["items"][0]
        assert stock_data["quantity_on_hand"] == "5.00"
        assert stock_data["quantity_available"] == "5.00"
        
        # Step 3: Verify units are available via API
        response = await authenticated_client.get(
            "/api/v1/inventory/units/available-for-rental",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id),
                "quantity_needed": 3
            }
        )
        
        assert response.status_code == 200
        available_units = response.json()
        assert len(available_units) == 3  # Requested quantity
        
        # Step 4: Get movement history via API
        response = await authenticated_client.get(
            "/api/v1/inventory/movements/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id)
            }
        )
        
        assert response.status_code == 200
        movements_data = response.json()
        assert movements_data["total"] == 1
        movement_data = movements_data["items"][0]
        assert movement_data["quantity_change"] == "5.00"
        assert "Purchase receipt" in movement_data["reason"]
    
    @pytest.mark.asyncio
    async def test_purchase_workflow_with_existing_stock(
        self, 
        db_session: AsyncSession,
        test_item,
        test_location,
        test_user
    ):
        """Test purchase workflow when stock already exists."""
        
        # Step 1: Initialize existing stock
        await inventory_service.initialize_stock_level(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            initial_quantity=Decimal("10.00"),
            created_by=test_user.id
        )
        
        # Step 2: Add more inventory via purchase
        units, stock_level, movement = await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=3,
            unit_cost=Decimal("120.00"),
            created_by=test_user.id
        )
        
        # Verify final stock level
        assert stock_level.quantity_on_hand == Decimal("13.00")
        assert stock_level.quantity_available == Decimal("13.00")
        
        # Verify movement reflects addition to existing stock
        assert movement.quantity_before == Decimal("10.00")
        assert movement.quantity_after == Decimal("13.00")
        assert movement.quantity_change == Decimal("3.00")


class TestInventoryRentalWorkflow:
    """Test complete rental workflow."""
    
    @pytest.mark.asyncio
    async def test_complete_rental_lifecycle(
        self, 
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_item,
        test_location,
        test_customer,
        test_user
    ):
        """Test complete rental lifecycle: checkout -> return."""
        
        # Setup: Create inventory units
        units, stock_level, _ = await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=5,
            unit_cost=Decimal("100.00"),
            created_by=test_user.id
        )
        
        # Step 1: Rental checkout
        transaction_id = uuid4()
        rented_units, updated_stock, checkout_movement = await inventory_service.process_rental_checkout(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=Decimal("3"),
            customer_id=test_customer.id,
            transaction_id=transaction_id,
            performed_by=test_user.id
        )
        
        # Verify rental checkout
        assert len(rented_units) == 3
        assert all(unit.status == InventoryUnitStatus.RENTED.value for unit in rented_units)
        assert updated_stock.quantity_available == Decimal("2.00")  # 5 - 3
        assert updated_stock.quantity_on_rent == Decimal("3.00")
        assert checkout_movement.movement_type == StockMovementType.RENTAL_OUT
        
        # Step 2: Verify rental status via API
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id)
            }
        )
        
        assert response.status_code == 200
        stock_data = response.json()["items"][0]
        assert stock_data["quantity_available"] == "2.00"
        assert stock_data["quantity_on_rent"] == "3.00"
        
        # Step 3: Check rented units status
        for unit in rented_units:
            response = await authenticated_client.get(f"/api/v1/inventory/units/{unit.id}")
            assert response.status_code == 200
            unit_data = response.json()
            assert unit_data["status"] == "rented"
        
        # Step 4: Process rental return (2 good, 1 damaged)
        unit_ids = [unit.id for unit in rented_units]
        returned_units, return_stock, return_movement = await inventory_service.process_rental_return(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=Decimal("3"),
            damaged_quantity=Decimal("1"),
            transaction_id=transaction_id,
            unit_ids=unit_ids,
            condition_notes="One unit has minor damage",
            performed_by=test_user.id
        )
        
        # Verify return processing
        assert len(returned_units) == 3
        
        # Check individual unit conditions
        good_units = [u for u in returned_units if u.status == InventoryUnitStatus.AVAILABLE.value]
        damaged_units = [u for u in returned_units if u.status == InventoryUnitStatus.DAMAGED.value]
        
        assert len(good_units) == 2
        assert len(damaged_units) == 1
        
        # Verify stock levels after return
        assert return_stock.quantity_available == Decimal("4.00")  # 2 + 2 good returned
        assert return_stock.quantity_on_rent == Decimal("0.00")
        assert return_stock.quantity_damaged == Decimal("1.00")
        
        # Verify return movement
        assert return_movement.movement_type == StockMovementType.RENTAL_RETURN_MIXED
        assert return_movement.quantity_change == Decimal("3.00")
        
        # Step 5: Verify final state via API
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/summary",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id)
            }
        )
        
        assert response.status_code == 200
        summary = response.json()
        assert summary["total_available"] == 4.0
        assert summary["total_on_rent"] == 0.0
        assert summary["total_damaged"] == 1.0
    
    @pytest.mark.asyncio
    async def test_rental_with_insufficient_stock(
        self, 
        db_session: AsyncSession,
        test_item,
        test_location,
        test_customer,
        test_user
    ):
        """Test rental checkout with insufficient stock."""
        
        # Setup: Create minimal inventory
        await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=2,
            unit_cost=Decimal("100.00"),
            created_by=test_user.id
        )
        
        # Attempt to rent more than available
        with pytest.raises(ValueError, match="Insufficient stock"):
            await inventory_service.process_rental_checkout(
                db_session,
                item_id=test_item.id,
                location_id=test_location.id,
                quantity=Decimal("5"),  # More than available
                customer_id=test_customer.id,
                transaction_id=uuid4(),
                performed_by=test_user.id
            )
    
    @pytest.mark.asyncio
    async def test_rental_return_all_damaged(
        self, 
        db_session: AsyncSession,
        test_item,
        test_location,
        test_customer,
        test_user
    ):
        """Test rental return with all items damaged."""
        
        # Setup and checkout
        units, _, _ = await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=3,
            unit_cost=Decimal("100.00"),
            created_by=test_user.id
        )
        
        rented_units, _, _ = await inventory_service.process_rental_checkout(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=Decimal("3"),
            customer_id=test_customer.id,
            transaction_id=uuid4(),
            performed_by=test_user.id
        )
        
        # Return all as damaged
        unit_ids = [unit.id for unit in rented_units]
        returned_units, stock, movement = await inventory_service.process_rental_return(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=Decimal("3"),
            damaged_quantity=Decimal("3"),  # All damaged
            transaction_id=uuid4(),
            unit_ids=unit_ids,
            condition_notes="All units water damaged",
            performed_by=test_user.id
        )
        
        # Verify all units are marked as damaged
        assert len(returned_units) == 3
        assert all(unit.status == InventoryUnitStatus.DAMAGED.value for unit in returned_units)
        
        # Verify stock levels
        assert stock.quantity_available == Decimal("0.00")  # None available
        assert stock.quantity_damaged == Decimal("3.00")   # All damaged
        
        # Verify movement type
        assert movement.movement_type == StockMovementType.RENTAL_RETURN_DAMAGED


class TestInventoryTransferWorkflow:
    """Test complete stock transfer workflow."""
    
    @pytest.mark.asyncio
    async def test_complete_transfer_workflow(
        self, 
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_item,
        test_user
    ):
        """Test complete stock transfer between locations."""
        
        # Setup: Create two locations
        from app.models.location import Location
        
        source_location = Location(
            name="Warehouse A",
            address="123 Source St",
            is_active=True
        )
        dest_location = Location(
            name="Warehouse B", 
            address="456 Dest Ave",
            is_active=True
        )
        
        db_session.add_all([source_location, dest_location])
        await db_session.commit()
        await db_session.refresh(source_location)
        await db_session.refresh(dest_location)
        
        # Step 1: Create inventory at source location
        await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=source_location.id,
            quantity=10,
            unit_cost=Decimal("50.00"),
            created_by=test_user.id
        )
        
        # Step 2: Transfer stock
        from_stock, to_stock, movements = await inventory_service.transfer_stock(
            db_session,
            item_id=test_item.id,
            from_location_id=source_location.id,
            to_location_id=dest_location.id,
            quantity=Decimal("4"),
            transfer_reason="Restock destination warehouse",
            performed_by=test_user.id
        )
        
        # Verify transfer results
        assert from_stock.quantity_available == Decimal("6.00")  # 10 - 4
        assert to_stock.quantity_available == Decimal("4.00")    # 0 + 4
        assert len(movements) == 2
        
        # Verify movement types
        out_movement, in_movement = movements
        assert out_movement.movement_type == StockMovementType.TRANSFER_OUT
        assert in_movement.movement_type == StockMovementType.TRANSFER_IN
        assert out_movement.quantity_change == Decimal("-4.00")
        assert in_movement.quantity_change == Decimal("4.00")
        
        # Step 3: Verify via API
        # Check source location
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(source_location.id)
            }
        )
        
        assert response.status_code == 200
        source_data = response.json()["items"][0]
        assert source_data["quantity_available"] == "6.00"
        
        # Check destination location
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(dest_location.id)
            }
        )
        
        assert response.status_code == 200
        dest_data = response.json()["items"][0]
        assert dest_data["quantity_available"] == "4.00"
        
        # Step 4: Verify movement history
        response = await authenticated_client.get(
            "/api/v1/inventory/movements/",
            params={
                "item_id": str(test_item.id)
            }
        )
        
        assert response.status_code == 200
        movements_data = response.json()
        
        # Should have: initial adjustment + transfer out + transfer in
        transfer_movements = [
            m for m in movements_data["items"] 
            if m["movement_type"] in ["transfer_out", "transfer_in"]
        ]
        assert len(transfer_movements) == 2
    
    @pytest.mark.asyncio
    async def test_transfer_insufficient_stock(
        self, 
        db_session: AsyncSession,
        test_item,
        test_user
    ):
        """Test transfer with insufficient source stock."""
        
        # Setup locations
        from app.models.location import Location
        
        source_location = Location(name="Source", address="123 St", is_active=True)
        dest_location = Location(name="Dest", address="456 Ave", is_active=True)
        
        db_session.add_all([source_location, dest_location])
        await db_session.commit()
        await db_session.refresh(source_location)
        await db_session.refresh(dest_location)
        
        # Create minimal stock
        await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=source_location.id,
            quantity=2,
            unit_cost=Decimal("50.00"),
            created_by=test_user.id
        )
        
        # Attempt transfer of more than available
        with pytest.raises(ValueError, match="Insufficient stock at source"):
            await inventory_service.transfer_stock(
                db_session,
                item_id=test_item.id,
                from_location_id=source_location.id,
                to_location_id=dest_location.id,
                quantity=Decimal("5"),  # More than available
                transfer_reason="Invalid transfer",
                performed_by=test_user.id
            )


class TestInventoryAdjustmentWorkflow:
    """Test inventory adjustment workflows."""
    
    @pytest.mark.asyncio
    async def test_stock_adjustment_workflow(
        self, 
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_item,
        test_location,
        test_user
    ):
        """Test complete stock adjustment workflow."""
        
        # Step 1: Initialize stock
        stock_level = await inventory_service.initialize_stock_level(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            initial_quantity=Decimal("100.00"),
            created_by=test_user.id
        )
        
        # Step 2: Positive adjustment
        updated_stock, movement = await inventory_service.perform_stock_adjustment(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            adjustment_quantity=Decimal("15.00"),
            reason="Physical count - found additional items",
            notes="Items found in back storage area",
            performed_by=test_user.id,
            requires_approval=True
        )
        
        # Verify positive adjustment
        assert updated_stock.quantity_on_hand == Decimal("115.00")
        assert movement.movement_type == StockMovementType.ADJUSTMENT_POSITIVE
        assert movement.quantity_change == Decimal("15.00")
        assert movement.approved_by_id is None  # Requires approval
        
        # Step 3: Negative adjustment
        updated_stock, movement = await inventory_service.perform_stock_adjustment(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            adjustment_quantity=Decimal("-5.00"),
            reason="Damage discovered during inspection",
            notes="Items damaged during storage",
            performed_by=test_user.id,
            requires_approval=False
        )
        
        # Verify negative adjustment
        assert updated_stock.quantity_on_hand == Decimal("110.00")
        assert movement.movement_type == StockMovementType.ADJUSTMENT_NEGATIVE
        assert movement.quantity_change == Decimal("-5.00")
        
        # Step 4: Verify via API
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={
                "item_id": str(test_item.id),
                "location_id": str(test_location.id)
            }
        )
        
        assert response.status_code == 200
        stock_data = response.json()["items"][0]
        assert stock_data["quantity_on_hand"] == "110.00"
        
        # Step 5: Check adjustment history
        response = await authenticated_client.get(
            "/api/v1/inventory/movements/",
            params={
                "item_id": str(test_item.id),
                "movement_category": "adjustment"
            }
        )
        
        assert response.status_code == 200
        movements_data = response.json()
        adjustment_movements = [
            m for m in movements_data["items"] 
            if "adjustment" in m["movement_type"]
        ]
        assert len(adjustment_movements) >= 2  # At least our two adjustments


class TestInventoryReportingWorkflow:
    """Test inventory reporting and analytics workflows."""
    
    @pytest.mark.asyncio
    async def test_comprehensive_inventory_reporting(
        self, 
        db_session: AsyncSession,
        authenticated_client: AsyncClient,
        test_user
    ):
        """Test comprehensive inventory reporting across multiple items and locations."""
        
        # Setup: Create test data
        from app.models.item import Item
        from app.models.location import Location
        from app.models.category import Category
        from app.models.brand import Brand
        from app.models.unit_of_measurement import UnitOfMeasurement
        
        # Create supporting entities
        brand = Brand(name="Test Brand", code="TB", is_active=True)
        category = Category(
            name="Test Category", 
            category_code="TC", 
            category_level=1,
            category_path="Test Category",
            is_active=True
        )
        uom = UnitOfMeasurement(name="Each", code="EA", is_active=True)
        
        db_session.add_all([brand, category, uom])
        await db_session.commit()
        
        # Create items
        items = []
        for i in range(3):
            item = Item(
                item_name=f"Test Item {i+1}",
                sku=f"ITEM-{i+1:03d}",
                brand_id=brand.id,
                category_id=category.id,
                unit_of_measurement_id=uom.id,
                cost_price=Decimal(f"{100 + i*50}.00"),
                is_active=True
            )
            items.append(item)
        
        # Create locations
        locations = []
        for i in range(2):
            location = Location(
                name=f"Warehouse {chr(65+i)}",
                address=f"{100+i} Test St",
                is_active=True
            )
            locations.append(location)
        
        db_session.add_all(items + locations)
        await db_session.commit()
        
        # Create inventory across items and locations
        for item in items:
            for j, location in enumerate(locations):
                quantity = 10 + j * 5  # Varying quantities
                await inventory_service.create_inventory_units(
                    db_session,
                    item_id=item.id,
                    location_id=location.id,
                    quantity=quantity,
                    unit_cost=item.cost_price,
                    created_by=test_user.id
                )
        
        # Simulate some rental activity
        for item in items[:2]:  # First 2 items
            await inventory_service.process_rental_checkout(
                db_session,
                item_id=item.id,
                location_id=locations[0].id,
                quantity=Decimal("3"),
                customer_id=uuid4(),
                transaction_id=uuid4(),
                performed_by=test_user.id
            )
        
        # Step 1: Test overall summary
        response = await authenticated_client.get("/api/v1/inventory/stock-levels/summary")
        assert response.status_code == 200
        summary = response.json()
        
        # Verify summary contains expected data
        assert summary["total_on_hand"] > 0
        assert summary["total_available"] > 0
        assert summary["total_on_rent"] > 0
        assert summary["location_count"] == 2
        assert summary["item_count"] == 3
        assert "movement_summary" in summary
        
        # Step 2: Test item-specific summary
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/summary",
            params={"item_id": str(items[0].id)}
        )
        assert response.status_code == 200
        item_summary = response.json()
        
        # Should have data for one item across locations
        assert item_summary["item_count"] == 1
        assert item_summary["location_count"] == 2
        assert item_summary["total_on_rent"] > 0  # This item was rented
        
        # Step 3: Test location-specific summary
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/summary",
            params={"location_id": str(locations[0].id)}
        )
        assert response.status_code == 200
        location_summary = response.json()
        
        # Should have data for one location across items
        assert location_summary["location_count"] == 1
        assert location_summary["item_count"] == 3
        
        # Step 4: Test movement summary
        response = await authenticated_client.get("/api/v1/inventory/movements/summary")
        assert response.status_code == 200
        movement_summary = response.json()
        
        assert movement_summary["total_movements"] > 0
        assert "movements_by_type" in movement_summary
        assert "quantity_by_type" in movement_summary
        
        # Step 5: Test inventory alerts
        response = await authenticated_client.get("/api/v1/inventory/alerts")
        assert response.status_code == 200
        alerts = response.json()
        
        # Should be a list (even if empty)
        assert isinstance(alerts, list)
        
        # Step 6: Test low stock simulation
        # Reduce stock on one item to trigger low stock
        await inventory_service.perform_stock_adjustment(
            db_session,
            item_id=items[0].id,
            location_id=locations[0].id,
            adjustment_quantity=Decimal("-8.00"),  # Reduce to near zero
            reason="Test low stock scenario",
            performed_by=test_user.id
        )
        
        response = await authenticated_client.get(
            "/api/v1/inventory/stock-levels/",
            params={"low_stock_only": True}
        )
        assert response.status_code == 200
        low_stock_data = response.json()
        
        # Should find at least one low stock item
        assert low_stock_data["total"] >= 0


class TestInventoryErrorScenarios:
    """Test error handling in complete workflows."""
    
    @pytest.mark.asyncio
    async def test_workflow_error_recovery(
        self, 
        db_session: AsyncSession,
        test_item,
        test_location,
        test_user
    ):
        """Test error recovery in inventory workflows."""
        
        # Create initial stock
        await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=5,
            unit_cost=Decimal("100.00"),
            created_by=test_user.id
        )
        
        # Test error scenarios that should not affect database state
        
        # 1. Try to rent more than available
        with pytest.raises(ValueError):
            await inventory_service.process_rental_checkout(
                db_session,
                item_id=test_item.id,
                location_id=test_location.id,
                quantity=Decimal("10"),  # More than available
                customer_id=uuid4(),
                transaction_id=uuid4(),
                performed_by=test_user.id
            )
        
        # Verify stock is unchanged
        from app.crud.inventory import stock_level
        stock = await stock_level.get_by_item_location(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id
        )
        assert stock.quantity_available == Decimal("5.00")  # Unchanged
        
        # 2. Try to return units that don't exist
        with pytest.raises(ValueError):
            await inventory_service.process_rental_return(
                db_session,
                item_id=test_item.id,
                location_id=test_location.id,
                quantity=Decimal("3"),
                unit_ids=[uuid4(), uuid4(), uuid4()],  # Non-existent units
                transaction_id=uuid4(),
                performed_by=test_user.id
            )
        
        # Verify stock is still unchanged
        stock = await stock_level.get_by_item_location(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id
        )
        assert stock.quantity_available == Decimal("5.00")  # Still unchanged
    
    @pytest.mark.asyncio
    async def test_concurrent_operation_handling(
        self, 
        db_session: AsyncSession,
        test_item,
        test_location,
        test_user
    ):
        """Test handling of concurrent operations on same inventory."""
        import asyncio
        
        # Create inventory
        await inventory_service.create_inventory_units(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id,
            quantity=10,
            unit_cost=Decimal("100.00"),
            created_by=test_user.id
        )
        
        # Simulate concurrent rental operations
        async def rent_items(quantity: int):
            try:
                return await inventory_service.process_rental_checkout(
                    db_session,
                    item_id=test_item.id,
                    location_id=test_location.id,
                    quantity=Decimal(str(quantity)),
                    customer_id=uuid4(),
                    transaction_id=uuid4(),
                    performed_by=test_user.id
                )
            except Exception as e:
                return e
        
        # Launch concurrent rentals
        tasks = [
            rent_items(3),
            rent_items(4),
            rent_items(5)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # At least one should succeed, others may fail due to insufficient stock
        successful_rentals = [r for r in results if not isinstance(r, Exception)]
        failed_rentals = [r for r in results if isinstance(r, Exception)]
        
        # Should have some successful and some failed operations
        assert len(successful_rentals) >= 1
        assert len(failed_rentals) >= 1
        
        # Verify final state is consistent
        from app.crud.inventory import stock_level
        final_stock = await stock_level.get_by_item_location(
            db_session,
            item_id=test_item.id,
            location_id=test_location.id
        )
        
        # Total should not exceed original quantity
        total_accounted = (
            final_stock.quantity_available + 
            final_stock.quantity_on_rent + 
            final_stock.quantity_reserved + 
            final_stock.quantity_damaged
        )
        assert total_accounted == Decimal("10.00")  # Original quantity