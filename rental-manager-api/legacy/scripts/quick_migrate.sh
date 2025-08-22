#!/bin/bash
# Quick migration script for development
# Usage: ./quick_migrate.sh "description of changes"

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if message provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide a migration message${NC}"
    echo "Usage: $0 \"description of changes\""
    exit 1
fi

echo -e "${YELLOW}Generating migration: $1${NC}"

# Generate migration
alembic revision --autogenerate -m "$1"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration generated successfully${NC}"
    
    # Show generated file
    LATEST_MIGRATION=$(ls -t alembic/versions/*.py | head -n1)
    echo -e "Generated file: ${LATEST_MIGRATION}"
    
    # Ask if should apply
    read -p "Apply migration now? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Applying migration...${NC}"
        alembic upgrade head
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Migration applied successfully${NC}"
        else
            echo -e "${RED}✗ Migration failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Migration generated but not applied${NC}"
        echo "To apply later, run: alembic upgrade head"
    fi
else
    echo -e "${RED}✗ Failed to generate migration${NC}"
    exit 1
fi