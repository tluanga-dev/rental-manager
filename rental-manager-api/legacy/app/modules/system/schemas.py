"""
Timezone-aware schemas for system management.

This module provides updated schemas that use the timezone-aware base models
for proper datetime handling with IST as the default timezone.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

from app.core.serializers import (
    TimezoneAwareModel,
    TimezoneAwareCreateModel,
    TimezoneAwareUpdateModel,
    TimezoneAwareResponseModel,
    timezone_aware_datetime_field,
    timezone_setting_field,
    validate_timezone_field
)
from app.modules.system.models import SettingType, SettingCategory, BackupStatus, BackupType, AuditAction


# System Settings Schemas
class SystemSettingResponse(TimezoneAwareResponseModel):
    """Response model for system settings with timezone-aware datetimes."""
    
    id: UUID
    setting_key: str
    setting_name: str
    setting_type: str
    setting_category: str
    setting_value: Optional[str]
    default_value: Optional[str]
    description: Optional[str]
    is_system: bool
    is_sensitive: bool
    validation_rules: Optional[Dict[str, Any]]
    display_order: str
    is_active: bool
    
    # Timezone-aware audit fields
    created_at: datetime = timezone_aware_datetime_field(
        description="When the setting was created"
    )
    updated_at: datetime = timezone_aware_datetime_field(
        description="When the setting was last updated"
    )
    created_by: Optional[str]
    updated_by: Optional[str]


class SystemSettingCreateRequest(TimezoneAwareCreateModel):
    """Create request for system settings."""
    
    setting_key: str = Field(..., min_length=1, max_length=100, description="Unique setting key")
    setting_name: str = Field(..., min_length=1, max_length=200, description="Human-readable setting name")
    setting_type: SettingType = Field(..., description="Type of setting")
    setting_category: SettingCategory = Field(..., description="Category of setting")
    setting_value: Optional[str] = Field(None, description="Current value")
    default_value: Optional[str] = Field(None, description="Default value")
    description: Optional[str] = Field(None, description="Setting description")
    is_system: bool = Field(False, description="Whether this is a system setting")
    is_sensitive: bool = Field(False, description="Whether setting contains sensitive data")
    validation_rules: Optional[Dict[str, Any]] = Field(None, description="JSON validation rules")
    display_order: str = Field("0", description="Display order")


class SystemSettingUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for system settings."""
    
    setting_name: Optional[str] = Field(None, min_length=1, max_length=200, description="Human-readable setting name")
    setting_value: Optional[str] = Field(None, description="Current value")
    description: Optional[str] = Field(None, description="Setting description")
    display_order: Optional[str] = Field(None, description="Display order")


# Timezone-specific setting schemas
class TimezoneSettingResponse(TimezoneAwareResponseModel):
    """Response model for timezone settings."""
    
    system_timezone: str = timezone_setting_field(
        description="Current system timezone"
    )
    task_scheduler_timezone: str = timezone_setting_field(
        description="Timezone for scheduled tasks"
    )
    available_timezones: List[str] = Field(..., description="List of available timezones")
    current_utc_time: datetime = timezone_aware_datetime_field(
        description="Current UTC time"
    )
    current_system_time: datetime = timezone_aware_datetime_field(
        description="Current time in system timezone"
    )


class TimezoneSettingUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for timezone settings."""
    
    system_timezone: Optional[str] = timezone_setting_field(
        default=None,
        description="System timezone for API responses"
    )
    task_scheduler_timezone: Optional[str] = timezone_setting_field(
        default=None,
        description="Timezone for scheduled tasks"
    )
    
    @field_validator('system_timezone', 'task_scheduler_timezone')
    @classmethod
    def validate_timezones(cls, v):
        """Validate timezone settings."""
        if v is not None:
            return validate_timezone_field(v)
        return v


# System Backup Schemas
class SystemBackupResponse(TimezoneAwareResponseModel):
    """Response model for system backups with timezone-aware datetimes."""
    
    id: UUID
    backup_name: str
    backup_type: str
    backup_status: str
    backup_path: Optional[str]
    backup_size: Optional[str]
    started_by: UUID
    retention_days: str
    description: Optional[str]
    backup_metadata: Optional[Dict[str, Any]]
    error_message: Optional[str]
    is_active: bool
    
    # Timezone-aware datetime fields
    started_at: datetime = timezone_aware_datetime_field(
        description="When the backup was started"
    )
    completed_at: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When the backup was completed"
    )
    created_at: datetime = timezone_aware_datetime_field(
        description="When the backup record was created"
    )
    updated_at: datetime = timezone_aware_datetime_field(
        description="When the backup record was last updated"
    )
    
    # Computed properties
    @property
    def duration_minutes(self) -> Optional[int]:
        """Calculate backup duration in minutes."""
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() / 60)
        return None
    
    @property
    def backup_size_mb(self) -> Optional[float]:
        """Get backup size in MB."""
        if self.backup_size:
            try:
                return float(self.backup_size) / (1024 * 1024)
            except ValueError:
                return None
        return None


class SystemBackupCreateRequest(TimezoneAwareCreateModel):
    """Create request for system backups."""
    
    backup_name: str = Field(..., min_length=1, max_length=200, description="Name of the backup")
    backup_type: BackupType = Field(..., description="Type of backup")
    description: Optional[str] = Field(None, description="Description of the backup")
    retention_days: str = Field("30", description="Number of days to retain the backup")
    
    # Optional scheduling
    scheduled_for: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Schedule backup for specific time (optional)"
    )


# Audit Log Schemas
class AuditLogResponse(TimezoneAwareResponseModel):
    """Response model for audit logs with timezone-aware datetime."""
    
    id: UUID
    user_id: Optional[UUID]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]
    success: bool
    error_message: Optional[str]
    audit_metadata: Optional[Dict[str, Any]]
    is_active: bool
    
    # Timezone-aware timestamp
    created_at: datetime = timezone_aware_datetime_field(
        description="When the action was performed"
    )
    updated_at: datetime = timezone_aware_datetime_field(
        description="When the audit record was last updated"
    )
    
    @property
    def status_display(self) -> str:
        """Get status display."""
        return "SUCCESS" if self.success else "FAILED"


# System Information Schemas
class SystemInfoResponse(TimezoneAwareResponseModel):
    """Response model for system information with timezone details."""
    
    system_name: str
    system_version: str
    company_name: str
    
    # Timezone information
    system_timezone: str = timezone_setting_field(
        description="Current system timezone"
    )
    timezone_offset: str = Field(..., description="Current timezone offset (e.g., +05:30)")
    
    # System metrics
    settings_count: int = Field(..., description="Total number of settings")
    backups_count: int = Field(..., description="Total number of backups")
    recent_activity_count: int = Field(..., description="Recent activity count")
    
    # Timestamps
    system_started: datetime = timezone_aware_datetime_field(
        description="When the system was started"
    )
    last_backup: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When the last backup was completed"
    )
    current_time: datetime = timezone_aware_datetime_field(
        description="Current system time"
    )
    
    # System health
    system_health: Dict[str, Any] = Field(..., description="System health information")


# Company Information Schemas
class CompanyInfoResponse(TimezoneAwareResponseModel):
    """Response model for company information."""
    
    company_name: str
    company_address: Optional[str]
    company_email: Optional[str]
    company_phone: Optional[str]
    company_website: Optional[str]
    company_tax_id: Optional[str]
    company_gst_no: Optional[str]
    company_registration_number: Optional[str]
    company_currency: str
    company_logo_url: Optional[str]
    
    # Business hours with timezone context
    business_hours_start: Optional[str] = Field(None, description="Business start time in system timezone")
    business_hours_end: Optional[str] = Field(None, description="Business end time in system timezone")
    
    # Timezone information
    system_timezone: str = timezone_setting_field(
        description="Company's timezone setting"
    )
    
    # Last updated
    last_updated: datetime = timezone_aware_datetime_field(
        description="When company information was last updated"
    )


class CompanyInfoUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for company information."""
    
    company_name: Optional[str] = Field(None, min_length=1, description="Company name")
    company_address: Optional[str] = Field(None, description="Company address")
    company_email: Optional[str] = Field(None, description="Company email")
    company_phone: Optional[str] = Field(None, description="Company phone")
    company_website: Optional[str] = Field(None, description="Company website")
    company_tax_id: Optional[str] = Field(None, description="Company tax ID")
    company_gst_no: Optional[str] = Field(None, description="Company GST number")
    company_registration_number: Optional[str] = Field(None, description="Company registration number")
    company_currency: Optional[str] = Field(None, description="Company currency")
    company_logo_url: Optional[str] = Field(None, description="Company logo URL")
    business_hours_start: Optional[str] = Field(None, description="Business start time")
    business_hours_end: Optional[str] = Field(None, description="Business end time")


# Currency Configuration Schemas (timezone-aware for audit)
class CurrencyConfigResponse(TimezoneAwareResponseModel):
    """Response model for currency configuration."""
    
    currency_code: str = Field(..., description="ISO 4217 currency code")
    symbol: str = Field(..., description="Currency symbol")
    description: str = Field(..., description="Currency description")
    is_default: bool = Field(..., description="Is this the default currency")
    
    # Audit information
    last_updated: datetime = timezone_aware_datetime_field(
        description="When currency configuration was last updated"
    )
    updated_by: Optional[str] = Field(None, description="Who updated the configuration")


class CurrencyUpdateRequest(TimezoneAwareUpdateModel):
    """Update request for currency configuration."""
    
    currency_code: str = Field(..., min_length=3, max_length=3, description="ISO 4217 currency code")
    description: Optional[str] = Field(None, description="Currency description")


class SupportedCurrency(BaseModel):
    """Schema for supported currencies (no timezone fields needed)."""
    
    code: str = Field(..., description="Currency code")
    name: str = Field(..., description="Currency name")
    symbol: str = Field(..., description="Currency symbol")
    is_active: bool = Field(True, description="Whether currency is active")


# Maintenance and Health Check Schemas
class MaintenanceRequest(TimezoneAwareCreateModel):
    """Request model for system maintenance operations."""
    
    maintenance_type: str = Field(..., description="Type of maintenance to perform")
    description: Optional[str] = Field(None, description="Description of maintenance")
    
    # Scheduling
    scheduled_for: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Schedule maintenance for specific time"
    )
    
    # Options
    cleanup_old_logs: bool = Field(True, description="Cleanup old audit logs")
    cleanup_expired_backups: bool = Field(True, description="Cleanup expired backups")
    optimize_database: bool = Field(False, description="Run database optimization")


class MaintenanceResponse(TimezoneAwareResponseModel):
    """Response model for maintenance operations."""
    
    maintenance_id: UUID
    maintenance_type: str
    status: str
    description: Optional[str]
    
    # Timestamps
    started_at: datetime = timezone_aware_datetime_field(
        description="When maintenance started"
    )
    completed_at: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When maintenance completed"
    )
    
    # Results
    results: Dict[str, Any] = Field(..., description="Maintenance results")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    
    @property
    def duration_minutes(self) -> Optional[int]:
        """Calculate maintenance duration in minutes."""
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() / 60)
        return None


# Health Check Schema
class HealthCheckResponse(TimezoneAwareResponseModel):
    """Response model for health checks."""
    
    status: str = Field(..., description="Overall health status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    
    # Timezone-aware timestamp
    timestamp: datetime = timezone_aware_datetime_field(
        description="Health check timestamp"
    )
    
    # System information
    timezone: str = timezone_setting_field(
        description="System timezone"
    )
    uptime_seconds: int = Field(..., description="System uptime in seconds")
    
    # Component health
    database_status: str = Field(..., description="Database health status")
    cache_status: str = Field(..., description="Cache health status")
    storage_status: str = Field(..., description="Storage health status")
    
    # Performance metrics
    response_time_ms: float = Field(..., description="Response time in milliseconds")
    memory_usage_percent: float = Field(..., description="Memory usage percentage")
    cpu_usage_percent: float = Field(..., description="CPU usage percentage")
    
    # Additional info
    details: Optional[Dict[str, Any]] = Field(None, description="Additional health details")


# List response wrappers
class SystemSettingsListResponse(TimezoneAwareResponseModel):
    """List response for system settings."""
    
    settings: List[SystemSettingResponse]
    total_count: int
    category_counts: Dict[str, int] = Field(..., description="Settings count by category")
    
    # Metadata
    retrieved_at: datetime = timezone_aware_datetime_field(
        description="When the list was retrieved"
    )


class SystemBackupsListResponse(TimezoneAwareResponseModel):
    """List response for system backups."""
    
    backups: List[SystemBackupResponse]
    total_count: int
    status_counts: Dict[str, int] = Field(..., description="Backup count by status")
    
    # Metadata
    retrieved_at: datetime = timezone_aware_datetime_field(
        description="When the list was retrieved"
    )


class AuditLogsListResponse(TimezoneAwareResponseModel):
    """List response for audit logs."""
    
    logs: List[AuditLogResponse]
    total_count: int
    action_counts: Dict[str, int] = Field(..., description="Log count by action")
    
    # Metadata
    retrieved_at: datetime = timezone_aware_datetime_field(
        description="When the list was retrieved"
    )
    date_range: Dict[str, datetime] = Field(..., description="Date range of logs")