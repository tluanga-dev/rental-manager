"""
Dashboard API Routes
Provides comprehensive analytics endpoints for the reporting dashboard
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
from datetime import datetime, date
import logging

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from .dashboard_service import DashboardService
from app.core.cache import cache
from app.core.permissions_enhanced import PermissionChecker

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard Analytics"]
)

dashboard_service = DashboardService()


@router.get(
    "/overview",
    response_model=Dict[str, Any],
    summary="Get dashboard overview",
    description="Get comprehensive dashboard overview with key metrics and KPIs"
)
async def get_dashboard_overview(
    start_date: Optional[date] = Query(None, description="Start date for analytics (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date for analytics (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get dashboard overview with executive summary.
    
    Returns:
    - Revenue metrics with growth rates
    - Active rentals summary
    - Customer acquisition and retention
    - Inventory utilization
    
    The data is cached for 5 minutes to improve performance.
    """
    
    # Log user information for debugging
    logger.info(f"Dashboard overview requested by user: {current_user.username} (ID: {current_user.id})")
    logger.info(f"User is_superuser: {current_user.is_superuser}, is_active: {current_user.is_active}")
    
    # Check if user has analytics permission
    has_analytics_perm = current_user.has_permission("ANALYTICS_VIEW") if hasattr(current_user, 'has_permission') else current_user.is_superuser
    logger.info(f"User has ANALYTICS_VIEW permission: {has_analytics_perm}")
    
    try:
        # Convert dates to datetime if provided
        start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
        
        # Try to get from cache first
        cache_key = f"dashboard:overview:{start_date}:{end_date}:{current_user.id}"
        cached_data = await cache.get(cache_key)
        
        if cached_data:
            logger.info(f"Returning cached dashboard overview for user {current_user.username}")
            return cached_data
        
        # Get fresh data
        data = await dashboard_service.get_executive_summary(
            session, start_dt, end_dt
        )
        
        # Cache for 5 minutes
        await cache.set(cache_key, data, ttl=300)
        
        logger.info(f"Dashboard overview retrieved for user {current_user.username}")
        return {
            "success": True,
            "data": data,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# UNUSED BY FRONTEND - Commented out for optimization
# @router.get(
#     "/operational",
#     response_model=Dict[str, Any],
#     summary="Get operational metrics",
#     description="Get detailed operational performance metrics"
# )
# async def get_operational_metrics(
#     start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
#     end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
#     session: AsyncSession = Depends(get_session),
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Get operational performance metrics.
#     
#     Returns:
#     - Average rental duration and trends
#     - Extension rates and revenue
#     - Return performance (on-time vs late)
#     - Damage and repair statistics
#     """
#     
#     try:
#         start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
#         end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
#         
#         data = await dashboard_service.get_operational_metrics(
#             session, start_dt, end_dt
#         )
#         
#         logger.info(f"Operational metrics retrieved for user {current_user.username}")
#         return {
#             "success": True,
#             "data": data
#         }
#         
#     except Exception as e:
#         logger.error(f"Error getting operational metrics: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/financial",
    response_model=Dict[str, Any],
    summary="Get financial performance",
    description="Get detailed financial performance analytics"
)
async def get_financial_performance(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get financial performance metrics.
    
    Returns:
    - Revenue breakdown by category
    - Revenue by transaction type
    - Payment collection metrics
    - Outstanding balances
    - Daily revenue trends
    """
    
    try:
        start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
        
        # Cache key includes dates and user
        cache_key = f"dashboard:financial:{start_date}:{end_date}:{current_user.id}"
        cached_data = await cache.get(cache_key)
        
        if cached_data:
            return cached_data
        
        data = await dashboard_service.get_financial_performance(
            session, start_dt, end_dt
        )
        
        # Cache for 10 minutes
        await cache.set(cache_key, data, ttl=600)
        
        logger.info(f"Financial performance retrieved for user {current_user.username}")
        return {
            "success": True,
            "data": data,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error getting financial performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/inventory",
    response_model=Dict[str, Any],
    summary="Get inventory analytics",
    description="Get inventory insights and stock analytics"
)
async def get_inventory_analytics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get inventory analytics.
    
    Returns:
    - Stock levels and values
    - Top performing items (most rented)
    - Bottom performing items (least rented)
    - Low stock alerts
    - Stock movement trends
    """
    
    try:
        # Cache for 15 minutes as inventory doesn't change frequently
        cache_key = f"dashboard:inventory:{current_user.id}"
        cached_data = await cache.get(cache_key)
        
        if cached_data:
            return cached_data
        
        data = await dashboard_service.get_inventory_analytics(session)
        
        await cache.set(cache_key, data, ttl=900)
        
        logger.info(f"Inventory analytics retrieved for user {current_user.username}")
        return {
            "success": True,
            "data": data,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error getting inventory analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/customers",
    response_model=Dict[str, Any],
    summary="Get customer insights",
    description="Get customer analytics and segmentation"
)
async def get_customer_insights(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get customer insights and analytics.
    
    Returns:
    - Top customers by revenue
    - Customer segmentation (new, returning, inactive)
    - Customer lifetime value metrics
    - Activity trends over time
    """
    
    try:
        start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
        
        data = await dashboard_service.get_customer_insights(
            session, start_dt, end_dt
        )
        
        logger.info(f"Customer insights retrieved for user {current_user.username}")
        return {
            "success": True,
            "data": data
        }
        
    except Exception as e:
        logger.error(f"Error getting customer insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# UNUSED BY FRONTEND - Commented out for optimization
# @router.get(
#     "/kpis",
#     response_model=Dict[str, Any],
#     summary="Get KPI metrics",
#     description="Get key performance indicators with targets and achievements"
# )
# async def get_performance_indicators(
#     session: AsyncSession = Depends(get_session),
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Get key performance indicators.
#     
#     Returns KPIs with:
#     - Current value
#     - Target value
#     - Achievement percentage
#     
#     Categories:
#     - Revenue KPIs
#     - Operational KPIs
#     - Customer KPIs
#     - Inventory KPIs
#     """
#     
#     try:
#         # Cache KPIs for 30 minutes
#         cache_key = f"dashboard:kpis:{current_user.id}"
#         cached_data = await cache.get(cache_key)
#         
#         if cached_data:
#             return cached_data
#         
#         data = await dashboard_service.get_performance_indicators(session)
#         
#         await cache.set(cache_key, data, ttl=1800)
#         
#         logger.info(f"KPIs retrieved for user {current_user.username}")
#         return {
#             "success": True,
#             "data": data,
#             "cached": False
#         }
#         
#     except Exception as e:
#         logger.error(f"Error getting KPIs: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/refresh-cache",
    response_model=Dict[str, Any],
    summary="Refresh dashboard cache",
    description="Clear dashboard cache to force fresh data retrieval"
)
async def refresh_dashboard_cache(
    current_user: User = Depends(get_current_user)
):
    """
    Clear dashboard cache for the current user.
    
    This forces the next dashboard request to fetch fresh data
    from the database instead of using cached values.
    """
    
    try:
        # Clear all dashboard cache keys for the user
        cache_patterns = [
            f"dashboard:overview:*:{current_user.id}",
            f"dashboard:financial:*:{current_user.id}",
            f"dashboard:inventory:{current_user.id}",
            f"dashboard:kpis:{current_user.id}"
        ]
        
        cleared_count = 0
        for pattern in cache_patterns:
            # Note: This assumes the cache manager supports pattern deletion
            # If not, you'll need to track keys or implement pattern matching
            try:
                await cache.delete_pattern(pattern)
                cleared_count += 1
            except:
                pass
        
        logger.info(f"Dashboard cache refreshed for user {current_user.username}")
        return {
            "success": True,
            "message": "Dashboard cache cleared successfully",
            "patterns_cleared": cleared_count
        }
        
    except Exception as e:
        logger.error(f"Error refreshing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/recent-activity",
    response_model=Dict[str, Any],
    summary="Get recent activity",
    description="Get recent business activities for the dashboard"
)
async def get_recent_activity(
    limit: int = Query(10, description="Maximum number of activities to return", ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent business activities.
    
    Returns:
    - Recent transactions (rentals, purchases, returns)
    - Customer activities (new registrations)
    - Payment activities
    - System events
    
    The data is cached for 2 minutes to balance freshness with performance.
    """
    
    try:
        # Cache key for recent activity
        cache_key = f"dashboard:recent_activity:{limit}:{current_user.id}"
        cached_data = await cache.get(cache_key)
        
        if cached_data:
            logger.info(f"Returning cached recent activity for user {current_user.username}")
            return cached_data
        
        # Get fresh data
        data = await dashboard_service.get_recent_activity(session, limit)
        
        # Cache for 2 minutes (fresh activity data)
        await cache.set(cache_key, data, ttl=120)
        
        logger.info(f"Recent activity retrieved for user {current_user.username}")
        return {
            "success": True,
            "data": data,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error getting recent activity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/export",
    response_model=Dict[str, Any],
    summary="Export dashboard data",
    description="Export dashboard data in various formats"
)
async def export_dashboard_data(
    format: str = Query("json", description="Export format: json, csv, excel"),
    report_type: str = Query("overview", description="Report type: overview, financial, operational, inventory, customers"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Export dashboard data in various formats.
    
    Supported formats:
    - JSON: Raw data export
    - CSV: Comma-separated values
    - Excel: Formatted spreadsheet (coming soon)
    
    Report types:
    - overview: Executive summary
    - financial: Financial performance
    - operational: Operational metrics
    - inventory: Inventory analytics
    - customers: Customer insights
    """
    
    try:
        start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
        end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
        
        # Get the appropriate data based on report type
        data = None
        if report_type == "overview":
            data = await dashboard_service.get_executive_summary(session, start_dt, end_dt)
        elif report_type == "financial":
            data = await dashboard_service.get_financial_performance(session, start_dt, end_dt)
        elif report_type == "operational":
            data = await dashboard_service.get_operational_metrics(session, start_dt, end_dt)
        elif report_type == "inventory":
            data = await dashboard_service.get_inventory_analytics(session)
        elif report_type == "customers":
            data = await dashboard_service.get_customer_insights(session, start_dt, end_dt)
        else:
            raise HTTPException(status_code=400, detail="Invalid report type")
        
        # Format the data based on requested format
        if format == "json":
            return {
                "success": True,
                "format": "json",
                "report_type": report_type,
                "data": data
            }
        elif format == "csv":
            # TODO: Implement CSV conversion
            return {
                "success": False,
                "message": "CSV export coming soon"
            }
        elif format == "excel":
            # TODO: Implement Excel export
            return {
                "success": False,
                "message": "Excel export coming soon"
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid export format")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))