"""
Dashboard API Tests

Comprehensive test suite for dashboard analytics endpoints including:
- Dashboard overview API
- Financial performance API  
- Operational metrics API
- Inventory analytics API
- Customer insights API
- KPI endpoints API
- Cache refresh API
- Export functionality API
"""

import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.modules.analytics.dashboard_service import DashboardService
from app.modules.users.models import User
from app.core.cache import cache_manager


class TestDashboardOverviewAPI:
    """Test dashboard overview endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_success(self, auth_client: AsyncClient, test_user: User):
        """Test successful dashboard overview retrieval."""
        # Mock data
        mock_overview_data = {
            "revenue": {
                "current_period": 15000.00,
                "previous_period": 12000.00,
                "growth_rate": 25.0,
                "transaction_count": 45
            },
            "active_rentals": {
                "count": 23,
                "total_value": 8500.00,
                "average_value": 369.57
            },
            "inventory": {
                "total_items": 150,
                "rentable_items": 120,
                "rented_items": 23,
                "utilization_rate": 19.17
            },
            "customers": {
                "total": 67,
                "active": 45,
                "new": 8,
                "retention_rate": 85.5
            }
        }
        
        with patch.object(DashboardService, 'get_executive_summary', return_value=mock_overview_data):
            response = await auth_client.get(
                "/api/analytics/dashboard/overview",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "data" in data
        assert data["data"]["revenue"]["current_period"] == 15000.00
        assert data["data"]["active_rentals"]["count"] == 23
        assert data["data"]["inventory"]["utilization_rate"] == 19.17
        assert data["data"]["customers"]["retention_rate"] == 85.5
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_cached(self, auth_client: AsyncClient, test_user: User):
        """Test dashboard overview returns cached data."""
        # Pre-populate cache
        cache_key = f"dashboard:overview:2024-01-01:2024-01-31:{test_user.id}"
        cached_data = {"revenue": {"current_period": 10000.00}}
        await cache_manager.set(cache_key, {"success": True, "data": cached_data, "cached": True})
        
        response = await auth_client.get(
            "/api/analytics/dashboard/overview",
            params={
                "start_date": "2024-01-01", 
                "end_date": "2024-01-31"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["cached"] is True
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_no_date_range(self, auth_client: AsyncClient):
        """Test dashboard overview without date range parameters."""
        mock_overview_data = {"revenue": {"current_period": 0.00}}
        
        with patch.object(DashboardService, 'get_executive_summary', return_value=mock_overview_data):
            response = await auth_client.get("/api/analytics/dashboard/overview")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_unauthorized(self, client: AsyncClient):
        """Test dashboard overview requires authentication."""
        response = await client.get("/api/analytics/dashboard/overview")
        assert response.status_code == 401


class TestDashboardFinancialAPI:
    """Test financial performance endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_financial_performance_success(self, auth_client: AsyncClient):
        """Test successful financial performance retrieval."""
        mock_financial_data = {
            "revenue_summary": {
                "total_revenue": 25000.00,
                "rental_revenue": 18000.00,
                "sales_revenue": 7000.00,
                "growth_rate": 15.5
            },
            "revenue_by_category": [
                {"category": "Electronics", "revenue": 12000.00, "transactions": 35},
                {"category": "Tools", "revenue": 8000.00, "transactions": 22}
            ],
            "payment_collection": {
                "collection_rate": 92.5,
                "paid": 85,
                "partial": 12,
                "pending": 8
            },
            "outstanding_balances": {
                "total": 3500.00,
                "count": 8
            },
            "daily_trend": [
                {"date": "2024-01-01", "revenue": 1200.00, "transactions": 5},
                {"date": "2024-01-02", "revenue": 1800.00, "transactions": 7}
            ]
        }
        
        with patch.object(DashboardService, 'get_financial_performance', return_value=mock_financial_data):
            response = await auth_client.get(
                "/api/analytics/dashboard/financial",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["data"]["revenue_summary"]["total_revenue"] == 25000.00
        assert len(data["data"]["revenue_by_category"]) == 2
        assert data["data"]["payment_collection"]["collection_rate"] == 92.5
        assert len(data["data"]["daily_trend"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_financial_performance_service_error(self, auth_client: AsyncClient):
        """Test financial performance handles service errors."""
        with patch.object(DashboardService, 'get_financial_performance', side_effect=Exception("Database error")):
            response = await auth_client.get("/api/analytics/dashboard/financial")
        
        assert response.status_code == 500


class TestDashboardOperationalAPI:
    """Test operational metrics endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_operational_metrics_success(self, auth_client: AsyncClient):
        """Test successful operational metrics retrieval."""
        mock_operational_data = {
            "rental_duration": {
                "average": 7.5,
                "median": 7.0,
                "minimum": 1,
                "maximum": 30
            },
            "extensions": {
                "total_extensions": 15,
                "extended_rentals": 12,
                "extension_rate": 26.7,
                "total_extension_revenue": 1200.00
            },
            "returns": {
                "total_returns": 45,
                "on_time_returns": 38,
                "late_returns": 7,
                "on_time_rate": 84.4
            },
            "damage_stats": {
                "total_damaged": 3,
                "minor_damage": 2,
                "major_damage": 1,
                "total_damage_cost": 450.00
            }
        }
        
        with patch.object(DashboardService, 'get_operational_metrics', return_value=mock_operational_data):
            response = await auth_client.get("/api/analytics/dashboard/operational")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["data"]["rental_duration"]["average"] == 7.5
        assert data["data"]["extensions"]["extension_rate"] == 26.7
        assert data["data"]["returns"]["on_time_rate"] == 84.4
        assert data["data"]["damage_stats"]["total_damaged"] == 3


class TestDashboardInventoryAPI:
    """Test inventory analytics endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_inventory_analytics_success(self, auth_client: AsyncClient):
        """Test successful inventory analytics retrieval."""
        mock_inventory_data = {
            "stock_summary": {
                "total_items": 200,
                "available_items": 150,
                "rented_items": 45,
                "maintenance_items": 5,
                "utilization_rate": 22.5
            },
            "top_items": [
                {"name": "Professional Camera", "sku": "CAM-001", "rentals": 25, "revenue": 5000.00},
                {"name": "Audio Kit", "sku": "AUD-002", "rentals": 18, "revenue": 3600.00}
            ],
            "low_stock_alerts": [
                {"item": "Memory Card", "sku": "MEM-001", "location": "Main", "available": 2}
            ],
            "category_utilization": [
                {"category": "Electronics", "total": 50, "rented": 15, "utilization_rate": 30.0}
            ]
        }
        
        with patch.object(DashboardService, 'get_inventory_analytics', return_value=mock_inventory_data):
            response = await auth_client.get("/api/analytics/dashboard/inventory")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["data"]["stock_summary"]["utilization_rate"] == 22.5
        assert len(data["data"]["top_items"]) == 2
        assert len(data["data"]["low_stock_alerts"]) == 1


class TestDashboardCustomerAPI:
    """Test customer insights endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_customer_insights_success(self, auth_client: AsyncClient):
        """Test successful customer insights retrieval."""
        mock_customer_data = {
            "summary": {
                "total_customers": 120,
                "active_customers": 95,
                "new_customers": 15,
                "retention_rate": 88.5
            },
            "segmentation": {
                "new": 15,
                "returning": 45,
                "loyal": 35,
                "at_risk": 8
            },
            "top_customers": [
                {
                    "customer_name": "ABC Company",
                    "total_revenue": 12000.00,
                    "total_rentals": 45,
                    "avg_rental_value": 266.67
                }
            ],
            "lifetime_value": {
                "average_clv": 850.00,
                "median_clv": 650.00,
                "top_tier_clv": 2500.00
            }
        }
        
        with patch.object(DashboardService, 'get_customer_insights', return_value=mock_customer_data):
            response = await auth_client.get("/api/analytics/dashboard/customers")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["data"]["summary"]["retention_rate"] == 88.5
        assert data["data"]["segmentation"]["loyal"] == 35
        assert len(data["data"]["top_customers"]) == 1


class TestDashboardKPIAPI:
    """Test KPI metrics endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_kpis_success(self, auth_client: AsyncClient):
        """Test successful KPI retrieval."""
        mock_kpi_data = [
            {
                "name": "Monthly Revenue Target",
                "current_value": 18500.00,
                "target_value": 20000.00,
                "achievement_percentage": 92.5,
                "category": "revenue",
                "trend": "up"
            },
            {
                "name": "Inventory Utilization",
                "current_value": 75.0,
                "target_value": 80.0,
                "achievement_percentage": 93.75,
                "category": "inventory",
                "trend": "stable"
            }
        ]
        
        with patch.object(DashboardService, 'get_performance_indicators', return_value=mock_kpi_data):
            response = await auth_client.get("/api/analytics/dashboard/kpis")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert len(data["data"]) == 2
        assert data["data"][0]["achievement_percentage"] == 92.5
        assert data["data"][1]["category"] == "inventory"


class TestDashboardCacheAPI:
    """Test cache management endpoints."""
    
    @pytest.mark.asyncio
    async def test_refresh_cache_success(self, auth_client: AsyncClient):
        """Test successful cache refresh."""
        with patch.object(cache_manager, 'delete_pattern', return_value=5):
            response = await auth_client.post("/api/analytics/dashboard/refresh-cache")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "message" in data
        assert "patterns_cleared" in data
    
    @pytest.mark.asyncio
    async def test_refresh_cache_error(self, auth_client: AsyncClient):
        """Test cache refresh handles errors."""
        with patch.object(cache_manager, 'delete_pattern', side_effect=Exception("Cache error")):
            response = await auth_client.post("/api/analytics/dashboard/refresh-cache")
        
        assert response.status_code == 500


class TestDashboardExportAPI:
    """Test export functionality."""
    
    @pytest.mark.asyncio
    async def test_export_overview_json(self, auth_client: AsyncClient):
        """Test successful JSON export of overview data."""
        mock_data = {"revenue": {"current_period": 10000.00}}
        
        with patch.object(DashboardService, 'get_executive_summary', return_value=mock_data):
            response = await auth_client.get(
                "/api/analytics/dashboard/export",
                params={
                    "format": "json",
                    "report_type": "overview",
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["format"] == "json"
        assert data["report_type"] == "overview"
        assert "data" in data
    
    @pytest.mark.asyncio
    async def test_export_financial_json(self, auth_client: AsyncClient):
        """Test successful JSON export of financial data."""
        mock_data = {"revenue_summary": {"total_revenue": 25000.00}}
        
        with patch.object(DashboardService, 'get_financial_performance', return_value=mock_data):
            response = await auth_client.get(
                "/api/analytics/dashboard/export",
                params={
                    "format": "json",
                    "report_type": "financial"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["report_type"] == "financial"
    
    @pytest.mark.asyncio
    async def test_export_csv_not_implemented(self, auth_client: AsyncClient):
        """Test CSV export returns not implemented message."""
        response = await auth_client.get(
            "/api/analytics/dashboard/export",
            params={
                "format": "csv",
                "report_type": "overview"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "CSV export coming soon" in data["message"]
    
    @pytest.mark.asyncio
    async def test_export_invalid_format(self, auth_client: AsyncClient):
        """Test export with invalid format returns error."""
        response = await auth_client.get(
            "/api/analytics/dashboard/export",
            params={
                "format": "xml",
                "report_type": "overview"
            }
        )
        
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_export_invalid_report_type(self, auth_client: AsyncClient):
        """Test export with invalid report type returns error."""
        response = await auth_client.get(
            "/api/analytics/dashboard/export",
            params={
                "format": "json",
                "report_type": "invalid"
            }
        )
        
        assert response.status_code == 400


class TestDashboardIntegration:
    """Integration tests for dashboard API."""
    
    @pytest.mark.asyncio
    async def test_dashboard_workflow_complete(self, auth_client: AsyncClient):
        """Test complete dashboard workflow."""
        # 1. Get overview
        with patch.object(DashboardService, 'get_executive_summary', return_value={}):
            overview_response = await auth_client.get("/api/analytics/dashboard/overview")
            assert overview_response.status_code == 200
        
        # 2. Get financial data
        with patch.object(DashboardService, 'get_financial_performance', return_value={}):
            financial_response = await auth_client.get("/api/analytics/dashboard/financial")
            assert financial_response.status_code == 200
        
        # 3. Get KPIs
        with patch.object(DashboardService, 'get_performance_indicators', return_value=[]):
            kpi_response = await auth_client.get("/api/analytics/dashboard/kpis")
            assert kpi_response.status_code == 200
        
        # 4. Refresh cache
        with patch.object(cache_manager, 'delete_pattern', return_value=0):
            cache_response = await auth_client.post("/api/analytics/dashboard/refresh-cache")
            assert cache_response.status_code == 200
        
        # 5. Export data
        with patch.object(DashboardService, 'get_executive_summary', return_value={}):
            export_response = await auth_client.get(
                "/api/analytics/dashboard/export",
                params={"format": "json", "report_type": "overview"}
            )
            assert export_response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_dashboard_performance_caching(self, auth_client: AsyncClient, test_user: User):
        """Test dashboard caching improves performance."""
        # First request - hits database
        mock_data = {"revenue": {"current_period": 15000.00}}
        
        with patch.object(DashboardService, 'get_executive_summary', return_value=mock_data) as mock_service:
            response1 = await auth_client.get("/api/analytics/dashboard/overview")
            assert response1.status_code == 200
            assert mock_service.call_count == 1
        
        # Second request - should hit cache (mock won't be called again)
        with patch.object(DashboardService, 'get_executive_summary', return_value=mock_data) as mock_service:
            response2 = await auth_client.get("/api/analytics/dashboard/overview")
            assert response2.status_code == 200
            # Service should not be called due to caching
            assert mock_service.call_count == 0


# Fixtures for test setup
@pytest.fixture
async def auth_client():
    """Authenticated test client."""
    # Mock authentication for testing
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Add authentication headers or tokens as needed
        client.headers.update({"Authorization": "Bearer test-token"})
        yield client


@pytest.fixture
def test_user():
    """Mock test user."""
    return User(
        id="test-user-id",
        username="testuser",
        email="test@example.com",
        first_name="Test",
        last_name="User"
    )