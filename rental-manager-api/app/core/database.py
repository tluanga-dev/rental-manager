from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import MetaData
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Naming convention for constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

# Create declarative base with custom metadata
Base = declarative_base(metadata=metadata)


class DatabaseManager:
    """Manages database connections and sessions"""

    def __init__(self):
        self.engine: Optional[AsyncEngine] = None
        self.async_session_maker: Optional[async_sessionmaker] = None

    async def connect(self) -> None:
        """Initialize database connection"""
        try:
            # Create async engine with connection pooling
            self.engine = create_async_engine(
                settings.DATABASE_URL,
                echo=settings.DEBUG,  # Log SQL queries in debug mode
                pool_size=20,
                max_overflow=40,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,  # Recycle connections after 1 hour
                # Use NullPool for testing to avoid connection issues
                poolclass=NullPool if settings.is_testing else None,
            )

            # Create async session maker
            self.async_session_maker = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
            )

            # Test the connection
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda _: None)

            logger.info("Database connection established successfully")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def disconnect(self) -> None:
        """Close database connection"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connection closed")

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session"""
        if not self.async_session_maker:
            raise RuntimeError("Database not initialized. Call connect() first.")

        async with self.async_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# Global database manager instance
db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session.
    Usage in FastAPI endpoints:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async for session in db_manager.get_session():
        yield session


async def init_db() -> None:
    """Initialize database tables (for development/testing)"""
    if not db_manager.engine:
        await db_manager.connect()

    async with db_manager.engine.begin() as conn:
        # Import all models to ensure they're registered
        from app.models import user  # noqa

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")


async def drop_db() -> None:
    """Drop all database tables (for testing)"""
    if not db_manager.engine:
        await db_manager.connect()

    async with db_manager.engine.begin() as conn:
        # Drop all tables
        await conn.run_sync(Base.metadata.drop_all)
        logger.info("Database tables dropped successfully")


async def get_async_session_direct() -> AsyncGenerator[AsyncSession, None]:
    """
    Direct database session access for scripts and testing.
    This initializes the database connection if needed.
    """
    if not db_manager.async_session_maker:
        await db_manager.connect()
    
    async for session in db_manager.get_session():
        yield session