"""CRUD operations for Unit of Measurement."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.unit_of_measurement import UnitOfMeasurement


class UnitOfMeasurementRepository:
    """Repository for unit of measurement data access operations."""
    
    def __init__(self, session: AsyncSession):
        """Initialize repository with database session."""
        self.session = session
    
    async def create(self, unit_data: dict) -> UnitOfMeasurement:
        """Create a new unit of measurement."""
        unit = UnitOfMeasurement(**unit_data)
        self.session.add(unit)
        await self.session.commit()
        await self.session.refresh(unit)
        return unit
    
    async def get(self, *, id: UUID) -> Optional[UnitOfMeasurement]:
        """Get unit of measurement by ID."""
        query = select(UnitOfMeasurement).where(UnitOfMeasurement.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_name(
        self,
        db: AsyncSession,
        *,
        name: str
    ) -> Optional[UnitOfMeasurement]:
        """Get unit of measurement by name."""
        query = select(UnitOfMeasurement).where(UnitOfMeasurement.name == name)
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_code(
        self,
        db: AsyncSession,
        *,
        code: str
    ) -> Optional[UnitOfMeasurement]:
        """Get unit of measurement by code."""
        query = select(UnitOfMeasurement).where(
            func.upper(UnitOfMeasurement.code) == code.upper()
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def update(self, *, db_obj: UnitOfMeasurement, obj_in: dict) -> UnitOfMeasurement:
        """Update existing unit of measurement."""
        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj
    
    async def get_multi_with_filters(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        include_inactive: bool = False
    ) -> List[UnitOfMeasurement]:
        """Get multiple units with filters and sorting."""
        query = select(UnitOfMeasurement)
        
        # Apply base filters
        if not include_inactive:
            query = query.where(UnitOfMeasurement.is_active == True)
        
        # Apply additional filters
        if filters:
            query = self._apply_filters(query, filters)
        
        # Apply sorting
        if sort_order.lower() == "desc":
            query = query.order_by(desc(getattr(UnitOfMeasurement, sort_by)))
        else:
            query = query.order_by(asc(getattr(UnitOfMeasurement, sort_by)))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def count_with_filters(
        self,
        db: AsyncSession,
        *,
        filters: Optional[Dict[str, Any]] = None,
        include_inactive: bool = False
    ) -> int:
        """Count units matching filters."""
        query = select(func.count()).select_from(UnitOfMeasurement)
        
        # Apply base filters
        if not include_inactive:
            query = query.where(UnitOfMeasurement.is_active == True)
        
        # Apply additional filters
        if filters:
            query = self._apply_filters(query, filters)
        
        result = await db.execute(query)
        return result.scalar_one()
    
    async def exists_by_name(
        self,
        db: AsyncSession,
        *,
        name: str,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if a unit with the given name exists."""
        query = select(func.count()).select_from(UnitOfMeasurement).where(
            UnitOfMeasurement.name == name
        )
        
        if exclude_id:
            query = query.where(UnitOfMeasurement.id != exclude_id)
        
        result = await db.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def exists_by_code(
        self,
        db: AsyncSession,
        *,
        code: str,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if a unit with the given code exists."""
        query = select(func.count()).select_from(UnitOfMeasurement).where(
            func.upper(UnitOfMeasurement.code) == code.upper()
        )
        
        if exclude_id:
            query = query.where(UnitOfMeasurement.id != exclude_id)
        
        result = await db.execute(query)
        count = result.scalar_one()
        
        return count > 0
    
    async def search(
        self,
        db: AsyncSession,
        *,
        search_term: str,
        limit: int = 10,
        include_inactive: bool = False
    ) -> List[UnitOfMeasurement]:
        """Search units by name, code, or description."""
        search_pattern = f"%{search_term}%"
        
        query = select(UnitOfMeasurement).where(
            or_(
                UnitOfMeasurement.name.ilike(search_pattern),
                UnitOfMeasurement.code.ilike(search_pattern),
                UnitOfMeasurement.description.ilike(search_pattern)
            )
        )
        
        if not include_inactive:
            query = query.where(UnitOfMeasurement.is_active == True)
        
        query = query.order_by(UnitOfMeasurement.name).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_active_units(
        self,
        db: AsyncSession
    ) -> List[UnitOfMeasurement]:
        """Get all active units."""
        query = select(UnitOfMeasurement).where(
            UnitOfMeasurement.is_active == True
        ).order_by(UnitOfMeasurement.name)
        result = await db.execute(query)
        return result.scalars().all()
    
    async def bulk_activate(
        self,
        db: AsyncSession,
        *,
        unit_ids: List[UUID]
    ) -> int:
        """Activate multiple units."""
        query = select(UnitOfMeasurement).where(
            UnitOfMeasurement.id.in_(unit_ids)
        )
        result = await db.execute(query)
        units = result.scalars().all()
        
        count = 0
        for unit in units:
            if not unit.is_active:
                unit.is_active = True
                count += 1
        
        await db.commit()
        return count
    
    async def bulk_deactivate(
        self,
        db: AsyncSession,
        *,
        unit_ids: List[UUID]
    ) -> int:
        """Deactivate multiple units."""
        query = select(UnitOfMeasurement).where(
            UnitOfMeasurement.id.in_(unit_ids)
        )
        result = await db.execute(query)
        units = result.scalars().all()
        
        count = 0
        for unit in units:
            if unit.is_active:
                unit.is_active = False
                count += 1
        
        await db.commit()
        return count
    
    async def get_statistics(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Get unit statistics."""
        # Count all units
        total_query = select(func.count()).select_from(UnitOfMeasurement)
        total_result = await db.execute(total_query)
        total_units = total_result.scalar_one()
        
        # Count active units
        active_query = select(func.count()).select_from(UnitOfMeasurement).where(
            UnitOfMeasurement.is_active == True
        )
        active_result = await db.execute(active_query)
        active_units = active_result.scalar_one()
        
        # Count units with items (when items relationship is available)
        units_with_items = 0  # Temporary until items relationship is available
        
        return {
            "total_units": total_units,
            "active_units": active_units,
            "inactive_units": total_units - active_units,
            "units_with_items": units_with_items,
            "units_without_items": total_units - units_with_items
        }
    
    async def get_most_used_units(
        self,
        db: AsyncSession,
        *,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get units with most items."""
        # Will be implemented when items relationship is fully available
        # For now, return empty list
        return []
    
    def _apply_filters(self, query, filters: Dict[str, Any]):
        """Apply filters to query."""
        for key, value in filters.items():
            if value is None:
                continue
            
            if key == "name":
                query = query.where(UnitOfMeasurement.name.ilike(f"%{value}%"))
            elif key == "code":
                query = query.where(UnitOfMeasurement.code.ilike(f"%{value}%"))
            elif key == "description":
                query = query.where(UnitOfMeasurement.description.ilike(f"%{value}%"))
            elif key == "is_active":
                query = query.where(UnitOfMeasurement.is_active == value)
            elif key == "search":
                search_pattern = f"%{value}%"
                query = query.where(
                    or_(
                        UnitOfMeasurement.name.ilike(search_pattern),
                        UnitOfMeasurement.code.ilike(search_pattern),
                        UnitOfMeasurement.description.ilike(search_pattern)
                    )
                )
            elif key == "created_after":
                query = query.where(UnitOfMeasurement.created_at >= value)
            elif key == "created_before":
                query = query.where(UnitOfMeasurement.created_at <= value)
            elif key == "updated_after":
                query = query.where(UnitOfMeasurement.updated_at >= value)
            elif key == "updated_before":
                query = query.where(UnitOfMeasurement.updated_at <= value)
            elif key == "created_by":
                query = query.where(UnitOfMeasurement.created_by == value)
            elif key == "updated_by":
                query = query.where(UnitOfMeasurement.updated_by == value)
        
        return query


# Create repository function
def get_unit_of_measurement_repository(session: AsyncSession) -> UnitOfMeasurementRepository:
    return UnitOfMeasurementRepository(session)