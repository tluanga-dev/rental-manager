#!/usr/bin/env python3
"""
Location Module Test Runner

Runs comprehensive location module tests without Docker compose to avoid timeout issues.
Executes tests in proper order: setup -> unit -> integration -> API -> coverage.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path


def run_command(command: str, description: str) -> bool:
    """Run a command and return success status."""
    print(f"\n{'='*60}")
    print(f"🚀 {description}")
    print(f"{'='*60}")
    print(f"Command: {command}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=False,
            text=True
        )
        print(f"✅ {description} - SUCCESS")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - FAILED")
        print(f"Exit code: {e.returncode}")
        return False


async def main():
    """Run comprehensive location module tests."""
    print("🧪 LOCATION MODULE COMPREHENSIVE TEST RUNNER")
    print("=" * 60)
    
    # Change to project directory
    os.chdir(Path(__file__).parent.parent)
    
    success_count = 0
    total_tests = 0
    
    test_stages = [
        {
            "command": "python -m pytest tests/unit/test_location_model.py -v --tb=short",
            "description": "Unit Tests - Location Model"
        },
        {
            "command": "python -m pytest tests/integration/test_location_crud.py -v --tb=short",
            "description": "Integration Tests - Location CRUD"
        },
        {
            "command": "python -m pytest tests/integration/test_location_api.py -v --tb=short",
            "description": "API Tests - Location Endpoints"
        },
        {
            "command": "python -m pytest tests/load/test_location_performance.py::test_location_performance_comprehensive -v --tb=short -s",
            "description": "Performance Tests - Location Performance"
        },
        {
            "command": """python -m pytest tests/unit/test_location_model.py \
               tests/integration/test_location_crud.py \
               tests/integration/test_location_api.py \
          --cov=app.models.location \
          --cov=app.crud.location \
          --cov=app.services.location \
          --cov=app.api.v1.endpoints.locations \
          --cov=app.schemas.location \
          --cov-report=html:coverage_reports/location_module \
          --cov-report=xml:coverage_reports/location_coverage.xml \
          --cov-report=term-missing \
          --cov-fail-under=80""",
            "description": "Coverage Report Generation"
        }
    ]
    
    for stage in test_stages:
        total_tests += 1
        if run_command(stage["command"], stage["description"]):
            success_count += 1
        else:
            print(f"\n⚠️  Continuing with remaining tests...")
    
    print(f"\n{'='*60}")
    print(f"🏆 TEST EXECUTION SUMMARY")
    print(f"{'='*60}")
    print(f"✅ Successful: {success_count}/{total_tests}")
    print(f"❌ Failed: {total_tests - success_count}/{total_tests}")
    
    if success_count == total_tests:
        print(f"🎉 ALL TESTS PASSED! Location module is ready for production.")
    else:
        print(f"⚠️  Some tests failed. Please review the output above.")
    
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())