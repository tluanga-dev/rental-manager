"""
API endpoints for stock movement history.

Provides endpoints for viewing inventory movement audit trails.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.inventory.stock_movement import (
    StockMovementResponse,
    StockMovementFilter,
    StockMovementSummary,
    MovementTypeStats
)
from app.schemas.inventory.common import PaginatedResponse
from app.models.inventory.enums import StockMovementType


router = APIRouter()


@router.get("/", response_model=PaginatedResponse[StockMovementResponse])
async def list_stock_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    movement_type: Optional[StockMovementType] = None,
    transaction_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    created_by: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List stock movements with filtering.
    
    Movement history is immutable and provides complete audit trail.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        item_id: Filter by item
        location_id: Filter by location
        movement_type: Filter by movement type
        transaction_id: Filter by transaction
        start_date: Filter movements after this date
        end_date: Filter movements before this date
        created_by: Filter by user who created movement
        
    Returns:
        Paginated list of stock movements
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    # Build filter
    filter_obj = StockMovementFilter(
        item_id=item_id,
        location_id=location_id,
        movement_type=movement_type,
        transaction_id=transaction_id,
        start_date=start_date,
        end_date=end_date,
        created_by=created_by
    )
    
    # Get filtered results
    movements = await crud_movement.get_filtered(
        db,
        filter_obj=filter_obj,
        skip=skip,
        limit=limit
    )
    
    # Get total count
    total = await crud_movement.count_filtered(
        db,
        filter_obj=filter_obj
    )
    
    return PaginatedResponse(
        items=movements,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/summary", response_model=StockMovementSummary)
async def get_movement_summary(
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    group_by: str = Query("day", regex="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated movement summary.
    
    Provides statistics on stock movements over time.
    
    Args:
        item_id: Filter by item
        location_id: Filter by location
        start_date: Start of period
        end_date: End of period
        group_by: Aggregation period
        
    Returns:
        Movement summary with statistics
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    summary = await crud_movement.get_movement_summary(
        db,
        item_id=item_id,
        location_id=location_id,
        start_date=start_date,
        end_date=end_date,
        group_by=group_by
    )
    
    return summary


@router.get("/statistics", response_model=MovementTypeStats)
async def get_movement_statistics(
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get movement statistics by type.
    
    Returns counts and quantities for each movement type.
    
    Args:
        item_id: Filter by item
        location_id: Filter by location
        start_date: Start of period
        end_date: End of period
        
    Returns:
        Statistics grouped by movement type
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    stats = await crud_movement.get_type_statistics(
        db,
        item_id=item_id,
        location_id=location_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return stats


@router.get("/{movement_id}", response_model=StockMovementResponse)
async def get_stock_movement(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get specific stock movement.
    
    Args:
        movement_id: Movement ID
        
    Returns:
        Movement details
        
    Raises:
        404: Movement not found
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    movement = await crud_movement.get(db, id=movement_id)
    
    if not movement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock movement not found"
        )
    
    return movement


@router.get("/item/{item_id}/history", response_model=List[StockMovementResponse])
async def get_item_movement_history(
    item_id: UUID,
    location_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Get movement history for specific item.
    
    Args:
        item_id: Item ID
        location_id: Optional location filter
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List of movements for the item
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    movements = await crud_movement.get_by_item(
        db,
        item_id=item_id,
        location_id=location_id,
        skip=skip,
        limit=limit
    )
    
    return movements


@router.get("/location/{location_id}/history", response_model=List[StockMovementResponse])
async def get_location_movement_history(
    location_id: UUID,
    item_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Get movement history for specific location.
    
    Args:
        location_id: Location ID
        item_id: Optional item filter
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List of movements for the location
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    movements = await crud_movement.get_by_location(
        db,
        location_id=location_id,
        item_id=item_id,
        skip=skip,
        limit=limit
    )
    
    return movements


@router.get("/transaction/{transaction_id}/movements", response_model=List[StockMovementResponse])
async def get_transaction_movements(
    transaction_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all movements for a transaction.
    
    Args:
        transaction_id: Transaction ID
        
    Returns:
        List of movements linked to the transaction
    """
    from app.crud.inventory import stock_movement as crud_movement
    
    movements = await crud_movement.get_by_transaction(
        db,
        transaction_id=transaction_id
    )
    
    return movements


@router.get("/recent", response_model=List[StockMovementResponse])
async def get_recent_movements(
    hours: int = Query(24, ge=1, le=168),
    location_id: Optional[UUID] = None,
    movement_type: Optional[StockMovementType] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent stock movements.
    
    Args:
        hours: Number of hours to look back (max 168 = 7 days)
        location_id: Filter by location
        movement_type: Filter by type
        limit: Maximum number of records
        
    Returns:
        Recent movements
    """
    from app.crud.inventory import stock_movement as crud_movement
    from datetime import timedelta
    
    start_date = datetime.utcnow() - timedelta(hours=hours)
    
    filter_obj = StockMovementFilter(
        location_id=location_id,
        movement_type=movement_type,
        start_date=start_date.date()
    )
    
    movements = await crud_movement.get_filtered(
        db,
        filter_obj=filter_obj,
        skip=0,
        limit=limit
    )
    
    return movements


@router.get("/export", response_model=dict)
async def export_movements(
    format: str = Query("csv", regex="^(csv|excel|json)$"),
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Export movement history.
    
    Args:
        format: Export format (csv, excel, json)
        item_id: Filter by item
        location_id: Filter by location
        start_date: Start of period
        end_date: End of period
        
    Returns:
        Export file URL or data
    """
    # This would typically generate a file and return a download URL
    # For now, return a placeholder
    return {
        "status": "pending",
        "format": format,
        "message": "Export functionality to be implemented",
        "filters": {
            "item_id": str(item_id) if item_id else None,
            "location_id": str(location_id) if location_id else None,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None
        }
    }