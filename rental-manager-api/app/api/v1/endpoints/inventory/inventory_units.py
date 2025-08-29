"""
API endpoints for inventory unit management.

Provides endpoints for managing individual inventory units with serial/batch tracking.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime, date, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.services.inventory.inventory_service import InventoryService
from app.schemas.inventory.inventory_unit import (
    InventoryUnitCreate,
    InventoryUnitUpdate,
    InventoryUnitResponse,
    InventoryUnitFilter,
    InventoryUnitBulkCreate,
    InventoryUnitStatusUpdate,
    RentalBlock,
    MaintenanceRecord
)
from app.schemas.inventory.common import PaginatedResponse
from app.models.inventory.enums import InventoryUnitStatus, InventoryUnitCondition
from app.models.user import User


router = APIRouter()


@router.get("/", response_model=PaginatedResponse[InventoryUnitResponse])
async def list_inventory_units(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    item_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    status: Optional[InventoryUnitStatus] = None,
    condition: Optional[InventoryUnitCondition] = None,
    serial_number: Optional[str] = None,
    batch_code: Optional[str] = None,
    sku: Optional[str] = None,
    is_rental_blocked: Optional[bool] = None,
    customer_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List inventory units with filtering.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        item_id: Filter by item
        location_id: Filter by location
        status: Filter by status
        condition: Filter by condition
        serial_number: Filter by serial number (partial match)
        batch_code: Filter by batch code
        sku: Filter by SKU (partial match)
        is_rental_blocked: Filter by rental block status
        customer_id: Filter by current customer (for rented units)
        
    Returns:
        Paginated list of inventory units
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    # Build filter
    filter_obj = InventoryUnitFilter(
        item_id=item_id,
        location_id=location_id,
        status=status,
        condition=condition,
        serial_number=serial_number,
        batch_code=batch_code,
        sku=sku,
        is_rental_blocked=is_rental_blocked,
        customer_id=customer_id
    )
    
    # Get filtered results
    units = await crud_unit.get_filtered(
        db,
        filter_obj=filter_obj,
        skip=skip,
        limit=limit
    )
    
    # Get total count
    total = await crud_unit.count_filtered(
        db,
        filter_obj=filter_obj
    )
    
    return PaginatedResponse(
        items=units,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{unit_id}")
async def get_inventory_unit(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get specific inventory unit with detailed information.
    
    Args:
        unit_id: Unit ID
        
    Returns:
        Unit details with related data
        
    Raises:
        404: Unit not found
    """
    from app.services.inventory.inventory_service import inventory_service
    
    try:
        unit_detail = await inventory_service.get_inventory_unit_detail(
            db,
            unit_id=unit_id
        )
        
        if not unit_detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory unit not found"
            )
        
        return {"success": True, "data": unit_detail}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve inventory unit detail: {str(e)}"
        )


@router.get("/serial/{serial_number}", response_model=InventoryUnitResponse)
async def get_unit_by_serial(
    serial_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get inventory unit by serial number.
    
    Args:
        serial_number: Serial number
        
    Returns:
        Unit details
        
    Raises:
        404: Unit not found
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.get_by_serial(
        db,
        serial_number=serial_number
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit with serial number {serial_number} not found"
        )
    
    return unit


@router.get("/sku/{sku}", response_model=List[InventoryUnitResponse])
async def get_units_by_sku(
    sku: str,
    status: Optional[InventoryUnitStatus] = None,
    location_id: Optional[UUID] = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Get inventory units by SKU.
    
    Args:
        sku: SKU to search
        status: Filter by status
        location_id: Filter by location
        limit: Maximum number of results
        
    Returns:
        List of matching units
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    units = await crud_unit.get_by_sku(
        db,
        sku=sku,
        status=status,
        location_id=location_id,
        limit=limit
    )
    
    return units


@router.post("/", response_model=InventoryUnitResponse)
async def create_inventory_unit(
    unit_data: InventoryUnitCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a single inventory unit.
    
    Args:
        unit_data: Unit information
        
    Returns:
        Created unit
        
    Raises:
        409: Serial number already exists
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    # Check serial number uniqueness if provided
    if unit_data.serial_number:
        existing = await crud_unit.get_by_serial(
            db,
            serial_number=unit_data.serial_number
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Serial number {unit_data.serial_number} already exists"
            )
    
    # Create unit
    unit_dict = unit_data.model_dump()
    unit_dict["created_by"] = current_user.id
    unit_dict["updated_by"] = current_user.id
    
    unit = await crud_unit.create(db, obj_in=unit_dict)
    
    # Update stock level if needed
    if unit_data.update_stock_level:
        from app.crud.inventory import stock_level as crud_stock
        
        stock_level = await crud_stock.get_by_item_location(
            db,
            item_id=unit.item_id,
            location_id=unit.location_id
        )
        
        if stock_level:
            await crud_stock.adjust_quantity(
                db,
                stock_level_id=stock_level.id,
                quantity_change=1,
                movement_type="PURCHASE",
                reason="Unit created",
                performed_by=current_user.id
            )
    
    await db.commit()
    return unit


@router.post("/bulk", response_model=dict)
async def create_inventory_units_bulk(
    bulk_data: InventoryUnitBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create multiple inventory units.
    
    Args:
        bulk_data: Bulk creation data
        
    Returns:
        Creation summary
    """
    service = InventoryService()
    
    try:
        units = await service.create_inventory_units(
            db,
            item_id=bulk_data.item_id,
            location_id=bulk_data.location_id,
            quantity=bulk_data.quantity,
            serial_numbers=bulk_data.serial_numbers,
            batch_code=bulk_data.batch_code,
            purchase_date=bulk_data.purchase_date,
            purchase_price=bulk_data.purchase_price,
            supplier_id=bulk_data.supplier_id,
            warranty_end_date=bulk_data.warranty_end_date,
            created_by=current_user.id
        )
        
        await db.commit()
        
        return {
            "status": "success",
            "units_created": len(units),
            "unit_ids": [str(unit.id) for unit in units],
            "batch_code": bulk_data.batch_code
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{unit_id}/rental-rate")
async def update_unit_rental_rate(
    unit_id: UUID,
    rental_rate_per_period: float = Body(..., embed=True, ge=0, description="Rental rate per period"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update rental rate for a specific inventory unit.
    
    Args:
        unit_id: Unit ID
        rental_rate_per_period: New rental rate per period
        
    Returns:
        Success response with updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    from sqlalchemy import select
    from app.models.inventory.inventory_unit import InventoryUnit
    
    # Get the unit
    result = await db.execute(
        select(InventoryUnit).where(InventoryUnit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Update the rental rate
    unit.rental_rate_per_period = rental_rate_per_period
    unit.updated_by = current_user.id
    unit.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(unit)
    
    return {
        "success": True,
        "message": f"Rental rate updated to {rental_rate_per_period}",
        "data": {
            "id": str(unit.id),
            "unit_identifier": unit.sku,
            "rental_rate_per_period": float(unit.rental_rate_per_period) if unit.rental_rate_per_period else None,
            "rental_period": unit.rental_period,
            "updated_at": unit.updated_at.isoformat() if unit.updated_at else None
        }
    }


@router.put("/{unit_id}", response_model=InventoryUnitResponse)
async def update_inventory_unit(
    unit_id: UUID,
    update_data: InventoryUnitUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update inventory unit.
    
    Args:
        unit_id: Unit ID
        update_data: Update data
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.get(db, id=unit_id)
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Check serial number uniqueness if changing
    if update_data.serial_number and update_data.serial_number != unit.serial_number:
        existing = await crud_unit.get_by_serial(
            db,
            serial_number=update_data.serial_number
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Serial number {update_data.serial_number} already exists"
            )
    
    # Update unit
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_by"] = current_user.id
    
    unit = await crud_unit.update(
        db,
        db_obj=unit,
        obj_in=update_dict
    )
    
    await db.commit()
    return unit


@router.patch("/{unit_id}/status", response_model=InventoryUnitResponse)
async def update_unit_status(
    unit_id: UUID,
    status_update: InventoryUnitStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update unit status.
    
    Args:
        unit_id: Unit ID
        status_update: New status and reason
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.update_status(
        db,
        unit_id=unit_id,
        new_status=status_update.status,
        reason=status_update.reason,
        updated_by=current_user.id
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    await db.commit()
    return unit


@router.patch("/{unit_id}/condition", response_model=InventoryUnitResponse)
async def update_unit_condition(
    unit_id: UUID,
    condition: InventoryUnitCondition = Body(...),
    notes: Optional[str] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update unit condition.
    
    Args:
        unit_id: Unit ID
        condition: New condition
        notes: Condition notes
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.update_condition(
        db,
        unit_id=unit_id,
        new_condition=condition,
        notes=notes,
        updated_by=current_user.id
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    await db.commit()
    return unit


@router.post("/{unit_id}/rental-block", response_model=InventoryUnitResponse)
async def block_unit_for_rental(
    unit_id: UUID,
    block_data: RentalBlock,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Block unit from rental.
    
    Args:
        unit_id: Unit ID
        block_data: Block reason and end date
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.block_for_rental(
        db,
        unit_id=unit_id,
        reason=block_data.reason,
        blocked_until=block_data.blocked_until,
        blocked_by=current_user.id
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    await db.commit()
    return unit


@router.delete("/{unit_id}/rental-block", response_model=InventoryUnitResponse)
async def unblock_unit_for_rental(
    unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unblock unit for rental.
    
    Args:
        unit_id: Unit ID
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.unblock_for_rental(
        db,
        unit_id=unit_id,
        unblocked_by=current_user.id
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    await db.commit()
    return unit


@router.post("/{unit_id}/maintenance", response_model=InventoryUnitResponse)
async def record_maintenance(
    unit_id: UUID,
    maintenance: MaintenanceRecord,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Record maintenance for unit.
    
    Args:
        unit_id: Unit ID
        maintenance: Maintenance details
        
    Returns:
        Updated unit
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.record_maintenance(
        db,
        unit_id=unit_id,
        maintenance_type=maintenance.maintenance_type,
        description=maintenance.description,
        cost=maintenance.cost,
        performed_by=maintenance.performed_by,
        next_maintenance_date=maintenance.next_maintenance_date,
        recorded_by=current_user.id
    )
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    await db.commit()
    return unit


@router.get("/{unit_id}/movements")
async def get_unit_movements(
    unit_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Get stock movements for a specific unit.
    
    Retrieves movements based on the unit's item and location.
    
    Args:
        unit_id: Unit ID
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of stock movements for the unit
        
    Raises:
        404: Unit not found
    """
    from sqlalchemy import select
    from app.models.inventory.inventory_unit import InventoryUnit
    from app.models.inventory.stock_movement import StockMovement
    from app.models.location import Location
    from app.models.user import User
    
    # Get the unit first to get its item_id and location_id
    result = await db.execute(
        select(InventoryUnit).where(InventoryUnit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Get movements for this item and location
    query = (
        select(StockMovement)
        .options(
            selectinload(StockMovement.location),
            selectinload(StockMovement.performed_by)
        )
        .where(
            StockMovement.item_id == unit.item_id,
            StockMovement.location_id == unit.location_id
        )
        .order_by(StockMovement.movement_date.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    movements = result.scalars().all()
    
    # Format the response
    movement_list = []
    for mov in movements:
        movement_list.append({
            "id": str(mov.id),
            "movement_date": mov.movement_date.isoformat() if mov.movement_date else mov.created_at.isoformat(),
            "movement_type": mov.movement_type,
            "quantity": abs(mov.quantity_change) if mov.quantity_change else 1,
            "quantity_change": mov.quantity_change if mov.quantity_change else 0,
            "from_location": None,  # Will be populated based on movement type
            "to_location": mov.location.location_name if mov.location else None,
            "location": mov.location.location_name if mov.location else None,
            "performed_by": mov.performed_by.email if mov.performed_by else None,
            "user": mov.performed_by.email if mov.performed_by else None,
            "notes": mov.notes if mov.notes else None,
            "reason": mov.reason if mov.reason else None,
            "created_at": mov.created_at.isoformat() if mov.created_at else None
        })
    
    return {
        "success": True,
        "data": movement_list,
        "total": len(movement_list)
    }


@router.get("/{unit_id}/analytics")
async def get_unit_analytics(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get analytics data for a specific unit.
    
    Provides performance metrics and utilization statistics.
    
    Args:
        unit_id: Unit ID
        
    Returns:
        Analytics data including revenue, utilization, and rental history
        
    Raises:
        404: Unit not found
    """
    from sqlalchemy import select, func
    from app.models.inventory.inventory_unit import InventoryUnit
    from datetime import datetime, timedelta
    
    # Get the unit first
    result = await db.execute(
        select(InventoryUnit).where(InventoryUnit.id == unit_id)
    )
    unit = result.scalar_one_or_none()
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Calculate analytics data
    # For now, return mock data - will be implemented with actual rental system
    analytics_data = {
        "total_rentals": unit.rental_count if hasattr(unit, 'rental_count') else 0,
        "total_revenue": float(unit.total_revenue) if hasattr(unit, 'total_revenue') and unit.total_revenue else 0.0,
        "average_rental_duration": 0,
        "utilization_rate": 0.0,
        "total_days_rented": unit.total_rental_days if hasattr(unit, 'total_rental_days') else 0,
        "last_rental_date": None,
        "maintenance_count": len(unit.maintenance_history) if hasattr(unit, 'maintenance_history') and unit.maintenance_history else 0,
        "damage_incidents": 0,
        "days_since_purchase": 0,
        "current_status": unit.status if hasattr(unit, 'status') else "AVAILABLE",
        "condition": unit.condition if hasattr(unit, 'condition') else "GOOD"
    }
    
    # Calculate days since purchase
    if unit.purchase_date:
        # Convert purchase_date to date if it's datetime
        purchase_date = unit.purchase_date
        if hasattr(purchase_date, 'date'):
            purchase_date = purchase_date.date()
        days_since_purchase = (datetime.utcnow().date() - purchase_date).days
        analytics_data["days_since_purchase"] = days_since_purchase
        
        # Calculate utilization rate (mock calculation)
        if days_since_purchase > 0 and analytics_data["total_days_rented"] > 0:
            analytics_data["utilization_rate"] = min(
                analytics_data["total_days_rented"] / days_since_purchase,
                1.0
            )
    
    # Calculate average rental duration
    if analytics_data["total_rentals"] > 0 and analytics_data["total_days_rented"] > 0:
        analytics_data["average_rental_duration"] = round(
            analytics_data["total_days_rented"] / analytics_data["total_rentals"],
            1
        )
    
    return {
        "success": True,
        "data": analytics_data
    }


@router.get("/{unit_id}/history", response_model=dict)
async def get_unit_history(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete history for a unit.
    
    Includes:
    - Status changes
    - Condition changes  
    - Rental history
    - Maintenance records
    - Location transfers
    
    Args:
        unit_id: Unit ID
        
    Returns:
        Complete unit history
    """
    from app.crud.inventory import inventory_unit as crud_unit
    from app.crud.inventory import stock_movement as crud_movement
    
    unit = await crud_unit.get(db, id=unit_id)
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Get movement history based on item and location
    movements = await crud_movement.get_by_item(
        db,
        item_id=unit.item_id,
        location_id=unit.location_id,
        skip=0,
        limit=100
    )
    
    return {
        "unit_id": str(unit_id),
        "serial_number": unit.serial_number,
        "current_status": unit.status,
        "current_condition": unit.condition,
        "movements": [
            {
                "date": mov.created_at,
                "type": mov.movement_type,
                "location": str(mov.location_id),
                "notes": mov.notes
            }
            for mov in movements
        ],
        "maintenance_history": unit.maintenance_history or [],
        "rental_count": unit.rental_count,
        "total_rental_days": unit.total_rental_days
    }


@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_unit(
    unit_id: UUID,
    reason: str = Query(..., description="Reason for deletion"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete inventory unit (soft delete).
    
    Args:
        unit_id: Unit ID
        reason: Deletion reason
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.get(db, id=unit_id)
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    # Soft delete
    await crud_unit.remove(
        db,
        id=unit_id,
        deleted_by=current_user.id,
        deletion_reason=reason
    )
    
    await db.commit()