"""Integration tests for Unit of Measurement API."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.main import app
from app.models.unit_of_measurement import UnitOfMeasurement
from app.crud.unit_of_measurement import unit_of_measurement as crud_uom


@pytest.mark.asyncio
class TestUnitOfMeasurementAPI:
    """Test suite for Unit of Measurement API endpoints."""
    
    async def test_create_unit_of_measurement(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test creating a new unit of measurement."""
        unit_data = {
            "name": "Test Kilogram",
            "code": "KG",
            "description": "Standard unit of weight"
        }
        
        response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == unit_data["name"]
        assert data["code"] == unit_data["code"]
        assert data["description"] == unit_data["description"]
        assert data["is_active"] is True
        assert "id" in data
        assert "display_name" in data
        assert data["display_name"] == "Test Kilogram (KG)"
        
        # Verify in database
        db_unit = await crud_uom.get(db, id=data["id"])
        assert db_unit is not None
        assert db_unit.name == unit_data["name"]
    
    async def test_create_unit_duplicate_name(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test creating unit with duplicate name."""
        unit_data = {
            "name": "Duplicate Unit",
            "code": "DU1"
        }
        
        # Create first unit
        response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        
        # Try to create duplicate
        unit_data["code"] = "DU2"  # Different code
        response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    async def test_create_unit_duplicate_code(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test creating unit with duplicate code."""
        unit_data = {
            "name": "Unit One",
            "code": "SAME"
        }
        
        # Create first unit
        response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        assert response.status_code == 201
        
        # Try to create with same code
        unit_data["name"] = "Unit Two"  # Different name
        response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    async def test_get_unit_of_measurement(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test getting a unit by ID."""
        # Create a unit
        unit_data = {
            "name": "Test Meter",
            "code": "M",
            "description": "Standard unit of length"
        }
        
        create_response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        assert create_response.status_code == 201
        unit_id = create_response.json()["id"]
        
        # Get the unit
        response = await client.get(
            f"/api/v1/unit-of-measurement/{unit_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == unit_id
        assert data["name"] == unit_data["name"]
        assert data["code"] == unit_data["code"]
    
    async def test_get_unit_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict
    ):
        """Test getting non-existent unit."""
        fake_id = str(uuid4())
        
        response = await client.get(
            f"/api/v1/unit-of-measurement/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    async def test_list_units_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test listing units with pagination."""
        # Create multiple units
        for i in range(25):
            unit_data = {
                "name": f"Unit {i:03d}",
                "code": f"U{i:03d}",
                "description": f"Test unit {i}"
            }
            await client.post(
                "/api/v1/unit-of-measurement/",
                json=unit_data,
                headers=auth_headers
            )
        
        # Test first page
        response = await client.get(
            "/api/v1/unit-of-measurement/",
            params={"page": 1, "page_size": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["total"] >= 25
        assert data["has_next"] is True
        assert data["has_previous"] is False
        
        # Test second page
        response = await client.get(
            "/api/v1/unit-of-measurement/",
            params={"page": 2, "page_size": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["page"] == 2
        assert data["has_previous"] is True
    
    async def test_list_units_with_filters(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test listing units with filters."""
        # Create test units
        units = [
            {"name": "Kilogram", "code": "KG", "description": "Weight unit"},
            {"name": "Gram", "code": "G", "description": "Small weight unit"},
            {"name": "Meter", "code": "M", "description": "Length unit"},
            {"name": "Liter", "code": "L", "description": "Volume unit", "is_active": False}
        ]
        
        for unit in units:
            response = await client.post(
                "/api/v1/unit-of-measurement/",
                json=unit,
                headers=auth_headers
            )
            if not unit.get("is_active", True):
                unit_id = response.json()["id"]
                await client.post(
                    f"/api/v1/unit-of-measurement/{unit_id}/deactivate",
                    headers=auth_headers
                )
        
        # Filter by name
        response = await client.get(
            "/api/v1/unit-of-measurement/",
            params={"name": "gram"},
            headers=auth_headers
        )
        data = response.json()
        assert any("gram" in item["name"].lower() for item in data["items"])
        
        # Filter by code
        response = await client.get(
            "/api/v1/unit-of-measurement/",
            params={"code": "K"},
            headers=auth_headers
        )
        data = response.json()
        assert any("K" in item["code"] for item in data["items"])
        
        # Include inactive
        response = await client.get(
            "/api/v1/unit-of-measurement/",
            params={"include_inactive": True},
            headers=auth_headers
        )
        data = response.json()
        assert any(not item["is_active"] for item in data["items"])
    
    async def test_search_units(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test searching units."""
        # Create test units
        units = [
            {"name": "Square Meter", "code": "SQM", "description": "Area measurement"},
            {"name": "Cubic Meter", "code": "CBM", "description": "Volume measurement"},
            {"name": "Piece", "code": "PC", "description": "Quantity measurement"}
        ]
        
        for unit in units:
            await client.post(
                "/api/v1/unit-of-measurement/",
                json=unit,
                headers=auth_headers
            )
        
        # Search by term
        response = await client.get(
            "/api/v1/unit-of-measurement/search/",
            params={"q": "meter", "limit": 10},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        assert all("meter" in item["name"].lower() for item in data)
    
    async def test_update_unit(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test updating a unit."""
        # Create a unit
        unit_data = {
            "name": "Original Name",
            "code": "ON",
            "description": "Original description"
        }
        
        create_response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        unit_id = create_response.json()["id"]
        
        # Update the unit
        update_data = {
            "name": "Updated Name",
            "description": "Updated description"
        }
        
        response = await client.put(
            f"/api/v1/unit-of-measurement/{unit_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["code"] == unit_data["code"]  # Code unchanged
    
    async def test_delete_unit(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test deleting (deactivating) a unit."""
        # Create a unit
        unit_data = {
            "name": "To Delete",
            "code": "DEL"
        }
        
        create_response = await client.post(
            "/api/v1/unit-of-measurement/",
            json=unit_data,
            headers=auth_headers
        )
        unit_id = create_response.json()["id"]
        
        # Delete the unit
        response = await client.delete(
            f"/api/v1/unit-of-measurement/{unit_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify it's deactivated
        db_unit = await crud_uom.get(db, id=unit_id)
        assert db_unit is not None
        assert db_unit.is_active is False
    
    async def test_bulk_operations(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test bulk activation/deactivation."""
        # Create multiple units
        unit_ids = []
        for i in range(5):
            unit_data = {
                "name": f"Bulk Unit {i}",
                "code": f"BU{i}"
            }
            response = await client.post(
                "/api/v1/unit-of-measurement/",
                json=unit_data,
                headers=auth_headers
            )
            unit_ids.append(response.json()["id"])
        
        # Bulk deactivate
        response = await client.post(
            "/api/v1/unit-of-measurement/bulk-operation",
            json={
                "unit_ids": unit_ids,
                "operation": "deactivate"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 5
        assert data["failure_count"] == 0
        
        # Verify all are deactivated
        for unit_id in unit_ids:
            db_unit = await crud_uom.get(db, id=unit_id)
            assert db_unit.is_active is False
        
        # Bulk activate
        response = await client.post(
            "/api/v1/unit-of-measurement/bulk-operation",
            json={
                "unit_ids": unit_ids,
                "operation": "activate"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 5
        
        # Verify all are activated
        for unit_id in unit_ids:
            db_unit = await crud_uom.get(db, id=unit_id)
            assert db_unit.is_active is True
    
    async def test_get_statistics(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test getting unit statistics."""
        response = await client.get(
            "/api/v1/unit-of-measurement/stats/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total_units" in data
        assert "active_units" in data
        assert "inactive_units" in data
        assert "units_with_items" in data
        assert "units_without_items" in data
        assert "most_used_units" in data
        assert isinstance(data["most_used_units"], list)
    
    async def test_export_units(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test exporting units."""
        # Create some units
        for i in range(3):
            unit_data = {
                "name": f"Export Unit {i}",
                "code": f"EX{i}",
                "description": f"Unit for export {i}"
            }
            await client.post(
                "/api/v1/unit-of-measurement/",
                json=unit_data,
                headers=auth_headers
            )
        
        # Export units
        response = await client.get(
            "/api/v1/unit-of-measurement/export/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3
        
        # Check export format
        for unit in data:
            assert "id" in unit
            assert "name" in unit
            assert "code" in unit
            assert "is_active" in unit
            assert "created_at" in unit
    
    async def test_import_units(
        self,
        client: AsyncClient,
        db: AsyncSession,
        auth_headers: dict
    ):
        """Test importing units."""
        import_data = [
            {
                "name": "Import Unit 1",
                "code": "IMP1",
                "description": "First imported unit",
                "is_active": True
            },
            {
                "name": "Import Unit 2",
                "code": "IMP2",
                "description": "Second imported unit",
                "is_active": True
            },
            {
                "name": "Import Unit 3",
                "code": "IMP3",
                "description": "Third imported unit",
                "is_active": False
            }
        ]
        
        response = await client.post(
            "/api/v1/unit-of-measurement/import/",
            json=import_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_processed"] == 3
        assert data["successful_imports"] == 3
        assert data["failed_imports"] == 0
        assert data["skipped_imports"] == 0
        
        # Verify units were created
        for unit in import_data:
            db_unit = await crud_uom.get_by_name(db, name=unit["name"])
            assert db_unit is not None
            assert db_unit.code == unit["code"]
            assert db_unit.description == unit["description"]