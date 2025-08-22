"""
Rental analytics service for comprehensive rental performance metrics
"""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import logging

from .rental_analytics_repository import RentalAnalyticsRepository

logger = logging.getLogger(__name__)


class RentalAnalyticsService:
    """Service for comprehensive rental analytics operations"""
    
    def __init__(self):
        self.repo = RentalAnalyticsRepository()
    
    async def get_comprehensive_analytics(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        location_id: Optional[str] = None,
        category_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive rental analytics data
        
        Args:
            session: Database session
            start_date: Start date for analytics period
            end_date: End date for analytics period
            location_id: Optional location filter
            category_id: Optional category filter
            
        Returns:
            Comprehensive analytics data including summary, trends, and insights
        """
        try:
            # Validate date range
            if start_date >= end_date:
                raise ValueError("Start date must be before end date")
            
            # Limit date range to prevent performance issues
            max_days = 730  # 2 years
            if (end_date - start_date).days > max_days:
                raise ValueError(f"Date range cannot exceed {max_days} days")
            
            # Ensure dates are timezone aware
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            
            logger.info(
                f"Fetching rental analytics for period {start_date.date()} to {end_date.date()}"
                f"{f' for location {location_id}' if location_id else ''}"
                f"{f' for category {category_id}' if category_id else ''}"
            )
            
            # Get analytics data from repository
            analytics_data = await self.repo.get_comprehensive_analytics(
                session, start_date, end_date, location_id, category_id
            )
            
            # Post-process and enhance data
            enhanced_data = self._enhance_analytics_data(analytics_data, start_date, end_date)
            
            return {
                "success": True,
                "message": "Rental analytics data retrieved successfully",
                "data": enhanced_data,
                "metadata": {
                    "period_start": start_date.isoformat(),
                    "period_end": end_date.isoformat(),
                    "location_id": location_id,
                    "category_id": category_id,
                    "data_points": len(enhanced_data.get("revenue_trends", [])),
                    "top_items_count": len(enhanced_data.get("top_items", []))
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except ValueError as e:
            logger.warning(f"Invalid request parameters: {str(e)}")
            return {
                "success": False,
                "message": f"Invalid request: {str(e)}",
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error fetching rental analytics: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": "Failed to retrieve rental analytics data",
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    def _enhance_analytics_data(
        self, 
        data: Dict[str, Any], 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Enhance analytics data with additional calculations and formatting
        
        Args:
            data: Raw analytics data from repository
            start_date: Period start date
            end_date: Period end date
            
        Returns:
            Enhanced analytics data
        """
        enhanced_data = data.copy()
        
        # Enhance summary metrics
        if "summary" in enhanced_data:
            summary = enhanced_data["summary"]
            
            # Add period information
            period_days = (end_date - start_date).days
            summary["period_days"] = period_days
            
            # Add daily averages
            if period_days > 0:
                summary["daily_avg_rentals"] = round(summary["total_rentals"] / period_days, 2)
                summary["daily_avg_revenue"] = round(summary["total_revenue"] / period_days, 2)
            else:
                summary["daily_avg_rentals"] = 0
                summary["daily_avg_revenue"] = 0
        
        # Enhance revenue trends with additional metrics
        if "revenue_trends" in enhanced_data and enhanced_data["revenue_trends"]:
            trends = enhanced_data["revenue_trends"]
            
            # Calculate trend indicators
            if len(trends) >= 2:
                latest_revenue = trends[-1]["revenue"]
                previous_revenue = trends[-2]["revenue"]
                
                if previous_revenue > 0:
                    trend_change = ((latest_revenue - previous_revenue) / previous_revenue) * 100
                else:
                    trend_change = 0
                    
                enhanced_data["trend_indicator"] = {
                    "direction": "up" if trend_change > 0 else "down" if trend_change < 0 else "stable",
                    "percentage": round(abs(trend_change), 2),
                    "latest_revenue": latest_revenue,
                    "previous_revenue": previous_revenue
                }
        
        # Enhance category distribution with insights
        if "category_distribution" in enhanced_data and enhanced_data["category_distribution"]:
            categories = enhanced_data["category_distribution"]
            
            # Add colors for charts (cycling through predefined colors)
            colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']
            
            for i, category in enumerate(categories):
                category["color"] = colors[i % len(colors)]
        
        # Enhance top items with additional metrics
        if "top_items" in enhanced_data and enhanced_data["top_items"]:
            items = enhanced_data["top_items"]
            
            # Calculate revenue per rental for each item
            for item in items:
                if item["rental_count"] > 0:
                    item["revenue_per_rental"] = round(item["revenue"] / item["rental_count"], 2)
                else:
                    item["revenue_per_rental"] = 0
        
        # Fill gaps in daily activity if needed
        if "daily_activity" in enhanced_data:
            enhanced_data["daily_activity"] = self._fill_daily_activity_gaps(
                enhanced_data["daily_activity"], start_date, end_date
            )
        
        return enhanced_data
    
    def _fill_daily_activity_gaps(
        self, 
        daily_data: list, 
        start_date: datetime, 
        end_date: datetime
    ) -> list:
        """
        Fill gaps in daily activity data with zero values
        
        Args:
            daily_data: List of daily activity records
            start_date: Period start date
            end_date: Period end date
            
        Returns:
            Complete daily activity data with no gaps
        """
        if not daily_data:
            return []
        
        # Create a dictionary for quick lookup
        data_by_date = {item["date"]: item for item in daily_data if item["date"]}
        
        # Generate complete date range
        complete_data = []
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            date_str = current_date.isoformat()
            
            if date_str in data_by_date:
                complete_data.append(data_by_date[date_str])
            else:
                # Fill gap with zero values
                complete_data.append({
                    "date": date_str,
                    "rentals": 0,
                    "revenue": 0.0
                })
            
            current_date += timedelta(days=1)
        
        return complete_data
    
    async def get_analytics_summary_only(
        self,
        session: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        location_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get only summary metrics for lightweight requests
        
        Args:
            session: Database session
            start_date: Start date for analytics period
            end_date: End date for analytics period
            location_id: Optional location filter
            
        Returns:
            Summary analytics data only
        """
        try:
            # For summary-only requests, we can use the existing repository method
            # but extract only the summary portion
            analytics_data = await self.repo.get_comprehensive_analytics(
                session, start_date, end_date, location_id
            )
            
            return {
                "success": True,
                "message": "Rental analytics summary retrieved successfully",
                "data": {
                    "summary": analytics_data.get("summary", {}),
                    "top_performer": analytics_data.get("top_performer")
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error fetching rental analytics summary: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": "Failed to retrieve rental analytics summary",
                "data": None,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }