#!/usr/bin/env python3
"""
Comprehensive Code Coverage Analysis for Rental Manager API
Analyzes test coverage across all implemented modules
"""

import subprocess
import sys
import os
from pathlib import Path
import json
import time

class ComprehensiveCoverageAnalyzer:
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.test_env = self.project_root / "test_env"
        self.coverage_dir = self.project_root / "coverage_reports" 
        self.coverage_dir.mkdir(exist_ok=True)
        
        # Modules to analyze
        self.modules = {
            "Brand Management": "app.models.brand,app.schemas.brand,app.crud.brand,app.services.brand,app.api.v1.endpoints.brands",
            "Category Management": "app.models.category,app.schemas.category,app.crud.category,app.services.category,app.api.v1.endpoints.categories", 
            "Unit of Measurement": "app.models.unit_of_measurement,app.schemas.unit_of_measurement,app.crud.unit_of_measurement,app.services.unit_of_measurement,app.api.v1.endpoints.unit_of_measurements",
            "Item Management": "app.models.item,app.schemas.item,app.crud.item,app.services.item,app.services.sku_generator,app.services.item_rental_blocking,app.api.v1.endpoints.items",
            "Customer Management": "app.models.customer,app.schemas.customer,app.crud.customer,app.services.customer,app.api.v1.endpoints.customers",
            "Core Infrastructure": "app.core,app.db"
        }
        
    def activate_test_env(self):
        """Activate test environment"""
        activate_script = self.test_env / "bin" / "activate"
        if not activate_script.exists():
            print(f"❌ Test environment not found at {self.test_env}")
            return False
        return True
        
    def run_command_in_test_env(self, command_list, capture_output=True):
        """Run command in test environment"""
        # Prepare environment
        env = os.environ.copy()
        env['VIRTUAL_ENV'] = str(self.test_env)
        env['PATH'] = f"{self.test_env}/bin:{env['PATH']}"
        
        try:
            result = subprocess.run(
                command_list,
                cwd=self.project_root,
                env=env,
                capture_output=capture_output,
                text=True,
                timeout=300  # 5 minute timeout
            )
            return result
        except subprocess.TimeoutExpired:
            print(f"❌ Command timed out: {' '.join(command_list)}")
            return None
        except Exception as e:
            print(f"❌ Error running command: {e}")
            return None
            
    def find_test_files(self):
        """Find all test files in the project"""
        test_files = []
        
        # Look for test files in various locations
        test_patterns = [
            "test_*.py",
            "*_test.py", 
            "tests/**/*.py",
            "test_*/**/*.py"
        ]
        
        for pattern in test_patterns:
            for test_file in self.project_root.glob(pattern):
                if test_file.is_file() and "__pycache__" not in str(test_file):
                    test_files.append(test_file)
                    
        # Remove duplicates
        test_files = list(set(test_files))
        
        print(f"📁 Found {len(test_files)} test files:")
        for test_file in sorted(test_files)[:10]:  # Show first 10
            rel_path = test_file.relative_to(self.project_root)
            print(f"  - {rel_path}")
        if len(test_files) > 10:
            print(f"  ... and {len(test_files) - 10} more")
            
        return test_files
        
    def run_module_coverage(self, module_name, module_path):
        """Run coverage for specific module"""
        print(f"\n🔍 Analyzing {module_name} coverage...")
        
        # Find related test files
        module_parts = module_path.split(',')[0].split('.')[-1]  # Get main module name
        related_tests = []
        
        for test_file in self.find_test_files():
            if module_parts.lower() in str(test_file).lower():
                related_tests.append(str(test_file.relative_to(self.project_root)))
                
        if not related_tests:
            print(f"  ⚠️  No specific tests found for {module_name}")
            return 0.0, "NO_TESTS"
            
        print(f"  📝 Running {len(related_tests)} test files...")
        
        # Run pytest with coverage for this module
        cmd = [
            str(self.test_env / "bin" / "python"), "-m", "pytest",
            "--cov=" + module_path.replace(',', ' --cov='),
            "--cov-report=term-missing",
            "--cov-report=json:" + str(self.coverage_dir / f"{module_name.replace(' ', '_')}_coverage.json"),
            "-v", "--tb=short"
        ] + related_tests
        
        result = self.run_command_in_test_env(cmd)
        
        if result and result.returncode == 0:
            print(f"  ✅ {module_name} tests passed")
            
            # Extract coverage percentage
            try:
                coverage_file = self.coverage_dir / f"{module_name.replace(' ', '_')}_coverage.json"
                if coverage_file.exists():
                    with open(coverage_file) as f:
                        coverage_data = json.load(f)
                        total_coverage = coverage_data.get('totals', {}).get('percent_covered', 0)
                        return total_coverage, "SUCCESS"
            except:
                pass
                
        print(f"  ❌ {module_name} tests failed or no coverage data")
        return 0.0, "FAILED"
        
    def run_comprehensive_analysis(self):
        """Run comprehensive coverage analysis"""
        print("🚀 Starting Comprehensive Coverage Analysis")
        print("=" * 80)
        
        if not self.activate_test_env():
            return False
            
        # Clear previous coverage data
        print("🧹 Cleaning previous coverage data...")
        self.run_command_in_test_env([
            str(self.test_env / "bin" / "python"), "-m", "coverage", "erase"
        ])
        
        results = {}
        total_coverage = 0
        successful_modules = 0
        
        # Analyze each module
        for module_name, module_path in self.modules.items():
            coverage, status = self.run_module_coverage(module_name, module_path)
            results[module_name] = {
                'coverage': coverage,
                'status': status
            }
            
            if status == "SUCCESS":
                total_coverage += coverage
                successful_modules += 1
                
        # Calculate average coverage
        avg_coverage = total_coverage / successful_modules if successful_modules > 0 else 0
        
        # Generate overall report
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE COVERAGE ANALYSIS RESULTS")
        print("=" * 80)
        
        print(f"{'Module':<25} {'Coverage':<12} {'Status':<12}")
        print("-" * 50)
        
        for module_name, data in results.items():
            coverage = data['coverage']
            status = data['status']
            status_emoji = "✅" if status == "SUCCESS" else "❌" if status == "FAILED" else "⚠️"
            print(f"{module_name:<25} {coverage:>6.1f}%    {status_emoji} {status}")
            
        print("-" * 50)
        print(f"{'AVERAGE COVERAGE':<25} {avg_coverage:>6.1f}%")
        
        # Coverage assessment
        print(f"\n📈 Coverage Assessment:")
        if avg_coverage >= 90:
            print("🎉 EXCELLENT! Outstanding code coverage (≥90%)")
            grade = "A+"
        elif avg_coverage >= 80:
            print("✅ VERY GOOD! High code coverage (≥80%)")
            grade = "A"
        elif avg_coverage >= 70:
            print("✅ GOOD! Acceptable code coverage (≥70%)")  
            grade = "B"
        elif avg_coverage >= 60:
            print("⚠️ FAIR! Code coverage needs improvement (≥60%)")
            grade = "C"
        else:
            print("❌ LOW! Significant coverage gaps (<60%)")
            grade = "D"
            
        # Module-specific insights
        print(f"\n🔍 Module Analysis:")
        high_coverage = [name for name, data in results.items() if data['coverage'] >= 80]
        medium_coverage = [name for name, data in results.items() if 60 <= data['coverage'] < 80]
        low_coverage = [name for name, data in results.items() if data['coverage'] < 60]
        
        if high_coverage:
            print(f"✅ Well-tested modules ({len(high_coverage)}): {', '.join(high_coverage)}")
        if medium_coverage:
            print(f"⚠️ Moderate coverage ({len(medium_coverage)}): {', '.join(medium_coverage)}")
        if low_coverage:
            print(f"❌ Need attention ({len(low_coverage)}): {', '.join(low_coverage)}")
            
        # Save summary report
        summary = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'average_coverage': avg_coverage,
            'grade': grade,
            'modules': results,
            'high_coverage_modules': high_coverage,
            'medium_coverage_modules': medium_coverage,
            'low_coverage_modules': low_coverage,
            'total_modules_analyzed': len(self.modules),
            'successful_modules': successful_modules
        }
        
        with open(self.coverage_dir / "coverage_summary.json", "w") as f:
            json.dump(summary, f, indent=2)
            
        print(f"\n📄 Detailed coverage reports saved to: {self.coverage_dir}")
        
        return avg_coverage >= 70  # Consider 70%+ as success

def main():
    analyzer = ComprehensiveCoverageAnalyzer()
    success = analyzer.run_comprehensive_analysis()
    
    if success:
        print("\n🎉 Coverage analysis completed successfully!")
        sys.exit(0)
    else:
        print("\n⚠️ Coverage analysis completed with recommendations for improvement.")
        sys.exit(0)  # Don't fail since this is analysis

if __name__ == "__main__":
    main()