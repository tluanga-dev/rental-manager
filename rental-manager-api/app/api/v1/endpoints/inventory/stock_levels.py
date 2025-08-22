"""
API endpoints for stock level management.

Provides endpoints for viewing and managing inventory stock levels.
"""

from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.services.inventory.inventory_service import InventoryService
from app.schemas.inventory.stock_level import (
    StockLevelCreate,
    StockLevelUpdate,
    StockLevelResponse,
    StockLevelFilter,
    StockAdjustment,
    TransferRequest,
    StockSummaryResponse,
    LowStockAlert
)
from app.schemas.inventory.common import PaginatedResponse
from app.models.user import User


router = APIRouter()


@router.get("/", response_model=PaginatedResponse[StockLevelResponse])
async def list_stock_levels(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    low_stock_only: bool = False,
    include_zero: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    List stock levels with optional filtering.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        item_id: Filter by specific item
        location_id: Filter by specific location
        low_stock_only: Only show items below reorder point
        include_zero: Include items with zero stock
        
    Returns:
        Paginated list of stock levels
    """
    service = InventoryService()
    
    # Build filter
    filter_obj = StockLevelFilter(
        item_id=item_id,
        location_id=location_id,
        low_stock_only=low_stock_only,
        include_zero=include_zero
    )
    
    # Get filtered results
    from app.crud.inventory import stock_level as crud_stock_level
    
    query = await crud_stock_level.build_filter_query(
        db,
        filter_obj=filter_obj
    )
    
    total = await crud_stock_level.count(db, query=query)
    items = await crud_stock_level.get_multi(
        db,
        skip=skip,
        limit=limit,
        query=query
    )
    
    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/summary", response_model=StockSummaryResponse)
async def get_stock_summary(
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    brand_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated stock summary.
    
    Returns summary statistics for inventory including:
    - Total value
    - Total units
    - Stock by status
    - Low stock items count
    """
    service = InventoryService()
    
    summary = await service.get_stock_summary(
        db,
        item_id=item_id,
        location_id=location_id,
        category_id=category_id,
        brand_id=brand_id
    )
    
    return summary


@router.get("/alerts", response_model=List[LowStockAlert])
async def get_stock_alerts(
    location_id: Optional[UUID] = None,
    severity: Optional[str] = Query(None, regex="^(critical|warning|info)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get inventory alerts.
    
    Returns alerts for:
    - Low stock items
    - Items needing maintenance
    - Expired warranties
    """
    service = InventoryService()
    
    alerts = await service.get_inventory_alerts(
        db,
        location_id=location_id,
        severity=severity
    )
    
    return alerts


@router.get("/{item_id}/{location_id}", response_model=StockLevelResponse)
async def get_stock_level(
    item_id: UUID,
    location_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get stock level for specific item at location.
    
    Args:
        item_id: Item ID
        location_id: Location ID
        
    Returns:
        Stock level details
        
    Raises:
        404: Stock level not found
    """
    from app.crud.inventory import stock_level as crud_stock_level
    
    stock_level = await crud_stock_level.get_by_item_location(
        db,
        item_id=item_id,
        location_id=location_id
    )
    
    if not stock_level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock level not found for item {item_id} at location {location_id}"
        )
    
    return stock_level


@router.post("/initialize", response_model=StockLevelResponse)
async def initialize_stock_level(
    stock_data: StockLevelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initialize stock level for an item at a location.
    
    Args:
        stock_data: Initial stock information
        
    Returns:
        Created stock level
        
    Raises:
        409: Stock level already exists
    """
    service = InventoryService()
    
    try:
        stock_level = await service.initialize_stock_level(
            db,
            item_id=stock_data.item_id,
            location_id=stock_data.location_id,
            initial_quantity=stock_data.quantity_on_hand,
            reorder_point=stock_data.reorder_point,
            reorder_quantity=stock_data.reorder_quantity,
            created_by=current_user.id
        )
        
        await db.commit()
        return stock_level
        
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{stock_level_id}", response_model=StockLevelResponse)
async def update_stock_level(
    stock_level_id: UUID,
    update_data: StockLevelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update stock level configuration.
    
    Updates reorder points and other configuration.
    Does NOT update quantities - use adjustment endpoint for that.
    
    Args:
        stock_level_id: Stock level ID
        update_data: Update data
        
    Returns:
        Updated stock level
    """
    from app.crud.inventory import stock_level as crud_stock_level
    
    stock_level = await crud_stock_level.get(db, id=stock_level_id)
    
    if not stock_level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock level not found"
        )
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_by"] = current_user.id
    
    stock_level = await crud_stock_level.update(
        db,
        db_obj=stock_level,
        obj_in=update_dict
    )
    
    await db.commit()
    return stock_level


@router.post("/adjust", response_model=StockLevelResponse)
async def adjust_stock(
    adjustment: StockAdjustment,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform stock adjustment.
    
    Used for:
    - Inventory counts
    - Corrections
    - Write-offs
    - Found inventory
    
    Args:
        adjustment: Adjustment details
        
    Returns:
        Updated stock level
    """
    service = InventoryService()
    
    try:
        stock_level = await service.perform_stock_adjustment(
            db,
            item_id=adjustment.item_id,
            location_id=adjustment.location_id,
            adjustment_type=adjustment.adjustment_type,
            quantity=adjustment.quantity,
            reason=adjustment.reason,
            reference_number=adjustment.reference_number,
            performed_by=current_user.id
        )
        
        await db.commit()
        return stock_level
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/transfer", response_model=dict)
async def transfer_stock(
    transfer: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Transfer stock between locations.
    
    Args:
        transfer: Transfer details
        
    Returns:
        Transfer confirmation with movement IDs
    """
    service = InventoryService()
    
    try:
        from_movement, to_movement = await service.transfer_stock(
            db,
            item_id=transfer.item_id,
            from_location_id=transfer.from_location_id,
            to_location_id=transfer.to_location_id,
            quantity=transfer.quantity,
            reason=transfer.reason,
            transferred_by=current_user.id
        )
        
        await db.commit()
        
        return {
            "status": "success",
            "from_movement_id": str(from_movement.id),
            "to_movement_id": str(to_movement.id),
            "quantity_transferred": float(transfer.quantity)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/rental/checkout", response_model=dict)
async def process_rental_checkout(
    item_id: UUID = Query(...),
    location_id: UUID = Query(...),
    quantity: Decimal = Query(..., gt=0),
    customer_id: UUID = Query(...),
    transaction_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process rental checkout.
    
    Allocates inventory units for rental.
    
    Args:
        item_id: Item to rent
        location_id: Rental location
        quantity: Quantity to rent
        customer_id: Customer ID
        transaction_id: Optional transaction reference
        
    Returns:
        Checkout confirmation with allocated units
    """
    service = InventoryService()
    
    try:
        units, movement = await service.process_rental_checkout(
            db,
            item_id=item_id,
            location_id=location_id,
            quantity=quantity,
            customer_id=customer_id,
            transaction_id=transaction_id,
            processed_by=current_user.id
        )
        
        await db.commit()
        
        return {
            "status": "success",
            "units_allocated": len(units),
            "unit_ids": [str(unit.id) for unit in units],
            "movement_id": str(movement.id)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/rental/return", response_model=dict)
async def process_rental_return(
    unit_ids: List[UUID] = Query(...),
    location_id: UUID = Query(...),
    condition: Optional[str] = Query("good"),
    damage_notes: Optional[str] = None,
    transaction_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process rental return.
    
    Returns rented units to inventory.
    
    Args:
        unit_ids: List of unit IDs to return
        location_id: Return location
        condition: Condition of returned items
        damage_notes: Notes about any damage
        transaction_id: Optional transaction reference
        
    Returns:
        Return confirmation
    """
    service = InventoryService()
    
    try:
        movement = await service.process_rental_return(
            db,
            unit_ids=unit_ids,
            location_id=location_id,
            condition=condition,
            damage_notes=damage_notes,
            transaction_id=transaction_id,
            processed_by=current_user.id
        )
        
        await db.commit()
        
        return {
            "status": "success",
            "units_returned": len(unit_ids),
            "movement_id": str(movement.id),
            "condition": condition
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/availability/check", response_model=dict)
async def check_availability(
    item_id: UUID = Query(...),
    location_id: UUID = Query(...),
    quantity: Decimal = Query(..., gt=0),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Check item availability.
    
    Args:
        item_id: Item to check
        location_id: Location to check
        quantity: Required quantity
        start_date: Rental start date (for future reservations)
        end_date: Rental end date
        
    Returns:
        Availability information
    """
    from app.crud.inventory import stock_level as crud_stock_level
    
    stock_level = await crud_stock_level.get_by_item_location(
        db,
        item_id=item_id,
        location_id=location_id
    )
    
    if not stock_level:
        return {
            "available": False,
            "quantity_available": 0,
            "message": "Item not stocked at this location"
        }
    
    available = stock_level.quantity_available >= quantity
    
    return {
        "available": available,
        "quantity_available": float(stock_level.quantity_available),
        "quantity_requested": float(quantity),
        "quantity_on_rent": float(stock_level.quantity_on_rent),
        "quantity_reserved": float(stock_level.quantity_reserved)
    }