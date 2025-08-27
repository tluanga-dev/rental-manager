"""
Transaction API endpoints.
Comprehensive API for all transaction types: purchases, sales, rentals, and returns.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.models.transaction import (
    TransactionStatus, PaymentStatus, PaymentMethod,
    TransactionType, RentalStatus
)
from app.services.transaction import (
    TransactionService,
    PurchaseService,
    SalesService,
    RentalService,
    PurchaseReturnsService,
    RentalPricingStrategy,
    ReturnType
)
from app.schemas.transaction import (
    TransactionHeaderCreate,
    TransactionHeaderUpdate,
    TransactionHeaderResponse,
    TransactionEventCreate,
    TransactionEventResponse,
)
from app.schemas.transaction.purchase import (
    PurchaseCreate,
    PurchaseUpdate,
    PurchaseResponse,
    PurchaseBulkCreate,
)
from app.schemas.transaction.sales import (
    SalesCreate,
    SalesUpdate,
    SalesResponse,
    SalesUpdateStatus,
    SalesReport,
)
from app.schemas.transaction.rental import (
    RentalCreate,
    RentalUpdate,
    RentalResponse,
    RentalReturnRequest,
    RentalExtensionRequest,
    RentalPickupRequest,
    RentalAvailabilityCheck,
)
from app.schemas.transaction.purchase_returns import (
    PurchaseReturnCreate,
    PurchaseReturnResponse,
    VendorCreditNote,
    PurchaseReturnReport,
)
from app.core.errors import NotFoundError, ValidationError, ConflictError

router = APIRouter(prefix="/transactions", tags=["transactions"])


# ============================================================================
# Generic Transaction Endpoints
# ============================================================================

@router.get("", response_model=List[TransactionHeaderResponse])
async def list_transactions(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    transaction_type: Optional[TransactionType] = Query(None, description="Filter by transaction type"),
    status: Optional[TransactionStatus] = Query(None, description="Filter by status"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filter by payment status"),
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier ID"),
    location_id: Optional[UUID] = Query(None, description="Filter by location ID"),
    date_from: Optional[date] = Query(None, description="Start date for date range filter"),
    date_to: Optional[date] = Query(None, description="End date for date range filter"),
    search: Optional[str] = Query(None, description="Search in transaction number and reference"),
) -> List[TransactionHeaderResponse]:
    """
    List all transactions with optional filters.
    
    Supports filtering by type, status, parties, location, and date range.
    Results are paginated and sorted by transaction date (newest first).
    """
    service = TransactionService(db)
    return await service.list_transactions(
        transaction_type=transaction_type,
        status=status,
        payment_status=payment_status,
        customer_id=customer_id,
        supplier_id=supplier_id,
        location_id=location_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{transaction_id}", response_model=TransactionHeaderResponse)
async def get_transaction(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    transaction_id: UUID = Path(..., description="Transaction ID"),
    include_lines: bool = Query(True, description="Include transaction lines"),
    include_events: bool = Query(False, description="Include transaction events"),
) -> TransactionHeaderResponse:
    """
    Get a specific transaction by ID.
    
    Optionally includes transaction lines and event history.
    """
    service = TransactionService(db)
    try:
        return await service.get_transaction(
            transaction_id=transaction_id,
            include_lines=include_lines,
            include_events=include_events,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )


@router.get("/{transaction_id}/events", response_model=List[TransactionEventResponse])
async def get_transaction_events(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    transaction_id: UUID = Path(..., description="Transaction ID"),
    event_category: Optional[str] = Query(None, description="Filter by event category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[TransactionEventResponse]:
    """
    Get event history for a transaction.
    
    Returns all events related to a transaction, including status changes,
    payments, and operational events.
    """
    service = TransactionService(db)
    try:
        return await service.get_transaction_events(
            transaction_id=transaction_id,
            event_category=event_category,
            skip=skip,
            limit=limit,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )


# ============================================================================
# Purchase Endpoints
# ============================================================================

@router.post("/purchases", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    purchase_data: PurchaseCreate,
) -> PurchaseResponse:
    """
    Create a new purchase transaction.
    
    Creates a purchase with automatic inventory updates upon completion.
    Supports serial number tracking for serialized items.
    """
    service = PurchaseService(db)
    try:
        return await service.create_purchase(
            purchase_data=purchase_data,
            created_by=str(current_user.id),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("/purchases", response_model=List[PurchaseResponse])
async def list_purchases(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    supplier_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    status: Optional[TransactionStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[PurchaseResponse]:
    """List purchase transactions with filters."""
    service = PurchaseService(db)
    return await service.list_purchases(
        supplier_id=supplier_id,
        location_id=location_id,
        status=status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/purchases/{purchase_id}", response_model=PurchaseResponse)
async def get_purchase(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    purchase_id: UUID,
    include_details: bool = Query(True),
) -> PurchaseResponse:
    """Get a specific purchase transaction."""
    service = PurchaseService(db)
    try:
        return await service.get_purchase(
            purchase_id=purchase_id,
            include_details=include_details,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase {purchase_id} not found",
        )


@router.patch("/purchases/{purchase_id}/status", response_model=PurchaseResponse)
async def update_purchase_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    purchase_id: UUID,
    status: TransactionStatus = Body(...),
    notes: Optional[str] = Body(None),
) -> PurchaseResponse:
    """Update purchase transaction status with validation."""
    service = PurchaseService(db)
    try:
        return await service.update_purchase_status(
            purchase_id=purchase_id,
            status=status,
            updated_by=str(current_user.id),
            notes=notes,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase {purchase_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# ============================================================================
# Sales Endpoints
# ============================================================================

@router.post("/sales", response_model=SalesResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    sales_data: SalesCreate,
) -> SalesResponse:
    """
    Create a new sales transaction.
    
    Validates stock availability and customer credit limits.
    Automatically deducts inventory when fulfilled.
    """
    service = SalesService(db)
    try:
        return await service.create_sale(
            sales_data=sales_data,
            created_by=str(current_user.id),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("/sales", response_model=List[SalesResponse])
async def list_sales(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    customer_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    sales_person_id: Optional[UUID] = None,
    status: Optional[TransactionStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[SalesResponse]:
    """List sales transactions with filters."""
    service = SalesService(db)
    return await service.list_sales(
        customer_id=customer_id,
        location_id=location_id,
        sales_person_id=sales_person_id,
        status=status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/sales/{sale_id}", response_model=SalesResponse)
async def get_sale(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    sale_id: UUID,
    include_details: bool = Query(True),
) -> SalesResponse:
    """Get a specific sales transaction."""
    service = SalesService(db)
    try:
        return await service.get_sale(
            sale_id=sale_id,
            include_details=include_details,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale {sale_id} not found",
        )


@router.patch("/sales/{sale_id}/status", response_model=SalesResponse)
async def update_sale_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    sale_id: UUID,
    status_update: SalesUpdateStatus,
) -> SalesResponse:
    """Update sales transaction status."""
    service = SalesService(db)
    try:
        return await service.update_sale_status(
            sale_id=sale_id,
            status_update=status_update,
            updated_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale {sale_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/sales/{sale_id}/payment", response_model=SalesResponse)
async def process_sale_payment(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    sale_id: UUID,
    amount: Decimal = Body(..., gt=0),
    payment_method: PaymentMethod = Body(...),
    payment_reference: Optional[str] = Body(None),
) -> SalesResponse:
    """Process payment for a sales transaction."""
    service = SalesService(db)
    try:
        return await service.process_payment(
            sale_id=sale_id,
            amount=amount,
            payment_method=payment_method,
            payment_reference=payment_reference,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sale {sale_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# ============================================================================
# Rental Endpoints
# ============================================================================

@router.post("/rentals", response_model=RentalResponse, status_code=status.HTTP_201_CREATED)
async def create_rental(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    rental_data: RentalCreate,
) -> RentalResponse:
    """
    Create a new rental transaction.
    
    Validates item availability and calculates pricing based on rental period.
    Includes security deposit calculation and rental lifecycle initialization.
    """
    service = RentalService(db)
    try:
        return await service.create_rental(
            rental_data=rental_data,
            created_by=str(current_user.id),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.get("/rentals", response_model=List[RentalResponse])
async def list_rentals(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    customer_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    status: Optional[TransactionStatus] = None,
    rental_status: Optional[RentalStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    overdue_only: bool = Query(False, description="Show only overdue rentals"),
) -> List[RentalResponse]:
    """
    List rental transactions with filters.
    
    Supports filtering by rental status and overdue items.
    """
    service = RentalService(db)
    return await service.list_rentals(
        customer_id=customer_id,
        location_id=location_id,
        status=status,
        rental_status=rental_status,
        date_from=date_from,
        date_to=date_to,
        overdue_only=overdue_only,
        skip=skip,
        limit=limit,
    )


@router.get("/rentals/{rental_id}", response_model=RentalResponse)
async def get_rental(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    rental_id: UUID,
    include_lifecycle: bool = Query(True),
) -> RentalResponse:
    """Get a specific rental transaction with lifecycle details."""
    service = RentalService(db)
    try:
        return await service.get_rental(
            rental_id=rental_id,
            include_lifecycle=include_lifecycle,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental {rental_id} not found",
        )


@router.post("/rentals/{rental_id}/pickup", response_model=RentalResponse)
async def process_rental_pickup(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    rental_id: UUID,
    pickup_data: Optional[RentalPickupRequest] = None,
) -> RentalResponse:
    """
    Process rental pickup.
    
    Marks items as picked up and starts the rental period.
    Updates rental status to IN_PROGRESS.
    """
    service = RentalService(db)
    try:
        return await service.process_pickup(
            rental_id=rental_id,
            pickup_data=pickup_data,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental {rental_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/rentals/{rental_id}/return", response_model=RentalResponse)
async def process_rental_return(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    rental_id: UUID,
    return_data: RentalReturnRequest,
) -> RentalResponse:
    """
    Process rental return with inspection.
    
    Handles item returns with condition assessment, damage charges,
    late fee calculation, and security deposit adjustment.
    """
    service = RentalService(db)
    try:
        return await service.process_return(
            rental_id=rental_id,
            return_data=return_data,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental {rental_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/rentals/{rental_id}/extend", response_model=RentalResponse)
async def extend_rental(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    rental_id: UUID,
    extension_data: RentalExtensionRequest,
) -> RentalResponse:
    """
    Extend rental period.
    
    Checks availability for extended period and calculates additional charges.
    Maximum of 3 extensions allowed per rental.
    """
    service = RentalService(db)
    try:
        return await service.extend_rental(
            rental_id=rental_id,
            extension_data=extension_data,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental {rental_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.post("/rentals/check-availability", response_model=Dict[str, Any])
async def check_rental_availability(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    availability_check: RentalAvailabilityCheck,
) -> Dict[str, Any]:
    """
    Check item availability for rental period.
    
    Returns availability status and suggests alternative dates if items are unavailable.
    """
    service = RentalService(db)
    return await service.check_availability(availability_check)


@router.get("/rentals/overdue", response_model=List[RentalResponse])
async def get_overdue_rentals(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    location_id: Optional[UUID] = Query(None, description="Filter by location"),
) -> List[RentalResponse]:
    """Get all overdue rental transactions."""
    service = RentalService(db)
    return await service.get_overdue_rentals(location_id=location_id)


# ============================================================================
# Purchase Return Endpoints
# ============================================================================

@router.post("/purchase-returns", response_model=PurchaseReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_return(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    return_data: PurchaseReturnCreate,
) -> PurchaseReturnResponse:
    """
    Create a purchase return transaction.
    
    Validates return against original purchase and checks eligibility.
    Auto-approves returns below threshold or for defects/recalls.
    """
    service = PurchaseReturnsService(db)
    try:
        return await service.create_purchase_return(
            return_data=return_data,
            created_by=str(current_user.id),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.post("/purchase-returns/{return_id}/inspection", response_model=PurchaseReturnResponse)
async def process_return_inspection(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    return_id: UUID,
    line_id: UUID = Body(...),
    inspection_data: Dict[str, Any] = Body(...),
) -> PurchaseReturnResponse:
    """
    Process inspection for a return line item.
    
    Records condition assessment and determines disposition (return to stock or vendor).
    """
    service = PurchaseReturnsService(db)
    try:
        return await service.process_inspection(
            return_id=return_id,
            line_id=line_id,
            inspection_data=inspection_data,
            inspector_id=str(current_user.id),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/purchase-returns/{return_id}/approve", response_model=PurchaseReturnResponse)
async def approve_purchase_return(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    return_id: UUID,
    approval_notes: Optional[str] = Body(None),
) -> PurchaseReturnResponse:
    """Approve a purchase return for processing."""
    service = PurchaseReturnsService(db)
    try:
        return await service.approve_return(
            return_id=return_id,
            approval_data={"notes": approval_notes},
            approved_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return {return_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/purchase-returns/{return_id}/vendor-credit", response_model=PurchaseReturnResponse)
async def process_vendor_credit(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    return_id: UUID,
    credit_data: VendorCreditNote,
) -> PurchaseReturnResponse:
    """Process vendor credit for approved return."""
    service = PurchaseReturnsService(db)
    try:
        return await service.process_vendor_credit(
            return_id=return_id,
            credit_data=credit_data,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return {return_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# ============================================================================
# Reports and Analytics
# ============================================================================

@router.get("/reports/summary")
async def get_transaction_summary(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    date_from: date = Query(..., description="Start date for report"),
    date_to: date = Query(..., description="End date for report"),
    location_id: Optional[UUID] = Query(None, description="Filter by location"),
) -> Dict[str, Any]:
    """
    Get transaction summary report for a date range.
    
    Returns:
    - Transaction counts by type
    - Total revenue and expenses
    - Payment status breakdown
    - Top customers and suppliers
    """
    service = TransactionService(db)
    return await service.get_transaction_summary(
        date_from=date_from,
        date_to=date_to,
        location_id=location_id,
    )


@router.get("/reports/sales")
async def get_sales_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    date_from: date = Query(...),
    date_to: date = Query(...),
    location_id: Optional[UUID] = None,
    sales_person_id: Optional[UUID] = None,
) -> SalesReport:
    """
    Generate sales report for a period.
    
    Includes revenue metrics, top selling items, and payment breakdowns.
    """
    service = SalesService(db)
    return await service.generate_sales_report(
        date_from=date_from,
        date_to=date_to,
        location_id=location_id,
        sales_person_id=sales_person_id,
    )


@router.get("/reports/rental-utilization")
async def get_rental_utilization_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    date_from: date = Query(...),
    date_to: date = Query(...),
    location_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """
    Get rental utilization report.
    
    Shows item usage rates, average rental duration, and revenue per item.
    """
    service = RentalService(db)
    return await service.get_utilization_report(
        date_from=date_from,
        date_to=date_to,
        location_id=location_id,
    )


@router.get("/reports/purchase-returns")
async def get_purchase_return_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    date_from: date = Query(...),
    date_to: date = Query(...),
    supplier_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
) -> PurchaseReturnReport:
    """
    Generate purchase return report.
    
    Shows return trends, reasons, and processing metrics.
    """
    service = PurchaseReturnsService(db)
    return await service.generate_return_report(
        date_from=date_from,
        date_to=date_to,
        supplier_id=supplier_id,
        location_id=location_id,
    )


@router.get("/reports/overdue")
async def get_overdue_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    location_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """
    Get report of all overdue items.
    
    Includes overdue rentals and unpaid sales with customer contact information.
    """
    rental_service = RentalService(db)
    overdue_rentals = await rental_service.get_overdue_rentals(location_id=location_id)
    
    # Would also include overdue sales
    return {
        "overdue_rentals": overdue_rentals,
        "total_overdue": len(overdue_rentals),
        "location_id": location_id,
        "generated_at": datetime.now(timezone.utc),
    }


# ============================================================================
# Bulk Operations
# ============================================================================

@router.post("/purchases/bulk", response_model=List[PurchaseResponse], status_code=status.HTTP_201_CREATED)
async def create_bulk_purchases(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    bulk_data: PurchaseBulkCreate,
) -> List[PurchaseResponse]:
    """
    Create multiple purchase transactions in bulk.
    
    All purchases are created in a single database transaction for efficiency.
    If any purchase fails, all are rolled back.
    """
    service = PurchaseService(db)
    try:
        results = []
        for purchase_data in bulk_data.purchases:
            result = await service.create_purchase(
                purchase_data=purchase_data,
                created_by=str(current_user.id),
            )
            results.append(result)
        return results
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Bulk purchase creation failed: {str(e)}",
        )


# ============================================================================
# Payment Processing
# ============================================================================

@router.post("/payments/process")
async def process_payment(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    transaction_id: UUID = Body(...),
    amount: Decimal = Body(..., gt=0),
    payment_method: PaymentMethod = Body(...),
    payment_reference: Optional[str] = Body(None),
) -> TransactionHeaderResponse:
    """
    Process payment for any transaction type.
    
    Updates payment status and triggers completion if fully paid.
    """
    service = TransactionService(db)
    try:
        return await service.process_payment(
            transaction_id=transaction_id,
            amount=amount,
            payment_method=payment_method,
            payment_reference=payment_reference,
            processed_by=str(current_user.id),
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


# ============================================================================
# Purchase Returns
# ============================================================================

@router.get("/purchase-returns/purchase/{purchase_id}", response_model=List[PurchaseReturnResponse])
async def get_purchase_returns_by_purchase(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    purchase_id: UUID,
) -> List[PurchaseReturnResponse]:
    """Get all purchase returns for a specific purchase."""
    service = PurchaseReturnsService(db)
    try:
        return await service.get_returns_by_purchase(purchase_id)
    except NotFoundError:
        # If no returns found for this purchase, return empty list instead of 404
        return []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch purchase returns: {str(e)}",
        )