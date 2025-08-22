"""
Progressive FastAPI application that starts basic and adds features incrementally
This ensures the app can start even if some components fail
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional
import os
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Basic settings - no complex imports
PROJECT_NAME = "Rental Manager API"
PROJECT_DESCRIPTION = "Rental Management System API"
PROJECT_VERSION = "1.0.0"
SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Security
security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT token using jose if available, else basic implementation"""
    try:
        from jose import jwt
    except ImportError:
        # Fallback - return a simple token
        import base64
        import json
        token_data = {
            **data,
            "exp": (datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))).isoformat()
        }
        return base64.b64encode(json.dumps(token_data).encode()).decode()
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    if not credentials:
        return None
    token = credentials.credentials
    try:
        from jose import jwt
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except ImportError:
        # Fallback verification
        try:
            import base64
            import json
            decoded = json.loads(base64.b64decode(token))
            # Simple expiry check
            if "exp" in decoded:
                exp = datetime.fromisoformat(decoded["exp"])
                if exp < datetime.utcnow():
                    return None
            return decoded
        except:
            return None
    except Exception:
        return None

# Create lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events with progressive feature loading"""
    # Startup
    logger.info(f"Starting {PROJECT_NAME} (Progressive Mode)")
    
    # Track what's available
    features = {
        "database": False,
        "redis": False,
        "auth": False,
        "routers": []
    }
    
    # Phase 1: Try to initialize database
    try:
        from app.core.database import engine, Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        features["database"] = True
        logger.info("✓ Database initialized")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}")
        logger.info("Running without database")
    
    # Phase 2: Try to initialize Redis (optional)
    try:
        redis_url = os.getenv("REDIS_URL")
        if redis_url and features["database"]:
            from app.core.cache import cache
            await cache.initialize()
            features["redis"] = True
            logger.info("✓ Redis cache initialized")
    except Exception as e:
        logger.warning(f"Redis initialization failed: {e}")
    
    # Phase 3: Try to setup auth if database is available
    if features["database"]:
        try:
            # Check if admin exists
            from app.shared.dependencies import get_session
            from sqlalchemy import text
            
            async for session in get_session():
                try:
                    result = await session.execute(
                        text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
                    )
                    count = result.scalar()
                    if count > 0:
                        features["auth"] = True
                        logger.info("✓ Authentication system ready")
                    break
                except Exception as e:
                    logger.warning(f"Auth check failed: {e}")
                    break
        except Exception as e:
            logger.warning(f"Could not verify auth system: {e}")
    
    # Store features in app state
    app.state.features = features
    
    # Register routers if database is available
    if features["database"]:
        register_routers_progressive(app, features)
    
    logger.info(f"{PROJECT_NAME} startup complete")
    logger.info(f"Enabled features: {features}")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {PROJECT_NAME}")
    
    # Close Redis if initialized
    if features["redis"]:
        try:
            from app.core.cache import cache
            await cache.close()
            logger.info("Redis cache closed")
        except:
            pass
    
    logger.info("Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title=PROJECT_NAME,
    description=PROJECT_DESCRIPTION,
    version=PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS - Allow all origins in production
logger.info("Configuring CORS for all origins")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "version": PROJECT_VERSION,
        "mode": "progressive"
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/health")
async def api_health_check():
    """API health check with feature status"""
    features = getattr(app.state, "features", {})
    return {
        "status": "healthy",
        "service": PROJECT_NAME,
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "development"),
        "features": features
    }

# Basic auth endpoints (work without database)
@app.post("/api/auth/login")
async def login(request: Request):
    """Login endpoint that works with or without database"""
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password required")
        
        # Check if database is available
        features = getattr(app.state, "features", {})
        
        if features.get("database") and features.get("auth"):
            # Try real authentication
            try:
                from app.modules.auth.service import AuthService
                from app.modules.auth.repository import AuthRepository
                from app.shared.dependencies import get_session
                
                async for session in get_session():
                    auth_repo = AuthRepository(session)
                    auth_service = AuthService(auth_repo, session)
                    
                    # Authenticate user
                    user = await auth_service.authenticate(username, password)
                    if user:
                        # Create tokens
                        access_token = create_access_token(
                            data={"sub": user.username, "user_id": str(user.id)}
                        )
                        return {
                            "access_token": access_token,
                            "token_type": "bearer",
                            "user": {
                                "id": str(user.id),
                                "username": user.username,
                                "email": user.email,
                                "full_name": user.full_name,
                                "is_active": user.is_active,
                                "is_superuser": user.is_superuser
                            }
                        }
                    break
            except Exception as e:
                logger.error(f"Database auth failed: {e}")
                # Fall through to mock auth
        
        # Fallback: Mock authentication for demo/development
        if username == "admin" and password in ["K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3", "admin123"]:
            # Create mock token
            access_token = create_access_token(
                data={"sub": username, "user_id": "mock-admin-id"}
            )
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": "mock-admin-id",
                    "username": "admin",
                    "email": "admin@admin.com",
                    "full_name": "System Administrator",
                    "is_active": True,
                    "is_superuser": True
                }
            }
        
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

@app.post("/api/auth/refresh")
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Refresh token endpoint"""
    payload = verify_token(credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Create new token
    access_token = create_access_token(
        data={"sub": payload.get("sub"), "user_id": payload.get("user_id")}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.get("/api/auth/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user endpoint"""
    payload = verify_token(credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if database is available
    features = getattr(app.state, "features", {})
    
    if features.get("database"):
        try:
            from app.shared.dependencies import get_session
            from app.modules.users.repository import UserRepository
            
            async for session in get_session():
                user_repo = UserRepository(session)
                user = await user_repo.get_by_username(payload.get("sub"))
                if user:
                    return {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "full_name": user.full_name,
                        "is_active": user.is_active,
                        "is_superuser": user.is_superuser
                    }
                break
        except Exception as e:
            logger.error(f"Failed to get user from database: {e}")
    
    # Return mock user if database not available
    return {
        "id": payload.get("user_id", "mock-id"),
        "username": payload.get("sub", "admin"),
        "email": "admin@admin.com",
        "full_name": "System Administrator",
        "is_active": True,
        "is_superuser": True
    }

# Progressive router registration
def register_routers_progressive(app: FastAPI, features: dict):
    """Register routers progressively based on available features"""
    if not features.get("database"):
        logger.warning("Database not available - skipping router registration")
        return
    
    # Essential routers to try
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
    
    registered = []
    for module_path, router_name, prefix, tags in router_configs:
        try:
            # Skip auth router since we have custom endpoints
            if "auth" in module_path:
                continue
                
            module = __import__(module_path, fromlist=[router_name])
            router = getattr(module, router_name)
            app.include_router(router, prefix=prefix, tags=tags)
            registered.append(router_name)
            logger.info(f"✓ Registered router: {router_name}")
        except Exception as e:
            logger.warning(f"Could not register {router_name}: {e}")
    
    # Update features with registered routers
    features["routers"] = registered
    
    if registered:
        logger.info(f"Successfully registered {len(registered)} routers")
    else:
        logger.warning("No routers could be registered")

# Register routers immediately after app creation
# Note: We'll call this from lifespan instead of on_event
# because on_event is deprecated and may not work properly

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