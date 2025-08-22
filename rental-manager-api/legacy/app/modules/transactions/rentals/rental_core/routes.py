from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import JSONResponse

from app.modules.transactions.rentals.rental_core.schemas import NewRentalRequest
from app.modules.transactions.rentals.rental_core.timezone_schemas import (
    RentalTransactionResponse,
    RentalTransactionCreateRequest,
    RentalTransactionUpdateRequest,
    RentalFilterRequest,
    RentalTransactionListResponse,
    RentalReturnRequest as TimezoneRentalReturnRequest,
    RentalReturnResponse as TimezoneRentalReturnResponse
)
from app.modules.transactions.rentals.rental_core.service import RentalsService
# from app.modules.transactions.rentals.rental_core.rental_service_enhanced import EnhancedRentalService, RentalTransactionRequest  # Module removed
# from app.modules.transactions.rentals.rental_core.rentable_items_service import RentableItemsService  # Module removed
# from app.modules.transactions.rentals.rental_core.invoice_service import RentalInvoiceService  # Module removed
from app.modules.transactions.rentals.rental_return.service import RentalReturnService
from app.modules.transactions.rentals.rental_return.schemas import (
    RentalReturnRequest, 
    RentalReturnResponse as StandardRentalReturnResponse
)
from app.modules.transactions.rentals.rental_extension.service import RentalExtensionService
from app.modules.transactions.rentals.rental_extension.schemas import (
    RentalExtensionRequest,
    RentalExtensionResponse,
    ExtensionAvailabilityRequest,
    ExtensionAvailabilityResponse,
    RentalBalanceResponse,
    ExtensionHistoryResponse
)
# Import unified booking router from submodule
from app.modules.transactions.rentals.rental_booking import booking_router
# Import WebSocket router for real-time updates
from app.modules.transactions.rentals.rental_core import ws_routes
# Import SSE router for real-time updates fallback
from app.modules.transactions.rentals.rental_core import sse_routes
from app.shared.exceptions import ValidationError, NotFoundError

from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

import logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Rentals"])

# Include booking routes as a sub-router
router.include_router(booking_router, prefix="/booking")
# Include WebSocket routes for real-time updates
router.include_router(ws_routes.router)
# Include SSE routes for real-time updates fallback
router.include_router(sse_routes.router)

@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="Get all rental transactions with search and sorting",
    description="Retrieves rental transactions with comprehensive search, filtering, and sorting capabilities.",
    responses={
        200: {"description": "Rentals retrieved successfully"},
        500: {"description": "Internal server error"},
    },
)
async def get_all_rentals(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, description="Search term for customer name, transaction number, reference number, or location"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID (UUID)"),
    location_id: Optional[str] = Query(None, description="Filter by location ID (UUID)"),
    status: Optional[str] = Query(None, description="Filter by transaction status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)"),
    rental_status: Optional[str] = Query(None, description="Filter by rental status (RENTAL_INPROGRESS, RENTAL_LATE, RENTAL_COMPLETED, etc.)"),
    payment_status: Optional[str] = Query(None, description="Filter by payment status (PENDING, PAID, PARTIAL, REFUNDED)"),
    start_date: Optional[date] = Query(None, description="Filter rentals created after this date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter rentals created before this date (YYYY-MM-DD)"),
    rental_start_date: Optional[date] = Query(None, description="Filter by rental start date (YYYY-MM-DD)"),
    rental_end_date: Optional[date] = Query(None, description="Filter by rental end date (YYYY-MM-DD)"),
    item_id: Optional[str] = Query(None, description="Filter rentals containing specific item ID (UUID)"),
    sort_by: str = Query("created_at", description="Sort by field: created_at, transaction_date, customer_name, location_name, total_amount, status, payment_status"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order: asc or desc"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get all rental transactions with comprehensive search, filtering, and sorting capabilities.

    **Pagination:**
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100, max: 1000)

    **Search & Filtering:**
    - **search**: General text search across customer name, transaction number, reference number, and location
    - **customer_id**: Filter by specific customer (UUID format)
    - **location_id**: Filter by specific location (UUID format)
    - **status**: Filter by transaction status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
    - **rental_status**: Filter by rental status (RENTAL_INPROGRESS, RENTAL_LATE, RENTAL_COMPLETED, RENTAL_EXTENDED, RENTAL_PARTIAL_RETURN, RENTAL_LATE_PARTIAL_RETURN)
    - **payment_status**: Filter by payment status (PENDING, PAID, PARTIAL, REFUNDED)
    - **start_date**: Filter rentals created after this date (YYYY-MM-DD format)
    - **end_date**: Filter rentals created before this date (YYYY-MM-DD format)
    - **rental_start_date**: Filter by rental start date (YYYY-MM-DD format)
    - **rental_end_date**: Filter by rental end date (YYYY-MM-DD format)
    - **item_id**: Filter rentals containing specific item (UUID format)

    **Sorting:**
    - **sort_by**: Field to sort by (created_at, transaction_date, customer_name, location_name, total_amount, status, payment_status)
    - **sort_order**: Sort direction (asc or desc, default: desc)

    **Response includes:**
    - Rental transaction details with customer and location information
    - Item-level details for each rental
    - Pagination information
    - Applied filters summary
    - Timestamp for response

    **Example Queries:**
    - Search: `/api/transactions/rentals/?search=john&sort_by=customer_name&sort_order=asc`
    - Filter by status: `/api/transactions/rentals/?rental_status=RENTAL_LATE&sort_by=rental_end_date`
    - Date range: `/api/transactions/rentals/?start_date=2024-01-01&end_date=2024-01-31`
    - Location filter: `/api/transactions/rentals/?location_id=123e4567-e89b-12d3-a456-426614174000`

    - **db**: Database session (injected)
    """
    service = RentalsService()
    try:
        return await service.get_all_rentals(
            session=db,
            skip=skip,
            limit=limit,
            search=search,
            customer_id=customer_id,
            location_id=location_id,
            status=status,
            rental_status=rental_status,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            rental_start_date=rental_start_date,
            rental_end_date=rental_end_date,
            item_id=item_id,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/rentable_items",
    status_code=status.HTTP_200_OK,
    summary="Get all rentable items with stock information",
    description="Returns a list of all items that are available for rental with their stock details across locations. Supports search by name and filtering by category.",
    responses={
        200: {"description": "List of rentable items with stock information grouped by location"},
        500: {"description": "Internal server error"},
    },
)
async def get_rentable_items(
    location_id: str = Query(None, description="Optional location ID to filter items by specific location"),
    search_name: str = Query(None, description="Optional search term to filter items by name (case-insensitive partial match)"),
    category_id: str = Query(None, description="Optional category ID to filter items by category"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get all items that are available for rental with stock information.

    Returns items with structure:
    [
        {
            "item_id": "uuid",
            "inventory_unit_id": "uuid" or null (InventoryUnit id if available, null otherwise),
            "itemname": "string",
            "itemcategory_name": "string",
            "available_units": [
                {
                    "location_id": "uuid",
                    "location_name": "string",
                    "available_units": number
                }
            ]
        }
    ]

    - **location_id**: Optional location ID to filter by specific location (default: None - all locations)
    - **search_name**: Optional search term to filter items by name (case-insensitive partial match)
    - **category_id**: Optional category ID to filter items by category
    - **db**: Database session (injected)
    """
    service = RentalsService()
    try:
        return await service.get_rentable_items(db, location_id, search_name, category_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@router.post(
    "/new",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new rental",
    description="Creates a new rental transaction and returns the rental details.",
    responses={
        201: {"description": "Rental created successfully"},
        400: {"description": "Invalid input or business rule violation"},
    },
)
async def create_rental(
    body: NewRentalRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Create a new rental transaction.

    - **body**: Rental request payload
    - **db**: Database session (injected)
    """
    service = RentalsService()
    try:
        result = await service.create_rental(db, body)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Unexpected error in create_rental: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get(
    "/active",
    status_code=status.HTTP_200_OK,
    summary="Get active rental transactions",
    description="Retrieves all active rental transactions (in progress, late, extended, or partial returns) with comprehensive details and summary statistics.",
    responses={
        200: {"description": "Active rentals retrieved successfully"},
        500: {"description": "Internal server error"},
    },
)
async def get_active_rentals(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    status_filter: Optional[str] = Query(None, description="Filter by aggregated status group: in_progress, overdue, extended, partial_return"),
    location_id: Optional[str] = Query(None, description="Filter by location ID (UUID)"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID (UUID)"),
    show_overdue_only: bool = Query(False, description="Show only overdue rentals"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get all active rental transactions with comprehensive details.

    **Active Rental Statuses:**
    - **RENTAL_IN_PROGRESS**: Rental is currently active and within the rental period
    - **LATE**: Rental has passed the return date and is overdue
    - **EXTENDED**: Rental period has been extended beyond the original end date
    - **PARTIAL_RETURN**: Some items have been returned but not all
    - **LATE_PARTIAL_RETURN**: Partial return with overdue status

    **Aggregated Statistics:**
    The response includes pre-calculated statistics for frontend display:
    - **in_progress**: Count of RENTAL_INPROGRESS rentals
    - **overdue**: Count of RENTAL_LATE + RENTAL_LATE_PARTIAL_RETURN rentals
    - **extended**: Count of RENTAL_EXTENDED rentals
    - **partial_return**: Count of RENTAL_PARTIAL_RETURN + RENTAL_LATE_PARTIAL_RETURN rentals

    **Filtering Options:**
    - **status_filter**: Filter by aggregated status group (in_progress, overdue, extended, partial_return)
    - **location_id**: Filter by specific location UUID
    - **customer_id**: Filter by specific customer UUID
    - **show_overdue_only**: Boolean flag to show only overdue rentals

    **Response includes:**
    - Complete rental transaction details
    - Customer and location information
    - Financial summary with amounts and payments
    - Rental period information with overdue calculations
    - Item-level details with individual statuses
    - Summary statistics grouped by location and status
    - Aggregated statistics for dashboard cards
    - Detailed rental metrics (overdue value, items at risk, etc.)
    - Pagination information

    **Use Cases:**
    - Dashboard showing current active rentals
    - Operations management for tracking ongoing rentals
    - Customer service for rental status inquiries
    - Financial reporting for active rental revenue
    - Overdue rental management and follow-up

    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100, max: 1000)
    - **status_filter**: Optional filter by aggregated status group
    - **location_id**: Optional filter by location
    - **customer_id**: Optional filter by customer
    - **show_overdue_only**: Show only overdue rentals
    - **db**: Database session (injected)
    """
    service = RentalsService()
    try:
        return await service.get_active_rentals(
            session=db, 
            skip=skip, 
            limit=limit,
            status_filter=status_filter,
            location_id=location_id,
            customer_id=customer_id,
            show_overdue_only=show_overdue_only
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/due_today",
    status_code=status.HTTP_200_OK,
    summary="Get rentals due today",
    description="Retrieves all rental transactions that are due for return today with summary statistics and filtering options.",
    responses={
        200: {"description": "Due today rentals retrieved successfully"},
        500: {"description": "Internal server error"},
    },
)
async def get_due_today_rentals(
    location_id: str = Query(None, description="Optional location ID to filter rentals by specific location"),
    search: str = Query(None, description="Optional search term to filter by customer name or transaction number"),
    status: str = Query(None, description="Optional status filter to filter by rental status"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get all rental transactions that are due for return today.

    Returns rentals with structure:
    {
        "success": true,
        "message": "Due today rentals retrieved successfully",
        "data": [
            {
                "id": "uuid",
                "transaction_number": "RENT-20240127-0001",
                "customer_id": "uuid",
                "customer_name": "John Doe",
                "customer_phone": "+1234567890",
                "customer_email": "john@example.com",
                "location_id": "uuid",
                "location_name": "Main Store",
                "rental_start_date": "2024-01-20",
                "rental_end_date": "2024-01-27",
                "days_overdue": 0,
                "is_overdue": false,
                "status": "ACTIVE",
                "payment_status": "PAID",
                "total_amount": 150.00,
                "deposit_amount": 50.00,
                "items_count": 2,
                "items": [
                    {
                        "id": "uuid",
                        "item_id": "uuid",
                        "item_name": "Camera",
                        "sku": "CAM001",
                        "quantity": 1,
                        "unit_price": 100.00,
                        "rental_period_value": 7,
                        "rental_period_unit": "DAY",
                        "current_rental_status": "RENTED",
                        "notes": ""
                    }
                ],
                "created_at": "2024-01-20T10:00:00Z",
                "updated_at": "2024-01-20T10:00:00Z"
            }
        ],
        "summary": {
            "total_rentals": 5,
            "total_value": 750.00,
            "overdue_count": 0,
            "locations": [
                {
                    "location_id": "uuid",
                    "location_name": "Main Store",
                    "rental_count": 3,
                    "total_value": 450.00
                }
            ],
            "status_breakdown": {
                "ACTIVE": 4,
                "IN_PROGRESS": 1
            }
        },
        "filters_applied": {
            "location_id": "uuid",
            "search": "john",
            "status": "ACTIVE"
        },
        "timestamp": "2024-01-27T14:30:00Z"
    }

    - **location_id**: Optional location ID to filter by specific location
    - **search**: Optional search term to filter by customer name or transaction number (case-insensitive partial match)
    - **status**: Optional status filter to filter by rental status
    - **db**: Database session (injected)
    """
    service = RentalsService()
    try:
        return await service.get_due_today_rentals(db, location_id, search, status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/timezone-aware",
    response_model=RentalTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create timezone-aware rental transaction",
    description="Creates a new rental transaction with automatic timezone conversion (IST ↔ UTC) and proper datetime handling.",
    responses={
        201: {"description": "Timezone-aware rental created successfully", "model": RentalTransactionResponse},
        422: {"description": "Validation error - invalid timezone or datetime format"},
        500: {"description": "Internal server error"},
    },
)
async def create_timezone_aware_rental(
    request: RentalTransactionCreateRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Create a new rental transaction with timezone-aware datetime handling.
    
    This endpoint automatically handles timezone conversions:
    - Input datetimes in IST (or any timezone) → converted to UTC for database storage
    - Output datetimes from UTC → converted to IST (system timezone) for API response
    
    Key Features:
    - Automatic timezone conversion (no manual handling needed)
    - IST as default system timezone
    - Timezone validation for all datetime fields
    - Type-safe Pydantic models with timezone awareness
    - Full transaction validation and business logic
    
    Request Example (IST input):
    ```json
    {
        "customer_id": "uuid",
        "location_id": "uuid",
        "transaction_date": "2024-01-29T15:30:00+05:30",
        "rental_items": [
            {
                "item_id": "uuid",
                "quantity": 2,
                "unit_price": 100.00,
                "rental_start_date": "2024-01-30T10:00:00+05:30",
                "rental_end_date": "2024-02-05T18:00:00+05:30"
            }
        ]
    }
    ```
    
    Response Example (IST output):
    ```json
    {
        "id": "uuid",
        "transaction_date": "2024-01-29T15:30:00+05:30",
        "rental_items": [
            {
                "rental_start_date": "2024-01-30T10:00:00+05:30",
                "rental_end_date": "2024-02-05T18:00:00+05:30",
                "created_at": "2024-01-29T15:30:00+05:30"
            }
        ]
    }
    ```
    
    - **request**: Timezone-aware rental request with IST datetime fields
    - **db**: Database session (injected)
    """
    try:
        # The timezone conversion happens automatically in the Pydantic models
        # Input IST datetimes are converted to UTC for database storage
        # Response UTC datetimes are converted back to IST for API output
        
        service = RentalsService()
        
        # Convert the timezone-aware request to the format expected by the service
        # Note: In a real implementation, you'd update the service to accept timezone-aware models
        rental_data = {
            "customer_id": str(request.customer_id),
            "location_id": str(request.location_id) if request.location_id else None,
            "transaction_date": request.transaction_date.date().isoformat(),
            "payment_method": request.payment_method or "cash",
            "notes": request.notes or "",
            "items": [
                {
                    "item_id": str(item.item_id),
                    "quantity": item.quantity,
                    "unit_rate": float(item.unit_price),
                    "rental_start_date": item.rental_start_date.date().isoformat(),
                    "rental_end_date": item.rental_end_date.date().isoformat(),
                    "rental_period_value": (item.rental_end_date.date() - item.rental_start_date.date()).days + 1,
                    "rental_period_type": "DAILY",
                    "notes": item.condition_notes or ""
                }
                for item in request.rental_items
            ]
        }
        
        # Create the rental using existing service
        result = await service.create_rental(db, NewRentalRequest(**rental_data))
        
        # Convert the result to timezone-aware response
        # In a real implementation, this would be handled automatically by the service
        return RentalTransactionResponse(
            id=result.transaction_id,
            transaction_number=result.transaction_number,
            transaction_type="RENTAL",
            status="PENDING",
            customer_id=request.customer_id,
            location_id=request.location_id,
            transaction_date=request.transaction_date,
            rental_items=[
                # This would be populated from the actual created rental items
            ],
            currency=request.currency,
            subtotal=sum(item.quantity * item.unit_price for item in request.rental_items),
            total_amount=sum(item.quantity * item.unit_price for item in request.rental_items),
            payment_status="PENDING",
            notes=request.notes,
            created_at=request.transaction_date,  # Would be actual creation time
            updated_at=request.transaction_date   # Would be actual update time
        )
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create timezone-aware rental: {str(e)}")


# UNUSED BY FRONTEND - Commented out (missing EnhancedRentalService module)
# @router.post(
#     "/enhanced",
#     status_code=status.HTTP_201_CREATED,
#     summary="Create enhanced rental transaction",
#     description="Creates a new rental transaction using the enhanced PRD-compliant service with full validation, calculation, and inventory integration.",
#     responses={
#         201: {"description": "Enhanced rental created successfully"},
#         422: {"description": "Validation error - item not rentable or insufficient stock"},
#         500: {"description": "Internal server error"},
#     },
# )
# async def create_enhanced_rental(
#     request: dict,
#     db: AsyncSession = Depends(get_session),
# ):
#     """
#     Create a new rental transaction using the enhanced PRD-compliant service.
# 
#     This endpoint uses the EnhancedRentalService which implements:
#     - Complete validation (rentable items, stock availability)
#     - Accurate line item calculations (periods, rates, return dates)
#     - Transaction header calculations (subtotal, discounts, taxes)
#     - Inventory integration (StockLevel and StockMovement updates)
#     - Initial rental status (RENTAL_IN_PROGRESS)
# 
#     Request body:
#     {
#         "customer_id": "uuid",
#         "location_id": "uuid", 
#         "rental_start_date": "2025-07-30",
#         "items": [
#             {
#                 "item_id": "uuid",
#                 "quantity": 2,
#                 "no_of_periods": 3,
#                 "discount_amount": 5.00,
#                 "tax_rate": 2.0
#             }
#         ],
#         "notes": "Optional notes",
#         "discount_amount": 15.00,
#         "tax_rate": 7.0
#     }
# 
#     - **request**: Enhanced rental request payload with validation requirements
#     - **db**: Database session (injected)
#     """
#     try:
#         # Convert dict to RentalTransactionRequest
#         from datetime import date
#         from decimal import Decimal
#         
#         rental_start_date = date.fromisoformat(request.get("rental_start_date"))
#         
#         enhanced_request = RentalTransactionRequest(
#             customer_id=request["customer_id"],
#             location_id=request["location_id"],
#             rental_start_date=rental_start_date,
#             items=request.get("items", []),
#             notes=request.get("notes", ""),
#             discount_amount=Decimal(str(request.get("discount_amount", 0))),
#             tax_rate=Decimal(str(request.get("tax_rate", 0)))
#         )
#         
#         service = EnhancedRentalService(db)
#         result = await service.create_rental_transaction(enhanced_request)
#         
#         return {
#             "success": True,
#             "message": "Enhanced rental transaction created successfully",
#             "data": result
#         }
#         
#     except ValueError as e:
#         # Validation errors (non-rentable items, insufficient stock)
#         raise HTTPException(status_code=422, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# UNUSED BY FRONTEND - Commented out (missing RentableItemsService module)
# @router.get(
#     "/rentable_items_enhanced",
#     status_code=status.HTTP_200_OK,
#     summary="Get enhanced rentable items with comprehensive stock information",
#     description="Returns a comprehensive list of all items available for rental with detailed stock information across all locations, including aggregated totals and enhanced filtering.",
#     responses={
#         200: {"description": "Enhanced list of rentable items with comprehensive stock information"},
#         500: {"description": "Internal server error"},
#     },
# )
# async def get_enhanced_rentable_items(
#     location_id: str = Query(None, description="Optional location ID to filter items by specific location"),
#     category_id: str = Query(None, description="Optional category ID to filter items by category"),
#     search_term: str = Query(None, description="Optional search term to filter items by name (case-insensitive partial match)"),
#     include_zero_stock: bool = Query(False, description="Whether to include items with zero available stock"),
#     db: AsyncSession = Depends(get_session),
# ):
#     """
#     Get all items available for rental with enhanced stock information.
# 
#     This endpoint uses the RentableItemsService which provides:
#     - Complete stock information across all locations
#     - Aggregated totals (total available, total rented, total inventory units)
#     - Enhanced filtering options
#     - Brand and category information
#     - Inventory unit IDs for serialized items
# 
#     Returns items with enhanced structure:
#     [
#         {
#             "item_id": "uuid",
#             "inventory_unit_id": "uuid" or null,
#             "itemname": "Camera DSLR Canon 5D",
#             "itemcategory_name": "Photography Equipment",
#             "rental_rate_per_period": 50.00,
#             "rental_period": 7,
#             "unit_of_measurement": "Units",
#             "brand_name": "Canon",
#             "sku": "CAM-00001",
#             "total_inventory_units": 15,
#             "available_units_total": 8,
#             "rented_units_total": 7,
#             "available_units": [
#                 {
#                     "location_id": "uuid",
#                     "location_name": "Main Store",
#                     "available_units": 5,
#                     "on_hand_units": 8,
#                     "on_rent_units": 3
#                 },
#                 {
#                     "location_id": "uuid", 
#                     "location_name": "Warehouse",
#                     "available_units": 3,
#                     "on_hand_units": 7,
#                     "on_rent_units": 4
#                 }
#             ]
#         }
#     ]
# 
#     - **location_id**: Optional location ID to filter by specific location
#     - **category_id**: Optional category ID to filter items by category
#     - **search_term**: Optional search term to filter items by name
#     - **include_zero_stock**: Whether to include items with zero available stock (default: false)
#     - **db**: Database session (injected)
#     """
#     try:
#         service = RentableItemsService(db)
#         items = await service.get_all_rentable_items_with_stock(
#             location_id=location_id,
#             category_id=category_id,
#             search_term=search_term,
#             include_zero_stock=include_zero_stock
#         )
#         
#         return {
#             "success": True,
#             "message": "Enhanced rentable items retrieved successfully",
#             "data": items,
#             "total": len(items),
#             "filters_applied": {
#                 "location_id": location_id,
#                 "category_id": category_id,
#                 "search_term": search_term,
#                 "include_zero_stock": include_zero_stock
#             }
#         }
#         
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
## UNUSED BY FRONTEND - Commented out (missing RentableItemsService module)
# @router.get(
#     "/rentable_items_summary",
#     status_code=status.HTTP_200_OK,
#     summary="Get rentable items summary statistics",
#     description="Returns summary statistics about rentable items including total counts, availability metrics, and location distribution.",
#     responses={
#         200: {"description": "Rentable items summary statistics"},
#         500: {"description": "Internal server error"},
#     },
# )
# async def get_rentable_items_summary(
#     db: AsyncSession = Depends(get_session),
# ):
#     """
#     Get summary statistics about rentable items.
# 
#     Returns comprehensive statistics:
#     {
#         "success": true,
#         "message": "Rentable items summary retrieved successfully",
#         "data": {
#             "total_rentable_items": 45,
#             "items_with_available_stock": 38,
#             "locations_with_rentable_stock": 5,
#             "total_available_units": 156,
#             "total_rented_units": 89,
#             "availability_percentage": 84.44
#         }
#     }
# 
#     - **db**: Database session (injected)
#     """
#     try:
#         service = RentableItemsService(db)
#         summary = await service.get_rentable_items_summary()
#         
#         return {
#             "success": True,
#             "message": "Rentable items summary retrieved successfully",
#             "data": summary
#         }
#         
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# 
# 
## UNUSED BY FRONTEND - Commented out (missing RentableItemsService module)
# @router.get(
#     "/rentable_items_by_category",
#     status_code=status.HTTP_200_OK,
#     summary="Get rentable items grouped by category",
#     description="Returns rentable items grouped by category with availability statistics for each category.",
#     responses={
#         200: {"description": "Rentable items grouped by category with statistics"},
#         500: {"description": "Internal server error"},
#     },
# )
# async def get_rentable_items_by_category(
#     db: AsyncSession = Depends(get_session),
# ):
#     """
#     Get rentable items grouped by category with availability statistics.
# 
#     Returns categories with their item statistics:
#     [
#         {
#             "category_id": "uuid",
#             "category_name": "Photography Equipment",
#             "total_items": 12,
#             "items_with_stock": 10,
#             "total_available_units": 45,
#             "total_rented_units": 23,
#             "availability_rate": 83.33
#         }
#     ]
# 
#     - **db**: Database session (injected)
#     """
#     try:
#         service = RentableItemsService(db)
#         categories = await service.get_rentable_items_by_category()
#         
#         return {
#             "success": True,
#             "message": "Rentable items by category retrieved successfully",
#             "data": categories,
#             "total_categories": len(categories)
#         }
#         
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# 
@router.get(
    "/{rental_id}",
    status_code=status.HTTP_200_OK,
    summary="Get rental details by ID",
    description="Retrieves detailed information for a specific rental transaction including items, customer, and location details.",
    responses={
        200: {"description": "Rental details retrieved successfully"},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_rental_by_id(
    rental_id: str,
    db: AsyncSession = Depends(get_session),
):
    """
    Get detailed information for a specific rental transaction.

    - **rental_id**: The UUID of the rental transaction
    - **db**: Database session (injected)
    
    Returns comprehensive rental information including:
    - Transaction details (ID, number, dates, amounts)
    - Customer information
    - Location details
    - Rental items with pricing and dates
    - Payment and delivery information
    """
    service = RentalsService()
    try:
        rental = await service.get_rental_by_id(db, rental_id)
        if not rental:
            raise HTTPException(status_code=404, detail="Rental not found")
        return rental
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{rental_id}/return",
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive rental return data with enhanced metadata",
    description="Retrieves comprehensive rental information for return processing including the original rental transaction, all associated return transactions, returnable items with return options, financial previews, and enhanced return metadata.",
    responses={
        200: {"description": "Comprehensive rental return data retrieved successfully with enhanced metadata"},
        400: {"description": "Invalid rental ID format"},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_rental_return_data(
    rental_id: str,
    db: AsyncSession = Depends(get_session),
):
    """
    Get comprehensive rental information for return processing with enhanced metadata.
    
    **Enhanced Return Data Structure:**
    
    **Original Rental Transaction:**
    - Complete rental transaction details (customer, location, items, financial summary)
    - Rental period information with duration calculations
    - Payment and delivery/pickup details
    
    **Returnable Items Array (Enhanced):**
    - Items that can still be returned (RENTAL_INPROGRESS, RENTAL_LATE, RENTAL_EXTENDED)
    - **return_options** for each item:
      - can_partial_return: boolean (if quantity > 1)
      - max_returnable_quantity: number
      - is_overdue: boolean
      - days_overdue: number
      - estimated_late_fee: number
    - **condition_tracking** for each item:
      - requires_inspection: boolean
      - condition_options: array of condition states
      - default_condition: string
    
    **Enhanced Return Metadata:**
    - **return_summary**:
      - total_items: total number of line items
      - returnable_items: number of items that can be returned
      - total_original_quantity: sum of all item quantities
      - total_returnable_quantity: sum of returnable quantities
      - return_completion_percentage: percentage of items already returned
    - **financial_preview**:
      - original_deposit: deposit amount paid
      - estimated_late_fees: calculated late fees based on overdue days
      - estimated_refund: projected refund amount
    - Basic metadata: can_return, return_date, is_overdue, days_overdue
    
    **Return History:**
    - All return transactions that reference this rental
    - Complete transaction details with line items
    - Return workflow states and processing information
    
    **Example Response Structure:**
    ```json
    {
        "success": true,
        "message": "Rental return data with return history retrieved successfully",
        "data": {
            "id": "rental_uuid",
            "transaction_number": "RENT-2024-001",
            "customer_name": "John Doe",
            "items": [...],
            "returnable_items": [
                {
                    "id": "line_uuid",
                    "item_name": "Camera",
                    "quantity": 2,
                    "return_options": {
                        "can_partial_return": true,
                        "max_returnable_quantity": 2,
                        "is_overdue": false,
                        "days_overdue": 0,
                        "estimated_late_fee": 0.0
                    },
                    "condition_tracking": {
                        "requires_inspection": true,
                        "condition_options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED"],
                        "default_condition": "GOOD"
                    }
                }
            ],
            "return_metadata": {
                "can_return": true,
                "return_summary": {
                    "total_items": 3,
                    "returnable_items": 2,
                    "return_completion_percentage": 33.33
                },
                "financial_preview": {
                    "original_deposit": 150.00,
                    "estimated_late_fees": 0.0,
                    "estimated_refund": 150.00
                }
            },
            "return_transactions": [...]
        }
    }
    ```
    
    **Parameters:**
    - **rental_id**: The UUID of the rental transaction to retrieve return data for
    - **db**: Database session (injected)
    
    **Use Cases:**
    - Rental return processing interface
    - Financial impact preview before processing returns
    - Return workflow management
    - Condition tracking and inspection workflows
    - Partial return scenarios
    """
    from datetime import datetime
    service = RentalsService()
    try:
        # Get rental with all associated return transactions
        result = await service.get_rental_with_returns(db, rental_id)
        if not result:
            raise HTTPException(status_code=404, detail="Rental not found")
        
        # Add backward compatibility - if frontend expects the old format,
        # we maintain the original rental data structure at the top level
        rental_data = result["data"]["original_rental"]
        
        # Add return-specific metadata for UI
        current_date = datetime.now().date()
        returnable_items = []
        for item in rental_data["items"]:
            if item["current_rental_status"] in ["RENTAL_INPROGRESS", "RENTAL_LATE", "RENTAL_EXTENDED"]:
                # Enhanced returnable item with additional return-specific metadata
                returnable_item = item.copy()
                item_end_date = datetime.fromisoformat(item["rental_end_date"]).date() if item.get("rental_end_date") else None
                item_is_overdue = item_end_date and current_date > item_end_date
                item_days_overdue = (current_date - item_end_date).days if item_is_overdue else 0
                
                returnable_item.update({
                    "return_options": {
                        "can_partial_return": item["quantity"] > 1,
                        "max_returnable_quantity": item["quantity"],
                        "is_overdue": item_is_overdue,
                        "days_overdue": item_days_overdue,
                        "estimated_late_fee": item_days_overdue * 5.0 if item_is_overdue else 0.0
                    },
                    "condition_tracking": {
                        "requires_inspection": True,
                        "condition_options": ["EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED"],
                        "default_condition": "GOOD"
                    }
                })
                returnable_items.append(returnable_item)
        
        rental_data["returnable_items"] = returnable_items
        
        # Calculate enhanced return metadata
        total_returnable_items = len(rental_data["returnable_items"])
        rental_end_date_obj = datetime.fromisoformat(rental_data["rental_end_date"]).date() if rental_data.get("rental_end_date") else None
        is_overdue = rental_end_date_obj and current_date > rental_end_date_obj
        days_overdue = (current_date - rental_end_date_obj).days if is_overdue else 0
        
        # Calculate total quantities for return summary
        total_original_quantity = sum(item["quantity"] for item in rental_data["items"])
        total_returnable_quantity = sum(item["quantity"] for item in rental_data["returnable_items"])
        
        rental_data["return_metadata"] = {
            "can_return": total_returnable_items > 0,
            "return_date": current_date.isoformat(),
            "is_overdue": is_overdue,
            "days_overdue": days_overdue,
            "total_returns": result["data"]["total_returns"],
            "return_summary": {
                "total_items": len(rental_data["items"]),
                "returnable_items": total_returnable_items,
                "total_original_quantity": total_original_quantity,
                "total_returnable_quantity": total_returnable_quantity,
                "return_completion_percentage": round((total_original_quantity - total_returnable_quantity) / total_original_quantity * 100, 2) if total_original_quantity > 0 else 0
            },
            "financial_preview": {
                "original_deposit": rental_data.get("deposit_amount", 0),
                "estimated_late_fees": days_overdue * total_returnable_items * 5.0 if is_overdue else 0.0,
                "estimated_refund": max(0, rental_data.get("deposit_amount", 0) - (days_overdue * total_returnable_items * 5.0 if is_overdue else 0))
            }
        }
        
        # Add the return transactions array to the response (renamed to return_history for frontend compatibility)
        rental_data["return_history"] = result["data"]["return_transactions"]
        
        return {
            "success": True,
            "message": "Rental return data with return history retrieved successfully",
            "data": rental_data
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{rental_id}/return/timezone-aware",
    response_model=TimezoneRentalReturnResponse,
    status_code=status.HTTP_200_OK,
    summary="Process timezone-aware rental return",
    description="Process rental return with automatic timezone conversion (IST ↔ UTC) for all datetime fields.",
    responses={
        200: {"description": "Timezone-aware return processed successfully", "model": TimezoneRentalReturnResponse},
        400: {"description": "Invalid return request or timezone format"},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def process_timezone_aware_rental_return(
    rental_id: str,
    return_request: TimezoneRentalReturnRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Process a rental return with timezone-aware datetime handling.
    
    This endpoint automatically handles timezone conversions:
    - Input return_date in IST (or any timezone) → converted to UTC for processing
    - Output datetimes from UTC → converted to IST (system timezone) for API response
    
    Key Features:
    - Automatic timezone conversion for return processing dates
    - IST as default system timezone
    - Financial calculations with timezone-aware processing
    - Late fee calculations based on correct timezone handling
    - Type-safe return processing with validation
    
    Request Example (IST input):
    ```json
    {
        "return_date": "2024-02-05T14:30:00+05:30",
        "returned_items": [
            {
                "item_id": "uuid",
                "quantity_returned": 2,
                "condition": "good",
                "condition_notes": "Items in excellent condition"
            }
        ],
        "late_fees": 50.00,
        "damage_fees": 0.00,
        "inspector_notes": "All items returned on time and in good condition"
    }
    ```
    
    Response Example (IST output):
    ```json
    {
        "id": "uuid",
        "return_date": "2024-02-05T14:30:00+05:30",
        "processed_at": "2024-02-05T14:30:00+05:30",
        "created_at": "2024-02-05T14:30:00+05:30"
    }
    ```
    
    - **rental_id**: The UUID of the rental transaction
    - **return_request**: Timezone-aware return details with IST datetime fields
    - **db**: Database session (injected)
    """
    try:
        # The timezone conversion happens automatically in the Pydantic models
        # Input IST datetimes are converted to UTC for database processing
        # Response UTC datetimes are converted back to IST for API output
        
        service = RentalReturnService()
        
        # Convert timezone-aware request to the format expected by the service
        # Note: In a real implementation, you'd update the service to accept timezone-aware models
        legacy_return_request = RentalReturnRequest(
            rental_id=rental_id,
            return_date=return_request.return_date.date(),
            returned_items=[
                {
                    "item_id": str(item["item_id"]) if isinstance(item, dict) else str(item.item_id),
                    "quantity_returned": item["quantity_returned"] if isinstance(item, dict) else item.quantity_returned,
                    "condition": item.get("condition", "good") if isinstance(item, dict) else getattr(item, "condition", "good"),
                    "condition_notes": item.get("condition_notes", "") if isinstance(item, dict) else getattr(item, "condition_notes", "")
                }
                for item in return_request.returned_items
            ],
            late_fees=return_request.late_fees,
            damage_fees=return_request.damage_fees,
            inspector_notes=return_request.inspector_notes,
            customer_feedback=return_request.customer_feedback
        )
        
        # Process the return using existing service
        result = await service.process_rental_return(db, legacy_return_request)
        
        # Convert the result to timezone-aware response
        # In a real implementation, this would be handled automatically by the service
        return TimezoneRentalReturnResponse(
            id=result.id,
            transaction_id=result.transaction_id,
            return_number=result.return_number,
            return_date=return_request.return_date,
            processed_at=return_request.return_date,  # Would be actual processing time
            returned_items=return_request.returned_items,
            inspector_notes=return_request.inspector_notes,
            customer_feedback=return_request.customer_feedback,
            original_total=result.original_total,
            late_fees=return_request.late_fees,
            damage_fees=return_request.damage_fees,
            deposit_refund=return_request.deposit_refund,
            final_amount=result.final_amount,
            return_status=result.return_status,
            partial_return=return_request.partial_return,
            processed_by=result.processed_by,
            created_at=return_request.return_date,  # Would be actual creation time
            updated_at=return_request.return_date   # Would be actual update time
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process timezone-aware return: {str(e)}")


@router.post(
    "/{rental_id}/return",
    response_model=None,  # Disable response model to avoid wrapping
    status_code=status.HTTP_200_OK,
    summary="Process rental return",
    description="Process the return of rental items, updating statuses and inventory levels.",
    responses={
        200: {"description": "Return processed successfully"},
        400: {"description": "Invalid return request"},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def process_rental_return(
    rental_id: str,
    return_request: RentalReturnRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Process a rental return.
    
    Updates rental item statuses, inventory levels, and calculates any
    financial impacts (late fees, deposit refunds, etc.).
    
    - **rental_id**: The UUID of the rental transaction
    - **return_request**: Return details including items and dates
    - **db**: Database session (injected)
    """
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    
    
    # Ensure rental_id matches the request
    if return_request.rental_id != rental_id:
        raise HTTPException(status_code=400, detail="Rental ID mismatch")
    
    service = RentalReturnService()
    try:
        print(f"DEBUG: About to call service.process_rental_return")
        result = await service.process_rental_return(db, return_request)
        print(f"DEBUG: Service call completed successfully")
        print(f"DEBUG: Result type: {type(result)}")
        
        # Use JSONResponse to bypass any middleware that might wrap the response
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=result.model_dump(mode='json'),
            status_code=200
        )
    except ValueError as e:
        print(f"DEBUG: ValueError caught: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"DEBUG: Exception caught: {e}")
        print(f"DEBUG: Exception type: {type(e)}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Return processing failed: {str(e)}")



@router.post(
    "/{rental_id}/return-direct",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Process rental return with direct response format",
    description="Process the return of rental items with direct response format (no wrapper). This endpoint returns the response exactly as documented without the standard API wrapper.",
    responses={
        200: {"description": "Return processed successfully with direct format"},
        400: {"description": "Invalid return request"},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def process_rental_return_direct(
    rental_id: str,
    return_request: RentalReturnRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Process a rental return with direct response format.
    
    This endpoint returns the response in the exact format specified in the documentation,
    without the standard API wrapper that other endpoints use.
    
    - **rental_id**: The UUID of the rental transaction
    - **return_request**: Return details including items and dates
    - **db**: Database session (injected)
    """
    # Ensure rental_id matches the request
    if return_request.rental_id != rental_id:
        raise HTTPException(status_code=400, detail="Rental ID mismatch")
    
    service = RentalReturnService()
    try:
        # Process the return
        result = await service.process_rental_return(db, return_request)
        
        # Convert datetime objects to ISO format strings for JSON serialization
        response_dict = result.model_dump(mode='json')
        
        # Ensure proper date/datetime formatting
        if 'return_date' in response_dict:
            response_dict['return_date'] = result.return_date.isoformat()
        
        if 'timestamp' in response_dict:
            response_dict['timestamp'] = result.timestamp.isoformat()
        
        # Format items_returned dates
        if 'items_returned' in response_dict:
            for item in response_dict['items_returned']:
                if 'return_date' in item and hasattr(item['return_date'], 'isoformat'):
                    item['return_date'] = item['return_date'].isoformat()
        
        # Return direct JSON response without any wrapper
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=response_dict,
            status_code=200,
            headers={
                "Content-Type": "application/json",
                "X-Direct-Response": "true"  # Custom header to indicate direct response
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"Error in return-direct endpoint: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Return processing failed: {str(e)}")


@router.get(
    "/{rental_id}/print",
    status_code=status.HTTP_200_OK,
    summary="Generate printable rental invoice (HTML)",
    description="Generate a beautifully formatted HTML rental invoice for printing. Returns HTML content that can be displayed in browser and printed.",
    responses={
        200: {"description": "HTML invoice content", "content": {"text/html": {}}},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def print_rental_invoice_html(
    rental_id: str,
    company_name: Optional[str] = Query(None, description="Override company name for invoice"),
    company_address: Optional[str] = Query(None, description="Override company address for invoice"),
    company_phone: Optional[str] = Query(None, description="Override company phone for invoice"),
    company_email: Optional[str] = Query(None, description="Override company email for invoice"),
    db: AsyncSession = Depends(get_session),
):
    """
    Generate a professional HTML rental invoice for printing.
    
    **Features:**
    - Professional invoice layout with company branding
    - Complete rental transaction details
    - Itemized rental items with pricing
    - Financial summary with taxes and discounts
    - Rental period and delivery/pickup information
    - Print-optimized CSS styling
    - Automatic print dialog option
    
    **Usage:**
    - Open the returned HTML in a browser to display the invoice
    - Use browser's print function to print or save as PDF
    - Add `?print=true` to URL to auto-trigger print dialog
    - Customize company information with query parameters
    
    **Example:**
    ```
    GET /api/transactions/rentals/uuid/print?company_name=My+Company&print=true
    ```
    
    The generated invoice includes:
    - Company header with contact information
    - Customer details and transaction information
    - Rental period with start/end dates
    - Itemized list of rented equipment
    - Financial breakdown with totals
    - Payment and delivery information
    - Professional formatting for print
    """
    try:
        # Build company info from query parameters if provided
        company_info = None
        if any([company_name, company_address, company_phone, company_email]):
            company_info = {
                "name": company_name or "Equipment Rental Solutions",
                "address": company_address or "123 Business Park Drive\nSuite 100\nCity, State 12345",
                "phone": company_phone or "(555) 123-4567",
                "email": company_email or "info@equipmentrental.com",
                "website": "www.equipmentrental.com",
                "tax_id": "12-3456789"
            }
        
        invoice_service = RentalInvoiceService(db)
        html_content = await invoice_service.generate_rental_invoice_html(rental_id, company_info)
        
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=html_content, media_type="text/html")
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice: {str(e)}")


@router.get(
    "/{rental_id}/print/text",
    status_code=status.HTTP_200_OK,
    summary="Generate printable rental invoice (Plain Text)",
    description="Generate a plain text rental invoice suitable for simple printing, email, or console display.",
    responses={
        200: {"description": "Plain text invoice content", "content": {"text/plain": {}}},
        404: {"description": "Rental not found"},
        500: {"description": "Internal server error"},
    },
)
async def print_rental_invoice_text(
    rental_id: str,
    company_name: Optional[str] = Query(None, description="Override company name for invoice"),
    company_address: Optional[str] = Query(None, description="Override company address for invoice"),
    company_phone: Optional[str] = Query(None, description="Override company phone for invoice"),
    company_email: Optional[str] = Query(None, description="Override company email for invoice"),
    db: AsyncSession = Depends(get_session),
):
    """
    Generate a plain text rental invoice for simple printing or email.
    
    **Features:**
    - Clean, monospace-friendly text formatting
    - All essential rental transaction information
    - ASCII art borders and separators
    - Suitable for console display, email, or simple printing
    - Compact format for quick reference
    
    **Usage:**
    - Returns plain text that can be displayed in any text editor
    - Perfect for console applications or simple email templates
    - Can be easily copied and pasted
    - Customize company information with query parameters
    
    **Example:**
    ```
    GET /api/transactions/rentals/uuid/print/text
    ```
    
    The text invoice includes:
    - Company header with ASCII borders
    - Customer and transaction details
    - Rental period information
    - Itemized equipment list in table format
    - Financial summary with totals
    - Payment information
    - Clean, readable formatting
    """
    try:
        # Build company info from query parameters if provided
        company_info = None
        if any([company_name, company_address, company_phone, company_email]):
            company_info = {
                "name": company_name or "Equipment Rental Solutions",
                "address": company_address or "123 Business Park Drive\nSuite 100\nCity, State 12345",
                "phone": company_phone or "(555) 123-4567",
                "email": company_email or "info@equipmentrental.com"
            }
        
        invoice_service = RentalInvoiceService(db)
        text_content = await invoice_service.generate_rental_invoice_text(rental_id, company_info)
        
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=text_content, media_type="text/plain")
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate text invoice: {str(e)}")


# =====================================================
# RENTAL EXTENSION ENDPOINTS
# =====================================================

@router.get(
    "/{rental_id}/extension-availability",
    response_model=ExtensionAvailabilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Check rental extension availability",
    description="Check if a rental can be extended and identify any booking conflicts"
)
async def check_extension_availability(
    rental_id: str,
    new_end_date: date = Query(..., description="Proposed new end date"),
    db: AsyncSession = Depends(get_session)
):
    """
    Check if a rental can be extended to the specified date.
    
    This endpoint:
    - Validates the rental can be extended
    - Checks for booking conflicts with other customers
    - Calculates extension charges
    - Returns item-level availability information
    
    Returns:
    - can_extend: Whether extension is possible
    - conflicts: Details of any booking conflicts
    - extension_charges: Calculated charges for the extension
    - current_balance: Current balance due on the rental
    - items: Item-level availability details
    """
    try:
        extension_service = RentalExtensionService()
        
        # Get rental items
        rental = await extension_service._get_rental_with_details(db, rental_id)
        items = [
            {
                "line_id": str(line.id),
                "item_id": str(line.item_id),
                "extend_quantity": line.quantity
            }
            for line in rental.transaction_lines
        ]
        
        result = await extension_service.check_extension_availability(
            db, rental_id, new_end_date, items
        )
        
        return ExtensionAvailabilityResponse(**result)
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{rental_id}/extend",
    response_model=RentalExtensionResponse,
    status_code=status.HTTP_200_OK,
    summary="Process rental extension",
    description="Extend a rental with optional payment and partial returns"
)
async def process_rental_extension(
    rental_id: str,
    extension_request: RentalExtensionRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Process a rental extension with flexible payment options.
    
    Features:
    - Extend all or specific items
    - Different end dates per item
    - Optional partial returns with condition assessment
    - Flexible payment (pay now or at return)
    - Automatic inventory updates
    
    The extension will:
    1. Check for booking conflicts
    2. Calculate extension charges
    3. Process any partial returns
    4. Update rental end dates
    5. Process optional payment
    6. Update inventory reservations
    """
    try:
        extension_service = RentalExtensionService()
        
        # Add rental_id to the request data
        request_data = extension_request.dict()
        request_data["rental_id"] = rental_id
        
        result = await extension_service.process_extension(
            db, rental_id, request_data
        )
        
        await db.commit()
        
        return RentalExtensionResponse(**result)
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{rental_id}/balance",
    response_model=RentalBalanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get rental balance",
    description="Get current balance and payment status for a rental"
)
async def get_rental_balance(
    rental_id: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Get the current balance for a rental.
    
    Returns:
    - Original rental charges
    - Extension charges
    - Late fees (if applicable)
    - Damage fees (if applicable)
    - Total charges
    - Payments received
    - Balance due
    - Payment status
    """
    try:
        extension_service = RentalExtensionService()
        rental = await extension_service._get_rental_with_details(db, rental_id)
        
        balance = extension_service._calculate_rental_balance(rental)
        
        return RentalBalanceResponse(
            rental_id=rental_id,
            transaction_number=rental.transaction_number,
            extension_count=rental.extension_count,
            **balance
        )
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{rental_id}/extension-history",
    response_model=ExtensionHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get rental extension history",
    description="Get all extensions for a rental"
)
async def get_extension_history(
    rental_id: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Get the complete extension history for a rental.
    
    Returns:
    - List of all extensions
    - Extension dates and charges
    - Payment information
    - User who processed each extension
    """
    try:
        extension_service = RentalExtensionService()
        rental = await extension_service._get_rental_with_details(db, rental_id)
        
        extensions = []
        for ext in rental.extensions:
            extensions.append({
                "extension_id": str(ext.id),
                "extension_date": ext.extension_date,
                "original_end_date": ext.original_end_date,
                "new_end_date": ext.new_end_date,
                "extension_type": ext.extension_type.value,
                "extension_charges": float(ext.extension_charges),
                "payment_received": float(ext.payment_received),
                "payment_status": ext.payment_status.value,
                "extended_by": ext.extended_by,
                "notes": ext.notes
            })
        
        return ExtensionHistoryResponse(
            rental_id=rental_id,
            transaction_number=rental.transaction_number,
            total_extensions=rental.extension_count,
            extensions=extensions
        )
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# UNUSED BY FRONTEND - Commented out for security
# The following endpoints would be unused if they existed:
# - GET /overdue (get overdue rentals)
# - POST /book (booking rentals for future)
# - GET /invoice/{rental_id} (generate rental invoices)
# These endpoints are not currently implemented in this routes file