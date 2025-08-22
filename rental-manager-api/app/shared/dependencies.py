from typing import Optional, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

# Re-export the database session function
from app.core.database import get_db
from app.core.config import settings
# Database dependency
AsyncSessionDep = Annotated[AsyncSession, Depends(get_db)]


# Common query parameters
class CommonQueryParams(BaseModel):
    """Common query parameters for list endpoints."""
    
    skip: int = Query(0, ge=0, description="Number of records to skip")
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Number of records to return"
    )
    sort_by: Optional[str] = Query(None, description="Field to sort by")
    sort_order: str = Query("asc", pattern=r"^(asc|desc)$", description="Sort order")
    search: Optional[str] = Query(None, description="Search term")
    is_active: Optional[bool] = Query(None, description="Filter by active status")


class PaginationParams(BaseModel):
    """Pagination parameters."""
    
    page: int = Query(1, ge=1, description="Page number")
    page_size: int = Query(
        20,
        ge=1,
        le=100,
        description="Items per page"
    )
    
    @property
    def skip(self) -> int:
        """Calculate skip value from page number."""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """Get limit value."""
        return self.page_size


# Repository dependencies
# These will be implemented as modules are created


async def get_customer_repository(session: AsyncSessionDep):
    """Get customer repository instance."""
    from app.crud.customer import CustomerRepository
    return CustomerRepository(session)


async def get_supplier_repository(session: AsyncSessionDep):
    """Get supplier repository instance."""
    from app.crud.supplier import SupplierRepository
    return SupplierRepository(session)


# Service dependencies


async def get_customer_service(
    session: AsyncSessionDep
):
    """Get customer service instance."""
    from app.services.customer import CustomerService
    return CustomerService(session)


async def get_supplier_service(
    session: AsyncSessionDep
):
    """Get supplier service instance."""
    from app.services.supplier import SupplierService
    return SupplierService(session)


# API Key dependency (for external integrations)
async def get_api_key(
    api_key: str = Query(..., description="API Key for authentication")
) -> str:
    """
    Validate API key from query parameter.
    """
    # TODO: Implement API key validation
    # This would check against stored API keys in database
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
    
    # Temporary validation
    if api_key != "test-api-key":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return api_key


# Request ID dependency (for request tracking)
async def get_request_id() -> str:
    """
    Generate unique request ID for tracking.
    """
    import uuid
    return str(uuid.uuid4())


# Export commonly used dependencies
__all__ = [
    "AsyncSessionDep",
    "CommonQueryParams", 
    "PaginationParams",
    "get_db",
    "get_api_key",
    "get_request_id",
    "get_customer_service",
    "get_supplier_service",
]