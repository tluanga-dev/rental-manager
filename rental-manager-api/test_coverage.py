#!/usr/bin/env python3
"""
Coverage Test Runner for Customer Management System
Runs comprehensive tests to measure code coverage
"""

import asyncio
import subprocess
import sys
import os
from pathlib import Path

class CoverageTestRunner:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.coverage_dir = self.project_root / "coverage_reports"
        self.coverage_dir.mkdir(exist_ok=True)
    
    def run_api_tests_with_coverage(self):
        """Run the API test script with coverage measurement"""
        print("🔍 Running API tests with coverage measurement...")
        
        try:
            # Run the API test with coverage
            result = subprocess.run([
                "python3", "-m", "coverage", "run", 
                "--source=app", 
                "--omit=*/tests/*,*/test_*",
                "test_customer_api.py"
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            print(f"API Test Exit Code: {result.returncode}")
            if result.stdout:
                print("STDOUT:", result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
                
            return result.returncode == 0
            
        except Exception as e:
            print(f"❌ Error running API tests with coverage: {e}")
            return False
    
    def run_unit_tests_with_coverage(self):
        """Run unit tests with pytest and coverage"""
        print("🧪 Creating and running unit tests with coverage...")
        
        # Create a simple unit test file
        unit_test_content = '''
import pytest
from app.models.customer import Customer, CustomerType, CustomerStatus, BlacklistStatus, CreditRating
from app.schemas.customer import CustomerCreate, CustomerResponse
from app.services.customer import CustomerService
from app.crud.customer import CustomerRepository

def test_customer_model_creation():
    """Test customer model instantiation"""
    # This would normally use a test database
    assert CustomerType.INDIVIDUAL == "INDIVIDUAL"
    assert CustomerStatus.ACTIVE == "ACTIVE"
    assert BlacklistStatus.CLEAR == "CLEAR"
    assert CreditRating.GOOD == "GOOD"

def test_customer_schemas():
    """Test customer schemas"""
    customer_data = {
        "customer_code": "TEST_001",
        "customer_type": "INDIVIDUAL",
        "first_name": "John",
        "last_name": "Doe", 
        "email": "john@test.com",
        "phone": "+1234567890",
        "address_line1": "123 Main St",
        "city": "Test City",
        "state": "TS",
        "postal_code": "12345",
        "country": "USA"
    }
    
    schema = CustomerCreate(**customer_data)
    assert schema.customer_code == "TEST_001"
    assert schema.customer_type == "INDIVIDUAL"
    assert schema.first_name == "John"

def test_customer_enums():
    """Test all customer enum values"""
    # Test CustomerType
    assert CustomerType.INDIVIDUAL.value == "INDIVIDUAL"
    assert CustomerType.BUSINESS.value == "BUSINESS"
    
    # Test CustomerStatus  
    assert CustomerStatus.ACTIVE.value == "ACTIVE"
    assert CustomerStatus.INACTIVE.value == "INACTIVE"
    assert CustomerStatus.SUSPENDED.value == "SUSPENDED"
    assert CustomerStatus.PENDING.value == "PENDING"
    
    # Test BlacklistStatus
    assert BlacklistStatus.CLEAR.value == "CLEAR"
    assert BlacklistStatus.WARNING.value == "WARNING" 
    assert BlacklistStatus.BLACKLISTED.value == "BLACKLISTED"
    
    # Test CreditRating
    assert CreditRating.EXCELLENT.value == "EXCELLENT"
    assert CreditRating.GOOD.value == "GOOD"
    assert CreditRating.FAIR.value == "FAIR"
    assert CreditRating.POOR.value == "POOR"
    assert CreditRating.NO_RATING.value == "NO_RATING"
'''
        
        unit_test_file = self.project_root / "test_unit.py"
        with open(unit_test_file, 'w') as f:
            f.write(unit_test_content)
        
        try:
            # Run pytest with coverage
            result = subprocess.run([
                "python3", "-m", "pytest", 
                "test_unit.py", 
                "--cov=app",
                "--cov-append",
                "--cov-report=term-missing",
                "-v"
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            print(f"Unit Test Exit Code: {result.returncode}")
            if result.stdout:
                print("STDOUT:", result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
                
            return result.returncode == 0
            
        except Exception as e:
            print(f"❌ Error running unit tests: {e}")
            return False
    
    def generate_coverage_report(self):
        """Generate comprehensive coverage report"""
        print("📊 Generating coverage report...")
        
        try:
            # Generate terminal report
            result = subprocess.run([
                "python3", "-m", "coverage", "report", 
                "--show-missing",
                "--skip-covered"
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            print("📋 COVERAGE REPORT:")
            print("=" * 80)
            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            
            # Generate HTML report
            html_result = subprocess.run([
                "python3", "-m", "coverage", "html",
                "--directory", str(self.coverage_dir / "html")
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            if html_result.returncode == 0:
                print(f"📄 HTML coverage report generated: {self.coverage_dir / 'html' / 'index.html'}")
            
            # Generate XML report for CI/CD
            xml_result = subprocess.run([
                "python3", "-m", "coverage", "xml",
                "--output", str(self.coverage_dir / "coverage.xml")
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            if xml_result.returncode == 0:
                print(f"📄 XML coverage report generated: {self.coverage_dir / 'coverage.xml'}")
            
            return result.returncode == 0
            
        except Exception as e:
            print(f"❌ Error generating coverage report: {e}")
            return False
    
    def analyze_coverage_percentage(self):
        """Extract and analyze coverage percentage"""
        print("🎯 Analyzing coverage percentage...")
        
        try:
            result = subprocess.run([
                "python3", "-m", "coverage", "report", 
                "--format=total"
            ], 
            capture_output=True, 
            text=True,
            cwd=self.project_root
            )
            
            if result.returncode == 0:
                total_coverage = result.stdout.strip()
                coverage_percent = float(total_coverage)
                
                print(f"📈 Total Coverage: {coverage_percent}%")
                
                if coverage_percent >= 90:
                    print("🎉 Excellent coverage! (≥90%)")
                    status = "EXCELLENT"
                elif coverage_percent >= 80:
                    print("✅ Good coverage! (≥80%)")
                    status = "GOOD"
                elif coverage_percent >= 70:
                    print("⚠️ Acceptable coverage (≥70%)")
                    status = "ACCEPTABLE"
                else:
                    print("❌ Low coverage (<70%)")
                    status = "LOW"
                
                return coverage_percent, status
            else:
                print("❌ Could not determine coverage percentage")
                return 0.0, "UNKNOWN"
                
        except Exception as e:
            print(f"❌ Error analyzing coverage: {e}")
            return 0.0, "ERROR"
    
    def run_comprehensive_coverage_test(self):
        """Run comprehensive coverage analysis"""
        print("🚀 Starting Comprehensive Coverage Analysis")
        print("=" * 60)
        
        # Initialize coverage
        subprocess.run([
            "python3", "-m", "coverage", "erase"
        ], cwd=self.project_root)
        
        # Run API tests with coverage
        api_success = self.run_api_tests_with_coverage()
        
        # Run unit tests with coverage
        unit_success = self.run_unit_tests_with_coverage()
        
        # Generate comprehensive report
        report_success = self.generate_coverage_report()
        
        # Analyze coverage percentage
        coverage_percent, status = self.analyze_coverage_percentage()
        
        # Final summary
        print("\n" + "=" * 60)
        print("📊 COVERAGE ANALYSIS SUMMARY")
        print("=" * 60)
        print(f"API Tests: {'✅ PASSED' if api_success else '❌ FAILED'}")
        print(f"Unit Tests: {'✅ PASSED' if unit_success else '❌ FAILED'}")
        print(f"Report Generation: {'✅ SUCCESS' if report_success else '❌ FAILED'}")
        print(f"Total Coverage: {coverage_percent}% ({status})")
        
        if coverage_percent == 100.0:
            print("🎉 PERFECT! 100% CODE COVERAGE ACHIEVED!")
            return True
        elif coverage_percent >= 90:
            print("🎉 EXCELLENT! High code coverage achieved!")
            return True
        else:
            print(f"⚠️ Coverage could be improved. Current: {coverage_percent}%")
            return False

def main():
    runner = CoverageTestRunner()
    success = runner.run_comprehensive_coverage_test()
    
    if success:
        print("\n✅ Coverage analysis completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Coverage analysis found issues!")
        sys.exit(1)

if __name__ == "__main__":
    main()