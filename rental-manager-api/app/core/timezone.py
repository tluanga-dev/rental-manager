"""
Timezone management utilities for the rental management system.

This module provides centralized timezone handling with the following capabilities:
1. System timezone configuration from database settings
2. Automatic conversion between UTC (database) and system timezone (API)
3. Support for various input timezone formats
4. Default to Indian Standard Time (IST)
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Union, Any
import pytz
from functools import lru_cache

logger = logging.getLogger(__name__)

# Indian Standard Time timezone
IST = pytz.timezone('Asia/Kolkata')

CACHE_DURATION_MINUTES = 5


class TimezoneManager:
    """Central timezone management class."""
    
    # Class-level cache variables
    _system_timezone_cache: Optional[pytz.BaseTzInfo] = None
    _system_timezone_cache_time: Optional[datetime] = None
    
    @staticmethod
    def get_system_timezone() -> pytz.BaseTzInfo:
        """
        Get the system timezone from settings or default to IST.
        
        Returns:
            pytz.BaseTzInfo: The system timezone
        """
        # Check cache validity
        if (TimezoneManager._system_timezone_cache and TimezoneManager._system_timezone_cache_time and 
            datetime.now(timezone.utc) - TimezoneManager._system_timezone_cache_time < timedelta(minutes=CACHE_DURATION_MINUTES)):
            return TimezoneManager._system_timezone_cache
        
        try:
            # Import here to avoid circular imports
            # Note: Will need to update these imports once system modules exist
            # from app.core.database import get_async_session
            # from app.modules.system.service import SystemService
            import asyncio
            
            # For now, return IST as default since system service doesn't exist yet
            timezone_obj = IST
            
            # TODO: Uncomment when system service is available
            # async def _get_timezone_setting():
            #     async for session in get_async_session():
            #         try:
            #             system_service = SystemService(session)
            #             timezone_str = await system_service.get_setting_value('system_timezone', 'Asia/Kolkata')
            #             return pytz.timezone(timezone_str)
            #         except Exception as e:
            #             logger.warning(f"Failed to get timezone from settings: {e}")
            #             return IST
            #         finally:
            #             await session.close()
            # 
            # # Get timezone from settings
            # try:
            #     loop = asyncio.get_event_loop()
            #     if loop.is_running():
            #         # If we're in an async context but can't await, use cached or default
            #         if TimezoneManager._system_timezone_cache:
            #             return TimezoneManager._system_timezone_cache
            #         return IST
            #     else:
            #         timezone_obj = loop.run_until_complete(_get_timezone_setting())
            # except Exception:
            #     # If no event loop or other async issues, create new one
            #     loop = asyncio.new_event_loop()
            #     try:
            #         timezone_obj = loop.run_until_complete(_get_timezone_setting())
            #     finally:
            #         loop.close()
                    
        except Exception as e:
            logger.warning(f"Failed to get system timezone from database: {e}")
            timezone_obj = IST
        
        # Update cache
        TimezoneManager._system_timezone_cache = timezone_obj
        TimezoneManager._system_timezone_cache_time = datetime.now(timezone.utc)
        
        return timezone_obj
    
    @staticmethod
    def get_system_timezone_sync() -> pytz.BaseTzInfo:
        """
        Get system timezone synchronously (for use in non-async contexts).
        Returns cached value or IST if cache is empty.
        """
        return TimezoneManager._system_timezone_cache or IST
    
    @staticmethod
    def utc_now() -> datetime:
        """Get current UTC datetime with timezone info."""
        return datetime.now(timezone.utc)
    
    @staticmethod
    def system_now() -> datetime:
        """Get current datetime in system timezone."""
        system_tz = TimezoneManager.get_system_timezone_sync()
        return datetime.now(system_tz)
    
    @staticmethod
    def to_utc(dt: datetime, source_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
        """
        Convert datetime to UTC.
        
        Args:
            dt: Datetime to convert
            source_tz: Source timezone (string name or timezone object). 
                      If None, assumes system timezone if dt is naive, 
                      or uses dt's timezone if aware.
        
        Returns:
            datetime: UTC datetime with timezone info
        """
        if dt is None:
            return None
            
        # If already UTC, return as-is
        if dt.tzinfo == timezone.utc:
            return dt
            
        # Handle naive datetime
        if dt.tzinfo is None:
            if source_tz is None:
                # Assume system timezone for naive datetime
                source_tz = TimezoneManager.get_system_timezone_sync()
            elif isinstance(source_tz, str):
                source_tz = pytz.timezone(source_tz)
            
            # Localize the naive datetime
            dt = source_tz.localize(dt)
        
        # Convert to UTC
        return dt.astimezone(timezone.utc)
    
    @staticmethod
    def to_system_timezone(dt: datetime, target_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
        """
        Convert datetime to system timezone (or specified timezone).
        
        Args:
            dt: Datetime to convert (assumed to be UTC if naive)
            target_tz: Target timezone. If None, uses system timezone.
        
        Returns:
            datetime: Datetime in target timezone
        """
        if dt is None:
            return None
            
        # Get target timezone
        if target_tz is None:
            target_tz = TimezoneManager.get_system_timezone_sync()
        elif isinstance(target_tz, str):
            target_tz = pytz.timezone(target_tz)
        
        # Handle naive datetime (assume UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        
        # Convert to target timezone
        return dt.astimezone(target_tz)
    
    @staticmethod
    def parse_datetime(dt_input: Union[str, datetime], source_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
        """
        Parse datetime from various formats and convert to UTC for database storage.
        
        Args:
            dt_input: Datetime string or datetime object
            source_tz: Source timezone for naive datetimes
        
        Returns:
            datetime: UTC datetime ready for database storage
        """
        if dt_input is None:
            return None
            
        if isinstance(dt_input, str):
            # Parse string to datetime
            try:
                # Try ISO format first
                dt = datetime.fromisoformat(dt_input.replace('Z', '+00:00'))
            except ValueError:
                try:
                    # Try common formats
                    for fmt in [
                        '%Y-%m-%d %H:%M:%S',
                        '%Y-%m-%d %H:%M:%S.%f',
                        '%Y-%m-%d %H:%M',
                        '%Y-%m-%d',
                        '%d/%m/%Y %H:%M:%S',
                        '%d/%m/%Y %H:%M',
                        '%d/%m/%Y',
                    ]:
                        try:
                            dt = datetime.strptime(dt_input, fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        raise ValueError(f"Unable to parse datetime string: {dt_input}")
                except ValueError as e:
                    logger.error(f"Failed to parse datetime string '{dt_input}': {e}")
                    raise
        else:
            dt = dt_input
        
        # Convert to UTC
        return TimezoneManager.to_utc(dt, source_tz)
    
    @staticmethod
    def format_for_api(dt: datetime, target_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> str:
        """
        Format datetime for API output in system timezone.
        
        Args:
            dt: UTC datetime from database
            target_tz: Target timezone for output. If None, uses system timezone.
        
        Returns:
            str: ISO formatted datetime string in target timezone
        """
        if dt is None:
            return None
            
        # Convert to target timezone
        local_dt = TimezoneManager.to_system_timezone(dt, target_tz)
        
        # Return ISO format with timezone info
        return local_dt.isoformat()
    
    @staticmethod
    def invalidate_cache():
        """Invalidate the timezone cache (useful when timezone setting changes)."""
        TimezoneManager._system_timezone_cache = None
        TimezoneManager._system_timezone_cache_time = None


# Convenience functions for common operations
def utc_now() -> datetime:
    """Get current UTC datetime."""
    return TimezoneManager.utc_now()


def system_now() -> datetime:
    """Get current datetime in system timezone."""
    return TimezoneManager.system_now()


def to_utc(dt: datetime, source_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
    """Convert datetime to UTC for database storage."""
    return TimezoneManager.to_utc(dt, source_tz)


def to_system_tz(dt: datetime, target_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
    """Convert datetime to system timezone for API output."""
    return TimezoneManager.to_system_timezone(dt, target_tz)


def parse_datetime_input(dt_input: Union[str, datetime], source_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> datetime:
    """Parse and convert datetime input to UTC."""
    return TimezoneManager.parse_datetime(dt_input, source_tz)


def format_datetime_output(dt: datetime, target_tz: Optional[Union[str, pytz.BaseTzInfo]] = None) -> str:
    """Format datetime for API output."""
    return TimezoneManager.format_for_api(dt, target_tz)


@lru_cache(maxsize=32)
def get_timezone_by_name(tz_name: str) -> pytz.BaseTzInfo:
    """Get timezone object by name with caching."""
    return pytz.timezone(tz_name)


# Timezone validation functions
def validate_timezone_name(tz_name: str) -> bool:
    """Validate if timezone name is valid."""
    try:
        pytz.timezone(tz_name)
        return True
    except pytz.UnknownTimeZoneError:
        return False


def get_common_timezones() -> list[str]:
    """Get list of common timezone names."""
    return [
        'Asia/Kolkata',      # Indian Standard Time
        'UTC',               # Coordinated Universal Time
        'US/Eastern',        # Eastern Time
        'US/Central',        # Central Time
        'US/Mountain',       # Mountain Time
        'US/Pacific',        # Pacific Time
        'Europe/London',     # GMT/BST
        'Europe/Paris',      # CET/CEST
        'Asia/Tokyo',        # Japan Standard Time
        'Asia/Shanghai',     # China Standard Time
        'Australia/Sydney',  # Australian Eastern Time
        'Asia/Dubai',        # Gulf Standard Time
        'Asia/Singapore',    # Singapore Time
    ]


# Database event listener helpers
def get_utc_now_for_db() -> datetime:
    """Get UTC now for database operations (for event listeners)."""
    return datetime.now(timezone.utc)