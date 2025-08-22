-- Performance Optimization Indexes for Rental Manager Backend
-- Run this script directly in PostgreSQL to create performance indexes

-- 1. Optimize rental transaction queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_headers_rental_queries 
ON transaction_headers (transaction_type, status, created_at DESC) 
WHERE transaction_type = 'RENTAL';

-- 2. Optimize transaction search queries  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_headers_search
ON transaction_headers (transaction_type, customer_id, location_id, transaction_date);

-- 3. Optimize stock availability lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_levels_item_location_available
ON stock_levels (item_id, location_id, quantity_available)
WHERE quantity_available > 0;

-- 4. Optimize available inventory unit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_units_rental_lookup
ON inventory_units (item_id, location_id, status)
WHERE status = 'AVAILABLE';

-- 5. Optimize stock movement history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_item_created
ON stock_movements (item_id, created_at DESC);

-- 6. Optimize active rentable items queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_active_rentable
ON items (category_id, is_rentable, rental_rate_per_period)
WHERE is_active = true AND is_rentable = true;

-- 7. Optimize active customer searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_active_search
ON customers (customer_type, business_name, first_name, last_name)
WHERE is_active = true;

-- 8. Optimize active supplier queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_active
ON suppliers (supplier_name, contact_person)
WHERE is_active = true;

-- 9. Optimize transaction line lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_lines_header_item
ON transaction_lines (transaction_header_id, item_id, line_number);

-- 10. Optimize rental date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_lines_rental_dates
ON transaction_lines (rental_end_date, rental_return_date)
WHERE rental_end_date IS NOT NULL;

-- 11. Optimize rental lifecycle queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rental_lifecycle_status
ON rental_lifecycle (transaction_header_id, status, created_at DESC);

-- 12. Optimize category hierarchy queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent
ON categories (parent_id, is_active)
WHERE is_active = true;

-- Update table statistics after creating indexes
ANALYZE transaction_headers;
ANALYZE transaction_lines;
ANALYZE stock_levels;
ANALYZE inventory_units;
ANALYZE stock_movements;
ANALYZE rental_lifecycle;
ANALYZE items;
ANALYZE categories;
ANALYZE customers;
ANALYZE suppliers;