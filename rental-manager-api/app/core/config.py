from typing import Any, List, Optional, Union
from pydantic import AnyHttpUrl, EmailStr, field_validator, ValidationInfo, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import secrets
from pathlib import Path
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "rental-manager"

    # API
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
    )
    DATABASE_ECHO: bool = Field(default=False)
    POSTGRES_USER: str = "rental_user"
    POSTGRES_PASSWORD: str = "rental_pass"
    POSTGRES_DB: str = "rental_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def convert_database_url(cls, v: str) -> str:
        """Convert Railway's postgres:// to postgresql+asyncpg://"""
        if v:
            # Handle Railway's postgres:// URLs (Railway provides this format)
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql://", 1)
            
            # Handle Railway v2 private networking URLs
            if ".railway.internal" in v:
                # Railway v2 uses private networking, ensure proper format
                if not v.startswith("postgresql"):
                    v = f"postgresql://{v}"
            
            # Convert to async URL for asyncpg
            if "postgresql://" in v and "+asyncpg" not in v:
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            
            # Handle localhost for local development
            if "localhost" in v or "127.0.0.1" in v:
                if "postgresql://" in v and "+asyncpg" not in v:
                    v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        return v

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: Optional[str] = None
    REDIS_CACHE_TTL: int = 3600  # 1 hour default

    # CORS Settings (deprecated - now managed by whitelist.json)
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Whitelist Configuration
    USE_WHITELIST_CONFIG: bool = Field(default=True)
    WHITELIST_CONFIG_PATH: Optional[str] = Field(default=None)

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Security
    BCRYPT_ROUNDS: int = 12

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: EmailStr = "noreply@rentalmanager.com"
    EMAILS_FROM_NAME: str = "Rental Manager"

    # File Upload
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: Path = Path("uploads")
    UPLOAD_DIRECTORY: str = "uploads"
    
    # Admin User Settings (for initialization)
    ADMIN_USERNAME: str = Field(default="admin")
    ADMIN_EMAIL: str = Field(default="admin@admin.com")
    ADMIN_PASSWORD: str = Field(default="K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
    ADMIN_FULL_NAME: str = Field(default="System Administrator")

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text

    # Monitoring
    ENABLE_OPENTELEMETRY: bool = False
    OTLP_ENDPOINT: Optional[str] = None

    # Development Authentication Control
    DISABLE_AUTH_IN_DEV: bool = Field(default=True)
    DEV_MOCK_USER_ID: str = Field(default="dev-user-1")
    DEV_MOCK_USER_EMAIL: str = Field(default="dev@example.com")
    DEV_MOCK_USER_ROLE: str = Field(default="ADMIN")

    @field_validator("ADMIN_PASSWORD", mode="before")
    @classmethod
    def validate_admin_password(cls, v: str) -> str:
        """Validate admin password strength"""
        if len(v) < 8:
            raise ValueError("Admin password must be at least 8 characters long")
        
        # Check for complexity (at least one of each: uppercase, lowercase, number, special char)
        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        has_special = any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?" for c in v)
        
        if not all([has_upper, has_lower, has_digit, has_special]):
            raise ValueError("Admin password must contain uppercase, lowercase, number, and special character")
        
        return v
    
    @field_validator("ADMIN_EMAIL", mode="before")
    @classmethod
    def validate_admin_email(cls, v: str) -> str:
        """Validate admin email format"""
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError("Admin email must be a valid email address")
        return v
    
    @field_validator("ADMIN_USERNAME", mode="before")
    @classmethod
    def validate_admin_username(cls, v: str) -> str:
        """Validate admin username format"""
        import re
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Admin username must be between 3 and 50 characters")
        
        username_pattern = r'^[a-zA-Z0-9_]+$'
        if not re.match(username_pattern, v):
            raise ValueError("Admin username can only contain letters, numbers, and underscores")
        
        return v

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if v == "your-secret-key-change-in-production":
            if cls.model_config.get("ENVIRONMENT") == "production":
                raise ValueError("You must set a secure SECRET_KEY in production")
        return v

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for Alembic migrations"""
        return self.DATABASE_URL.replace("+asyncpg", "")

    @property
    def redis_url_with_password(self) -> str:
        """Get Redis URL with password if set"""
        if self.REDIS_PASSWORD:
            return self.REDIS_URL.replace("redis://", f"redis://:{self.REDIS_PASSWORD}@")
        return self.REDIS_URL

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "testing"
    
    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as a list"""
        if self.USE_WHITELIST_CONFIG:
            try:
                from app.core.whitelist import get_cors_origins
                return get_cors_origins()
            except (ImportError, Exception) as e:
                # Fallback to old method if whitelist module is not available or fails
                print(f"Warning: Whitelist configuration failed, using fallback CORS origins: {e}")
        
        # Fallback to environment variable configuration
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:3000", "http://localhost:8000"]  # Safe defaults
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def auth_disabled(self) -> bool:
        """Check if authentication should be disabled"""
        return self.is_development and self.DEBUG and self.DISABLE_AUTH_IN_DEV


settings = Settings()

# Ensure upload directory exists
Path(settings.UPLOAD_DIRECTORY).mkdir(exist_ok=True)