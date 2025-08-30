from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.item import ItemService
from app.services.item_rental_blocking import ItemRentalBlockingService
from app.services.sku_generator import SKUGenerator
from app.schemas.item import (
    ItemCreate, ItemUpdate, ItemResponse, ItemSummary,
    ItemList, ItemFilter, ItemSort, ItemStats,
    ItemRentalStatusRequest, ItemRentalStatusResponse,
    ItemBulkOperation, ItemBulkResult, ItemExport,
    ItemImport, ItemImportResult, ItemAvailabilityCheck,
    ItemAvailabilityResponse, ItemPricingUpdate, ItemDuplicate
)
from app.core.dependencies import (
    get_item_service, get_item_rental_blocking_service, 
    get_sku_generator, get_current_user_id, get_db
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError,
    BusinessRuleError
)


router = APIRouter()


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_data: ItemCreate,
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Create a new item."""
    try:
        return await service.create_item(item_data, created_by=current_user_id)
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: UUID,
    service: ItemService = Depends(get_item_service)
):
    """Get an item by ID."""
    try:
        return await service.get_item(item_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/sku/{sku}", response_model=ItemResponse)
async def get_item_by_sku(
    sku: str,
    service: ItemService = Depends(get_item_service)
):
    """Get an item by SKU."""
    try:
        return await service.get_item_by_sku(sku)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/", response_model=ItemList)
async def list_items(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    item_name: Optional[str] = Query(None, description="Filter by item name (partial match)"),
    sku: Optional[str] = Query(None, description="Filter by SKU (partial match)"),
    brand_id: Optional[UUID] = Query(None, description="Filter by brand ID"),
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    unit_of_measurement_id: Optional[UUID] = Query(None, description="Filter by unit ID"),
    is_rentable: Optional[bool] = Query(None, description="Filter by rentable status"),
    is_salable: Optional[bool] = Query(None, description="Filter by salable status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    status: Optional[str] = Query(None, description="Filter by item status"),
    is_rental_blocked: Optional[bool] = Query(None, description="Filter by rental blocking status"),
    min_sale_price: Optional[float] = Query(None, ge=0, description="Minimum sale price"),
    max_sale_price: Optional[float] = Query(None, ge=0, description="Maximum sale price"),
    min_rental_rate: Optional[float] = Query(None, ge=0, description="Minimum rental rate"),
    max_rental_rate: Optional[float] = Query(None, ge=0, description="Maximum rental rate"),
    search: Optional[str] = Query(None, description="Search in name, SKU, and description"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    sort_field: str = Query("item_name", description="Sort field"),
    sort_direction: str = Query("asc", description="Sort direction (asc/desc)"),
    include_inactive: bool = Query(False, description="Include inactive items"),
    service: ItemService = Depends(get_item_service)
):
    """List items with pagination and filtering."""
    try:
        # Create filter object
        filters = ItemFilter(
            item_name=item_name,
            sku=sku,
            brand_id=brand_id,
            category_id=category_id,
            unit_of_measurement_id=unit_of_measurement_id,
            is_rentable=is_rentable,
            is_salable=is_salable,
            is_active=is_active,
            status=status,
            is_rental_blocked=is_rental_blocked,
            min_sale_price=min_sale_price,
            max_sale_price=max_sale_price,
            min_rental_rate=min_rental_rate,
            max_rental_rate=max_rental_rate,
            search=search,
            tags=tags
        )
        
        # Create sort object
        sort = ItemSort(
            field=sort_field,
            direction=sort_direction
        )
        
        return await service.list_items(
            page=page,
            page_size=page_size,
            filters=filters,
            sort=sort,
            include_inactive=include_inactive
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: UUID,
    item_data: ItemUpdate,
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Update an existing item."""
    try:
        return await service.update_item(item_id, item_data, updated_by=current_user_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    service: ItemService = Depends(get_item_service)
):
    """Soft delete an item."""
    try:
        await service.delete_item(item_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BusinessRuleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/search/{search_term}", response_model=List[ItemSummary])
async def search_items(
    search_term: str,
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    include_inactive: bool = Query(False, description="Include inactive items"),
    service: ItemService = Depends(get_item_service)
):
    """Search items by name, SKU, or description."""
    try:
        return await service.search_items(
            search_term=search_term,
            limit=limit,
            include_inactive=include_inactive
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Rental Management Endpoints
@router.post("/{item_id}/rental-status", response_model=ItemRentalStatusResponse)
async def toggle_rental_status(
    item_id: UUID,
    request: ItemRentalStatusRequest,
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service),
    current_user_id: str = Depends(get_current_user_id)
):
    """Toggle rental status (block/unblock) for an item."""
    try:
        return await service.toggle_item_rental_status(
            item_id=item_id,
            request=request,
            changed_by=UUID(current_user_id)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{item_id}/rental-history")
async def get_rental_history(
    item_id: UUID,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=200, description="Maximum records to return"),
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Get rental blocking history for an item."""
    try:
        history, total = await service.get_item_rental_history(
            item_id=item_id,
            skip=skip,
            limit=limit
        )
        
        return {
            "history": history,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{item_id}/availability", response_model=ItemAvailabilityResponse)
async def check_availability(
    item_id: UUID,
    quantity_needed: int = Query(1, ge=1, description="Quantity needed"),
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Check item availability for rental or sale."""
    try:
        availability_check = ItemAvailabilityCheck(
            item_id=item_id,
            quantity_needed=quantity_needed
        )
        return await service.check_item_rental_availability(item_id)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# Pricing Management
@router.put("/{item_id}/pricing", response_model=ItemResponse)
async def update_pricing(
    item_id: UUID,
    pricing_update: ItemPricingUpdate,
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Update item pricing."""
    try:
        return await service.update_pricing(
            item_id=item_id,
            pricing_update=pricing_update,
            updated_by=current_user_id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Item Duplication
@router.post("/duplicate", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_item(
    duplicate_request: ItemDuplicate,
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Duplicate an existing item."""
    try:
        return await service.duplicate_item(
            duplicate_request=duplicate_request,
            created_by=current_user_id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


# SKU Management
@router.post("/{item_id}/regenerate-sku", response_model=ItemResponse)
async def regenerate_sku(
    item_id: UUID,
    new_category_id: Optional[UUID] = Query(None, description="New category ID for SKU generation"),
    pattern: Optional[str] = Query(None, description="Custom SKU pattern"),
    service: ItemService = Depends(get_item_service)
):
    """Regenerate SKU for an existing item."""
    try:
        return await service.regenerate_item_sku(
            item_id=item_id,
            new_category_id=new_category_id,
            pattern=pattern
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Bulk Operations
@router.post("/bulk-operation", response_model=ItemBulkResult)
async def bulk_operation(
    operation: ItemBulkOperation,
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Perform bulk operations on items."""
    try:
        return await service.bulk_operation(
            operation=operation,
            updated_by=current_user_id
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Bulk Rental Status Operations
@router.post("/bulk-rental-status", response_model=ItemBulkResult)
async def bulk_rental_status(
    item_ids: List[UUID],
    is_rental_blocked: bool,
    remarks: Optional[str] = None,
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service),
    current_user_id: str = Depends(get_current_user_id)
):
    """Toggle rental status for multiple items."""
    try:
        return await service.bulk_toggle_rental_status(
            item_ids=item_ids,
            is_rental_blocked=is_rental_blocked,
            remarks=remarks,
            changed_by=UUID(current_user_id)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Special Item Lists
@router.get("/rentable/", response_model=List[ItemSummary])
async def get_rentable_items(
    limit: Optional[int] = Query(None, ge=1, le=100, description="Maximum results"),
    service: ItemService = Depends(get_item_service)
):
    """Get items available for rental."""
    return await service.get_rentable_items(limit=limit)


@router.get("/salable/", response_model=List[ItemSummary])
async def get_salable_items(
    limit: Optional[int] = Query(None, ge=1, le=100, description="Maximum results"),
    service: ItemService = Depends(get_item_service)
):
    """Get items available for sale."""
    return await service.get_salable_items(limit=limit)


@router.get("/blocked/")
async def get_blocked_items(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=200, description="Maximum records to return"),
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Get items blocked from rental."""
    try:
        blocked_items, total = await service.get_blocked_items(skip=skip, limit=limit)
        
        return {
            "items": blocked_items,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/maintenance-due/", response_model=List[ItemSummary])
async def get_maintenance_due_items(
    days_threshold: int = Query(180, ge=1, description="Days since last maintenance"),
    service: ItemService = Depends(get_item_service)
):
    """Get items that need maintenance."""
    return await service.get_maintenance_due_items(days_threshold=days_threshold)


# Statistics and Analytics
@router.get("/statistics/", response_model=ItemStats)
async def get_item_statistics(
    service: ItemService = Depends(get_item_service)
):
    """Get comprehensive item statistics."""
    return await service.get_item_statistics()


@router.get("/statistics/rental-blocking/")
async def get_rental_blocking_statistics(
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Get rental blocking statistics."""
    return await service.get_rental_blocking_statistics()


@router.get("/statistics/blocking-reasons/")
async def get_blocking_reasons_summary(
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Get summary of common blocking reasons."""
    return await service.get_blocking_reasons_summary()


# SKU Generator Endpoints
@router.post("/generate-sku/")
async def generate_sku(
    category_id: Optional[UUID] = None,
    pattern: Optional[str] = None,
    prefix: Optional[str] = None,
    sku_generator: SKUGenerator = Depends(get_sku_generator),
    db: AsyncSession = Depends(get_db)
):
    """Generate a new SKU."""
    try:
        sku = await sku_generator.generate_sku(
            db,
            category_id=category_id,
            pattern=pattern,
            prefix=prefix
        )
        return {"sku": sku}
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/validate-sku-pattern/")
async def validate_sku_pattern(
    pattern: str,
    sku_generator: SKUGenerator = Depends(get_sku_generator),
    db: AsyncSession = Depends(get_db)
):
    """Validate a custom SKU pattern."""
    return await sku_generator.validate_sku_pattern(db, pattern)


@router.get("/sku-patterns/")
async def get_available_patterns(
    sku_generator: SKUGenerator = Depends(get_sku_generator)
):
    """Get available SKU patterns."""
    return sku_generator.get_available_patterns()


@router.get("/sku-statistics/")
async def get_sku_statistics(
    sku_generator: SKUGenerator = Depends(get_sku_generator),
    db: AsyncSession = Depends(get_db)
):
    """Get SKU generation statistics."""
    return await sku_generator.get_sku_statistics(db)


# Import/Export
@router.post("/import/", response_model=ItemImportResult)
async def import_items(
    import_data: List[ItemImport],
    service: ItemService = Depends(get_item_service),
    current_user_id: Optional[str] = Depends(get_current_user_id)
):
    """Import items from data."""
    try:
        return await service.import_items(
            import_data=import_data,
            created_by=current_user_id
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/export/", response_model=List[ItemExport])
async def export_items(
    include_inactive: bool = Query(False, description="Include inactive items"),
    service: ItemService = Depends(get_item_service)
):
    """Export items data."""
    return await service.export_items(include_inactive=include_inactive)


# Maintenance Operations
@router.post("/maintenance/auto-unblock-expired/")
async def auto_unblock_expired_items(
    auto_unblock_after_days: int = Query(90, ge=1, description="Days after which to auto-unblock"),
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service),
    current_user_id: str = Depends(get_current_user_id)
):
    """Automatically unblock items that have been blocked for too long."""
    try:
        unblocked_items = await service.auto_unblock_expired_items(
            auto_unblock_after_days=auto_unblock_after_days
        )
        
        return {
            "unblocked_items": unblocked_items,
            "count": len(unblocked_items),
            "message": f"Auto-unblocked {len(unblocked_items)} items that were blocked for more than {auto_unblock_after_days} days"
        }
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/validation/rental-unblock/{item_id}")
async def validate_rental_unblock(
    item_id: UUID,
    service: ItemRentalBlockingService = Depends(get_item_rental_blocking_service)
):
    """Validate if an item can be unblocked for rental."""
    return await service.validate_rental_unblock(item_id)