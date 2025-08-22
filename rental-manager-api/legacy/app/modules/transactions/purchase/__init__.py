"""
Purchase Module

Handles all purchase-related transactions including creation, retrieval, and returns.
"""

from app.modules.transactions.purchase.schemas import (
    PurchaseResponse,
    NewPurchaseRequest,
    NewPurchaseResponse,
    PurchaseItemCreate,
    PurchaseLineItemResponse,
    PurchaseDetail,
    PurchaseListResponse,
    SupplierNestedResponse,
    LocationNestedResponse,
    ItemNestedResponse,
)
from app.modules.transactions.purchase.service import PurchaseService
# from app.modules.transactions.purchase.repository import PurchaseRepository  # Currently contains RentalsRepository
from app.modules.transactions.purchase.routes import router as purchase_router

__all__ = [
    # Schemas
    "PurchaseResponse",
    "NewPurchaseRequest",
    "NewPurchaseResponse",
    "PurchaseItemCreate",
    "PurchaseLineItemResponse",
    "PurchaseDetail",
    "PurchaseListResponse",
    "SupplierNestedResponse",
    "LocationNestedResponse",
    "ItemNestedResponse",
    # Service and Repository
    "PurchaseService",
    # "PurchaseRepository",  # Currently contains RentalsRepository
    # Router
    "purchase_router",
]