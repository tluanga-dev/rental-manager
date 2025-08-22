"""
Transaction event schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


class TransactionEventCreate(BaseModel):
    """Schema for creating a transaction event."""
    
    transaction_id: UUID
    event_type: str = Field(..., min_length=1, max_length=100)
    event_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=1000)
    triggered_by: Optional[UUID] = None


class TransactionEventUpdate(BaseModel):
    """Schema for updating a transaction event."""
    
    event_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=1000)


class TransactionEventResponse(BaseModel):
    """Response schema for transaction events."""
    
    id: UUID
    transaction_id: UUID
    event_type: str
    event_timestamp: datetime
    event_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    triggered_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TransactionEventFilter(BaseModel):
    """Filter schema for transaction event queries."""
    
    transaction_id: Optional[UUID] = None
    event_type: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    triggered_by: Optional[UUID] = None