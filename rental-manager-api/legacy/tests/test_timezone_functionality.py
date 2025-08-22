"""
Comprehensive tests for timezone functionality.

Tests the timezone utilities, serializers, and system integration.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock
import pytz
from decimal import Decimal
from uuid import uuid4

from app.core.timezone import (
    TimezoneManager,
    utc_now,
    system_now,
    to_utc,
    to_system_tz,
    parse_datetime_input,
    format_datetime_output,
    validate_timezone_name,
    get_common_timezones,
    IST
)

from app.core.serializers import (
    TimezoneAwareModel,
    TimezoneAwareCreateModel,
    TimezoneAwareUpdateModel,
    TimezoneAwareResponseModel,
    datetime_field_input_converter,
    datetime_field_output_converter,
    convert_datetime_dict_to_utc,
    convert_datetime_dict_to_system_tz
)

from app.core.schemas_examples import (
    TransactionCreate,
    TransactionResponse,
    RentalCreate,
    SystemConfigUpdate
)


class TestTimezoneUtilities:
    """Test core timezone utility functions."""
    
    def test_utc_now(self):
        """Test UTC now function."""
        now = utc_now()
        assert isinstance(now, datetime)
        assert now.tzinfo == timezone.utc
        
        # Should be very close to current time
        assert abs((datetime.now(timezone.utc) - now).total_seconds()) < 1
    
    def test_system_now_default_ist(self):
        """Test system now with default IST timezone."""
        now = system_now()
        assert isinstance(now, datetime)
        # Should be IST timezone by default
        assert now.tzinfo.zone == 'Asia/Kolkata'
    
    def test_to_utc_naive_datetime(self):
        """Test converting naive datetime to UTC."""
        # Naive datetime - should assume system timezone (IST)
        naive_dt = datetime(2024, 1, 29, 15, 30, 0)  # 3:30 PM
        utc_dt = to_utc(naive_dt)
        
        assert utc_dt.tzinfo == timezone.utc
        # IST is UTC+5:30, so 15:30 IST = 10:00 UTC
        expected_utc = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        assert utc_dt == expected_utc
    
    def test_to_utc_with_source_timezone(self):
        """Test converting datetime with specified source timezone."""
        naive_dt = datetime(2024, 1, 29, 15, 30, 0)
        
        # Convert from US Eastern (UTC-5 in winter)
        eastern = pytz.timezone('US/Eastern')
        utc_dt = to_utc(naive_dt, 'US/Eastern')
        
        # 15:30 EST = 20:30 UTC
        expected_utc = datetime(2024, 1, 29, 20, 30, 0, tzinfo=timezone.utc)
        assert utc_dt == expected_utc
    
    def test_to_utc_already_utc(self):
        """Test that UTC datetime remains unchanged."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        result = to_utc(utc_dt)
        assert result == utc_dt
        assert result.tzinfo == timezone.utc
    
    def test_to_system_timezone(self):
        """Test converting UTC to system timezone."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        # Convert to system timezone (IST by default)
        ist_dt = to_system_tz(utc_dt)
        
        # 10:00 UTC = 15:30 IST
        assert ist_dt.hour == 15
        assert ist_dt.minute == 30
        assert ist_dt.tzinfo.zone == 'Asia/Kolkata'
    
    def test_to_system_timezone_with_target(self):
        """Test converting to specific target timezone."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        # Convert to US Eastern
        eastern_dt = to_system_tz(utc_dt, 'US/Eastern')
        
        # 10:00 UTC = 05:00 EST (winter time)
        assert eastern_dt.hour == 5
        assert eastern_dt.tzinfo.zone == 'US/Eastern'
    
    def test_parse_datetime_iso_format(self):
        """Test parsing ISO format datetime strings."""
        # ISO with timezone
        iso_with_tz = "2024-01-29T15:30:00+05:30"
        parsed = parse_datetime_input(iso_with_tz)
        
        assert parsed.tzinfo == timezone.utc
        # 15:30 +05:30 = 10:00 UTC
        assert parsed.hour == 10
        assert parsed.minute == 0
    
    def test_parse_datetime_various_formats(self):
        """Test parsing various datetime string formats."""
        test_cases = [
            ("2024-01-29 15:30:00", datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)),
            ("2024-01-29 15:30", datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)),
            ("2024-01-29", datetime(2024, 1, 28, 18, 30, 0, tzinfo=timezone.utc)),  # IST to UTC
            ("29/01/2024 15:30:00", datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)),
        ]
        
        for input_str, expected in test_cases:
            parsed = parse_datetime_input(input_str)
            assert parsed == expected, f"Failed for input: {input_str}"
    
    def test_format_for_api(self):
        """Test formatting datetime for API output."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        # Format in system timezone (IST)
        formatted = format_datetime_output(utc_dt)
        
        # Should be ISO format in IST
        assert "15:30:00" in formatted  # 10:00 UTC = 15:30 IST
        assert "+05:30" in formatted or "+0530" in formatted
    
    def test_validate_timezone_name(self):
        """Test timezone name validation."""
        assert validate_timezone_name('Asia/Kolkata') is True
        assert validate_timezone_name('UTC') is True
        assert validate_timezone_name('US/Eastern') is True
        assert validate_timezone_name('Invalid/Timezone') is False
        assert validate_timezone_name('') is False
    
    def test_get_common_timezones(self):
        """Test getting common timezone list."""
        timezones = get_common_timezones()
        
        assert isinstance(timezones, list)
        assert 'Asia/Kolkata' in timezones
        assert 'UTC' in timezones
        assert 'US/Eastern' in timezones
        assert len(timezones) > 5


class TestTimezoneManager:
    """Test TimezoneManager class methods."""
    
    @pytest.mark.skip(reason="get_async_session function no longer exists - needs test rewrite")
    @pytest.mark.asyncio
    async def test_get_system_timezone_from_settings(self):
        """Test getting timezone from system settings."""
        # Mock the database session and service
        mock_session = AsyncMock()
        mock_service = AsyncMock()
        mock_service.get_setting_value.return_value = 'US/Eastern'
        
        mock_get_session.return_value.__aenter__.return_value = mock_session
        
        with patch('app.modules.system.service.SystemService', return_value=mock_service):
            # Clear cache first
            TimezoneManager.invalidate_cache()
            
            tz = TimezoneManager.get_system_timezone()
            
            # Should use cached default or return IST if async fails
            assert tz.zone in ['Asia/Kolkata', 'US/Eastern']
    
    def test_get_system_timezone_sync(self):
        """Test synchronous timezone getter."""
        # Should return cached or default to IST
        tz = TimezoneManager.get_system_timezone_sync()
        assert isinstance(tz, pytz.BaseTzInfo)
    
    def test_invalidate_cache(self):
        """Test cache invalidation."""
        # Set some cache values
        TimezoneManager._system_timezone_cache = IST
        TimezoneManager._system_timezone_cache_time = datetime.now(timezone.utc)
        
        # Invalidate cache
        TimezoneManager.invalidate_cache()
        
        assert TimezoneManager._system_timezone_cache is None
        assert TimezoneManager._system_timezone_cache_time is None


class TestTimezoneAwareModels:
    """Test Pydantic timezone-aware models."""
    
    def test_timezone_aware_create_model(self):
        """Test timezone-aware create model with datetime parsing."""
        data = {
            'transaction_type': 'SALE',
            'transaction_date': '2024-01-29T15:30:00+05:30',
            'subtotal': Decimal('100.00'),
            'total_amount': Decimal('118.00'),
            'currency': 'INR'
        }
        
        transaction = TransactionCreate(**data)
        
        # Transaction date should be converted to UTC
        assert transaction.transaction_date.tzinfo == timezone.utc
        assert transaction.transaction_date.hour == 10  # 15:30 IST = 10:00 UTC
        assert transaction.transaction_date.minute == 0
    
    def test_timezone_aware_response_model(self):
        """Test timezone-aware response model with datetime formatting."""
        # Create a mock transaction with UTC datetime
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        transaction_data = {
            'id': uuid4(),
            'transaction_number': 'TXN-001',
            'transaction_type': 'SALE',
            'status': 'COMPLETED',
            'transaction_date': utc_dt,
            'created_at': utc_dt,
            'updated_at': utc_dt,
            'subtotal': Decimal('100.00'),
            'total_amount': Decimal('118.00'),
            'paid_amount': Decimal('118.00'),
            'currency': 'INR'
        }
        
        response = TransactionResponse(**transaction_data)
        
        # When converted to dict, datetime should be in system timezone
        response_dict = response.model_dump()
        
        # Should contain IST datetime strings
        assert '15:30:00' in response_dict['transaction_date']  # 10:00 UTC = 15:30 IST
        assert '+05:30' in response_dict['transaction_date'] or '+0530' in response_dict['transaction_date']
    
    def test_rental_create_validation(self):
        """Test rental creation with datetime validation."""
        start_date = '2024-01-29T10:00:00+05:30'
        end_date = '2024-01-30T10:00:00+05:30'
        
        rental_data = {
            'item_id': uuid4(),
            'quantity': 2,
            'rental_start_date': start_date,
            'rental_end_date': end_date,
            'daily_rate': Decimal('50.00'),
            'security_deposit': Decimal('100.00')
        }
        
        rental = RentalCreate(**rental_data)
        
        # Both dates should be converted to UTC
        assert rental.rental_start_date.tzinfo == timezone.utc
        assert rental.rental_end_date.tzinfo == timezone.utc
        
        # End date should be after start date (validation should pass)
        assert rental.rental_end_date > rental.rental_start_date
    
    def test_rental_create_validation_error(self):
        """Test rental creation validation error for invalid date range."""
        start_date = '2024-01-30T10:00:00+05:30'
        end_date = '2024-01-29T10:00:00+05:30'  # Before start date
        
        rental_data = {
            'item_id': uuid4(),
            'quantity': 2,
            'rental_start_date': start_date,
            'rental_end_date': end_date,
            'daily_rate': Decimal('50.00'),
            'security_deposit': Decimal('100.00')
        }
        
        with pytest.raises(ValueError, match="end date must be after start date"):
            RentalCreate(**rental_data)
    
    def test_system_config_timezone_validation(self):
        """Test system config with timezone validation."""
        valid_config = SystemConfigUpdate(timezone='Asia/Kolkata')
        assert valid_config.timezone == 'Asia/Kolkata'
        
        valid_config_utc = SystemConfigUpdate(timezone='UTC')
        assert valid_config_utc.timezone == 'UTC'
        
        with pytest.raises(ValueError, match="Invalid timezone"):
            SystemConfigUpdate(timezone='Invalid/Timezone')


class TestSerializerUtilities:
    """Test serializer utility functions."""
    
    def test_datetime_field_input_converter(self):
        """Test input converter utility."""
        # String input
        iso_string = "2024-01-29T15:30:00+05:30"
        result = datetime_field_input_converter(iso_string)
        
        assert result.tzinfo == timezone.utc
        assert result.hour == 10  # 15:30 IST = 10:00 UTC
        
        # Datetime input
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        result = datetime_field_input_converter(utc_dt)
        assert result == utc_dt
        
        # None input
        result = datetime_field_input_converter(None)
        assert result is None
    
    def test_datetime_field_output_converter(self):
        """Test output converter utility."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        result = datetime_field_output_converter(utc_dt)
        
        assert isinstance(result, str)
        assert '15:30:00' in result  # IST time
        assert '+05:30' in result or '+0530' in result
        
        # None input
        result = datetime_field_output_converter(None)
        assert result is None
    
    def test_convert_datetime_dict_to_utc(self):
        """Test batch conversion of datetime fields to UTC."""
        data = {
            'name': 'Test Transaction',
            'transaction_date': '2024-01-29T15:30:00+05:30',
            'due_date': '2024-01-30T15:30:00+05:30',
            'amount': 100.00,
            'other_field': 'unchanged'
        }
        
        datetime_fields = ['transaction_date', 'due_date']
        converted = convert_datetime_dict_to_utc(data, datetime_fields)
        
        assert converted['name'] == 'Test Transaction'
        assert converted['amount'] == 100.00
        assert converted['other_field'] == 'unchanged'
        
        # Check datetime conversions
        assert isinstance(converted['transaction_date'], datetime)
        assert converted['transaction_date'].tzinfo == timezone.utc
        assert converted['transaction_date'].hour == 10  # 15:30 IST = 10:00 UTC
    
    def test_convert_datetime_dict_to_system_tz(self):
        """Test batch conversion of datetime fields to system timezone."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        data = {
            'name': 'Test Transaction',
            'transaction_date': utc_dt,
            'due_date': utc_dt,
            'amount': 100.00,
            'other_field': 'unchanged'
        }
        
        datetime_fields = ['transaction_date', 'due_date']
        converted = convert_datetime_dict_to_system_tz(data, datetime_fields)
        
        assert converted['name'] == 'Test Transaction'
        assert converted['amount'] == 100.00
        assert converted['other_field'] == 'unchanged'
        
        # Check datetime conversions
        assert isinstance(converted['transaction_date'], str)
        assert '15:30:00' in converted['transaction_date']  # 10:00 UTC = 15:30 IST


class TestIntegrationScenarios:
    """Test real-world integration scenarios."""
    
    def test_api_request_response_cycle(self):
        """Test complete API request/response cycle with timezone conversion."""
        # Simulate API request data (in IST)
        request_data = {
            'transaction_type': 'RENTAL',
            'customer_id': uuid4(),
            'transaction_date': '2024-01-29T15:30:00+05:30',  # IST
            'due_date': '2024-02-05',
            'subtotal': Decimal('1000.00'),
            'discount_amount': Decimal('50.00'),
            'tax_amount': Decimal('95.00'),
            'total_amount': Decimal('1045.00'),
            'currency': 'INR',
            'notes': 'Test rental transaction'
        }
        
        # 1. Parse request (converts to UTC for database)
        create_model = TransactionCreate(**request_data)
        
        # Verify UTC conversion
        assert create_model.transaction_date.tzinfo == timezone.utc
        assert create_model.transaction_date.hour == 10  # 15:30 IST = 10:00 UTC
        
        # 2. Simulate database storage (would store UTC datetime)
        stored_utc = create_model.transaction_date
        
        # 3. Simulate database retrieval and response creation
        response_data = {
            'id': uuid4(),
            'transaction_number': 'TXN-001',
            'transaction_type': create_model.transaction_type,
            'status': 'PENDING',
            'transaction_date': stored_utc,  # UTC from database
            'due_date': create_model.due_date,
            'created_at': stored_utc,
            'updated_at': stored_utc,
            'subtotal': create_model.subtotal,
            'total_amount': create_model.total_amount,
            'paid_amount': Decimal('0.00'),
            'currency': create_model.currency
        }
        
        # 4. Create response model (converts to system timezone)
        response_model = TransactionResponse(**response_data)
        
        # 5. Serialize for API response
        api_response = response_model.model_dump()
        
        # Verify system timezone in response
        assert '15:30:00' in api_response['transaction_date']  # Back to IST
        assert '+05:30' in api_response['transaction_date'] or '+0530' in api_response['transaction_date']
    
    def test_different_input_timezones(self):
        """Test handling different input timezones."""
        test_cases = [
            # (input_datetime, expected_utc_hour)
            ('2024-01-29T15:30:00+05:30', 10),  # IST to UTC
            ('2024-01-29T15:30:00+00:00', 15),  # UTC to UTC
            ('2024-01-29T15:30:00-05:00', 20),  # EST to UTC
            ('2024-01-29T15:30:00Z', 15),       # UTC with Z notation
        ]
        
        for input_dt, expected_hour in test_cases:
            create_data = {
                'transaction_type': 'SALE',
                'transaction_date': input_dt,
                'subtotal': Decimal('100.00'),
                'total_amount': Decimal('118.00'),
            }
            
            transaction = TransactionCreate(**create_data)
            assert transaction.transaction_date.hour == expected_hour, f"Failed for input: {input_dt}"
    
    def test_timezone_setting_change_impact(self):
        """Test impact of changing system timezone setting."""
        utc_dt = datetime(2024, 1, 29, 10, 0, 0, tzinfo=timezone.utc)
        
        # Test with IST (default)
        ist_formatted = format_datetime_output(utc_dt)
        assert '15:30:00' in ist_formatted
        
        # Test with different timezone
        us_eastern_formatted = format_datetime_output(utc_dt, 'US/Eastern')
        assert '05:00:00' in us_eastern_formatted  # Winter time
        
        # Test with UTC
        utc_formatted = format_datetime_output(utc_dt, 'UTC')
        assert '10:00:00' in utc_formatted


@pytest.mark.asyncio
class TestAsyncTimezoneIntegration:
    """Test async integration with timezone functionality."""
    
    async def test_timezone_manager_async_context(self):
        """Test timezone manager in async context."""
        # This would normally test with real database integration
        # For now, test basic async compatibility
        
        tz = TimezoneManager.get_system_timezone_sync()
        assert tz is not None
        
        # Test utilities work in async context
        now_utc = utc_now()
        now_system = system_now()
        
        assert now_utc.tzinfo == timezone.utc
        assert now_system.tzinfo is not None
    
    async def test_system_setting_timezone_update(self):
        """Test timezone cache invalidation when settings change."""
        # Clear cache
        TimezoneManager.invalidate_cache()
        
        # Get initial timezone (should be IST default)
        initial_tz = TimezoneManager.get_system_timezone_sync()
        assert initial_tz.zone == 'Asia/Kolkata'
        
        # Simulate timezone setting change (would normally update database)
        TimezoneManager.invalidate_cache()
        
        # Cache should be cleared
        assert TimezoneManager._system_timezone_cache is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])