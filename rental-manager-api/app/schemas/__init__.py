# schemas/__init__.py

from app.schemas.contact_person import (
    ContactPersonCreate,
    ContactPersonUpdate,
    ContactPersonResponse,
    ContactPersonNested,
    ContactPersonSearch,
    ContactPersonStats
)

__all__ = [
    "ContactPersonCreate",
    "ContactPersonUpdate", 
    "ContactPersonResponse",
    "ContactPersonNested",
    "ContactPersonSearch",
    "ContactPersonStats"
]