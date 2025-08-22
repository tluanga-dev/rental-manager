"""
Transaction Metadata CRUD operations.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import TransactionMetadata


class TransactionMetadataRepository:
    """Repository for Transaction Metadata operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        transaction_id: UUID,
        metadata_type: str,
        metadata_content: Dict[str, Any]
    ) -> TransactionMetadata:
        """Create new metadata entry."""
        metadata = TransactionMetadata(
            transaction_id=transaction_id,
            metadata_type=metadata_type,
            metadata_content=metadata_content
        )
        self.session.add(metadata)
        await self.session.flush()
        return metadata
    
    async def get_by_id(
        self,
        metadata_id: UUID
    ) -> Optional[TransactionMetadata]:
        """Get metadata by ID."""
        query = select(TransactionMetadata).where(
            TransactionMetadata.id == metadata_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_transaction_id(
        self,
        transaction_id: UUID,
        metadata_type: Optional[str] = None
    ) -> List[TransactionMetadata]:
        """Get metadata for a transaction."""
        query = select(TransactionMetadata).where(
            TransactionMetadata.transaction_id == transaction_id
        )
        
        if metadata_type:
            query = query.where(TransactionMetadata.metadata_type == metadata_type)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_single_by_type(
        self,
        transaction_id: UUID,
        metadata_type: str
    ) -> Optional[TransactionMetadata]:
        """Get single metadata entry by type."""
        query = select(TransactionMetadata).where(
            TransactionMetadata.transaction_id == transaction_id,
            TransactionMetadata.metadata_type == metadata_type
        ).limit(1)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def update(
        self,
        metadata_id: UUID,
        metadata_content: Dict[str, Any]
    ) -> Optional[TransactionMetadata]:
        """Update metadata content."""
        query = update(TransactionMetadata).where(
            TransactionMetadata.id == metadata_id
        ).values(metadata_content=metadata_content)
        
        await self.session.execute(query)
        await self.session.flush()
        
        return await self.get_by_id(metadata_id)
    
    async def update_or_create(
        self,
        transaction_id: UUID,
        metadata_type: str,
        metadata_content: Dict[str, Any]
    ) -> TransactionMetadata:
        """Update existing metadata or create new."""
        existing = await self.get_single_by_type(transaction_id, metadata_type)
        
        if existing:
            existing.metadata_content = metadata_content
            await self.session.flush()
            return existing
        else:
            return await self.create(transaction_id, metadata_type, metadata_content)
    
    async def add_value(
        self,
        metadata_id: UUID,
        key: str,
        value: Any
    ) -> Optional[TransactionMetadata]:
        """Add or update a single value in metadata."""
        metadata = await self.get_by_id(metadata_id)
        if not metadata:
            return None
        
        metadata.set_value(key, value)
        await self.session.flush()
        return metadata
    
    async def update_values(
        self,
        metadata_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[TransactionMetadata]:
        """Update multiple values in metadata."""
        metadata = await self.get_by_id(metadata_id)
        if not metadata:
            return None
        
        metadata.update_values(updates)
        await self.session.flush()
        return metadata
    
    async def delete(
        self,
        metadata_id: UUID
    ) -> bool:
        """Delete metadata entry."""
        query = delete(TransactionMetadata).where(
            TransactionMetadata.id == metadata_id
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount > 0
    
    async def delete_by_transaction(
        self,
        transaction_id: UUID,
        metadata_type: Optional[str] = None
    ) -> int:
        """Delete all metadata for a transaction."""
        query = delete(TransactionMetadata).where(
            TransactionMetadata.transaction_id == transaction_id
        )
        
        if metadata_type:
            query = query.where(TransactionMetadata.metadata_type == metadata_type)
        
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount
    
    async def search_by_content(
        self,
        key: str,
        value: Any,
        metadata_type: Optional[str] = None
    ) -> List[TransactionMetadata]:
        """Search metadata by content key-value."""
        # Using PostgreSQL JSONB containment operator
        query = select(TransactionMetadata).where(
            TransactionMetadata.metadata_content.contains({key: value})
        )
        
        if metadata_type:
            query = query.where(TransactionMetadata.metadata_type == metadata_type)
        
        result = await self.session.execute(query)
        return result.scalars().all()