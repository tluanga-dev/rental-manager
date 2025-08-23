# Rental Manager - Management Tools

A comprehensive management console for the Rental Manager system, providing database administration, user management, and system maintenance tools through a beautiful terminal interface.

## 🚀 Features

- **👤 Admin Management**: Create, manage, and validate admin users
- **📊 Database Inspector**: Analyze database structure, statistics, and health
- **🗑️ Table Cleaner**: Selective data cleaning with dependency management
- **🌱 Seed Manager**: Data seeding with validation and dependency handling
- **🔄 Migration Manager**: Alembic database migration management
- **💾 Backup & Restore**: Full database backup and restore operations
- **⚙️ System Status**: Real-time system monitoring and diagnostics

## 📋 Prerequisites

Before using the management tools, ensure you have:

1. **Docker PostgreSQL Running**:
   ```bash
   cd rental-manager-api
   docker-compose up -d postgres redis
   ```

2. **Python 3.11+** installed

3. **Access to rental-manager-api directory** (for Alembic operations)

## 🛠 Installation

1. **Navigate to the management directory**:
   ```bash
   cd rental-manager/management
   ```

2. **Install dependencies** (recommended: use virtual environment):
   ```bash
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -e .
   ```

3. **Configure environment** (optional):
   Create a `.env` file in the management directory:
   ```env
   # Database Configuration (Docker defaults)
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=rental_user
   POSTGRES_PASSWORD=rental_pass
   POSTGRES_DB=rental_db
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=0
   
   # Admin Configuration
   ADMIN_USERNAME=admin
   ADMIN_EMAIL=admin@company.com
   ADMIN_PASSWORD=YourSecurePassword123!
   ADMIN_FULL_NAME=System Administrator
   ```

## 🎯 Usage

### Interactive Mode (Recommended)

Launch the interactive management console:

```bash
python management/main.py
```

This provides a beautiful menu-driven interface:

```
╔═══════════════════════════════════════════════════════════╗
║          🏠 Rental Manager - Management Console           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  [1] 👤 Admin Management                                  ║
║  [2] 📊 Database Inspector                                ║
║  [3] 🗑️  Table Cleaner                                    ║
║  [4] 🌱 Seed Manager                                      ║
║  [5] 🔄 Migration Manager                                 ║
║  [6] 💾 Backup & Restore                                  ║
║  [7] ⚙️ System Status                                     ║
║  [0] ❌ Exit                                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Direct Command Mode

You can also run specific operations directly:

```bash
# Show system status
python management/main.py status

# Interactive mode (same as no arguments)
python management/main.py interactive
```

## 🔧 Module Details

### 👤 Admin Management

Manage administrator accounts for the system:

- **Create Admin User**: Create new admin accounts with validation
- **List Admin Users**: Display all administrator accounts
- **Reset Password**: Change admin passwords securely
- **Validate Credentials**: Test admin login credentials

**Features**:
- Password strength validation (8+ chars, mixed case, numbers, symbols)
- Email format validation
- Username format validation
- Prevents deletion of last admin user

### 📊 Database Inspector

Comprehensive database analysis and reporting:

- **Table Statistics**: Show all tables with row counts and activity
- **Relationships**: Display foreign key relationships as a tree
- **Database Statistics**: Overall database size, connection info
- **Table Details**: Detailed column, index, and constraint information
- **Health Analysis**: Performance recommendations and issue detection
- **Schema Export**: Export complete schema to JSON

**Sample Output**:
```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Table Name         ┃ Row Count   ┃ Dead Rows   ┃ Health Status                           ┃
┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ items              │ 1,250       │ 45          │ 🟢 Excellent                            │
│ customers          │ 856         │ 12          │ 🟢 Excellent                            │
│ suppliers          │ 124         │ 3           │ 🟢 Excellent                            │
└────────────────────┴─────────────┴─────────────┴─────────────────────────────────────────┘
```

### 🗑️ Table Cleaner

Safe and intelligent data cleaning:

- **Interactive Selection**: Choose tables with visual interface
- **Dependency Analysis**: Shows foreign key relationships before cleaning
- **Protected Tables**: Automatically protects authentication data
- **Dry Run Mode**: Preview operations before execution
- **Transaction Safety**: Automatic rollback on errors

**Safety Features**:
- Critical tables (users, alembic_version) are never deletable
- Shows data preview before deletion
- Confirms all destructive operations
- Maintains referential integrity

### 🌱 Seed Manager

Intelligent data seeding system:

- **Dependency Order**: Seeds data in correct foreign key order
- **JSON Data Files**: Human-readable seed data format
- **Validation**: Validates data before insertion
- **Skip Existing**: Option to skip entities that already have data
- **Progress Tracking**: Visual progress bars for bulk operations

**Supported Entities**:
- Companies
- Users  
- Brands
- Categories (with hierarchy)
- Units of Measurement
- Locations
- Suppliers
- Customers
- Items

**Sample Seed File** (`data/brands.json`):
```json
[
  {
    "brand_name": "DeWalt",
    "brand_code": "DEWALT", 
    "description": "Professional power tools and accessories",
    "website": "https://www.dewalt.com",
    "is_active": true
  }
]
```

### 🔄 Migration Manager

Advanced Alembic database migration management with comprehensive model analysis:

#### Basic Migration Operations
- **Migration Status**: Shows current revision and pending migrations with rich visualization
- **Apply Migrations**: Run migrations to latest or specific revision
- **Rollback**: Safely rollback migrations with confirmation
- **Generate Migrations**: Create new migrations with auto-generation
- **SQL Preview**: View migration SQL without applying
- **Integrity Validation**: Check migration file consistency

#### Enhanced Migration Management
- **Deep Model Analysis**: Comprehensive SQLAlchemy model scanning and relationship mapping
- **Schema Comparison**: Detect differences between models and database schema
- **Migration Planning**: Create detailed migration plans with risk assessment
- **Safety System**: Automated backups before migration execution
- **Migration Testing**: Impact assessment and validation before applying
- **Template System**: Pre-built templates for complex migration scenarios

**Advanced Features**:
- **Clear Migrations**: Remove all existing migration files and create fresh baseline
- **Model Dependency Analysis**: Circular dependency detection and resolution
- **Change Detection**: Identify model changes that require migrations
- **Migration Impact Assessment**: Analyze potential data loss or performance impact
- **Automated Rollback**: Intelligent rollback with dependency consideration
- **Migration Reports**: Detailed reporting with rich visualizations

**Safety Features**:
- Automated database backups before any migration operation
- Confirmation prompts for all destructive operations
- Migration integrity checks and validation
- SQL preview with syntax highlighting
- Detailed error reporting and recovery suggestions
- Risk assessment for each migration operation

**Migration Templates Available**:
- Adding tables with foreign key relationships
- Adding columns with default values and constraints
- Safe column renaming with data preservation
- Column type changes with data conversion
- Creating concurrent indexes for large tables
- Junction tables for many-to-many relationships
- Adding enum columns with value migration
- JSON field extraction to separate columns

### 💾 Backup & Restore

Comprehensive backup and restore system:

- **Full Backups**: Complete database dumps with compression
- **Schema Backups**: Structure-only backups for development
- **Table Backups**: Selective table data backups
- **Metadata Tracking**: JSON metadata for each backup
- **Cleanup Tools**: Automated old backup removal
- **Recommendations**: Context-aware backup suggestions

**Backup Types**:
- **Full**: Complete database with data and schema
- **Schema**: Database structure only
- **Tables**: Specific table data only

### ⚙️ System Status

Real-time system monitoring:

- **Connection Tests**: Database and Redis connectivity
- **Docker Status**: Shows running containers
- **Configuration Display**: Current system settings
- **Health Checks**: Overall system health assessment

## 📁 Directory Structure

```
management/
├── __init__.py                 # Package initialization
├── main.py                    # Main application entry point
├── config.py                  # Configuration management
├── pyproject.toml            # Project dependencies
├── README.md                 # This file
├── modules/                        # Management modules
│   ├── __init__.py
│   ├── admin_manager.py            # Admin user management
│   ├── database_inspector.py       # Database analysis
│   ├── table_cleaner.py            # Data cleaning
│   ├── seed_manager.py             # Data seeding
│   ├── migration_manager.py        # Basic Alembic integration
│   ├── migration_manager_enhanced.py # Advanced migration management
│   ├── model_analyzer.py           # SQLAlchemy model analysis
│   ├── migration_templates.py      # Migration templates
│   └── backup_manager.py           # Backup/restore
├── data/                     # Seed data files
│   ├── brands.json
│   ├── categories.json
│   ├── customers.json
│   ├── suppliers.json
│   ├── locations.json
│   ├── items.json
│   ├── users.json
│   └── companies.json
└── backups/                  # Backup storage (created automatically)
    ├── full/
    ├── schema/
    └── tables/
```

## 🔒 Security Considerations

### Admin Password Requirements
- Minimum 8 characters
- Must contain uppercase letters
- Must contain lowercase letters  
- Must contain numbers
- Must contain special characters (`!@#$%^&*()-_=+[]{}|;:,.<>?`)

### Database Safety
- Protected tables cannot be deleted (users, alembic_version)
- All destructive operations require confirmation
- Dry run mode for testing operations
- Automatic transaction rollback on errors

### Backup Security
- Backups stored locally only
- No automatic cloud upload
- Compression available for large databases
- Metadata tracking for audit trails

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```
Error: Database connection error: could not translate host name "localhost" to address
```
**Solution**: Ensure Docker PostgreSQL is running:
```bash
cd rental-manager-api
docker-compose up -d postgres
```

**2. Alembic Command Failed**
```
Error: Alembic command failed: can't locate revision identified by 'head'
```
**Solution**: Initialize Alembic or check migration files:
```bash
cd rental-manager-api
alembic current
```
Or use the enhanced migration manager to clear and recreate migrations:
```bash
python management/main.py
# Select "5" for Migration Manager
# Select "Enhanced Migration Operations"
# Choose "Clear migrations and create fresh baseline"
```

**3. Import Errors**
```
ModuleNotFoundError: No module named 'rich'
```
**Solution**: Install dependencies:
```bash
cd rental-manager
pip install -e .
```

**4. Permission Denied**
```
Error: Permission denied accessing /var/folders/...
```
**Solution**: Check file permissions or run with appropriate user.

### Debug Mode

Set environment variable for detailed logging:
```bash
export LOG_LEVEL=DEBUG
python management/main.py
```

### Docker Services Check

Verify required services are running:
```bash
cd rental-manager-api
docker-compose ps
```

Should show:
- postgres (Up)
- redis (Up)  
- pgadmin (Up, optional)

## 📈 Performance Tips

### Large Databases
- Use compressed backups for databases >100MB
- Consider table-specific operations for large datasets
- Use dry run mode to test operations first

### Seeding Data
- Seed in dependency order (automatic)
- Use "skip existing" option for incremental seeding
- Validate seed files before bulk operations

### Migrations
- Test migrations on development data first
- Create backups before major schema changes (automatic with enhanced manager)
- Use SQL preview to understand migration impact
- Use enhanced migration manager for complex schema changes
- Leverage migration templates for common patterns
- Perform model analysis before creating migrations

## 🤝 Contributing

When adding new management features:

1. **Follow the module pattern**: Create new modules in `modules/`
2. **Add to main menu**: Update `main.py` with new menu options
3. **Include error handling**: Use try/catch with user-friendly messages
4. **Add confirmation prompts**: For all destructive operations
5. **Update documentation**: Add to this README

### Code Style
- Use `rich` for all console output
- Follow async/await patterns for database operations
- Include type hints for all functions
- Use descriptive variable names

## 📝 Changelog

### Version 1.1.0
- **Enhanced Migration Management**: Deep model analysis and advanced migration operations
- **Model Analyzer**: Comprehensive SQLAlchemy model scanning with relationship mapping
- **Migration Templates**: Pre-built templates for complex migration scenarios
- **Safety System**: Automated backups and rollback capabilities for migrations
- **Schema Comparison**: Intelligent detection of model-database differences
- **Migration Planning**: Risk assessment and impact analysis for migrations

### Version 1.0.0
- Initial release with all core management features
- Interactive terminal interface with Rich UI
- Complete database administration suite
- Comprehensive backup and restore system
- Data seeding with dependency management
- Admin user management with security validation

## 📄 License

This management system is part of the Rental Manager project. See the main project license for details.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker and database logs
3. Ensure all prerequisites are met
4. Check configuration files

The management tools integrate with your existing Rental Manager system and require the main application's database and configuration to function properly.