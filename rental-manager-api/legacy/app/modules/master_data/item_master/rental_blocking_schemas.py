"""
Schemas for item rental blocking functionality.
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator
from uuid import UUID


class RentalStatusRequest(BaseModel):
    """Request to change item rental status."""
    is_rental_blocked: bool = Field(..., description="Whether to block or unblock rental")
    remarks: str = Field(..., min_length=10, max_length=1000, description="Reason for status change")
    
    @validator('remarks')
    def validate_remarks(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Remarks must be at least 10 characters long')
        return v.strip()


class RentalStatusResponse(BaseModel):
    """Response after changing item rental status."""
    item_id: UUID
    item_name: str
    is_rental_blocked: bool
    rental_block_reason: Optional[str]
    rental_blocked_at: Optional[datetime]
    rental_blocked_by: Optional[UUID]
    previous_status: Optional[bool]
    message: str
    
    class Config:
        from_attributes = True


class RentalBlockHistoryResponse(BaseModel):
    """Response for rental block history entry."""
    id: UUID
    entity_type: str
    entity_id: UUID
    item_id: UUID
    inventory_unit_id: Optional[UUID]
    is_blocked: bool
    previous_status: Optional[bool]
    remarks: str
    changed_by: UUID
    changed_at: datetime
    status_change_description: str
    entity_display_name: str
    
    # User details if loaded
    changed_by_username: Optional[str] = None
    changed_by_full_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class RentalBlockHistoryListResponse(BaseModel):
    """Response for list of rental block history entries."""
    entries: List[RentalBlockHistoryResponse]
    total: int
    skip: int
    limit: int


class BlockedItemSummary(BaseModel):
    """Summary information for blocked items."""
    item_id: UUID
    item_name: str
    sku: str
    rental_block_reason: str
    rental_blocked_at: datetime
    rental_blocked_by: UUID
    blocked_by_username: Optional[str] = None
    
    class Config:
        from_attributes = True


class BlockedItemsListResponse(BaseModel):
    """Response for list of blocked items."""
    items: List[BlockedItemSummary]
    total: int
    skip: int
    limit: int


class RentalAvailabilityResponse(BaseModel):
    """Response for checking rental availability of an item."""
    item_id: UUID
    item_name: str
    sku: str
    is_rentable: bool
    is_item_blocked: bool
    block_reason: Optional[str] = None
    total_units: int
    available_units: int
    blocked_units: int
    can_be_rented: bool
    availability_message: str
    
    class Config:
        from_attributes = True


class BulkRentalStatusRequest(BaseModel):
    """Request to change rental status for multiple items."""
    item_ids: List[UUID] = Field(..., min_items=1, max_items=100)
    is_rental_blocked: bool
    remarks: str = Field(..., min_length=10, max_length=1000)
    
    @validator('remarks')
    def validate_remarks(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Remarks must be at least 10 characters long')
        return v.strip()


class BulkRentalStatusResponse(BaseModel):
    """Response for bulk rental status change."""
    successful_changes: List[RentalStatusResponse]
    failed_changes: List[dict]  # {item_id, error_message}
    total_requested: int
    total_successful: int
    total_failed: int