"""
Redis Cache Manager for Performance Optimization
Provides caching functionality for expensive queries
"""

import json
import hashlib
from typing import Any, Optional, Callable, Dict, List
from datetime import timedelta
from functools import wraps
import asyncio
from redis import asyncio as aioredis
from app.core.config import settings


class CacheManager:
    """Manages Redis cache operations"""
    
    def __init__(self):
        self.redis_client = None
        self.default_ttl = 300  # 5 minutes default
        
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = await aioredis.from_url(
                settings.REDIS_URL or "redis://localhost:6379",
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            print("✅ Redis cache initialized successfully")
        except Exception as e:
            print(f"⚠️ Redis not available, caching disabled: {e}")
            self.redis_client = None
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
    
    def _generate_cache_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """Generate consistent cache key from parameters"""
        # Sort params for consistent hashing
        sorted_params = sorted(params.items())
        param_str = json.dumps(sorted_params, default=str)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()
        return f"{prefix}:{param_hash}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"Cache get error: {e}")
        
        return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with TTL"""
        if not self.redis_client:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            ttl = ttl or self.default_ttl
            await self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    async def delete(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        if not self.redis_client:
            return 0
        
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                return await self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache delete error: {e}")
        
        return 0
    
    async def invalidate_prefix(self, prefix: str) -> int:
        """Invalidate all cache entries with given prefix"""
        return await self.delete(f"{prefix}:*")
    
    def cached(
        self,
        prefix: str,
        ttl: Optional[int] = None,
        key_params: Optional[List[str]] = None
    ):
        """
        Decorator for caching async functions
        
        Usage:
            @cache_manager.cached("inventory", ttl=600)
            async def get_inventory_data(**filters):
                # Expensive query
                return data
        """
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key from specified params
                if key_params:
                    cache_params = {k: kwargs.get(k) for k in key_params if k in kwargs}
                else:
                    cache_params = kwargs
                
                cache_key = self._generate_cache_key(prefix, cache_params)
                
                # Try to get from cache
                cached_value = await self.get(cache_key)
                if cached_value is not None:
                    return cached_value
                
                # Execute function and cache result
                result = await func(*args, **kwargs)
                await self.set(cache_key, result, ttl)
                
                return result
            
            return wrapper
        return decorator


# Global cache manager instance
cache_manager = CacheManager()


class InventoryCache:
    """Specialized cache for inventory operations"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.prefix = "inventory"
        self.ttl = 300  # 5 minutes
    
    async def get_stock_levels(
        self,
        location_id: Optional[str] = None,
        item_ids: Optional[List[str]] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached stock levels"""
        params = {
            "location_id": location_id,
            "item_ids": sorted(item_ids) if item_ids else None
        }
        cache_key = self.cache._generate_cache_key(f"{self.prefix}:stock", params)
        return await self.cache.get(cache_key)
    
    async def set_stock_levels(
        self,
        data: List[Dict[str, Any]],
        location_id: Optional[str] = None,
        item_ids: Optional[List[str]] = None
    ):
        """Cache stock levels"""
        params = {
            "location_id": location_id,
            "item_ids": sorted(item_ids) if item_ids else None
        }
        cache_key = self.cache._generate_cache_key(f"{self.prefix}:stock", params)
        await self.cache.set(cache_key, data, self.ttl)
    
    async def invalidate_stock_for_items(self, item_ids: List[str]):
        """Invalidate cache for specific items"""
        # Invalidate all stock cache entries
        # In production, could be more granular
        await self.cache.invalidate_prefix(f"{self.prefix}:stock")
    
    async def get_item_availability(
        self,
        item_id: str,
        location_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached item availability"""
        cache_key = f"{self.prefix}:availability:{item_id}:{location_id}"
        return await self.cache.get(cache_key)
    
    async def set_item_availability(
        self,
        item_id: str,
        location_id: str,
        data: Dict[str, Any]
    ):
        """Cache item availability"""
        cache_key = f"{self.prefix}:availability:{item_id}:{location_id}"
        await self.cache.set(cache_key, data, 60)  # 1 minute for availability
    
    async def warm_cache(self, get_all_stock_func: Callable):
        """Warm cache with frequently accessed data"""
        try:
            # Get all stock data
            all_stock = await get_all_stock_func()
            
            # Cache aggregated data
            cache_key = f"{self.prefix}:all_stock"
            await self.cache.set(cache_key, all_stock, 600)  # 10 minutes
            
            print(f"✅ Warmed inventory cache with {len(all_stock)} items")
        except Exception as e:
            print(f"⚠️ Failed to warm cache: {e}")


class TransactionCache:
    """Specialized cache for transaction operations"""
    
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.prefix = "transaction"
        self.ttl = 180  # 3 minutes
    
    async def get_rental_summary(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached rental summary"""
        params = {"customer_id": customer_id, "status": status}
        cache_key = self.cache._generate_cache_key(f"{self.prefix}:rental_summary", params)
        return await self.cache.get(cache_key)
    
    async def set_rental_summary(
        self,
        data: Dict[str, Any],
        customer_id: Optional[str] = None,
        status: Optional[str] = None
    ):
        """Cache rental summary"""
        params = {"customer_id": customer_id, "status": status}
        cache_key = self.cache._generate_cache_key(f"{self.prefix}:rental_summary", params)
        await self.cache.set(cache_key, data, self.ttl)
    
    async def invalidate_rental_cache(self, rental_id: str):
        """Invalidate cache for specific rental"""
        await self.cache.delete(f"{self.prefix}:rental:{rental_id}:*")
        await self.cache.invalidate_prefix(f"{self.prefix}:rental_summary")


# Initialize cache instances
inventory_cache = InventoryCache(cache_manager)
transaction_cache = TransactionCache(cache_manager)