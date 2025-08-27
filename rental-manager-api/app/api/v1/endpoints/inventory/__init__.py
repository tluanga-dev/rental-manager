"""
Inventory API endpoints package.

This package contains all API endpoints for the inventory module.
"""

from fastapi import APIRouter

from app.api.v1.endpoints.inventory import (
    stocks,
    items,
    stock_levels,
    stock_movements,
    inventory_units,
    sku_sequences
)

# Create main inventory router
router = APIRouter()

# Include sub-routers

# Main inventory overview endpoints
router.include_router(
    stocks.router,
    prefix="/stocks",
    tags=["inventory-stocks"]
)

router.include_router(
    items.router,
    prefix="/items",
    tags=["inventory-items"]
)

# Detailed management endpoints
router.include_router(
    stock_levels.router,
    prefix="/stock-levels",
    tags=["inventory-stock-levels"]
)

router.include_router(
    stock_movements.router,
    prefix="/movements",
    tags=["inventory-movements"]
)

router.include_router(
    inventory_units.router,
    prefix="/units",
    tags=["inventory-units"]
)

router.include_router(
    sku_sequences.router,
    prefix="/sku-sequences",
    tags=["inventory-sku"]
)

__all__ = [
    "router",
    "stocks",
    "items",
    "stock_levels",
    "stock_movements",
    "inventory_units",
    "sku_sequences"
]