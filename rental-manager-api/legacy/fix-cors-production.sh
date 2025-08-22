#!/bin/bash

# Fix CORS for production deployment
echo "🔧 Fixing CORS configuration for production..."

# Set environment variables for production
export ENVIRONMENT=production
export ENV=production
export USE_WHITELIST_CONFIG=false  # Disable whitelist to use our enhanced CORS config
export ENABLE_LOCALHOST_CORS=false  # Disable localhost in production

echo "✅ Environment variables set for production CORS"

# Ensure the config directory exists
mkdir -p config

# Create a production-ready whitelist.json with all necessary domains
cat > config/whitelist.json << 'EOF'
{
  "cors_origins": {
    "production": {
      "enabled": true,
      "origins": [
        "https://www.omomrentals.shop",
        "https://omomrentals.shop",
        "http://www.omomrentals.shop",
        "http://omomrentals.shop",
        "https://rental-manager-frontend-three.vercel.app",
        "https://rental-manager-frontend-production.up.railway.app"
      ]
    },
    "localhost_range": {
      "enabled": false,
      "start_port": 3000,
      "end_port": 3010,
      "protocols": ["http", "https"]
    },
    "localhost_aliases": {
      "enabled": false,
      "aliases": ["localhost", "127.0.0.1"]
    }
  },
  "api_endpoints": {
    "whitelist_enabled": false,
    "default_access": "open"
  }
}
EOF

echo "✅ Created production whitelist.json with all necessary domains"

# Display the configuration
echo "📋 CORS Origins configured:"
echo "  - https://www.omomrentals.shop"
echo "  - https://omomrentals.shop"
echo "  - http://www.omomrentals.shop"
echo "  - http://omomrentals.shop"
echo "  - https://rental-manager-frontend-three.vercel.app"

echo "🚀 CORS configuration complete!"