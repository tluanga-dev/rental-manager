-- Initialize test database for inventory testing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create additional test schemas if needed
CREATE SCHEMA IF NOT EXISTS inventory_test;

-- Grant permissions to test user
GRANT ALL PRIVILEGES ON DATABASE inventory_test_db TO test_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON SCHEMA inventory_test TO test_user;

-- Create function to generate test data
CREATE OR REPLACE FUNCTION generate_test_uuid()
RETURNS UUID AS $$
BEGIN
    RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_test_uuid() TO test_user;