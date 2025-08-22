"""Service layer for Unit of Measurement business logic."""

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
        """Create a new unit of measurement.
        
        Args:
            db: Database session
            unit_data: Unit creation data
            created_by: User creating the unit
            
        Returns:
            Created unit response
            
        Raises:
            ConflictError: If unit name or code already exists
            ValidationError: If unit data is invalid
        """
        # Check if unit name already exists
        if await crud_uom.exists_by_name(db, name=unit_data.name):
            raise ConflictError(f"Unit with name '{unit_data.name}' already exists")
        
        # Check if unit code already exists
        if unit_data.code and await crud_uom.exists_by_code(db, code=unit_data.code):
            raise ConflictError(f"Unit with code '{unit_data.code}' already exists")
        
        # Create unit
        db_unit = await crud_uom.create(db, obj_in=unit_data)
        
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
        """Get unit of measurement by ID.
        
        Args:
            db: Database session
            unit_id: Unit UUID
            
        Returns:
            Unit response
            
        Raises:
            NotFoundError: If unit not found
        """
        db_unit = await crud_uom.get(db, id=unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def get_unit_by_name(
        self,
        db: AsyncSession,
        *,
        name: str
    ) -> UnitOfMeasurementResponse:
        """Get unit by name.
        
        Args:
            db: Database session
            name: Unit name
            
        Returns:
            Unit response
            
        Raises:
            NotFoundError: If unit not found
        """
        db_unit = await crud_uom.get_by_name(db, name=name)
        if not db_unit:
            raise NotFoundError(f"Unit with name '{name}' not found")
        
        return UnitOfMeasurementResponse.model_validate(db_unit)
    
    async def get_unit_by_code(
        self,
        db: AsyncSession,
        *,
        code: str
    ) -> UnitOfMeasurementResponse:
        """Get unit by code.
        
        Args:
            db: Database session
            code: Unit code
            
        Returns:
            Unit response
            
        Raises:
            NotFoundError: If unit not found
        """
        db_unit = await crud_uom.get_by_code(db, code=code)
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
        """Update an existing unit of measurement.
        
        Args:
            db: Database session
            unit_id: Unit UUID
            unit_data: Unit update data
            updated_by: User updating the unit
            
        Returns:
            Updated unit response
            
        Raises:
            NotFoundError: If unit not found
            ConflictError: If name or code already exists
            ValidationError: If update data is invalid
        """
        # Get existing unit
        db_unit = await crud_uom.get(db, id=unit_id)
        if not db_unit:
            raise NotFoundError(f"Unit with id {unit_id} not found")
        
        # Check name uniqueness if provided
        if unit_data.name is not None and unit_data.name != db_unit.name:
            if await crud_uom.exists_by_name(db, name=unit_data.name, exclude_id=unit_id):
                raise ConflictError(f"Unit with name '{unit_data.name}' already exists")
        
        # Check code uniqueness if provided
        if unit_data.code is not None and unit_data.code != db_unit.code:
            if unit_data.code and await crud_uom.exists_by_code(db, code=unit_data.code, exclude_id=unit_id):
                raise ConflictError(f"Unit with code '{unit_data.code}' already exists")
        
        # Update unit
        db_unit = await crud_uom.update(db, db_obj=db_unit, obj_in=unit_data)
        
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
        """Soft delete a unit of measurement.
        
        Args:
            db: Database session
            unit_id: Unit UUID
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If unit not found
            BusinessRuleError: If unit has associated items
        """
        db_unit = await crud_uom.get(db, id=unit_id)
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
        """List units with pagination and filtering.
        
        Args:
            db: Database session
            page: Page number (1-based)
            page_size: Items per page
            filters: Filter criteria
            sort: Sort options
            include_inactive: Include inactive units
            
        Returns:
            Paginated unit list
        """
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
        total_count = await crud_uom.count_with_filters(
            db,
            filters=filter_dict,
            include_inactive=include_inactive
        )
        
        # Calculate pagination
        skip = (page - 1) * page_size
        
        # Get paginated units
        db_units = await crud_uom.get_multi_with_filters(
            db,
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
        """Search units by name, code, or description.
        
        Args:
            db: Database session
            search_term: Search term
            limit: Maximum results
            include_inactive: Include inactive units
            
        Returns:
            List of unit summaries
        """
        db_units = await crud_uom.search(
            db,
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
        """Get all active units.
        
        Returns:
            List of active unit summaries
        """
        db_units = await crud_uom.get_active_units(db)
        return [
            UnitOfMeasurementSummary.model_validate(unit)
            for unit in db_units
        ]
    
    async def get_unit_statistics(
        self,
        db: AsyncSession
    ) -> UnitOfMeasurementStats:
        """Get unit statistics.
        
        Returns:
            Unit statistics
        """
        stats = await crud_uom.get_statistics(db)
        most_used = await crud_uom.get_most_used_units(db)
        
        return UnitOfMeasurementStats(
            total_units=stats["total_units"],
            active_units=stats["active_units"],
            inactive_units=stats["inactive_units"],
            units_with_items=stats["units_with_items"],
            units_without_items=stats["units_without_items"],
            most_used_units=most_used
        )
    
    async def bulk_operation(
        self,
        db: AsyncSession,
        *,
        operation: UnitOfMeasurementBulkOperation,
        updated_by: Optional[str] = None
    ) -> UnitOfMeasurementBulkResult:
        """Perform bulk operations on units.
        
        Args:
            db: Database session
            operation: Bulk operation data
            updated_by: User performing the operation
            
        Returns:
            Bulk operation result
        """
        success_count = 0
        errors = []
        
        try:
            if operation.operation == "activate":
                success_count = await crud_uom.bulk_activate(db, unit_ids=operation.unit_ids)
            elif operation.operation == "deactivate":
                success_count = await crud_uom.bulk_deactivate(db, unit_ids=operation.unit_ids)
        except Exception as e:
            for unit_id in operation.unit_ids:
                errors.append({
                    "unit_id": str(unit_id),
                    "error": str(e)
                })
        
        return UnitOfMeasurementBulkResult(
            success_count=success_count,
            failure_count=len(errors),
            errors=errors
        )
    
    async def export_units(
        self,
        db: AsyncSession,
        *,
        include_inactive: bool = False
    ) -> List[UnitOfMeasurementExport]:
        """Export units data.
        
        Args:
            db: Database session
            include_inactive: Include inactive units
            
        Returns:
            List of unit export data
        """
        db_units = await crud_uom.get_multi_with_filters(
            db,
            skip=0,
            limit=10000,  # Large limit for export
            include_inactive=include_inactive
        )
        
        return [
            UnitOfMeasurementExport.model_validate(unit)
            for unit in db_units
        ]
    
    async def import_units(
        self,
        db: AsyncSession,
        *,
        import_data: List[UnitOfMeasurementImport],
        created_by: Optional[str] = None
    ) -> UnitOfMeasurementImportResult:
        """Import units data.
        
        Args:
            db: Database session
            import_data: List of unit import data
            created_by: User importing the data
            
        Returns:
            Import operation result
        """
        total_processed = len(import_data)
        successful_imports = 0
        failed_imports = 0
        skipped_imports = 0
        errors = []
        
        for row, unit_data in enumerate(import_data, 1):
            try:
                # Check if unit already exists
                if await crud_uom.exists_by_name(db, name=unit_data.name):
                    skipped_imports += 1
                    continue
                
                if unit_data.code and await crud_uom.exists_by_code(db, code=unit_data.code):
                    skipped_imports += 1
                    continue
                
                # Create unit
                create_data = UnitOfMeasurementCreate(**unit_data.model_dump())
                db_unit = await crud_uom.create(db, obj_in=create_data)
                
                if created_by:
                    db_unit.created_by = created_by
                    db_unit.updated_by = created_by
                
                successful_imports += 1
                
            except Exception as e:
                failed_imports += 1
                errors.append({
                    "row": row,
                    "error": str(e)
                })
        
        await db.commit()
        
        return UnitOfMeasurementImportResult(
            total_processed=total_processed,
            successful_imports=successful_imports,
            failed_imports=failed_imports,
            skipped_imports=skipped_imports,
            errors=errors
        )
    
    async def activate_unit(
        self,
        db: AsyncSession,
        *,
        unit_id: UUID
    ) -> UnitOfMeasurementResponse:
        """Activate a unit.
        
        Args:
            db: Database session
            unit_id: Unit UUID
            
        Returns:
            Updated unit response
        """
        db_unit = await crud_uom.get(db, id=unit_id)
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
        """Deactivate a unit.
        
        Args:
            db: Database session
            unit_id: Unit UUID
            
        Returns:
            Updated unit response
        """
        db_unit = await crud_uom.get(db, id=unit_id)
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