"""
Comprehensive API endpoint tests for Inventory endpoints.

Tests all inventory API endpoints with authentication, validation, error handling, and edge cases.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.models.inventory.enums import (
    StockMovementType,
    InventoryUnitStatus,
    InventoryUnitCondition,
    StockStatus
)
from app.schemas.inventory.stock_level import StockLevelFilter
from app.schemas.inventory.inventory_unit import InventoryUnitFilter
from app.schemas.inventory.stock_movement import StockMovementFilter


class TestStockLevelsAPI:
    """Test suite for Stock Levels API endpoints."""
    
    @pytest_asyncio.fixture
    async def mock_auth_user(self):
        """Mock authenticated user."""
        user = MagicMock(spec=User)
        user.id = uuid4()
        user.email = "test@example.com"
        user.is_active = True
        user.is_superuser = False
        return user
    
    @pytest_asyncio.fixture
    async def mock_stock_levels(self):
        """Mock stock level data."""
        return [
            {
                "id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "quantity_on_hand": Decimal("100.00"),
                "quantity_available": Decimal("90.00"),
                "quantity_reserved": Decimal("10.00"),
                "quantity_on_rent": Decimal("0.00"),
                "quantity_damaged": Decimal("0.00"),
                "stock_status": StockStatus.IN_STOCK,
                "reorder_point": Decimal("20.00"),
                "maximum_stock": Decimal("500.00"),
                "average_cost": Decimal("25.50"),
                "total_value": Decimal("2550.00"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "quantity_on_hand": Decimal("5.00"),
                "quantity_available": Decimal("5.00"),
                "quantity_reserved": Decimal("0.00"),
                "quantity_on_rent": Decimal("0.00"),
                "quantity_damaged": Decimal("0.00"),
                "stock_status": StockStatus.LOW_STOCK,
                "reorder_point": Decimal("10.00"),
                "maximum_stock": Decimal("100.00"),
                "average_cost": Decimal("15.00"),
                "total_value": Decimal("75.00"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_list_stock_levels_success(
        self,
        mock_auth_user,
        mock_stock_levels
    ):
        """Test successful stock levels listing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_level.build_filter_query") as mock_filter, \
                 patch("app.crud.inventory.stock_level.count", return_value=2), \
                 patch("app.crud.inventory.stock_level.get_multi", return_value=mock_stock_levels):
                
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={"skip": 0, "limit": 10}
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["skip"] == 0
        assert data["limit"] == 10
    
    @pytest.mark.asyncio
    async def test_list_stock_levels_with_filters(
        self,
        mock_auth_user,
        mock_stock_levels
    ):
        """Test stock levels listing with filters."""
        item_id = uuid4()
        location_id = uuid4()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_level.build_filter_query") as mock_filter, \
                 patch("app.crud.inventory.stock_level.count", return_value=1), \
                 patch("app.crud.inventory.stock_level.get_multi", return_value=[mock_stock_levels[0]]):
                
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={
                        "item_id": str(item_id),
                        "location_id": str(location_id),
                        "low_stock_only": True,
                        "include_zero": False
                    }
                )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify filter was called with correct parameters
        mock_filter.assert_called_once()
        filter_call = mock_filter.call_args[1]['filter_obj']
        assert filter_call.item_id == item_id
        assert filter_call.location_id == location_id
        assert filter_call.low_stock_only is True
        assert filter_call.include_zero is False
    
    @pytest.mark.asyncio
    async def test_list_stock_levels_pagination(
        self,
        mock_auth_user,
        mock_stock_levels
    ):
        """Test stock levels pagination."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_level.build_filter_query"), \
                 patch("app.crud.inventory.stock_level.count", return_value=100), \
                 patch("app.crud.inventory.stock_level.get_multi", return_value=mock_stock_levels):
                
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={"skip": 20, "limit": 50}
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["total"] == 100
        assert data["skip"] == 20
        assert data["limit"] == 50
    
    @pytest.mark.asyncio
    async def test_list_stock_levels_invalid_pagination(
        self,
        mock_auth_user
    ):
        """Test stock levels with invalid pagination parameters."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                # Test negative skip
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={"skip": -1, "limit": 10}
                )
                assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
                
                # Test limit too high
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={"skip": 0, "limit": 1000}
                )
                assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
                
                # Test limit too low
                response = await ac.get(
                    "/api/v1/inventory/stock-levels/",
                    params={"skip": 0, "limit": 0}
                )
                assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_get_stock_summary_success(
        self,
        mock_auth_user
    ):
        """Test successful stock summary retrieval."""
        mock_summary = {
            "total_on_hand": 500.0,
            "total_available": 450.0,
            "total_reserved": 50.0,
            "total_on_rent": 100.0,
            "total_damaged": 10.0,
            "total_value": 12500.0,
            "location_count": 5,
            "item_count": 25,
            "low_stock_count": 3,
            "utilization_rate": 20.0,
            "availability_rate": 90.0,
            "movement_summary": {
                "total_movements": 150,
                "total_increase": 600.0,
                "total_decrease": 100.0,
                "net_change": 500.0
            }
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.inventory.inventory_service.InventoryService.get_stock_summary", 
                       return_value=mock_summary):
                
                response = await ac.get("/api/v1/inventory/stock-levels/summary")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["total_on_hand"] == 500.0
        assert data["total_available"] == 450.0
        assert data["location_count"] == 5
        assert data["item_count"] == 25
        assert data["utilization_rate"] == 20.0
        assert "movement_summary" in data
    
    @pytest.mark.asyncio
    async def test_get_stock_summary_with_filters(
        self,
        mock_auth_user
    ):
        """Test stock summary with filters."""
        item_id = uuid4()
        location_id = uuid4()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.inventory.inventory_service.InventoryService.get_stock_summary") as mock_service:
                
                await ac.get(
                    "/api/v1/inventory/stock-levels/summary",
                    params={
                        "item_id": str(item_id),
                        "location_id": str(location_id)
                    }
                )
        
        # Verify service was called with filters
        mock_service.assert_called_once()
        call_args = mock_service.call_args[1]
        assert call_args["item_id"] == item_id
        assert call_args["location_id"] == location_id
    
    @pytest.mark.asyncio
    async def test_stock_levels_unauthenticated(self):
        """Test stock levels access without authentication."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.get("/api/v1/inventory/stock-levels/")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_adjust_stock_success(
        self,
        mock_auth_user
    ):
        """Test successful stock adjustment."""
        stock_level_id = uuid4()
        
        adjustment_data = {
            "item_id": str(uuid4()),
            "location_id": str(uuid4()),
            "adjustment_type": "positive",
            "adjustment": "10.00",
            "reason": "Physical count correction",
            "notes": "Found additional items",
            "affect_available": True
        }
        
        mock_stock = MagicMock()
        mock_movement = MagicMock()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.inventory.inventory_service.InventoryService.perform_stock_adjustment", 
                       return_value=(mock_stock, mock_movement)):
                
                response = await ac.post(
                    f"/api/v1/inventory/stock-levels/{stock_level_id}/adjust",
                    json=adjustment_data
                )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_adjust_stock_invalid_data(
        self,
        mock_auth_user
    ):
        """Test stock adjustment with invalid data."""
        stock_level_id = uuid4()
        
        invalid_data = {
            "adjustment": "invalid_number",  # Invalid decimal
            "reason": "",  # Empty reason
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                response = await ac.post(
                    f"/api/v1/inventory/stock-levels/{stock_level_id}/adjust",
                    json=invalid_data
                )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestStockMovementsAPI:
    """Test suite for Stock Movements API endpoints."""
    
    @pytest_asyncio.fixture
    async def mock_movements(self):
        """Mock stock movement data."""
        return [
            {
                "id": uuid4(),
                "stock_level_id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "movement_type": StockMovementType.PURCHASE,
                "quantity_change": Decimal("10.00"),
                "quantity_before": Decimal("90.00"),
                "quantity_after": Decimal("100.00"),
                "unit_cost": Decimal("25.50"),
                "total_cost": Decimal("255.00"),
                "reason": "Purchase order",
                "notes": "New inventory received",
                "movement_date": datetime.utcnow(),
                "performed_by_id": uuid4(),
                "created_at": datetime.utcnow()
            },
            {
                "id": uuid4(),
                "stock_level_id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "movement_type": StockMovementType.SALE,
                "quantity_change": Decimal("-5.00"),
                "quantity_before": Decimal("100.00"),
                "quantity_after": Decimal("95.00"),
                "reason": "Customer sale",
                "movement_date": datetime.utcnow(),
                "performed_by_id": uuid4(),
                "created_at": datetime.utcnow()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_list_stock_movements_success(
        self,
        mock_auth_user,
        mock_movements
    ):
        """Test successful stock movements listing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_movement.get_filtered", return_value=mock_movements), \
                 patch("app.crud.inventory.stock_movement.count", return_value=2):
                
                response = await ac.get("/api/v1/inventory/movements/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) == 2
        assert data["total"] == 2
    
    @pytest.mark.asyncio
    async def test_list_stock_movements_with_filters(
        self,
        mock_auth_user,
        mock_movements
    ):
        """Test stock movements listing with filters."""
        item_id = uuid4()
        movement_type = "purchase"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_movement.get_filtered") as mock_get, \
                 patch("app.crud.inventory.stock_movement.count", return_value=1):
                
                mock_get.return_value = [mock_movements[0]]  # Only purchase movement
                
                response = await ac.get(
                    "/api/v1/inventory/movements/",
                    params={
                        "item_id": str(item_id),
                        "movement_type": movement_type,
                        "date_from": "2024-01-01T00:00:00",
                        "date_to": "2024-12-31T23:59:59"
                    }
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 1
        
        # Verify filter was called with correct parameters
        mock_get.assert_called_once()
        filter_call = mock_get.call_args[1]['filter_params']
        assert filter_call.item_id == item_id
    
    @pytest.mark.asyncio
    async def test_get_movement_by_id_success(
        self,
        mock_auth_user,
        mock_movements
    ):
        """Test getting specific movement by ID."""
        movement_id = mock_movements[0]["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_movement.get", return_value=mock_movements[0]):
                
                response = await ac.get(f"/api/v1/inventory/movements/{movement_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(movement_id)
        assert data["movement_type"] == "purchase"
        assert data["quantity_change"] == "10.00"
    
    @pytest.mark.asyncio
    async def test_get_movement_by_id_not_found(
        self,
        mock_auth_user
    ):
        """Test getting non-existent movement."""
        movement_id = uuid4()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_movement.get", return_value=None):
                
                response = await ac.get(f"/api/v1/inventory/movements/{movement_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_get_movements_summary_success(
        self,
        mock_auth_user
    ):
        """Test getting movements summary."""
        mock_summary = {
            "total_movements": 50,
            "total_increase": 300.0,
            "total_decrease": 100.0,
            "net_change": 200.0,
            "movements_by_type": {
                "purchase": 20,
                "sale": 15,
                "adjustment_positive": 10,
                "adjustment_negative": 5
            },
            "quantity_by_type": {
                "purchase": 250.0,
                "sale": 80.0,
                "adjustment_positive": 50.0,
                "adjustment_negative": 20.0
            }
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_movement.get_summary", return_value=mock_summary):
                
                response = await ac.get("/api/v1/inventory/movements/summary")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["total_movements"] == 50
        assert data["net_change"] == 200.0
        assert "movements_by_type" in data
        assert "quantity_by_type" in data


class TestInventoryUnitsAPI:
    """Test suite for Inventory Units API endpoints."""
    
    @pytest_asyncio.fixture
    async def mock_units(self):
        """Mock inventory unit data."""
        return [
            {
                "id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "sku": "UNIT-0001",
                "serial_number": "SN001",
                "barcode": "BC001",
                "batch_code": "BATCH-001",
                "status": InventoryUnitStatus.AVAILABLE,
                "condition": InventoryUnitCondition.EXCELLENT,
                "purchase_date": datetime.now().date(),
                "purchase_price": Decimal("299.99"),
                "sale_price": Decimal("399.99"),
                "rental_rate_per_period": Decimal("29.99"),
                "is_rental_blocked": False,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": uuid4(),
                "item_id": uuid4(),
                "location_id": uuid4(),
                "sku": "UNIT-0002",
                "serial_number": "SN002",
                "status": InventoryUnitStatus.RENTED,
                "condition": InventoryUnitCondition.GOOD,
                "purchase_date": datetime.now().date(),
                "purchase_price": Decimal("199.99"),
                "is_rental_blocked": False,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_list_inventory_units_success(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test successful inventory units listing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_filtered", return_value=mock_units), \
                 patch("app.crud.inventory.inventory_unit.count", return_value=2):
                
                response = await ac.get("/api/v1/inventory/units/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) == 2
        assert data["total"] == 2
    
    @pytest.mark.asyncio
    async def test_list_inventory_units_with_filters(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test inventory units listing with filters."""
        item_id = uuid4()
        location_id = uuid4()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_filtered") as mock_get, \
                 patch("app.crud.inventory.inventory_unit.count", return_value=1):
                
                mock_get.return_value = [mock_units[0]]
                
                response = await ac.get(
                    "/api/v1/inventory/units/",
                    params={
                        "item_id": str(item_id),
                        "location_id": str(location_id),
                        "status": "available",
                        "condition": "excellent",
                        "is_available": True
                    }
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 1
        
        # Verify filter was applied
        mock_get.assert_called_once()
        filter_call = mock_get.call_args[1]['filter_params']
        assert filter_call.item_id == item_id
        assert filter_call.location_id == location_id
    
    @pytest.mark.asyncio
    async def test_get_unit_by_id_success(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test getting specific unit by ID."""
        unit_id = mock_units[0]["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get", return_value=mock_units[0]):
                
                response = await ac.get(f"/api/v1/inventory/units/{unit_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(unit_id)
        assert data["sku"] == "UNIT-0001"
        assert data["status"] == "available"
    
    @pytest.mark.asyncio
    async def test_get_unit_by_sku_success(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test getting unit by SKU."""
        sku = "UNIT-0001"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_by_sku", return_value=mock_units[0]):
                
                response = await ac.get(f"/api/v1/inventory/units/sku/{sku}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["sku"] == sku
        assert data["serial_number"] == "SN001"
    
    @pytest.mark.asyncio
    async def test_get_unit_by_sku_not_found(
        self,
        mock_auth_user
    ):
        """Test getting unit by non-existent SKU."""
        sku = "NON-EXISTENT"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_by_sku", return_value=None):
                
                response = await ac.get(f"/api/v1/inventory/units/sku/{sku}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_create_inventory_units_success(
        self,
        mock_auth_user
    ):
        """Test successful inventory units creation."""
        create_data = {
            "item_id": str(uuid4()),
            "location_id": str(uuid4()),
            "quantity": 3,
            "unit_cost": "25.00",
            "serial_numbers": ["SN001", "SN002", "SN003"],
            "batch_code": "BATCH-001",
            "supplier_id": str(uuid4()),
            "purchase_order_number": "PO-2024-001"
        }
        
        mock_units = [MagicMock() for _ in range(3)]
        mock_stock = MagicMock()
        mock_movement = MagicMock()
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.inventory.inventory_service.InventoryService.create_inventory_units", 
                       return_value=(mock_units, mock_stock, mock_movement)):
                
                response = await ac.post(
                    "/api/v1/inventory/units/",
                    json=create_data
                )
        
        assert response.status_code == status.HTTP_201_CREATED
    
    @pytest.mark.asyncio
    async def test_update_unit_status_success(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test successful unit status update."""
        unit_id = mock_units[0]["id"]
        
        status_data = {
            "status": "under_repair",
            "reason": "Maintenance required",
            "notes": "Motor needs servicing"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.change_status", return_value=mock_units[0]):
                
                response = await ac.patch(
                    f"/api/v1/inventory/units/{unit_id}/status",
                    json=status_data
                )
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_get_available_for_rental(
        self,
        mock_auth_user,
        mock_units
    ):
        """Test getting available units for rental."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock only available units
        available_units = [u for u in mock_units if u["status"] == InventoryUnitStatus.AVAILABLE]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_available_for_rental", 
                       return_value=available_units):
                
                response = await ac.get(
                    "/api/v1/inventory/units/available-for-rental",
                    params={
                        "item_id": str(item_id),
                        "location_id": str(location_id),
                        "quantity_needed": 2
                    }
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == len(available_units)
    
    @pytest.mark.asyncio
    async def test_get_maintenance_due(
        self,
        mock_auth_user
    ):
        """Test getting units with maintenance due."""
        maintenance_unit = {
            **mock_units[0],
            "next_maintenance_date": datetime.now() + timedelta(days=5)
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.inventory_unit.get_maintenance_due", 
                       return_value=[maintenance_unit]):
                
                response = await ac.get(
                    "/api/v1/inventory/units/maintenance-due",
                    params={"days_ahead": 7}
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert "next_maintenance_date" in data[0]


class TestSKUSequencesAPI:
    """Test suite for SKU Sequences API endpoints."""
    
    @pytest_asyncio.fixture
    async def mock_sequences(self):
        """Mock SKU sequence data."""
        return [
            {
                "id": uuid4(),
                "brand_id": uuid4(),
                "category_id": uuid4(),
                "prefix": "ELEC",
                "suffix": "END",
                "padding_length": 4,
                "format_template": "{prefix}-{sequence:0{padding}d}-{suffix}",
                "next_sequence": 42,
                "total_generated": 41,
                "last_generated_sku": "ELEC-0041-END",
                "last_generated_at": datetime.utcnow(),
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "id": uuid4(),
                "brand_id": uuid4(),
                "category_id": uuid4(),
                "prefix": "FURN",
                "suffix": "ITM",
                "padding_length": 5,
                "format_template": "{prefix}-{sequence:0{padding}d}-{suffix}",
                "next_sequence": 123,
                "total_generated": 122,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_list_sku_sequences_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful SKU sequences listing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.get_multi", return_value=mock_sequences):
                
                response = await ac.get("/api/v1/inventory/sku-sequences/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["prefix"] == "ELEC"
        assert data[1]["prefix"] == "FURN"
    
    @pytest.mark.asyncio
    async def test_get_sequence_by_id_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test getting specific sequence by ID."""
        sequence_id = mock_sequences[0]["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.get", return_value=mock_sequences[0]):
                
                response = await ac.get(f"/api/v1/inventory/sku-sequences/{sequence_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(sequence_id)
        assert data["prefix"] == "ELEC"
        assert data["next_sequence"] == 42
    
    @pytest.mark.asyncio
    async def test_create_sku_sequence_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful SKU sequence creation."""
        create_data = {
            "brand_id": str(uuid4()),
            "category_id": str(uuid4()),
            "prefix": "TEST",
            "suffix": "NEW",
            "padding_length": 6,
            "format_template": "{prefix}-{sequence:0{padding}d}-{suffix}",
            "is_active": True
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.create", return_value=mock_sequences[0]):
                
                response = await ac.post(
                    "/api/v1/inventory/sku-sequences/",
                    json=create_data
                )
        
        assert response.status_code == status.HTTP_201_CREATED
    
    @pytest.mark.asyncio
    async def test_generate_sku_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful SKU generation."""
        sequence_id = mock_sequences[0]["id"]
        
        generate_data = {
            "brand_code": "ELEC",
            "category_code": "COMP",
            "item_name": "Test Component"
        }
        
        mock_result = ("ELEC-0042-END", 42)
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.generate_sku", return_value=mock_result):
                
                response = await ac.post(
                    f"/api/v1/inventory/sku-sequences/{sequence_id}/generate",
                    json=generate_data
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["sku"] == "ELEC-0042-END"
        assert data["sequence_number"] == 42
    
    @pytest.mark.asyncio
    async def test_generate_bulk_skus_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful bulk SKU generation."""
        sequence_id = mock_sequences[0]["id"]
        
        bulk_data = {
            "count": 3,
            "brand_code": "ELEC",
            "category_code": "COMP",
            "item_names": ["Component 1", "Component 2", "Component 3"]
        }
        
        mock_skus = ["ELEC-0042-END", "ELEC-0043-END", "ELEC-0044-END"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.generate_bulk_skus", return_value=mock_skus):
                
                response = await ac.post(
                    f"/api/v1/inventory/sku-sequences/{sequence_id}/generate-bulk",
                    json=bulk_data
                )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["skus"] == mock_skus
        assert data["count"] == 3
    
    @pytest.mark.asyncio
    async def test_get_sequence_statistics(
        self,
        mock_auth_user
    ):
        """Test getting sequence statistics."""
        sequence_id = uuid4()
        
        mock_stats = {
            "sequence_id": sequence_id,
            "next_sequence": 100,
            "total_generated": 99,
            "last_generated_sku": "TEST-0099-END",
            "last_generated_at": datetime.utcnow(),
            "is_active": True,
            "prefix": "TEST",
            "suffix": "END",
            "padding_length": 4
        }
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.get_statistics", return_value=mock_stats):
                
                response = await ac.get(f"/api/v1/inventory/sku-sequences/{sequence_id}/statistics")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["next_sequence"] == 100
        assert data["total_generated"] == 99
        assert data["prefix"] == "TEST"
    
    @pytest.mark.asyncio
    async def test_activate_sequence_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful sequence activation."""
        sequence_id = mock_sequences[0]["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.activate_sequence", return_value=mock_sequences[0]):
                
                response = await ac.post(f"/api/v1/inventory/sku-sequences/{sequence_id}/activate")
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.asyncio
    async def test_deactivate_sequence_success(
        self,
        mock_auth_user,
        mock_sequences
    ):
        """Test successful sequence deactivation."""
        sequence_id = mock_sequences[0]["id"]
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.sku_sequence.deactivate_sequence", return_value=mock_sequences[0]):
                
                response = await ac.post(f"/api/v1/inventory/sku-sequences/{sequence_id}/deactivate")
        
        assert response.status_code == status.HTTP_200_OK


class TestInventoryAPIErrorHandling:
    """Test error handling across all inventory API endpoints."""
    
    @pytest.mark.asyncio
    async def test_invalid_uuid_parameters(self, mock_auth_user):
        """Test handling of invalid UUID parameters."""
        invalid_uuid = "not-a-uuid"
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user):
                
                # Test various endpoints with invalid UUIDs
                endpoints = [
                    f"/api/v1/inventory/stock-levels/{invalid_uuid}",
                    f"/api/v1/inventory/movements/{invalid_uuid}",
                    f"/api/v1/inventory/units/{invalid_uuid}",
                    f"/api/v1/inventory/sku-sequences/{invalid_uuid}"
                ]
                
                for endpoint in endpoints:
                    response = await ac.get(endpoint)
                    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_database_connection_error(self, mock_auth_user):
        """Test handling of database connection errors."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.crud.inventory.stock_level.get_multi", side_effect=Exception("Database error")):
                
                response = await ac.get("/api/v1/inventory/stock-levels/")
                assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    
    @pytest.mark.asyncio
    async def test_service_layer_errors(self, mock_auth_user):
        """Test handling of service layer errors."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=mock_auth_user), \
                 patch("app.services.inventory.inventory_service.InventoryService.get_stock_summary", 
                       side_effect=ValueError("Service error")):
                
                response = await ac.get("/api/v1/inventory/stock-levels/summary")
                assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    @pytest.mark.asyncio
    async def test_permission_errors(self):
        """Test handling of permission errors."""
        # Mock user without required permissions
        unauthorized_user = MagicMock(spec=User)
        unauthorized_user.id = uuid4()
        unauthorized_user.email = "user@example.com"
        unauthorized_user.is_active = True
        unauthorized_user.is_superuser = False
        
        async with AsyncClient(app=app, base_url="http://test") as ac:
            with patch("app.api.deps.get_current_user", return_value=unauthorized_user), \
                 patch("app.api.deps.check_permissions", side_effect=HTTPException(status_code=403)):
                
                response = await ac.post("/api/v1/inventory/units/")
                assert response.status_code == status.HTTP_403_FORBIDDEN