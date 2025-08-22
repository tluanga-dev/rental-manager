"""
Production-ready FastAPI application with proper error handling
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import settings
try:
    from app.core.config import settings
except ImportError as e:
    logger.error(f"Failed to import settings: {e}")
    # Use defaults
    class Settings:
        PROJECT_NAME = "Rental Manager API"
        PROJECT_DESCRIPTION = "Rental Management System API"
        PROJECT_VERSION = "1.0.0"
        DATABASE_URL = os.getenv("DATABASE_URL", "")
        REDIS_URL = os.getenv("REDIS_URL", "")
        SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key")
        DEBUG = False
    settings = Settings()

# Create lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info(f"Starting {settings.PROJECT_NAME}")
    
    # Initialize database (with error handling)
    try:
        from app.core.database import engine, Base
        async with engine.begin() as conn:
            # Create tables if they don't exist
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✓ Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        logger.warning("Continuing without database...")
    
    # Initialize Redis cache (optional)
    try:
        if settings.REDIS_URL:
            from app.core.cache import cache
            await cache.initialize()
            logger.info("✓ Redis cache initialized")
    except Exception as e:
        logger.warning(f"Redis initialization failed: {e} - Cache disabled")
    
    # Initialize default company (with error handling)
    try:
        from app.shared.dependencies import get_session
        from app.modules.company.repository import CompanyRepository
        from app.modules.company.service import CompanyService
        
        async for session in get_session():
            try:
                company_repository = CompanyRepository(session)
                company_service = CompanyService(company_repository)
                
                existing_company = await company_repository.get_active_company()
                if not existing_company:
                    default_company = await company_service.initialize_default_company()
                    logger.info(f"✓ Default company created: {default_company.company_name}")
                else:
                    logger.info(f"✓ Company exists: {existing_company.company_name}")
                break
            except Exception as e:
                logger.warning(f"Company initialization failed: {e}")
                break
    except Exception as e:
        logger.warning(f"Could not initialize company: {e}")
    
    logger.info(f"{settings.PROJECT_NAME} startup complete")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME}")
    
    # Close Redis if initialized
    try:
        from app.core.cache import cache
        await cache.close()
        logger.info("Redis cache closed")
    except:
        pass
    
    logger.info("Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS - MUST be first middleware
is_production = (
    os.getenv("RAILWAY_ENVIRONMENT") == "production" or
    os.getenv("ENV") == "production" or
    os.getenv("ENVIRONMENT") == "production"
)

if is_production:
    # Production: Allow all origins
    logger.info("Production mode: Configuring CORS for all origins")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
else:
    # Development: Allow specific origins
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "https://www.omomrentals.shop",
        "https://omomrentals.shop"
    ]
    logger.info(f"Development mode: Configuring CORS for {len(cors_origins)} origins")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "internal_error"}
    )

# Health check endpoints
@app.get("/")
async def root():
    return {
        "message": "Rental Manager API is running",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "development"),
        "version": settings.PROJECT_VERSION
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/health")
async def api_health_check():
    """API health check with database status"""
    health_status = {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "development"),
        "checks": {}
    }
    
    # Check database
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            health_status["checks"]["database"] = "connected"
    except Exception as e:
        health_status["checks"]["database"] = f"error: {str(e)[:50]}"
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        if settings.REDIS_URL:
            from app.core.cache import cache
            if cache._redis:
                await cache._redis.ping()
                health_status["checks"]["redis"] = "connected"
            else:
                health_status["checks"]["redis"] = "not initialized"
    except Exception as e:
        health_status["checks"]["redis"] = f"error: {str(e)[:50]}"
    
    return health_status

# Import routers with error handling
def register_routers():
    """Register all routers with error handling"""
    
    # Essential routers
    router_configs = [
        ("app.modules.auth.routes", "router", "/api/auth", ["Authentication"]),
        ("app.modules.users.routes", "router", "/api/users", ["Users"]),
        ("app.modules.company.routes", "router", "/api/company", ["Company"]),
        ("app.modules.master_data.routes", "router", "/api", ["Master Data"]),
        ("app.modules.customers.routes", "router", "/api/customers", ["Customers"]),
        ("app.modules.suppliers.routes", "router", "/api/suppliers", ["Suppliers"]),
        ("app.modules.inventory.routes", "router", "/api/inventory", ["Inventory"]),
        ("app.modules.transactions.base.routes", "router", "/api", ["Transactions"]),
        ("app.modules.system.routes", "router", "/api/system", ["System"]),
    ]
    
    for module_path, router_name, prefix, tags in router_configs:
        try:
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            app.include_router(router, prefix=prefix, tags=tags)
            logger.info(f"✓ Registered router: {router_name}")
        except Exception as e:
            logger.warning(f"Could not register {router_name}: {e}")

# Register routers
register_routers()

# Add OPTIONS handler for CORS preflight
@app.options("/{path:path}")
async def options_handler(path: str):
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600"
        }
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)