-- Manual migration script for rental_pricing table
-- Run this directly in PostgreSQL if Alembic migrations are problematic

-- Create rental_pricing table
CREATE TABLE IF NOT EXISTS rental_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL,
    tier_name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    period_days INTEGER NOT NULL DEFAULT 1,
    rate_per_period NUMERIC(15, 2) NOT NULL,
    min_rental_days INTEGER,
    max_rental_days INTEGER,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pricing_strategy VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    seasonal_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    priority INTEGER NOT NULL DEFAULT 100,
    description VARCHAR(500),
    notes VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    
    -- Foreign key
    CONSTRAINT fk_rental_pricing_item FOREIGN KEY(item_id) REFERENCES items (id) ON DELETE CASCADE,
    
    -- Unique constraint
    CONSTRAINT uq_rental_pricing_item_tier_effective UNIQUE (item_id, tier_name, effective_date),
    
    -- Check constraints
    CONSTRAINT ck_rental_pricing_period_days_positive CHECK (period_days > 0),
    CONSTRAINT ck_rental_pricing_rate_non_negative CHECK (rate_per_period >= 0),
    CONSTRAINT ck_rental_pricing_min_days_positive CHECK (min_rental_days IS NULL OR min_rental_days > 0),
    CONSTRAINT ck_rental_pricing_max_days_positive CHECK (max_rental_days IS NULL OR max_rental_days > 0),
    CONSTRAINT ck_rental_pricing_min_max_days_logical CHECK (min_rental_days IS NULL OR max_rental_days IS NULL OR min_rental_days <= max_rental_days),
    CONSTRAINT ck_rental_pricing_seasonal_multiplier_positive CHECK (seasonal_multiplier > 0),
    CONSTRAINT ck_rental_pricing_effective_expiry_logical CHECK (expiry_date IS NULL OR effective_date <= expiry_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rental_pricing_item_active ON rental_pricing (item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_item_default ON rental_pricing (item_id, is_default);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_item_priority ON rental_pricing (item_id, priority, is_active);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_effective_expiry ON rental_pricing (effective_date, expiry_date);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_period_days ON rental_pricing (period_days, is_active);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_min_max_days ON rental_pricing (min_rental_days, max_rental_days, is_active);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_lookup ON rental_pricing (item_id, is_active, effective_date, expiry_date, priority);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_duration_match ON rental_pricing (item_id, min_rental_days, max_rental_days, is_active);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rental_pricing_updated_at 
    BEFORE UPDATE ON rental_pricing 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample pricing data for testing (optional)
-- Uncomment the lines below to add sample data

/*
-- Sample: Add standard pricing for first item in database
WITH first_item AS (
    SELECT id FROM items WHERE is_active = true LIMIT 1
)
INSERT INTO rental_pricing (item_id, tier_name, period_type, period_days, rate_per_period, min_rental_days, max_rental_days, priority, is_default)
SELECT 
    id,
    tier_name,
    period_type,
    period_days,
    rate_per_period,
    min_rental_days,
    max_rental_days,
    priority,
    is_default
FROM first_item
CROSS JOIN (VALUES
    ('Daily Rate', 'DAILY', 1, 50.00, 1, 6, 10, true),
    ('Weekly Rate', 'WEEKLY', 7, 300.00, 7, 29, 20, false),
    ('Monthly Rate', 'MONTHLY', 30, 1000.00, 30, NULL, 30, false)
) AS pricing(tier_name, period_type, period_days, rate_per_period, min_rental_days, max_rental_days, priority, is_default);
*/

-- Verify table creation
SELECT 
    'Table created successfully' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'rental_pricing';