"""
Rentals Module

Handles all rental-related transactions including creation, retrieval, extensions, and returns.
The module is organized into submodules for better code organization and maintainability.

Submodules:
- rental_core: Core rental functionality (creation, retrieval, management)
- rental_booking: Booking operations and availability management
- rental_extension: Rental period extensions and modifications
- rental_return: Return processing and inventory reintegration
"""

# Import from rental_core submodule
from app.modules.transactions.rentals.rental_core import (
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
    RentalsService,
    RentalsRepository,
    rental_core_router
)

# Import from rental_booking submodule
from app.modules.transactions.rentals.rental_booking import (
    BookingService,
    BookingRepository,
    booking_router as rental_booking_router
)

# Import from rental_extension submodule
from app.modules.transactions.rentals.rental_extension import (
    RentalExtensionService
)

# Import from rental_return submodule
from app.modules.transactions.rentals.rental_return import (
    RentalReturnService
)

# Main rentals router (combines all submodule routers)
from app.modules.transactions.rentals.rental_core.routes import router as rentals_router

__all__ = [
    # Core Schemas
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
    # Core Service and Repository
    "RentalsService",
    "RentalsRepository",
    # Booking Service and Repository
    "BookingService",
    "BookingRepository",
    # Extension Service
    "RentalExtensionService",
    # Return Service
    "RentalReturnService",
    # Routers
    "rentals_router",
    "rental_core_router",
    "rental_booking_router"
]