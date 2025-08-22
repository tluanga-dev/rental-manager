"""
CORS Configuration Module
Ensures production CORS origins are properly configured
"""

import os
import logging
from typing import List

logger = logging.getLogger(__name__)

def get_production_cors_origins() -> List[str]:
    """
    Get production CORS origins with all necessary domains.
    This function ensures all production domains are included.
    """
    # Core production domains
    production_origins = [
        "https://www.omomrentals.shop",
        "https://omomrentals.shop",
        "http://www.omomrentals.shop",  # Include HTTP as fallback
        "http://omomrentals.shop",
        "https://rental-manager-frontend-three.vercel.app",
        "https://rental-manager-frontend-production.up.railway.app",
    ]
    
    # Add any additional origins from environment
    env_origins = os.getenv("ADDITIONAL_CORS_ORIGINS", "")
    if env_origins:
        additional = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
        production_origins.extend(additional)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_origins = []
    for origin in production_origins:
        if origin not in seen:
            seen.add(origin)
            unique_origins.append(origin)
    
    logger.info(f"Configured {len(unique_origins)} production CORS origins")
    for origin in unique_origins:
        logger.info(f"  - {origin}")
    
    return unique_origins

def get_all_cors_origins() -> List[str]:
    """
    Get all CORS origins including production and development.
    """
    origins = []
    
    # Add production origins
    origins.extend(get_production_cors_origins())
    
    # Add localhost development origins
    if os.getenv("ENABLE_LOCALHOST_CORS", "true").lower() == "true":
        # Add common localhost ports
        for port in range(3000, 3011):
            origins.append(f"http://localhost:{port}")
            origins.append(f"http://127.0.0.1:{port}")
        
        # Add backend port
        origins.extend([
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ])
    
    # Remove duplicates
    return list(dict.fromkeys(origins))

def is_production_environment() -> bool:
    """Check if running in production environment."""
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
    return env in ["production", "prod", "railway"]