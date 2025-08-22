"""
API endpoints for SKU sequence management.

Provides endpoints for SKU generation and sequence management.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.inventory.sku_sequence import (
    SKUSequenceCreate,
    SKUSequenceUpdate,
    SKUSequenceResponse,
    SKUGenerateRequest,
    SKUGenerateResponse,
    SKUBulkGenerateRequest,
    SKUSequenceStats
)
from app.schemas.inventory.common import PaginatedResponse
from app.models.user import User


router = APIRouter()


@router.get("/", response_model=PaginatedResponse[SKUSequenceResponse])
async def list_sku_sequences(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    brand_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List SKU sequences.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        brand_id: Filter by brand
        category_id: Filter by category
        is_active: Filter by active status
        
    Returns:
        Paginated list of SKU sequences
    """
    from app.crud.inventory import sku_sequence as crud_sku
    from sqlalchemy import select, and_
    from app.models.inventory.sku_sequence import SKUSequence
    
    # Build query
    conditions = []
    if brand_id:
        conditions.append(SKUSequence.brand_id == brand_id)
    if category_id:
        conditions.append(SKUSequence.category_id == category_id)
    if is_active is not None:
        conditions.append(SKUSequence.is_active == is_active)
    
    query = select(SKUSequence)
    if conditions:
        query = query.where(and_(*conditions))
    
    # Get results
    result = await db.execute(
        query.offset(skip).limit(limit)
    )
    sequences = result.scalars().all()
    
    # Get total count
    count_query = select(func.count()).select_from(SKUSequence)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    return PaginatedResponse(
        items=sequences,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/active", response_model=List[SKUSequenceResponse])
async def get_active_sequences(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active SKU sequences.
    
    Args:
        limit: Maximum number of records
        
    Returns:
        List of active sequences
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    sequences = await crud_sku.get_active_sequences(
        db,
        skip=0,
        limit=limit
    )
    
    return sequences


@router.get("/{sequence_id}", response_model=SKUSequenceResponse)
async def get_sku_sequence(
    sequence_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get specific SKU sequence.
    
    Args:
        sequence_id: Sequence ID
        
    Returns:
        Sequence details
        
    Raises:
        404: Sequence not found
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    sequence = await crud_sku.get(db, id=sequence_id)
    
    if not sequence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU sequence not found"
        )
    
    return sequence


@router.get("/brand/{brand_id}", response_model=List[SKUSequenceResponse])
async def get_sequences_by_brand(
    brand_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all sequences for a brand.
    
    Args:
        brand_id: Brand ID
        limit: Maximum number of records
        
    Returns:
        List of sequences for the brand
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    sequences = await crud_sku.get_sequences_by_brand(
        db,
        brand_id=brand_id,
        skip=0,
        limit=limit
    )
    
    return sequences


@router.get("/category/{category_id}", response_model=List[SKUSequenceResponse])
async def get_sequences_by_category(
    category_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all sequences for a category.
    
    Args:
        category_id: Category ID
        limit: Maximum number of records
        
    Returns:
        List of sequences for the category
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    sequences = await crud_sku.get_sequences_by_category(
        db,
        category_id=category_id,
        skip=0,
        limit=limit
    )
    
    return sequences


@router.post("/", response_model=SKUSequenceResponse)
async def create_sku_sequence(
    sequence_data: SKUSequenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create new SKU sequence.
    
    Args:
        sequence_data: Sequence configuration
        
    Returns:
        Created sequence
        
    Raises:
        409: Sequence already exists for brand/category
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    # Check if sequence exists
    existing = await crud_sku.get_by_brand_category(
        db,
        brand_id=sequence_data.brand_id,
        category_id=sequence_data.category_id
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SKU sequence already exists for this brand/category combination"
        )
    
    # Create sequence
    sequence = await crud_sku.get_or_create(
        db,
        brand_id=sequence_data.brand_id,
        category_id=sequence_data.category_id,
        prefix=sequence_data.prefix,
        suffix=sequence_data.suffix,
        padding_length=sequence_data.padding_length,
        created_by=current_user.id
    )
    
    await db.commit()
    return sequence


@router.put("/{sequence_id}", response_model=SKUSequenceResponse)
async def update_sku_sequence(
    sequence_id: UUID,
    update_data: SKUSequenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update SKU sequence configuration.
    
    Args:
        sequence_id: Sequence ID
        update_data: Update data
        
    Returns:
        Updated sequence
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    sequence = await crud_sku.get(db, id=sequence_id)
    
    if not sequence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SKU sequence not found"
        )
    
    # Update sequence
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict["updated_by"] = current_user.id
    
    sequence = await crud_sku.update(
        db,
        db_obj=sequence,
        obj_in=update_dict
    )
    
    await db.commit()
    return sequence


@router.post("/{sequence_id}/generate", response_model=SKUGenerateResponse)
async def generate_sku(
    sequence_id: UUID,
    generate_request: SKUGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a single SKU.
    
    Args:
        sequence_id: Sequence ID
        generate_request: Generation parameters
        
    Returns:
        Generated SKU and sequence number
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        sku, sequence_number = await crud_sku.generate_sku(
            db,
            sequence_id=sequence_id,
            generate_request=generate_request
        )
        
        await db.commit()
        
        return SKUGenerateResponse(
            sku=sku,
            sequence_number=sequence_number,
            sequence_id=sequence_id
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{sequence_id}/generate-bulk", response_model=dict)
async def generate_skus_bulk(
    sequence_id: UUID,
    bulk_request: SKUBulkGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate multiple SKUs in bulk.
    
    Args:
        sequence_id: Sequence ID
        bulk_request: Bulk generation parameters
        
    Returns:
        List of generated SKUs
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        skus = await crud_sku.generate_bulk_skus(
            db,
            sequence_id=sequence_id,
            count=bulk_request.count,
            brand_code=bulk_request.brand_code,
            category_code=bulk_request.category_code,
            item_names=bulk_request.item_names
        )
        
        await db.commit()
        
        return {
            "status": "success",
            "count": len(skus),
            "skus": skus
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{sequence_id}/reset", response_model=SKUSequenceResponse)
async def reset_sequence(
    sequence_id: UUID,
    new_value: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reset sequence to specific value.
    
    Warning: This can cause duplicate SKUs if not used carefully.
    
    Args:
        sequence_id: Sequence ID
        new_value: New starting value
        
    Returns:
        Updated sequence
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        sequence = await crud_sku.reset_sequence(
            db,
            sequence_id=sequence_id,
            new_value=new_value,
            updated_by=current_user.id
        )
        
        await db.commit()
        return sequence
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.patch("/{sequence_id}/activate", response_model=SKUSequenceResponse)
async def activate_sequence(
    sequence_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Activate a sequence.
    
    Args:
        sequence_id: Sequence ID
        
    Returns:
        Updated sequence
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        sequence = await crud_sku.activate_sequence(
            db,
            sequence_id=sequence_id,
            updated_by=current_user.id
        )
        
        await db.commit()
        return sequence
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.patch("/{sequence_id}/deactivate", response_model=SKUSequenceResponse)
async def deactivate_sequence(
    sequence_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a sequence.
    
    Args:
        sequence_id: Sequence ID
        
    Returns:
        Updated sequence
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        sequence = await crud_sku.deactivate_sequence(
            db,
            sequence_id=sequence_id,
            updated_by=current_user.id
        )
        
        await db.commit()
        return sequence
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{sequence_id}/format", response_model=SKUSequenceResponse)
async def update_format_template(
    sequence_id: UUID,
    format_template: str = Query(..., description="Format template string"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update sequence format template.
    
    Template variables:
    - {prefix}: Sequence prefix
    - {suffix}: Sequence suffix
    - {sequence}: Padded sequence number
    - {brand}: Brand code
    - {category}: Category code
    - {item}: Item name abbreviation
    - {year}: Current year
    - {month}: Current month
    - {day}: Current day
    
    Args:
        sequence_id: Sequence ID
        format_template: New format template
        
    Returns:
        Updated sequence
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        sequence = await crud_sku.update_format_template(
            db,
            sequence_id=sequence_id,
            format_template=format_template,
            updated_by=current_user.id
        )
        
        await db.commit()
        return sequence
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{sequence_id}/statistics", response_model=SKUSequenceStats)
async def get_sequence_statistics(
    sequence_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics for a sequence.
    
    Args:
        sequence_id: Sequence ID
        
    Returns:
        Sequence statistics
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    try:
        stats = await crud_sku.get_statistics(
            db,
            sequence_id=sequence_id
        )
        
        return SKUSequenceStats(**stats)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/validate-sku", response_model=dict)
async def validate_sku_uniqueness(
    sku: str = Query(..., description="SKU to validate"),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if a SKU is unique.
    
    Args:
        sku: SKU to validate
        
    Returns:
        Validation result
    """
    from app.crud.inventory import sku_sequence as crud_sku
    
    is_unique = await crud_sku.validate_sku_uniqueness(
        db,
        sku=sku
    )
    
    return {
        "sku": sku,
        "is_unique": is_unique,
        "message": "SKU is available" if is_unique else "SKU already exists"
    }


# Add missing import
from sqlalchemy import func