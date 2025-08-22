from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, customers, suppliers, companies, contact_persons, categories, unit_of_measurement, brands, items, locations
from app.api.v1.endpoints.inventory import router as inventory_router

api_router = APIRouter()

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
api_router.include_router(inventory_router, prefix="/inventory", tags=["inventory"])