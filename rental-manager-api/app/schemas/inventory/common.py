"""
Common schemas used across inventory modules.

Contains shared schemas like pagination, filters, etc.
"""

from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, Field

# Generic type for paginated responses
T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""
    items: List[T] = Field(..., description="Items in current page")
    total: int = Field(..., description="Total number of items")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")
    page: Optional[int] = Field(None, description="Current page number")
    total_pages: Optional[int] = Field(None, description="Total number of pages")
    
    def __init__(self, **data):
        super().__init__(**data)
        if self.limit > 0:
            self.page = (self.skip // self.limit) + 1
            self.total_pages = (self.total + self.limit - 1) // self.limit


class BulkOperationResult(BaseModel):
    """Result of bulk operations."""
    success_count: int = Field(..., description="Number of successful operations")
    error_count: int = Field(..., description="Number of failed operations")
    total_count: int = Field(..., description="Total number of operations")
    errors: List[str] = Field(default_factory=list, description="Error messages")
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_count == 0:
            return 0.0
        return (self.success_count / self.total_count) * 100


class OperationResponse(BaseModel):
    """Generic operation response."""
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Operation message")
    data: Optional[dict] = Field(None, description="Optional response data")
    errors: Optional[List[str]] = Field(None, description="Error messages if any")