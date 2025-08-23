"""
Analytics endpoints for dashboard data.
Currently provides mock data structure to support frontend development.
"""

from datetime import datetime, date
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/dashboard/overview")
async def get_dashboard_overview(
    start_date: Optional[date] = Query(None, description="Start date for data range"),
    end_date: Optional[date] = Query(None, description="End date for data range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get dashboard overview metrics
    """
    return {
        "success": True,
        "data": {
            "revenue": {
                "current_period": 125000.0,
                "previous_period": 98000.0,
                "growth_rate": 27.6,
                "transaction_count": 342
            },
            "active_rentals": {
                "count": 89,
                "total_value": 45000.0,
                "average_value": 505.6
            },
            "inventory": {
                "total_items": 1250,
                "rentable_items": 1180,
                "rented_items": 89,
                "utilization_rate": 7.5
            },
            "customers": {
                "total": 456,
                "active": 123,
                "new": 23,
                "retention_rate": 85.2
            }
        }
    }


@router.get("/dashboard/financial")
async def get_dashboard_financial(
    start_date: Optional[date] = Query(None, description="Start date for data range"),
    end_date: Optional[date] = Query(None, description="End date for data range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get financial dashboard metrics
    """
    return {
        "success": True,
        "data": {
            "revenue_summary": {
                "total_revenue": 125000.0,
                "rental_revenue": 98000.0,
                "sales_revenue": 22000.0,
                "extension_revenue": 5000.0,
                "growth_rate": 15.3
            },
            "revenue_by_category": [
                {"category": "Electronics", "revenue": 45000.0, "transactions": 156, "percentage": 36.0},
                {"category": "Furniture", "revenue": 38000.0, "transactions": 89, "percentage": 30.4},
                {"category": "Tools", "revenue": 25000.0, "transactions": 67, "percentage": 20.0},
                {"category": "Appliances", "revenue": 17000.0, "transactions": 30, "percentage": 13.6}
            ],
            "revenue_by_type": [
                {"type": "rental", "revenue": 98000.0, "percentage": 78.4},
                {"type": "sales", "revenue": 22000.0, "percentage": 17.6},
                {"type": "extensions", "revenue": 5000.0, "percentage": 4.0}
            ],
            "payment_collection": {
                "total_due": 150000.0,
                "collected": 135000.0,
                "pending": 10000.0,
                "partial": 5000.0,
                "paid": 135000.0,
                "collection_rate": 90.0
            },
            "outstanding_balances": {
                "total": 15000.0,
                "count": 12,
                "average": 1250.0
            },
            "daily_trend": [
                {"date": "2025-08-20", "revenue": 4200.0, "transactions": 12},
                {"date": "2025-08-21", "revenue": 3800.0, "transactions": 11},
                {"date": "2025-08-22", "revenue": 5100.0, "transactions": 15},
                {"date": "2025-08-23", "revenue": 4500.0, "transactions": 13}
            ],
            "monthly_revenue": [
                {"month": "Jan", "revenue": 89000.0, "profit": 23000.0},
                {"month": "Feb", "revenue": 95000.0, "profit": 26000.0},
                {"month": "Mar", "revenue": 125000.0, "profit": 34000.0}
            ]
        }
    }


@router.get("/dashboard/operational")
async def get_dashboard_operational(
    start_date: Optional[date] = Query(None, description="Start date for data range"),
    end_date: Optional[date] = Query(None, description="End date for data range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get operational dashboard metrics
    """
    return {
        "success": True,
        "data": {
            "rental_metrics": {
                "total_rentals": 342,
                "active_rentals": 89,
                "overdue_rentals": 5,
                "average_rental_duration": 7.2
            },
            "inventory_metrics": {
                "total_items": 1250,
                "available_items": 1091,
                "rented_items": 89,
                "maintenance_items": 25,
                "unavailable_items": 45
            },
            "customer_metrics": {
                "total_customers": 456,
                "active_customers": 123,
                "new_customers": 23,
                "vip_customers": 45
            },
            "staff_metrics": {
                "total_staff": 12,
                "active_staff": 10,
                "shifts_today": 8
            }
        }
    }


@router.get("/dashboard/inventory")
async def get_dashboard_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get inventory dashboard metrics
    """
    return {
        "success": True,
        "data": {
            "inventory_summary": {
                "total_items": 1250,
                "available_items": 1091,
                "rented_items": 89,
                "maintenance_items": 25,
                "unavailable_items": 45,
                "utilization_rate": 7.5
            },
            "category_breakdown": [
                {"category": "Electronics", "total": 450, "available": 385, "rented": 45, "maintenance": 15, "unavailable": 5},
                {"category": "Furniture", "total": 320, "available": 298, "rented": 18, "maintenance": 2, "unavailable": 2},
                {"category": "Tools", "total": 280, "available": 258, "rented": 16, "maintenance": 4, "unavailable": 2},
                {"category": "Appliances", "total": 200, "available": 150, "rented": 10, "maintenance": 4, "unavailable": 36}
            ],
            "location_breakdown": [
                {"location": "Main Warehouse", "total": 800, "available": 695, "rented": 65, "maintenance": 20, "unavailable": 20},
                {"location": "Branch Store", "total": 450, "available": 396, "rented": 24, "maintenance": 5, "unavailable": 25}
            ],
            "top_rented_items": [
                {"item_name": "MacBook Pro 16\"", "rental_count": 23, "revenue": 12000.0},
                {"item_name": "Gaming Chair", "rental_count": 18, "revenue": 5400.0},
                {"item_name": "Power Drill Set", "rental_count": 15, "revenue": 2250.0}
            ]
        }
    }


@router.get("/dashboard/customers")
async def get_dashboard_customers(
    start_date: Optional[date] = Query(None, description="Start date for data range"),
    end_date: Optional[date] = Query(None, description="End date for data range"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get customer dashboard metrics
    """
    return {
        "success": True,
        "data": {
            "customer_summary": {
                "total_customers": 456,
                "active_customers": 123,
                "new_customers": 23,
                "vip_customers": 45,
                "retention_rate": 85.2
            },
            "customer_segments": [
                {"segment": "Premium", "count": 45, "revenue": 65000.0, "percentage": 52.0},
                {"segment": "Regular", "count": 234, "revenue": 45000.0, "percentage": 36.0},
                {"segment": "Occasional", "count": 177, "revenue": 15000.0, "percentage": 12.0}
            ],
            "top_customers": [
                {"name": "TechCorp Ltd", "rentals": 45, "revenue": 25000.0, "status": "VIP"},
                {"name": "Event Solutions", "rentals": 32, "revenue": 18000.0, "status": "Premium"},
                {"name": "StartupHub", "rentals": 28, "revenue": 15000.0, "status": "Regular"}
            ],
            "customer_satisfaction": {
                "average_rating": 4.3,
                "total_reviews": 234,
                "response_rate": 67.8
            }
        }
    }


@router.get("/dashboard/kpis")
async def get_dashboard_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get key performance indicators for dashboard
    """
    return {
        "success": True,
        "data": {
            "financial_kpis": {
                "monthly_revenue": 125000.0,
                "monthly_target": 150000.0,
                "revenue_growth": 15.3,
                "profit_margin": 27.2,
                "average_order_value": 365.0
            },
            "operational_kpis": {
                "inventory_utilization": 7.5,
                "customer_satisfaction": 4.3,
                "on_time_delivery": 94.5,
                "return_rate": 2.1,
                "staff_efficiency": 87.3
            },
            "growth_kpis": {
                "customer_acquisition": 23,
                "customer_retention": 85.2,
                "market_share": 12.8,
                "brand_awareness": 67.4
            },
            "alerts": [
                {
                    "type": "warning",
                    "title": "Low Inventory Alert",
                    "message": "Electronics category is running low on available items",
                    "priority": "medium"
                },
                {
                    "type": "info",
                    "title": "Revenue Milestone",
                    "message": "Monthly revenue target 83% achieved",
                    "priority": "low"
                }
            ]
        }
    }


@router.get("/dashboard/recent-activity")
async def get_dashboard_recent_activity(
    limit: int = Query(10, description="Number of recent activities to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get recent activity for dashboard
    """
    return {
        "success": True,
        "data": {
            "activities": [
                {
                    "id": "act_001",
                    "type": "rental",
                    "description": "New rental created for MacBook Pro 16\"",
                    "customer": "TechCorp Ltd",
                    "amount": 1200.0,
                    "timestamp": datetime.now().isoformat(),
                    "status": "confirmed"
                },
                {
                    "id": "act_002",
                    "type": "return",
                    "description": "Equipment returned: Gaming Chair",
                    "customer": "Event Solutions",
                    "amount": 300.0,
                    "timestamp": datetime.now().isoformat(),
                    "status": "completed"
                },
                {
                    "id": "act_003",
                    "type": "payment",
                    "description": "Payment received for rental #R-001234",
                    "customer": "StartupHub",
                    "amount": 850.0,
                    "timestamp": datetime.now().isoformat(),
                    "status": "completed"
                },
                {
                    "id": "act_004",
                    "type": "extension",
                    "description": "Rental extended: Power Drill Set",
                    "customer": "ConstructCorp",
                    "amount": 200.0,
                    "timestamp": datetime.now().isoformat(),
                    "status": "approved"
                },
                {
                    "id": "act_005",
                    "type": "maintenance",
                    "description": "Item scheduled for maintenance: Projector XYZ",
                    "customer": null,
                    "amount": 0.0,
                    "timestamp": datetime.now().isoformat(),
                    "status": "scheduled"
                }
            ][:limit]
        }
    }


@router.post("/dashboard/refresh-cache")
async def refresh_dashboard_cache(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Refresh dashboard data cache
    """
    return {
        "success": True,
        "data": {
            "message": "Dashboard cache refreshed successfully",
            "timestamp": datetime.now().isoformat(),
            "cache_status": "updated"
        }
    }


@router.get("/dashboard/export")
async def export_dashboard_data(
    start_date: Optional[date] = Query(None, description="Start date for data range"),
    end_date: Optional[date] = Query(None, description="End date for data range"),
    format: str = Query("csv", description="Export format (csv, excel, pdf)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Export dashboard data
    """
    return {
        "success": True,
        "data": {
            "export_url": f"/downloads/dashboard_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}",
            "format": format,
            "timestamp": datetime.now().isoformat(),
            "status": "ready"
        }
    }