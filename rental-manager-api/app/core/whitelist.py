"""
Whitelist configuration manager for CORS origins and API endpoints.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Set, Optional, Any
from functools import lru_cache

logger = logging.getLogger(__name__)


class WhitelistManager:
    """Manages whitelist configuration for CORS origins and API endpoints."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize whitelist manager with configuration file."""
        if config_path is None:
            # Default config path relative to project root
            project_root = Path(__file__).parent.parent.parent
            config_path = project_root / "config" / "whitelist.json"
        
        self.config_path = Path(config_path)
        self._config: Dict[str, Any] = {}
        self._cors_origins_cache: Optional[List[str]] = None
        
        self.load_config()
    
    def load_config(self) -> None:
        """Load whitelist configuration from JSON file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                logger.info(f"Loaded whitelist configuration from {self.config_path}")
            else:
                logger.warning(f"Whitelist config file not found at {self.config_path}, using defaults")
                self._config = self._get_default_config()
                self.save_config()
        except Exception as e:
            logger.error(f"Failed to load whitelist config: {e}")
            self._config = self._get_default_config()
        
        # Clear cache when config is reloaded
        self._cors_origins_cache = None
    
    def save_config(self) -> None:
        """Save current configuration to JSON file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved whitelist configuration to {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save whitelist config: {e}")
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default whitelist configuration."""
        return {
            "cors_origins": [
                "http://localhost:3000",
                "http://localhost:3001", 
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002",
                "http://localhost:8000",
                "http://127.0.0.1:8000"
            ],
            "production_origins": [
                # Add production domains here
            ],
            "allowed_endpoints": [
                # Specific endpoint restrictions if needed
            ],
            "blocked_ips": [
                # Block specific IPs if needed
            ],
            "rate_limits": {
                "default": {
                    "requests": 100,
                    "period": 60  # seconds
                },
                "auth": {
                    "requests": 10,
                    "period": 60
                }
            },
            "security": {
                "require_https_in_production": True,
                "block_suspicious_user_agents": False,
                "allowed_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
            }
        }
    
    def get_cors_origins(self) -> List[str]:
        """Get allowed CORS origins."""
        if self._cors_origins_cache is None:
            origins = self._config.get('cors_origins', [])
            production_origins = self._config.get('production_origins', [])
            
            # In production, use production origins
            # For now, we'll use both development and production origins
            all_origins = origins + production_origins
            
            # Remove duplicates while preserving order
            seen = set()
            self._cors_origins_cache = []
            for origin in all_origins:
                if origin not in seen:
                    seen.add(origin)
                    self._cors_origins_cache.append(origin)
        
        return self._cors_origins_cache
    
    def is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is allowed for CORS."""
        allowed_origins = self.get_cors_origins()
        return origin in allowed_origins
    
    def add_origin(self, origin: str, is_production: bool = False) -> None:
        """Add a new allowed origin."""
        key = 'production_origins' if is_production else 'cors_origins'
        
        if key not in self._config:
            self._config[key] = []
        
        if origin not in self._config[key]:
            self._config[key].append(origin)
            self.save_config()
            self._cors_origins_cache = None  # Clear cache
            logger.info(f"Added new origin: {origin} ({'production' if is_production else 'development'})")
    
    def remove_origin(self, origin: str) -> None:
        """Remove an allowed origin."""
        removed = False
        
        for key in ['cors_origins', 'production_origins']:
            if key in self._config and origin in self._config[key]:
                self._config[key].remove(origin)
                removed = True
        
        if removed:
            self.save_config()
            self._cors_origins_cache = None  # Clear cache
            logger.info(f"Removed origin: {origin}")
    
    def is_endpoint_allowed(self, endpoint: str, method: str = "GET") -> bool:
        """Check if endpoint is allowed (if endpoint restrictions are configured)."""
        allowed_endpoints = self._config.get('allowed_endpoints', [])
        
        # If no endpoint restrictions, allow all
        if not allowed_endpoints:
            return True
        
        # Check if endpoint matches any allowed patterns
        for allowed_endpoint in allowed_endpoints:
            if isinstance(allowed_endpoint, str):
                if endpoint == allowed_endpoint:
                    return True
            elif isinstance(allowed_endpoint, dict):
                if (allowed_endpoint.get('path') == endpoint and 
                    method in allowed_endpoint.get('methods', ['GET'])):
                    return True
        
        return False
    
    def is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is blocked."""
        blocked_ips = self._config.get('blocked_ips', [])
        return ip in blocked_ips
    
    def get_rate_limit(self, endpoint_type: str = "default") -> Dict[str, int]:
        """Get rate limit configuration for endpoint type."""
        rate_limits = self._config.get('rate_limits', {})
        return rate_limits.get(endpoint_type, rate_limits.get('default', {
            'requests': 100,
            'period': 60
        }))
    
    def get_allowed_methods(self) -> List[str]:
        """Get allowed HTTP methods."""
        security_config = self._config.get('security', {})
        return security_config.get('allowed_methods', ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    
    def should_require_https(self) -> bool:
        """Check if HTTPS should be required in production."""
        security_config = self._config.get('security', {})
        return security_config.get('require_https_in_production', True)


# Global whitelist manager instance
whitelist_manager = WhitelistManager()

# Convenience functions
def get_cors_origins() -> List[str]:
    """Get allowed CORS origins."""
    return whitelist_manager.get_cors_origins()

def is_origin_allowed(origin: str) -> bool:
    """Check if origin is allowed."""
    return whitelist_manager.is_origin_allowed(origin)

def is_endpoint_allowed(endpoint: str, method: str = "GET") -> bool:
    """Check if endpoint is allowed."""
    return whitelist_manager.is_endpoint_allowed(endpoint, method)

def is_ip_blocked(ip: str) -> bool:
    """Check if IP is blocked."""
    return whitelist_manager.is_ip_blocked(ip)

def get_rate_limit(endpoint_type: str = "default") -> Dict[str, int]:
    """Get rate limit for endpoint type."""
    return whitelist_manager.get_rate_limit(endpoint_type)