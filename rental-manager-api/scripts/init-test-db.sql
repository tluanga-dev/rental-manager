-- Test Database Initialization Script
-- Creates test-specific database setup for Company feature testing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions for test user
GRANT ALL PRIVILEGES ON DATABASE rental_test_db TO rental_test_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO rental_test_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rental_test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rental_test_user;

-- Create test data setup function
CREATE OR REPLACE FUNCTION setup_company_test_data()
RETURNS void AS $$
BEGIN
    -- This function can be called to set up initial test data
    -- Currently empty, but can be extended as needed
    RAISE NOTICE 'Company test data setup completed';
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for test data
CREATE OR REPLACE FUNCTION cleanup_company_test_data()
RETURNS void AS $$
BEGIN
    -- Clean up test companies
    DELETE FROM companies 
    WHERE company_name LIKE '%Test%' 
       OR company_name LIKE '%Stress%'
       OR email LIKE '%test.com%'
       OR email LIKE '%example.com%';
    
    RAISE NOTICE 'Company test data cleaned up';
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring function
CREATE OR REPLACE FUNCTION get_company_performance_stats()
RETURNS TABLE (
    table_name text,
    row_count bigint,
    table_size text,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'companies'::text as table_name,
        (SELECT COUNT(*) FROM companies) as row_count,
        pg_size_pretty(pg_total_relation_size('companies')) as table_size,
        pg_size_pretty(pg_indexes_size('companies')) as index_size;
END;
$$ LANGUAGE plpgsql;
