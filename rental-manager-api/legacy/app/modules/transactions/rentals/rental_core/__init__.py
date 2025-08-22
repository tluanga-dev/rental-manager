"""
Rental Core Module

Core rental functionality including creation, retrieval, and management of rental transactions.
"""

from .schemas import (
    RentalResponse,
    NewRentalRequest,
    NewRentalResponse,
    RentalItemCreate,
    RentalLineItemResponse,
    RentalDetail,
    RentalListResponse,
    CustomerNestedResponse,
    LocationNestedResponse,
    ItemNestedResponse,
    RentableItemResponse,
    LocationAvailability,
    BrandNested,
    CategoryNested,
    UnitOfMeasurementNested,
    RentalPeriodUpdate,
)
from .service import RentalsService
from .repository import RentalsRepository
from .routes import router as rental_core_router

__all__ = [
    # Schemas
    "RentalResponse",
    "NewRentalRequest",
    "NewRentalResponse",
    "RentalItemCreate",
    "RentalLineItemResponse",
    "RentalDetail",
    "RentalListResponse",
    "CustomerNestedResponse",
    "LocationNestedResponse",
    "ItemNestedResponse",
    "RentableItemResponse",
    "LocationAvailability",
    "BrandNested",
    "CategoryNested",
    "UnitOfMeasurementNested",
    "RentalPeriodUpdate",
    # Service and Repository
    "RentalsService",
    "RentalsRepository",
    # Router
    "rental_core_router",
]