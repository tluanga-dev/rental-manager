#!/usr/bin/env python3
"""
Dashboard Performance Optimization Script

This script optimizes the database for dashboard query performance by:
1. Creating specialized indexes for dashboard queries
2. Setting up database-level optimizations
3. Creating materialized views for complex aggregations
4. Configuring query optimization settings

Run this script after setting up the basic database schema.
"""

import asyncio
import logging
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine, get_session
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DashboardPerformanceOptimizer:
    """Handles database performance optimizations for dashboard queries."""
    
    def __init__(self):
        self.engine = async_engine
    
    async def run_optimization(self):
        """Run all performance optimizations."""
        logger.info("Starting dashboard performance optimization...")
        
        async with self.engine.begin() as conn:
            try:
                # 1. Create additional composite indexes
                await self._create_composite_indexes(conn)
                
                # 2. Create materialized views for complex aggregations
                await self._create_materialized_views(conn)
                
                # 3. Set up database optimization settings
                await self._configure_database_settings(conn)
                
                # 4. Create helper functions for common calculations
                await self._create_helper_functions(conn)
                
                # 5. Update table statistics
                await self._update_statistics(conn)
                
                logger.info("Dashboard performance optimization completed successfully!")
                
            except Exception as e:
                logger.error(f"Error during optimization: {str(e)}")
                raise
    
    async def _create_composite_indexes(self, conn):
        """Create specialized composite indexes for dashboard queries."""
        logger.info("Creating composite indexes...")
        
        indexes = [
            # Revenue trending queries (time-series analysis)
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revenue_time_series 
            ON transaction_headers (
                date_trunc('day', transaction_date), 
                transaction_type, 
                status, 
                total_amount
            ) 
            WHERE status IN ('COMPLETED', 'IN_PROGRESS') 
            AND transaction_type IN ('RENTAL', 'SALE')
            """,
            
            # Customer lifetime value calculations
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_lifetime_value 
            ON transaction_headers (
                customer_id, 
                transaction_date, 
                total_amount, 
                status
            ) 
            WHERE customer_id IS NOT NULL 
            AND status = 'COMPLETED'
            """,
            
            # Active rentals summary
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_rentals_summary 
            ON transaction_lines (
                current_rental_status, 
                rental_end_date, 
                line_total, 
                quantity
            ) 
            WHERE current_rental_status IN ('RENTAL_INPROGRESS', 'RENTAL_EXTENDED', 'RENTAL_LATE')
            """,
            
            # Item performance ranking
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_item_performance_ranking 
            ON transaction_lines (
                item_id, 
                sku, 
                quantity, 
                line_total
            ) 
            WHERE item_id IS NOT NULL
            """,
            
            # Inventory utilization calculations
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_utilization 
            ON stock_movements (
                item_id, 
                movement_type, 
                created_at, 
                quantity_after
            )
            """,
            
            # Payment collection analysis
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_collection 
            ON transaction_headers (
                payment_status, 
                due_date, 
                total_amount, 
                paid_amount, 
                transaction_date
            ) 
            WHERE total_amount > 0
            """,
            
            # Extension tracking for rentals
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rental_extensions 
            ON transaction_headers (
                transaction_type, 
                extension_count, 
                total_extension_charges
            ) 
            WHERE transaction_type = 'RENTAL' 
            AND extension_count > 0
            """,
        ]
        
        for index_sql in indexes:
            try:
                await conn.execute(text(index_sql))
                logger.info(f"Created index: {index_sql.split()[5]}")
            except Exception as e:
                logger.warning(f"Index creation failed (may already exist): {str(e)}")
    
    async def _create_materialized_views(self, conn):
        """Create materialized views for expensive aggregation queries."""
        logger.info("Creating materialized views...")
        
        # Daily revenue summary materialized view
        daily_revenue_view = """
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue_summary AS
        SELECT 
            date_trunc('day', transaction_date) as revenue_date,
            transaction_type,
            COUNT(*) as transaction_count,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_transaction_value,
            SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END) as collected_revenue,
            SUM(CASE WHEN payment_status = 'PENDING' THEN total_amount ELSE 0 END) as pending_revenue
        FROM transaction_headers 
        WHERE status IN ('COMPLETED', 'IN_PROGRESS')
        AND transaction_date >= CURRENT_DATE - INTERVAL '365 days'
        GROUP BY date_trunc('day', transaction_date), transaction_type
        ORDER BY revenue_date DESC, transaction_type;
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_unique 
        ON mv_daily_revenue_summary (revenue_date, transaction_type);
        """
        
        # Customer performance summary
        customer_summary_view = """
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_performance AS
        SELECT 
            c.id as customer_id,
            c.customer_name,
            c.customer_status,
            c.customer_tier,
            c.created_at as customer_since,
            COUNT(th.id) as total_transactions,
            SUM(th.total_amount) as total_revenue,
            AVG(th.total_amount) as avg_transaction_value,
            MAX(th.transaction_date) as last_transaction_date,
            COUNT(CASE WHEN th.transaction_type = 'RENTAL' THEN 1 END) as rental_count,
            SUM(CASE WHEN th.transaction_type = 'RENTAL' THEN th.total_amount ELSE 0 END) as rental_revenue,
            COUNT(CASE WHEN th.transaction_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_transactions
        FROM customers c
        LEFT JOIN transaction_headers th ON c.id = th.customer_id AND th.status = 'COMPLETED'
        GROUP BY c.id, c.customer_name, c.customer_status, c.customer_tier, c.created_at;
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_customer_performance_unique 
        ON mv_customer_performance (customer_id);
        """
        
        # Item performance summary
        item_performance_view = """
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_item_performance AS
        SELECT 
            i.id as item_id,
            i.item_name,
            i.sku_code,
            i.category_id,
            COUNT(tl.id) as rental_count,
            SUM(tl.quantity) as total_quantity_rented,
            SUM(tl.line_total) as total_revenue,
            AVG(tl.line_total) as avg_rental_value,
            MAX(th.transaction_date) as last_rented_date,
            COUNT(CASE WHEN tl.current_rental_status IN ('RENTAL_INPROGRESS', 'RENTAL_EXTENDED') THEN 1 END) as currently_rented,
            AVG(tl.rental_period) as avg_rental_duration,
            COUNT(CASE WHEN tl.return_date > tl.rental_end_date THEN 1 END) as late_returns
        FROM items i
        LEFT JOIN transaction_lines tl ON i.id = tl.item_id
        LEFT JOIN transaction_headers th ON tl.transaction_header_id = th.id AND th.transaction_type = 'RENTAL'
        WHERE i.is_rentable = true
        GROUP BY i.id, i.item_name, i.sku_code, i.category_id;
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_item_performance_unique 
        ON mv_item_performance (item_id);
        """
        
        materialized_views = [daily_revenue_view, customer_summary_view, item_performance_view]
        
        for view_sql in materialized_views:
            try:
                await conn.execute(text(view_sql))
                view_name = view_sql.split()[5]  # Extract view name
                logger.info(f"Created materialized view: {view_name}")
            except Exception as e:
                logger.warning(f"Materialized view creation failed (may already exist): {str(e)}")
    
    async def _configure_database_settings(self, conn):
        """Configure database settings for optimal dashboard query performance."""
        logger.info("Configuring database optimization settings...")
        
        optimization_settings = [
            # Increase work memory for complex aggregations
            "SET work_mem = '256MB'",
            
            # Enable parallel query execution
            "SET max_parallel_workers_per_gather = 4",
            "SET parallel_tuple_cost = 0.1",
            "SET parallel_setup_cost = 1000",
            
            # Optimize for analytical queries
            "SET enable_hashagg = on",
            "SET enable_sort = on",
            "SET enable_material = on",
            
            # Set query planning optimization
            "SET default_statistics_target = 1000",
            "SET constraint_exclusion = partition",
            
            # Configure shared buffer settings (session level)
            "SET effective_cache_size = '4GB'",
            "SET random_page_cost = 1.1",
        ]
        
        for setting in optimization_settings:
            try:
                await conn.execute(text(setting))
                logger.info(f"Applied setting: {setting}")
            except Exception as e:
                logger.warning(f"Setting application failed: {str(e)}")
    
    async def _create_helper_functions(self, conn):
        """Create database functions for common dashboard calculations."""
        logger.info("Creating helper functions...")
        
        # Function to calculate business days between dates
        business_days_function = """
        CREATE OR REPLACE FUNCTION calculate_business_days(start_date DATE, end_date DATE)
        RETURNS INTEGER AS $$
        DECLARE
            result INTEGER;
        BEGIN
            SELECT COUNT(*)::INTEGER INTO result
            FROM generate_series(start_date, end_date, '1 day'::interval) AS d
            WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5;
            RETURN result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        """
        
        # Function to calculate rental utilization rate
        utilization_function = """
        CREATE OR REPLACE FUNCTION calculate_utilization_rate(
            total_quantity NUMERIC, 
            rented_quantity NUMERIC
        )
        RETURNS NUMERIC AS $$
        BEGIN
            IF total_quantity = 0 THEN
                RETURN 0;
            END IF;
            RETURN ROUND((rented_quantity / total_quantity) * 100, 2);
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        """
        
        # Function to get rental status priority for sorting
        status_priority_function = """
        CREATE OR REPLACE FUNCTION get_rental_status_priority(status TEXT)
        RETURNS INTEGER AS $$
        BEGIN
            CASE status
                WHEN 'RENTAL_LATE' THEN RETURN 1;
                WHEN 'RENTAL_LATE_PARTIAL_RETURN' THEN RETURN 2;
                WHEN 'RENTAL_PARTIAL_RETURN' THEN RETURN 3;
                WHEN 'RENTAL_INPROGRESS' THEN RETURN 4;
                WHEN 'RENTAL_EXTENDED' THEN RETURN 5;
                WHEN 'RENTAL_COMPLETED' THEN RETURN 6;
                ELSE RETURN 99;
            END CASE;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        """
        
        functions = [business_days_function, utilization_function, status_priority_function]
        
        for func_sql in functions:
            try:
                await conn.execute(text(func_sql))
                func_name = func_sql.split()[5]  # Extract function name
                logger.info(f"Created function: {func_name}")
            except Exception as e:
                logger.warning(f"Function creation failed: {str(e)}")
    
    async def _update_statistics(self, conn):
        """Update table statistics for optimal query planning."""
        logger.info("Updating table statistics...")
        
        tables = [
            'transaction_headers',
            'transaction_lines', 
            'stock_movements',
            'customers',
            'items',
            'stock_levels'
        ]
        
        for table in tables:
            try:
                await conn.execute(text(f"ANALYZE {table}"))
                logger.info(f"Updated statistics for: {table}")
            except Exception as e:
                logger.warning(f"Statistics update failed for {table}: {str(e)}")
    
    async def refresh_materialized_views(self):
        """Refresh all materialized views. Call this periodically via cron job."""
        logger.info("Refreshing materialized views...")
        
        views = [
            'mv_daily_revenue_summary',
            'mv_customer_performance', 
            'mv_item_performance'
        ]
        
        async with self.engine.begin() as conn:
            for view in views:
                try:
                    await conn.execute(text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}"))
                    logger.info(f"Refreshed materialized view: {view}")
                except Exception as e:
                    logger.warning(f"Failed to refresh {view}: {str(e)}")


async def main():
    """Main optimization routine."""
    optimizer = DashboardPerformanceOptimizer()
    await optimizer.run_optimization()


if __name__ == "__main__":
    asyncio.run(main())