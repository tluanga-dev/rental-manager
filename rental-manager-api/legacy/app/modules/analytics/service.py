"""
Analytics service for rental dashboard
"""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta

from .repository import AnalyticsRepository


class AnalyticsService:
    """Service for analytics operations"""
    
    def __init__(self):
        self.repo = AnalyticsRepository()
    
    async def get_rental_dashboard(self, session: AsyncSession) -> Dict[str, Any]:
        """Get rental dashboard data"""
        
        dashboard_data = await self.repo.get_dashboard_summary(session)
        
        return {
            "success": True,
            "message": "Dashboard data retrieved successfully",
            "data": dashboard_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_financial_dashboard(
        self, 
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get comprehensive financial dashboard data with real period comparisons"""
        
        # Get base dashboard data
        dashboard_data = await self.repo.get_financial_dashboard_summary(
            session, start_date, end_date
        )
        
        # Calculate period for comparison (same duration as current period)
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        period_duration = end_date - start_date
        previous_end = start_date - timedelta(days=1)
        previous_start = previous_end - period_duration
        
        # Get period comparison data
        period_comparison = await self.repo.get_period_comparison(
            session, start_date, end_date, previous_start, previous_end
        )
        
        # Add real percentage changes to the dashboard data
        dashboard_data["period_comparison"] = period_comparison
        
        return {
            "success": True,
            "message": "Financial dashboard data retrieved successfully",
            "data": dashboard_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_revenue_trends(
        self,
        session: AsyncSession,
        period: str = "monthly",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get revenue trends over time"""
        
        trends_data = await self.repo.get_revenue_trends(
            session, period, start_date, end_date
        )
        
        return {
            "success": True,
            "message": f"Revenue trends ({period}) retrieved successfully",
            "data": trends_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_cash_flow_analysis(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get cash flow analysis"""
        
        cashflow_data = await self.repo.get_cash_flow_analysis(
            session, start_date, end_date
        )
        
        return {
            "success": True,
            "message": "Cash flow analysis retrieved successfully",
            "data": cashflow_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_receivables_aging(
        self,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Get receivables aging analysis"""
        
        aging_data = await self.repo.get_receivables_aging(session)
        
        return {
            "success": True,
            "message": "Receivables aging analysis retrieved successfully",
            "data": aging_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_rental_utilization(
        self,
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get rental utilization metrics"""
        
        utilization_data = await self.repo.get_rental_utilization_metrics(
            session, start_date, end_date
        )
        
        return {
            "success": True,
            "message": "Rental utilization metrics retrieved successfully",
            "data": utilization_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def get_customer_lifetime_value(
        self,
        session: AsyncSession,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get customer lifetime value analysis"""
        
        clv_data = await self.repo.get_customer_lifetime_value(session, limit)
        
        return {
            "success": True,
            "message": "Customer lifetime value analysis retrieved successfully",
            "data": clv_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }