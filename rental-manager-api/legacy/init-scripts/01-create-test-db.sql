-- PostgreSQL initialization script for Docker Compose
-- This script creates additional databases and users if needed

-- Create test database for integration testing
CREATE DATABASE rental_test OWNER rental_user;

-- Grant all privileges on the test database
GRANT ALL PRIVILEGES ON DATABASE rental_test TO rental_user;

-- Create additional schemas if needed
\c rental_management;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Grant permissions on schemas
GRANT USAGE ON SCHEMA audit TO rental_user;
GRANT USAGE ON SCHEMA reporting TO rental_user;
GRANT CREATE ON SCHEMA audit TO rental_user;
GRANT CREATE ON SCHEMA reporting TO rental_user;

-- Create extensions that might be needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create test user for development/testing
CREATE USER test_dev WITH PASSWORD 'test_dev_password_2024';
GRANT CONNECT ON DATABASE rental_management TO test_dev;
GRANT CONNECT ON DATABASE rental_test TO test_dev;

-- Log completion
SELECT 'PostgreSQL initialization completed successfully' AS status;