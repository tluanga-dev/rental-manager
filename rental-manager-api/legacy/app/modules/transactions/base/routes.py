from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.shared.dependencies import get_session
from app.modules.transactions.base.repositories.async_repositories import AsyncTransactionHeaderRepository
from app.modules.transactions.base.models.transaction_headers import TransactionType, TransactionStatus

from app.modules.transactions.purchase.routes import router as purchase_router
from app.modules.transactions.purchase_returns.routes import router as purchase_returns_router
from app.modules.transactions.rentals import rentals_router
from app.modules.transactions.sales.routes import router as sales_router
from app.modules.auth.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(tags=["Transactions"])

@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="Get all transactions",
    description="Retrieves all transactions with optional filtering by transaction type and status.",
    responses={
        200: {"description": "Transactions retrieved successfully"},
        500: {"description": "Internal server error"},
    },
)
async def get_all_transactions(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    transaction_type: Optional[TransactionType] = Query(None, description="Filter by transaction type"),
    status_in: Optional[List[TransactionStatus]] = Query(None, description="Filter by multiple statuses"),
    db: AsyncSession = Depends(get_session),
):
    """
    Get all transactions with optional filtering.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100, max: 1000)
    - **transaction_type**: Filter by transaction type (RENTAL, PURCHASE, SALE, etc.)
    - **status_in**: Filter by multiple statuses
    """
    try:
        repo = AsyncTransactionHeaderRepository(db)
        
        transactions = await repo.get_all(
            skip=skip,
            limit=limit,
            transaction_type=transaction_type,
            status_list=status_in
        )
        
        return {
            "success": True,
            "message": "Transactions retrieved successfully",
            "data": [
                {
                    "id": str(transaction.id),
                    "transaction_number": transaction.transaction_number,
                    "transaction_type": transaction.transaction_type,
                    "status": transaction.status,
                    "transaction_date": transaction.transaction_date.isoformat() if transaction.transaction_date else None,
                    "customer_id": transaction.customer_id,
                    "location_id": transaction.location_id,
                    "total_amount": float(transaction.total_amount) if transaction.total_amount else 0.0,
                    "payment_status": transaction.payment_status,
                    "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
                    "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
                }
                for transaction in transactions
            ],
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": len(transactions)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

router.include_router(purchase_router, prefix="/purchases", tags=["Purchases"])
router.include_router(purchase_returns_router, prefix="/purchase-returns", tags=["Purchase Returns"])
router.include_router(rentals_router, prefix="/rentals", tags=["Rentals"])
router.include_router(sales_router, prefix="/sales", tags=["Sales"])

