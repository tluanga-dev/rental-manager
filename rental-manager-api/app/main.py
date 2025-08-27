import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.core.config import settings
from app.core.database import db_manager
from app.core.redis import redis_manager
from app.api.v1.api import api_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s' if settings.LOG_FORMAT == "text"
    else '{"time": "%(asctime)s", "name": "%(name)s", "level": "%(levelname)s", "message": "%(message)s"}',
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifespan events.
    Handles startup and shutdown operations.
    """
    # Startup
    logger.info(f"Starting {settings.PROJECT_NAME} API...")
    
    try:
        # Connect to database
        await db_manager.connect()
        logger.info("Database connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        # Allow app to start even if DB connection fails (for health checks)
    
    try:
        # Connect to Redis
        await redis_manager.connect()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        # Allow app to run without Redis
    
    logger.info(f"{settings.PROJECT_NAME} API started successfully")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME} API...")
    
    # Disconnect from database
    await db_manager.disconnect()
    
    # Disconnect from Redis
    await redis_manager.disconnect()
    
    logger.info(f"{settings.PROJECT_NAME} API shut down successfully")


# Create FastAPI application
app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description="FastAPI backend for rental property management system",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if not settings.is_production else None,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Set up CORS middleware using whitelist configuration
cors_origins = settings.cors_origins
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=600,  # Cache preflight for 10 minutes
    )
    logger.info(f"CORS configured with origins: {cors_origins}")
else:
    logger.warning("No CORS origins configured - CORS middleware not enabled")


# Add CORS debugging middleware
@app.middleware("http")
async def cors_debug_middleware(request: Request, call_next):
    """Debug CORS issues and add proper headers"""
    origin = request.headers.get("origin")
    method = request.method
    path = request.url.path
    
    # Log CORS-related requests
    if origin:
        logger.info(f"CORS request from {origin}: {method} {path}")
        cors_origins = settings.cors_origins
        if origin not in cors_origins:
            logger.warning(f"Origin {origin} not in allowed origins: {cors_origins}")
    
    # Handle preflight requests
    if method == "OPTIONS":
        logger.info(f"Preflight request for {path} from origin: {origin}")
    
    response = await call_next(request)
    
    # Ensure CORS headers are present in error responses
    if origin and origin in settings.cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # Add CORS headers to error responses
        if response.status_code >= 400:
            logger.warning(f"Error response {response.status_code} for CORS request from {origin}")
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response


# Add request ID middleware for tracking  
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request for tracking"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add request ID to logs
    logger.info(f"Request {request_id}: {request.method} {request.url.path}")
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


# Health check endpoint
@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
    response_description="Health status of the application",
)
async def health_check() -> dict[str, Any]:
    """
    Basic health check endpoint.
    Returns the application status.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }


# Readiness check endpoint
@app.get(
    "/ready",
    tags=["Health"],
    summary="Readiness Check",
    response_description="Readiness status of the application",
)
async def readiness_check() -> dict[str, Any]:
    """
    Readiness check endpoint.
    Checks if all required services are available.
    """
    checks = {
        "database": False,
        "redis": False,
    }
    
    # Check database
    try:
        from sqlalchemy import text
        async for session in db_manager.get_session():
            await session.execute(text("SELECT 1"))
            checks["database"] = True
    except Exception as e:
        logger.error(f"Database readiness check failed: {e}")
    
    # Check Redis
    checks["redis"] = await redis_manager.health_check()
    
    # Determine overall readiness
    is_ready = all(checks.values())
    
    response_data = {
        "status": "ready" if is_ready else "not_ready",
        "checks": checks,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }
    
    if not is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=response_data,
        )
    
    return response_data


# Root endpoint
@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    """
    Root endpoint.
    Returns basic API information.
    """
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": "/docs" if not settings.is_production else "Disabled in production",
        "health": "/health",
        "api": settings.API_V1_STR,
    }


# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to catch unhandled exceptions.
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"Unhandled exception in request {request_id}: {exc}", exc_info=True)
    
    # Prepare response content
    if settings.DEBUG:
        # In debug mode, return detailed error
        content = {
            "error": "Internal server error",
            "detail": str(exc),
            "request_id": request_id,
        }
    else:
        # In production, return generic error
        content = {
            "error": "Internal server error",
            "request_id": request_id,
        }
    
    # Create response with CORS headers
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
    )
    
    # Add CORS headers for error responses
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        logger.info(f"Added CORS headers to error response for origin: {origin}")
    
    return response


if __name__ == "__main__":
    # For development only
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )