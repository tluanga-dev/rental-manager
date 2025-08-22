# Migration Utils

This folder contains utility scripts for migrating data from JSON files to the database.

## Available Scripts Overview

| Script | Purpose | Data Clearing |
|--------|---------|---------------|
| `migrate_all_from_json.py` | Migrate all data types | ✅ Clears each table before migration |
| `migrate_fresh_from_json.py` | Fresh migration (clears everything first) | ✅ Clears ALL data before migration |
| `migrate_categories_from_json.py` | Categories only | ✅ Clears categories table |
| `migrate_units_from_json.py` | Units of measurement only | ✅ Clears units table |
| `migrate_customers_from_json.py` | Customers only | ✅ Clears customers table |
| `migrate_suppliers_from_json.py` | Suppliers only | ✅ Clears suppliers table |
| `migrate_locations_from_json.py` | Locations only | ✅ Clears locations table |
| `migrate_brands_from_json.py` | Brands only | ✅ Clears brands table |
| `migrate_items_from_json.py` | Items only | ✅ Clears items table |
| `clear_all_data.py` | Clear data only (no migration) | ✅ Clears specified tables |

## Available Scripts

### 1. Individual Migration Scripts

#### `migrate_categories_from_json.py`
Migrates category hierarchy data from `dummy_data/categories.json` to the database.

**Usage:**
```bash
python utils/migrate_categories_from_json.py
```

**Features:**
- Handles hierarchical category structure
- Maintains parent-child relationships
- Sorts by level to ensure proper creation order
- Provides tree-like visualization of hierarchy

#### `migrate_units_from_json.py`
Migrates units of measurement data from `dummy_data/units.json` to the database.

**Usage:**
```bash
python utils/migrate_units_from_json.py
```

**Features:**
- Comprehensive unit type categorization
- Code and description validation
- Statistical analysis by unit type
- Sample displays for verification

#### `migrate_customers_from_json.py`
Migrates customer data from `dummy_data/customers.json` to the database.

**Usage:**
```bash
python utils/migrate_customers_from_json.py
```

**Features:**
- Handles timezone conversion for date fields
- Generates UUIDs for primary keys
- Uses savepoints for error isolation
- Provides detailed progress logging

#### `migrate_suppliers_from_json.py`
Migrates supplier data from `dummy_data/suppliers.json` to the database.

**Usage:**
```bash
python utils/migrate_suppliers_from_json.py
```

**Features:**
- Comprehensive supplier data migration
- Performance metrics and contract handling
- Built-in verification with statistics
- Detailed error reporting

#### `migrate_locations_from_json.py`
Migrates location data from `dummy_data/locations.json` to the database.

**Usage:**
```bash
python utils/migrate_locations_from_json.py
```

**Features:**
- Handles various location types (warehouse, store, office, yard)
- Complete address and contact information migration
- Location type categorization and statistics
- Geographic distribution analysis

#### `migrate_brands_from_json.py`
Migrates brand data from `dummy_data/brands.json` to the database.

**Usage:**
```bash
python utils/migrate_brands_from_json.py
```

**Features:**
- Equipment manufacturer brand migration
- Brand categorization by equipment type
- Origin/nationality analysis
- Code length and naming pattern verification

#### `migrate_items_from_json.py`
Migrates item master data from `dummy_data/comprehensive_items.json` or `dummy_data/items.json` to the database.

**Usage:**
```bash
python utils/migrate_items_from_json.py
```

**Features:**
- Complete item master data migration with foreign key resolution
- Automatic lookup of brands, categories, and units of measurement
- Support for both rentable and saleable items
- Comprehensive validation and error handling
- Detailed statistics on rental rates, categories, and brands
- Fallback support for multiple JSON file formats

### 2. Master Migration Scripts

#### `migrate_all_from_json.py`
Runs all migrations in the correct order and provides comprehensive reporting.

**Usage:**
```bash
python utils/migrate_all_from_json.py
```

**Features:**
- Runs all individual migrations
- Provides summary statistics
- Verifies migration success
- Comprehensive error handling

#### `migrate_fresh_from_json.py`
Clears ALL existing data and runs a complete fresh migration from JSON files.

**Usage:**
```bash
# Fresh migration (clears everything first)
python utils/migrate_fresh_from_json.py

# Fresh migration for specific tables only
python utils/migrate_fresh_from_json.py customers suppliers
```

**Features:**
- Clears all existing data first
- Runs complete fresh migration
- Requires explicit confirmation
- Comprehensive verification

#### `clear_all_data.py`
Utility script to clear all data from database tables.

**Usage:**
```bash
# Clear all data (with confirmation)
python utils/clear_all_data.py

# Clear specific tables only
python utils/clear_all_data.py customers suppliers categories
```

**Features:**
- Clears data in correct order (respects foreign keys)
- Requires explicit confirmation for safety
- Shows detailed clearing statistics
- Can clear specific tables only

## Prerequisites

1. **Database Setup**: Ensure your database is running and migrations are up to date:
   ```bash
   alembic upgrade head
   ```

2. **JSON Files**: Ensure the following JSON files exist in the `dummy_data/` directory:
   - `categories.json`
   - `units.json`
   - `customers.json`
   - `suppliers.json`
   - `locations.json`
   - `brands.json`
   - `comprehensive_items.json` or `items.json`

3. **Environment**: Make sure your database connection is properly configured in your `.env` file.

## Migration Process

### Quick Start (Recommended)
```bash
# Run all migrations at once (preserves existing data)
python utils/migrate_all_from_json.py

# OR: Fresh migration (clears all data first)
python utils/migrate_fresh_from_json.py
```

### Individual Migrations
```bash
# Migrate categories only (should be run first)
python utils/migrate_categories_from_json.py

# Migrate units of measurement only (should be run early)
python utils/migrate_units_from_json.py

# Migrate customers only
python utils/migrate_customers_from_json.py

# Migrate suppliers only
python utils/migrate_suppliers_from_json.py

# Migrate locations only
python utils/migrate_locations_from_json.py

# Migrate brands only
python utils/migrate_brands_from_json.py

# Migrate items only (must run after categories, units, and brands)
python utils/migrate_items_from_json.py
```

## Data Structure Requirements

### Categories JSON Structure
```json
{
  "name": "Category Name",
  "category_code": "CAT-CODE",
  "category_path": "Parent Category/Category Name",
  "category_level": 2,
  "display_order": 1,
  "parent_category_id": "PARENT-CODE",
  "is_leaf": true
}
```

**Important Notes:**
- Categories must be ordered by `category_level` in the JSON file
- `parent_category_id` should reference the `category_code` of the parent
- Root categories have `category_level: 1` and `parent_category_id: null`
- `is_leaf: true` means the category can have items assigned to it

### Locations JSON Structure
```json
{
  "location_code": "MAIN-WH",
  "location_name": "Main Warehouse",
  "location_type": "WAREHOUSE",
  "address": "1250 Industrial Boulevard, Building A",
  "city": "Denver",
  "state": "Colorado",
  "postal_code": "80204",
  "country": "United States",
  "contact_number": "+1-303-555-0101",
  "email": "warehouse@rentalcompany.com",
  "manager_user_id": null
}
```

**Important Notes:**
- `location_code` must be unique across all locations
- `location_type` should be one of: WAREHOUSE, STORE, OFFICE, YARD
- Contact information (`contact_number`, `email`) is optional
- `manager_user_id` can be null if no manager is assigned

### Brands JSON Structure
```json
{
  "name": "Caterpillar",
  "code": "CAT",
  "description": "Leading construction equipment manufacturer"
}
```

**Important Notes:**
- `code` must be unique across all brands
- `description` provides context about the brand's specialization
- Brand codes are typically short abbreviations (2-6 characters)

### Items JSON Structure
```json
{
  "sku": "CON-EXC-CAT320-001",
  "item_name": "Caterpillar 320 Hydraulic Excavator",
  "item_status": "ACTIVE",
  "brand_code": "CAT",
  "category_code": "CON-EXC",
  "unit_code": "pcs",
  "model_number": "320",
  "description": "20-ton hydraulic excavator for heavy construction and earthmoving operations",
  "specifications": "Operating weight: 20,500 kg, Engine power: 122 kW, Max dig depth: 6.68 m, Bucket capacity: 0.93 m³",
  "rental_rate_per_period": 450.00,
  "rental_period": "day",
  "sale_price": null,
  "purchase_price": 175000.00,
  "security_deposit": 4500.00,
  "warranty_period_days": 90,
  "reorder_point": 1,
  "is_rentable": true,
  "is_saleable": false,
  "serial_number_required": true
}
```

**Important Notes:**
- `sku` must be unique across all items
- `unit_code` is required and must exist in units_of_measurement table
- `brand_code` and `category_code` are optional but must exist if provided
- `item_status` should be one of: ACTIVE, INACTIVE, DISCONTINUED
- `is_rentable` and `is_saleable` are mutually exclusive
- Numeric fields (prices, deposits) are automatically converted to Decimal
- Foreign key lookups are performed automatically during migration

### Units of Measurement JSON Structure
```json
{
  "name": "Unit Name",
  "code": "unit_code",
  "description": "Description of the unit"
}
```

**Examples:**
- `{"name": "Pieces", "code": "pcs", "description": "Individual countable items"}`
- `{"name": "Kilograms", "code": "kg", "description": "Weight in kilograms"}`
- `{"name": "Hours", "code": "hr", "description": "Time-based rental unit"}`

### Customers JSON Structure
```json
{
  "customer_code": "CUST-001",
  "customer_type": "BUSINESS|INDIVIDUAL",
  "business_name": "Company Name",
  "first_name": "John",
  "last_name": "Doe",
  "email": "email@example.com",
  "phone": "+1-xxx-xxx-xxxx",
  "mobile": "+1-xxx-xxx-xxxx",
  "address_line1": "Street Address",
  "address_line2": "Suite/Apt",
  "city": "City",
  "state": "State",
  "country": "Country",
  "postal_code": "12345",
  "tax_number": "Tax ID",
  "payment_terms": "NET30|IMMEDIATE",
  "customer_tier": "GOLD|SILVER|BRONZE|PLATINUM",
  "credit_limit": 50000.00,
  "status": "ACTIVE|INACTIVE",
  "blacklist_status": "CLEAR|BLACKLISTED",
  "credit_rating": "EXCELLENT|GOOD|FAIR|POOR",
  "total_rentals": 15,
  "total_spent": 75250.00,
  "lifetime_value": 75250.00,
  "last_transaction_date": "2024-01-15T10:30:00Z",
  "last_rental_date": "2024-01-15T10:30:00Z",
  "notes": "Additional notes"
}
```

### Suppliers JSON Structure
```json
{
  "supplier_code": "SUP-001",
  "company_name": "Supplier Company",
  "supplier_type": "MANUFACTURER|DISTRIBUTOR|WHOLESALER|RETAILER|SERVICE|DIRECT",
  "contact_person": "Contact Name",
  "email": "contact@supplier.com",
  "phone": "+1-xxx-xxx-xxxx",
  "mobile": "+1-xxx-xxx-xxxx",
  "address_line1": "Street Address",
  "address_line2": "Suite/Building",
  "city": "City",
  "state": "State",
  "postal_code": "12345",
  "country": "Country",
  "tax_id": "Tax ID",
  "payment_terms": "NET30|NET15|NET45|NET60|NET90|COD|IMMEDIATE",
  "credit_limit": 500000.00,
  "supplier_tier": "PREMIUM|STANDARD|BASIC|TRIAL",
  "status": "ACTIVE|INACTIVE|PENDING|APPROVED|SUSPENDED|BLACKLISTED",
  "quality_rating": 4.8,
  "delivery_rating": 4.5,
  "average_delivery_days": 3,
  "total_orders": 125,
  "total_spend": 2500000.00,
  "last_order_date": "2024-01-22T14:30:00Z",
  "contract_start_date": "2023-01-01T00:00:00Z",
  "contract_end_date": "2025-12-31T23:59:59Z",
  "notes": "Additional notes",
  "website": "https://www.supplier.com",
  "account_manager": "Manager Name",
  "preferred_payment_method": "Wire Transfer|ACH|Credit Card",
  "insurance_expiry": "2024-12-31T23:59:59Z",
  "certifications": "ISO 9001:2015, Other Certs"
}
```

## Data Clearing Behavior

### Automatic Data Clearing
All migration scripts automatically clear existing data in their respective tables before inserting new data:

- **Categories**: Clears all existing categories and their relationships
- **Units**: Clears all existing units of measurement
- **Customers**: Clears all existing customer records
- **Suppliers**: Clears all existing supplier records

### Safety Features
- **Count Display**: Shows how many existing records will be cleared
- **Confirmation**: Fresh migration requires explicit 'YES' confirmation
- **Transaction Safety**: All operations are wrapped in database transactions
- **Rollback**: Failed operations are automatically rolled back

### Clearing Options
1. **Individual Scripts**: Each script clears only its own table
2. **Master Script**: Clears and migrates all tables in sequence
3. **Fresh Migration**: Clears ALL database data, then migrates everything
4. **Clear Only**: Use `clear_all_data.py` to just clear without migrating

## Error Handling

All scripts include comprehensive error handling:

- **Savepoints**: Each record is processed in its own savepoint, so individual failures don't abort the entire migration
- **Detailed Logging**: Clear progress indicators and error messages
- **Graceful Degradation**: Failed records are skipped with detailed error reporting
- **Verification**: Built-in verification to ensure migration success

## Troubleshooting

### Common Issues

1. **Table doesn't exist**
   ```
   ❌ [Table] table does not exist. Please run migrations first:
   alembic upgrade head
   ```
   **Solution**: Run `alembic upgrade head` to create database tables.

2. **JSON file not found**
   ```
   ❌ Error loading JSON: [Errno 2] No such file or directory
   ```
   **Solution**: Ensure JSON files exist in the `dummy_data/` directory.

3. **Database connection error**
   ```
   ❌ Migration failed: connection error
   ```
   **Solution**: Check your database connection settings in `.env` file.

4. **Timezone errors**
   ```
   ❌ Error creating record: timezone error
   ```
   **Solution**: The scripts handle timezone conversion automatically. Ensure dates in JSON are in ISO format.

### Getting Help

If you encounter issues:

1. Check the detailed error messages in the console output
2. Verify your database connection and table structure
3. Ensure JSON files have the correct structure
4. Check that all required fields are present in your JSON data

## Performance Notes

- **Batch Processing**: Records are processed individually with savepoints for reliability
- **Memory Efficient**: JSON files are loaded once and processed sequentially
- **Progress Tracking**: Real-time progress indicators show migration status
- **Statistics**: Detailed statistics and verification after migration

## Security Notes

- Scripts clear existing data before migration (use with caution in production)
- All database operations use parameterized queries to prevent SQL injection
- Sensitive data handling follows best practices