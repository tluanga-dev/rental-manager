"""
CRUD operations for SKU Sequence.

Handles database operations for SKU generation and management.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.crud.inventory.base import CRUDBase
from app.models.inventory.sku_sequence import SKUSequence
from app.schemas.inventory.sku_sequence import (
    SKUSequenceCreate,
    SKUSequenceUpdate,
    SKUGenerateRequest
)


class CRUDSKUSequence(CRUDBase[SKUSequence, SKUSequenceCreate, SKUSequenceUpdate]):
    """CRUD operations for SKU sequences."""
    
    async def get_or_create(
        self,
        db: AsyncSession,
        *,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        prefix: Optional[str] = None,
        suffix: Optional[str] = None,
        padding_length: int = 4,
        created_by: Optional[UUID] = None
    ) -> SKUSequence:
        """
        Get existing sequence or create new one.
        
        Args:
            db: Database session
            brand_id: Brand ID
            category_id: Category ID
            prefix: SKU prefix
            suffix: SKU suffix
            padding_length: Padding for sequence numbers
            created_by: User creating the sequence
            
        Returns:
            SKU sequence instance
        """
        # Try to get existing
        query = select(SKUSequence).where(
            and_(
                SKUSequence.brand_id == brand_id,
                SKUSequence.category_id == category_id
            )
        )
        
        result = await db.execute(query)
        sequence = result.scalar_one_or_none()
        
        if sequence:
            return sequence
        
        # Create new
        try:
            sequence = SKUSequence(
                brand_id=brand_id,
                category_id=category_id,
                prefix=prefix,
                suffix=suffix,
                padding_length=padding_length,
                next_sequence=1
            )
            
            if created_by:
                sequence.created_by = created_by
                sequence.updated_by = created_by
            
            db.add(sequence)
            await db.flush()
            await db.refresh(sequence)
            
            return sequence
            
        except IntegrityError:
            # Race condition - another process created it
            await db.rollback()
            result = await db.execute(query)
            return result.scalar_one()
    
    async def generate_sku(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        generate_request: SKUGenerateRequest
    ) -> Tuple[str, int]:
        """
        Generate a SKU using a sequence.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            generate_request: Generation parameters
            
        Returns:
            Tuple of (generated SKU, sequence number used)
        """
        # Get sequence with lock to prevent concurrent generation issues
        query = (
            select(SKUSequence)
            .where(SKUSequence.id == sequence_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        sequence = result.scalar_one_or_none()
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        if not sequence.is_active:
            raise ValueError(f"SKU sequence {sequence_id} is inactive")
        
        # Generate SKU
        sku = sequence.generate_sku(
            brand_code=generate_request.brand_code,
            category_code=generate_request.category_code,
            item_name=generate_request.item_name,
            custom_data=generate_request.custom_data
        )
        
        # Sequence is already incremented by generate_sku
        sequence_number = sequence.next_sequence - 1
        
        await db.flush()
        
        return sku, sequence_number
    
    async def generate_bulk_skus(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        count: int,
        brand_code: Optional[str] = None,
        category_code: Optional[str] = None,
        item_names: Optional[List[str]] = None
    ) -> List[str]:
        """
        Generate multiple SKUs in bulk.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            count: Number of SKUs to generate
            brand_code: Brand code
            category_code: Category code
            item_names: Optional item names for each SKU
            
        Returns:
            List of generated SKUs
        """
        # Get sequence with lock
        query = (
            select(SKUSequence)
            .where(SKUSequence.id == sequence_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        sequence = result.scalar_one_or_none()
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        if not sequence.is_active:
            raise ValueError(f"SKU sequence {sequence_id} is inactive")
        
        # Generate SKUs
        skus = []
        for i in range(count):
            item_name = item_names[i] if item_names and i < len(item_names) else None
            
            sku = sequence.generate_sku(
                brand_code=brand_code,
                category_code=category_code,
                item_name=item_name
            )
            
            skus.append(sku)
        
        await db.flush()
        
        return skus
    
    async def get_by_brand_category(
        self,
        db: AsyncSession,
        *,
        brand_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None
    ) -> Optional[SKUSequence]:
        """
        Get sequence for brand/category combination.
        
        Args:
            db: Database session
            brand_id: Brand ID
            category_id: Category ID
            
        Returns:
            SKU sequence or None
        """
        query = select(SKUSequence).where(
            and_(
                SKUSequence.brand_id == brand_id,
                SKUSequence.category_id == category_id
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def reset_sequence(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        new_value: int = 1,
        updated_by: Optional[UUID] = None
    ) -> SKUSequence:
        """
        Reset a sequence to a specific value.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            new_value: New starting value
            updated_by: User resetting the sequence
            
        Returns:
            Updated sequence
        """
        sequence = await self.get(db, id=sequence_id)
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        sequence.reset_sequence(new_value)
        
        if updated_by:
            sequence.updated_by = updated_by
        
        await db.flush()
        await db.refresh(sequence)
        
        return sequence
    
    async def activate_sequence(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        updated_by: Optional[UUID] = None
    ) -> SKUSequence:
        """
        Activate a sequence.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            updated_by: User activating the sequence
            
        Returns:
            Updated sequence
        """
        sequence = await self.get(db, id=sequence_id)
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        sequence.is_active = True
        
        if updated_by:
            sequence.updated_by = updated_by
        
        sequence.version += 1
        
        await db.flush()
        await db.refresh(sequence)
        
        return sequence
    
    async def deactivate_sequence(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        updated_by: Optional[UUID] = None
    ) -> SKUSequence:
        """
        Deactivate a sequence.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            updated_by: User deactivating the sequence
            
        Returns:
            Updated sequence
        """
        sequence = await self.get(db, id=sequence_id)
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        sequence.is_active = False
        
        if updated_by:
            sequence.updated_by = updated_by
        
        sequence.version += 1
        
        await db.flush()
        await db.refresh(sequence)
        
        return sequence
    
    async def get_active_sequences(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[SKUSequence]:
        """
        Get all active sequences.
        
        Args:
            db: Database session
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of active sequences
        """
        query = (
            select(SKUSequence)
            .where(SKUSequence.is_active == True)
            .options(
                selectinload(SKUSequence.brand),
                selectinload(SKUSequence.category)
            )
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_sequences_by_brand(
        self,
        db: AsyncSession,
        *,
        brand_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[SKUSequence]:
        """
        Get all sequences for a brand.
        
        Args:
            db: Database session
            brand_id: Brand ID
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of sequences
        """
        query = (
            select(SKUSequence)
            .where(SKUSequence.brand_id == brand_id)
            .options(selectinload(SKUSequence.category))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_sequences_by_category(
        self,
        db: AsyncSession,
        *,
        category_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[SKUSequence]:
        """
        Get all sequences for a category.
        
        Args:
            db: Database session
            category_id: Category ID
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of sequences
        """
        query = (
            select(SKUSequence)
            .where(SKUSequence.category_id == category_id)
            .options(selectinload(SKUSequence.brand))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def update_format_template(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID,
        format_template: str,
        updated_by: Optional[UUID] = None
    ) -> SKUSequence:
        """
        Update the format template for a sequence.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            format_template: New format template
            updated_by: User updating the template
            
        Returns:
            Updated sequence
        """
        sequence = await self.get(db, id=sequence_id)
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        # Validate template
        try:
            test_data = {
                'prefix': 'TEST',
                'suffix': 'END',
                'sequence': 1,
                'brand': 'BRD',
                'category': 'CAT',
                'item': 'ITM',
                'year': 2024,
                'month': 1,
                'day': 1
            }
            format_template.format(**test_data)
        except KeyError as e:
            raise ValueError(f"Invalid format template: missing key {e}")
        except Exception as e:
            raise ValueError(f"Invalid format template: {e}")
        
        sequence.format_template = format_template
        
        if updated_by:
            sequence.updated_by = updated_by
        
        sequence.version += 1
        
        await db.flush()
        await db.refresh(sequence)
        
        return sequence
    
    async def get_statistics(
        self,
        db: AsyncSession,
        *,
        sequence_id: UUID
    ) -> Dict[str, Any]:
        """
        Get statistics for a sequence.
        
        Args:
            db: Database session
            sequence_id: Sequence ID
            
        Returns:
            Statistics dictionary
        """
        sequence = await self.get(db, id=sequence_id)
        
        if not sequence:
            raise ValueError(f"SKU sequence {sequence_id} not found")
        
        return {
            'sequence_id': sequence.id,
            'next_sequence': sequence.next_sequence,
            'total_generated': sequence.total_generated,
            'last_generated_sku': sequence.last_generated_sku,
            'last_generated_at': sequence.last_generated_at,
            'is_active': sequence.is_active,
            'prefix': sequence.prefix,
            'suffix': sequence.suffix,
            'padding_length': sequence.padding_length,
            'brand_id': sequence.brand_id,
            'category_id': sequence.category_id
        }
    
    async def validate_sku_uniqueness(
        self,
        db: AsyncSession,
        *,
        sku: str
    ) -> bool:
        """
        Check if a SKU is unique across inventory units.
        
        Args:
            db: Database session
            sku: SKU to validate
            
        Returns:
            True if unique, False otherwise
        """
        from app.models.inventory.inventory_unit import InventoryUnit
        
        query = select(func.count()).where(InventoryUnit.sku == sku)
        result = await db.execute(query)
        count = result.scalar()
        
        return count == 0


# Create singleton instance
sku_sequence = CRUDSKUSequence(SKUSequence)