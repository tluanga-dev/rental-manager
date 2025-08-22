"""
Enhanced Railway deployment main module with better error handling
"""
import os
import sys
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Simple lifespan without heavy initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Rental Manager Backend (Railway Mode)")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'unknown')}")
    logger.info(f"Port: {os.getenv('PORT', '8000')}")
    
    # Check critical environment variables
    env_vars = {
        'DATABASE_URL': os.getenv('DATABASE_URL'),
        'REDIS_URL': os.getenv('REDIS_URL'),
        'SECRET_KEY': os.getenv('SECRET_KEY'),
        'ADMIN_USERNAME': os.getenv('ADMIN_USERNAME'),
        'ADMIN_EMAIL': os.getenv('ADMIN_EMAIL')
    }
    
    for var, value in env_vars.items():
        if value:
            if var in ['DATABASE_URL', 'REDIS_URL']:
                # Mask sensitive parts
                masked = value.split('@')[1] if '@' in value else 'not-set'
                logger.info(f"✅ {var}: ...@{masked}")
            else:
                logger.info(f"✅ {var}: {'***' if var == 'SECRET_KEY' else 'set'}")
        else:
            logger.warning(f"❌ {var}: NOT SET")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Rental Manager Backend")

# Create FastAPI app with minimal configuration
app = FastAPI(
    title="Rental Manager API",
    description="Rental Management System API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware - use whitelist configuration for production security
try:
    from app.core.whitelist import get_cors_origins
    cors_origins = get_cors_origins()
    logger.info(f"✅ CORS origins loaded: {len(cors_origins)} origins configured")
except Exception as e:
    logger.warning(f"⚠️ Could not load CORS whitelist, using permissive fallback: {e}")
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Origin",
        "Content-Type", 
        "Accept",
        "Authorization",
        "X-Requested-With",
        "X-Request-ID",
        "Cache-Control"
    ],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Health check endpoints
@app.get("/")
async def root():
    return {"message": "Rental Manager API is running"}

@app.get("/health")
async def simple_health():
    return {"status": "healthy"}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Rental Manager API",
        "version": "1.0.0",
        "port": os.getenv("PORT", "8000"),
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "unknown")
    }

# Test database connection endpoint
@app.get("/api/test/database")
async def test_database():
    try:
        from app.core.config import settings
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        DATABASE_URL = settings.DATABASE_URL
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+asyncpg://', 1)
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        
        async with engine.begin() as conn:
            result = await conn.execute(text('SELECT 1 as test'))
            test_value = result.scalar()
            
            # Get table count
            table_result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            table_count = table_result.scalar()
        
        await engine.dispose()
        
        return {
            "status": "connected",
            "test_value": test_value,
            "table_count": table_count
        }
    except Exception as e:
        logger.error(f"Database test failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

# Import routers with error handling
try:
    logger.info("Importing routers...")
    
    from app.modules.auth.routes import router as auth_router
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
    logger.info("✅ Auth router loaded")
    
    from app.modules.users.routes import router as users_router
    app.include_router(users_router, prefix="/api/users", tags=["Users"])
    logger.info("✅ Users router loaded")
    
    from app.modules.master_data.routes import router as master_data_router
    app.include_router(master_data_router, prefix="/api/master-data", tags=["Master Data"])
    logger.info("✅ Master data router loaded")
    
    from app.modules.suppliers.routes import router as suppliers_router
    app.include_router(suppliers_router, prefix="/api/suppliers", tags=["Suppliers"])
    logger.info("✅ Suppliers router loaded")
    
    from app.modules.customers.routes import router as customers_router
    app.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
    logger.info("✅ Customers router loaded")
    
    from app.modules.inventory.routes import router as inventory_router
    app.include_router(inventory_router, prefix="/api/inventory", tags=["Inventory"])
    logger.info("✅ Inventory router loaded")
    
    from app.modules.transactions.base.routes import router as transactions_router
    app.include_router(transactions_router, prefix="/api/transactions", tags=["Transactions"])
    logger.info("✅ Transactions router loaded")
    
    from app.modules.system.routes import router as system_router
    app.include_router(system_router, prefix="/api/system", tags=["System"])
    logger.info("✅ System router loaded")
    
    from app.modules.admin.routes import router as admin_router
    app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
    logger.info("✅ Admin router loaded")
    
    logger.info("✅ All routers imported successfully")
    
except Exception as e:
    logger.error(f"Failed to import routers: {e}", exc_info=True)
    # Continue running with limited functionality

# Add a test endpoint that always works
@app.get("/api/test")
async def test_endpoint():
    return {
        "message": "Test endpoint working",
        "timestamp": os.popen('date').read().strip()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)