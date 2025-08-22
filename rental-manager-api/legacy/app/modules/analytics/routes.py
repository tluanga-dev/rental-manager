"""
Analytics API routes for rental dashboard
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional
from datetime import datetime

from app.shared.dependencies import get_session
from .service import AnalyticsService
from .rental_analytics_service import RentalAnalyticsService
from .schemas import (
    RentalDashboardResponse,
    FinancialDashboardResponse,
    RevenueTrendsResponse,
    CashFlowAnalysisResponse
)
from .rental_analytics_schemas import (
    ComprehensiveAnalyticsResponse,
    SummaryAnalyticsResponse,
    AnalyticsRequest,
    ErrorResponse
)

from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

# Import dashboard routes separately to avoid dependency issues
try:
    from .dashboard_routes import router as dashboard_router
    DASHBOARD_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Dashboard routes not available: {e}")
    DASHBOARD_AVAILABLE = False
    dashboard_router = None

router = APIRouter()
analytics_service = AnalyticsService()
rental_analytics_service = RentalAnalyticsService()

# Include dashboard routes if available
if DASHBOARD_AVAILABLE and dashboard_router:
    router.include_router(dashboard_router)


@router.get(
    "/rentals/dashboard",
    response_model=Dict[str, Any],
    summary="Get rental dashboard analytics",
    description="Get comprehensive analytics data for the rental dashboard including summary metrics, top items, and location breakdown"
)
async def get_rental_dashboard(
    session: AsyncSession = Depends(get_session)
):
    """
    Get rental dashboard analytics data.
    
    Returns:
    - Summary metrics (total rentals, revenue, average value, unique customers)
    - Top performing item
    - Location breakdown
    - Status breakdown
    """
    return await analytics_service.get_rental_dashboard(session)


# UNUSED BY FRONTEND - Commented out for optimization
# @router.get(
#     "/financial/dashboard",
#     response_model=Dict[str, Any],
#     summary="Get financial dashboard analytics",
#     description="Get comprehensive financial analytics including revenue, cash flow, and transaction metrics"
# )
# async def get_financial_dashboard(
#     start_date: Optional[datetime] = Query(None, description="Start date for analytics (ISO format)"),
#     end_date: Optional[datetime] = Query(None, description="End date for analytics (ISO format)"),
#     session: AsyncSession = Depends(get_session)
# ):
#     """
#     Get comprehensive financial dashboard analytics.
#     
#     Returns:
#     - Revenue metrics (total, average, by type)
#     - Outstanding payments
#     - Active rental values
#     - Monthly revenue trends
#     """
#     return await analytics_service.get_financial_dashboard(session, start_date, end_date)


# UNUSED BY FRONTEND - Commented out for optimization
# @router.get(
#     "/financial/revenue-trends",
#     response_model=Dict[str, Any],
#     summary="Get revenue trends over time",
#     description="Get revenue trends with configurable time periods and date ranges"
# )
# async def get_revenue_trends(
#     period: str = Query("monthly", description="Time period: daily, weekly, monthly, yearly"),
#     start_date: Optional[datetime] = Query(None, description="Start date for trends (ISO format)"),
#     end_date: Optional[datetime] = Query(None, description="End date for trends (ISO format)"),
#     session: AsyncSession = Depends(get_session)
# ):
#     """
#     Get revenue trends over time.
#     
#     Parameters:
#     - period: Time grouping (daily, weekly, monthly, yearly)
#     - start_date: Optional start date
#     - end_date: Optional end date
#     
#     Returns:
#     - Time-series revenue data
#     - Transaction counts
#     - Average transaction values
#     """
#     return await analytics_service.get_revenue_trends(session, period, start_date, end_date)


# UNUSED BY FRONTEND - Commented out for optimization
# @router.get(
#     "/financial/cash-flow",
#     response_model=Dict[str, Any],
#     summary="Get cash flow analysis",
#     description="Get cash flow analysis with inflows, outflows, and monthly breakdowns"
# )
# async def get_cash_flow_analysis(
#     start_date: Optional[datetime] = Query(None, description="Start date for cash flow analysis (ISO format)"),
#     end_date: Optional[datetime] = Query(None, description="End date for cash flow analysis (ISO format)"),
#     session: AsyncSession = Depends(get_session)
# ):
#     """
#     Get cash flow analysis.
#     
#     Returns:
#     - Cash inflows and outflows
#     - Net cash flow
#     - Monthly cash flow trends
#     - Breakdown by transaction type
#     """
#     return await analytics_service.get_cash_flow_analysis(session, start_date, end_date)


@router.get(
    "/financial/receivables-aging",
    response_model=Dict[str, Any],
    summary="Get receivables aging analysis",
    description="Get aging analysis for outstanding receivables with customer breakdown"
)
async def get_receivables_aging(
    session: AsyncSession = Depends(get_session)
):
    """
    Get receivables aging analysis.
    
    Returns:
    - Aging buckets (Current, 1-30, 31-60, 61-90, Over 90 days)
    - Total outstanding amount
    - Top overdue customers
    - Days overdue for each customer
    """
    return await analytics_service.get_receivables_aging(session)


@router.get(
    "/rental/utilization",
    response_model=Dict[str, Any],
    summary="Get rental utilization metrics",
    description="Get rental utilization rates and performance metrics"
)
async def get_rental_utilization(
    start_date: Optional[datetime] = Query(None, description="Start date for metrics (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End date for metrics (ISO format)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get rental utilization metrics.
    
    Returns:
    - Total vs rented items
    - Utilization rate percentage
    - Average rental value
    - Late return rate
    - Performance indicators
    """
    return await analytics_service.get_rental_utilization(session, start_date, end_date)


@router.get(
    "/customer/lifetime-value",
    response_model=Dict[str, Any],
    summary="Get customer lifetime value analysis",
    description="Get top customers by lifetime value with transaction history"
)
async def get_customer_lifetime_value(
    limit: int = Query(10, description="Number of top customers to return", ge=1, le=50),
    session: AsyncSession = Depends(get_session)
):
    """
    Get customer lifetime value analysis.
    
    Returns:
    - Top customers by lifetime value
    - Transaction count per customer
    - Average transaction value
    - Customer tenure
    - Overall customer metrics
    """
    return await analytics_service.get_customer_lifetime_value(session, limit)


@router.get(
    "/rentals/comprehensive",
    response_model=ComprehensiveAnalyticsResponse,
    summary="Get comprehensive rental analytics",
    description="Get comprehensive rental analytics including summary metrics, trends, top items, and insights"
)
async def get_comprehensive_rental_analytics(
    start_date: datetime = Query(description="Start date for analytics period (ISO format)"),
    end_date: datetime = Query(description="End date for analytics period (ISO format)"),
    location_id: Optional[str] = Query(None, description="Optional location UUID filter"),
    category_id: Optional[str] = Query(None, description="Optional category UUID filter"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive rental analytics data.
    
    This endpoint provides detailed analytics for rental performance including:
    - Summary metrics (total rentals, revenue, growth rates)
    - Top performing items and categories
    - Revenue trends over time
    - Daily activity charts
    - Key business insights
    
    Parameters:
    - start_date: Start date for the analytics period
    - end_date: End date for the analytics period
    - location_id: Optional UUID to filter by specific location
    - category_id: Optional UUID to filter by specific category
    
    Returns:
    Comprehensive analytics data with trends, insights, and performance metrics
    """
    try:
        result = await rental_analytics_service.get_comprehensive_analytics(
            session=session,
            start_date=start_date,
            end_date=end_date,
            location_id=location_id,
            category_id=category_id
        )
        
        if not result.get("success", False):
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "Failed to retrieve analytics data")
            )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving analytics data"
        )


@router.get(
    "/rentals/summary",
    response_model=SummaryAnalyticsResponse,
    summary="Get rental analytics summary",
    description="Get lightweight rental analytics summary with key metrics only"
)
async def get_rental_analytics_summary(
    start_date: datetime = Query(description="Start date for analytics period (ISO format)"),
    end_date: datetime = Query(description="End date for analytics period (ISO format)"),
    location_id: Optional[str] = Query(None, description="Optional location UUID filter"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get rental analytics summary data only.
    
    This is a lightweight endpoint that returns only summary metrics
    and top performer data, suitable for dashboard cards and quick metrics.
    
    Parameters:
    - start_date: Start date for the analytics period
    - end_date: End date for the analytics period  
    - location_id: Optional UUID to filter by specific location
    
    Returns:
    Summary analytics data with basic metrics and top performer
    """
    try:
        result = await rental_analytics_service.get_analytics_summary_only(
            session=session,
            start_date=start_date,
            end_date=end_date,
            location_id=location_id
        )
        
        if not result.get("success", False):
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "Failed to retrieve analytics summary")
            )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving analytics summary"
        )