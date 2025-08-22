from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import engine
from app.core.middleware import WhitelistMiddleware, EndpointAccessMiddleware
from app.core.cors_middleware import EnhancedCORSMiddleware
from app.core.cors_config import get_all_cors_origins, is_production_environment
from app.core.database import Base
from app.shared.exceptions import CustomHTTPException

# Import all models to ensure they are registered with Base.metadata
from app.modules.auth.routes import router as auth_router
from app.modules.auth.setup_routes import router as setup_router
from app.modules.users.routes import router as users_router
from app.modules.master_data.routes import router as master_data_router
from app.modules.suppliers.routes import router as suppliers_router
from app.modules.customers.routes import router as customers_router
from app.modules.inventory.routes import router as inventory_router
from app.modules.transactions.base.routes import router as transactions_router  # Re-enabled for Swagger
from app.modules.system.routes import router as system_router
from app.modules.system.timezone_routes import router as timezone_router
from app.modules.company.routes import router as company_router
from app.modules.analytics.routes import router as analytics_router
# Import booking router directly to avoid nested inclusion issues
from app.modules.transactions.rentals.rental_booking.routes import router as booking_router
# Import sales transitions router
from app.modules.sales.routes import router as sales_router
# Import security management router and models
from app.modules.security.routes import router as security_router
from app.modules.security.models import SecurityAuditLog, SessionToken, IPWhitelist  # Ensure tables are created

# Import centralized logging configuration
from app.core.logging_config import setup_application_logging, get_application_logger
from app.core.logging_middleware import TransactionLoggingMiddleware, RequestContextMiddleware

# Import task scheduler
from app.core.scheduler import task_scheduler

# Performance monitoring removed - use basic monitoring instead

# Import debug routes for table verification
# from app.debug_routes import debug_router  # Commented out - debug endpoints not needed in production

# Import CORS test router
from app.cors_test import router as cors_test_router

# Import inventory items router
from app.modules.inventory.inventory_items_routes import router as inventory_items_router

# Import inventory validation router
from app.modules.inventory.validation_routes import router as inventory_validation_router

# Admin management endpoints
from app.modules.admin.reset_endpoint import router as reset_router
# Database management router removed - complex debug features not needed
from app.admin_fix_endpoint import router as admin_fix_router  # Re-enabled for production fix

# Import cache manager (if available)
try:
    from app.core.cache_manager import cache_manager
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False
    cache_manager = None

# Import performance monitor (if available)
try:
    from app.core.performance_monitor import monitor, add_performance_middleware, create_performance_endpoints
    MONITORING_AVAILABLE = True
except ImportError:
    MONITORING_AVAILABLE = False
    monitor = None

# Initialize centralized logging
setup_application_logging()
logger = get_application_logger(__name__)

# Create lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.PROJECT_NAME}")
    logger.info("Comprehensive logging system initialized")
    logger.info("Transaction audit logging enabled")
    
    # Initialize cache if available
    if CACHE_AVAILABLE and cache_manager:
        try:
            await cache_manager.initialize()
            logger.info("✓ Redis cache initialized")
        except Exception as e:
            logger.warning(f"Cache initialization failed (will run without cache): {e}")
    
    # Initialize performance monitoring if available
    if MONITORING_AVAILABLE and monitor:
        logger.info("✓ Performance monitoring enabled")
    
    # Initialize WebSocket manager for real-time updates
    try:
        from app.core.websocket_manager import websocket_manager
        await websocket_manager.start()
        logger.info("✓ WebSocket manager started for real-time updates")
    except Exception as e:
        logger.warning(f"WebSocket manager initialization failed: {e}")
    
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    logger.info("Database tables created/verified")
    
    # Run contact_person column migration
    try:
        from migration_contact_person import migrate_contact_person_column
        migration_result = await migrate_contact_person_column()
        if migration_result:
            logger.info("✅ contact_person column migration completed successfully")
        else:
            logger.info("ℹ️ contact_person column migration was not needed")
    except Exception as e:
        logger.error(f"❌ contact_person migration failed: {e}")
        # Continue startup even if migration fails
    
    # Initialize Redis cache
    try:
        from app.core.cache import cache, CacheWarmer
        await cache.initialize()
        logger.info("Redis cache initialized")
        
        # Warm cache with frequently accessed data
        from app.shared.dependencies import get_session
        async for session in get_session():
            try:
                warmer = CacheWarmer()
                await warmer.warm_item_cache(session)
                await warmer.warm_location_cache(session)
                logger.info("Cache warmed with frequently accessed data")
                break
            except Exception as e:
                logger.warning(f"Cache warming failed: {str(e)}")
                break
    except Exception as e:
        logger.warning(f"Redis initialization failed: {str(e)} - Cache disabled")
    
    # Initialize system settings
    try:
        from app.modules.system.service import SystemService
        from app.shared.dependencies import get_session
        
        # Get a database session for initialization
        async for session in get_session():
            try:
                system_service = SystemService(session)
                initialized_settings = await system_service.initialize_default_settings()
                if initialized_settings:
                    logger.info(f"Initialized {len(initialized_settings)} default system settings")
                else:
                    logger.info("System settings already initialized")
                break  # Exit after first successful session
            except Exception as e:
                logger.error(f"Failed to initialize system settings: {str(e)}")
                # Continue startup even if settings initialization fails
                break
    except Exception as e:
        logger.error(f"Error during system settings initialization: {str(e)}")
        # Continue startup even if there's an import or other error
    
    # Seed RBAC data
    try:
        from app.core.rbac_seed import seed_basic_rbac
        from app.shared.dependencies import get_session
        
        logger.info("Checking RBAC seeding...")
        async for session in get_session():
            try:
                seeded = await seed_basic_rbac(session)
                if seeded:
                    logger.info("✅ RBAC data verified/seeded")
                else:
                    logger.warning("⚠️ RBAC seeding incomplete (non-critical)")
                break
            except Exception as e:
                logger.warning(f"RBAC seeding error (non-critical): {e}")
                break
    except Exception as e:
        logger.warning(f"RBAC seeding import error (non-critical): {e}")
    
    # Initialize default company
    try:
        from app.modules.company.service import CompanyService
        from app.modules.company.repository import CompanyRepository
        from app.shared.dependencies import get_session
        
        logger.info("Starting company initialization...")
        
        # Get a database session for company initialization
        async for session in get_session():
            try:
                logger.info("Creating company repository and service...")
                company_repository = CompanyRepository(session)
                company_service = CompanyService(company_repository)
                
                logger.info("Checking for existing company...")
                # Check if company already exists
                existing_company = await company_repository.get_active_company()
                
                if existing_company:
                    logger.info(f"Company already exists: {existing_company.company_name}")
                else:
                    logger.info("No company found, creating default company...")
                    default_company = await company_service.initialize_default_company()
                    logger.info(f"✅ Default company created successfully: {default_company.company_name}")
                    logger.info(f"Company ID: {default_company.id}")
                    logger.info(f"Company Address: {default_company.address}")
                    logger.info(f"Company Email: {default_company.email}")
                
                break  # Exit after first successful session
            except Exception as e:
                logger.error(f"❌ Failed to initialize default company: {str(e)}")
                import traceback
                logger.error(f"Full traceback: {traceback.format_exc()}")
                # Continue startup even if company initialization fails
                break
    except Exception as e:
        logger.error(f"❌ Error during company initialization import: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Continue startup even if there's an import or other error
    
    # Start the task scheduler
    try:
        await task_scheduler.start()
        logger.info("Task scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start task scheduler: {str(e)}")
        # Continue startup even if scheduler fails to start
    
    logger.info(f"{settings.PROJECT_NAME} startup complete")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME}")
    
    # Stop WebSocket manager
    try:
        from app.core.websocket_manager import websocket_manager
        await websocket_manager.stop()
        logger.info("✓ WebSocket manager stopped")
    except Exception as e:
        logger.warning(f"Error stopping WebSocket manager: {e}")
    
    # Stop the task scheduler
    try:
        await task_scheduler.stop()
        logger.info("Task scheduler stopped successfully")
    except Exception as e:
        logger.error(f"Error stopping task scheduler: {str(e)}")
    
    # Close Redis cache
    try:
        from app.core.cache import cache
        await cache.close()
        logger.info("Redis cache closed")
    except Exception as e:
        logger.warning(f"Error closing Redis cache: {str(e)}")
    
    logger.info("Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "User authentication and authorization operations"
        },
        {
            "name": "Users",
            "description": "User management operations"
        },
        {
            "name": "Master Data",
            "description": "Master data management operations"
        },
        {
            "name": "Items",
            "description": "Item master data operations - create, read, update, delete items with search and filtering"
        },
        {
            "name": "Suppliers",
            "description": "Supplier management operations"
        },
        {
            "name": "Customers",
            "description": "Customer management operations"
        },
        {
            "name": "Inventory",
            "description": "Inventory management operations"
        },
        {
            "name": "Transactions",
            "description": "All transaction management operations"
        },
        {
            "name": "Purchases",
            "description": "Purchase transaction management operations"
        },
        {
            "name": "Sales",
            "description": "Sales transaction management operations"
        },
        {
            "name": "Sales Transitions",
            "description": "Sale transition management with rental conflict detection and resolution"
        },
        {
            "name": "Rentals",
            "description": "Rental transaction management operations"
        },
        {
            "name": "Bookings",
            "description": "Unified booking system for single and multi-item reservations"
        },
        {
            "name": "Rental Returns",
            "description": "Rental return and inspection management operations"
        },
        {
            "name": "Transaction Queries",
            "description": "Cross-module transaction queries and reports"
        },
        {
            "name": "Analytics",
            "description": "Analytics and reporting operations"
        },
         {
            "name": "Company",
            "description": "Company Info"
        },

        {
            "name": "System",
            "description": "System administration operations"
        },
        {
            "name": "Timezone Management",
            "description": "Timezone configuration and management operations"
        }
    ]
)

# Add EnhancedCORSMiddleware as the FIRST middleware to ensure headers are always added
app.add_middleware(EnhancedCORSMiddleware)

# Disable whitelist middleware in production to avoid conflicts
import os
is_prod = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("ENV") == "production"
app.add_middleware(WhitelistMiddleware, enabled=False if is_prod else settings.USE_WHITELIST_CONFIG)
app.add_middleware(EndpointAccessMiddleware, enabled=False if is_prod else settings.USE_WHITELIST_CONFIG)

# Add transaction logging middleware
app.add_middleware(TransactionLoggingMiddleware)
app.add_middleware(RequestContextMiddleware)

# Performance tracking middleware removed - use basic logging instead



# NOTE: CORS is handled by EnhancedCORSMiddleware above
# We don't add FastAPI's CORSMiddleware to avoid conflicts
# EnhancedCORSMiddleware handles all CORS requirements including:
# - Wildcard origins in production
# - Preflight OPTIONS requests
# - Proper header injection on all responses
if not is_prod:
    # In development only, add standard CORS for compatibility
    cors_origins = settings.cors_origins
    logger.info(f"Development mode - Adding standard CORS with {len(cors_origins)} origins")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Total-Count",
            "X-Page-Count", 
            "X-Has-Next",
            "X-Has-Previous",
            "X-Correlation-ID",
            "X-Process-Time"
        ],
    )
else:
    logger.info("🚨 Production mode - Using EnhancedCORSMiddleware for wildcard CORS")

# Custom exception handler
@app.exception_handler(CustomHTTPException)
async def custom_http_exception_handler(request: Request, exc: CustomHTTPException):
    # Create response with CORS headers
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "type": exc.error_type}
    )
    
    # Add CORS headers for all environments
    origin = request.headers.get("origin")
    if is_prod:
        # In production, always add wildcard CORS headers
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    elif origin in settings.cors_origins:
        # In development, check against allowed origins
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Enhanced global exception handler with detailed error information
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from app.core.error_handler import enhanced_exception_handler
    return await enhanced_exception_handler(request, exc)

# Simple health check endpoint for Railway
@app.get("/health")
async def simple_health_check():
    return {"status": "ok"}

# Debug endpoint to test analytics import
@app.get("/debug/analytics")
async def debug_analytics():
    try:
        from app.modules.analytics.dashboard_service import DashboardService
        return {"status": "analytics_import_success", "service": "DashboardService imported"}
    except Exception as e:
        return {"status": "analytics_import_failed", "error": str(e)}

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

# Detailed health check endpoint for debugging
@app.get("/api/health/detailed")
async def detailed_health_check():
    """Comprehensive health check with detailed system information."""
    import sys
    import platform
    from datetime import datetime
    from sqlalchemy import text
    
    health_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "healthy",
        "checks": {},
        "system_info": {
            "python_version": sys.version,
            "platform": platform.platform(),
            "architecture": platform.architecture(),
            "hostname": platform.node()
        },
        "configuration": {
            "debug_mode": settings.DEBUG,
            "database_echo": settings.DATABASE_ECHO,
            "cors_origins": len(settings.cors_origins),
            "use_whitelist": settings.USE_WHITELIST_CONFIG
        },
        "import_status": {}
    }
    
    # Database connectivity check
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            health_data["checks"]["database"] = {
                "status": "healthy",
                "message": "Database connection successful"
            }
    except Exception as e:
        health_data["checks"]["database"] = {
            "status": "unhealthy", 
            "message": f"Database connection failed: {str(e)}"
        }
        health_data["status"] = "degraded"
    
    # Redis connectivity check
    try:
        from app.core.cache import cache
        await cache.ping()
        health_data["checks"]["redis"] = {
            "status": "healthy",
            "message": "Redis connection successful"
        }
    except Exception as e:
        health_data["checks"]["redis"] = {
            "status": "unhealthy",
            "message": f"Redis connection failed: {str(e)}"
        }
    
    # Import checks
    imports_to_check = [
        ("app.core.permissions", "require_permission"),
        ("app.shared.dependencies", "PaginationParams"),
        ("app.modules.inventory.models", "StockLevel"),
        ("app.modules.master_data.item_master.models", "Item")
    ]
    
    for module_name, item_name in imports_to_check:
        try:
            module = __import__(module_name, fromlist=[item_name])
            getattr(module, item_name)
            health_data["import_status"][f"{module_name}.{item_name}"] = {
                "status": "success",
                "message": "Import successful"
            }
        except ImportError as e:
            health_data["import_status"][f"{module_name}.{item_name}"] = {
                "status": "failed",
                "message": f"Import failed: {str(e)}"
            }
            health_data["status"] = "degraded"
        except AttributeError as e:
            health_data["import_status"][f"{module_name}.{item_name}"] = {
                "status": "failed", 
                "message": f"Attribute not found: {str(e)}"
            }
            health_data["status"] = "degraded"
    
    # Database schema checks
    try:
        async with engine.begin() as conn:
            # Check if items table exists and has required columns
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND table_schema = 'public'
            """))
            columns = [row[0] for row in result.fetchall()]
            
            required_columns = ['is_rental_blocked', 'rental_block_reason', 'rental_blocked_at']
            missing_columns = [col for col in required_columns if col not in columns]
            
            if missing_columns:
                health_data["checks"]["database_schema"] = {
                    "status": "unhealthy",
                    "message": f"Missing columns in items table: {missing_columns}",
                    "all_columns": columns
                }
                health_data["status"] = "degraded"
            else:
                health_data["checks"]["database_schema"] = {
                    "status": "healthy",
                    "message": "All required columns present"
                }
    except Exception as e:
        health_data["checks"]["database_schema"] = {
            "status": "error",
            "message": f"Schema check failed: {str(e)}"
        }
    
    return health_data

# Currency endpoint (direct access for frontend compatibility)
@app.get("/api/system-settings/currency")
async def get_currency_direct():
    """Get current currency configuration - direct endpoint for frontend compatibility."""
    return {
        "code": "INR",
        "symbol": "₹", 
        "name": "Indian Rupee",
        "is_default": True
    }

# Detailed health check with pool status
@app.get("/api/health/detailed")
async def health_check_detailed():
    from app.core.database import get_pool_status
    from datetime import datetime
    
    pool_status = await get_pool_status()
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database_pool": pool_status,
        "timestamp": datetime.now().isoformat()
    }

# Include routers
# Add CORS test router first for debugging
app.include_router(cors_test_router, prefix="/api", tags=["CORS Test"])
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(setup_router, prefix="/api/auth", tags=["Setup"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(master_data_router, prefix="/api/master-data", tags=["Master Data"])
app.include_router(suppliers_router, prefix="/api/suppliers", tags=["Suppliers"])
app.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
app.include_router(inventory_router, prefix="/api/inventory", tags=["Inventory"])
# Include inventory items router for detailed inventory management
app.include_router(inventory_items_router, prefix="/api/inventory", tags=["Inventory Items"])
# Include inventory validation router for real-time validation
app.include_router(inventory_validation_router, prefix="/api", tags=["Inventory Validation"])
app.include_router(transactions_router, prefix="/api/transactions", tags=["Transactions"])
# Include booking router directly to fix production registration issue
# Note: booking_router already has /bookings prefix, so we only need the parent path
app.include_router(booking_router, prefix="/api/transactions/rentals", tags=["Bookings"])
app.include_router(system_router, prefix="/api/system", tags=["System"])
app.include_router(timezone_router, prefix="/api/system", tags=["Timezone Management"])
app.include_router(company_router, prefix="/api/company", tags=["Company"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(sales_router, tags=["Sales Transitions"])  # Sales transitions with conflict management
app.include_router(security_router, tags=["Security"])  # Security management endpoints

# Monitoring router removed - performance monitoring simplified
# app.include_router(debug_router, prefix="/api")  # Debug endpoints commented out - not needed in production

# Admin management endpoints
app.include_router(reset_router, prefix="/api/admin", tags=["Admin Reset"])
# Database management router removed - debug features not needed
app.include_router(admin_fix_router, prefix="/api", tags=["Admin Fix"])  # Re-enabled for production fix


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )