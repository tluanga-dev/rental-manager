"""
Rental block history models and enums.
Tracks the history of rental blocking operations for items and customers.
"""

from enum import Enum
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.sql import func

from app.db.base import RentalManagerBaseModel, UUIDType


class EntityType(str, Enum):
    """Types of entities that can be blocked from rentals."""
    ITEM = "ITEM"
    CUSTOMER = "CUSTOMER" 
    INVENTORY_UNIT = "INVENTORY_UNIT"


class RentalBlockHistory(RentalManagerBaseModel):
    """
    Model to track the history of rental blocking operations.
    Records when items, customers, or inventory units are blocked/unblocked from rentals.
    """
    __tablename__ = "rental_block_history"

    id = Column(UUIDType, primary_key=True, default=uuid4)
    entity_type = Column(String(50), nullable=False, index=True)  # EntityType enum
    entity_id = Column(UUIDType, nullable=False, index=True)
    
    # Blocking details
    is_blocked = Column(Boolean, nullable=False, default=False)
    block_reason = Column(Text, nullable=True)
    blocked_by = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    blocked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Unblocking details
    unblocked_by = Column(UUIDType, ForeignKey("users.id"), nullable=True)
    unblocked_at = Column(DateTime(timezone=True), nullable=True)
    unblock_reason = Column(Text, nullable=True)
    
    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<RentalBlockHistory(id={self.id}, entity_type={self.entity_type}, entity_id={self.entity_id}, is_blocked={self.is_blocked})>"