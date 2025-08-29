-- Purchase to Inventory Integration Verification Queries
-- Run these queries to verify that purchase transactions properly update inventory tables

-- ============================================================================
-- 1. Recent Purchase Transactions
-- ============================================================================
SELECT 
    th.id,
    th.transaction_number,
    th.transaction_type,
    th.status,
    th.transaction_date,
    th.total_amount,
    s.name as supplier_name,
    l.name as location_name,
    th.created_at
FROM transaction_headers th
LEFT JOIN suppliers s ON s.id = th.supplier_id
LEFT JOIN locations l ON l.id = th.location_id
WHERE th.transaction_type = 'PURCHASE'
ORDER BY th.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. Transaction Lines for Recent Purchases
-- ============================================================================
SELECT 
    th.transaction_number,
    tl.line_number,
    i.name as item_name,
    tl.sku,
    tl.quantity,
    tl.unit_price,
    tl.line_total,
    tl.status,
    tl.created_at
FROM transaction_lines tl
JOIN transaction_headers th ON th.id = tl.transaction_header_id
LEFT JOIN items i ON i.id = tl.item_id
WHERE th.transaction_type = 'PURCHASE'
  AND th.created_at > NOW() - INTERVAL '1 hour'
ORDER BY th.created_at DESC, tl.line_number;

-- ============================================================================
-- 3. Inventory Units Created from Purchases
-- ============================================================================
SELECT 
    iu.id,
    i.name as item_name,
    iu.serial_number,
    iu.batch_code,
    iu.status,
    iu.condition,
    iu.unit_cost,
    l.name as location_name,
    s.name as supplier_name,
    iu.purchase_order_number,
    iu.created_at
FROM inventory_units iu
JOIN items i ON i.id = iu.item_id
JOIN locations l ON l.id = iu.location_id
LEFT JOIN suppliers s ON s.id = iu.supplier_id
WHERE iu.created_at > NOW() - INTERVAL '1 hour'
ORDER BY iu.created_at DESC
LIMIT 20;

-- ============================================================================
-- 4. Stock Level Changes
-- ============================================================================
SELECT 
    sl.id,
    i.name as item_name,
    l.name as location_name,
    sl.quantity_on_hand,
    sl.quantity_available,
    sl.quantity_reserved,
    sl.reorder_point,
    sl.last_purchase_date,
    sl.average_cost,
    sl.updated_at
FROM stock_levels sl
JOIN items i ON i.id = sl.item_id
JOIN locations l ON l.id = sl.location_id
WHERE sl.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY sl.updated_at DESC;

-- ============================================================================
-- 5. Stock Movements from Purchases
-- ============================================================================
SELECT 
    sm.id,
    sm.movement_type,
    i.name as item_name,
    l.name as location_name,
    sm.quantity,
    sm.unit_cost,
    sm.from_status,
    sm.to_status,
    th.transaction_number,
    sm.reference_number,
    sm.notes,
    sm.created_at
FROM stock_movements sm
LEFT JOIN items i ON i.id = sm.item_id
LEFT JOIN locations l ON l.id = sm.location_id
LEFT JOIN transaction_headers th ON th.id = sm.transaction_header_id
WHERE sm.movement_type IN ('STOCK_MOVEMENT_PURCHASE', 'PURCHASE_IN')
  AND sm.created_at > NOW() - INTERVAL '1 hour'
ORDER BY sm.created_at DESC;

-- ============================================================================
-- 6. Transaction Events for Purchases
-- ============================================================================
SELECT 
    th.transaction_number,
    te.event_type,
    te.description,
    te.metadata,
    te.created_at
FROM transaction_events te
JOIN transaction_headers th ON th.id = te.transaction_id
WHERE th.transaction_type = 'PURCHASE'
  AND te.created_at > NOW() - INTERVAL '1 hour'
ORDER BY th.created_at DESC, te.created_at;

-- ============================================================================
-- 7. Summary Statistics
-- ============================================================================
WITH recent_purchases AS (
    SELECT 
        COUNT(*) as purchase_count,
        SUM(total_amount) as total_value
    FROM transaction_headers
    WHERE transaction_type = 'PURCHASE'
      AND created_at > NOW() - INTERVAL '1 hour'
),
recent_units AS (
    SELECT 
        COUNT(*) as units_created,
        COUNT(DISTINCT item_id) as unique_items
    FROM inventory_units
    WHERE created_at > NOW() - INTERVAL '1 hour'
),
recent_movements AS (
    SELECT 
        COUNT(*) as movement_count,
        SUM(quantity) as total_quantity_moved
    FROM stock_movements
    WHERE movement_type IN ('STOCK_MOVEMENT_PURCHASE', 'PURCHASE_IN')
      AND created_at > NOW() - INTERVAL '1 hour'
)
SELECT 
    rp.purchase_count,
    rp.total_value,
    ru.units_created,
    ru.unique_items,
    rm.movement_count,
    rm.total_quantity_moved
FROM recent_purchases rp, recent_units ru, recent_movements rm;

-- ============================================================================
-- 8. Verify Integration - Match Purchase Lines to Inventory Units
-- ============================================================================
SELECT 
    th.transaction_number,
    tl.line_number,
    i.name as item_name,
    tl.quantity as purchased_quantity,
    COUNT(iu.id) as units_created,
    tl.quantity = COUNT(iu.id)::numeric as quantity_matches
FROM transaction_headers th
JOIN transaction_lines tl ON tl.transaction_header_id = th.id
JOIN items i ON i.id = tl.item_id
LEFT JOIN inventory_units iu ON iu.item_id = tl.item_id
    AND iu.created_at >= th.created_at
    AND iu.created_at <= th.created_at + INTERVAL '5 minutes'
WHERE th.transaction_type = 'PURCHASE'
  AND th.created_at > NOW() - INTERVAL '1 hour'
GROUP BY th.transaction_number, tl.line_number, i.name, tl.quantity
ORDER BY th.created_at DESC, tl.line_number;

-- ============================================================================
-- 9. Check for Orphaned Records (Should be empty)
-- ============================================================================
-- Inventory units without proper linkage
SELECT 
    'Orphaned Inventory Units' as issue_type,
    COUNT(*) as count
FROM inventory_units iu
WHERE iu.created_at > NOW() - INTERVAL '1 hour'
  AND iu.supplier_id IS NULL
  AND iu.purchase_order_number IS NULL;

-- Stock movements without transaction linkage  
SELECT 
    'Orphaned Stock Movements' as issue_type,
    COUNT(*) as count
FROM stock_movements sm
WHERE sm.movement_type IN ('STOCK_MOVEMENT_PURCHASE', 'PURCHASE_IN')
  AND sm.created_at > NOW() - INTERVAL '1 hour'
  AND sm.transaction_header_id IS NULL;

-- ============================================================================
-- 10. Specific Transaction Deep Dive (Replace with actual transaction number)
-- ============================================================================
-- Uncomment and replace 'PUR-XXXXXXXX-XXXX' with actual transaction number
/*
WITH target_transaction AS (
    SELECT id, transaction_number, created_at
    FROM transaction_headers
    WHERE transaction_number = 'PUR-XXXXXXXX-XXXX'
)
SELECT 
    'Transaction Header' as record_type,
    tt.transaction_number,
    jsonb_build_object(
        'status', th.status,
        'total_amount', th.total_amount,
        'lines_count', (SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id = tt.id),
        'units_created', (
            SELECT COUNT(*) 
            FROM inventory_units 
            WHERE created_at >= tt.created_at 
              AND created_at <= tt.created_at + INTERVAL '5 minutes'
        ),
        'movements_created', (
            SELECT COUNT(*) 
            FROM stock_movements 
            WHERE transaction_header_id = tt.id
        )
    ) as details
FROM target_transaction tt
JOIN transaction_headers th ON th.id = tt.id;
*/