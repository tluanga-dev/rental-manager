"""
Location service layer for business logic and caching.

This module provides the location service with:
- Business logic separation from CRUD
- Redis caching for performance
- Audit trail implementation
- Business rules validation
- Advanced operations like geospatial queries and bulk operations
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
import json
import logging
from datetime import datetime, timedelta

from app.crud.location import LocationCRUD
from app.models.location import Location, LocationType
from app.schemas.location import (
    LocationCreate, LocationUpdate, LocationResponse, LocationSearch,
    LocationNearby, LocationCapacityUpdate, LocationStatistics,
    LocationBulkCreate, LocationBulkUpdate, LocationWithChildren
)
from app.core.errors import (
    NotFoundError, ConflictError, ValidationError,
    BusinessRuleError, DatabaseError
)
from app.core.redis import RedisManager
from app.core.database import AsyncSession

logger = logging.getLogger(__name__)


class LocationService:
    """Service layer for location business logic."""
    
    # Cache TTL settings (in seconds)
    CACHE_TTL_SHORT = 300      # 5 minutes for frequently changing data
    CACHE_TTL_MEDIUM = 1800    # 30 minutes for standard data
    CACHE_TTL_LONG = 3600      # 1 hour for static data
    
    # Rate limiting settings
    GEOSPATIAL_RATE_LIMIT = 100  # queries per minute
    BULK_OPERATION_RATE_LIMIT = 10  # operations per minute
    
    def __init__(self, db: AsyncSession, redis: Optional[RedisManager] = None):
        """Initialize service with database and Redis."""
        self.crud = LocationCRUD(db)
        self.redis = redis
        self.db = db
    
    # ==================== Core Business Operations ====================
    
    async def create_location(
        self,
        location_data: LocationCreate,
        created_by: Optional[UUID] = None
    ) -> LocationResponse:
        """
        Create a new location with business logic validation.
        
        Args:
            location_data: Location creation data
            created_by: User creating the location
            
        Returns:
            Created location response
            
        Raises:
            ConflictError: If location code already exists
            ValidationError: If location data is invalid
            BusinessRuleError: If business rules are violated
        """
        logger.info(f"Creating location with code: {location_data.location_code}")
        
        # Business rule: Check if location code already exists
        existing = await self.crud.get_by_code(location_data.location_code)
        if existing:
            raise ConflictError(
                f"Location with code '{location_data.location_code}' already exists",
                conflicting_field="location_code",
                conflicting_value=location_data.location_code
            )
        
        # Business rule: Validate parent location exists if specified
        if location_data.parent_location_id:
            parent = await self.crud.get(location_data.parent_location_id)
            if not parent:
                raise ValidationError(
                    f"Parent location {location_data.parent_location_id} not found",
                    field="parent_location_id"
                )
            
            # Business rule: Prevent circular hierarchy (max 5 levels)
            parent_level = await self._get_location_hierarchy_level(location_data.parent_location_id)
            if parent_level >= 4:  # Allow max 5 levels (0-4)
                raise BusinessRuleError(
                    "Maximum hierarchy depth (5 levels) would be exceeded",
                    rule_name="max_hierarchy_depth",
                    context={"current_level": parent_level, "max_level": 4}
                )
        
        # Business rule: Validate manager exists if specified
        if location_data.manager_user_id:
            await self._validate_manager_exists(location_data.manager_user_id)
        
        # Business rule: Validate coordinates are reasonable if provided
        if location_data.latitude and location_data.longitude:
            await self._validate_coordinates_reasonable(
                location_data.latitude, 
                location_data.longitude
            )
        
        # Create location
        try:
            location = await self.crud.create(location_data, created_by)
            
            # Invalidate related caches
            await self._invalidate_location_caches()
            
            # Log audit trail
            await self._log_audit_event(
                "location_created",
                {"location_id": str(location.id), "location_code": location.location_code},
                created_by
            )
            
            return LocationResponse.model_validate(location)
            
        except Exception as e:
            logger.error(f"Error creating location: {e}")
            raise DatabaseError(f"Failed to create location: {str(e)}", operation="create", table="locations")
    
    async def get_location(self, location_id: UUID, use_cache: bool = True) -> LocationResponse:
        """
        Get location by ID with caching.
        
        Args:
            location_id: Location UUID
            use_cache: Whether to use cache
            
        Returns:
            Location response
            
        Raises:
            NotFoundError: If location not found
        """
        cache_key = f"location:{location_id}"
        
        # Try cache first
        if use_cache and self.redis:
            cached = await self.redis.cache_get(cache_key)
            if cached:
                logger.debug(f"Cache hit for location {location_id}")
                return LocationResponse(**cached)
        
        # Get from database
        location = await self.crud.get_with_relations(location_id)
        if not location:
            raise NotFoundError(
                f"Location with id {location_id} not found",
                resource_type="location",
                resource_id=str(location_id)
            )
        
        response = LocationResponse.model_validate(location)
        
        # Cache the result
        if use_cache and self.redis:
            await self.redis.cache_set(
                cache_key,
                response.model_dump(),
                ttl=self.CACHE_TTL_MEDIUM
            )
        
        return response
    
    async def get_location_by_code(self, location_code: str, use_cache: bool = True) -> LocationResponse:
        """Get location by code with caching."""
        cache_key = f"location:code:{location_code.upper()}"
        
        if use_cache and self.redis:
            cached = await self.redis.cache_get(cache_key)
            if cached:
                return LocationResponse(**cached)
        
        location = await self.crud.get_by_code(location_code)
        if not location:
            raise NotFoundError(
                f"Location with code '{location_code}' not found",
                resource_type="location"
            )
        
        response = LocationResponse.model_validate(location)
        
        if use_cache and self.redis:
            await self.redis.cache_set(
                cache_key,
                response.model_dump(),
                ttl=self.CACHE_TTL_MEDIUM
            )
        
        return response
    
    async def update_location(
        self,
        location_id: UUID,
        location_data: LocationUpdate,
        updated_by: Optional[UUID] = None
    ) -> LocationResponse:
        """
        Update location with business logic validation.
        
        Args:
            location_id: Location UUID
            location_data: Update data
            updated_by: User updating the location
            
        Returns:
            Updated location response
        """
        logger.info(f"Updating location {location_id}")
        
        # Check if location exists
        existing = await self.crud.get(location_id)
        if not existing:
            raise NotFoundError(
                f"Location with id {location_id} not found",
                resource_type="location",
                resource_id=str(location_id)
            )
        
        # Business rule validations
        update_data = location_data.model_dump(exclude_unset=True)
        
        # Validate parent location if being updated
        if 'parent_location_id' in update_data and update_data['parent_location_id']:
            await self._validate_hierarchy_update(location_id, update_data['parent_location_id'])
        
        # Validate manager if being updated
        if 'manager_user_id' in update_data and update_data['manager_user_id']:
            await self._validate_manager_exists(update_data['manager_user_id'])
        
        # Validate coordinates if being updated
        if 'latitude' in update_data and 'longitude' in update_data:
            if update_data['latitude'] and update_data['longitude']:
                await self._validate_coordinates_reasonable(
                    update_data['latitude'],
                    update_data['longitude']
                )
        
        # Update location
        try:
            location = await self.crud.update(location_id, location_data, updated_by)
            
            # Invalidate caches
            await self._invalidate_location_cache(location_id)
            await self._invalidate_location_code_cache(existing.location_code)
            
            # Log audit trail
            await self._log_audit_event(
                "location_updated",
                {
                    "location_id": str(location_id),
                    "updated_fields": list(update_data.keys())
                },
                updated_by
            )
            
            return LocationResponse.model_validate(location)
            
        except Exception as e:
            logger.error(f"Error updating location {location_id}: {e}")
            raise DatabaseError(f"Failed to update location: {str(e)}", operation="update", table="locations")
    
    async def delete_location(
        self,
        location_id: UUID,
        deleted_by: Optional[UUID] = None,
        force: bool = False
    ) -> bool:
        """
        Soft delete location with business rules.
        
        Args:
            location_id: Location UUID
            deleted_by: User deleting the location
            force: Force delete even with children (will cascade)
            
        Returns:
            True if deleted successfully
        """
        logger.info(f"Deleting location {location_id}")
        
        location = await self.crud.get(location_id)
        if not location:
            raise NotFoundError(
                f"Location with id {location_id} not found",
                resource_type="location",
                resource_id=str(location_id)
            )
        
        # Business rule: Check for child locations
        if not force:
            has_children = await self.crud.has_children(location_id)
            if has_children:
                raise BusinessRuleError(
                    "Cannot delete location with child locations. Use force=True to cascade delete.",
                    rule_name="no_delete_with_children",
                    context={"location_id": str(location_id)}
                )
        
        # Business rule: Cannot delete default location
        if location.is_default:
            raise BusinessRuleError(
                "Cannot delete the default location. Set another location as default first.",
                rule_name="no_delete_default_location"
            )
        
        # If force delete, cascade to children
        if force:
            await self._cascade_delete_children(location_id, deleted_by)
        
        try:
            success = await self.crud.delete(location_id, deleted_by)
            
            if success:
                # Invalidate caches
                await self._invalidate_location_cache(location_id)
                await self._invalidate_location_code_cache(location.location_code)
                await self._invalidate_location_caches()
                
                # Log audit trail
                await self._log_audit_event(
                    "location_deleted",
                    {"location_id": str(location_id), "force": force},
                    deleted_by
                )
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting location {location_id}: {e}")
            raise DatabaseError(f"Failed to delete location: {str(e)}", operation="delete", table="locations")
    
    # ==================== Search and Query Operations ====================
    
    async def search_locations(
        self,
        params: LocationSearch,
        use_cache: bool = True
    ) -> Tuple[List[LocationResponse], int]:
        """
        Search locations with caching.
        
        Args:
            params: Search parameters
            use_cache: Whether to use cache
            
        Returns:
            Tuple of (locations, total_count)
        """
        cache_key = f"location:search:{hash(str(params.model_dump()))}"
        
        if use_cache and self.redis:
            cached = await self.redis.cache_get(cache_key)
            if cached:
                locations_data, total = cached['locations'], cached['total']
                locations = [LocationResponse(**loc) for loc in locations_data]
                return locations, total
        
        # Search in database
        locations, total = await self.crud.search(params)
        location_responses = [LocationResponse.model_validate(loc) for loc in locations]
        
        # Cache results (shorter TTL for search results)
        if use_cache and self.redis:
            cache_data = {
                'locations': [loc.model_dump() for loc in location_responses],
                'total': total
            }
            await self.redis.cache_set(cache_key, cache_data, ttl=self.CACHE_TTL_SHORT)
        
        return location_responses, total
    
    async def find_nearby_locations(
        self,
        params: LocationNearby,
        requester_id: Optional[UUID] = None
    ) -> List[Tuple[LocationResponse, float]]:
        """
        Find nearby locations with rate limiting.
        
        Args:
            params: Nearby search parameters
            requester_id: ID of the requester for rate limiting
            
        Returns:
            List of (location, distance) tuples
        """
        # Rate limiting for geospatial queries
        if requester_id and self.redis:
            rate_limit_key = f"geospatial:{requester_id}"
            allowed, remaining = await self.redis.rate_limit_check(
                rate_limit_key,
                self.GEOSPATIAL_RATE_LIMIT,
                60  # 1 minute window
            )
            if not allowed:
                raise BusinessRuleError(
                    f"Rate limit exceeded for geospatial queries. Try again later.",
                    rule_name="geospatial_rate_limit",
                    context={"remaining": remaining}
                )
        
        logger.info(f"Finding locations near ({params.latitude}, {params.longitude}) within {params.radius_km}km")
        
        try:
            results = await self.crud.find_nearby(params)
            
            # Convert to response format
            nearby_locations = []
            for row in results:
                # Create location object from row data
                location = Location(
                    id=row.id,
                    location_code=row.location_code,
                    location_name=row.location_name,
                    location_type=row.location_type,
                    address=row.address,
                    city=row.city,
                    state=row.state,
                    country=row.country,
                    postal_code=row.postal_code,
                    contact_number=row.contact_number,
                    email=row.email,
                    website=row.website,
                    latitude=row.latitude,
                    longitude=row.longitude,
                    timezone=row.timezone,
                    operating_hours=row.operating_hours,
                    capacity=row.capacity,
                    is_default=row.is_default,
                    is_active=row.is_active,
                    parent_location_id=row.parent_location_id,
                    manager_user_id=row.manager_user_id,
                    metadata=row.metadata,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                    created_by=row.created_by,
                    updated_by=row.updated_by
                )
                
                location_response = LocationResponse.model_validate(location)
                distance = float(row.distance)
                nearby_locations.append((location_response, distance))
            
            return nearby_locations
            
        except Exception as e:
            logger.error(f"Error finding nearby locations: {e}")
            raise DatabaseError(f"Failed to find nearby locations: {str(e)}", operation="geospatial_query", table="locations")
    
    # ==================== Hierarchical Operations ====================
    
    async def get_location_hierarchy(
        self,
        location_id: UUID,
        include_children: bool = True
    ) -> LocationWithChildren:
        """Get location with its hierarchy (parent and children)."""
        location = await self.get_location(location_id)
        
        if not include_children:
            return LocationWithChildren(**location.model_dump())
        
        # Get children
        children = await self.crud.get_children(location_id)
        child_responses = [LocationResponse.model_validate(child) for child in children]
        
        return LocationWithChildren(
            **location.model_dump(),
            child_locations=child_responses
        )
    
    async def get_location_path(self, location_id: UUID) -> List[LocationResponse]:
        """Get the full path from root to location."""
        ancestors = await self.crud.get_ancestors(location_id)
        ancestor_responses = [LocationResponse.model_validate(loc) for loc in reversed(ancestors)]
        
        # Add current location
        current_location = await self.get_location(location_id)
        ancestor_responses.append(current_location)
        
        return ancestor_responses
    
    # ==================== Bulk Operations ====================
    
    async def bulk_create_locations(
        self,
        bulk_data: LocationBulkCreate,
        created_by: Optional[UUID] = None,
        requester_id: Optional[UUID] = None
    ) -> List[LocationResponse]:
        """
        Bulk create locations with rate limiting and validation.
        
        Args:
            bulk_data: Bulk creation data
            created_by: User creating the locations
            requester_id: ID of the requester for rate limiting
            
        Returns:
            List of created location responses
        """
        # Rate limiting for bulk operations
        if requester_id and self.redis:
            rate_limit_key = f"bulk_ops:{requester_id}"
            allowed, remaining = await self.redis.rate_limit_check(
                rate_limit_key,
                self.BULK_OPERATION_RATE_LIMIT,
                60  # 1 minute window
            )
            if not allowed:
                raise BusinessRuleError(
                    f"Rate limit exceeded for bulk operations. Try again later.",
                    rule_name="bulk_operation_rate_limit",
                    context={"remaining": remaining}
                )
        
        logger.info(f"Bulk creating {len(bulk_data.locations)} locations")
        
        try:
            # Validate all locations first
            for i, location_data in enumerate(bulk_data.locations):
                # Check for duplicate codes within batch (already done in schema)
                # Additional business validations can be added here
                pass
            
            # Create locations
            created_locations = await self.crud.bulk_create(
                bulk_data.locations,
                created_by,
                bulk_data.skip_duplicates
            )
            
            # Invalidate caches
            await self._invalidate_location_caches()
            
            # Log audit trail
            await self._log_audit_event(
                "locations_bulk_created",
                {
                    "count": len(created_locations),
                    "skip_duplicates": bulk_data.skip_duplicates
                },
                created_by
            )
            
            return [LocationResponse.model_validate(loc) for loc in created_locations]
            
        except Exception as e:
            logger.error(f"Error in bulk create: {e}")
            raise DatabaseError(f"Failed to bulk create locations: {str(e)}", operation="bulk_create", table="locations")
    
    # ==================== Statistics and Analytics ====================
    
    async def get_location_statistics(self, use_cache: bool = True) -> LocationStatistics:
        """Get location statistics with caching."""
        cache_key = "location:statistics"
        
        if use_cache and self.redis:
            cached = await self.redis.cache_get(cache_key)
            if cached:
                return LocationStatistics(**cached)
        
        try:
            stats_data = await self.crud.get_statistics()
            stats = LocationStatistics(**stats_data)
            
            # Cache with longer TTL since stats change less frequently
            if use_cache and self.redis:
                await self.redis.cache_set(
                    cache_key,
                    stats.model_dump(),
                    ttl=self.CACHE_TTL_LONG
                )
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting location statistics: {e}")
            raise DatabaseError(f"Failed to get location statistics: {str(e)}", operation="statistics", table="locations")
    
    # ==================== Private Helper Methods ====================
    
    async def _get_location_hierarchy_level(self, location_id: UUID) -> int:
        """Get the hierarchy level of a location."""
        level = 0
        current_id = location_id
        visited = set()  # Prevent infinite loops
        
        while current_id and current_id not in visited:
            visited.add(current_id)
            location = await self.crud.get(current_id)
            if location and location.parent_location_id:
                level += 1
                current_id = location.parent_location_id
                if level > 10:  # Safety check
                    break
            else:
                break
        
        return level
    
    async def _validate_hierarchy_update(self, location_id: UUID, parent_id: UUID):
        """Validate hierarchy update to prevent cycles."""
        # Check if parent exists
        parent = await self.crud.get(parent_id)
        if not parent:
            raise ValidationError(f"Parent location {parent_id} not found", field="parent_location_id")
        
        # Check for circular reference
        if parent_id == location_id:
            raise ValidationError("Location cannot be its own parent", field="parent_location_id")
        
        # Check if the location would become an ancestor of itself
        ancestors = await self.crud.get_ancestors(parent_id)
        for ancestor in ancestors:
            if ancestor.id == location_id:
                raise ValidationError(
                    "Cannot create circular hierarchy: location would become its own ancestor",
                    field="parent_location_id"
                )
        
        # Check hierarchy depth
        parent_level = await self._get_location_hierarchy_level(parent_id)
        if parent_level >= 4:
            raise BusinessRuleError(
                "Maximum hierarchy depth (5 levels) would be exceeded",
                rule_name="max_hierarchy_depth"
            )
    
    async def _validate_manager_exists(self, manager_id: UUID):
        """Validate that manager user exists."""
        # This would typically check the users table
        # For now, we'll assume it exists if provided
        # In a full implementation, you'd query the User model
        pass
    
    async def _validate_coordinates_reasonable(self, latitude: Decimal, longitude: Decimal):
        """Validate that coordinates are within reasonable bounds."""
        lat_float = float(latitude)
        lon_float = float(longitude)
        
        # Basic validation (already done in model, but double-check)
        if not (-90 <= lat_float <= 90):
            raise ValidationError(f"Latitude {lat_float} is out of valid range (-90 to 90)", field="latitude")
        
        if not (-180 <= lon_float <= 180):
            raise ValidationError(f"Longitude {lon_float} is out of valid range (-180 to 180)", field="longitude")
    
    async def _cascade_delete_children(self, parent_id: UUID, deleted_by: Optional[UUID]):
        """Recursively delete child locations."""
        children = await self.crud.get_children(parent_id, include_inactive=True)
        for child in children:
            # Recursively delete children of this child
            await self._cascade_delete_children(child.id, deleted_by)
            # Delete this child
            await self.crud.delete(child.id, deleted_by)
    
    async def _invalidate_location_cache(self, location_id: UUID):
        """Invalidate cache for a specific location."""
        if self.redis:
            cache_keys = [
                f"location:{location_id}",
                f"location:hierarchy:{location_id}"
            ]
            await self.redis.delete(cache_keys)
    
    async def _invalidate_location_code_cache(self, location_code: str):
        """Invalidate cache for location by code."""
        if self.redis:
            await self.redis.cache_delete(f"location:code:{location_code.upper()}")
    
    async def _invalidate_location_caches(self):
        """Invalidate general location caches."""
        if self.redis:
            # Invalidate search caches and statistics
            cache_keys = [
                "location:statistics",
                # Note: In production, you might want to use Redis pattern matching
                # to delete all search cache keys matching "location:search:*"
            ]
            await self.redis.delete(cache_keys)
    
    async def _log_audit_event(
        self,
        event_type: str,
        details: Dict[str, Any],
        user_id: Optional[UUID]
    ):
        """Log audit events (placeholder for audit system)."""
        audit_entry = {
            "event_type": event_type,
            "details": details,
            "user_id": str(user_id) if user_id else None,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "location"
        }
        
        # In a full implementation, this would write to an audit log table or service
        logger.info(f"Audit: {json.dumps(audit_entry)}")
        
        # Could also cache recent audit events in Redis for quick access
        if self.redis:
            audit_key = f"audit:location:{datetime.utcnow().strftime('%Y-%m-%d')}"
            await self.redis.set(audit_key, audit_entry, ttl=86400)  # 24 hours