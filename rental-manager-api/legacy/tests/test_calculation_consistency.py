"""
Test line total calculation consistency across the application.
Validates that calculations work correctly for different transaction types.
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta

from app.modules.transactions.base.models.transaction_lines import TransactionLine, LineItemType
from app.modules.transactions.base.models.transaction_headers import RentalPeriodUnit, RentalStatus


class TestLineCalculations:
    """Test line total calculations for different scenarios."""

    def test_basic_purchase_line_calculation(self):
        """Test basic purchase line calculation without rental period."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Test item",
            quantity=Decimal("2"),
            unit_price=Decimal("100.00"),
            discount_amount=Decimal("10.00"),
            tax_amount=Decimal("32.40")  # 18% tax on (200 - 10)
        )
        
        # Should calculate: (2 * 100) - 10 + 32.40 = 222.40
        expected_total = Decimal("222.40")
        assert line.line_total == expected_total
        
        # Test the calculation method
        calculated_total = line.calculate_line_total()
        assert calculated_total == expected_total

    def test_rental_line_calculation_with_period(self):
        """Test rental line calculation with rental period."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Rental item",
            quantity=Decimal("1"),
            unit_price=Decimal("50.00"),
            rental_period=7,  # 7 days
            discount_amount=Decimal("25.00"),
            tax_amount=Decimal("54.00")  # 18% tax on (350 - 25)
        )
        
        # Should calculate: (1 * 50 * 7) - 25 + 54 = 379.00
        expected_total = Decimal("379.00")
        assert line.line_total == expected_total
        
        # Test the calculation method
        calculated_total = line.calculate_line_total()
        assert calculated_total == expected_total

    def test_rental_line_calculation_with_dates(self):
        """Test rental line calculation with start/end dates."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 8)  # 7 days
        
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Rental item",
            quantity=Decimal("2"),
            unit_price=Decimal("25.00"),
            rental_start_date=start_date,
            rental_end_date=end_date,
            discount_amount=Decimal("15.00"),
            tax_amount=Decimal("45.00")
        )
        
        # Should calculate: (2 * 25 * 7) - 15 + 45 = 380.00
        expected_total = Decimal("380.00")
        assert line.line_total == expected_total

    def test_rental_line_period_priority(self):
        """Test that rental_period takes priority over date calculation."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 1, 8)  # This would be 7 days
        
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Rental item",
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
            rental_period=5,  # This should take priority
            rental_start_date=start_date,
            rental_end_date=end_date,
            discount_amount=Decimal("0"),
            tax_amount=Decimal("0")
        )
        
        # Should use rental_period=5, not calculated 7 days from dates
        # Expected: (1 * 100 * 5) = 500.00
        expected_total = Decimal("500.00")
        assert line.line_total == expected_total

    def test_no_rental_period_calculation(self):
        """Test calculation when no rental period is specified."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Regular item",
            quantity=Decimal("3"),
            unit_price=Decimal("75.00"),
            discount_amount=Decimal("5.00"),
            tax_amount=Decimal("38.70")  # 18% tax on (225 - 5)
        )
        
        # Should calculate: (3 * 75) - 5 + 38.70 = 258.70
        expected_total = Decimal("258.70")
        assert line.line_total == expected_total

    def test_zero_rental_period_calculation(self):
        """Test calculation when rental period is zero."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Rental item",
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
            rental_period=0,  # Zero period
            discount_amount=Decimal("0"),
            tax_amount=Decimal("0")
        )
        
        # Should not multiply by rental period if it's 0
        # Expected: (1 * 100) = 100.00
        expected_total = Decimal("100.00")
        assert line.line_total == expected_total

    def test_calculation_precision(self):
        """Test calculation precision with decimal values."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Precision test",
            quantity=Decimal("2.5"),
            unit_price=Decimal("99.99"),
            rental_period=3,
            discount_amount=Decimal("12.34"),
            tax_amount=Decimal("56.78")
        )
        
        # Should calculate: (2.5 * 99.99 * 3) - 12.34 + 56.78
        # = 749.925 - 12.34 + 56.78 = 794.365
        expected_total = Decimal("794.365")
        assert line.line_total == expected_total

    def test_update_pricing_recalculation(self):
        """Test that update_pricing recalculates line total correctly."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Update test",
            quantity=Decimal("1"),
            unit_price=Decimal("100.00"),
            rental_period=2,
            discount_amount=Decimal("0"),
            tax_amount=Decimal("0")
        )
        
        # Initial calculation: 1 * 100 * 2 = 200
        assert line.line_total == Decimal("200.00")
        
        # Update pricing
        line.update_pricing(
            unit_price=Decimal("150.00"),
            discount_amount=Decimal("50.00"),
            tax_rate=Decimal("18")
        )
        
        # New calculation: 
        # Base: 1 * 150 * 2 = 300
        # After discount: 300 - 50 = 250
        # Tax: 250 * 0.18 = 45
        # Total: 250 + 45 = 295
        expected_total = Decimal("295.00")
        assert line.line_total == expected_total

    def test_validation_errors(self):
        """Test that validation catches calculation errors."""
        with pytest.raises(ValueError, match="Quantity must be positive"):
            TransactionLine(
                transaction_header_id="test-header-id",
                line_number=1,
                description="Invalid quantity",
                quantity=Decimal("-1"),
                unit_price=Decimal("100.00")
            )

        with pytest.raises(ValueError, match="Unit price cannot be negative"):
            TransactionLine(
                transaction_header_id="test-header-id",
                line_number=1,
                description="Invalid price",
                quantity=Decimal("1"),
                unit_price=Decimal("-100.00")
            )

        with pytest.raises(ValueError, match="Discount amount cannot be negative"):
            TransactionLine(
                transaction_header_id="test-header-id",
                line_number=1,
                description="Invalid discount",
                quantity=Decimal("1"),
                unit_price=Decimal("100.00"),
                discount_amount=Decimal("-10.00")
            )

    def test_complex_rental_scenario(self):
        """Test a complex rental scenario with multiple factors."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Complex rental",
            line_type=LineItemType.PRODUCT,
            quantity=Decimal("3"),
            unit_price=Decimal("125.50"),
            rental_period=14,  # 2 weeks
            discount_amount=Decimal("150.00"),
            tax_amount=Decimal("456.75"),
            rental_start_date=date(2024, 1, 1),
            rental_end_date=date(2024, 1, 15),
            current_rental_status=RentalStatus.RENTAL_INPROGRESS,
            daily_rate=Decimal("125.50")
        )
        
        # Calculation: (3 * 125.50 * 14) - 150 + 456.75
        # = 5271.00 - 150.00 + 456.75 = 5577.75
        expected_total = Decimal("5577.75")
        assert line.line_total == expected_total
        
        # Test property calculations
        assert line.extended_price == Decimal("376.50")  # 3 * 125.50
        assert line.rental_duration_days == 14
        assert line.net_amount == Decimal("226.50")  # extended_price - discount

    def test_calculation_consistency_properties(self):
        """Test that calculated properties are consistent."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Property test",
            quantity=Decimal("2"),
            unit_price=Decimal("100.00"),
            discount_amount=Decimal("25.00"),
            tax_amount=Decimal("31.50")
        )
        
        # Test properties
        assert line.extended_price == Decimal("200.00")  # 2 * 100
        assert line.net_amount == Decimal("175.00")  # 200 - 25
        assert line.line_total == Decimal("206.50")  # 175 + 31.50
        
        # Verify calculation consistency
        manual_calculation = line.extended_price - line.discount_amount + line.tax_amount
        assert line.line_total == manual_calculation


class TestCalculationEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_zero_values(self):
        """Test calculations with zero values."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Zero test",
            quantity=Decimal("0.01"),  # Minimum positive quantity
            unit_price=Decimal("0"),
            discount_amount=Decimal("0"),
            tax_amount=Decimal("0")
        )
        
        assert line.line_total == Decimal("0")

    def test_very_large_numbers(self):
        """Test calculations with very large numbers."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Large number test",
            quantity=Decimal("999999"),
            unit_price=Decimal("999999.99"),
            rental_period=30,
            discount_amount=Decimal("100000.00"),
            tax_amount=Decimal("500000.00")
        )
        
        # Should handle large calculations without overflow
        expected_subtotal = Decimal("999999") * Decimal("999999.99") * Decimal("30")
        expected_total = expected_subtotal - Decimal("100000.00") + Decimal("500000.00")
        assert line.line_total == expected_total

    def test_high_precision_decimals(self):
        """Test calculations with high precision decimal values."""
        line = TransactionLine(
            transaction_header_id="test-header-id",
            line_number=1,
            description="Precision test",
            quantity=Decimal("1.123456789"),
            unit_price=Decimal("9.876543210"),
            rental_period=1,
            discount_amount=Decimal("0.555555555"),
            tax_amount=Decimal("1.987654321")
        )
        
        # Should maintain precision in calculations
        extended = Decimal("1.123456789") * Decimal("9.876543210")
        after_discount = extended - Decimal("0.555555555")
        expected_total = after_discount + Decimal("1.987654321")
        assert line.line_total == expected_total


@pytest.mark.integration
class TestCalculationIntegration:
    """Integration tests for calculations across the system."""

    def test_rental_calculation_matches_service_logic(self):
        """Test that model calculations match service layer calculations."""
        # This would be expanded with actual service layer tests
        # For now, it's a placeholder for integration testing
        pass

    def test_purchase_calculation_matches_service_logic(self):
        """Test that model calculations match purchase service calculations."""
        # This would be expanded with actual service layer tests
        pass

    def test_api_response_calculation_consistency(self):
        """Test that API responses have consistent calculations."""
        # This would test API endpoints to ensure calculations are consistent
        pass