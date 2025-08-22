"""
Pydantic serialization mixins and utilities for timezone-aware datetime handling.

This module provides base classes and utilities for automatic timezone conversion
in API serialization and deserialization.
"""

from datetime import datetime
from typing import Any, Dict, Optional, Union, List
from pydantic import BaseModel, Field, field_serializer, field_validator, ConfigDict
from pydantic.json_schema import GenerateJsonSchema
import logging

from app.core.timezone import (
    TimezoneManager, 
    parse_datetime_input, 
    format_datetime_output,
    validate_timezone_name
)

logger = logging.getLogger(__name__)


class TimezoneAwareModel(BaseModel):
    """
    Base Pydantic model with automatic timezone conversion for datetime fields.
    
    - Input datetimes are converted to UTC for database storage
    - Output datetimes are converted to system timezone for API responses
    """
    
    model_config = ConfigDict(
        from_attributes=True,
        # Enable timezone-aware serialization
        extra='forbid',
        validate_assignment=True,
        str_strip_whitespace=True
    )
    
    @field_serializer('*', mode='wrap', check_fields=False)
    def serialize_datetime_fields(self, value: Any, serializer, info) -> Any:
        """Serialize datetime fields to timezone-aware strings."""
        if isinstance(value, datetime):
            return format_datetime_output(value) if value else None
        return serializer(value)
    
    def model_dump(
        self,
        *,
        include: Union[set, dict, None] = None,
        exclude: Union[set, dict, None] = None,
        by_alias: bool = False,
        exclude_unset: bool = False,
        exclude_defaults: bool = False,
        exclude_none: bool = False,
        round_trip: bool = False,
        warnings: bool = True,
        serialize_as_any: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Override model_dump to ensure datetime fields are properly timezone-converted.
        """
        data = super().model_dump(
            include=include,
            exclude=exclude,
            by_alias=by_alias,
            exclude_unset=exclude_unset,
            exclude_defaults=exclude_defaults,
            exclude_none=exclude_none,
            round_trip=round_trip,
            warnings=warnings,
            serialize_as_any=serialize_as_any,
            **kwargs
        )
        
        # Convert datetime fields to system timezone
        return self._convert_datetime_fields_for_output(data)
    
    def _convert_datetime_fields_for_output(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert datetime fields in the data dictionary to system timezone strings."""
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = format_datetime_output(value)
            elif isinstance(value, dict):
                data[key] = self._convert_datetime_fields_for_output(value)
            elif isinstance(value, list):
                data[key] = [
                    self._convert_datetime_fields_for_output(item) if isinstance(item, dict)
                    else format_datetime_output(item) if isinstance(item, datetime)
                    else item
                    for item in value
                ]
        return data


class TimezoneAwareCreateModel(TimezoneAwareModel):
    """
    Base model for creation requests with timezone handling.
    Converts input datetime strings to UTC for database storage.
    """
    
    @field_validator('*', mode='before')
    @classmethod
    def parse_datetime_fields(cls, value: Any, info) -> Any:
        """Parse and convert datetime string inputs to UTC."""
        field_name = info.field_name if info else 'unknown'
        
        # Check if this field is a datetime field by looking at the annotation
        if hasattr(cls.model_fields.get(field_name, None), 'annotation'):
            field_info = cls.model_fields.get(field_name)
            if field_info and hasattr(field_info, 'annotation'):
                # Check if the field is annotated as datetime
                annotation = field_info.annotation
                if annotation == datetime or (hasattr(annotation, '__origin__') and 
                                            hasattr(annotation, '__args__') and 
                                            datetime in getattr(annotation, '__args__', [])):
                    if isinstance(value, str):
                        try:
                            return parse_datetime_input(value)
                        except Exception as e:
                            logger.warning(f"Failed to parse datetime field '{field_name}' with value '{value}': {e}")
                            # Let Pydantic handle the validation error
                            pass
        
        return value


class TimezoneAwareUpdateModel(TimezoneAwareModel):
    """
    Base model for update requests with timezone handling.
    All fields are optional and datetime strings are converted to UTC.
    """
    
    @field_validator('*', mode='before')
    @classmethod
    def parse_datetime_fields(cls, value: Any, info) -> Any:
        """Parse and convert datetime string inputs to UTC."""
        if value is None:
            return value
            
        field_name = info.field_name if info else 'unknown'
        
        # Check if this field is a datetime field
        if hasattr(cls.model_fields.get(field_name, None), 'annotation'):
            field_info = cls.model_fields.get(field_name)
            if field_info and hasattr(field_info, 'annotation'):
                annotation = field_info.annotation
                # Handle Optional[datetime] or Union[datetime, None]
                if (annotation == datetime or 
                    (hasattr(annotation, '__origin__') and 
                     hasattr(annotation, '__args__') and 
                     datetime in getattr(annotation, '__args__', []))):
                    if isinstance(value, str):
                        try:
                            return parse_datetime_input(value)
                        except Exception as e:
                            logger.warning(f"Failed to parse datetime field '{field_name}' with value '{value}': {e}")
                            pass
        
        return value


class TimezoneAwareResponseModel(TimezoneAwareModel):
    """
    Base model for API responses with timezone handling.
    Automatically converts datetime fields to system timezone for output.
    """
    pass


# Utility functions for manual timezone conversion in schemas
def datetime_field_input_converter(value: Union[str, datetime, None]) -> Optional[datetime]:
    """
    Converter function for datetime fields in Pydantic models.
    Converts input to UTC for database storage.
    
    Usage:
        class MyModel(BaseModel):
            created_at: Optional[datetime] = Field(default=None, json_schema_extra={'convert_input': True})
            
            @field_validator('created_at', mode='before')
            @classmethod
            def convert_created_at(cls, v):
                return datetime_field_input_converter(v)
    """
    if value is None:
        return None
    
    if isinstance(value, str):
        return parse_datetime_input(value)
    elif isinstance(value, datetime):
        # If already datetime, ensure it's in UTC
        return TimezoneManager.to_utc(value)
    
    return value


def datetime_field_output_converter(value: Optional[datetime]) -> Optional[str]:
    """
    Converter function for datetime fields in API responses.
    Converts UTC datetime to system timezone string.
    
    Usage:
        @field_serializer('created_at')
        def serialize_created_at(self, value: datetime) -> str:
            return datetime_field_output_converter(value)
    """
    if value is None:
        return None
    
    return format_datetime_output(value)


# Common field types with timezone conversion
def timezone_aware_datetime_field(
    default: Any = None,
    description: str = "Datetime field with automatic timezone conversion",
    example: str = "2024-01-29T10:30:00+05:30",
    **kwargs
) -> Field:
    """
    Create a timezone-aware datetime field for Pydantic models.
    
    Args:
        default: Default value for the field
        description: Field description
        example: Example value for API documentation
        **kwargs: Additional Field parameters
    
    Returns:
        Field: Configured Pydantic Field
    """
    return Field(
        default=default,
        description=description,
        examples=[example],
        json_schema_extra={
            'format': 'date-time',
            'timezone_aware': True,
            'input_formats': [
                'ISO 8601 with timezone (2024-01-29T10:30:00+05:30)',
                'ISO 8601 UTC (2024-01-29T05:00:00Z)',
                'Simple format (2024-01-29 10:30:00)',
                'Date only (2024-01-29)'
            ]
        },
        **kwargs
    )


def timezone_setting_field(
    default: str = "Asia/Kolkata",
    description: str = "Timezone setting",
    **kwargs
) -> Field:
    """
    Create a timezone setting field with validation.
    
    Args:
        default: Default timezone
        description: Field description
        **kwargs: Additional Field parameters
    
    Returns:
        Field: Configured Pydantic Field with timezone validation
    """
    return Field(
        default=default,
        description=description,
        examples=["Asia/Kolkata", "UTC", "US/Eastern"],
        json_schema_extra={
            'enum': [
                'Asia/Kolkata', 'UTC', 'US/Eastern', 'US/Central', 
                'US/Mountain', 'US/Pacific', 'Europe/London', 'Europe/Paris',
                'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Asia/Dubai', 'Asia/Singapore'
            ]
        },
        **kwargs
    )


# Validator for timezone fields
def validate_timezone_field(value: str) -> str:
    """
    Validator function for timezone fields.
    
    Usage:
        @field_validator('timezone')
        @classmethod
        def validate_timezone(cls, v):
            return validate_timezone_field(v)
    """
    if not validate_timezone_name(value):
        raise ValueError(f"Invalid timezone: {value}")
    return value


# Custom JSON schema generator for timezone fields
class TimezoneAwareJsonSchemaGenerator(GenerateJsonSchema):
    """Custom JSON schema generator that adds timezone information to datetime fields."""
    
    def datetime_schema(self, schema):
        """Add timezone information to datetime schemas."""
        schema = super().datetime_schema(schema)
        schema.update({
            'format': 'date-time',
            'description': schema.get('description', '') + ' (automatically converted between UTC and system timezone)',
            'examples': ['2024-01-29T10:30:00+05:30', '2024-01-29T05:00:00Z', '2024-01-29 10:30:00']
        })
        return schema


# Helper functions for batch conversion
def convert_datetime_dict_to_utc(data: Dict[str, Any], datetime_fields: List[str]) -> Dict[str, Any]:
    """
    Convert specified datetime fields in a dictionary to UTC.
    
    Args:
        data: Dictionary containing the data
        datetime_fields: List of field names that contain datetime values
    
    Returns:
        Dict: Dictionary with converted datetime fields
    """
    converted_data = data.copy()
    
    for field_name in datetime_fields:
        if field_name in converted_data and converted_data[field_name] is not None:
            try:
                converted_data[field_name] = parse_datetime_input(converted_data[field_name])
            except Exception as e:
                logger.warning(f"Failed to convert datetime field '{field_name}': {e}")
    
    return converted_data


def convert_datetime_dict_to_system_tz(data: Dict[str, Any], datetime_fields: List[str]) -> Dict[str, Any]:
    """
    Convert specified datetime fields in a dictionary to system timezone strings.
    
    Args:
        data: Dictionary containing the data
        datetime_fields: List of field names that contain datetime values
    
    Returns:
        Dict: Dictionary with converted datetime fields
    """
    converted_data = data.copy()
    
    for field_name in datetime_fields:
        if field_name in converted_data and converted_data[field_name] is not None:
            try:
                if isinstance(converted_data[field_name], datetime):
                    converted_data[field_name] = format_datetime_output(converted_data[field_name])
            except Exception as e:
                logger.warning(f"Failed to convert datetime field '{field_name}': {e}")
    
    return converted_data