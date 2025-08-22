"""
Dashboard Service Tests

Unit tests for the DashboardService class covering:
- Executive summary calculations
- Financial performance metrics
- Operational analytics
- Inventory insights
- Customer segmentation
- KPI calculations
- Data aggregation logic
"""

import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.modules.analytics.dashboard_service import DashboardService
from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionType, TransactionStatus
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.customers.models import Customer


class TestDashboardServiceExecutiveSummary:
    """Test executive summary calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.fixture
    def mock_session(self):
        session = AsyncMock(spec=AsyncSession)
        return session
    
    @pytest.mark.asyncio
    async def test_get_executive_summary_success(self, dashboard_service, mock_session):
        """Test successful executive summary calculation."""
        # Mock database queries
        mock_session.execute.return_value.fetchall.return_value = [
            # Revenue query results
            (25000.00, 45, 20000.00, 38),  # current_revenue, current_count, previous_revenue, previous_count
        ]
        
        mock_session.execute.return_value.fetchone.side_effect = [
            (23, 8500.00),  # active rentals count, total value
            (150, 120, 23),  # total_items, rentable_items, rented_items
            (67, 45, 8, 85.5)  # total_customers, active, new, retention_rate
        ]
        
        result = await dashboard_service.get_executive_summary(
            mock_session, 
            datetime(2024, 1, 1), 
            datetime(2024, 1, 31)
        )
        
        assert result["revenue"]["current_period"] == 25000.00
        assert result["revenue"]["growth_rate"] == pytest.approx(25.0, rel=1e-2)
        assert result["active_rentals"]["count"] == 23
        assert result["inventory"]["utilization_rate"] == pytest.approx(19.17, rel=1e-2)
        assert result["customers"]["retention_rate"] == 85.5
    
    @pytest.mark.asyncio
    async def test_get_executive_summary_no_data(self, dashboard_service, mock_session):
        """Test executive summary with no data returns zeros."""
        mock_session.execute.return_value.fetchall.return_value = []
        mock_session.execute.return_value.fetchone.return_value = None
        
        result = await dashboard_service.get_executive_summary(mock_session)
        
        assert result["revenue"]["current_period"] == 0
        assert result["revenue"]["growth_rate"] == 0
        assert result["active_rentals"]["count"] == 0
        assert result["inventory"]["utilization_rate"] == 0
    
    @pytest.mark.asyncio
    async def test_get_executive_summary_division_by_zero(self, dashboard_service, mock_session):
        """Test executive summary handles division by zero gracefully."""
        mock_session.execute.return_value.fetchall.return_value = [
            (1000.00, 5, 0, 0),  # previous_revenue is 0
        ]
        mock_session.execute.return_value.fetchone.side_effect = [
            (0, 0),  # No active rentals
            (0, 0, 0),  # No inventory
            (0, 0, 0, 0)  # No customers
        ]
        
        result = await dashboard_service.get_executive_summary(mock_session)
        
        assert result["revenue"]["growth_rate"] == 0  # Should handle division by zero
        assert result["inventory"]["utilization_rate"] == 0


class TestDashboardServiceFinancialPerformance:
    """Test financial performance calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_get_financial_performance_success(self, dashboard_service, mock_session):
        """Test successful financial performance calculation."""
        # Mock revenue by category
        mock_session.execute.return_value.fetchall.side_effect = [
            [  # Revenue by category
                ("Electronics", 15000.00, 25, 60.0),
                ("Tools", 10000.00, 20, 40.0)
            ],
            [  # Revenue by type
                ("RENTAL", 18000.00, 35),
                ("SALE", 7000.00, 10)
            ],
            [  # Daily trend
                ("2024-01-01", 1200.00, 5),
                ("2024-01-02", 1800.00, 7)
            ]
        ]
        
        # Mock payment collection
        mock_session.execute.return_value.fetchone.side_effect = [
            (25000.00, 18000.00, 7000.00, 0, 15.5),  # Revenue summary
            (92.5, 38, 7, 5),  # Payment collection
            (3500.00, 5, 700.00)  # Outstanding balances
        ]
        
        result = await dashboard_service.get_financial_performance(mock_session)
        
        assert result["revenue_summary"]["total_revenue"] == 25000.00
        assert result["revenue_summary"]["growth_rate"] == 15.5
        assert len(result["revenue_by_category"]) == 2
        assert result["revenue_by_category"][0]["category"] == "Electronics"
        assert result["payment_collection"]["collection_rate"] == 92.5
        assert result["outstanding_balances"]["total"] == 3500.00
        assert len(result["daily_trend"]) == 2
    
    @pytest.mark.asyncio
    async def test_get_financial_performance_empty_categories(self, dashboard_service, mock_session):
        """Test financial performance with no category data."""
        mock_session.execute.return_value.fetchall.side_effect = [
            [],  # No category data
            [],  # No type data
            []   # No daily trend
        ]
        
        mock_session.execute.return_value.fetchone.side_effect = [
            (0, 0, 0, 0, 0),  # Revenue summary
            (0, 0, 0, 0),     # Payment collection
            (0, 0, 0)         # Outstanding balances
        ]
        
        result = await dashboard_service.get_financial_performance(mock_session)
        
        assert result["revenue_by_category"] == []
        assert result["revenue_by_type"] == []
        assert result["daily_trend"] == []


class TestDashboardServiceOperationalMetrics:
    """Test operational metrics calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_get_operational_metrics_success(self, dashboard_service, mock_session):
        """Test successful operational metrics calculation."""
        mock_session.execute.return_value.fetchone.side_effect = [
            (7.5, 7.0, 1, 30),  # Rental duration stats
            (15, 12, 26.7, 1200.00),  # Extension stats
            (45, 38, 7, 84.4),  # Return stats
            (3, 2, 1, 450.00)   # Damage stats
        ]
        
        result = await dashboard_service.get_operational_metrics(mock_session)
        
        assert result["rental_duration"]["average"] == 7.5
        assert result["rental_duration"]["median"] == 7.0
        assert result["extensions"]["extension_rate"] == 26.7
        assert result["returns"]["on_time_rate"] == 84.4
        assert result["damage_stats"]["total_damaged"] == 3
    
    @pytest.mark.asyncio
    async def test_get_operational_metrics_no_data(self, dashboard_service, mock_session):
        """Test operational metrics with no data."""
        mock_session.execute.return_value.fetchone.return_value = None
        
        result = await dashboard_service.get_operational_metrics(mock_session)
        
        assert result["rental_duration"]["average"] == 0
        assert result["extensions"]["extension_rate"] == 0
        assert result["returns"]["on_time_rate"] == 0
        assert result["damage_stats"]["total_damaged"] == 0


class TestDashboardServiceInventoryAnalytics:
    """Test inventory analytics calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_get_inventory_analytics_success(self, dashboard_service, mock_session):
        """Test successful inventory analytics calculation."""
        # Mock stock summary
        mock_session.execute.return_value.fetchone.return_value = (200, 150, 45, 5, 22.5)
        
        # Mock other queries
        mock_session.execute.return_value.fetchall.side_effect = [
            [  # Category utilization
                ("Electronics", 50, 15, 30.0),
                ("Tools", 75, 20, 26.7)
            ],
            [  # Location breakdown
                ("Main Warehouse", 100, 70, 25),
                ("Branch Office", 50, 35, 10)
            ],
            [  # Top items
                ("Professional Camera", "CAM-001", 25, 5000.00),
                ("Audio Kit", "AUD-002", 18, 3600.00)
            ],
            [  # Bottom items
                ("Old Tripod", "TRI-003", 2),
                ("Broken Lens", "LEN-004", 1)
            ],
            [  # Low stock alerts
                ("Memory Card", "MEM-001", "Main", 2, 10),
                ("Battery Pack", "BAT-002", "Branch", 1, 5)
            ]
        ]
        
        result = await dashboard_service.get_inventory_analytics(mock_session)
        
        assert result["stock_summary"]["utilization_rate"] == 22.5
        assert len(result["category_utilization"]) == 2
        assert len(result["location_breakdown"]) == 2
        assert len(result["top_items"]) == 2
        assert len(result["bottom_items"]) == 2
        assert len(result["low_stock_alerts"]) == 2
        assert result["top_items"][0]["name"] == "Professional Camera"


class TestDashboardServiceCustomerInsights:
    """Test customer insights calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_get_customer_insights_success(self, dashboard_service, mock_session):
        """Test successful customer insights calculation."""
        # Mock customer summary
        mock_session.execute.return_value.fetchone.side_effect = [
            (120, 95, 15, 10, 88.5),  # Customer summary
            (850.00, 650.00, 2500.00)  # Lifetime value
        ]
        
        # Mock segmentation
        mock_session.execute.return_value.fetchall.side_effect = [
            [  # Segmentation
                ("new", 15),
                ("returning", 45),
                ("loyal", 35),
                ("at_risk", 8)
            ],
            [  # Top customers
                ("test-id-1", "ABC Company", 12000.00, 45, 266.67, 5),
                ("test-id-2", "XYZ Corp", 8500.00, 30, 283.33, 12)
            ],
            [  # Activity trends
                ("2024-01", 8, 25, 33),
                ("2024-02", 12, 28, 40)
            ]
        ]
        
        result = await dashboard_service.get_customer_insights(mock_session)
        
        assert result["summary"]["retention_rate"] == 88.5
        assert result["segmentation"]["loyal"] == 35
        assert len(result["top_customers"]) == 2
        assert result["top_customers"][0]["customer_name"] == "ABC Company"
        assert result["lifetime_value"]["average_clv"] == 850.00
        assert len(result["activity_trends"]) == 2


class TestDashboardServiceKPIs:
    """Test KPI calculations."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_get_performance_indicators_success(self, dashboard_service, mock_session):
        """Test successful KPI calculation."""
        # Mock KPI data
        mock_session.execute.return_value.fetchall.return_value = [
            ("Monthly Revenue", 18500.00, 20000.00, "revenue", "%"),
            ("Inventory Utilization", 75.0, 80.0, "inventory", "%"),
            ("Customer Satisfaction", 4.2, 4.5, "customer", "rating"),
            ("Return Rate", 95.0, 98.0, "operational", "%")
        ]
        
        result = await dashboard_service.get_performance_indicators(mock_session)
        
        assert len(result) == 4
        
        # Check first KPI
        kpi1 = result[0]
        assert kpi1["name"] == "Monthly Revenue"
        assert kpi1["current_value"] == 18500.00
        assert kpi1["target_value"] == 20000.00
        assert kpi1["achievement_percentage"] == 92.5
        assert kpi1["category"] == "revenue"
        
        # Check inventory KPI
        kpi2 = result[1]
        assert kpi2["achievement_percentage"] == 93.75
        assert kpi2["category"] == "inventory"
    
    @pytest.mark.asyncio
    async def test_get_performance_indicators_division_by_zero(self, dashboard_service, mock_session):
        """Test KPI calculation handles division by zero."""
        mock_session.execute.return_value.fetchall.return_value = [
            ("Test KPI", 100.0, 0, "revenue", "%"),  # Target is 0
        ]
        
        result = await dashboard_service.get_performance_indicators(mock_session)
        
        assert len(result) == 1
        assert result[0]["achievement_percentage"] == 0  # Should handle division by zero
    
    @pytest.mark.asyncio
    async def test_get_performance_indicators_over_target(self, dashboard_service, mock_session):
        """Test KPI calculation with values over target."""
        mock_session.execute.return_value.fetchall.return_value = [
            ("Over Target KPI", 120.0, 100.0, "revenue", "%"),
        ]
        
        result = await dashboard_service.get_performance_indicators(mock_session)
        
        assert result[0]["achievement_percentage"] == 120.0  # Should allow > 100%


class TestDashboardServiceEdgeCases:
    """Test edge cases and error handling."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_database_error_handling(self, dashboard_service, mock_session):
        """Test service handles database errors gracefully."""
        mock_session.execute.side_effect = Exception("Database connection error")
        
        with pytest.raises(Exception):
            await dashboard_service.get_executive_summary(mock_session)
    
    @pytest.mark.asyncio
    async def test_date_range_validation(self, dashboard_service, mock_session):
        """Test service validates date ranges properly."""
        mock_session.execute.return_value.fetchall.return_value = []
        mock_session.execute.return_value.fetchone.return_value = None
        
        # Valid date range
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        
        result = await dashboard_service.get_executive_summary(
            mock_session, start_date, end_date
        )
        
        assert isinstance(result, dict)
        assert "revenue" in result
    
    @pytest.mark.asyncio
    async def test_none_date_handling(self, dashboard_service, mock_session):
        """Test service handles None dates (defaults to full range)."""
        mock_session.execute.return_value.fetchall.return_value = []
        mock_session.execute.return_value.fetchone.return_value = None
        
        result = await dashboard_service.get_executive_summary(mock_session, None, None)
        
        assert isinstance(result, dict)
        # Should execute without errors even with None dates
    
    @pytest.mark.asyncio
    async def test_large_numbers_handling(self, dashboard_service, mock_session):
        """Test service handles large numbers correctly."""
        mock_session.execute.return_value.fetchall.return_value = [
            (1000000.00, 500, 800000.00, 400),  # Large revenue numbers
        ]
        mock_session.execute.return_value.fetchone.side_effect = [
            (1000, 500000.00),  # Large rental values
            (10000, 8000, 1500),  # Large inventory numbers
            (5000, 4500, 200, 95.5)  # Large customer numbers
        ]
        
        result = await dashboard_service.get_executive_summary(mock_session)
        
        assert result["revenue"]["current_period"] == 1000000.00
        assert result["revenue"]["growth_rate"] == 25.0  # (1M - 800K) / 800K * 100
        assert result["active_rentals"]["total_value"] == 500000.00
        assert result["inventory"]["utilization_rate"] == pytest.approx(18.75, rel=1e-2)


class TestDashboardServiceDateFiltering:
    """Test date filtering functionality."""
    
    @pytest.fixture
    def dashboard_service(self):
        return DashboardService()
    
    @pytest.mark.asyncio
    async def test_date_filtering_applied_correctly(self, dashboard_service, mock_session):
        """Test that date filters are applied in SQL queries."""
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        
        mock_session.execute.return_value.fetchall.return_value = []
        mock_session.execute.return_value.fetchone.return_value = None
        
        await dashboard_service.get_executive_summary(mock_session, start_date, end_date)
        
        # Verify that execute was called (indicating queries were built)
        assert mock_session.execute.called
        
        # Check that the SQL queries contain date filtering
        call_args = mock_session.execute.call_args_list
        for call in call_args:
            query = str(call[0][0])
            # Should contain date filtering logic
            assert any(keyword in query.lower() for keyword in ['where', 'between', 'date'])


# Performance and integration test fixtures
@pytest.fixture
def mock_session():
    """Mock async session for testing."""
    session = AsyncMock(spec=AsyncSession)
    return session