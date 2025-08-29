from fastapi import APIRouter
from typing import Any

from app.api.v1.endpoints import auth, users, customers, suppliers, companies, contact_persons, categories, unit_of_measurement, brands, items, locations, analytics, transactions, rental_pricing
from app.api.v1.endpoints.inventory import router as inventory_router
from app.core.config import settings

api_router = APIRouter()

# Health check endpoint under API prefix for consistency
@api_router.get("/health")
async def api_health_check() -> dict[str, Any]:
    """
    API Health check endpoint.
    Provides the same information as the root health endpoint.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
        "api": True,
    }

# Include routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(contact_persons.router, prefix="/contact-persons", tags=["contact-persons"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(unit_of_measurement.router, prefix="/unit-of-measurement", tags=["unit-of-measurement"])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(rental_pricing.router, prefix="/rental-pricing", tags=["rental-pricing"])
api_router.include_router(inventory_router, prefix="/inventory", tags=["inventory"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(transactions.router)  # Router already has /transactions prefix

# System endpoints
@api_router.get("/system/company")
async def get_system_company():
    """
    Get system company profile.
    Returns basic company information for the system.
    """
    return {
        "id": "00000000-0000-0000-0000-000000000000",
        "company_name": "Rental Manager System",
        "status": "active",
        "logo_url": None,
        "address": None,
        "phone": None,
        "email": None,
        "website": None
    }