from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Any, Dict
import os
from pathlib import Path


class Settings(BaseSettings):
    # Project Info
    PROJECT_NAME: str = "FastAPI Project"
    PROJECT_DESCRIPTION: str = "A modern FastAPI application with PostgreSQL and JWT authentication"
    PROJECT_VERSION: str = "1.0.0"
    
    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = Field(default=8000, env="PORT")  # Railway sets PORT env var
    DEBUG: bool = False
    
    # Database Settings
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://tluanga@localhost:5432/postgres"
    )
    DATABASE_ECHO: bool = Field(default=False)
    
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
    
    # Redis Settings
    REDIS_URL: str = Field(
        default="redis://localhost:6379"
    )
    
    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def validate_redis_url(cls, v: str) -> str:
        """Validate and format Redis URL"""
        if v:
            # Handle Railway v2 private networking for Redis
            if ".railway.internal" in v:
                # Ensure Redis URL has proper protocol
                if not v.startswith("redis://") and not v.startswith("rediss://"):
                    v = f"redis://{v}"
            
            # Handle Redis with auth (Railway provides this format)
            if v.startswith("rediss://"):
                # rediss:// is Redis over TLS, keep as is
                pass
            elif "redis.railway.internal" in v and not v.startswith("redis://"):
                v = f"redis://{v}"
        
        return v
    
    # Security Settings
    SECRET_KEY: str = Field(
        default="your-secret-key-here-change-in-production"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS Settings (deprecated - now managed by whitelist.json)
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"
    )
    
    # Whitelist Configuration
    USE_WHITELIST_CONFIG: bool = Field(default=True)
    WHITELIST_CONFIG_PATH: Optional[str] = Field(default=None)
    
    # Password Settings
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_BCRYPT_ROUNDS: int = 12
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    # Email Settings (optional)
    SMTP_HOST: Optional[str] = Field(default=None)
    SMTP_PORT: Optional[int] = Field(default=None)
    SMTP_USERNAME: Optional[str] = Field(default=None)
    SMTP_PASSWORD: Optional[str] = Field(default=None)
    SMTP_TLS: bool = Field(default=True)
    
    # File Upload Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIRECTORY: str = "uploads"
    
    # Admin User Settings (for initialization)
    ADMIN_USERNAME: str = Field(default="admin")
    ADMIN_EMAIL: str = Field(default="admin@admin.com")
    ADMIN_PASSWORD: str = Field(default="K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
    ADMIN_FULL_NAME: str = Field(default="System Administrator")
    
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
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v):
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL URL")
        return v
    
    @field_validator("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "":
            return None
        return v
    
    @field_validator("SMTP_PORT", mode="before")
    @classmethod
    def parse_smtp_port(cls, v):
        if v == "" or v is None:
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        env_nested_delimiter="__",
        extra="ignore"  # Ignore extra fields from environment
    )


# Create settings instance
settings = Settings()

# Ensure upload directory exists
Path(settings.UPLOAD_DIRECTORY).mkdir(exist_ok=True)