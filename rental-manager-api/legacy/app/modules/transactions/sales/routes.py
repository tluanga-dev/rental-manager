"""
Sales API routes.
"""

from typing import Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User
from .service import SalesService
from .schemas import (
    CreateSaleRequest,
    CreateSaleResponse,
    SaleFilters,
    SaleListResponse,
    SaleTransactionResponse,
    SaleTransactionWithLinesResponse,
    SalesDashboardResponse,
    UpdateSaleStatusRequest,
    ProcessRefundRequest,
    SalesStats,
    SaleableItemsListResponse
)


router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post(
    "/new",
    response_model=CreateSaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new sale transaction",
    description="Create a new sale transaction with automatic inventory deduction"
)
async def create_sale(
    request: CreateSaleRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new sale transaction.
    
    This endpoint:
    - Creates a sale transaction with line items
    - Validates stock availability for all items
    - Automatically deducts inventory quantities
    - Calculates totals including taxes and discounts
    
    Returns the created transaction with all line items.
    """
    try:
        sales_service = SalesService(session)
        return await sales_service.create_sale(request, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sale: {str(e)}"
        )


@router.get(
    "/",
    response_model=SaleListResponse,
    summary="List sales transactions",
    description="Get a paginated list of sales transactions with optional filtering"
)
async def list_sales(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID"),
    location_id: Optional[UUID] = Query(None, description="Filter by location ID"),
    sales_person_id: Optional[UUID] = Query(None, description="Filter by sales person ID"),
    status: Optional[str] = Query(None, description="Filter by transaction status"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status"),
    date_from: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search in transaction number, reference, or notes"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get a paginated list of sales transactions.
    
    Supports filtering by:
    - Customer, location, sales person
    - Transaction and payment status
    - Date range
    - Text search in transaction details
    """
    try:
        filters = SaleFilters(
            skip=skip,
            limit=limit,
            customer_id=customer_id,
            location_id=location_id,
            sales_person_id=sales_person_id,
            status=status,
            payment_status=payment_status,
            date_from=date_from,
            date_to=date_to,
            search=search
        )
        
        sales_service = SalesService(session)
        return await sales_service.list_sales(filters)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve sales: {str(e)}"
        )


@router.get(
    "/dashboard/data",
    response_model=SalesDashboardResponse,
    summary="Get sales dashboard data",
    description="Get comprehensive data for the sales dashboard including stats, recent sales, and trends"
)
async def get_sales_dashboard(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive sales dashboard data."""
    sales_service = SalesService(session)
    return await sales_service.get_dashboard_data()


@router.get(
    "/saleable-items",
    response_model=SaleableItemsListResponse,
    summary="Get saleable items",
    description="Get list of items marked as saleable with stock availability information"
)
async def get_saleable_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    search: Optional[str] = Query(None, description="Search by name, SKU, or model number"),
    category_id: Optional[UUID] = Query(None, description="Filter by category"),
    brand_id: Optional[UUID] = Query(None, description="Filter by brand"),
    location_id: Optional[UUID] = Query(None, description="Filter by location for stock"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum sale price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum sale price"),
    in_stock_only: bool = Query(True, description="Only show items with available stock"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of saleable items with stock availability.
    
    This endpoint returns only items where:
    - is_saleable = true
    - item_status = 'ACTIVE'
    - Optional: has available stock
    
    Returns item details including pricing, stock levels, and category/brand information.
    """
    from decimal import Decimal
    
    sales_service = SalesService(session)
    return await sales_service.get_saleable_items(
        skip=skip,
        limit=limit,
        search=search,
        category_id=category_id,
        brand_id=brand_id,
        location_id=location_id,
        min_price=Decimal(str(min_price)) if min_price is not None else None,
        max_price=Decimal(str(max_price)) if max_price is not None else None,
        in_stock_only=in_stock_only
    )


@router.get(
    "/items/{item_id}/availability",
    summary="Check item availability",
    description="Check if an item is available for sale in the specified quantity"
)
async def check_item_availability(
    item_id: UUID,
    quantity: int = Query(..., gt=0, description="Quantity to check"),
    location_id: Optional[UUID] = Query(None, description="Location to check availability"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Check if an item is available for sale."""
    sales_service = SalesService(session)
    return await sales_service.check_item_availability(item_id, quantity, location_id)


@router.get(
    "/{transaction_id}",
    response_model=SaleTransactionWithLinesResponse,
    summary="Get sale transaction by ID",
    description="Get detailed sale transaction information including all line items"
)
async def get_sale_by_id(
    transaction_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific sale transaction."""
    sales_service = SalesService(session)
    sale = await sales_service.get_sale_by_id(transaction_id)
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale transaction not found"
        )
    
    return sale


@router.get(
    "/number/{transaction_number}",
    response_model=SaleTransactionWithLinesResponse,
    summary="Get sale transaction by number",
    description="Get detailed sale transaction information by transaction number"
)
async def get_sale_by_number(
    transaction_number: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get detailed information about a specific sale transaction by transaction number."""
    sales_service = SalesService(session)
    sale = await sales_service.get_sale_by_number(transaction_number)
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale transaction not found"
        )
    
    return sale


@router.patch(
    "/{transaction_id}/status",
    response_model=SaleTransactionResponse,
    summary="Update sale transaction status",
    description="Update the status of a sale transaction"
)
async def update_sale_status(
    transaction_id: UUID,
    request: UpdateSaleStatusRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update the status of a sale transaction."""
    sales_service = SalesService(session)
    sale = await sales_service.update_sale_status(transaction_id, request, current_user.id)
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale transaction not found"
        )
    
    return sale


@router.post(
    "/{transaction_id}/refund",
    response_model=SaleTransactionResponse,
    summary="Process sale refund",
    description="Process a full or partial refund for a sale transaction"
)
async def process_refund(
    transaction_id: UUID,
    request: ProcessRefundRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Process a refund for a sale transaction."""
    sales_service = SalesService(session)
    sale = await sales_service.process_refund(transaction_id, request, current_user.id)
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale transaction not found"
        )
    
    return sale


# UNUSED BY FRONTEND - Commented out for security
# @router.get(
#     "/stats/summary",
#     response_model=SalesStats,
#     summary="Get sales statistics",
#     description="Get comprehensive sales statistics and metrics"
# )
# async def get_sales_stats(
#     date_from: Optional[date] = Query(None, description="Statistics from date (YYYY-MM-DD)"),
#     date_to: Optional[date] = Query(None, description="Statistics to date (YYYY-MM-DD)"),
#     session: AsyncSession = Depends(get_session),
#     current_user: User = Depends(get_current_user)
# ):
#     """Get sales statistics for the specified date range."""
#     sales_service = SalesService(session)
#     return await sales_service.get_sales_stats(date_from, date_to)