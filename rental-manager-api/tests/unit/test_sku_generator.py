"""
Comprehensive unit tests for SKU Generator
Target: 100% coverage for SKU generation functionality
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.services.sku_generator import SKUGenerator
from app.core.exceptions import ValidationError, ConflictError


@pytest.mark.unit
@pytest.mark.asyncio
class TestSKUGenerator:
    """Test SKU Generator functionality."""
    
    async def test_generate_default_sku(self, sku_generator):
        """Test default SKU generation without category."""
        sku = await sku_generator.generate_sku()
        
        assert sku is not None
        assert isinstance(sku, str)
        assert len(sku) > 0
        assert sku.startswith("ITEM-")
    
    async def test_generate_sku_with_custom_pattern(self, sku_generator):
        """Test SKU generation with custom pattern."""
        pattern = "CUSTOM-{counter:04d}"
        sku = await sku_generator.generate_sku(pattern=pattern)
        
        assert sku.startswith("CUSTOM-")
        assert len(sku.split("-")[1]) == 4  # 4-digit counter
    
    async def test_generate_sku_with_prefix(self, sku_generator):
        """Test SKU generation with custom prefix."""
        prefix = "SPECIAL"
        sku = await sku_generator.generate_sku(prefix=prefix)
        
        assert sku.startswith(prefix)
    
    @patch('app.services.sku_generator.SKUGenerator._get_next_counter')
    async def test_generate_sku_counter_increment(self, mock_counter, sku_generator):
        """Test that counter increments correctly."""
        mock_counter.return_value = 42
        
        sku = await sku_generator.generate_sku(pattern="TEST-{counter:03d}")
        
        assert "042" in sku
        mock_counter.assert_called_once()
    
    async def test_generate_category_based_sku(self, sku_generator, test_category):
        """Test category-based SKU generation."""
        with patch.object(sku_generator, '_get_category_code', return_value="CAT"):
            sku = await sku_generator.generate_sku(category_id=test_category.id)
            
            assert "CAT" in sku
    
    async def test_generate_sku_with_timestamp(self, sku_generator):
        """Test SKU generation with timestamp pattern."""
        pattern = "ITEM-{timestamp}-{counter:03d}"
        sku = await sku_generator.generate_sku(pattern=pattern)
        
        # Should contain timestamp
        parts = sku.split("-")
        assert len(parts) >= 3
        assert parts[1].isdigit()  # Timestamp part should be numeric
    
    async def test_generate_sku_collision_handling(self, sku_generator):
        """Test SKU collision detection and resolution."""
        # Mock a collision scenario
        with patch.object(sku_generator, '_sku_exists') as mock_exists:
            mock_exists.side_effect = [True, True, False]  # First two exist, third doesn't
            
            sku = await sku_generator.generate_sku()
            
            # Should have called exists check 3 times
            assert mock_exists.call_count == 3
    
    async def test_generate_sku_max_retries_exceeded(self, sku_generator):
        """Test behavior when max retries for collision resolution is exceeded."""
        with patch.object(sku_generator, '_sku_exists', return_value=True):
            with pytest.raises(ConflictError, match="Unable to generate unique SKU"):
                await sku_generator.generate_sku()
    
    async def test_validate_sku_pattern_valid(self, sku_generator):
        """Test validation of valid SKU patterns."""
        valid_patterns = [
            "ITEM-{counter:05d}",
            "{category_code}-{counter:04d}",
            "PREFIX-{timestamp}-{counter:03d}",
            "{counter:06d}",
            "SIMPLE-PATTERN"
        ]
        
        for pattern in valid_patterns:
            # Should not raise exception
            sku_generator._validate_pattern(pattern)
    
    def test_validate_sku_pattern_invalid(self, sku_generator):
        """Test validation of invalid SKU patterns."""
        invalid_patterns = [
            "{invalid_field}",
            "ITEM-{counter}",  # Missing format specifier
            "{counter:abc}",   # Invalid format
            "",                # Empty pattern
            "TOOLONG" * 20     # Too long
        ]
        
        for pattern in invalid_patterns:
            with pytest.raises(ValidationError):
                sku_generator._validate_pattern(pattern)
    
    def test_format_counter_padding(self, sku_generator):
        """Test counter formatting with different padding."""
        assert sku_generator._format_counter(42, 5) == "00042"
        assert sku_generator._format_counter(123, 3) == "123"
        assert sku_generator._format_counter(1, 2) == "01"
    
    def test_format_counter_overflow(self, sku_generator):
        """Test counter formatting when number exceeds padding."""
        # Should still work, just longer than expected
        assert sku_generator._format_counter(12345, 3) == "12345"
    
    async def test_get_category_code(self, sku_generator, test_category):
        """Test category code extraction."""
        with patch.object(sku_generator.session, 'get', return_value=test_category):
            code = await sku_generator._get_category_code(test_category.id)
            assert code == test_category.category_code
    
    async def test_get_category_code_not_found(self, sku_generator):
        """Test category code extraction when category not found."""
        with patch.object(sku_generator.session, 'get', return_value=None):
            code = await sku_generator._get_category_code(uuid4())
            assert code == "UNK"  # Unknown category code
    
    @patch('app.services.sku_generator.SKUGenerator._execute_query')
    async def test_get_next_counter(self, mock_execute, sku_generator):
        """Test counter retrieval and increment."""
        mock_execute.return_value = 5
        
        counter = await sku_generator._get_next_counter("TEST_PATTERN")
        
        assert counter == 6  # Should increment by 1
    
    @patch('app.services.sku_generator.SKUGenerator._execute_query')
    async def test_get_next_counter_first_time(self, mock_execute, sku_generator):
        """Test counter when pattern is used for first time."""
        mock_execute.return_value = 0  # No existing counter
        
        counter = await sku_generator._get_next_counter("NEW_PATTERN")
        
        assert counter == 1  # Should start at 1
    
    async def test_sku_exists_true(self, sku_generator):
        """Test SKU existence check - exists."""
        with patch.object(sku_generator, '_execute_query', return_value=1):
            exists = await sku_generator._sku_exists("TEST-001")
            assert exists is True
    
    async def test_sku_exists_false(self, sku_generator):
        """Test SKU existence check - doesn't exist."""
        with patch.object(sku_generator, '_execute_query', return_value=0):
            exists = await sku_generator._sku_exists("TEST-001")
            assert exists is False
    
    def test_generate_timestamp(self, sku_generator):
        """Test timestamp generation for SKUs."""
        timestamp = sku_generator._generate_timestamp()
        
        assert isinstance(timestamp, str)
        assert len(timestamp) == 8  # YYYYMMDD format
        assert timestamp.isdigit()
    
    def test_sanitize_pattern(self, sku_generator):
        """Test pattern sanitization."""
        patterns = {
            "ITEM-{counter:05d}": "ITEM-{counter:05d}",
            "item-{COUNTER:05d}": "ITEM-{counter:05d}",  # Should uppercase
            "  ITEM-{counter:05d}  ": "ITEM-{counter:05d}",  # Should strip
        }
        
        for input_pattern, expected in patterns.items():
            result = sku_generator._sanitize_pattern(input_pattern)
            assert result == expected


@pytest.mark.unit
@pytest.mark.asyncio
class TestSKUGeneratorPatterns:
    """Test specific SKU generation patterns."""
    
    async def test_category_based_pattern(self, sku_generator, test_category):
        """Test category-based pattern generation."""
        with patch.object(sku_generator, '_get_category_code', return_value="ELEC"):
            sku = await sku_generator.generate_sku(
                category_id=test_category.id,
                pattern="{category_code}-{counter:04d}"
            )
            
            assert sku.startswith("ELEC-")
    
    async def test_timestamp_based_pattern(self, sku_generator):
        """Test timestamp-based pattern generation."""
        sku = await sku_generator.generate_sku(
            pattern="ITEM-{timestamp}-{counter:03d}"
        )
        
        parts = sku.split("-")
        assert len(parts) == 3
        assert parts[0] == "ITEM"
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 3  # 3-digit counter
    
    async def test_simple_counter_pattern(self, sku_generator):
        """Test simple counter-only pattern."""
        sku = await sku_generator.generate_sku(pattern="{counter:06d}")
        
        assert len(sku) == 6
        assert sku.isdigit()
    
    async def test_complex_pattern(self, sku_generator, test_category):
        """Test complex pattern with multiple variables."""
        pattern = "RENTAL-{category_code}-{timestamp}-{counter:02d}"
        
        with patch.object(sku_generator, '_get_category_code', return_value="FURN"):
            sku = await sku_generator.generate_sku(
                category_id=test_category.id,
                pattern=pattern
            )
            
            parts = sku.split("-")
            assert len(parts) == 4
            assert parts[0] == "RENTAL"
            assert parts[1] == "FURN"
            assert len(parts[2]) == 8  # Timestamp
            assert len(parts[3]) == 2  # Counter


@pytest.mark.unit
@pytest.mark.asyncio
class TestSKUGeneratorErrorHandling:
    """Test SKU Generator error handling."""
    
    async def test_database_error_handling(self, sku_generator):
        """Test handling of database errors."""
        with patch.object(sku_generator, '_execute_query', side_effect=Exception("DB Error")):
            with pytest.raises(Exception, match="DB Error"):
                await sku_generator._get_next_counter("TEST")
    
    async def test_category_not_found_graceful_handling(self, sku_generator):
        """Test graceful handling when category is not found."""
        non_existent_id = uuid4()
        
        with patch.object(sku_generator.session, 'get', return_value=None):
            sku = await sku_generator.generate_sku(
                category_id=non_existent_id,
                pattern="{category_code}-{counter:03d}"
            )
            
            assert sku.startswith("UNK-")  # Unknown category code
    
    async def test_pattern_validation_in_generation(self, sku_generator):
        """Test that pattern validation occurs during generation."""
        with pytest.raises(ValidationError):
            await sku_generator.generate_sku(pattern="{invalid_placeholder}")
    
    def test_empty_pattern_validation(self, sku_generator):
        """Test validation of empty pattern."""
        with pytest.raises(ValidationError, match="Pattern cannot be empty"):
            sku_generator._validate_pattern("")
    
    def test_pattern_too_long_validation(self, sku_generator):
        """Test validation of overly long pattern."""
        long_pattern = "A" * 256
        with pytest.raises(ValidationError, match="Pattern too long"):
            sku_generator._validate_pattern(long_pattern)
    
    def test_invalid_counter_format_validation(self, sku_generator):
        """Test validation of invalid counter format."""
        invalid_patterns = [
            "{counter:}",      # Empty format
            "{counter:abc}",   # Non-numeric format
            "{counter:-5d}",   # Negative padding
        ]
        
        for pattern in invalid_patterns:
            with pytest.raises(ValidationError):
                sku_generator._validate_pattern(pattern)


@pytest.mark.unit
@pytest.mark.asyncio
class TestSKUGeneratorConcurrency:
    """Test SKU Generator under concurrent conditions."""
    
    async def test_concurrent_generation_different_patterns(self, sku_generator):
        """Test concurrent SKU generation with different patterns."""
        import asyncio
        
        patterns = [
            "PATTERN1-{counter:03d}",
            "PATTERN2-{counter:03d}",
            "PATTERN3-{counter:03d}"
        ]
        
        # Generate SKUs concurrently
        tasks = [
            sku_generator.generate_sku(pattern=pattern)
            for pattern in patterns
        ]
        
        skus = await asyncio.gather(*tasks)
        
        # All should be unique
        assert len(set(skus)) == len(skus)
        
        # Each should match its pattern
        for i, sku in enumerate(skus):
            assert sku.startswith(patterns[i].split("-")[0])
    
    @patch('app.services.sku_generator.SKUGenerator._sku_exists')
    async def test_collision_resolution_retries(self, mock_exists, sku_generator):
        """Test collision resolution with multiple retries."""
        # Simulate collisions for first few attempts
        mock_exists.side_effect = [True, True, True, False]
        
        sku = await sku_generator.generate_sku()
        
        assert sku is not None
        assert mock_exists.call_count == 4  # 3 collisions + 1 success