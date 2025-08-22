#!/usr/bin/env python3
"""
Environment Variable Validation Script for Railway Deployment
Validates all required environment variables are set before application starts
"""
import os
import sys
import json
from typing import List, Dict, Tuple

# Required environment variables with descriptions
REQUIRED_VARS = {
    # Database
    "DATABASE_URL": "PostgreSQL connection URL (postgresql+asyncpg://...)",
    
    # Security
    "SECRET_KEY": "Secret key for JWT token generation (min 32 chars)",
    
    # Admin User
    "ADMIN_USERNAME": "Initial admin username",
    "ADMIN_EMAIL": "Initial admin email",
    "ADMIN_PASSWORD": "Initial admin password (must meet security requirements)",
    "ADMIN_FULL_NAME": "Admin user's full name",
}

# Optional but recommended environment variables
OPTIONAL_VARS = {
    # Redis
    "REDIS_URL": "Redis connection URL for caching (redis://...)",
    
    # Server Configuration
    "PORT": "Port to run the application on (default: 8000)",
    "WORKERS": "Number of Gunicorn workers (default: 4)",
    "LOG_LEVEL": "Logging level (default: INFO)",
    
    # Application Settings
    "DEBUG": "Debug mode (default: false)",
    "ALLOWED_ORIGINS": "CORS allowed origins (comma-separated)",
    "USE_WHITELIST_CONFIG": "Use whitelist.json for CORS (default: true)",
    
    # Performance
    "DATABASE_POOL_SIZE": "Database connection pool size (default: 20)",
    "DATABASE_POOL_MAX_OVERFLOW": "Max overflow connections (default: 0)",
    "CACHE_ENABLED": "Enable Redis caching (default: true)",
    
    # Railway Specific
    "RAILWAY_ENVIRONMENT": "Railway environment name",
    "RAILWAY_SERVICE_NAME": "Railway service name",
}

# Security validation patterns
MIN_SECRET_KEY_LENGTH = 32
PASSWORD_MIN_LENGTH = 8


def validate_required_vars() -> Tuple[bool, List[str]]:
    """Validate all required environment variables are set."""
    missing_vars = []
    
    for var_name, description in REQUIRED_VARS.items():
        value = os.getenv(var_name)
        if not value or value.strip() == "":
            missing_vars.append(f"{var_name}: {description}")
    
    return len(missing_vars) == 0, missing_vars


def validate_security_vars() -> Tuple[bool, List[str]]:
    """Validate security-related environment variables."""
    errors = []
    
    # Validate SECRET_KEY
    secret_key = os.getenv("SECRET_KEY", "")
    if len(secret_key) < MIN_SECRET_KEY_LENGTH:
        errors.append(f"SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters long")
    
    # Validate ADMIN_PASSWORD
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if len(admin_password) < PASSWORD_MIN_LENGTH:
        errors.append(f"ADMIN_PASSWORD must be at least {PASSWORD_MIN_LENGTH} characters long")
    
    # Check password complexity (basic check)
    if admin_password and not any(c.isupper() for c in admin_password):
        errors.append("ADMIN_PASSWORD must contain at least one uppercase letter")
    if admin_password and not any(c.islower() for c in admin_password):
        errors.append("ADMIN_PASSWORD must contain at least one lowercase letter")
    if admin_password and not any(c.isdigit() for c in admin_password):
        errors.append("ADMIN_PASSWORD must contain at least one number")
    
    # Validate email format (basic check)
    admin_email = os.getenv("ADMIN_EMAIL", "")
    if admin_email and "@" not in admin_email:
        errors.append("ADMIN_EMAIL must be a valid email address")
    
    return len(errors) == 0, errors


def validate_database_url() -> Tuple[bool, List[str]]:
    """Validate DATABASE_URL format."""
    errors = []
    database_url = os.getenv("DATABASE_URL", "")
    
    if database_url:
        # Convert postgres:// to postgresql:// if needed
        if database_url.startswith("postgres://"):
            os.environ["DATABASE_URL"] = database_url.replace("postgres://", "postgresql://", 1)
            database_url = os.environ["DATABASE_URL"]
        
        # Check for asyncpg driver
        if "postgresql://" in database_url and "+asyncpg" not in database_url:
            errors.append("DATABASE_URL should use asyncpg driver (postgresql+asyncpg://...)")
    
    return len(errors) == 0, errors


def check_optional_vars() -> Dict[str, str]:
    """Check optional environment variables and return their status."""
    optional_status = {}
    
    for var_name, description in OPTIONAL_VARS.items():
        value = os.getenv(var_name)
        if value:
            optional_status[var_name] = f"✓ Set: {value[:20]}..." if len(value) > 20 else f"✓ Set: {value}"
        else:
            optional_status[var_name] = f"✗ Not set ({description})"
    
    return optional_status


def main():
    """Main validation function."""
    print("=" * 60)
    print("Environment Variable Validation for Railway Deployment")
    print("=" * 60)
    
    all_valid = True
    
    # Check required variables
    print("\n1. Checking Required Variables:")
    print("-" * 30)
    required_valid, missing_required = validate_required_vars()
    if required_valid:
        print("✓ All required variables are set")
    else:
        print("✗ Missing required variables:")
        for var in missing_required:
            print(f"  - {var}")
        all_valid = False
    
    # Check security variables
    print("\n2. Validating Security Settings:")
    print("-" * 30)
    security_valid, security_errors = validate_security_vars()
    if security_valid:
        print("✓ Security variables are properly configured")
    else:
        print("✗ Security validation errors:")
        for error in security_errors:
            print(f"  - {error}")
        all_valid = False
    
    # Check database URL
    print("\n3. Validating Database Configuration:")
    print("-" * 30)
    db_valid, db_errors = validate_database_url()
    if db_valid:
        print("✓ Database URL is properly formatted")
    else:
        print("✗ Database configuration errors:")
        for error in db_errors:
            print(f"  - {error}")
        all_valid = False
    
    # Check optional variables
    print("\n4. Optional Variables Status:")
    print("-" * 30)
    optional_status = check_optional_vars()
    for var_name, status in optional_status.items():
        print(f"  {var_name}: {status}")
    
    # Final result
    print("\n" + "=" * 60)
    if all_valid:
        print("✅ Environment validation PASSED")
        print("Your environment is ready for Railway deployment!")
    else:
        print("❌ Environment validation FAILED")
        print("Please fix the issues above before deploying to Railway")
        sys.exit(1)
    
    # Write validation report
    report = {
        "validation_passed": all_valid,
        "timestamp": os.popen("date -u +%Y-%m-%dT%H:%M:%SZ").read().strip(),
        "required_vars_ok": required_valid,
        "security_vars_ok": security_valid,
        "database_url_ok": db_valid,
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "unknown")
    }
    
    with open("/tmp/env_validation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\nValidation report written to: /tmp/env_validation_report.json")
    print("=" * 60)


if __name__ == "__main__":
    main()