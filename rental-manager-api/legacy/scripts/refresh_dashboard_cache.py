#!/usr/bin/env python3
"""
Dashboard Cache Refresh Script

This script refreshes materialized views and dashboard caches.
Designed to be run periodically via cron job for optimal dashboard performance.

Usage:
    python refresh_dashboard_cache.py [--views-only] [--cache-only] [--verbose]

Cron job example (refresh every 15 minutes):
    */15 * * * * cd /path/to/project && python scripts/refresh_dashboard_cache.py

For high-frequency data, run every 5 minutes:
    */5 * * * * cd /path/to/project && python scripts/refresh_dashboard_cache.py
"""

import asyncio
import argparse
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine
from app.core.cache import cache_manager
from scripts.optimize_dashboard_performance import DashboardPerformanceOptimizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DashboardCacheRefresher:
    """Handles refreshing of dashboard caches and materialized views."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.optimizer = DashboardPerformanceOptimizer()
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)
    
    async def refresh_all(self):
        """Refresh both materialized views and Redis cache."""
        start_time = datetime.now()
        logger.info("Starting complete dashboard cache refresh...")
        
        try:
            # Refresh materialized views first (takes longer)
            await self.refresh_materialized_views()
            
            # Clear and warm up Redis cache
            await self.refresh_redis_cache()
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Complete cache refresh completed in {duration:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Cache refresh failed: {str(e)}")
            raise
    
    async def refresh_materialized_views(self):
        """Refresh all dashboard materialized views."""
        logger.info("Refreshing materialized views...")
        start_time = datetime.now()
        
        try:
            await self.optimizer.refresh_materialized_views()
            
            # Update view refresh timestamps
            await self._record_refresh_timestamp()
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Materialized views refreshed in {duration:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Materialized view refresh failed: {str(e)}")
            raise
    
    async def refresh_redis_cache(self):
        """Clear Redis cache and optionally warm up with fresh data."""
        logger.info("Refreshing Redis cache...")
        start_time = datetime.now()
        
        try:
            # Clear dashboard-related cache keys
            cache_patterns = [
                "dashboard:*",
                "analytics:*", 
                "kpi:*",
                "revenue:*",
                "inventory:*",
                "customers:*"
            ]
            
            cleared_count = 0
            for pattern in cache_patterns:
                try:
                    count = await cache_manager.delete_pattern(pattern)
                    cleared_count += count if count else 0
                    if self.verbose:
                        logger.debug(f"Cleared {count or 0} keys matching pattern: {pattern}")
                except Exception as e:
                    logger.warning(f"Failed to clear cache pattern {pattern}: {str(e)}")
            
            logger.info(f"Cleared {cleared_count} cache keys")
            
            # Optionally warm up cache with frequently accessed data
            await self._warm_up_cache()
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"Redis cache refreshed in {duration:.2f} seconds")
            
        except Exception as e:
            logger.error(f"Redis cache refresh failed: {str(e)}")
            raise
    
    async def _record_refresh_timestamp(self):
        """Record when materialized views were last refreshed."""
        async with async_engine.begin() as conn:
            try:
                # Create refresh log table if it doesn't exist
                create_table_sql = """
                CREATE TABLE IF NOT EXISTS dashboard_refresh_log (
                    id SERIAL PRIMARY KEY,
                    refresh_type VARCHAR(50) NOT NULL,
                    refresh_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    duration_seconds NUMERIC(10, 2),
                    status VARCHAR(20) DEFAULT 'SUCCESS',
                    notes TEXT
                );
                """
                await conn.execute(text(create_table_sql))
                
                # Record this refresh
                insert_sql = """
                INSERT INTO dashboard_refresh_log (refresh_type, refresh_timestamp, status)
                VALUES ('materialized_views', CURRENT_TIMESTAMP, 'SUCCESS')
                """
                await conn.execute(text(insert_sql))
                
                # Clean up old entries (keep last 100 entries)
                cleanup_sql = """
                DELETE FROM dashboard_refresh_log 
                WHERE id NOT IN (
                    SELECT id FROM dashboard_refresh_log 
                    ORDER BY refresh_timestamp DESC 
                    LIMIT 100
                )
                """
                await conn.execute(text(cleanup_sql))
                
            except Exception as e:
                logger.warning(f"Failed to record refresh timestamp: {str(e)}")
    
    async def _warm_up_cache(self):
        """Pre-populate cache with frequently accessed dashboard data."""
        if not self.verbose:
            return  # Skip cache warmup unless in verbose mode
        
        logger.info("Warming up cache with frequently accessed data...")
        
        try:
            # Import dashboard service to warm up cache
            from app.modules.analytics.dashboard_service import DashboardService
            from app.shared.dependencies import get_session
            
            dashboard_service = DashboardService()
            
            # Warm up with default date range (last 30 days)
            from datetime import datetime, timedelta
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            async with get_session() as session:
                # Pre-load executive summary
                cache_key = f"dashboard:overview:{start_date.date()}:{end_date.date()}:system"
                try:
                    overview_data = await dashboard_service.get_executive_summary(
                        session, start_date, end_date
                    )
                    await cache_manager.set(cache_key, overview_data, ttl=300)  # 5 minutes
                    if self.verbose:
                        logger.debug("Warmed up executive summary cache")
                except Exception as e:
                    logger.warning(f"Failed to warm up overview cache: {str(e)}")
                
                # Pre-load KPIs
                try:
                    kpi_data = await dashboard_service.get_performance_indicators(session)
                    await cache_manager.set("dashboard:kpis:system", kpi_data, ttl=1800)  # 30 minutes
                    if self.verbose:
                        logger.debug("Warmed up KPI cache")
                except Exception as e:
                    logger.warning(f"Failed to warm up KPI cache: {str(e)}")
                
                # Pre-load inventory analytics
                try:
                    inventory_data = await dashboard_service.get_inventory_analytics(session)
                    await cache_manager.set("dashboard:inventory:system", inventory_data, ttl=900)  # 15 minutes
                    if self.verbose:
                        logger.debug("Warmed up inventory cache")
                except Exception as e:
                    logger.warning(f"Failed to warm up inventory cache: {str(e)}")
                
            logger.info("Cache warmup completed")
            
        except Exception as e:
            logger.warning(f"Cache warmup failed: {str(e)}")
    
    async def get_refresh_status(self):
        """Get status of last cache refresh operations."""
        async with async_engine.begin() as conn:
            try:
                status_sql = """
                SELECT 
                    refresh_type,
                    refresh_timestamp,
                    status,
                    notes,
                    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - refresh_timestamp)) as seconds_ago
                FROM dashboard_refresh_log 
                ORDER BY refresh_timestamp DESC 
                LIMIT 10
                """
                result = await conn.execute(text(status_sql))
                rows = result.fetchall()
                
                if rows:
                    logger.info("Recent refresh status:")
                    for row in rows:
                        ago_minutes = int(row.seconds_ago / 60)
                        logger.info(f"  {row.refresh_type}: {row.status} ({ago_minutes} min ago)")
                else:
                    logger.info("No refresh history found")
                    
                return rows
                
            except Exception as e:
                logger.warning(f"Failed to get refresh status: {str(e)}")
                return []


async def main():
    """Main refresh routine with command line arguments."""
    parser = argparse.ArgumentParser(description='Refresh dashboard caches and materialized views')
    parser.add_argument('--views-only', action='store_true', 
                       help='Refresh only materialized views (skip Redis cache)')
    parser.add_argument('--cache-only', action='store_true',
                       help='Refresh only Redis cache (skip materialized views)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging and cache warmup')
    parser.add_argument('--status', action='store_true',
                       help='Show refresh status and exit')
    
    args = parser.parse_args()
    
    refresher = DashboardCacheRefresher(verbose=args.verbose)
    
    if args.status:
        await refresher.get_refresh_status()
        return
    
    try:
        if args.views_only:
            await refresher.refresh_materialized_views()
        elif args.cache_only:
            await refresher.refresh_redis_cache()
        else:
            await refresher.refresh_all()
            
        logger.info("Dashboard cache refresh completed successfully")
        
    except Exception as e:
        logger.error(f"Dashboard cache refresh failed: {str(e)}")
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())