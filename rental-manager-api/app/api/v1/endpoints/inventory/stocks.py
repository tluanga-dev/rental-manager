"""
Inventory Stocks API endpoints.

Provides endpoints for viewing inventory stocks - all items that have inventory units.
"""

from typing import List, Optional
from uuid import UUID
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.inventory.inventory_service import inventory_service


router = APIRouter()


def validate_and_sanitize_search(search: Optional[str]) -> Optional[str]:
    """
    Validate and sanitize search input to prevent SQL injection and XSS attacks.
    
    Args:
        search: Raw search input
        
    Returns:
        Sanitized search string or None
        
    Raises:
        HTTPException: If input contains malicious patterns
    """
    if not search:
        return None
    
    # Remove leading/trailing whitespace
    search = search.strip()
    
    # Check length
    if len(search) > 100:
        raise HTTPException(status_code=400, detail="Search term too long (max 100 characters)")
    
    # Block common SQL injection patterns (case insensitive)
    sql_injection_patterns = [
        r"(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|sp_|xp_)\b)",
        r"(-{2,}|\/{2,})",  # SQL comments
        r"(\bor\b.*=.*\b(or|and)\b)",  # OR injections
        r"(;|\||&)",  # Command separators
        r"(<script|javascript:|vbscript:|data:)",  # XSS patterns
        r"(\\\x00|\\\n|\\\r|\\\x1a)"  # Null bytes and control characters
    ]
    
    for pattern in sql_injection_patterns:
        if re.search(pattern, search, re.IGNORECASE):
            raise HTTPException(
                status_code=400, 
                detail="Search contains potentially malicious content"
            )
    
    # Allow only alphanumeric, spaces, hyphens, underscores, and periods
    if not re.match(r'^[a-zA-Z0-9\s\-_.]+$', search):
        raise HTTPException(
            status_code=400, 
            detail="Search contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, and periods are allowed."
        )
    
    return search


@router.get(
    "",
    summary="Get inventory stocks",
    description="Get all items that have inventory units with aggregated stock information"
)
async def get_inventory_stocks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Search by item name, SKU, or description"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    brand_id: Optional[str] = Query(None, description="Filter by brand ID"),
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    stock_status: Optional[str] = Query(None, description="Filter by stock status (IN_STOCK, LOW_STOCK, OUT_OF_STOCK)"),
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable items"),
    is_saleable: Optional[bool] = Query(None, description="Filter by saleable items"),
    sort_by: str = Query("item_name", description="Sort field (item_name, sku, created_at, updated_at)"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return")
):
    """
    Get inventory stocks - all items that have inventory units.
    
    Returns aggregated stock information for items that have associated inventory units.
    This endpoint shows only items with physical inventory tracked as units.
    
    **Features:**
    - Search by item name, SKU, or description
    - Filter by category, brand, location, or stock status  
    - Filter by rentable or saleable items
    - Sortable and paginated results
    - Aggregated stock quantities across locations
    - Location-wise breakdown of stock levels
    
    **Stock Status Values:**
    - `IN_STOCK`: Item has available stock
    - `LOW_STOCK`: Item is below reorder point
    - `OUT_OF_STOCK`: Item has no available stock
    """
    try:
        # Validate and sanitize inputs
        sanitized_search = validate_and_sanitize_search(search)
        
        # Convert string UUIDs to UUID objects
        category_uuid = UUID(category_id) if category_id else None
        brand_uuid = UUID(brand_id) if brand_id else None
        location_uuid = UUID(location_id) if location_id else None
        
        # Validate stock status if provided
        if stock_status and stock_status not in ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']:
            raise HTTPException(status_code=400, detail="Invalid stock status. Must be IN_STOCK, LOW_STOCK, or OUT_OF_STOCK")
        
        # Get inventory stocks
        stocks = await inventory_service.get_inventory_stocks(
            db,
            search=sanitized_search,
            category_id=category_uuid,
            brand_id=brand_uuid,
            location_id=location_uuid,
            stock_status=stock_status,
            is_rentable=is_rentable,
            is_saleable=is_saleable,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit
        )
        
        return {
            "success": True,
            "data": stocks,
            "total": len(stocks),
            "skip": skip,
            "limit": limit
        }
        
    except ValueError as e:
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="Invalid UUID format")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory stocks: {str(e)}")


@router.get(
    "/summary",
    summary="Get inventory stocks summary",
    description="Get aggregated summary statistics for inventory stocks"
)
async def get_inventory_stocks_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    location_id: Optional[str] = Query(None, description="Filter by location ID")
):
    """
    Get aggregated summary statistics for inventory stocks.
    
    **Returns:**
    - Total quantities across all stock categories
    - Count of items, locations, and low stock items
    - Utilization and availability rates
    - Total inventory value
    """
    try:
        # Convert string UUID to UUID object
        location_uuid = UUID(location_id) if location_id else None
        
        # Get stock summary
        summary = await inventory_service.get_stock_summary(
            db,
            location_id=location_uuid
        )
        
        return {
            "success": True,
            "data": summary
        }
        
    except ValueError as e:
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="Invalid UUID format")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory summary: {str(e)}")


@router.get(
    "/alerts",
    summary="Get inventory alerts",
    description="Get inventory alerts for low stock, maintenance due, etc."
)
async def get_inventory_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    location_id: Optional[str] = Query(None, description="Filter by location ID")
):
    """
    Get inventory alerts for attention items.
    
    **Alert Types:**
    - `LOW_STOCK`: Items below reorder point
    - `MAINTENANCE_DUE`: Units requiring maintenance
    - `WARRANTY_EXPIRING`: Units with expiring warranties
    
    **Severity Levels:**
    - `high`: Requires immediate attention (out of stock)
    - `medium`: Requires attention soon (low stock, maintenance due)
    - `low`: Informational (warranty expiring)
    """
    try:
        # Convert string UUID to UUID object
        location_uuid = UUID(location_id) if location_id else None
        
        # Get alerts
        alerts = await inventory_service.get_inventory_alerts(
            db,
            location_id=location_uuid
        )
        
        return {
            "success": True,
            "data": alerts,
            "total": len(alerts)
        }
        
    except ValueError as e:
        if "badly formed hexadecimal UUID" in str(e):
            raise HTTPException(status_code=400, detail="Invalid UUID format")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve inventory alerts: {str(e)}")