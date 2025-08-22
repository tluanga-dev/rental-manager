from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.shared.dependencies import get_session
from app.modules.system.service import SystemService
from app.modules.system.models import (
    SettingType, SettingCategory, BackupStatus, BackupType, AuditAction
)
from app.modules.system.whitelist_routes import router as whitelist_router
from app.modules.auth.dependencies import get_current_superuser
from app.modules.users.models import User

router = APIRouter(tags=["System Management"])

# Currency Configuration Schemas
class CurrencyConfig(BaseModel):
    """Schema for currency configuration."""
    currency_code: str = Field(..., min_length=3, max_length=3, description="ISO 4217 currency code")
    symbol: str = Field(..., description="Currency symbol")
    description: str = Field(..., description="Currency description")
    is_default: bool = Field(default=True, description="Is this the default currency")

class CurrencyUpdateRequest(BaseModel):
    """Schema for updating currency configuration."""
    currency_code: str = Field(..., min_length=3, max_length=3, description="ISO 4217 currency code")
    description: Optional[str] = Field(None, description="Currency description")

class SupportedCurrency(BaseModel):
    """Schema for supported currencies."""
    code: str = Field(..., description="Currency code")
    name: str = Field(..., description="Currency name")
    symbol: str = Field(..., description="Currency symbol")

# In-memory currency configuration (in production, this would be in database)
current_currency = CurrencyConfig(
    currency_code="INR",
    symbol="₹",
    description="Indian Rupee",
    is_default=True
)

# Supported currencies
SUPPORTED_CURRENCIES = [
    SupportedCurrency(code="INR", name="Indian Rupee", symbol="₹"),
    SupportedCurrency(code="USD", name="US Dollar", symbol="$"),
    SupportedCurrency(code="EUR", name="Euro", symbol="€"),
    SupportedCurrency(code="GBP", name="British Pound", symbol="£"),
    SupportedCurrency(code="JPY", name="Japanese Yen", symbol="¥"),
    SupportedCurrency(code="CAD", name="Canadian Dollar", symbol="C$"),
    SupportedCurrency(code="AUD", name="Australian Dollar", symbol="A$"),
    SupportedCurrency(code="CNY", name="Chinese Yuan", symbol="¥"),
    SupportedCurrency(code="CHF", name="Swiss Franc", symbol="CHF"),
    SupportedCurrency(code="SGD", name="Singapore Dollar", symbol="S$"),
]

# Response models
class SystemSettingResponse(BaseModel):
    """Response model for system settings."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    setting_key: str
    setting_name: str
    setting_type: SettingType
    setting_category: SettingCategory
    setting_value: Optional[str]
    default_value: Optional[str]
    description: Optional[str]
    is_system: bool
    is_sensitive: bool
    validation_rules: Optional[Dict[str, Any]]
    display_order: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

class SystemBackupResponse(BaseModel):
    """Response model for system backups."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    backup_name: str
    backup_type: BackupType
    backup_status: BackupStatus
    backup_path: Optional[str]
    backup_size: Optional[str]
    started_by: UUID
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    retention_days: str
    description: Optional[str]
    backup_metadata: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

class AuditLogResponse(BaseModel):
    """Response model for audit logs."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: Optional[UUID]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]
    success: bool
    error_message: Optional[str]
    audit_metadata: Optional[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

# Request models
class SystemSettingCreateRequest(BaseModel):
    """Request model for creating system settings."""
    setting_key: str
    setting_name: str
    setting_type: SettingType
    setting_category: SettingCategory
    setting_value: Optional[str] = None
    default_value: Optional[str] = None
    description: Optional[str] = None
    is_system: bool = False
    is_sensitive: bool = False
    validation_rules: Optional[Dict[str, Any]] = None
    display_order: str = "0"

class SystemSettingUpdateRequest(BaseModel):
    """Request model for updating system settings."""
    setting_value: Any

class SystemBackupCreateRequest(BaseModel):
    """Request model for creating system backups."""
    backup_name: str
    backup_type: BackupType
    description: Optional[str] = None
    retention_days: str = "30"

class SystemInfoResponse(BaseModel):
    """Response model for system information."""
    system_name: str
    system_version: str
    company_name: str
    timezone: str
    settings_count: int
    backups_count: int
    recent_activity_count: int
    last_backup: Optional[Dict[str, Any]]
    system_health: Dict[str, Any]

# Dependency to get system service
async def get_system_service(session: AsyncSession = Depends(get_session)) -> SystemService:
    return SystemService(session)

# System Settings endpoints
@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_settings(
    category: Optional[SettingCategory] = Query(None, description="Filter by category"),
    include_system: bool = Query(True, description="Include system settings"),
    service: SystemService = Depends(get_system_service)
):
    """Get all system settings."""
    try:
        if category:
            settings = await service.get_settings_by_category(category)
        else:
            settings = await service.get_all_settings(include_system)
        
        return [SystemSettingResponse.model_validate(setting) for setting in settings]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/settings/{setting_key}", response_model=SystemSettingResponse)
async def get_setting(
    setting_key: str,
    service: SystemService = Depends(get_system_service)
):
    """Get system setting by key."""
    try:
        setting = await service.get_setting(setting_key)
        if not setting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{setting_key}' not found")
        
        return SystemSettingResponse.model_validate(setting)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/settings/{setting_key}/value")
async def get_setting_value(
    setting_key: str,
    service: SystemService = Depends(get_system_service)
):
    """Get system setting value by key."""
    try:
        value = await service.get_setting_value(setting_key)
        if value is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{setting_key}' not found")
        
        return {"setting_key": setting_key, "value": value}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/settings", response_model=SystemSettingResponse, status_code=status.HTTP_201_CREATED)
async def create_setting(
    setting_data: SystemSettingCreateRequest,
    service: SystemService = Depends(get_system_service)
):
    """Create a new system setting."""
    try:
        setting = await service.create_setting(
            setting_key=setting_data.setting_key,
            setting_name=setting_data.setting_name,
            setting_type=setting_data.setting_type,
            setting_category=setting_data.setting_category,
            setting_value=setting_data.setting_value,
            default_value=setting_data.default_value,
            description=setting_data.description,
            is_system=setting_data.is_system,
            is_sensitive=setting_data.is_sensitive,
            validation_rules=setting_data.validation_rules,
            display_order=setting_data.display_order
        )
        
        return SystemSettingResponse.model_validate(setting)
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.put("/settings/{setting_key}", response_model=SystemSettingResponse)
async def update_setting(
    setting_key: str,
    setting_data: SystemSettingUpdateRequest,
    updated_by: UUID = Query(..., description="User ID updating the setting"),
    service: SystemService = Depends(get_system_service)
):
    """Update a system setting value."""
    try:
        setting = await service.update_setting(setting_key, setting_data.setting_value, updated_by)
        return SystemSettingResponse.model_validate(setting)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/settings/{setting_key}/reset", response_model=SystemSettingResponse)
async def reset_setting(
    setting_key: str,
    updated_by: UUID = Query(..., description="User ID resetting the setting"),
    service: SystemService = Depends(get_system_service)
):
    """Reset a system setting to its default value."""
    try:
        setting = await service.reset_setting(setting_key, updated_by)
        return SystemSettingResponse.model_validate(setting)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.delete("/settings/{setting_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    setting_key: str,
    deleted_by: UUID = Query(..., description="User ID deleting the setting"),
    service: SystemService = Depends(get_system_service)
):
    """Delete a system setting."""
    try:
        success = await service.delete_setting(setting_key, deleted_by)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{setting_key}' not found")
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/settings/initialize", response_model=List[SystemSettingResponse])
async def initialize_default_settings(
    service: SystemService = Depends(get_system_service)
):
    """Initialize default system settings."""
    try:
        settings = await service.initialize_default_settings()
        return [SystemSettingResponse.model_validate(setting) for setting in settings]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# UNUSED BY FRONTEND - Commented out for security
# System Backup endpoints
# @router.post("/backups", response_model=SystemBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_backup(
    backup_data: SystemBackupCreateRequest,
    started_by: UUID = Query(..., description="User ID starting the backup"),
    service: SystemService = Depends(get_system_service)
):
    """Create a new system backup."""
    try:
        backup = await service.create_backup(
            backup_name=backup_data.backup_name,
            backup_type=backup_data.backup_type,
            started_by=started_by,
            description=backup_data.description,
            retention_days=backup_data.retention_days
        )
        
        return SystemBackupResponse.model_validate(backup)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/backups", response_model=List[SystemBackupResponse])
async def get_backups(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    backup_type: Optional[BackupType] = Query(None, description="Filter by backup type"),
    backup_status: Optional[BackupStatus] = Query(None, description="Filter by backup status"),
    started_by: Optional[UUID] = Query(None, description="Filter by starter"),
    service: SystemService = Depends(get_system_service)
):
    """Get all system backups with optional filtering."""
    try:
        backups = await service.get_backups(
            skip=skip,
            limit=limit,
            backup_type=backup_type,
            backup_status=backup_status,
            started_by=started_by
        )
        
        return [SystemBackupResponse.model_validate(backup) for backup in backups]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/backups/{backup_id}", response_model=SystemBackupResponse)
async def get_backup(
    backup_id: UUID,
    service: SystemService = Depends(get_system_service)
):
    """Get system backup by ID."""
    try:
        backup = await service.get_backup(backup_id)
        if not backup:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Backup with ID {backup_id} not found")
        
        return SystemBackupResponse.model_validate(backup)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/backups/{backup_id}/start", response_model=SystemBackupResponse)
async def start_backup(
    backup_id: UUID,
    service: SystemService = Depends(get_system_service)
):
    """Start a backup process."""
    try:
        backup = await service.start_backup(backup_id)
        return SystemBackupResponse.model_validate(backup)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/backups/{backup_id}/complete", response_model=SystemBackupResponse)
async def complete_backup(
    backup_id: UUID,
    backup_path: str = Query(..., description="Path to the backup file"),
    backup_size: int = Query(..., description="Size of the backup file in bytes"),
    service: SystemService = Depends(get_system_service)
):
    """Complete a backup process."""
    try:
        backup = await service.complete_backup(backup_id, backup_path, backup_size)
        return SystemBackupResponse.model_validate(backup)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/backups/{backup_id}/fail", response_model=SystemBackupResponse)
async def fail_backup(
    backup_id: UUID,
    error_message: str = Query(..., description="Error message"),
    service: SystemService = Depends(get_system_service)
):
    """Fail a backup process."""
    try:
        backup = await service.fail_backup(backup_id, error_message)
        return SystemBackupResponse.model_validate(backup)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/backups/{backup_id}/cancel", response_model=SystemBackupResponse)
async def cancel_backup(
    backup_id: UUID,
    service: SystemService = Depends(get_system_service)
):
    """Cancel a backup process."""
    try:
        backup = await service.cancel_backup(backup_id)
        return SystemBackupResponse.model_validate(backup)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.delete("/backups/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup(
    backup_id: UUID,
    deleted_by: UUID = Query(..., description="User ID deleting the backup"),
    service: SystemService = Depends(get_system_service)
):
    """Delete a system backup."""
    try:
        success = await service.delete_backup(backup_id, deleted_by)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Backup with ID {backup_id} not found")
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/backups/cleanup-expired")
async def cleanup_expired_backups(
    service: SystemService = Depends(get_system_service)
):
    """Clean up expired backups."""
    try:
        cleaned_count = await service.cleanup_expired_backups()
        return {"message": f"Cleaned up {cleaned_count} expired backups"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Audit Log endpoints
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    service: SystemService = Depends(get_system_service)
):
    """Get audit logs with optional filtering."""
    try:
        # Convert action string to enum if provided
        action_enum = None
        if action:
            try:
                action_enum = AuditAction(action)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action: {action}")
        
        logs = await service.get_audit_logs(
            skip=skip,
            limit=limit,
            user_id=user_id,
            action=action_enum,
            entity_type=entity_type,
            entity_id=entity_id,
            success=success,
            start_date=start_date,
            end_date=end_date
        )
        
        return [AuditLogResponse.model_validate(log) for log in logs]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/audit-logs/{audit_log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    audit_log_id: UUID,
    service: SystemService = Depends(get_system_service)
):
    """Get audit log by ID."""
    try:
        log = await service.get_audit_log(audit_log_id)
        if not log:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Audit log with ID {audit_log_id} not found")
        
        return AuditLogResponse.model_validate(log)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/audit-logs/cleanup")
async def cleanup_old_audit_logs(
    retention_days: int = Query(90, ge=1, description="Days to retain audit logs"),
    service: SystemService = Depends(get_system_service)
):
    """Clean up old audit logs."""
    try:
        cleaned_count = await service.cleanup_old_audit_logs(retention_days)
        return {"message": f"Cleaned up {cleaned_count} old audit logs"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# System Information and Maintenance endpoints
@router.get("/info", response_model=SystemInfoResponse)
async def get_system_info(
    service: SystemService = Depends(get_system_service)
):
    """Get system information."""
    try:
        info = await service.get_system_info()
        return SystemInfoResponse.model_validate(info)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/maintenance")
async def perform_maintenance(
    user_id: UUID = Query(..., description="User ID performing maintenance"),
    service: SystemService = Depends(get_system_service)
):
    """Perform system maintenance tasks."""
    try:
        results = await service.perform_system_maintenance(user_id)
        return {"message": "System maintenance completed", "results": results}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Settings by category endpoints
@router.get("/settings/categories/{category}", response_model=List[SystemSettingResponse])
async def get_settings_by_category(
    category: SettingCategory,
    service: SystemService = Depends(get_system_service)
):
    """Get settings by category."""
    try:
        settings = await service.get_settings_by_category(category)
        return [SystemSettingResponse.model_validate(setting) for setting in settings]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Backup type specific endpoints
@router.get("/backups/types/{backup_type}", response_model=List[SystemBackupResponse])
async def get_backups_by_type(
    backup_type: BackupType,
    limit: int = Query(10, ge=1, le=100, description="Maximum records to return"),
    service: SystemService = Depends(get_system_service)
):
    """Get backups by type."""
    try:
        backups = await service.get_backups(
            backup_type=backup_type,
            limit=limit
        )
        return [SystemBackupResponse.model_validate(backup) for backup in backups]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/backups/status/{backup_status}", response_model=List[SystemBackupResponse])
async def get_backups_by_status(
    backup_status: BackupStatus,
    limit: int = Query(10, ge=1, le=100, description="Maximum records to return"),
    service: SystemService = Depends(get_system_service)
):
    """Get backups by status."""
    try:
        backups = await service.get_backups(
            backup_status=backup_status,
            limit=limit
        )
        return [SystemBackupResponse.model_validate(backup) for backup in backups]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Company Information endpoint
class CompanyInfo(BaseModel):
    """Schema for company information."""
    company_name: str = Field(..., description="Company name")
    company_address: Optional[str] = Field(None, description="Company address")
    company_phone: Optional[str] = Field(None, description="Company phone")
    company_email: Optional[str] = Field(None, description="Company email")
    website: Optional[str] = Field(None, description="Company website")
    tax_id: Optional[str] = Field(None, description="Company tax ID")
    currency: str = Field(default="INR", description="Company currency")
    logo_url: Optional[str] = Field(None, description="Company logo URL")

class CompanyUpdateRequest(BaseModel):
    """Schema for updating company information."""
    name: Optional[str] = Field(None, description="Company name")
    address: Optional[str] = Field(None, description="Company address")
    phone: Optional[str] = Field(None, description="Company phone")
    email: Optional[str] = Field(None, description="Company email")
    tax_id: Optional[str] = Field(None, description="Company tax ID (GST number)")

@router.get("/company", response_model=CompanyInfo)
async def get_company_info(
    session: AsyncSession = Depends(get_session)
):
    """Get company information from the single company record."""
    try:
        from app.modules.company.service import CompanyService
        from app.modules.company.repository import CompanyRepository
        
        # Get company service
        company_repository = CompanyRepository(session)
        company_service = CompanyService(company_repository)
        
        # Get or create the default company
        company = await company_service.get_or_create_default_company()
        
        return CompanyInfo(
            company_name=company.company_name,
            company_address=company.address or "",
            company_phone=company.phone or "",
            company_email=company.email or "",
            website="",  # Not in company model, could be added later
            tax_id=company.gst_no or "",  # Using GST number as tax ID
            currency="INR",  # Default currency, could be made configurable
            logo_url=""  # Not in company model, could be added later
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/company", response_model=CompanyInfo)
async def update_company_info(
    company_data: CompanyUpdateRequest,
    session: AsyncSession = Depends(get_session)
):
    """Update the single company record."""
    try:
        from app.modules.company.service import CompanyService
        from app.modules.company.repository import CompanyRepository
        from app.modules.company.schemas import CompanyUpdate
        
        # Get company service
        company_repository = CompanyRepository(session)
        company_service = CompanyService(company_repository)
        
        # Get the current company (or create if doesn't exist)
        current_company = await company_service.get_or_create_default_company()
        
        # Prepare update data
        update_data = CompanyUpdate(
            company_name=company_data.name,
            address=company_data.address,
            phone=company_data.phone,
            email=company_data.email,
            gst_no=company_data.tax_id  # Map tax_id to gst_no
        )
        
        # Update the company
        updated_company = await company_service.update_company(
            company_id=current_company.id,
            company_data=update_data,
            updated_by="system"  # Could be replaced with actual user ID from auth
        )
        
        return CompanyInfo(
            company_name=updated_company.company_name,
            company_address=updated_company.address or "",
            company_phone=updated_company.phone or "",
            company_email=updated_company.email or "",
            website="",  # Not in company model, could be added later
            tax_id=updated_company.gst_no or "",  # Using GST number as tax ID
            currency="INR",  # Default currency, could be made configurable
            logo_url=""  # Not in company model, could be added later
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/company/debug")
async def debug_company_database(
    session: AsyncSession = Depends(get_session)
):
    """Debug endpoint to check company data in database."""
    try:
        from app.modules.company.repository import CompanyRepository
        from sqlalchemy import select, text
        
        # Get company repository
        company_repository = CompanyRepository(session)
        
        # Get all companies from database
        query = select(company_repository.model)
        result = await session.execute(query)
        companies = result.scalars().all()
        
        # Get raw count from database
        count_query = text("SELECT COUNT(*) FROM companies")
        count_result = await session.execute(count_query)
        total_count = count_result.scalar()
        
        # Format company data for debugging
        company_data = []
        for company in companies:
            company_data.append({
                "id": str(company.id),
                "company_name": company.company_name,
                "address": company.address,
                "email": company.email,
                "phone": company.phone,
                "gst_no": company.gst_no,
                "registration_number": company.registration_number,
                "is_active": company.is_active,
                "created_at": company.created_at.isoformat() if company.created_at else None,
                "updated_at": company.updated_at.isoformat() if company.updated_at else None
            })
        
        return {
            "total_companies_in_db": total_count,
            "companies_found": len(companies),
            "companies": company_data,
            "database_status": "connected",
            "table_exists": True
        }
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "database_status": "error"
        }

@router.post("/company/initialize")
async def initialize_company_manually(
    session: AsyncSession = Depends(get_session)
):
    """Manually trigger company initialization (for testing)."""
    try:
        from app.modules.company.service import CompanyService
        from app.modules.company.repository import CompanyRepository
        
        # Get company service
        company_repository = CompanyRepository(session)
        company_service = CompanyService(company_repository)
        
        # Initialize default company
        company = await company_service.initialize_default_company()
        
        return {
            "success": True,
            "message": "Company initialized successfully",
            "company": {
                "id": str(company.id),
                "name": company.company_name,
                "address": company.address,
                "email": company.email,
                "phone": company.phone,
                "gst_no": company.gst_no,
                "registration_number": company.registration_number,
                "is_active": True
            }
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

# Currency endpoints
@router.get("/system-settings/currency")
async def get_current_currency(
    current_user: User = Depends(get_current_superuser)):
    """Get current currency configuration."""
    return {
        "code": current_currency.currency_code,
        "symbol": current_currency.symbol,
        "name": current_currency.description,
        "is_default": current_currency.is_default
    }

@router.get("/currency")
async def get_currency(
    current_user: User = Depends(get_current_superuser)):
    """Get current currency configuration (alias for system-settings/currency)."""
    return await get_current_currency()

@router.put("/system-settings/currency")
async def update_currency(currency_data: CurrencyUpdateRequest,
    current_user: User = Depends(get_current_superuser)):
    """Update currency configuration."""
    global current_currency
    
    # Find the new currency in supported currencies
    new_currency = None
    for currency in SUPPORTED_CURRENCIES:
        if currency.code == currency_data.currency_code:
            new_currency = currency
            break
    
    if not new_currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Currency '{currency_data.currency_code}' is not supported"
        )
    
    # Update current currency
    current_currency = CurrencyConfig(
        currency_code=new_currency.code,
        symbol=new_currency.symbol,
        description=currency_data.description or new_currency.name,
        is_default=True
    )
    
    return {
        "code": current_currency.currency_code,
        "symbol": current_currency.symbol,
        "name": current_currency.description,
        "is_default": current_currency.is_default
    }

@router.get("/currencies/supported")
async def get_supported_currencies(
    current_user: User = Depends(get_current_superuser)):
    """Get list of supported currencies."""
    return [
        {
            "code": currency.code,
            "name": currency.name,
            "symbol": currency.symbol
        }
        for currency in SUPPORTED_CURRENCIES
    ]

# Include whitelist management routes
router.include_router(whitelist_router, prefix="/whitelist", tags=["Whitelist Management"])