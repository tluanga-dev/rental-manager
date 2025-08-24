#!/usr/bin/env python3

"""
Company Business Logic Testing Suite
Tests all Company model methods, properties, and business rules
Target: 100% coverage for Company model functionality
"""

import sys
import os
import asyncio
import pytest
from uuid import uuid4
from decimal import Decimal
from datetime import datetime

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models.company import Company


class TestCompanyBusinessLogic:
    """Comprehensive business logic tests for Company model"""
    
    def test_company_creation_with_all_fields(self):
        """Test creating a company with all fields provided"""
        print("Test 1: Company creation with all fields")
        
        company = Company(
            company_name="Tech Corp Solutions",
            address="123 Technology Lane, Tech City, TC 12345", 
            email="info@techcorp.com",
            phone="+1-555-123-4567",
            gst_no="27AABCU9603R1ZM",
            registration_number="L85110TN2019PTC123456"
        )
        
        assert company.company_name == "Tech Corp Solutions"
        assert company.address == "123 Technology Lane, Tech City, TC 12345"
        assert company.email == "info@techcorp.com"
        assert company.phone == "+1-555-123-4567"
        assert company.gst_no == "27AABCU9603R1ZM"
        assert company.registration_number == "L85110TN2019PTC123456"
        assert company.is_active is True
        assert company.id is not None
        
        print("✅ PASS: Company created with all fields correctly")

    def test_company_creation_minimal_fields(self):
        """Test creating a company with only required fields"""
        print("Test 2: Company creation with minimal fields")
        
        company = Company(company_name="Minimal Corp")
        
        assert company.company_name == "Minimal Corp"
        assert company.address is None
        assert company.email is None
        assert company.phone is None
        assert company.gst_no is None
        assert company.registration_number is None
        assert company.is_active is True
        assert company.id is not None
        
        print("✅ PASS: Company created with minimal fields correctly")

    def test_gst_auto_uppercase_conversion(self):
        """Test that GST numbers are automatically converted to uppercase"""
        print("Test 3: GST auto-uppercase conversion")
        
        company = Company(
            company_name="Test Corp",
            gst_no="lowercase27gst123"
        )
        
        assert company.gst_no == "LOWERCASE27GST123"
        
        print("✅ PASS: GST number converted to uppercase")

    def test_registration_auto_uppercase_conversion(self):
        """Test that registration numbers are automatically converted to uppercase"""
        print("Test 4: Registration number auto-uppercase conversion")
        
        company = Company(
            company_name="Test Corp",
            registration_number="lowercase123reg456"
        )
        
        assert company.registration_number == "LOWERCASE123REG456"
        
        print("✅ PASS: Registration number converted to uppercase")

    def test_display_name_property(self):
        """Test the display_name property returns company_name"""
        print("Test 5: Display name property")
        
        company = Company(company_name="Display Test Corp")
        
        assert company.display_name == "Display Test Corp"
        
        print("✅ PASS: Display name property works correctly")

    def test_str_representation(self):
        """Test string representation of company"""
        print("Test 6: String representation")
        
        company = Company(company_name="String Test Corp")
        
        assert str(company) == "String Test Corp"
        
        print("✅ PASS: String representation works correctly")

    def test_repr_representation(self):
        """Test developer representation of company"""
        print("Test 7: Developer representation")
        
        company = Company(company_name="Repr Test Corp")
        company.id = uuid4()
        
        repr_str = repr(company)
        assert "Company" in repr_str
        assert "Repr Test Corp" in repr_str
        assert str(company.id) in repr_str
        assert "active=True" in repr_str
        
        print("✅ PASS: Developer representation works correctly")

    def test_company_name_validation_empty(self):
        """Test that empty company name raises validation error"""
        print("Test 8: Company name validation - empty")
        
        try:
            Company(company_name="")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Company name cannot be empty" in str(e)
            print("✅ PASS: Empty company name validation works")

    def test_company_name_validation_whitespace(self):
        """Test that whitespace-only company name raises validation error"""
        print("Test 9: Company name validation - whitespace only")
        
        try:
            Company(company_name="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Company name cannot be empty" in str(e)
            print("✅ PASS: Whitespace-only company name validation works")

    def test_company_name_validation_too_long(self):
        """Test that company name exceeding 255 chars raises validation error"""
        print("Test 10: Company name validation - too long")
        
        long_name = "A" * 256
        try:
            Company(company_name=long_name)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Company name cannot exceed 255 characters" in str(e)
            print("✅ PASS: Long company name validation works")

    def test_email_validation_empty_string(self):
        """Test that empty email string raises validation error"""
        print("Test 11: Email validation - empty string")
        
        try:
            Company(company_name="Test Corp", email="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Email cannot be empty if provided" in str(e)
            print("✅ PASS: Empty email string validation works")

    def test_email_validation_too_long(self):
        """Test that email exceeding 255 chars raises validation error"""
        print("Test 12: Email validation - too long")
        
        long_email = "a" * 250 + "@test.com"  # 260 characters
        try:
            Company(company_name="Test Corp", email=long_email)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Email cannot exceed 255 characters" in str(e)
            print("✅ PASS: Long email validation works")

    def test_email_validation_invalid_format(self):
        """Test that invalid email format raises validation error"""
        print("Test 13: Email validation - invalid format")
        
        invalid_emails = [
            "invalid-email",
            "no-at-symbol",
            "no-dot-after-at@domain",
            "@domain.com",
            "user@"
        ]
        
        for email in invalid_emails:
            try:
                Company(company_name="Test Corp", email=email)
                assert False, f"Should have raised ValueError for email: {email}"
            except ValueError as e:
                assert "Invalid email format" in str(e)
        
        print("✅ PASS: Invalid email format validation works")

    def test_phone_validation_empty_string(self):
        """Test that empty phone string raises validation error"""
        print("Test 14: Phone validation - empty string")
        
        try:
            Company(company_name="Test Corp", phone="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Phone cannot be empty if provided" in str(e)
            print("✅ PASS: Empty phone string validation works")

    def test_phone_validation_too_long(self):
        """Test that phone exceeding 50 chars raises validation error"""
        print("Test 15: Phone validation - too long")
        
        long_phone = "1" * 51
        try:
            Company(company_name="Test Corp", phone=long_phone)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Phone number cannot exceed 50 characters" in str(e)
            print("✅ PASS: Long phone validation works")

    def test_gst_validation_empty_string(self):
        """Test that empty GST string raises validation error"""
        print("Test 16: GST validation - empty string")
        
        try:
            Company(company_name="Test Corp", gst_no="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "GST number cannot be empty if provided" in str(e)
            print("✅ PASS: Empty GST string validation works")

    def test_gst_validation_too_long(self):
        """Test that GST exceeding 50 chars raises validation error"""
        print("Test 17: GST validation - too long")
        
        long_gst = "A" * 51
        try:
            Company(company_name="Test Corp", gst_no=long_gst)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "GST number cannot exceed 50 characters" in str(e)
            print("✅ PASS: Long GST validation works")

    def test_registration_validation_empty_string(self):
        """Test that empty registration string raises validation error"""
        print("Test 18: Registration validation - empty string")
        
        try:
            Company(company_name="Test Corp", registration_number="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Registration number cannot be empty if provided" in str(e)
            print("✅ PASS: Empty registration string validation works")

    def test_registration_validation_too_long(self):
        """Test that registration exceeding 100 chars raises validation error"""
        print("Test 19: Registration validation - too long")
        
        long_reg = "B" * 101
        try:
            Company(company_name="Test Corp", registration_number=long_reg)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Registration number cannot exceed 100 characters" in str(e)
            print("✅ PASS: Long registration validation works")

    def test_update_info_company_name(self):
        """Test updating company name via update_info method"""
        print("Test 20: Update info - company name")
        
        company = Company(company_name="Original Corp")
        company.update_info(company_name="Updated Corp")
        
        assert company.company_name == "Updated Corp"
        
        print("✅ PASS: Company name update works")

    def test_update_info_all_fields(self):
        """Test updating all fields via update_info method"""
        print("Test 21: Update info - all fields")
        
        company = Company(company_name="Original Corp")
        
        company.update_info(
            company_name="Updated Corp",
            address="Updated Address",
            email="updated@corp.com",
            phone="+1-555-999-8888",
            gst_no="updated27gst789",
            registration_number="updated123reg456",
            updated_by="test_user"
        )
        
        assert company.company_name == "Updated Corp"
        assert company.address == "Updated Address"
        assert company.email == "updated@corp.com"
        assert company.phone == "+1-555-999-8888"
        assert company.gst_no == "UPDATED27GST789"  # Auto-uppercase
        assert company.registration_number == "UPDATED123REG456"  # Auto-uppercase
        assert company.updated_by == "test_user"
        
        print("✅ PASS: All fields update works")

    def test_update_info_partial(self):
        """Test partial update via update_info method"""
        print("Test 22: Update info - partial update")
        
        company = Company(
            company_name="Original Corp",
            email="original@corp.com",
            phone="555-1234"
        )
        
        # Only update email, leave other fields unchanged
        company.update_info(email="new@corp.com")
        
        assert company.company_name == "Original Corp"  # Unchanged
        assert company.email == "new@corp.com"  # Updated
        assert company.phone == "555-1234"  # Unchanged
        
        print("✅ PASS: Partial update works")

    def test_update_info_validation_empty_name(self):
        """Test that update_info validates empty company name"""
        print("Test 23: Update info validation - empty name")
        
        company = Company(company_name="Original Corp")
        
        try:
            company.update_info(company_name="")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Company name cannot be empty" in str(e)
            print("✅ PASS: Update info empty name validation works")

    def test_update_info_validation_long_name(self):
        """Test that update_info validates long company name"""
        print("Test 24: Update info validation - long name")
        
        company = Company(company_name="Original Corp")
        long_name = "A" * 256
        
        try:
            company.update_info(company_name=long_name)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Company name cannot exceed 255 characters" in str(e)
            print("✅ PASS: Update info long name validation works")

    def test_update_info_validation_invalid_email(self):
        """Test that update_info validates invalid email"""
        print("Test 25: Update info validation - invalid email")
        
        company = Company(company_name="Original Corp")
        
        try:
            company.update_info(email="invalid-email")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Invalid email format" in str(e)
            print("✅ PASS: Update info invalid email validation works")

    def test_update_info_validation_empty_phone(self):
        """Test that update_info validates empty phone"""
        print("Test 26: Update info validation - empty phone")
        
        company = Company(company_name="Original Corp")
        
        try:
            company.update_info(phone="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Phone cannot be empty if provided" in str(e)
            print("✅ PASS: Update info empty phone validation works")

    def test_update_info_validation_long_phone(self):
        """Test that update_info validates long phone"""
        print("Test 27: Update info validation - long phone")
        
        company = Company(company_name="Original Corp")
        long_phone = "1" * 51
        
        try:
            company.update_info(phone=long_phone)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Phone number cannot exceed 50 characters" in str(e)
            print("✅ PASS: Update info long phone validation works")

    def test_update_info_validation_empty_gst(self):
        """Test that update_info validates empty GST"""
        print("Test 28: Update info validation - empty GST")
        
        company = Company(company_name="Original Corp")
        
        try:
            company.update_info(gst_no="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "GST number cannot be empty if provided" in str(e)
            print("✅ PASS: Update info empty GST validation works")

    def test_update_info_validation_long_gst(self):
        """Test that update_info validates long GST"""
        print("Test 29: Update info validation - long GST")
        
        company = Company(company_name="Original Corp")
        long_gst = "A" * 51
        
        try:
            company.update_info(gst_no=long_gst)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "GST number cannot exceed 50 characters" in str(e)
            print("✅ PASS: Update info long GST validation works")

    def test_update_info_validation_empty_registration(self):
        """Test that update_info validates empty registration"""
        print("Test 30: Update info validation - empty registration")
        
        company = Company(company_name="Original Corp")
        
        try:
            company.update_info(registration_number="   ")
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Registration number cannot be empty if provided" in str(e)
            print("✅ PASS: Update info empty registration validation works")

    def test_update_info_validation_long_registration(self):
        """Test that update_info validates long registration"""
        print("Test 31: Update info validation - long registration")
        
        company = Company(company_name="Original Corp")
        long_reg = "B" * 101
        
        try:
            company.update_info(registration_number=long_reg)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "Registration number cannot exceed 100 characters" in str(e)
            print("✅ PASS: Update info long registration validation works")

    def test_gst_whitespace_trimming(self):
        """Test that GST number whitespace is trimmed"""
        print("Test 32: GST whitespace trimming")
        
        company = Company(
            company_name="Test Corp",
            gst_no="  27AABCU9603R1ZM  "
        )
        
        assert company.gst_no == "27AABCU9603R1ZM"
        
        print("✅ PASS: GST whitespace trimming works")

    def test_registration_whitespace_trimming(self):
        """Test that registration number whitespace is trimmed"""
        print("Test 33: Registration whitespace trimming")
        
        company = Company(
            company_name="Test Corp",
            registration_number="  L85110TN2019PTC123456  "
        )
        
        assert company.registration_number == "L85110TN2019PTC123456"
        
        print("✅ PASS: Registration whitespace trimming works")

    def test_email_format_validation_edge_cases(self):
        """Test email format validation with various edge cases"""
        print("Test 34: Email format validation edge cases")
        
        valid_emails = [
            "user@domain.com",
            "test.email@example.org",
            "user+tag@domain.co.uk",
            "123@numbers.com"
        ]
        
        for email in valid_emails:
            company = Company(company_name="Test Corp", email=email)
            assert company.email == email.lower()  # Should be converted to lowercase
        
        print("✅ PASS: Email format validation edge cases work")

    def test_update_info_none_values(self):
        """Test update_info with None values (should clear fields)"""
        print("Test 35: Update info with None values")
        
        company = Company(
            company_name="Test Corp",
            address="Original Address",
            email="original@corp.com",
            phone="555-1234",
            gst_no="GST123",
            registration_number="REG456"
        )
        
        # Update with None values to clear optional fields
        company.update_info(
            address=None,
            email=None,
            phone=None,
            gst_no=None,
            registration_number=None
        )
        
        assert company.company_name == "Test Corp"  # Required field unchanged
        assert company.address is None
        assert company.email is None
        assert company.phone is None
        assert company.gst_no is None
        assert company.registration_number is None
        
        print("✅ PASS: Update info with None values works")

    def test_maximum_length_validation(self):
        """Test validation with maximum allowed lengths"""
        print("Test 36: Maximum length validation")
        
        max_name = "A" * 255  # Maximum allowed
        max_email = "a" * 245 + "@test.com"  # 255 chars total
        max_phone = "1" * 50  # Maximum allowed
        max_gst = "G" * 50  # Maximum allowed
        max_reg = "R" * 100  # Maximum allowed
        
        company = Company(
            company_name=max_name,
            email=max_email,
            phone=max_phone,
            gst_no=max_gst,
            registration_number=max_reg
        )
        
        assert len(company.company_name) == 255
        assert len(company.email) == 255
        assert len(company.phone) == 50
        assert len(company.gst_no) == 50
        assert len(company.registration_number) == 100
        
        print("✅ PASS: Maximum length validation works")

    def test_company_name_trimming(self):
        """Test that company name is trimmed of leading/trailing whitespace"""
        print("Test 37: Company name trimming")
        
        company = Company(company_name="  Trimmed Corp  ")
        
        assert company.company_name == "Trimmed Corp"
        
        print("✅ PASS: Company name trimming works")

    def test_update_info_trimming(self):
        """Test that update_info trims whitespace from all fields"""
        print("Test 38: Update info field trimming")
        
        company = Company(company_name="Test Corp")
        
        company.update_info(
            company_name="  Updated Corp  ",
            address="  Updated Address  ",
            email="  updated@corp.com  ",
            phone="  +1-555-999-8888  "
        )
        
        assert company.company_name == "Updated Corp"
        assert company.address == "Updated Address"
        assert company.email == "updated@corp.com"
        assert company.phone == "+1-555-999-8888"
        
        print("✅ PASS: Update info field trimming works")

    def test_case_sensitivity_gst_registration(self):
        """Test case sensitivity handling for GST and registration numbers"""
        print("Test 39: Case sensitivity for GST and registration")
        
        company = Company(
            company_name="Case Test Corp",
            gst_no="MiXeD27cAsE123",
            registration_number="rEg123MiXeD456"
        )
        
        assert company.gst_no == "MIXED27CASE123"
        assert company.registration_number == "REG123MIXED456"
        
        print("✅ PASS: Case sensitivity handling works")

    def test_initialization_default_values(self):
        """Test that default values are set correctly on initialization"""
        print("Test 40: Initialization default values")
        
        company = Company(company_name="Default Test Corp")
        
        # Check that is_active is True by default (from BaseModel)
        assert company.is_active is True
        assert company.id is not None
        assert isinstance(company.id, str) or hasattr(company.id, 'hex')  # UUID
        
        print("✅ PASS: Initialization default values work")

    def test_company_field_none_handling(self):
        """Test proper handling of None values for optional fields"""
        print("Test 41: None value handling for optional fields")
        
        company = Company(
            company_name="None Test Corp",
            address=None,
            email=None,
            phone=None,
            gst_no=None,
            registration_number=None
        )
        
        assert company.address is None
        assert company.email is None
        assert company.phone is None
        assert company.gst_no is None
        assert company.registration_number is None
        
        print("✅ PASS: None value handling works")

    def test_empty_string_vs_none_distinction(self):
        """Test distinction between empty strings and None values"""
        print("Test 42: Empty string vs None distinction")
        
        # Empty strings should raise validation errors
        try:
            Company(company_name="Test", email="")
            assert False, "Empty string should raise error"
        except ValueError:
            pass  # Expected
        
        # None should be accepted
        company = Company(company_name="Test", email=None)
        assert company.email is None
        
        print("✅ PASS: Empty string vs None distinction works")

    def test_sequential_updates(self):
        """Test multiple sequential updates to the same company"""
        print("Test 43: Sequential updates")
        
        company = Company(company_name="Sequential Corp")
        
        # First update
        company.update_info(email="first@corp.com")
        assert company.email == "first@corp.com"
        
        # Second update
        company.update_info(phone="555-1111")
        assert company.email == "first@corp.com"  # Should remain
        assert company.phone == "555-1111"
        
        # Third update
        company.update_info(email="second@corp.com", phone="555-2222")
        assert company.email == "second@corp.com"
        assert company.phone == "555-2222"
        
        print("✅ PASS: Sequential updates work")

    def test_special_characters_in_fields(self):
        """Test handling of special characters in various fields"""
        print("Test 44: Special characters in fields")
        
        company = Company(
            company_name="Special & Co. (Pvt.) Ltd.",
            address="Building #1, Floor-2\nSuite 3A/B",
            phone="+91-11-2345-6789 ext.123"
        )
        
        assert "Special & Co. (Pvt.) Ltd." == company.company_name
        assert "Building #1, Floor-2\nSuite 3A/B" == company.address
        assert "+91-11-2345-6789 ext.123" == company.phone
        
        print("✅ PASS: Special characters handling works")

    def test_unicode_characters_support(self):
        """Test support for unicode characters"""
        print("Test 45: Unicode characters support")
        
        company = Company(
            company_name="Üñíçödé Çörpöràtïön",
            address="मुख्यालय: भारत"
        )
        
        assert company.company_name == "Üñíçödé Çörpöràtïön"
        assert company.address == "मुख्यालय: भारत"
        
        print("✅ PASS: Unicode characters support works")


def run_business_logic_tests():
    """Run all business logic tests"""
    print("="*80)
    print("🧪 COMPANY BUSINESS LOGIC TESTING SUITE")
    print("="*80)
    print("Testing Company model methods, properties, and validation rules")
    print("")
    
    test_suite = TestCompanyBusinessLogic()
    
    # Get all test methods
    test_methods = [method for method in dir(test_suite) if method.startswith('test_')]
    
    passed_tests = 0
    failed_tests = 0
    total_tests = len(test_methods)
    
    print(f"Running {total_tests} business logic tests...\n")
    
    for test_method in test_methods:
        try:
            method = getattr(test_suite, test_method)
            method()
            passed_tests += 1
        except Exception as e:
            print(f"❌ FAIL: {test_method} - {str(e)}")
            failed_tests += 1
        except AssertionError as e:
            print(f"❌ FAIL: {test_method} - Assertion failed: {str(e)}")
            failed_tests += 1
    
    print("\n" + "="*80)
    print("🧪 COMPANY BUSINESS LOGIC TEST RESULTS")
    print("="*80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests / total_tests * 100):.1f}%")
    
    if failed_tests == 0:
        print("\n🎉 ALL BUSINESS LOGIC TESTS PASSED! 🎉")
        print("The Company model business logic is working correctly!")
        return 0
    else:
        print(f"\n❌ {failed_tests} tests failed")
        return 1


if __name__ == "__main__":
    exit_code = run_business_logic_tests()
    sys.exit(exit_code)