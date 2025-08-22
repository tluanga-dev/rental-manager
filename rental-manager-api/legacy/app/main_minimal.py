"""
Minimal FastAPI app for Railway debugging
"""
from fastapi import FastAPI
import os

app = FastAPI(title="Rental Manager - Minimal")

@app.get("/")
async def root():
    return {"message": "Minimal app is running"}

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "rental-manager-minimal",
        "port": os.getenv("PORT", "8000"),
        "env": os.getenv("RAILWAY_ENVIRONMENT", "unknown")
    }

@app.get("/api/debug")
async def debug():
    return {
        "env_vars": {
            "PORT": os.getenv("PORT"),
            "DATABASE_URL": "SET" if os.getenv("DATABASE_URL") else "NOT SET",
            "REDIS_URL": "SET" if os.getenv("REDIS_URL") else "NOT SET",
            "SECRET_KEY": "SET" if os.getenv("SECRET_KEY") else "NOT SET",
            "RAILWAY_ENVIRONMENT": os.getenv("RAILWAY_ENVIRONMENT"),
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)