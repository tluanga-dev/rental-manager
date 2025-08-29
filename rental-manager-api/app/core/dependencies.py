from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.crud.brand import BrandRepository
from app.crud.category import CategoryRepository  
from app.crud.unit_of_measurement import UnitOfMeasurementRepository
from app.crud.item import ItemRepository
from app.services.brand import BrandService
from app.services.category import CategoryService
from app.services.unit_of_measurement import UnitOfMeasurementService
from app.services.item import ItemService
from app.services.item_rental_blocking import ItemRentalBlockingService
from app.services.sku_generator import SKUGenerator


# Security scheme
security = HTTPBearer()


# Authentication dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user"""
    # TODO: Implement when user service is available
    # from app.modules.users.services import UserService
    # from app.modules.users.models import User
    # from app.core.security import verify_token, TokenData
    
    # token = credentials.credentials
    # token_data = verify_token(token, "access")
    
    # user_service = UserService(db)
    # user = await user_service.get_by_id(token_data.user_id)
    
    # if user is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="User not found",
    #         headers={"WWW-Authenticate": "Bearer"},
    #     )
    
    # if not user.is_active:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Inactive user",
    #         headers={"WWW-Authenticate": "Bearer"},
    #     )
    
    # return user
    
    # Placeholder implementation
    class MockUser:
        def __init__(self):
            self.id = "1"
            self.is_active = True
            self.is_superuser = False
    
    return MockUser()


async def get_current_active_user(
    current_user = Depends(get_current_user)
):
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user = Depends(get_current_user)
):
    """Get current superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Optional authentication dependency
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current user if authenticated, otherwise None"""
    if credentials is None:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


# Pagination dependency
class PaginationParams:
    """Pagination parameters for list endpoints"""
    
    def __init__(self, skip: int = 0, limit: int = 100):
        self.skip = skip
        self.limit = min(limit, 100)  # Max 100 items per page


async def get_pagination_params(
    skip: int = 0,
    limit: int = 20
) -> PaginationParams:
    """Get pagination parameters"""
    return PaginationParams(skip=skip, limit=limit)


# Helper function to get current user ID as string
async def get_current_user_id(
    current_user = Depends(get_current_active_user)
) -> Optional[str]:
    """Get current user ID as string"""
    return str(current_user.id) if current_user else None


# Service Dependencies
async def get_brand_service(db: AsyncSession = Depends(get_db)) -> BrandService:
    """Get brand service instance."""
    repository = BrandRepository(db)
    return BrandService(repository)


async def get_category_service(db: AsyncSession = Depends(get_db)) -> CategoryService:
    """Get category service instance."""
    repository = CategoryRepository(db)
    return CategoryService(repository)


async def get_unit_of_measurement_service(db: AsyncSession = Depends(get_db)) -> UnitOfMeasurementService:
    """Get unit of measurement service instance."""
    repository = UnitOfMeasurementRepository(db)
    return UnitOfMeasurementService(repository)


async def get_sku_generator(db: AsyncSession = Depends(get_db)) -> SKUGenerator:
    """Get SKU generator instance."""
    return SKUGenerator(db)


async def get_item_repository(db: AsyncSession = Depends(get_db)) -> ItemRepository:
    """Get item repository instance."""
    return ItemRepository(db)


async def get_item_service(
    db: AsyncSession = Depends(get_db)
) -> ItemService:
    """Get item service instance."""
    repository = ItemRepository(db)
    sku_generator = SKUGenerator(db)
    return ItemService(repository, sku_generator)


async def get_item_rental_blocking_service(
    db: AsyncSession = Depends(get_db),
    item_repository: ItemRepository = Depends(get_item_repository)
) -> ItemRentalBlockingService:
    """Get item rental blocking service instance."""
    return ItemRentalBlockingService(db, item_repository)