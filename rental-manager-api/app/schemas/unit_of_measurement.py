"""Pydantic schemas for Unit of Measurement."""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from uuid import UUID


class UnitOfMeasurementBase(BaseModel):
    """Base unit of measurement schema with common fields."""
    
    name: str = Field(..., min_length=1, max_length=50, description="Unit name")
    code: Optional[str] = Field(None, min_length=1, max_length=10, description="Unit code/abbreviation")
    description: Optional[str] = Field(None, max_length=500, description="Unit description")
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Unit name cannot be empty')
        return v.strip()
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Unit code cannot be empty if provided')
            return v.strip().upper()
        return v
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v


class UnitOfMeasurementCreate(UnitOfMeasurementBase):
    """Schema for creating a new unit of measurement."""
    pass


class UnitOfMeasurementUpdate(BaseModel):
    """Schema for updating an existing unit of measurement."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="Unit name")
    code: Optional[str] = Field(None, max_length=10, description="Unit code/abbreviation")
    description: Optional[str] = Field(None, max_length=500, description="Unit description")
    is_active: Optional[bool] = Field(None, description="Unit active status")
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Unit name cannot be empty')
            return v.strip()
        return v
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v is not None:
            if v and not v.strip():
                raise ValueError('Unit code cannot be empty if provided')
            return v.strip().upper() if v else None
        return v
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            return v.strip() if v and v.strip() else None
        return v


class UnitOfMeasurementInDB(UnitOfMeasurementBase):
    """Schema for unit of measurement in database."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


class UnitOfMeasurementResponse(UnitOfMeasurementInDB):
    """Schema for unit of measurement response with all fields."""
    
    display_name: str = Field(..., description="Unit display name (computed)")
    item_count: int = Field(0, description="Number of items using this unit")
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v, info):
        """Compute display name from name and code."""
        if v is not None:
            return v
        data = info.data if hasattr(info, 'data') else {}
        name = data.get('name', '')
        code = data.get('code')
        if code:
            return f"{name} ({code})"
        return name


class UnitOfMeasurementSummary(BaseModel):
    """Schema for unit of measurement summary with all fields for table display."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Unit unique identifier")
    name: str = Field(..., description="Unit name")
    code: Optional[str] = Field(None, description="Unit code/abbreviation")
    description: Optional[str] = Field(None, description="Unit description")
    is_active: bool = Field(True, description="Unit active status")
    display_name: str = Field(..., description="Unit display name")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="User who created the unit")
    updated_by: Optional[str] = Field(None, description="User who last updated the unit")
    
    @field_validator('display_name', mode='before')
    @classmethod
    def compute_display_name(cls, v, info):
        """Compute display name from name and code."""
        if v is not None:
            return v
        data = info.data if hasattr(info, 'data') else {}
        name = data.get('name', '')
        code = data.get('code')
        if code:
            return f"{name} ({code})"
        return name


class UnitOfMeasurementList(BaseModel):
    """Schema for paginated unit of measurement list response."""
    
    items: List[UnitOfMeasurementSummary] = Field(..., description="List of unit summaries")
    total: int = Field(..., description="Total number of units")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")


class UnitOfMeasurementFilter(BaseModel):
    """Schema for unit of measurement filtering and search."""
    
    name: Optional[str] = Field(None, description="Filter by unit name (partial match)")
    code: Optional[str] = Field(None, description="Filter by unit code (partial match)")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    search: Optional[str] = Field(None, description="Search in name, code and description")
    
    @field_validator('name', 'code', 'search')
    @classmethod
    def validate_string_filters(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v


class UnitOfMeasurementSort(BaseModel):
    """Schema for unit of measurement sorting options."""
    
    field: str = Field('name', description="Field to sort by")
    direction: str = Field('asc', description="Sort direction (asc/desc)")
    
    @field_validator('field')
    @classmethod
    def validate_field(cls, v):
        allowed_fields = ['name', 'code', 'created_at', 'updated_at', 'is_active']
        if v not in allowed_fields:
            raise ValueError(f'Sort field must be one of: {", ".join(allowed_fields)}')
        return v
    
    @field_validator('direction')
    @classmethod
    def validate_direction(cls, v):
        if v.lower() not in ['asc', 'desc']:
            raise ValueError('Sort direction must be "asc" or "desc"')
        return v.lower()


class UnitOfMeasurementStats(BaseModel):
    """Schema for unit of measurement statistics."""
    
    total_units: int = Field(..., description="Total number of units")
    active_units: int = Field(..., description="Number of active units")
    inactive_units: int = Field(..., description="Number of inactive units")
    units_with_items: int = Field(..., description="Number of units with associated items")
    units_without_items: int = Field(..., description="Number of units without items")
    most_used_units: List[dict] = Field(..., description="Top units by item count")


class UnitOfMeasurementBulkOperation(BaseModel):
    """Schema for bulk unit of measurement operations."""
    
    unit_ids: List[UUID] = Field(..., min_length=1, description="List of unit IDs")
    operation: str = Field(..., description="Operation to perform (activate/deactivate)")
    
    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v):
        if v not in ['activate', 'deactivate']:
            raise ValueError('Operation must be "activate" or "deactivate"')
        return v


class UnitOfMeasurementBulkResult(BaseModel):
    """Schema for bulk operation results."""
    
    success_count: int = Field(..., description="Number of successful operations")
    failure_count: int = Field(..., description="Number of failed operations")
    errors: List[dict] = Field(default_factory=list, description="List of errors for failed operations")


class UnitOfMeasurementExport(BaseModel):
    """Schema for unit of measurement export data."""
    
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    code: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]
    updated_by: Optional[str]
    item_count: int = Field(0, description="Number of items using this unit")


class UnitOfMeasurementImport(BaseModel):
    """Schema for unit of measurement import data."""
    
    name: str = Field(..., min_length=1, max_length=50)
    code: Optional[str] = Field(None, min_length=1, max_length=10)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = Field(True)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Unit name cannot be empty')
        return v.strip()
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Unit code cannot be empty if provided')
            return v.strip().upper()
        return v
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v


class UnitOfMeasurementImportResult(BaseModel):
    """Schema for unit of measurement import results."""
    
    total_processed: int = Field(..., description="Total number of units processed")
    successful_imports: int = Field(..., description="Number of successful imports")
    failed_imports: int = Field(..., description="Number of failed imports")
    skipped_imports: int = Field(..., description="Number of skipped imports (duplicates)")
    errors: List[dict] = Field(default_factory=list, description="List of import errors")