"""
Pydantic schemas for comprehensive rental analytics data
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, validator


class RentalSummary(BaseModel):
    """Rental analytics summary metrics"""
    total_rentals: int = Field(description="Total number of rentals in the period")
    total_revenue: float = Field(description="Total revenue from rentals in the period")
    average_rental_value: float = Field(description="Average value per rental transaction")
    unique_customers: int = Field(description="Number of unique customers with rentals")
    growth_rate: float = Field(description="Growth rate compared to previous period (%)")
    period_label: str = Field(description="Human-readable period description")
    period_days: Optional[int] = Field(description="Number of days in the period")
    daily_avg_rentals: Optional[float] = Field(description="Average rentals per day")
    daily_avg_revenue: Optional[float] = Field(description="Average revenue per day")


class TopPerformer(BaseModel):
    """Top performing item data"""
    item_id: str = Field(description="Item UUID")
    item_name: str = Field(description="Item name")
    sku: Optional[str] = Field(description="Item SKU")
    category: str = Field(description="Item category name")
    rental_count: int = Field(description="Number of times rented")
    revenue: float = Field(description="Total revenue generated")


class RevenueTrend(BaseModel):
    """Revenue trend data point"""
    period: str = Field(description="Period label (date or period name)")
    rentals: int = Field(description="Number of rentals in this period")
    revenue: float = Field(description="Revenue for this period")
    date: Optional[str] = Field(description="ISO date string for the period")


class TrendIndicator(BaseModel):
    """Trend analysis indicator"""
    direction: str = Field(description="Trend direction: up, down, or stable")
    percentage: float = Field(description="Percentage change")
    latest_revenue: float = Field(description="Most recent period revenue")
    previous_revenue: float = Field(description="Previous period revenue")


class CategoryDistribution(BaseModel):
    """Category distribution data"""
    name: str = Field(description="Category name")
    value: int = Field(description="Number of rentals")
    revenue: float = Field(description="Revenue from this category")
    percentage: float = Field(description="Percentage of total rentals")
    color: Optional[str] = Field(description="Chart color for this category")


class TopItem(BaseModel):
    """Top rented item with performance metrics"""
    rank: int = Field(description="Ranking by rental count")
    item_id: str = Field(description="Item UUID")
    item_name: str = Field(description="Item name")
    category: str = Field(description="Item category name")
    rental_count: int = Field(description="Total number of rentals")
    revenue: float = Field(description="Total revenue generated")
    avg_duration: float = Field(description="Average rental duration in days")
    performance_percentage: float = Field(description="Performance relative to top item (%)")
    revenue_per_rental: Optional[float] = Field(description="Average revenue per rental")


class DailyActivity(BaseModel):
    """Daily rental activity data"""
    date: str = Field(description="Date in ISO format (YYYY-MM-DD)")
    rentals: int = Field(description="Number of rentals on this date")
    revenue: float = Field(description="Revenue for this date")


class PeakCategoryInsight(BaseModel):
    """Peak category insight data"""
    name: str = Field(description="Category name")
    percentage: float = Field(description="Percentage of total rentals")
    trend: str = Field(description="Human-readable trend description")


class GrowthTrendInsight(BaseModel):
    """Growth trend insight data"""
    percentage: float = Field(description="Growth percentage")
    direction: str = Field(description="Growth direction")
    comparison: str = Field(description="Human-readable comparison")


class AvgDurationInsight(BaseModel):
    """Average duration insight data"""
    days: float = Field(description="Average rental duration in days")
    trend: str = Field(description="Human-readable trend description")


class AnalyticsInsights(BaseModel):
    """Key insights from analytics data"""
    peak_category: PeakCategoryInsight
    growth_trend: GrowthTrendInsight
    avg_duration: AvgDurationInsight


class AnalyticsMetadata(BaseModel):
    """Metadata about the analytics request and response"""
    period_start: str = Field(description="Period start date (ISO format)")
    period_end: str = Field(description="Period end date (ISO format)")
    location_id: Optional[str] = Field(description="Location filter UUID")
    category_id: Optional[str] = Field(description="Category filter UUID")
    data_points: int = Field(description="Number of trend data points")
    top_items_count: int = Field(description="Number of top items returned")


class ComprehensiveAnalyticsData(BaseModel):
    """Complete comprehensive analytics data structure"""
    summary: RentalSummary
    top_performer: Optional[TopPerformer]
    revenue_trends: List[RevenueTrend]
    category_distribution: List[CategoryDistribution]
    top_items: List[TopItem]
    daily_activity: List[DailyActivity]
    insights: AnalyticsInsights
    trend_indicator: Optional[TrendIndicator] = Field(description="Trend analysis if available")


class ComprehensiveAnalyticsResponse(BaseModel):
    """Complete rental analytics response"""
    success: bool = True
    message: str = Field(default="Rental analytics data retrieved successfully")
    data: Optional[ComprehensiveAnalyticsData]
    metadata: Optional[AnalyticsMetadata]
    timestamp: str = Field(description="Response timestamp (ISO format)")


class SummaryAnalyticsData(BaseModel):
    """Summary-only analytics data structure"""
    summary: RentalSummary
    top_performer: Optional[TopPerformer]


class SummaryAnalyticsResponse(BaseModel):
    """Summary-only rental analytics response"""
    success: bool = True
    message: str = Field(default="Rental analytics summary retrieved successfully")
    data: Optional[SummaryAnalyticsData]
    timestamp: str = Field(description="Response timestamp (ISO format)")


class AnalyticsRequest(BaseModel):
    """Request parameters for rental analytics"""
    start_date: datetime = Field(description="Start date for analytics period")
    end_date: datetime = Field(description="End date for analytics period")
    location_id: Optional[str] = Field(None, description="Optional location UUID filter")
    category_id: Optional[str] = Field(None, description="Optional category UUID filter")
    
    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v
    
    @validator('start_date', 'end_date')
    def dates_not_future(cls, v):
        if v > datetime.utcnow():
            raise ValueError('Date cannot be in the future')
        return v


class ErrorResponse(BaseModel):
    """Error response for analytics endpoints"""
    success: bool = False
    message: str = Field(description="Error message")
    data: None = None
    timestamp: str = Field(description="Response timestamp (ISO format)")
    error_code: Optional[str] = Field(description="Error code for client handling")


# Union type for all possible responses
AnalyticsResponse = Union[
    ComprehensiveAnalyticsResponse,
    SummaryAnalyticsResponse,
    ErrorResponse
]


class AnalyticsFilters(BaseModel):
    """Filters that can be applied to analytics queries"""
    location_ids: Optional[List[str]] = Field(None, description="List of location UUIDs")
    category_ids: Optional[List[str]] = Field(None, description="List of category UUIDs")
    customer_segment: Optional[str] = Field(None, description="Customer segment filter")
    min_rental_value: Optional[float] = Field(None, description="Minimum rental value filter")
    max_rental_value: Optional[float] = Field(None, description="Maximum rental value filter")
    item_status: Optional[List[str]] = Field(None, description="Item status filters")


class ExtendedAnalyticsRequest(AnalyticsRequest):
    """Extended analytics request with additional filters"""
    filters: Optional[AnalyticsFilters] = Field(None, description="Additional filters")
    include_trends: bool = Field(True, description="Include revenue trends")
    include_categories: bool = Field(True, description="Include category distribution")
    include_items: bool = Field(True, description="Include top items")
    include_daily: bool = Field(True, description="Include daily activity")
    top_items_limit: int = Field(15, description="Number of top items to return", ge=1, le=100)


# Export schemas for easy importing
__all__ = [
    'RentalSummary',
    'TopPerformer',
    'RevenueTrend',
    'CategoryDistribution',
    'TopItem',
    'DailyActivity',
    'AnalyticsInsights',
    'ComprehensiveAnalyticsData',
    'ComprehensiveAnalyticsResponse',
    'SummaryAnalyticsData',
    'SummaryAnalyticsResponse',
    'AnalyticsRequest',
    'ErrorResponse',
    'AnalyticsResponse',
    'AnalyticsFilters',
    'ExtendedAnalyticsRequest'
]