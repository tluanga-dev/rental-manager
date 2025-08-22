"""
CRUD operations for Location model.

This module provides database operations for locations including:
- Create, Read, Update, Delete operations
- Advanced search and filtering
- Hierarchical location queries
- Geospatial queries
- Bulk operations
- Statistics and aggregations
"""

from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.sql import text
import math

from app.models.location import Location, LocationType
from app.schemas.location import (
    LocationCreate, LocationUpdate, LocationSearch,
    LocationNearby, LocationCapacityUpdate
)


class LocationCRUD:
    """CRUD operations for Location model."""
    
    def __init__(self, db: AsyncSession):
        """Initialize with database session."""
        self.db = db
    
    # ==================== Basic CRUD Operations ====================
    
    async def create(self, location_data: LocationCreate, created_by: Optional[UUID] = None) -> Location:
        """Create a new location."""
        # Check if location code already exists
        existing = await self.get_by_code(location_data.location_code)
        if existing:
            raise ValueError(f"Location with code '{location_data.location_code}' already exists")
        
        # If setting as default, unset other defaults
        if location_data.is_default:
            await self._unset_default_locations()
        
        # Create location instance
        location = Location(
            **location_data.model_dump(exclude_unset=True),
            created_by=created_by
        )
        
        self.db.add(location)
        await self.db.commit()
        await self.db.refresh(location)
        return location
    
    async def get(self, location_id: UUID) -> Optional[Location]:
        """Get location by ID."""
        query = select(Location).where(
            Location.id == location_id,
            Location.is_active == True
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_with_relations(self, location_id: UUID) -> Optional[Location]:
        """Get location with all relationships loaded."""
        query = (
            select(Location)
            .options(
                selectinload(Location.parent_location),
                selectinload(Location.child_locations),
                selectinload(Location.manager)
            )
            .where(
                Location.id == location_id,
                Location.is_active == True
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def update(
        self, 
        location_id: UUID, 
        location_data: LocationUpdate,
        updated_by: Optional[UUID] = None
    ) -> Optional[Location]:
        """Update location."""
        location = await self.get(location_id)
        if not location:
            return None
        
        update_data = location_data.model_dump(exclude_unset=True)
        
        # Handle default location update
        if update_data.get('is_default') is True:
            await self._unset_default_locations(exclude_id=location_id)
        
        # Update fields
        for field, value in update_data.items():
            setattr(location, field, value)
        
        location.updated_by = updated_by
        
        await self.db.commit()
        await self.db.refresh(location)
        return location
    
    async def delete(self, location_id: UUID, deleted_by: Optional[UUID] = None) -> bool:
        """Soft delete location."""
        location = await self.get(location_id)
        if not location:
            return False
        
        # Check if location has child locations
        if await self.has_children(location_id):
            raise ValueError("Cannot delete location with child locations")
        
        location.is_active = False
        location.is_default = False
        location.updated_by = deleted_by
        
        await self.db.commit()
        return True
    
    async def hard_delete(self, location_id: UUID) -> bool:
        """Permanently delete location (use with caution)."""
        query = delete(Location).where(Location.id == location_id)
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount > 0
    
    # ==================== Query Operations ====================
    
    async def get_by_code(self, location_code: str) -> Optional[Location]:
        """Get location by code."""
        query = select(Location).where(
            Location.location_code == location_code.upper(),
            Location.is_active == True
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_default(self) -> Optional[Location]:
        """Get default location."""
        query = select(Location).where(
            Location.is_default == True,
            Location.is_active == True
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        location_type: Optional[LocationType] = None,
        is_active: bool = True,
        sort_by: str = "location_name",
        sort_order: str = "asc"
    ) -> List[Location]:
        """List locations with filtering and pagination."""
        query = select(Location)
        
        # Apply filters
        filters = []
        if is_active is not None:
            filters.append(Location.is_active == is_active)
        if location_type:
            filters.append(Location.location_type == location_type)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Apply sorting
        sort_column = getattr(Location, sort_by, Location.location_name)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def search(self, params: LocationSearch) -> Tuple[List[Location], int]:
        """Search locations with advanced filtering."""
        query = select(Location)
        count_query = select(func.count(Location.id))
        
        filters = []
        
        # Text search
        if params.search_term:
            search_filters = [
                Location.location_code.ilike(f"%{params.search_term}%"),
                Location.location_name.ilike(f"%{params.search_term}%"),
                Location.address.ilike(f"%{params.search_term}%"),
                Location.city.ilike(f"%{params.search_term}%"),
                Location.state.ilike(f"%{params.search_term}%"),
                Location.country.ilike(f"%{params.search_term}%")
            ]
            filters.append(or_(*search_filters))
        
        # Type filter
        if params.location_type:
            filters.append(Location.location_type == params.location_type)
        
        # Geographic filters
        if params.city:
            filters.append(Location.city.ilike(f"%{params.city}%"))
        if params.state:
            filters.append(Location.state.ilike(f"%{params.state}%"))
        if params.country:
            filters.append(Location.country.ilike(f"%{params.country}%"))
        
        # Status filters
        if params.is_active is not None:
            filters.append(Location.is_active == params.is_active)
        if params.is_default is not None:
            filters.append(Location.is_default == params.is_default)
        
        # Coordinate filter
        if params.has_coordinates is not None:
            if params.has_coordinates:
                filters.append(and_(
                    Location.latitude.isnot(None),
                    Location.longitude.isnot(None)
                ))
            else:
                filters.append(or_(
                    Location.latitude.is_(None),
                    Location.longitude.is_(None)
                ))
        
        # Hierarchy filter
        if params.parent_location_id:
            filters.append(Location.parent_location_id == params.parent_location_id)
        
        # Apply filters
        if filters:
            query = query.where(and_(*filters))
            count_query = count_query.where(and_(*filters))
        
        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Apply sorting
        sort_column = getattr(Location, params.sort_by, Location.location_name)
        if params.sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column)
        
        # Apply pagination
        query = query.offset(params.skip).limit(params.limit)
        
        result = await self.db.execute(query)
        locations = result.scalars().all()
        
        return locations, total
    
    # ==================== Hierarchical Operations ====================
    
    async def get_children(
        self, 
        parent_id: UUID, 
        include_inactive: bool = False
    ) -> List[Location]:
        """Get child locations of a parent."""
        query = select(Location).where(Location.parent_location_id == parent_id)
        
        if not include_inactive:
            query = query.where(Location.is_active == True)
        
        query = query.order_by(Location.location_name)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_all_descendants(
        self, 
        parent_id: UUID, 
        include_inactive: bool = False
    ) -> List[Location]:
        """Get all descendants of a location recursively."""
        # Use recursive CTE for efficient hierarchical query
        cte_query = text("""
            WITH RECURSIVE location_tree AS (
                SELECT * FROM locations 
                WHERE id = :parent_id
                UNION ALL
                SELECT l.* FROM locations l
                INNER JOIN location_tree lt ON l.parent_location_id = lt.id
            )
            SELECT * FROM location_tree
            WHERE id != :parent_id
        """)
        
        if not include_inactive:
            cte_query = text("""
                WITH RECURSIVE location_tree AS (
                    SELECT * FROM locations 
                    WHERE id = :parent_id AND is_active = true
                    UNION ALL
                    SELECT l.* FROM locations l
                    INNER JOIN location_tree lt ON l.parent_location_id = lt.id
                    WHERE l.is_active = true
                )
                SELECT * FROM location_tree
                WHERE id != :parent_id
            """)
        
        result = await self.db.execute(cte_query, {"parent_id": parent_id})
        return result.fetchall()
    
    async def get_ancestors(self, location_id: UUID) -> List[Location]:
        """Get all ancestors of a location."""
        ancestors = []
        current = await self.get(location_id)
        
        while current and current.parent_location_id:
            parent = await self.get(current.parent_location_id)
            if parent:
                ancestors.append(parent)
                current = parent
            else:
                break
        
        return ancestors
    
    async def has_children(self, location_id: UUID) -> bool:
        """Check if location has child locations."""
        query = select(func.count(Location.id)).where(
            Location.parent_location_id == location_id,
            Location.is_active == True
        )
        result = await self.db.execute(query)
        count = result.scalar()
        return count > 0
    
    # ==================== Geospatial Operations ====================
    
    async def find_nearby(self, params: LocationNearby) -> List[Tuple[Location, float]]:
        """Find locations within a radius using Haversine formula."""
        # Haversine formula in SQL
        distance_query = text("""
            SELECT *, 
            (6371 * acos(
                cos(radians(:lat)) * cos(radians(latitude)) * 
                cos(radians(longitude) - radians(:lng)) + 
                sin(radians(:lat)) * sin(radians(latitude))
            )) AS distance
            FROM locations
            WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND is_active = true
            AND (6371 * acos(
                cos(radians(:lat)) * cos(radians(latitude)) * 
                cos(radians(longitude) - radians(:lng)) + 
                sin(radians(:lat)) * sin(radians(latitude))
            )) <= :radius
        """)
        
        # Add type filter if specified
        if params.location_type:
            distance_query = text("""
                SELECT *, 
                (6371 * acos(
                    cos(radians(:lat)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(:lng)) + 
                    sin(radians(:lat)) * sin(radians(latitude))
                )) AS distance
                FROM locations
                WHERE latitude IS NOT NULL 
                AND longitude IS NOT NULL
                AND is_active = true
                AND location_type = :location_type
                AND (6371 * acos(
                    cos(radians(:lat)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(:lng)) + 
                    sin(radians(:lat)) * sin(radians(latitude))
                )) <= :radius
                ORDER BY distance
                LIMIT :limit
            """)
            
            result = await self.db.execute(
                distance_query,
                {
                    "lat": float(params.latitude),
                    "lng": float(params.longitude),
                    "radius": params.radius_km,
                    "location_type": params.location_type,
                    "limit": params.limit
                }
            )
        else:
            distance_query = text("""
                SELECT *, 
                (6371 * acos(
                    cos(radians(:lat)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(:lng)) + 
                    sin(radians(:lat)) * sin(radians(latitude))
                )) AS distance
                FROM locations
                WHERE latitude IS NOT NULL 
                AND longitude IS NOT NULL
                AND is_active = true
                AND (6371 * acos(
                    cos(radians(:lat)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(:lng)) + 
                    sin(radians(:lat)) * sin(radians(latitude))
                )) <= :radius
                ORDER BY distance
                LIMIT :limit
            """)
            
            result = await self.db.execute(
                distance_query,
                {
                    "lat": float(params.latitude),
                    "lng": float(params.longitude),
                    "radius": params.radius_km,
                    "limit": params.limit
                }
            )
        
        return result.fetchall()
    
    async def calculate_distance(
        self, 
        location1_id: UUID, 
        location2_id: UUID
    ) -> Optional[float]:
        """Calculate distance between two locations in kilometers."""
        loc1 = await self.get(location1_id)
        loc2 = await self.get(location2_id)
        
        if not (loc1 and loc2 and loc1.latitude and loc1.longitude and 
                loc2.latitude and loc2.longitude):
            return None
        
        # Haversine formula
        R = 6371  # Earth's radius in kilometers
        
        lat1 = math.radians(float(loc1.latitude))
        lat2 = math.radians(float(loc2.latitude))
        dlat = lat2 - lat1
        dlon = math.radians(float(loc2.longitude) - float(loc1.longitude))
        
        a = (math.sin(dlat/2) ** 2 + 
             math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    # ==================== Bulk Operations ====================
    
    async def bulk_create(
        self, 
        locations: List[LocationCreate], 
        created_by: Optional[UUID] = None,
        skip_duplicates: bool = True
    ) -> List[Location]:
        """Bulk create locations."""
        created_locations = []
        
        for location_data in locations:
            # Check for duplicate code
            if skip_duplicates:
                existing = await self.get_by_code(location_data.location_code)
                if existing:
                    continue
            
            location = Location(
                **location_data.model_dump(exclude_unset=True),
                created_by=created_by
            )
            self.db.add(location)
            created_locations.append(location)
        
        if created_locations:
            await self.db.commit()
            for location in created_locations:
                await self.db.refresh(location)
        
        return created_locations
    
    async def bulk_update(
        self, 
        location_ids: List[UUID], 
        update_data: Dict[str, Any],
        updated_by: Optional[UUID] = None
    ) -> int:
        """Bulk update locations."""
        update_data['updated_by'] = updated_by
        
        query = (
            update(Location)
            .where(Location.id.in_(location_ids))
            .values(**update_data)
        )
        
        result = await self.db.execute(query)
        await self.db.commit()
        return result.rowcount
    
    async def bulk_delete(
        self, 
        location_ids: List[UUID], 
        deleted_by: Optional[UUID] = None,
        hard_delete: bool = False
    ) -> int:
        """Bulk delete locations."""
        if hard_delete:
            query = delete(Location).where(Location.id.in_(location_ids))
            result = await self.db.execute(query)
        else:
            query = (
                update(Location)
                .where(Location.id.in_(location_ids))
                .values(
                    is_active=False,
                    is_default=False,
                    updated_by=deleted_by
                )
            )
            result = await self.db.execute(query)
        
        await self.db.commit()
        return result.rowcount
    
    # ==================== Capacity Operations ====================
    
    async def update_capacity(
        self, 
        location_id: UUID, 
        capacity_data: LocationCapacityUpdate,
        updated_by: Optional[UUID] = None
    ) -> Optional[Location]:
        """Update location capacity."""
        location = await self.get(location_id)
        if not location:
            return None
        
        location.capacity = capacity_data.capacity
        location.updated_by = updated_by
        
        # Add to metadata if notes provided
        if capacity_data.notes:
            if not location.metadata:
                location.metadata = {}
            location.metadata['capacity_notes'] = capacity_data.notes
        
        await self.db.commit()
        await self.db.refresh(location)
        return location
    
    async def get_total_capacity(
        self, 
        location_type: Optional[LocationType] = None
    ) -> int:
        """Get total capacity across locations."""
        query = select(func.sum(Location.capacity)).where(
            Location.is_active == True,
            Location.capacity.isnot(None)
        )
        
        if location_type:
            query = query.where(Location.location_type == location_type)
        
        result = await self.db.execute(query)
        total = result.scalar()
        return total or 0
    
    # ==================== Statistics Operations ====================
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get location statistics."""
        # Total and active counts
        total_query = select(func.count(Location.id))
        total_result = await self.db.execute(total_query)
        total_count = total_result.scalar()
        
        active_query = select(func.count(Location.id)).where(Location.is_active == True)
        active_result = await self.db.execute(active_query)
        active_count = active_result.scalar()
        
        # Count by type
        type_query = (
            select(Location.location_type, func.count(Location.id))
            .where(Location.is_active == True)
            .group_by(Location.location_type)
        )
        type_result = await self.db.execute(type_query)
        type_counts = dict(type_result.fetchall())
        
        # Count by country
        country_query = (
            select(Location.country, func.count(Location.id))
            .where(
                Location.is_active == True,
                Location.country.isnot(None)
            )
            .group_by(Location.country)
            .order_by(func.count(Location.id).desc())
            .limit(10)
        )
        country_result = await self.db.execute(country_query)
        country_counts = dict(country_result.fetchall())
        
        # Count by state
        state_query = (
            select(Location.state, func.count(Location.id))
            .where(
                Location.is_active == True,
                Location.state.isnot(None)
            )
            .group_by(Location.state)
            .order_by(func.count(Location.id).desc())
            .limit(10)
        )
        state_result = await self.db.execute(state_query)
        state_counts = dict(state_result.fetchall())
        
        # Default location
        default_location = await self.get_default()
        
        # Capacity statistics
        capacity_query = select(
            func.sum(Location.capacity),
            func.avg(Location.capacity),
            func.min(Location.capacity),
            func.max(Location.capacity)
        ).where(
            Location.is_active == True,
            Location.capacity.isnot(None)
        )
        capacity_result = await self.db.execute(capacity_query)
        capacity_stats = capacity_result.first()
        
        # Locations with coordinates
        coords_query = select(func.count(Location.id)).where(
            Location.is_active == True,
            Location.latitude.isnot(None),
            Location.longitude.isnot(None)
        )
        coords_result = await self.db.execute(coords_query)
        coords_count = coords_result.scalar()
        
        return {
            "total_locations": total_count,
            "active_locations": active_count,
            "inactive_locations": total_count - active_count,
            "locations_by_type": type_counts,
            "locations_by_country": country_counts,
            "locations_by_state": state_counts,
            "default_location_id": default_location.id if default_location else None,
            "capacity_stats": {
                "total": capacity_stats[0] if capacity_stats else 0,
                "average": float(capacity_stats[1]) if capacity_stats and capacity_stats[1] else 0,
                "min": capacity_stats[2] if capacity_stats else 0,
                "max": capacity_stats[3] if capacity_stats else 0
            },
            "locations_with_coordinates": coords_count
        }
    
    # ==================== Private Helper Methods ====================
    
    async def _unset_default_locations(self, exclude_id: Optional[UUID] = None):
        """Unset all default locations except the specified one."""
        query = update(Location).where(Location.is_default == True)
        
        if exclude_id:
            query = query.where(Location.id != exclude_id)
        
        query = query.values(is_default=False)
        await self.db.execute(query)