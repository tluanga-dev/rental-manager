"""
Example schemas demonstrating timezone-aware Pydantic models.

This file shows how to use the timezone-aware base classes and utilities
for consistent datetime handling across the API.
"""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
from pydantic import Field, field_validator
from decimal import Decimal

from app.core.serializers import (
    TimezoneAwareModel,
    TimezoneAwareCreateModel,
    TimezoneAwareUpdateModel,
    TimezoneAwareResponseModel,
    timezone_aware_datetime_field,
    timezone_setting_field,
    validate_timezone_field
)


# Example 1: System Settings Schema with Timezone Support
class SystemSettingResponse(TimezoneAwareResponseModel):
    """Response model for system settings with automatic timezone conversion."""
    
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
    display_order: str
    is_active: bool
    
    # These datetime fields will be automatically converted to system timezone
    created_at: datetime = timezone_aware_datetime_field(
        description="When the setting was created"
    )
    updated_at: datetime = timezone_aware_datetime_field(
        description="When the setting was last updated"
    )


class SystemSettingCreate(TimezoneAwareCreateModel):
    """Create model for system settings with timezone conversion."""
    
    setting_key: str = Field(..., description="Unique setting key")
    setting_name: str = Field(..., description="Human-readable setting name")
    setting_type: str = Field(..., description="Type of setting (STRING, INTEGER, etc.)")
    setting_category: str = Field(..., description="Category of setting")
    setting_value: Optional[str] = Field(None, description="Current value")
    default_value: Optional[str] = Field(None, description="Default value")
    description: Optional[str] = Field(None, description="Setting description")
    is_system: bool = Field(False, description="Whether this is a system setting")
    is_sensitive: bool = Field(False, description="Whether setting contains sensitive data")
    display_order: str = Field("0", description="Display order")


class SystemSettingUpdate(TimezoneAwareUpdateModel):
    """Update model for system settings with timezone conversion."""
    
    setting_name: Optional[str] = Field(None, description="Human-readable setting name")
    setting_value: Optional[str] = Field(None, description="Current value")
    description: Optional[str] = Field(None, description="Setting description")
    display_order: Optional[str] = Field(None, description="Display order")


# Example 2: Transaction Schema with Multiple Datetime Fields
class TransactionResponse(TimezoneAwareResponseModel):
    """Response model for transactions with timezone-aware datetime fields."""
    
    id: UUID
    transaction_number: str
    transaction_type: str
    status: str
    
    # All datetime fields will be automatically converted to system timezone for output
    transaction_date: datetime = timezone_aware_datetime_field(
        description="When the transaction was created"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    created_at: datetime = timezone_aware_datetime_field(
        description="Record creation timestamp"
    )
    updated_at: datetime = timezone_aware_datetime_field(
        description="Record last update timestamp"
    )
    
    # Financial fields
    subtotal: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    currency: str


class TransactionCreate(TimezoneAwareCreateModel):
    """Create model for transactions with automatic datetime parsing."""
    
    transaction_type: str = Field(..., description="Type of transaction")
    customer_id: Optional[UUID] = Field(None, description="Customer ID")
    supplier_id: Optional[UUID] = Field(None, description="Supplier ID")
    
    # Datetime fields - input strings will be automatically parsed and converted to UTC
    transaction_date: datetime = timezone_aware_datetime_field(
        description="Transaction date and time"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    # Financial fields
    subtotal: Decimal = Field(..., ge=0, description="Subtotal amount")
    discount_amount: Decimal = Field(0, ge=0, description="Discount amount")
    tax_amount: Decimal = Field(0, ge=0, description="Tax amount")
    total_amount: Decimal = Field(..., ge=0, description="Total amount")
    currency: str = Field("INR", description="Currency code")
    
    notes: Optional[str] = Field(None, description="Additional notes")


class TransactionUpdate(TimezoneAwareUpdateModel):
    """Update model for transactions with timezone handling."""
    
    status: Optional[str] = Field(None, description="Transaction status")
    
    # Datetime fields can be updated with automatic timezone conversion
    transaction_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Transaction date and time"
    )
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    # Financial fields
    discount_amount: Optional[Decimal] = Field(None, ge=0, description="Discount amount")
    tax_amount: Optional[Decimal] = Field(None, ge=0, description="Tax amount")
    paid_amount: Optional[Decimal] = Field(None, ge=0, description="Paid amount")
    
    notes: Optional[str] = Field(None, description="Additional notes")


# Example 3: Rental-specific Schema with Complex Datetime Logic
class RentalResponse(TimezoneAwareResponseModel):
    """Response model for rentals with multiple timezone-aware datetime fields."""
    
    id: UUID
    transaction_id: UUID
    item_id: UUID
    item_name: str
    quantity: int
    
    # Rental-specific datetime fields
    rental_start_date: datetime = timezone_aware_datetime_field(
        description="When the rental starts"
    )
    rental_end_date: datetime = timezone_aware_datetime_field(
        description="When the rental ends"
    )
    actual_return_date: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When the item was actually returned"
    )
    
    # Status and financial fields
    rental_status: str
    daily_rate: Decimal
    total_rental_amount: Decimal
    security_deposit: Decimal
    
    # Audit fields
    created_at: datetime = timezone_aware_datetime_field()
    updated_at: datetime = timezone_aware_datetime_field()


class RentalCreate(TimezoneAwareCreateModel):
    """Create model for rentals with datetime validation."""
    
    item_id: UUID = Field(..., description="Item to rent")
    quantity: int = Field(..., gt=0, description="Quantity to rent")
    
    # Rental period - automatically converted from input timezone to UTC
    rental_start_date: datetime = timezone_aware_datetime_field(
        description="Rental start date and time"
    )
    rental_end_date: datetime = timezone_aware_datetime_field(
        description="Rental end date and time"
    )
    
    # Rates
    daily_rate: Decimal = Field(..., gt=0, description="Daily rental rate")
    security_deposit: Decimal = Field(0, ge=0, description="Security deposit amount")
    
    @field_validator('rental_end_date')
    @classmethod
    def validate_rental_period(cls, v, info):
        """Ensure rental end date is after start date."""
        if 'rental_start_date' in info.data and info.data['rental_start_date']:
            if v <= info.data['rental_start_date']:
                raise ValueError('Rental end date must be after start date')
        return v


# Example 4: Audit Log Schema
class AuditLogResponse(TimezoneAwareResponseModel):
    """Response model for audit logs with timezone conversion."""
    
    id: UUID
    user_id: Optional[UUID]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    
    # Timestamp in system timezone
    created_at: datetime = timezone_aware_datetime_field(
        description="When the action was performed"
    )
    
    success: bool
    ip_address: Optional[str]
    user_agent: Optional[str]
    error_message: Optional[str]


# Example 5: System Configuration Schema with Timezone Setting
class SystemConfigResponse(TimezoneAwareResponseModel):
    """System configuration response with timezone setting."""
    
    system_name: str
    system_version: str
    company_name: str
    
    # Timezone setting with validation
    timezone: str = timezone_setting_field(
        description="System timezone for API responses"
    )
    
    # Other settings
    currency: str = Field("INR", description="Default currency")
    date_format: str = Field("DD/MM/YYYY", description="Date display format")
    time_format: str = Field("24H", description="Time display format")
    
    # System info timestamps
    last_backup: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Last backup timestamp"
    )
    system_started: datetime = timezone_aware_datetime_field(
        description="When the system was started"
    )


class SystemConfigUpdate(TimezoneAwareUpdateModel):
    """System configuration update with timezone validation."""
    
    company_name: Optional[str] = Field(None, description="Company name")
    
    timezone: Optional[str] = timezone_setting_field(
        default=None,
        description="System timezone"
    )
    
    currency: Optional[str] = Field(None, description="Default currency")
    date_format: Optional[str] = Field(None, description="Date display format")
    time_format: Optional[str] = Field(None, description="Time display format")
    
    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v):
        """Validate timezone setting."""
        if v is not None:
            return validate_timezone_field(v)
        return v


# Example 6: Batch Operation Schema
class BatchOperationRequest(TimezoneAwareCreateModel):
    """Batch operation request with timezone handling."""
    
    operation_type: str = Field(..., description="Type of batch operation")
    
    # Scheduling
    scheduled_for: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="When to run the operation (optional)"
    )
    
    # Filters with date ranges
    date_from: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="Start date for filtering"
    )
    date_to: Optional[datetime] = timezone_aware_datetime_field(
        default=None,
        description="End date for filtering"
    )
    
    parameters: dict = Field(default_factory=dict, description="Operation parameters")
    
    @field_validator('date_to')
    @classmethod
    def validate_date_range(cls, v, info):
        """Ensure date_to is after date_from."""
        if v and 'date_from' in info.data and info.data['date_from']:
            if v <= info.data['date_from']:
                raise ValueError('End date must be after start date')
        return v


class BatchOperationResponse(TimezoneAwareResponseModel):
    """Batch operation response with timezone-aware timestamps."""
    
    id: UUID
    operation_type: str
    status: str
    
    # Operation timestamps
    created_at: datetime = timezone_aware_datetime_field()
    started_at: Optional[datetime] = timezone_aware_datetime_field(default=None)
    completed_at: Optional[datetime] = timezone_aware_datetime_field(default=None)
    scheduled_for: Optional[datetime] = timezone_aware_datetime_field(default=None)
    
    # Results
    total_records: int = Field(0, description="Total records processed")
    successful_records: int = Field(0, description="Successfully processed records")
    failed_records: int = Field(0, description="Failed records")
    error_message: Optional[str] = Field(None, description="Error message if failed")


# Usage examples in route handlers:
"""
# Example route using timezone-aware schemas

@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(
    transaction_data: TransactionCreate,
    session: AsyncSession = Depends(get_session)
):
    # transaction_data.transaction_date is already converted to UTC
    # and ready for database storage
    
    transaction = TransactionHeader(
        transaction_type=transaction_data.transaction_type,
        transaction_date=transaction_data.transaction_date,  # Already UTC
        customer_id=transaction_data.customer_id,
        subtotal=transaction_data.subtotal,
        total_amount=transaction_data.total_amount,
        # ... other fields
    )
    
    session.add(transaction)
    await session.commit()
    await session.refresh(transaction)
    
    # TransactionResponse will automatically convert datetime fields to system timezone
    return TransactionResponse.model_validate(transaction)


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    transaction = await session.get(TransactionHeader, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Automatic timezone conversion happens in the response model
    return TransactionResponse.model_validate(transaction)
"""