"""
Timezone management routes for system administration.

This module provides API endpoints for managing system timezone settings
and provides timezone information for the application.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.dependencies import get_session
from app.modules.auth.dependencies import get_current_superuser
from app.modules.users.models import User
from app.modules.system.service import SystemService
from app.modules.system.schemas import (
    TimezoneSettingResponse,
    TimezoneSettingUpdateRequest,
    SystemInfoResponse
)
from app.core.timezone import (
    TimezoneManager,
    utc_now,
    system_now,
    get_common_timezones,
    validate_timezone_name,
    format_datetime_output
)
from app.core.errors import ValidationError, NotFoundError


router = APIRouter(prefix="/timezone", tags=["Timezone Management"])


@router.get("/current", response_model=TimezoneSettingResponse)
async def get_current_timezone_settings(
    session: AsyncSession = Depends(get_session)
):
    """
    Get current timezone settings and information.
    
    Returns the current system timezone configuration along with
    current time in both UTC and system timezone.
    """
    system_service = SystemService(session)
    
    try:
        # Get timezone settings
        system_tz = await system_service.get_setting_value('system_timezone', 'Asia/Kolkata')
        scheduler_tz = await system_service.get_setting_value('task_scheduler_timezone', 'Asia/Kolkata')
        
        # Get current times
        utc_time = utc_now()
        system_time = system_now()
        
        # Get available timezones
        available_timezones = get_common_timezones()
        
        return TimezoneSettingResponse(
            system_timezone=system_tz,
            task_scheduler_timezone=scheduler_tz,
            available_timezones=available_timezones,
            current_utc_time=utc_time,
            current_system_time=system_time
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get timezone settings: {str(e)}"
        )


@router.put("/settings", response_model=TimezoneSettingResponse)
async def update_timezone_settings(
    request: TimezoneSettingUpdateRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Update system timezone settings.
    
    Updates the system timezone and/or scheduler timezone settings.
    This will affect how datetime values are displayed in API responses.
    """
    system_service = SystemService(session)
    
    try:
        # Update system timezone if provided
        if request.system_timezone:
            if not validate_timezone_name(request.system_timezone):
                raise ValidationError(f"Invalid timezone: {request.system_timezone}")
            
            await system_service.update_setting('system_timezone', request.system_timezone)
            
            # Invalidate timezone cache to pick up new setting
            TimezoneManager.invalidate_cache()
        
        # Update scheduler timezone if provided
        if request.task_scheduler_timezone:
            if not validate_timezone_name(request.task_scheduler_timezone):
                raise ValidationError(f"Invalid scheduler timezone: {request.task_scheduler_timezone}")
            
            await system_service.update_setting('task_scheduler_timezone', request.task_scheduler_timezone)
        
        # Return updated settings
        return await get_current_timezone_settings(session)
        
    except ValidationError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update timezone settings: {str(e)}"
        )


@router.get("/available", response_model=List[Dict[str, str]])
async def get_available_timezones(
    current_user: User = Depends(get_current_superuser)):
    """
    Get list of available timezones.
    
    Returns a list of supported timezone names with their descriptions
    and current offset information.
    """
    try:
        import pytz
        from datetime import datetime
        
        timezones = get_common_timezones()
        timezone_info = []
        
        utc_now_dt = utc_now()
        
        for tz_name in timezones:
            try:
                tz_obj = pytz.timezone(tz_name)
                local_time = utc_now_dt.astimezone(tz_obj)
                
                # Get timezone offset
                offset = local_time.strftime('%z')
                formatted_offset = f"{offset[:3]}:{offset[3:]}" if offset else "+00:00"
                
                # Get timezone abbreviation
                abbr = local_time.strftime('%Z')
                
                timezone_info.append({
                    "name": tz_name,
                    "display_name": tz_name.replace('_', ' '),
                    "abbreviation": abbr,
                    "offset": formatted_offset,
                    "current_time": local_time.strftime('%Y-%m-%d %H:%M:%S'),
                    "is_dst": bool(local_time.dst())
                })
                
            except Exception as e:
                # Skip invalid timezones
                continue
        
        # Sort by offset then by name
        timezone_info.sort(key=lambda x: (x['offset'], x['name']))
        
        return timezone_info
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get available timezones: {str(e)}"
        )


@router.get("/validate/{timezone_name}")
async def validate_timezone(timezone_name: str,
    current_user: User = Depends(get_current_superuser)):
    """
    Validate a timezone name.
    
    Checks if the provided timezone name is valid and returns
    information about that timezone.
    """
    try:
        is_valid = validate_timezone_name(timezone_name)
        
        if not is_valid:
            return {
                "valid": False,
                "timezone": timezone_name,
                "error": "Invalid timezone name"
            }
        
        # Get timezone information
        import pytz
        tz_obj = pytz.timezone(timezone_name)
        utc_time = utc_now()
        local_time = utc_time.astimezone(tz_obj)
        
        offset = local_time.strftime('%z')
        formatted_offset = f"{offset[:3]}:{offset[3:]}" if offset else "+00:00"
        
        return {
            "valid": True,
            "timezone": timezone_name,
            "display_name": timezone_name.replace('_', ' '),
            "abbreviation": local_time.strftime('%Z'),
            "offset": formatted_offset,
            "current_time": local_time.strftime('%Y-%m-%d %H:%M:%S'),
            "is_dst": bool(local_time.dst()),
            "utc_offset_hours": local_time.utcoffset().total_seconds() / 3600
        }
        
    except Exception as e:
        return {
            "valid": False,
            "timezone": timezone_name,
            "error": str(e)
        }


@router.get("/conversion")
async def convert_datetime(
    datetime_str: str,
    from_timezone: str = "UTC",
    to_timezone: str = None
,
    current_user: User = Depends(get_current_superuser)):
    """
    Convert datetime between timezones.
    
    Converts a datetime string from one timezone to another.
    If to_timezone is not specified, converts to system timezone.
    """
    try:
        from app.core.timezone import parse_datetime_input, to_system_tz, TimezoneManager
        import pytz
        
        # Validate timezones
        if not validate_timezone_name(from_timezone):
            raise ValidationError(f"Invalid source timezone: {from_timezone}")
        
        if to_timezone and not validate_timezone_name(to_timezone):
            raise ValidationError(f"Invalid target timezone: {to_timezone}")
        
        # Parse input datetime
        if from_timezone == "UTC":
            # Parse as UTC
            parsed_dt = parse_datetime_input(datetime_str)
        else:
            # Parse with source timezone
            parsed_dt = parse_datetime_input(datetime_str, from_timezone)
        
        # Convert to target timezone
        if to_timezone:
            target_tz = pytz.timezone(to_timezone)
            converted_dt = parsed_dt.astimezone(target_tz)
        else:
            # Convert to system timezone
            converted_dt = to_system_tz(parsed_dt)
            to_timezone = TimezoneManager.get_system_timezone_sync().zone
        
        return {
            "original": {
                "datetime": datetime_str,
                "timezone": from_timezone
            },
            "converted": {
                "datetime": converted_dt.isoformat(),
                "timezone": to_timezone,
                "formatted": converted_dt.strftime('%Y-%m-%d %H:%M:%S %Z'),
                "offset": converted_dt.strftime('%z')
            },
            "utc_equivalent": parsed_dt.isoformat()
        }
        
    except ValidationError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to convert datetime: {str(e)}"
        )


@router.get("/info", response_model=Dict[str, Any])
async def get_timezone_info(
    session: AsyncSession = Depends(get_session)
):
    """
    Get comprehensive timezone information for the system.
    
    Returns detailed information about the current timezone configuration,
    time comparisons, and system status.
    """
    system_service = SystemService(session)
    
    try:
        # Get system settings
        system_tz_name = await system_service.get_setting_value('system_timezone', 'Asia/Kolkata')
        scheduler_tz_name = await system_service.get_setting_value('task_scheduler_timezone', 'Asia/Kolkata')
        
        # Get current times
        utc_time = utc_now()
        system_time = system_now()
        
        # Get timezone objects for detailed info
        import pytz
        system_tz = pytz.timezone(system_tz_name)
        scheduler_tz = pytz.timezone(scheduler_tz_name)
        
        # Calculate offsets
        system_offset = system_time.strftime('%z')
        system_offset_formatted = f"{system_offset[:3]}:{system_offset[3:]}" if system_offset else "+00:00"
        
        scheduler_time = utc_time.astimezone(scheduler_tz)
        scheduler_offset = scheduler_time.strftime('%z')
        scheduler_offset_formatted = f"{scheduler_offset[:3]}:{scheduler_offset[3:]}" if scheduler_offset else "+00:00"
        
        return {
            "system_timezone": {
                "name": system_tz_name,
                "display_name": system_tz_name.replace('_', ' '),
                "abbreviation": system_time.strftime('%Z'),
                "offset": system_offset_formatted,
                "current_time": system_time.isoformat(),
                "is_dst": bool(system_time.dst()),
                "description": "Timezone used for API responses"
            },
            "scheduler_timezone": {
                "name": scheduler_tz_name,
                "display_name": scheduler_tz_name.replace('_', ' '),
                "abbreviation": scheduler_time.strftime('%Z'),
                "offset": scheduler_offset_formatted,
                "current_time": scheduler_time.isoformat(),
                "is_dst": bool(scheduler_time.dst()),
                "description": "Timezone used for scheduled tasks"
            },
            "utc_time": {
                "current_time": utc_time.isoformat(),
                "description": "UTC time used for database storage"
            },
            "time_comparisons": {
                "utc_vs_system_hours_diff": (system_time.hour - utc_time.hour) % 24,
                "system_ahead_of_utc": system_time > utc_time,
                "system_behind_utc": system_time < utc_time
            },
            "configuration": {
                "database_storage": "UTC (timezone-aware)",
                "api_input": "Any timezone → converted to UTC",
                "api_output": f"UTC → converted to {system_tz_name}",
                "scheduled_tasks": f"Run in {scheduler_tz_name}",
                "cache_enabled": True,
                "auto_conversion": True
            },
            "available_timezones_count": len(get_common_timezones()),
            "last_updated": format_datetime_output(utc_time)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get timezone info: {str(e)}"
        )


@router.post("/reset")
async def reset_to_default_timezone(
    session: AsyncSession = Depends(get_session)
):
    """
    Reset timezone settings to default (Indian Standard Time).
    
    Resets both system and scheduler timezones to Asia/Kolkata
    and clears the timezone cache.
    """
    system_service = SystemService(session)
    
    try:
        # Reset to IST
        await system_service.update_setting('system_timezone', 'Asia/Kolkata')
        await system_service.update_setting('task_scheduler_timezone', 'Asia/Kolkata')
        
        # Clear cache
        TimezoneManager.invalidate_cache()
        
        return {
            "message": "Timezone settings reset to default (Indian Standard Time)",
            "system_timezone": "Asia/Kolkata",
            "task_scheduler_timezone": "Asia/Kolkata",
            "reset_at": format_datetime_output(utc_now())
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset timezone settings: {str(e)}"
        )


# Health check for timezone functionality
@router.get("/health")
async def timezone_health_check(
    current_user: User = Depends(get_current_superuser)):
    """
    Health check for timezone functionality.
    
    Verifies that timezone conversion is working correctly
    and returns system timezone status.
    """
    try:
        from app.core.timezone import parse_datetime_input, format_datetime_output
        
        # Test conversion
        test_input = "2024-01-29T15:30:00+05:30"  # IST
        parsed_utc = parse_datetime_input(test_input)
        formatted_output = format_datetime_output(parsed_utc)
        
        # Verify conversion
        conversion_working = (
            parsed_utc.hour == 10 and  # 15:30 IST = 10:00 UTC
            "15:30:00" in formatted_output  # Should format back to IST
        )
        
        system_tz = TimezoneManager.get_system_timezone_sync()
        
        return {
            "status": "healthy" if conversion_working else "unhealthy",
            "timezone_conversion": "working" if conversion_working else "failed",
            "system_timezone": system_tz.zone,
            "test_results": {
                "input": test_input,
                "parsed_utc": parsed_utc.isoformat(),
                "formatted_output": formatted_output,
                "conversion_correct": conversion_working
            },
            "timestamp": format_datetime_output(utc_now()),
            "cache_status": "active" if TimezoneManager._system_timezone_cache else "empty"
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": utc_now().isoformat()
        }