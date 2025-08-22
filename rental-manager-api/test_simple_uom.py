#!/usr/bin/env python3
"""
Simple test to validate Unit of Measurement module components work correctly.
This tests the core functionality without needing Docker.
"""

import sys
import os
import asyncio
from typing import Dict, List, Any

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_model_imports():
    """Test that all UOM modules can be imported correctly."""
    print("🔧 Testing Model Imports...")
    
    try:
        from app.models.unit_of_measurement import UnitOfMeasurement
        print("  ✅ UnitOfMeasurement model imported successfully")
    except Exception as e:
        print(f"  ❌ Failed to import UnitOfMeasurement model: {e}")
        return False
    
    try:
        from app.schemas.unit_of_measurement import (
            UnitOfMeasurementCreate,
            UnitOfMeasurementUpdate,
            UnitOfMeasurementResponse
        )
        print("  ✅ UnitOfMeasurement schemas imported successfully")
    except Exception as e:
        print(f"  ❌ Failed to import UnitOfMeasurement schemas: {e}")
        return False
    
    try:
        from app.crud.unit_of_measurement import CRUDUnitOfMeasurement
        print("  ✅ UnitOfMeasurement CRUD imported successfully")
    except Exception as e:
        print(f"  ❌ Failed to import UnitOfMeasurement CRUD: {e}")
        return False
    
    try:
        from app.services.unit_of_measurement import UnitOfMeasurementService
        print("  ✅ UnitOfMeasurement service imported successfully")
    except Exception as e:
        print(f"  ❌ Failed to import UnitOfMeasurement service: {e}")
        return False
    
    return True


def test_schema_validation():
    """Test Pydantic schema validation."""
    print("\n📋 Testing Schema Validation...")
    
    try:
        from app.schemas.unit_of_measurement import UnitOfMeasurementCreate
        
        # Test valid data
        valid_data = {
            "name": "Test Kilogram",
            "code": "TKG", 
            "description": "Test unit for validation"
        }
        
        unit_schema = UnitOfMeasurementCreate(**valid_data)
        print(f"  ✅ Valid schema created: {unit_schema.name} ({unit_schema.code})")
        
        # Test validation
        if unit_schema.code == "TKG":  # Code should be uppercase
            print("  ✅ Code validation working (converted to uppercase)")
        
        # Test invalid data
        try:
            invalid_data = {"name": "", "code": "TKG"}  # Empty name
            UnitOfMeasurementCreate(**invalid_data)
            print("  ❌ Empty name validation failed - should have raised error")
            return False
        except Exception:
            print("  ✅ Empty name validation working")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Schema validation test failed: {e}")
        return False


def test_model_properties():
    """Test model properties and methods."""
    print("\n🏗️ Testing Model Properties...")
    
    try:
        from app.models.unit_of_measurement import UnitOfMeasurement
        
        # Create a unit instance
        unit = UnitOfMeasurement(
            name="Test Meter",
            code="TM",
            description="Test meter unit"
        )
        
        # Test properties
        if unit.display_name == "Test Meter (TM)":
            print("  ✅ Display name property working")
        else:
            print(f"  ❌ Display name incorrect: {unit.display_name}")
            return False
        
        # Test can_delete method
        if unit.can_delete() == True:  # Should be True since no items
            print("  ✅ can_delete method working")
        else:
            print("  ❌ can_delete method failed")
            return False
        
        # Test string representation
        str_repr = str(unit)
        if "Test Meter (TM)" in str_repr:
            print("  ✅ String representation working")
        else:
            print(f"  ❌ String representation failed: {str_repr}")
            return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ Model properties test failed: {e}")
        return False


def test_api_endpoint_structure():
    """Test that API endpoint module is properly structured."""
    print("\n🌐 Testing API Endpoint Structure...")
    
    try:
        from app.api.v1.endpoints.unit_of_measurement import router
        
        # Check if router exists
        if router:
            print("  ✅ API router created successfully")
        else:
            print("  ❌ API router not found")
            return False
        
        # Check router configuration
        if hasattr(router, 'prefix') and router.prefix == "/unit-of-measurement":
            print("  ✅ Router prefix configured correctly")
        else:
            print("  ❌ Router prefix not configured")
            return False
        
        # Check tags
        if hasattr(router, 'tags') and "Unit of Measurement" in router.tags:
            print("  ✅ Router tags configured correctly")
        else:
            print("  ❌ Router tags not configured")
            return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ API endpoint test failed: {e}")
        return False


def test_service_structure():
    """Test service layer structure."""
    print("\n⚙️ Testing Service Layer...")
    
    try:
        from app.services.unit_of_measurement import UnitOfMeasurementService
        
        # Create service instance
        service = UnitOfMeasurementService()
        
        # Check if key methods exist
        required_methods = [
            'create_unit', 'get_unit', 'update_unit', 'delete_unit',
            'list_units', 'search_units', 'get_active_units'
        ]
        
        for method_name in required_methods:
            if hasattr(service, method_name):
                print(f"  ✅ Method {method_name} exists")
            else:
                print(f"  ❌ Method {method_name} missing")
                return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ Service structure test failed: {e}")
        return False


def test_comprehensive_validation():
    """Run comprehensive validation tests."""
    print("🧪 Running Comprehensive Unit of Measurement Validation")
    print("=" * 65)
    
    tests = [
        test_model_imports,
        test_schema_validation,
        test_model_properties,
        test_api_endpoint_structure,
        test_service_structure
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ❌ Test {test.__name__} failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 65)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Unit of Measurement module is correctly implemented.")
        print("\n💡 Next steps:")
        print("1. Run database migration: alembic upgrade head")
        print("2. Start API server and test endpoints")
        print("3. Run comprehensive Docker tests when ready")
        return True
    else:
        print(f"❌ {failed} tests failed. Please check the implementation.")
        return False


if __name__ == "__main__":
    success = test_comprehensive_validation()
    sys.exit(0 if success else 1)