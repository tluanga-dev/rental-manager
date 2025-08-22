import json
import logging
from typing import Any, Optional, Union
from redis import asyncio as aioredis
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connections and operations"""

    def __init__(self):
        self.redis_client: Optional[aioredis.Redis] = None
        self.is_connected: bool = False

    async def connect(self) -> None:
        """Initialize Redis connection"""
        try:
            # Parse Redis URL and create connection
            self.redis_client = await aioredis.from_url(
                settings.redis_url_with_password,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
                max_connections=50,
            )

            # Test the connection
            await self.redis_client.ping()
            self.is_connected = True
            logger.info("Redis connection established successfully")

        except RedisConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.is_connected = False
            # Don't raise - allow app to run without Redis
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {e}")
            self.is_connected = False

    async def disconnect(self) -> None:
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            await self.redis_client.connection_pool.disconnect()
            self.is_connected = False
            logger.info("Redis connection closed")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from Redis with automatic JSON deserialization"""
        if not self.is_connected:
            return None

        try:
            value = await self.redis_client.get(key)
            if value:
                try:
                    # Try to deserialize JSON
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    # Return as string if not JSON
                    return value
            return None
        except RedisError as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in Redis with automatic JSON serialization"""
        if not self.is_connected:
            return False

        try:
            # Serialize value to JSON if it's not a string
            if not isinstance(value, str):
                value = json.dumps(value)

            # Use default TTL if not specified
            ttl = ttl or settings.REDIS_CACHE_TTL

            result = await self.redis_client.set(key, value, ex=ttl)
            return bool(result)
        except RedisError as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False

    async def delete(self, key: Union[str, list]) -> int:
        """Delete key(s) from Redis"""
        if not self.is_connected:
            return 0

        try:
            if isinstance(key, list):
                return await self.redis_client.delete(*key)
            return await self.redis_client.delete(key)
        except RedisError as e:
            logger.error(f"Redis DELETE error for key(s) {key}: {e}")
            return 0

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        if not self.is_connected:
            return False

        try:
            return bool(await self.redis_client.exists(key))
        except RedisError as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False

    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration time for a key"""
        if not self.is_connected:
            return False

        try:
            return bool(await self.redis_client.expire(key, ttl))
        except RedisError as e:
            logger.error(f"Redis EXPIRE error for key {key}: {e}")
            return False

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a counter in Redis"""
        if not self.is_connected:
            return None

        try:
            return await self.redis_client.incr(key, amount)
        except RedisError as e:
            logger.error(f"Redis INCR error for key {key}: {e}")
            return None

    async def decrement(self, key: str, amount: int = 1) -> Optional[int]:
        """Decrement a counter in Redis"""
        if not self.is_connected:
            return None

        try:
            return await self.redis_client.decr(key, amount)
        except RedisError as e:
            logger.error(f"Redis DECR error for key {key}: {e}")
            return None

    async def flush_db(self) -> bool:
        """Flush current database (use with caution)"""
        if not self.is_connected:
            return False

        try:
            await self.redis_client.flushdb()
            return True
        except RedisError as e:
            logger.error(f"Redis FLUSHDB error: {e}")
            return False

    async def health_check(self) -> bool:
        """Check Redis health"""
        if not self.is_connected:
            return False

        try:
            response = await self.redis_client.ping()
            return response is True
        except Exception:
            return False

    # Cache-specific methods
    async def cache_get(self, cache_key: str) -> Optional[Any]:
        """Get cached value with cache prefix"""
        return await self.get(f"cache:{cache_key}")

    async def cache_set(
        self,
        cache_key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set cached value with cache prefix"""
        return await self.set(f"cache:{cache_key}", value, ttl)

    async def cache_delete(self, cache_key: str) -> int:
        """Delete cached value"""
        return await self.delete(f"cache:{cache_key}")

    # Session management methods
    async def session_get(self, session_id: str) -> Optional[dict]:
        """Get session data"""
        return await self.get(f"session:{session_id}")

    async def session_set(
        self,
        session_id: str,
        data: dict,
        ttl: int = 3600
    ) -> bool:
        """Set session data"""
        return await self.set(f"session:{session_id}", data, ttl)

    async def session_delete(self, session_id: str) -> int:
        """Delete session"""
        return await self.delete(f"session:{session_id}")

    # Rate limiting methods
    async def rate_limit_check(
        self,
        identifier: str,
        limit: int,
        window: int
    ) -> tuple[bool, int]:
        """
        Check rate limit for an identifier
        Returns: (is_allowed, remaining_requests)
        """
        if not self.is_connected:
            return True, limit  # Allow if Redis is down

        key = f"rate_limit:{identifier}"
        try:
            # Use pipeline for atomic operations
            async with self.redis_client.pipeline() as pipe:
                pipe.incr(key)
                pipe.expire(key, window)
                results = await pipe.execute()

            count = results[0]
            remaining = max(0, limit - count)

            return count <= limit, remaining
        except RedisError as e:
            logger.error(f"Rate limit check error: {e}")
            return True, limit  # Allow if error


# Global Redis manager instance
redis_manager = RedisManager()


# Convenience function for dependency injection
async def get_redis() -> RedisManager:
    """
    Dependency to get Redis manager.
    Usage in FastAPI endpoints:
        @app.get("/items")
        async def get_items(redis: RedisManager = Depends(get_redis)):
            cached = await redis.cache_get("items")
            ...
    """
    return redis_manager