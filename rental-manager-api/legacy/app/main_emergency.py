"""
Emergency minimal FastAPI app for debugging Railway deployment
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Create minimal app
app = FastAPI(title="Rental Manager API - Emergency Mode")

# Add CORS middleware with wildcard for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],   # Allow all methods
    allow_headers=["*"],   # Allow all headers
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Emergency API is running",
        "mode": "emergency",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "unknown"),
        "python_version": sys.version
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "mode": "emergency",
        "timestamp": "now"
    }

@app.get("/api/health")
async def api_health():
    """API health check endpoint"""
    return {
        "status": "healthy",
        "service": "Rental Manager API (Emergency Mode)",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "unknown")
    }

@app.get("/api/debug")
async def debug_info():
    """Debug information"""
    return {
        "environment_variables": {
            "PORT": os.getenv("PORT"),
            "RAILWAY_ENVIRONMENT": os.getenv("RAILWAY_ENVIRONMENT"),
            "DATABASE_URL": "SET" if os.getenv("DATABASE_URL") else "NOT SET",
            "REDIS_URL": "SET" if os.getenv("REDIS_URL") else "NOT SET",
            "SECRET_KEY": "SET" if os.getenv("SECRET_KEY") else "NOT SET",
        },
        "python_info": {
            "version": sys.version,
            "executable": sys.executable,
            "path": sys.path[:3]  # Show first 3 paths
        },
        "working_directory": os.getcwd(),
        "files_in_root": os.listdir(".")[:10]  # Show first 10 files
    }

@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle OPTIONS requests for CORS preflight"""
    return {
        "message": "CORS preflight OK",
        "path": path
    }

# Add a fake login endpoint for testing
@app.post("/api/auth/login")
async def emergency_login():
    """Emergency login endpoint"""
    return {
        "access_token": "emergency-token-123",
        "token_type": "bearer",
        "user": {
            "id": "emergency-user",
            "username": "admin",
            "email": "admin@emergency.com",
            "roles": ["admin"]
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)