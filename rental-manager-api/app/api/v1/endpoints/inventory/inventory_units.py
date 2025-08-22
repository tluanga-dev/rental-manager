"""
API endpoints for inventory unit management.

Provides endpoints for managing individual inventory units with serial/batch tracking.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.get("/{unit_id}", response_model=InventoryUnitResponse)
async def get_inventory_unit(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get specific inventory unit.
    
    Args:
        unit_id: Unit ID
        
    Returns:
        Unit details
        
    Raises:
        404: Unit not found
    """
    from app.crud.inventory import inventory_unit as crud_unit
    
    unit = await crud_unit.get(db, id=unit_id)
    
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory unit not found"
        )
    
    return unit


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
    
    # Get movement history
    movements = await crud_movement.get_by_unit(
        db,
        unit_id=unit_id
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