"""
Real-time Validation Routes for Inventory Management
Provides endpoints for checking serial number and batch code uniqueness.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.db.session import get_session
from app.modules.inventory.repository import AsyncInventoryUnitRepository

router = APIRouter(prefix="/inventory/validation", tags=["Inventory Validation"])


# Response schemas
class SerialNumberCheckResponse(BaseModel):
    """Response for serial number existence check."""
    serial_number: str = Field(..., description="The serial number checked")
    exists: bool = Field(..., description="True if serial number already exists")
    message: str = Field(..., description="Human-readable message")


class BatchCheckRequest(BaseModel):
    """Request for batch serial number validation."""
    serial_numbers: List[str] = Field(..., description="List of serial numbers to check")


class BatchCheckResponse(BaseModel):
    """Response for batch serial number validation."""
    results: Dict[str, bool] = Field(..., description="Map of serial_number -> exists")
    duplicates: List[str] = Field(..., description="List of serial numbers that already exist")
    valid: List[str] = Field(..., description="List of serial numbers that are available")
    message: str = Field(..., description="Summary message")


class BatchCodeCheckResponse(BaseModel):
    """Response for batch code existence check."""
    batch_code: str = Field(..., description="The batch code checked")
    exists: bool = Field(..., description="True if batch code already exists")
    message: str = Field(..., description="Human-readable message")


@router.get(
    "/serial-numbers/{serial_number}/check",
    response_model=SerialNumberCheckResponse,
    summary="Check if serial number exists",
    description="Real-time check for serial number uniqueness. Returns immediately with existence status."
)
async def check_serial_number(
    serial_number: str,
    session: AsyncSession = Depends(get_session)
) -> SerialNumberCheckResponse:
    """
    Check if a serial number already exists in the database.
    
    This endpoint is designed for real-time validation during data entry.
    """
    if not serial_number or not serial_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial number cannot be empty"
        )
    
    cleaned_serial = serial_number.strip()
    
    if len(cleaned_serial) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial number cannot exceed 100 characters"
        )
    
    inventory_repo = AsyncInventoryUnitRepository(session)
    exists = await inventory_repo.serial_number_exists(cleaned_serial)
    
    return SerialNumberCheckResponse(
        serial_number=cleaned_serial,
        exists=exists,
        message=f"Serial number {'already exists' if exists else 'is available'}"
    )


@router.post(
    "/serial-numbers/batch-check",
    response_model=BatchCheckResponse,
    summary="Batch check serial numbers",
    description="Check multiple serial numbers for uniqueness in a single request. Optimized for bulk validation."
)
async def batch_check_serial_numbers(
    request: BatchCheckRequest,
    session: AsyncSession = Depends(get_session)
) -> BatchCheckResponse:
    """
    Batch check multiple serial numbers for uniqueness.
    
    More efficient than individual checks when validating multiple serial numbers.
    """
    if not request.serial_numbers:
        return BatchCheckResponse(
            results={},
            duplicates=[],
            valid=[],
            message="No serial numbers provided"
        )
    
    # Validate input
    for sn in request.serial_numbers:
        if not sn or len(sn.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Serial numbers cannot be empty"
            )
        if len(sn.strip()) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Serial number '{sn}' exceeds 100 characters"
            )
    
    inventory_repo = AsyncInventoryUnitRepository(session)
    results = await inventory_repo.validate_serial_numbers(request.serial_numbers)
    
    duplicates = [sn for sn, exists in results.items() if exists]
    valid = [sn for sn, exists in results.items() if not exists]
    
    duplicate_count = len(duplicates)
    valid_count = len(valid)
    total_count = len(results)
    
    if duplicate_count == 0:
        message = f"All {total_count} serial numbers are available"
    elif valid_count == 0:
        message = f"All {total_count} serial numbers already exist"
    else:
        message = f"{valid_count} available, {duplicate_count} duplicates found"
    
    return BatchCheckResponse(
        results=results,
        duplicates=duplicates,
        valid=valid,
        message=message
    )


@router.get(
    "/batch-codes/{batch_code}/check",
    response_model=BatchCodeCheckResponse,
    summary="Check if batch code exists",
    description="Real-time check for batch code uniqueness. Returns immediately with existence status."
)
async def check_batch_code(
    batch_code: str,
    session: AsyncSession = Depends(get_session)
) -> BatchCodeCheckResponse:
    """
    Check if a batch code already exists in the database.
    
    This endpoint is designed for real-time validation during data entry.
    """
    if not batch_code or not batch_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch code cannot be empty"
        )
    
    cleaned_batch = batch_code.strip()
    
    if len(cleaned_batch) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch code cannot exceed 50 characters"
        )
    
    inventory_repo = AsyncInventoryUnitRepository(session)
    exists = await inventory_repo.batch_code_exists(cleaned_batch)
    
    return BatchCodeCheckResponse(
        batch_code=cleaned_batch,
        exists=exists,
        message=f"Batch code {'already exists' if exists else 'is available'}"
    )


@router.get(
    "/health",
    summary="Validation service health check",
    description="Check if validation service is responsive"
)
async def validation_health_check() -> Dict[str, Any]:
    """Health check endpoint for validation service."""
    return {
        "status": "healthy",
        "service": "inventory-validation",
        "endpoints": [
            "/serial-numbers/{serial_number}/check",
            "/serial-numbers/batch-check",
            "/batch-codes/{batch_code}/check"
        ]
    }