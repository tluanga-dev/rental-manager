"""
Configuration for Rental Manager Management Tools

Handles database connections to Docker PostgreSQL and other system configuration.
"""

import os
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text


@dataclass
class DatabaseConfig:
    """Database configuration for Docker PostgreSQL"""
    
    # Docker PostgreSQL connection (from docker-compose.yml)
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "rental_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "rental_pass")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "rental_db")
    
    @property
    def DATABASE_URL(self) -> str:
        """PostgreSQL connection string for Docker instance"""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Synchronous URL for Alembic migrations"""
        return self.DATABASE_URL.replace("+asyncpg", "")


@dataclass
class AdminConfig:
    """Admin user configuration"""
    
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@admin.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
    ADMIN_FULL_NAME: str = os.getenv("ADMIN_FULL_NAME", "System Administrator")
    
    def validate_admin_password(self) -> tuple[bool, str]:
        """Validate admin password strength"""
        password = self.ADMIN_PASSWORD
        
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?" for c in password)
        
        if not all([has_upper, has_lower, has_digit, has_special]):
            return False, "Password must contain uppercase, lowercase, number, and special character"
        
        return True, "Password is valid"
    
    def validate_admin_email(self) -> tuple[bool, str]:
        """Validate admin email format"""
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, self.ADMIN_EMAIL):
            return False, "Invalid email format"
        return True, "Email is valid"
    
    def validate_admin_username(self) -> tuple[bool, str]:
        """Validate admin username format"""
        import re
        username = self.ADMIN_USERNAME
        
        if len(username) < 3 or len(username) > 50:
            return False, "Username must be between 3 and 50 characters"
        
        username_pattern = r'^[a-zA-Z0-9_]+$'
        if not re.match(username_pattern, username):
            return False, "Username can only contain letters, numbers, and underscores"
        
        return True, "Username is valid"


@dataclass
class RedisConfig:
    """Redis configuration for Docker Redis"""
    
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


class Config:
    """Main configuration class for management tools"""
    
    def __init__(self):
        # Load configurations
        self.db = DatabaseConfig()
        self.admin = AdminConfig()
        self.redis = RedisConfig()
        
        # Setup paths
        self.BASE_DIR = Path(__file__).parent
        self.DATA_DIR = self.BASE_DIR / "data"
        self.BACKUP_DIR = self.BASE_DIR / "backups"
        self.RENTAL_API_DIR = self.BASE_DIR.parent / "rental-manager-api"
        
        # Ensure directories exist
        self.DATA_DIR.mkdir(exist_ok=True)
        self.BACKUP_DIR.mkdir(exist_ok=True)
        
        # Database engine setup
        self.engine = None
        self.AsyncSessionLocal = None
        self._setup_database()
        
        # Logging setup
        self._setup_logging()
    
    def _setup_database(self):
        """Setup async database engine and session"""
        try:
            self.engine = create_async_engine(
                self.db.DATABASE_URL,
                echo=False,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_recycle=3600  # Recycle connections every hour
            )
            
            self.AsyncSessionLocal = sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
        except Exception as e:
            logging.error(f"Failed to setup database: {e}")
            raise
    
    def _setup_logging(self):
        """Setup logging configuration"""
        log_level = os.getenv("LOG_LEVEL", "INFO")
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        
        logging.basicConfig(
            level=getattr(logging, log_level.upper()),
            format=log_format,
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(self.BASE_DIR / "management.log")
            ]
        )
    
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session"""
        if not self.AsyncSessionLocal:
            raise RuntimeError("Database not configured properly")
        
        async with self.AsyncSessionLocal() as session:
            try:
                yield session
            except Exception as e:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def test_database_connection(self) -> tuple[bool, str]:
        """Test database connection"""
        try:
            async for session in self.get_session():
                result = await session.execute(text("SELECT 1 as test"))
                row = result.fetchone()
                if row and row[0] == 1:
                    return True, "Database connection successful"
                return False, "Database connection test failed"
        except Exception as e:
            return False, f"Database connection error: {str(e)}"
    
    async def test_redis_connection(self) -> tuple[bool, str]:
        """Test Redis connection"""
        try:
            import redis.asyncio as redis
            
            r = redis.from_url(self.redis.REDIS_URL)
            await r.ping()
            await r.close()
            return True, "Redis connection successful"
        except Exception as e:
            return False, f"Redis connection error: {str(e)}"
    
    def validate_environment(self) -> tuple[bool, list[str]]:
        """Validate all configuration"""
        issues = []
        
        # Validate admin configuration
        valid_password, password_msg = self.admin.validate_admin_password()
        if not valid_password:
            issues.append(f"Admin password: {password_msg}")
        
        valid_email, email_msg = self.admin.validate_admin_email()
        if not valid_email:
            issues.append(f"Admin email: {email_msg}")
        
        valid_username, username_msg = self.admin.validate_admin_username()
        if not valid_username:
            issues.append(f"Admin username: {username_msg}")
        
        # Check required directories
        if not self.RENTAL_API_DIR.exists():
            issues.append(f"Rental API directory not found: {self.RENTAL_API_DIR}")
        
        return len(issues) == 0, issues


# Global config instance
config = Config()