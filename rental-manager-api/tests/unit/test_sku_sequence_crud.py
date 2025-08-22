"""
Comprehensive CRUD tests for SKUSequence.

Tests all CRUD operations with edge cases, error conditions, and business logic validation.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.crud.inventory.sku_sequence import CRUDSKUSequence, sku_sequence
from app.models.inventory.sku_sequence import SKUSequence
from app.schemas.inventory.sku_sequence import (
    SKUSequenceCreate,
    SKUSequenceUpdate,
    SKUGenerateRequest
)


class TestCRUDSKUSequence:
    """Test suite for SKUSequence CRUD operations."""
    
    @pytest_asyncio.fixture
    async def crud_instance(self):
        """Create CRUD instance for testing."""
        return CRUDSKUSequence(SKUSequence)
    
    @pytest_asyncio.fixture
    async def sample_sequence_data(self):
        """Sample SKU sequence data for testing."""
        return {
            "brand_id": uuid4(),
            "category_id": uuid4(),
            "prefix": "TEST",
            "suffix": "END",
            "padding_length": 4,
            "format_template": "{prefix}-{sequence:0{padding}d}-{suffix}",
            "next_sequence": 1,
            "total_generated": 0,
            "is_active": True
        }
    
    @pytest_asyncio.fixture
    async def sequence_create_schema(self, sample_sequence_data):
        """Create SKUSequenceCreate schema."""
        return SKUSequenceCreate(**sample_sequence_data)
    
    # GET OR CREATE TESTS
    
    @pytest.mark.asyncio
    async def test_get_or_create_existing(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sequence_create_schema: SKUSequenceCreate
    ):
        """Test getting existing SKU sequence."""
        brand_id = uuid4()
        category_id = uuid4()
        
        # Create a sequence first
        existing_seq = SKUSequence(
            brand_id=brand_id,
            category_id=category_id,
            prefix="EXISTING",
            suffix="SEQ",
            padding_length=4,
            next_sequence=5,
            total_generated=4,
            is_active=True
        )
        db_session.add(existing_seq)
        await db_session.commit()
        await db_session.refresh(existing_seq)
        
        # Get or create should return existing
        result = await crud_instance.get_or_create(
            db_session,
            brand_id=brand_id,
            category_id=category_id,
            prefix="NEW",  # This should be ignored
            created_by=uuid4()
        )
        
        assert result.id == existing_seq.id
        assert result.prefix == "EXISTING"  # Original value preserved
        assert result.next_sequence == 5
    
    @pytest.mark.asyncio
    async def test_get_or_create_new(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test creating new SKU sequence."""
        brand_id = uuid4()
        category_id = uuid4()
        created_by = uuid4()
        
        result = await crud_instance.get_or_create(
            db_session,
            brand_id=brand_id,
            category_id=category_id,
            prefix="NEW",
            suffix="SEQ",
            padding_length=6,
            created_by=created_by
        )
        
        assert result.id is not None
        assert result.brand_id == brand_id
        assert result.category_id == category_id
        assert result.prefix == "NEW"
        assert result.suffix == "SEQ"
        assert result.padding_length == 6
        assert result.next_sequence == 1
        assert result.total_generated == 0
        assert result.is_active is True
        assert result.created_by == created_by
        assert result.updated_by == created_by
    
    @pytest.mark.asyncio
    async def test_get_or_create_with_nulls(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test creating sequence with null brand/category."""
        result = await crud_instance.get_or_create(
            db_session,
            brand_id=None,
            category_id=None,
            prefix="GENERIC",
            padding_length=5
        )
        
        assert result.brand_id is None
        assert result.category_id is None
        assert result.prefix == "GENERIC"
        assert result.padding_length == 5
    
    @pytest.mark.asyncio
    async def test_get_or_create_race_condition(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test handling race condition during creation."""
        brand_id = uuid4()
        category_id = uuid4()
        
        # Create a sequence that would be found on retry
        existing_seq = SKUSequence(
            brand_id=brand_id,
            category_id=category_id,
            prefix="RACE",
            suffix="TEST",
            padding_length=4,
            next_sequence=1,
            is_active=True
        )
        db_session.add(existing_seq)
        await db_session.commit()
        
        # Mock IntegrityError on first creation attempt
        original_add = db_session.add
        call_count = 0
        
        def mock_add(obj):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise IntegrityError("statement", "params", "unique_constraint")
            return original_add(obj)
        
        with patch.object(db_session, 'add', side_effect=mock_add), \
             patch.object(db_session, 'rollback', new_callable=AsyncMock):
            
            result = await crud_instance.get_or_create(
                db_session,
                brand_id=brand_id,
                category_id=category_id,
                prefix="RACE"
            )
        
        assert result.brand_id == brand_id
        assert result.category_id == category_id
        assert result.prefix == "RACE"
    
    # SKU GENERATION TESTS
    
    @pytest.mark.asyncio
    async def test_generate_sku_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test successful SKU generation."""
        # Create sequence
        sequence = SKUSequence(**sample_sequence_data)
        sequence.next_sequence = 42
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Mock the generate_sku method on the model
        with patch.object(sequence, 'generate_sku', return_value="TEST-0042-END") as mock_generate:
            generate_request = SKUGenerateRequest(
                brand_code="BRD",
                category_code="CAT",
                item_name="Test Item"
            )
            
            sku, seq_num = await crud_instance.generate_sku(
                db_session,
                sequence_id=sequence.id,
                generate_request=generate_request
            )
            
            mock_generate.assert_called_once_with(
                brand_code="BRD",
                category_code="CAT",
                item_name="Test Item",
                custom_data=None
            )
            
            assert sku == "TEST-0042-END"
            assert seq_num == 42  # Should return the sequence number that was used
    
    @pytest.mark.asyncio
    async def test_generate_sku_with_custom_data(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test SKU generation with custom data."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        with patch.object(sequence, 'generate_sku', return_value="CUSTOM-0001-SKU") as mock_generate:
            custom_data = {"location": "NYC", "type": "premium"}
            
            generate_request = SKUGenerateRequest(
                brand_code="BRAND",
                category_code="CATEGORY",
                custom_data=custom_data
            )
            
            sku, seq_num = await crud_instance.generate_sku(
                db_session,
                sequence_id=sequence.id,
                generate_request=generate_request
            )
            
            mock_generate.assert_called_once_with(
                brand_code="BRAND",
                category_code="CATEGORY",
                item_name=None,
                custom_data=custom_data
            )
    
    @pytest.mark.asyncio
    async def test_generate_sku_sequence_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test SKU generation with non-existent sequence."""
        generate_request = SKUGenerateRequest(
            brand_code="TEST",
            category_code="TEST"
        )
        
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.generate_sku(
                db_session,
                sequence_id=uuid4(),
                generate_request=generate_request
            )
    
    @pytest.mark.asyncio
    async def test_generate_sku_inactive_sequence(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test SKU generation with inactive sequence."""
        sample_sequence_data["is_active"] = False
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        generate_request = SKUGenerateRequest(
            brand_code="TEST",
            category_code="TEST"
        )
        
        with pytest.raises(ValueError, match="SKU sequence .* is inactive"):
            await crud_instance.generate_sku(
                db_session,
                sequence_id=sequence.id,
                generate_request=generate_request
            )
    
    @pytest.mark.asyncio
    async def test_generate_bulk_skus_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test successful bulk SKU generation."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Mock the generate_sku method to return different SKUs
        mock_skus = ["SKU-0001", "SKU-0002", "SKU-0003"]
        with patch.object(sequence, 'generate_sku', side_effect=mock_skus):
            item_names = ["Item One", "Item Two", "Item Three"]
            
            skus = await crud_instance.generate_bulk_skus(
                db_session,
                sequence_id=sequence.id,
                count=3,
                brand_code="BRAND",
                category_code="CATEGORY",
                item_names=item_names
            )
            
            assert skus == mock_skus
            assert len(skus) == 3
    
    @pytest.mark.asyncio
    async def test_generate_bulk_skus_fewer_names(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test bulk generation with fewer item names than count."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        call_args = []
        def mock_generate_sku(**kwargs):
            call_args.append(kwargs)
            return f"SKU-{len(call_args):04d}"
        
        with patch.object(sequence, 'generate_sku', side_effect=mock_generate_sku):
            item_names = ["Item One", "Item Two"]  # Only 2 names for 5 SKUs
            
            skus = await crud_instance.generate_bulk_skus(
                db_session,
                sequence_id=sequence.id,
                count=5,
                brand_code="BRAND",
                category_code="CATEGORY",
                item_names=item_names
            )
            
            assert len(skus) == 5
            assert len(call_args) == 5
            
            # First two should have item names
            assert call_args[0]["item_name"] == "Item One"
            assert call_args[1]["item_name"] == "Item Two"
            
            # Last three should have None
            assert call_args[2]["item_name"] is None
            assert call_args[3]["item_name"] is None
            assert call_args[4]["item_name"] is None
    
    @pytest.mark.asyncio
    async def test_generate_bulk_skus_inactive_sequence(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test bulk generation with inactive sequence."""
        sample_sequence_data["is_active"] = False
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        with pytest.raises(ValueError, match="SKU sequence .* is inactive"):
            await crud_instance.generate_bulk_skus(
                db_session,
                sequence_id=sequence.id,
                count=3
            )
    
    # RETRIEVAL TESTS
    
    @pytest.mark.asyncio
    async def test_get_by_brand_category(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting sequence by brand and category."""
        brand_id = uuid4()
        category_id = uuid4()
        
        sample_sequence_data["brand_id"] = brand_id
        sample_sequence_data["category_id"] = category_id
        
        sequence = SKUSequence(**sample_sequence_data)
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        result = await crud_instance.get_by_brand_category(
            db_session,
            brand_id=brand_id,
            category_id=category_id
        )
        
        assert result is not None
        assert result.id == sequence.id
        assert result.brand_id == brand_id
        assert result.category_id == category_id
    
    @pytest.mark.asyncio
    async def test_get_by_brand_category_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test getting non-existent sequence."""
        result = await crud_instance.get_by_brand_category(
            db_session,
            brand_id=uuid4(),
            category_id=uuid4()
        )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_by_brand_category_with_nulls(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting sequence with null brand/category."""
        sample_sequence_data["brand_id"] = None
        sample_sequence_data["category_id"] = None
        
        sequence = SKUSequence(**sample_sequence_data)
        db_session.add(sequence)
        await db_session.commit()
        
        result = await crud_instance.get_by_brand_category(
            db_session,
            brand_id=None,
            category_id=None
        )
        
        assert result is not None
        assert result.brand_id is None
        assert result.category_id is None
    
    @pytest.mark.asyncio
    async def test_get_active_sequences(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting active sequences."""
        # Create multiple sequences with different active states
        sequences_data = [
            {**sample_sequence_data, "prefix": "ACTIVE1", "is_active": True},
            {**sample_sequence_data, "prefix": "ACTIVE2", "is_active": True},
            {**sample_sequence_data, "prefix": "INACTIVE", "is_active": False},
            {**sample_sequence_data, "prefix": "ACTIVE3", "is_active": True}
        ]
        
        for i, data in enumerate(sequences_data):
            data["brand_id"] = uuid4()  # Make each unique
            data["category_id"] = uuid4()
            sequence = SKUSequence(**data)
            db_session.add(sequence)
        
        await db_session.commit()
        
        # Get active sequences
        active_sequences = await crud_instance.get_active_sequences(db_session)
        
        assert len(active_sequences) == 3  # Only active ones
        assert all(seq.is_active for seq in active_sequences)
        
        # Check prefixes
        prefixes = {seq.prefix for seq in active_sequences}
        assert prefixes == {"ACTIVE1", "ACTIVE2", "ACTIVE3"}
    
    @pytest.mark.asyncio
    async def test_get_active_sequences_with_pagination(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test pagination in get_active_sequences."""
        # Create 5 active sequences
        for i in range(5):
            data = sample_sequence_data.copy()
            data["prefix"] = f"ACTIVE{i}"
            data["brand_id"] = uuid4()
            data["category_id"] = uuid4()
            data["is_active"] = True
            
            sequence = SKUSequence(**data)
            db_session.add(sequence)
        
        await db_session.commit()
        
        # Test pagination
        page1 = await crud_instance.get_active_sequences(
            db_session,
            skip=0,
            limit=2
        )
        
        page2 = await crud_instance.get_active_sequences(
            db_session,
            skip=2,
            limit=2
        )
        
        assert len(page1) == 2
        assert len(page2) == 2
        
        # Ensure different results
        page1_ids = {seq.id for seq in page1}
        page2_ids = {seq.id for seq in page2}
        assert len(page1_ids & page2_ids) == 0
    
    @pytest.mark.asyncio
    async def test_get_sequences_by_brand(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting sequences by brand."""
        brand_id = uuid4()
        other_brand_id = uuid4()
        
        # Create sequences for target brand
        for i in range(3):
            data = sample_sequence_data.copy()
            data["brand_id"] = brand_id
            data["category_id"] = uuid4()  # Different categories
            data["prefix"] = f"BRAND{i}"
            
            sequence = SKUSequence(**data)
            db_session.add(sequence)
        
        # Create sequence for different brand
        other_data = sample_sequence_data.copy()
        other_data["brand_id"] = other_brand_id
        other_data["category_id"] = uuid4()
        other_data["prefix"] = "OTHER"
        
        other_sequence = SKUSequence(**other_data)
        db_session.add(other_sequence)
        
        await db_session.commit()
        
        # Get sequences for target brand
        brand_sequences = await crud_instance.get_sequences_by_brand(
            db_session,
            brand_id=brand_id
        )
        
        assert len(brand_sequences) == 3
        assert all(seq.brand_id == brand_id for seq in brand_sequences)
        
        prefixes = {seq.prefix for seq in brand_sequences}
        assert prefixes == {"BRAND0", "BRAND1", "BRAND2"}
    
    @pytest.mark.asyncio
    async def test_get_sequences_by_category(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting sequences by category."""
        category_id = uuid4()
        other_category_id = uuid4()
        
        # Create sequences for target category
        for i in range(2):
            data = sample_sequence_data.copy()
            data["brand_id"] = uuid4()  # Different brands
            data["category_id"] = category_id
            data["prefix"] = f"CAT{i}"
            
            sequence = SKUSequence(**data)
            db_session.add(sequence)
        
        # Create sequence for different category
        other_data = sample_sequence_data.copy()
        other_data["brand_id"] = uuid4()
        other_data["category_id"] = other_category_id
        other_data["prefix"] = "OTHER"
        
        other_sequence = SKUSequence(**other_data)
        db_session.add(other_sequence)
        
        await db_session.commit()
        
        # Get sequences for target category
        category_sequences = await crud_instance.get_sequences_by_category(
            db_session,
            category_id=category_id
        )
        
        assert len(category_sequences) == 2
        assert all(seq.category_id == category_id for seq in category_sequences)
        
        prefixes = {seq.prefix for seq in category_sequences}
        assert prefixes == {"CAT0", "CAT1"}
    
    # SEQUENCE MANAGEMENT TESTS
    
    @pytest.mark.asyncio
    async def test_reset_sequence_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test successful sequence reset."""
        sequence = SKUSequence(**sample_sequence_data)
        sequence.next_sequence = 100
        sequence.total_generated = 99
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        updated_by = uuid4()
        
        with patch.object(sequence, 'reset_sequence') as mock_reset:
            result = await crud_instance.reset_sequence(
                db_session,
                sequence_id=sequence.id,
                new_value=50,
                updated_by=updated_by
            )
            
            mock_reset.assert_called_once_with(50)
            assert result.updated_by == updated_by
    
    @pytest.mark.asyncio
    async def test_reset_sequence_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test resetting non-existent sequence."""
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.reset_sequence(
                db_session,
                sequence_id=uuid4(),
                new_value=1
            )
    
    @pytest.mark.asyncio
    async def test_activate_sequence(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test sequence activation."""
        sample_sequence_data["is_active"] = False
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        updated_by = uuid4()
        
        result = await crud_instance.activate_sequence(
            db_session,
            sequence_id=sequence.id,
            updated_by=updated_by
        )
        
        assert result.is_active is True
        assert result.updated_by == updated_by
        assert result.version == sequence.version + 1
    
    @pytest.mark.asyncio
    async def test_deactivate_sequence(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test sequence deactivation."""
        sample_sequence_data["is_active"] = True
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        updated_by = uuid4()
        
        result = await crud_instance.deactivate_sequence(
            db_session,
            sequence_id=sequence.id,
            updated_by=updated_by
        )
        
        assert result.is_active is False
        assert result.updated_by == updated_by
        assert result.version == sequence.version + 1
    
    @pytest.mark.asyncio
    async def test_activate_sequence_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test activating non-existent sequence."""
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.activate_sequence(
                db_session,
                sequence_id=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_deactivate_sequence_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test deactivating non-existent sequence."""
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.deactivate_sequence(
                db_session,
                sequence_id=uuid4()
            )
    
    # FORMAT TEMPLATE TESTS
    
    @pytest.mark.asyncio
    async def test_update_format_template_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test successful format template update."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        new_template = "{brand}-{category}-{sequence:05d}"
        updated_by = uuid4()
        
        result = await crud_instance.update_format_template(
            db_session,
            sequence_id=sequence.id,
            format_template=new_template,
            updated_by=updated_by
        )
        
        assert result.format_template == new_template
        assert result.updated_by == updated_by
        assert result.version == sequence.version + 1
    
    @pytest.mark.asyncio
    async def test_update_format_template_validation_error(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test format template update with invalid template."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Template with invalid key
        invalid_template = "{invalid_key}-{sequence:04d}"
        
        with pytest.raises(ValueError, match="Invalid format template: missing key"):
            await crud_instance.update_format_template(
                db_session,
                sequence_id=sequence.id,
                format_template=invalid_template
            )
    
    @pytest.mark.asyncio
    async def test_update_format_template_syntax_error(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test format template update with syntax error."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Template with syntax error
        invalid_template = "{prefix-{sequence:04d}"  # Missing closing brace
        
        with pytest.raises(ValueError, match="Invalid format template"):
            await crud_instance.update_format_template(
                db_session,
                sequence_id=sequence.id,
                format_template=invalid_template
            )
    
    @pytest.mark.asyncio
    async def test_update_format_template_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test updating template for non-existent sequence."""
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.update_format_template(
                db_session,
                sequence_id=uuid4(),
                format_template="{prefix}-{sequence:04d}"
            )
    
    # STATISTICS TESTS
    
    @pytest.mark.asyncio
    async def test_get_statistics_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test getting sequence statistics."""
        brand_id = uuid4()
        category_id = uuid4()
        last_generated_at = datetime.utcnow()
        
        sample_sequence_data.update({
            "brand_id": brand_id,
            "category_id": category_id,
            "next_sequence": 42,
            "total_generated": 41,
            "last_generated_sku": "TEST-0041-END",
            "last_generated_at": last_generated_at
        })
        
        sequence = SKUSequence(**sample_sequence_data)
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        stats = await crud_instance.get_statistics(
            db_session,
            sequence_id=sequence.id
        )
        
        assert stats["sequence_id"] == sequence.id
        assert stats["next_sequence"] == 42
        assert stats["total_generated"] == 41
        assert stats["last_generated_sku"] == "TEST-0041-END"
        assert stats["last_generated_at"] == last_generated_at
        assert stats["is_active"] is True
        assert stats["prefix"] == "TEST"
        assert stats["suffix"] == "END"
        assert stats["padding_length"] == 4
        assert stats["brand_id"] == brand_id
        assert stats["category_id"] == category_id
    
    @pytest.mark.asyncio
    async def test_get_statistics_not_found(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test getting statistics for non-existent sequence."""
        with pytest.raises(ValueError, match="SKU sequence .* not found"):
            await crud_instance.get_statistics(
                db_session,
                sequence_id=uuid4()
            )
    
    # SKU UNIQUENESS VALIDATION
    
    @pytest.mark.asyncio
    async def test_validate_sku_uniqueness_unique(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test SKU uniqueness validation - unique SKU."""
        sku = "UNIQUE-SKU-001"
        
        # Mock the query to return 0 (no matches)
        with patch('app.crud.inventory.sku_sequence.select') as mock_select, \
             patch('app.crud.inventory.sku_sequence.func') as mock_func:
            
            mock_result = AsyncMock()
            mock_result.scalar.return_value = 0
            
            with patch.object(db_session, 'execute', return_value=mock_result):
                is_unique = await crud_instance.validate_sku_uniqueness(
                    db_session,
                    sku=sku
                )
                
                assert is_unique is True
    
    @pytest.mark.asyncio
    async def test_validate_sku_uniqueness_not_unique(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test SKU uniqueness validation - duplicate SKU."""
        sku = "DUPLICATE-SKU-001"
        
        # Mock the query to return 1 (one match)
        with patch('app.crud.inventory.sku_sequence.select') as mock_select, \
             patch('app.crud.inventory.sku_sequence.func') as mock_func:
            
            mock_result = AsyncMock()
            mock_result.scalar.return_value = 1
            
            with patch.object(db_session, 'execute', return_value=mock_result):
                is_unique = await crud_instance.validate_sku_uniqueness(
                    db_session,
                    sku=sku
                )
                
                assert is_unique is False
    
    @pytest.mark.asyncio
    async def test_validate_sku_uniqueness_multiple_matches(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence
    ):
        """Test SKU uniqueness validation - multiple matches."""
        sku = "MULTI-MATCH-SKU"
        
        # Mock the query to return 3 (multiple matches)
        with patch('app.crud.inventory.sku_sequence.select') as mock_select, \
             patch('app.crud.inventory.sku_sequence.func') as mock_func:
            
            mock_result = AsyncMock()
            mock_result.scalar.return_value = 3
            
            with patch.object(db_session, 'execute', return_value=mock_result):
                is_unique = await crud_instance.validate_sku_uniqueness(
                    db_session,
                    sku=sku
                )
                
                assert is_unique is False
    
    # CONCURRENCY AND LOCKING TESTS
    
    @pytest.mark.asyncio
    async def test_generate_sku_with_locking(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test that SKU generation uses proper locking."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Mock the select to verify with_for_update is called
        with patch('app.crud.inventory.sku_sequence.select') as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query
            mock_query.with_for_update.return_value = mock_query
            
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = sequence
            
            with patch.object(db_session, 'execute', return_value=mock_result), \
                 patch.object(sequence, 'generate_sku', return_value="LOCKED-SKU"):
                
                generate_request = SKUGenerateRequest(
                    brand_code="BRAND",
                    category_code="CATEGORY"
                )
                
                await crud_instance.generate_sku(
                    db_session,
                    sequence_id=sequence.id,
                    generate_request=generate_request
                )
                
                # Verify that with_for_update was called
                mock_query.with_for_update.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_bulk_generation_with_locking(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDSKUSequence,
        sample_sequence_data
    ):
        """Test that bulk generation uses proper locking."""
        sequence = SKUSequence(**sample_sequence_data)
        
        db_session.add(sequence)
        await db_session.commit()
        await db_session.refresh(sequence)
        
        # Mock the select to verify with_for_update is called
        with patch('app.crud.inventory.sku_sequence.select') as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query
            mock_query.with_for_update.return_value = mock_query
            
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = sequence
            
            with patch.object(db_session, 'execute', return_value=mock_result), \
                 patch.object(sequence, 'generate_sku', return_value="BULK-SKU"):
                
                await crud_instance.generate_bulk_skus(
                    db_session,
                    sequence_id=sequence.id,
                    count=3
                )
                
                # Verify that with_for_update was called
                mock_query.with_for_update.assert_called_once()


class TestSKUSequenceSingleton:
    """Test the singleton instance."""
    
    def test_singleton_instance(self):
        """Test that the singleton instance is properly configured."""
        assert sku_sequence is not None
        assert isinstance(sku_sequence, CRUDSKUSequence)
        assert sku_sequence.model == SKUSequence