"""
Simplified main.py for Railway deployment
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.shared.exceptions import CustomHTTPException

# Import routers
from app.modules.auth.routes import router as auth_router
from app.modules.users.routes import router as users_router
from app.modules.master_data.routes import router as master_data_router
from app.modules.suppliers.routes import router as suppliers_router
from app.modules.customers.routes import router as customers_router
from app.modules.inventory.routes import router as inventory_router
from app.modules.transactions.base.routes import router as transactions_router
from app.modules.system.routes import router as system_router

# Simple lifespan without heavy initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.PROJECT_NAME} (Railway Mode)")
    print("Note: Database migrations must be run separately")
    print("Skipping all database initialization for health check")
    yield
    # Shutdown
    print(f"Shutting down {settings.PROJECT_NAME}")

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler
@app.exception_handler(CustomHTTPException)
async def custom_exception_handler(request: Request, exc: CustomHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Health check endpoints
@app.get("/")
async def root():
    return {"message": f"{settings.PROJECT_NAME} API is running"}

@app.get("/health")
async def simple_health():
    return {"status": "healthy"}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "port": os.getenv("PORT", "8000"),
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "unknown")
    }

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(master_data_router, prefix="/api/master-data", tags=["Master Data"])
app.include_router(suppliers_router, prefix="/api/suppliers", tags=["Suppliers"])
app.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
app.include_router(inventory_router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(transactions_router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(system_router, prefix="/api/system", tags=["System"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)