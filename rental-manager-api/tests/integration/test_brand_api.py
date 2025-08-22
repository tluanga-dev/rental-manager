"""
Integration tests for Brand API endpoints
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
import json
from uuid import uuid4

from app.main import app
from app.models.brand import Brand


@pytest.mark.asyncio
class TestBrandAPIEndpoints:
    """Test Brand API endpoints."""
    
    async def test_create_brand_success(self, async_client: AsyncClient):
        """Test successful brand creation."""
        brand_data = {
            "name": "Test Brand",
            "code": "TST-001",
            "description": "Test brand description"
        }
        
        response = await async_client.post("/api/v1/brands/", json=brand_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Brand"
        assert data["code"] == "TST-001"
        assert data["description"] == "Test brand description"
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
    
    async def test_create_brand_minimal(self, async_client: AsyncClient):
        """Test creating brand with minimal data."""
        brand_data = {"name": "Minimal Brand"}
        
        response = await async_client.post("/api/v1/brands/", json=brand_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Brand"
        assert data["code"] is None
        assert data["description"] is None
    
    async def test_create_brand_duplicate_name(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test creating brand with duplicate name."""
        # Create first brand
        brand1 = Brand(name="Duplicate Test")
        db_session.add(brand1)
        await db_session.commit()
        
        # Try to create duplicate
        brand_data = {"name": "Duplicate Test"}
        response = await async_client.post("/api/v1/brands/", json=brand_data)
        
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    async def test_create_brand_duplicate_code(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test creating brand with duplicate code."""
        # Create first brand
        brand1 = Brand(name="Brand 1", code="DUP-CODE")
        db_session.add(brand1)
        await db_session.commit()
        
        # Try to create with duplicate code
        brand_data = {"name": "Brand 2", "code": "DUP-CODE"}
        response = await async_client.post("/api/v1/brands/", json=brand_data)
        
        assert response.status_code == 409
        assert "code" in response.json()["detail"].lower()
    
    async def test_create_brand_invalid_data(self, async_client: AsyncClient):
        """Test creating brand with invalid data."""
        # Empty name
        response = await async_client.post("/api/v1/brands/", json={"name": ""})
        assert response.status_code == 422
        
        # Name too long
        response = await async_client.post("/api/v1/brands/", json={"name": "A" * 101})
        assert response.status_code == 422
        
        # Invalid code characters
        response = await async_client.post("/api/v1/brands/", json={"name": "Test", "code": "INVALID@CODE"})
        assert response.status_code == 422
    
    async def test_get_brand_by_id(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test getting brand by ID."""
        # Create brand
        brand = Brand(name="Test Brand", code="TST-001")
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        response = await async_client.get(f"/api/v1/brands/{brand.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(brand.id)
        assert data["name"] == "Test Brand"
        assert data["code"] == "TST-001"
    
    async def test_get_brand_not_found(self, async_client: AsyncClient):
        """Test getting non-existent brand."""
        fake_id = str(uuid4())
        response = await async_client.get(f"/api/v1/brands/{fake_id}")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    async def test_list_brands_pagination(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test listing brands with pagination."""
        # Create multiple brands
        for i in range(25):
            brand = Brand(name=f"Brand {i:03d}", code=f"BRD-{i:03d}")
            db_session.add(brand)
        await db_session.commit()
        
        # Test first page
        response = await async_client.get("/api/v1/brands/?page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] >= 25
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["has_next"] is True
        assert data["has_previous"] is False
        
        # Test second page
        response = await async_client.get("/api/v1/brands/?page=2&page_size=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["page"] == 2
        assert data["has_previous"] is True
    
    async def test_list_brands_filtering(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test listing brands with filters."""
        # Create test brands
        brands = [
            Brand(name="Active Brand", code="ACT-001", is_active=True),
            Brand(name="Inactive Brand", code="INA-001", is_active=False),
            Brand(name="Tech Brand", code="TCH-001", is_active=True),
            Brand(name="Power Tools", code="PWR-001", is_active=True),
        ]
        for brand in brands:
            db_session.add(brand)
        await db_session.commit()
        
        # Filter by active status
        response = await async_client.get("/api/v1/brands/?is_active=true")
        data = response.json()
        assert all(item["is_active"] for item in data["items"])
        
        # Filter by name
        response = await async_client.get("/api/v1/brands/?name=Tech")
        data = response.json()
        assert any("Tech" in item["name"] for item in data["items"])
        
        # Filter by code
        response = await async_client.get("/api/v1/brands/?code=PWR")
        data = response.json()
        assert any("PWR" in item["code"] for item in data["items"])
    
    async def test_list_brands_sorting(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test listing brands with sorting."""
        # Create brands with different names
        brands = [
            Brand(name="Zebra Brand", code="ZBR-001"),
            Brand(name="Alpha Brand", code="ALP-001"),
            Brand(name="Middle Brand", code="MID-001"),
        ]
        for brand in brands:
            db_session.add(brand)
        await db_session.commit()
        
        # Sort by name ascending
        response = await async_client.get("/api/v1/brands/?sort_field=name&sort_direction=asc")
        data = response.json()
        names = [item["name"] for item in data["items"]]
        assert names == sorted(names)
        
        # Sort by name descending
        response = await async_client.get("/api/v1/brands/?sort_field=name&sort_direction=desc")
        data = response.json()
        names = [item["name"] for item in data["items"]]
        assert names == sorted(names, reverse=True)
    
    async def test_search_brands(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test searching brands."""
        # Create searchable brands
        brands = [
            Brand(name="PowerMax Tools", code="PMX-001", description="Power tools for professionals"),
            Brand(name="TechPro Equipment", code="TPE-001", description="Technical equipment"),
            Brand(name="Industrial Power", code="IND-001", description="Industrial grade power tools"),
        ]
        for brand in brands:
            db_session.add(brand)
        await db_session.commit()
        
        # Search for "Power"
        response = await async_client.get("/api/v1/brands/search/?q=Power")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        assert all("Power" in item["name"] or "Power" in (item.get("description") or "") 
                  for item in data)
    
    async def test_update_brand(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test updating a brand."""
        # Create brand
        brand = Brand(name="Original Name", code="ORIG", description="Original desc")
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        update_data = {
            "name": "Updated Name",
            "code": "UPD",
            "description": "Updated description"
        }
        
        response = await async_client.put(f"/api/v1/brands/{brand.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["code"] == "UPD"
        assert data["description"] == "Updated description"
    
    async def test_update_brand_partial(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test partial update of a brand."""
        # Create brand
        brand = Brand(name="Original", code="ORIG", description="Original desc")
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        # Update only name
        update_data = {"name": "Updated Name Only"}
        
        response = await async_client.put(f"/api/v1/brands/{brand.id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name Only"
        assert data["code"] == "ORIG"  # Unchanged
        assert data["description"] == "Original desc"  # Unchanged
    
    async def test_update_brand_not_found(self, async_client: AsyncClient):
        """Test updating non-existent brand."""
        fake_id = str(uuid4())
        update_data = {"name": "Updated"}
        
        response = await async_client.put(f"/api/v1/brands/{fake_id}", json=update_data)
        
        assert response.status_code == 404
    
    async def test_delete_brand(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test deleting a brand (soft delete)."""
        # Create brand
        brand = Brand(name="To Delete", code="DEL-001")
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        response = await async_client.delete(f"/api/v1/brands/{brand.id}")
        
        assert response.status_code == 204
        
        # Verify soft delete
        await db_session.refresh(brand)
        assert brand.is_active is False
    
    async def test_delete_brand_not_found(self, async_client: AsyncClient):
        """Test deleting non-existent brand."""
        fake_id = str(uuid4())
        
        response = await async_client.delete(f"/api/v1/brands/{fake_id}")
        
        assert response.status_code == 404
    
    async def test_activate_brand(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test activating a brand."""
        # Create inactive brand
        brand = Brand(name="Inactive", code="INA-001")
        brand.is_active = False
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        response = await async_client.post(f"/api/v1/brands/{brand.id}/activate")
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True
    
    async def test_deactivate_brand(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test deactivating a brand."""
        # Create active brand
        brand = Brand(name="Active", code="ACT-001")
        db_session.add(brand)
        await db_session.commit()
        await db_session.refresh(brand)
        
        response = await async_client.post(f"/api/v1/brands/{brand.id}/deactivate")
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
    
    async def test_bulk_operations(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test bulk operations on brands."""
        # Create multiple brands
        brand_ids = []
        for i in range(5):
            brand = Brand(name=f"Bulk Brand {i}", code=f"BLK-{i:03d}")
            db_session.add(brand)
            await db_session.flush()
            brand_ids.append(str(brand.id))
        await db_session.commit()
        
        # Bulk deactivate
        bulk_data = {
            "brand_ids": brand_ids,
            "operation": "deactivate"
        }
        
        response = await async_client.post("/api/v1/brands/bulk", json=bulk_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 5
        assert data["failure_count"] == 0
        
        # Bulk activate
        bulk_data["operation"] = "activate"
        
        response = await async_client.post("/api/v1/brands/bulk", json=bulk_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 5
    
    async def test_export_brands(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test exporting brands."""
        # Create brands for export
        for i in range(10):
            brand = Brand(
                name=f"Export Brand {i}",
                code=f"EXP-{i:03d}",
                description=f"Description {i}",
                is_active=(i % 2 == 0)
            )
            db_session.add(brand)
        await db_session.commit()
        
        # Export all brands
        response = await async_client.get("/api/v1/brands/export/?include_inactive=true")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 10
        
        # Verify export format
        for item in data:
            assert "id" in item
            assert "name" in item
            assert "code" in item
            assert "is_active" in item
            assert "created_at" in item
    
    async def test_import_brands(self, async_client: AsyncClient):
        """Test importing brands."""
        import_data = [
            {
                "name": "Import Brand 1",
                "code": "IMP-001",
                "description": "Imported brand 1",
                "is_active": True
            },
            {
                "name": "Import Brand 2",
                "code": "IMP-002",
                "description": "Imported brand 2",
                "is_active": True
            },
            {
                "name": "Import Brand 3",
                "code": "IMP-003",
                "description": "Imported brand 3",
                "is_active": False
            }
        ]
        
        response = await async_client.post("/api/v1/brands/import", json=import_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_processed"] == 3
        assert data["successful_imports"] == 3
        assert data["failed_imports"] == 0
    
    async def test_get_brand_statistics(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test getting brand statistics."""
        # Create brands with various states
        for i in range(15):
            brand = Brand(
                name=f"Stats Brand {i}",
                code=f"STA-{i:03d}",
                is_active=(i < 10)  # 10 active, 5 inactive
            )
            db_session.add(brand)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/brands/stats/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_brands"] >= 15
        assert data["active_brands"] >= 10
        assert data["inactive_brands"] >= 5
        assert "brands_with_items" in data
        assert "brands_without_items" in data


@pytest.mark.asyncio
class TestBrandAPIErrorHandling:
    """Test error handling in Brand API."""
    
    async def test_invalid_uuid_format(self, async_client: AsyncClient):
        """Test handling of invalid UUID format."""
        response = await async_client.get("/api/v1/brands/not-a-uuid")
        assert response.status_code == 422
    
    async def test_malformed_json(self, async_client: AsyncClient):
        """Test handling of malformed JSON."""
        response = await async_client.post(
            "/api/v1/brands/",
            content='{"name": "Test"',  # Missing closing brace
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    async def test_missing_required_fields(self, async_client: AsyncClient):
        """Test handling of missing required fields."""
        response = await async_client.post("/api/v1/brands/", json={})
        assert response.status_code == 422
        
        errors = response.json()["detail"]
        assert any("name" in str(error).lower() for error in errors)
    
    async def test_invalid_query_parameters(self, async_client: AsyncClient):
        """Test handling of invalid query parameters."""
        # Invalid page number
        response = await async_client.get("/api/v1/brands/?page=0")
        assert response.status_code == 422
        
        # Invalid page size
        response = await async_client.get("/api/v1/brands/?page_size=1000")
        assert response.status_code == 422
        
        # Invalid sort field
        response = await async_client.get("/api/v1/brands/?sort_field=invalid_field")
        assert response.status_code == 400