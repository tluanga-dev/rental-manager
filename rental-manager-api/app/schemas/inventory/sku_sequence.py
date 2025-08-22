"""
SKU Sequence Schemas.

Pydantic schemas for SKU sequence operations.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.inventory.base import InventoryBaseSchema, TimestampMixin


class SKUSequenceBase(InventoryBaseSchema):
    """Base schema for SKU sequence data."""
    prefix: Optional[str] = Field(None, max_length=20, description="SKU prefix")
    suffix: Optional[str] = Field(None, max_length=20, description="SKU suffix")
    
    next_sequence: int = Field(1, gt=0, description="Next sequence number")
    padding_length: int = Field(4, ge=0, le=10, description="Sequence padding")
    
    format_template: Optional[str] = Field(
        None, 
        max_length=100,
        description="Python format string for SKU"
    )
    
    description: Optional[str] = Field(None, max_length=200)
    is_active: bool = Field(True, description="Whether sequence is active")
    
    @field_validator('prefix', 'suffix')
    @classmethod
    def validate_prefix_suffix(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip().upper()
            if len(v) > 20:
                raise ValueError("Prefix/suffix too long (max 20 characters)")
        return v


class SKUSequenceCreate(BaseModel):
    """Schema for creating SKU sequence."""
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    
    prefix: Optional[str] = Field(None, max_length=20)
    suffix: Optional[str] = Field(None, max_length=20)
    
    padding_length: int = Field(4, ge=0, le=10)
    format_template: Optional[str] = Field(None, max_length=100)
    
    description: Optional[str] = Field(None, max_length=200)
    
    class Config:
        json_schema_extra = {
            "example": {
                "brand_id": "123e4567-e89b-12d3-a456-426614174000",
                "category_id": "987fcdeb-51a2-43d1-9876-543210fedcba",
                "prefix": "PROD",
                "padding_length": 5,
                "description": "Product SKU sequence"
            }
        }


class SKUSequenceUpdate(BaseModel):
    """Schema for updating SKU sequence."""
    prefix: Optional[str] = Field(None, max_length=20)
    suffix: Optional[str] = Field(None, max_length=20)
    
    padding_length: Optional[int] = Field(None, ge=0, le=10)
    format_template: Optional[str] = Field(None, max_length=100)
    
    description: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = Field(None)
    
    # Allow resetting sequence (use with caution)
    reset_sequence_to: Optional[int] = Field(None, gt=0)


class SKUSequenceResponse(SKUSequenceBase, TimestampMixin):
    """Schema for SKU sequence response."""
    id: UUID = Field(..., description="Sequence ID")
    brand_id: Optional[UUID] = Field(None)
    category_id: Optional[UUID] = Field(None)
    
    last_generated_sku: Optional[str] = Field(None, description="Last generated SKU")
    last_generated_at: Optional[datetime] = Field(None)
    total_generated: int = Field(0, description="Total SKUs generated")
    
    version: int = Field(1, description="Version for locking")


class SKUSequenceWithRelations(SKUSequenceResponse):
    """SKU sequence with related data."""
    brand_name: Optional[str] = Field(None)
    brand_code: Optional[str] = Field(None)
    category_name: Optional[str] = Field(None)
    category_code: Optional[str] = Field(None)


class SKUGenerateRequest(BaseModel):
    """Request to generate a new SKU."""
    brand_code: Optional[str] = Field(None, max_length=20)
    category_code: Optional[str] = Field(None, max_length=20)
    item_name: Optional[str] = Field(None, max_length=100)
    custom_data: Optional[Dict[str, Any]] = Field(None)
    
    class Config:
        json_schema_extra = {
            "example": {
                "brand_code": "ACME",
                "category_code": "TOOL",
                "item_name": "Hammer Pro 2000"
            }
        }


class SKUGenerateResponse(BaseModel):
    """Response from SKU generation."""
    sku: str = Field(..., description="Generated SKU")
    sequence_id: UUID = Field(..., description="Sequence used")
    sequence_number: int = Field(..., description="Sequence number used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sku": "ACME-TOOL-HAM-0001",
                "sequence_id": "123e4567-e89b-12d3-a456-426614174000",
                "sequence_number": 1
            }
        }


class BulkSKUGenerateRequest(BaseModel):
    """Request to generate multiple SKUs."""
    count: int = Field(..., ge=1, le=1000, description="Number of SKUs")
    brand_code: Optional[str] = Field(None, max_length=20)
    category_code: Optional[str] = Field(None, max_length=20)
    item_names: Optional[list[str]] = Field(None, max_items=1000)
    
    class Config:
        json_schema_extra = {
            "example": {
                "count": 10,
                "brand_code": "ACME",
                "category_code": "TOOL"
            }
        }


class BulkSKUGenerateResponse(BaseModel):
    """Response from bulk SKU generation."""
    skus: list[str] = Field(..., description="Generated SKUs")
    sequence_id: UUID = Field(..., description="Sequence used")
    start_sequence: int = Field(..., description="Starting sequence number")
    end_sequence: int = Field(..., description="Ending sequence number")


class SKUValidationRequest(BaseModel):
    """Request to validate SKU format."""
    sku: str = Field(..., min_length=1, max_length=50)
    check_uniqueness: bool = Field(True, description="Check if SKU exists")


class SKUValidationResponse(BaseModel):
    """Response from SKU validation."""
    valid: bool = Field(..., description="Whether SKU is valid")
    exists: bool = Field(..., description="Whether SKU already exists")
    errors: Optional[list[str]] = Field(None, description="Validation errors")
    suggestions: Optional[list[str]] = Field(None, description="Suggested alternatives")


class SKUBulkGenerateRequest(BaseModel):
    """Request for bulk SKU generation."""
    count: int = Field(..., ge=1, le=1000, description="Number of SKUs to generate")
    brand_code: Optional[str] = Field(None, description="Brand code")
    category_code: Optional[str] = Field(None, description="Category code")
    item_names: Optional[List[str]] = Field(None, description="Item names for each SKU")


class SKUSequenceStats(BaseModel):
    """Statistics for a SKU sequence."""
    sequence_id: UUID = Field(..., description="Sequence ID")
    next_sequence: int = Field(..., description="Next sequence number")
    total_generated: int = Field(..., description="Total SKUs generated")
    last_generated_sku: Optional[str] = Field(None, description="Last generated SKU")
    last_generated_at: Optional[datetime] = Field(None, description="Last generation time")
    is_active: bool = Field(..., description="Sequence active status")
    prefix: Optional[str] = Field(None, description="Sequence prefix")
    suffix: Optional[str] = Field(None, description="Sequence suffix")
    padding_length: int = Field(..., description="Padding length")
    brand_id: Optional[UUID] = Field(None, description="Brand ID")
    category_id: Optional[UUID] = Field(None, description="Category ID")