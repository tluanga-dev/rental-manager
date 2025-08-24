"""Simplified Service layer for Unit of Measurement business logic."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.unit_of_measurement import UnitOfMeasurementRepository
from app.schemas.unit_of_measurement import (
    UnitOfMeasurementCreate, UnitOfMeasurementUpdate, UnitOfMeasurementResponse,
    UnitOfMeasurementSummary, UnitOfMeasurementList, UnitOfMeasurementFilter,
    UnitOfMeasurementSort, UnitOfMeasurementStats, UnitOfMeasurementBulkOperation,
    UnitOfMeasurementBulkResult, UnitOfMeasurementExport, UnitOfMeasurementImport,
    UnitOfMeasurementImportResult
)
from app.core.errors import NotFoundError, ConflictError, ValidationError, BusinessRuleError


class UnitOfMeasurementService:
    """Service layer for unit of measurement business logic."""
    
    async def create_unit(
        self,
        db: AsyncSession,
        *,
        unit_data: UnitOfMeasurementCreate,
        created_by: Optional[str] = None
    ) -> UnitOfMeasurementResponse:
        """Create a new unit of measurement."""
        repo = UnitOfMeasurementRepository(db)
        
        # Check if unit name already exists
        if await repo.exists_by_name(name=unit_data.name):
            raise ConflictError(f"Unit with name '{unit_data.name}' already exists")
        
        # Check if unit code already exists
        if unit_data.code and await repo.exists_by_code(code=unit_data.code):
            raise ConflictError(f"Unit with code '{unit_data.code}' already exists")
        
        # Create unit
        db_unit = await repo.create(obj_in=unit_data)
        
        # Set audit fields
        if created_by:
            db_unit.created_by = created_by
            db_unit.updated_by = created_by
            await db.commit()
            await db.refresh(db_unit)
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def get_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID
    ) -> UnitOfMeasurementResponse:
        """Get unit of measurement by ID."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_id(unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def get_unit_by_name(
        self,
        db: AsyncSession,
        *,
        name: str
    ) -> UnitOfMeasurementResponse:
        """Get unit by name."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_name(name)
        if not db_unit:
            raise NotFoundError(f"Unit with name '{name}' not found")
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def get_unit_by_code(
        self,
        db: AsyncSession,
        *,
        code: str
    ) -> UnitOfMeasurementResponse:
        """Get unit by code."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_code(code)
        if not db_unit:
            raise NotFoundError(f"Unit with code '{code}' not found")
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def update_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID,
        unit_data: UnitOfMeasurementUpdate,
        updated_by: Optional[str] = None
    ) -> UnitOfMeasurementResponse:
        """Update an existing unit of measurement."""
        repo = UnitOfMeasurementRepository(db)
        
        # Get existing unit
        db_unit = await repo.get_by_id(unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        # Check name uniqueness if provided
        if unit_data.name is not None and unit_data.name != db_unit.name:
            if await repo.exists_by_name(name=unit_data.name, exclude_id=unit_id):
                raise ConflictError(f"Unit with name '{unit_data.name}' already exists")
        
        # Check code uniqueness if provided
        if unit_data.code is not None and unit_data.code != db_unit.code:
            if unit_data.code and await repo.exists_by_code(code=unit_data.code, exclude_id=unit_id):
                raise ConflictError(f"Unit with code '{unit_data.code}' already exists")
        
        # Update unit
        db_unit = await repo.update(db_obj=db_unit, obj_in=unit_data)
        
        # Set audit fields
        if updated_by:
            db_unit.updated_by = updated_by
            await db.commit()
            await db.refresh(db_unit)
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def delete_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID
    ) -> bool:
        """Soft delete a unit of measurement."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_id(unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        # Check if unit can be deleted
        if not db_unit.can_delete():
            raise BusinessRuleError("Cannot delete unit with associated items")
        
        # Soft delete by setting is_active to False
        db_unit.is_active = False
        await db.commit()
        
        return True
    
    async def list_units(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[UnitOfMeasurementFilter] = None,
        sort: Optional[UnitOfMeasurementSort] = None,
        include_inactive: bool = False
    ) -> UnitOfMeasurementList:
        """List units with pagination and filtering."""
        repo = UnitOfMeasurementRepository(db)
        
        # Convert filters to dict
        filter_dict = {}
        if filters:
            filter_data = filters.model_dump(exclude_none=True)
            for key, value in filter_data.items():
                if value is not None:
                    filter_dict[key] = value
        
        # Set sort options
        sort_by = sort.field if sort else "name"
        sort_order = sort.direction if sort else "asc"
        
        # Get total count
        total_count = await repo.count_with_filters(
            filters=filter_dict,
            include_inactive=include_inactive
        )
        
        # Calculate pagination
        skip = (page - 1) * page_size
        
        # Get paginated units
        db_units = await repo.get_multi_with_filters(
            skip=skip,
            limit=page_size,
            filters=filter_dict,
            sort_by=sort_by,
            sort_order=sort_order,
            include_inactive=include_inactive
        )
        
        # Convert to summaries
        unit_summaries = [
            UnitOfMeasurementSummary.model_validate(unit)
            for unit in db_units
        ]
        
        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
        
        return UnitOfMeasurementList(
            items=unit_summaries,
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    
    async def search_units(
        self,
        db: AsyncSession,
        *,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[UnitOfMeasurementSummary]:
        """Search units by name, code, or description."""
        repo = UnitOfMeasurementRepository(db)
        db_units = await repo.search(
            search_term=search_term,
            limit=limit,
            include_inactive=include_inactive
        )
        
        return [
            UnitOfMeasurementSummary.model_validate(unit)
            for unit in db_units
        ]
    
    async def get_active_units(
        self,
        db: AsyncSession
    ) -> List[UnitOfMeasurementSummary]:
        """Get all active units."""
        repo = UnitOfMeasurementRepository(db)
        db_units = await repo.get_active_units()
        return [
            UnitOfMeasurementSummary.model_validate(unit)
            for unit in db_units
        ]
    
    async def get_unit_statistics(
        self,
        db: AsyncSession
    ) -> UnitOfMeasurementStats:
        """Get unit statistics."""
        repo = UnitOfMeasurementRepository(db)
        stats = await repo.get_statistics()
        most_used = await repo.get_most_used_units()
        
        return UnitOfMeasurementStats(
            total_units=stats["total_units"],
            active_units=stats["active_units"],
            inactive_units=stats["inactive_units"],
            units_with_items=stats["units_with_items"],
            units_without_items=stats["units_without_items"],
            most_used_units=most_used
        )
    
    async def activate_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID
    ) -> UnitOfMeasurementResponse:
        """Activate a unit."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_id(unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        if db_unit.is_active:
            return UnitOfMeasurementResponse.model_validate(db_unit)
        
        db_unit.is_active = True
        await db.commit()
        await db.refresh(db_unit)
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def deactivate_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID
    ) -> UnitOfMeasurementResponse:
        """Deactivate a unit."""
        repo = UnitOfMeasurementRepository(db)
        db_unit = await repo.get_by_id(unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        if not db_unit.is_active:
            return UnitOfMeasurementResponse.model_validate(db_unit)
        
        db_unit.is_active = False
        await db.commit()
        await db.refresh(db_unit)
        
        return UnitOfMeasurementResponse.model_validate(db_unit)


# Create service instance
unit_of_measurement_service = UnitOfMeasurementService()