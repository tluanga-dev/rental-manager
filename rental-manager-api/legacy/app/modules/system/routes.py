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

# Request models
class SystemSettingUpdateRequest(BaseModel):
    """Request model for updating system settings."""
    setting_value: Any

# Dependency to get system service
async def get_system_service(session: AsyncSession = Depends(get_session)) -> SystemService:
    return SystemService(session)

# KEEP: System Settings endpoints
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

# KEEP: Company endpoints
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

# KEEP: Currency endpoints
@router.get("/currency")
async def get_currency(
    current_user: User = Depends(get_current_superuser)):
    """Get current currency configuration."""
    return {
        "code": current_currency.currency_code,
        "symbol": current_currency.symbol,
        "name": current_currency.description,
        "is_default": current_currency.is_default
    }

@router.put("/currency")
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

# Include whitelist management routes
router.include_router(whitelist_router, prefix="/whitelist", tags=["Whitelist Management"])


# UNUSED BY FRONTEND - Commented out for security
# All the following endpoints have been removed for security:
# - POST /settings (create_setting)
# - GET /settings/{setting_key}/value (get_setting_value)
# - POST /settings/{setting_key}/reset (reset_setting)  
# - DELETE /settings/{setting_key} (delete_setting)
# - POST /settings/initialize (initialize_default_settings)
# - All System Backup endpoints (/backups/*)
# - All Audit Log endpoints (/audit-logs/*)
# - System Information endpoints (/info, /maintenance)
# - Settings by category endpoints (/settings/categories/{category})
# - Company debug/initialization endpoints (/company/debug, /company/initialize)
# - System settings currency endpoints (/system-settings/currency)
# - Supported currencies endpoint (/currencies/supported)