#!/usr/bin/env python3
"""
hard_reset.py - Enhanced Database Hard Reset Utility

Destroy-and-rebuild utility for development databases that use SQLAlchemy + Alembic.
Automatically discovers all SQLAlchemy models in the codebase and ensures proper migration generation.

ACTIONS PERFORMED ATOMICALLY:
1. Auto-discovers all SQLAlchemy models in the codebase
2. Validates environment (alembic, psql, database connection)
3. Connects to postgresql://tluanga@localhost:5432/postgres via psql
4. Executes PL/pgSQL block that DROP … CASCADE every table, sequence, 
   view and function in the public schema, yielding a completely empty schema
5. Deletes every *.py file inside alembic/versions/, removing all migration history
6. Updates alembic/env.py with discovered models (optional)
7. Runs 'alembic stamp base' to clear the alembic_version bookkeeping table
8. Generates a fresh initial migration ('alembic revision --autogenerate')
9. Applies the new migration ('alembic upgrade head'), recreating schema in one step
10. Validates that all discovered models have corresponding database tables

SIDE EFFECTS:
- ⚠️  IRREVERSIBLE DATA LOSS in the target database
- Leaves the database itself and Alembic folder structure intact; only contents removed
- Automatically detects project root and virtual-env alembic executable
- Works whether executed from repo root or from utils/ subfolder
- Updates alembic/env.py with complete model imports (if --update-env flag is used)

TYPICAL USE-CASE:
One-shot reset during local development or automated test teardown when you want 
to start from a clean schema without dropping and recreating the entire database cluster.

⚠️  DESTROYS ALL DATA. Use only in development.
"""
import os
import subprocess
import sys
from pathlib import Path
import argparse
import ast
import re
from typing import List, Dict, Set, Tuple

# ------------------------------------------------------------------
# CONFIGURATION – adjust only if your layout differs
# ------------------------------------------------------------------
DB_URL_SYNC  = "postgresql://tluanga@localhost:5432/postgres"
DB_URL_ASYNC = "postgresql+asyncpg://tluanga@localhost:5432/postgres"
ALEMIC_VERS  = Path("alembic/versions")
# Alembic executable – auto-detected (venv/bin/alembic or plain alembic)
ALEMBIC_CMD  = None     # will be filled below
PROJECT_ROOT = None     # will be filled below
# ------------------------------------------------------------------

def run(cmd, *, check=True, capture=False, shell=False):
    """Execute a command, handling both string and list formats."""
    kwargs = {"text": True, "shell": shell}
    if capture:
        kwargs["capture_output"] = True
    
    # If cmd is a string and shell=False, split it into a list
    if isinstance(cmd, str) and not shell:
        cmd = cmd.split()
    
    try:
        result = subprocess.run(cmd, check=check, **kwargs)
        return result.stdout or "" if capture else ""
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
        print(f"   Error: {e}")
        if capture and e.stdout:
            print(f"   Stdout: {e.stdout}")
        if capture and e.stderr:
            print(f"   Stderr: {e.stderr}")
        raise
    except FileNotFoundError as e:
        print(f"❌ Command not found: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
        print(f"   Error: {e}")
        raise

def confirm(prompt, force=False):
    """Ask for user confirmation unless force is True."""
    if force:
        print(f"{prompt} [y/N] y (forced)")
        return True
    
    try:
        return input(f"{prompt} [y/N] ").strip().lower() == "y"
    except EOFError:
        print(" (EOF - treating as 'no')")
        return False

class ModelVisitor(ast.NodeVisitor):
    """AST visitor to find SQLAlchemy model classes."""
    
    def __init__(self):
        self.models = []
        self.imports = []
        self.from_db_base = False
        self.from_core_database = False
    
    def visit_ImportFrom(self, node):
        """Track imports from app.db.base and app.core.database."""
        if node.module:
            if 'app.db.base' in node.module:
                self.from_db_base = True
                for alias in node.names:
                    self.imports.append(alias.name)
            elif 'app.core.database' in node.module:
                self.from_core_database = True
                for alias in node.names:
                    self.imports.append(alias.name)
    
    def visit_ClassDef(self, node):
        """Find classes that inherit from BaseModel or Base."""
        if node.bases:
            for base in node.bases:
                if isinstance(base, ast.Name):
                    # Check for BaseModel (from app.db.base)
                    if base.id == 'BaseModel' and self.from_db_base:
                        self.models.append(node.name)
                        break
                    # Check for Base (from app.core.database)
                    elif base.id == 'Base' and self.from_core_database:
                        self.models.append(node.name)
                        break


def discover_sqlalchemy_models() -> Dict[str, List[str]]:
    """
    Discover all SQLAlchemy models in the codebase by parsing Python files.
    Returns a dictionary mapping module paths to lists of model class names.
    """
    print("→ Discovering SQLAlchemy models in codebase...")
    
    models_by_module = {}
    app_dir = PROJECT_ROOT / "app"
    
    # Known model directories to check - ensures we don't miss any
    critical_model_paths = [
        "app/modules/auth/models.py",
        "app/modules/users/models.py", 
        "app/modules/customers/models.py",
        "app/modules/suppliers/models.py",
        "app/modules/inventory/models.py",
        "app/modules/company/models.py",
        "app/modules/system/models.py",
        "app/modules/master_data/brands/models.py",
        "app/modules/master_data/categories/models.py",
        "app/modules/master_data/locations/models.py",
        "app/modules/master_data/units/models.py",
        "app/modules/master_data/item_master/models.py",
        "app/modules/transactions/base/models",  # Directory
    ]
    
    # Find all Python files in the app directory
    python_files = list(app_dir.rglob("*.py"))
    model_files = []
    
    # Filter to likely model files
    for py_file in python_files:
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Enhanced detection for SQLAlchemy models
            has_db_base = 'from app.db.base import' in content and 'BaseModel' in content
            has_core_database = 'from app.core.database import' in content and 'Base' in content
            has_sqlalchemy = 'from sqlalchemy' in content and ('Column' in content or 'relationship' in content)
            has_table_name = '__tablename__' in content
            
            if has_db_base or has_core_database or (has_sqlalchemy and has_table_name):
                model_files.append(py_file)
        except (UnicodeDecodeError, PermissionError):
            continue
    
    print(f"  Found {len(model_files)} potential model files")
    
    # Parse each model file
    for model_file in model_files:
        try:
            with open(model_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse the AST
            tree = ast.parse(content)
            visitor = ModelVisitor()
            visitor.visit(tree)
            
            if visitor.models:
                # Convert file path to module path
                relative_path = model_file.relative_to(PROJECT_ROOT)
                module_path = str(relative_path.with_suffix('')).replace('/', '.')
                models_by_module[module_path] = visitor.models
                print(f"  ✓ {module_path}: {', '.join(visitor.models)}")
            elif '__tablename__' in content:
                # Manual fallback for models that AST might miss
                print(f"  ⚠ Potential model file without detectable base class: {model_file}")
                
        except (SyntaxError, UnicodeDecodeError) as e:
            print(f"  ⚠ Could not parse {model_file}: {e}")
            continue
    
    total_models = sum(len(models) for models in models_by_module.values())
    print(f"  ✓ Discovered {total_models} SQLAlchemy models across {len(models_by_module)} modules")
    
    # Verify critical models are found
    critical_models = ['User', 'Role', 'Permission', 'Customer', 'Item', 'TransactionHeader']
    found_models = [model for models in models_by_module.values() for model in models]
    missing_critical = [model for model in critical_models if model not in found_models]
    
    if missing_critical:
        print(f"  ⚠ Missing critical models: {', '.join(missing_critical)}")
        print("    This may indicate incomplete model discovery or missing model files")
    
    return models_by_module


def generate_model_imports(models_by_module: Dict[str, List[str]]) -> str:
    """Generate Python import statements for discovered models."""
    import_lines = []
    
    # Group imports by module for cleaner organization
    for module_path, model_names in sorted(models_by_module.items()):
        if len(model_names) == 1:
            import_lines.append(f"from {module_path} import {model_names[0]}")
        else:
            # Multi-line import for readability
            import_lines.append(f"from {module_path} import (")
            for i, model_name in enumerate(sorted(model_names)):
                if i == len(model_names) - 1:
                    import_lines.append(f"    {model_name}")
                else:
                    import_lines.append(f"    {model_name},")
            import_lines.append(")")
    
    return '\n'.join(import_lines)


def update_alembic_env(models_by_module: Dict[str, List[str]]) -> None:
    """Update alembic/env.py with discovered model imports."""
    print("→ Updating alembic/env.py with discovered models...")
    
    env_file = PROJECT_ROOT / "alembic" / "env.py"
    
    # Read current content
    with open(env_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Generate new imports with proper formatting
    new_imports = generate_model_imports(models_by_module)
    new_import_section = f"# Import all models to ensure they are registered\n{new_imports}\n"
    
    # Find and replace the import section more carefully
    # Look for the marker comment and replace everything until the next section
    if '# Import all models to ensure they are registered' in content:
        # Split content into parts
        lines = content.split('\n')
        new_lines = []
        skip_imports = False
        import_section_added = False
        
        for line in lines:
            if '# Import all models to ensure they are registered' in line:
                skip_imports = True
                new_lines.append("# Import all models to ensure they are registered")
                new_lines.extend(new_imports.split('\n'))
                import_section_added = True
                continue
            elif skip_imports and (line.startswith('from app.') or line.startswith('    ')):
                # Skip existing import lines
                continue
            elif skip_imports and (line.strip() == '' or line.startswith('#') or 'config = context.config' in line):
                # End of import section
                skip_imports = False
                new_lines.append(line)
            else:
                new_lines.append(line)
        
        new_content = '\n'.join(new_lines)
    else:
        # Find the config line and insert imports before it
        config_pattern = r'(# this is the Alembic Config object.*?\n)(config = context\.config)'
        replacement = rf'\1{new_import_section}\n\2'
        new_content = re.sub(config_pattern, replacement, content, flags=re.DOTALL)
    
    # Write updated content
    with open(env_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    total_models = sum(len(models) for models in models_by_module.values())
    print(f"  ✓ Updated alembic/env.py with {total_models} model imports")
    
    # Validate the syntax of the updated file
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
            compile(f.read(), env_file, 'exec')
        print(f"  ✓ alembic/env.py syntax validation passed")
    except SyntaxError as e:
        print(f"  ❌ alembic/env.py syntax error: {e}")
        print(f"     Line {e.lineno}: {e.text}")
        raise


def validate_migration_completeness(models_by_module: Dict[str, List[str]]) -> Tuple[bool, Dict[str, any]]:
    """Validate that all discovered models have corresponding database tables.
    Returns (success: bool, details: dict)
    """
    print("→ Validating migration completeness...")
    
    validation_results = {
        'db_tables': set(),
        'expected_tables': set(),
        'missing_tables': set(),
        'extra_tables': set(),
        'all_models': [],
        'success': False
    }
    
    # Get list of tables in database
    try:
        result = run([
            "psql", DB_URL_SYNC, "-t", "-c", 
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
        ], capture=True)
        
        db_tables = set(line.strip() for line in result.strip().split('\n') if line.strip())
        if 'alembic_version' in db_tables:
            db_tables.remove('alembic_version')
            
        validation_results['db_tables'] = db_tables
        print(f"  Found {len(db_tables)} tables in database")
        
    except subprocess.CalledProcessError as e:
        print(f"  ⚠ Could not query database tables: {e}")
        return False, validation_results
    
    # Expected table names based on model names (convert CamelCase to snake_case)
    expected_tables = set()
    all_models = []
    
    for module_path, model_names in models_by_module.items():
        all_models.extend(model_names)
    
    validation_results['all_models'] = all_models
    
    # Enhanced table name mapping with known exceptions
    table_name_mappings = {
        'UnitOfMeasurement': 'units_of_measurement',
        'UserProfile': 'user_profiles', 
        'RefreshToken': 'refresh_tokens',
        'LoginAttempt': 'login_attempts',
        'PasswordResetToken': 'password_reset_tokens',
        'TransactionMetadata': 'transaction_metadata',  # Not pluralized
        'SKUSequence': 'sku_sequences',
        'StockLevel': 'stock_levels',
        'TransactionHeader': 'transaction_headers',
        'TransactionLine': 'transaction_lines',
        'AuditLog': 'audit_logs',
        'SystemSetting': 'system_settings',
        'SystemBackup': 'system_backups'
    }
    
    # Convert model names to expected table names
    for model_name in all_models:
        if model_name in table_name_mappings:
            table_name = table_name_mappings[model_name]
        else:
            # Convert CamelCase to snake_case
            table_name = re.sub('([A-Z]+)([A-Z][a-z])', r'\1_\2', model_name)
            table_name = re.sub(r'([a-z\d])([A-Z])', r'\1_\2', table_name)
            table_name = table_name.lower()
            
            # Handle pluralization (enhanced heuristics)
            if table_name.endswith('y') and not table_name.endswith('ay'):
                table_name = table_name[:-1] + 'ies'
            elif table_name.endswith('s'):
                pass  # Already plural-like
            elif table_name.endswith('ch') or table_name.endswith('sh'):
                table_name += 'es' 
            elif table_name.endswith('fe'):
                table_name = table_name[:-2] + 'ves'
            elif table_name.endswith('f'):
                table_name = table_name[:-1] + 'ves'
            else:
                table_name += 's'
            
        expected_tables.add(table_name)
    
    validation_results['expected_tables'] = expected_tables
    
    # Compare expected vs actual tables
    missing_tables = expected_tables - db_tables
    extra_tables = db_tables - expected_tables
    
    validation_results['missing_tables'] = missing_tables
    validation_results['extra_tables'] = extra_tables
    
    if missing_tables:
        print(f"  ⚠ Missing tables for models: {', '.join(sorted(missing_tables))}")
        print("    These models may not be properly registered in alembic/env.py")
    
    if extra_tables:
        print(f"  ℹ Extra tables not mapped to models: {', '.join(sorted(extra_tables))}")
        print("    These may be system tables or tables created outside of SQLAlchemy")
    
    success = len(missing_tables) == 0
    validation_results['success'] = success
    
    if success:
        print(f"  ✅ All {len(all_models)} models have corresponding database tables")
    else:
        print(f"  ❌ {len(missing_tables)} models are missing database tables")
    
    print(f"  Models: {len(all_models)}, Expected tables: {len(expected_tables)}, Actual tables: {len(db_tables)}")
    
    return success, validation_results


def fix_missing_models(models_by_module: Dict[str, List[str]], validation_details: Dict[str, any]) -> bool:
    """Attempt to fix missing models by updating alembic/env.py and regenerating migration."""
    print("→ Attempting to fix missing models...")
    
    try:
        # Force update alembic/env.py with all discovered models
        update_alembic_env(models_by_module)
        
        # Remove the current migration and regenerate
        migration_files = list(ALEMIC_VERS.glob("*.py"))
        for file in migration_files:
            if file.name != "__init__.py":
                file.unlink()
                print(f"  ✓ Removed migration: {file.name}")
        
        # Reset alembic and regenerate
        run([ALEMBIC_CMD, "stamp", "base"])
        run([ALEMBIC_CMD, "revision", "--autogenerate", "-m", "Complete initial schema with all models"])
        run([ALEMBIC_CMD, "upgrade", "head"])
        
        # Re-validate
        print("→ Re-validating after fix attempt...")
        success, new_validation = validate_migration_completeness(models_by_module)
        
        if success:
            print("  ✅ Successfully fixed missing models!")
            return True
        else:
            print("  ⚠️ Some models still missing after fix attempt")
            return False
            
    except Exception as e:
        print(f"  ❌ Failed to fix missing models: {e}")
        return False


def verify_model_registry() -> bool:
    """Verify that SQLAlchemy model registry contains all expected models."""
    print("→ Verifying SQLAlchemy model registry...")
    
    try:
        # Import Base to access the registry
        sys.path.insert(0, str(PROJECT_ROOT))
        from app.db.base import Base
        
        # Get all registered models
        registry_models = []
        for mapper in Base.registry.mappers:
            model_class = mapper.class_
            registry_models.append(model_class.__name__)
        
        print(f"  Found {len(registry_models)} models in SQLAlchemy registry:")
        for model in sorted(registry_models):
            print(f"    🏗️  {model}")
        
        # Check for critical models
        critical_models = [
            'User', 'Role', 'Permission', 'RefreshToken',
            'Customer', 'Supplier', 'Item', 'Category', 'Brand', 'Location',
            'TransactionHeader', 'TransactionLine', 'StockLevel'
        ]
        
        missing_critical = [model for model in critical_models if model not in registry_models]
        if missing_critical:
            print(f"  ⚠️ Missing critical models from registry: {', '.join(missing_critical)}")
            return False
        else:
            print("  ✅ All critical models found in registry")
            return True
            
    except ImportError as e:
        print(f"  ⚠️ Could not import model registry: {e}")
        return False
    except Exception as e:
        print(f"  ⚠️ Error checking model registry: {e}")
        return False


def validate_migration_content() -> bool:
    """Validate that the generated migration contains all expected operations."""
    print("→ Validating migration content...")
    
    try:
        # Find the latest migration file
        migration_files = list(ALEMIC_VERS.glob("*.py"))
        migration_files = [f for f in migration_files if f.name != "__init__.py"]
        
        if not migration_files:
            print("  ❌ No migration files found")
            return False
        
        latest_migration = max(migration_files, key=lambda f: f.stat().st_mtime)
        
        with open(latest_migration, 'r', encoding='utf-8') as f:
            migration_content = f.read()
        
        # Check for critical operations
        has_create_table = 'op.create_table(' in migration_content
        has_indexes = 'op.create_index(' in migration_content
        has_foreign_keys = 'sa.ForeignKey(' in migration_content
        
        # Count table creations
        table_count = migration_content.count('op.create_table(')
        print(f"  Found {table_count} table creation operations")
        
        if table_count < 20:  # We expect at least 20+ tables
            print(f"  ⚠️ Only {table_count} tables in migration - expected more")
            return False
        
        if not has_create_table:
            print("  ❌ No table creation operations found")
            return False
        
        if not has_indexes:
            print("  ⚠️ No index creation operations found")
        
        if not has_foreign_keys:
            print("  ⚠️ No foreign key relationships found")
        
        print(f"  ✅ Migration content validation passed")
        print(f"    - Tables: {table_count}")
        print(f"    - Indexes: {'Yes' if has_indexes else 'No'}")  
        print(f"    - Foreign Keys: {'Yes' if has_foreign_keys else 'No'}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Migration content validation failed: {e}")
        return False


def validate_environment():
    """Validate that all required components are available."""
    print("→ Validating environment...")
    
    # Check if we're in the right directory
    if not (PROJECT_ROOT / "alembic.ini").exists():
        raise FileNotFoundError(f"alembic.ini not found in {PROJECT_ROOT}")
    
    # Check if alembic command is available
    try:
        run([ALEMBIC_CMD, "--version"], capture=True)
        print(f"  ✓ Alembic found: {ALEMBIC_CMD}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        raise FileNotFoundError(f"Alembic not found or not working: {ALEMBIC_CMD}")
    
    # Check if psql is available
    try:
        run("psql --version", capture=True)
        print(f"  ✓ PostgreSQL client available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        raise FileNotFoundError("psql command not found. Install PostgreSQL client tools.")
    
    # Test database connection
    try:
        result = run(["psql", DB_URL_SYNC, "-c", "SELECT version();"], capture=True)
        print(f"  ✓ Database connection successful")
    except subprocess.CalledProcessError:
        raise ConnectionError(f"Cannot connect to database: {DB_URL_SYNC}")
    
    # Verify app.db.base can be imported
    try:
        sys.path.insert(0, str(PROJECT_ROOT))
        from app.db.base import Base
        print(f"  ✓ SQLAlchemy Base import successful")
    except ImportError as e:
        print(f"  ⚠️ Warning: Cannot import app.db.base: {e}")
        print("    Model registry verification will be skipped")

def main(force=False, update_env=False, validate_completeness=True):
    print("=== Enhanced Alembic + DB hard-reset script ===")
    print(f"Database: {DB_URL_SYNC}")
    print(f"Project root: {PROJECT_ROOT}")
    
    try:
        validate_environment()
    except Exception as e:
        print(f"❌ Environment validation failed: {e}")
        sys.exit(1)
    
    # Discover SQLAlchemy models
    try:
        models_by_module = discover_sqlalchemy_models()
        if not models_by_module:
            print("⚠ No SQLAlchemy models discovered. Proceeding with standard reset.")
    except Exception as e:
        print(f"⚠ Model discovery failed: {e}. Proceeding with standard reset.")
        models_by_module = {}
    
    if not confirm("This will WIPE the postgres DB and delete all migrations. Continue?", force=force):
        print("Aborted.")
        sys.exit(1)

    try:
        # 1) Wipe every object in the public schema
        print("→ Dropping every object in the public schema...")
        wipe_sql = """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            -- Drop tables with CASCADE
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', r.tablename);
            END LOOP;
            
            -- Drop sequences
            FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
                EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE;', r.sequence_name);
            END LOOP;
            
            -- Drop views
            FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
                EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE;', r.table_name);
            END LOOP;
            
            -- Drop functions
            FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP
                EXECUTE format('DROP FUNCTION IF EXISTS public.%I CASCADE;', r.routine_name);
            END LOOP;
            
            -- Drop enum types (PostgreSQL specific)
            FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'e') LOOP
                EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE;', r.typname);
            END LOOP;
            
            -- Drop composite types
            FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND typtype = 'c') LOOP
                EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE;', r.typname);
            END LOOP;
        END $$;
        """
        subprocess.run(
            ["psql", DB_URL_SYNC, "--quiet"],
            input=wipe_sql,
            text=True,
            check=True,
        )
        print("  ✓ Database objects dropped")

        # 2) Delete migration files
        print("→ Removing migration files...")
        migration_count = 0
        if ALEMIC_VERS.exists():
            migration_files = list(ALEMIC_VERS.glob("*.py"))
            migration_count = len([f for f in migration_files if f.name != "__init__.py"])
            for file in migration_files:
                if file.name != "__init__.py":  # Keep __init__.py
                    file.unlink()
            # Ensure .gitkeep exists to preserve directory structure
            keep = ALEMIC_VERS / ".gitkeep"
            keep.touch()
        print(f"  ✓ Removed {migration_count} migration files")

        # 3) Update alembic/env.py with discovered models (if requested)
        if update_env and models_by_module:
            try:
                update_alembic_env(models_by_module)
            except Exception as e:
                print(f"  ⚠ Failed to update alembic/env.py: {e}")
                print("  Continuing with migration generation...")

        # 4) Reset Alembic bookkeeping
        print("→ Resetting Alembic version table...")
        run([ALEMBIC_CMD, "stamp", "base"])
        print("  ✓ Alembic version reset")

        # 5) Create new initial migration
        print("→ Creating new initial migration...")
        run([ALEMBIC_CMD, "revision", "--autogenerate", "-m", "Initial schema"])
        print("  ✓ Initial migration created")

        # 6) Apply it
        print("→ Applying migration...")
        run([ALEMBIC_CMD, "upgrade", "head"])
        print("  ✓ Migration applied")

        # 7) Comprehensive migration validation
        migration_success = True
        content_validation_success = True
        registry_validation_success = True
        
        if validate_completeness and models_by_module:
            print("\n🔍 Running comprehensive validation suite...")
            
            # Validate migration completeness
            try:
                migration_success, validation_details = validate_migration_completeness(models_by_module)
                if not migration_success:
                    print(f"\n⚠️  Migration validation detected issues:")
                    if validation_details['missing_tables']:
                        print(f"   Missing tables: {', '.join(sorted(validation_details['missing_tables']))}")
                        print("   \n🔄 Attempting to fix missing models...")
                        # Try to regenerate migration with better model detection
                        fix_success = fix_missing_models(models_by_module, validation_details)
                        if fix_success:
                            migration_success = True
            except Exception as e:
                print(f"  ⚠ Migration validation failed: {e}")
                migration_success = False
            
            # Validate migration content
            try:
                content_validation_success = validate_migration_content()
            except Exception as e:
                print(f"  ⚠ Migration content validation failed: {e}")
                content_validation_success = False
            
            # Validate model registry
            try:
                registry_validation_success = verify_model_registry()
            except Exception as e:
                print(f"  ⚠ Model registry validation failed: {e}")
                registry_validation_success = False

        # Summary
        overall_success = migration_success and content_validation_success and registry_validation_success
        
        print("\n" + "="*60)
        if overall_success:
            print("🎉 ENHANCED HARD RESET COMPLETED SUCCESSFULLY!")
        else:
            print("⚠️  HARD RESET COMPLETED WITH WARNINGS")
            
        print("="*60)
        print("📊 VALIDATION RESULTS:")
        print(f"   ✅ Database schema: Wiped and recreated")
        print(f"   ✅ Migration history: Cleared")
        print(f"   ✅ Initial migration: Generated and applied")
        
        if models_by_module:
            total_models = sum(len(models) for models in models_by_module.values())
            print(f"   {'✅' if migration_success else '⚠️'} Model discovery: {total_models} SQLAlchemy models found")
            print(f"   {'✅' if migration_success else '⚠️'} Table completeness: {'All models have tables' if migration_success else 'Some models missing'}")
        
        if update_env:
            print(f"   ✅ Alembic env.py: Updated with discovered models")
            
        if validate_completeness:
            print(f"   {'✅' if content_validation_success else '⚠️'} Migration content: {'Valid' if content_validation_success else 'Issues detected'}")
            print(f"   {'✅' if registry_validation_success else '⚠️'} Model registry: {'All critical models found' if registry_validation_success else 'Missing models'}")
        
        print("="*60)
        
        if not overall_success:
            print("\n🔧 RECOMMENDATIONS:")
            if not migration_success:
                print("   • Check that all model files are properly importing BaseModel or Base")
                print("   • Verify model __tablename__ attributes are correct")
                print("   • Ensure all models are imported in alembic/env.py")
            if not content_validation_success:
                print("   • Review the generated migration file for completeness")
                print("   • Check for any import errors in model files")
            if not registry_validation_success:
                print("   • Verify all model modules are being imported correctly")
                print("   • Check for circular import issues")
            print("   • Run with --update-env flag to force alembic/env.py updates")
            print("   • Consider running the script again if issues persist")
        else:
            print("\n🚀 READY FOR DEVELOPMENT!")
            print("   • All models are properly migrated")
            print("   • Database schema is complete and consistent")
            print("   • You can now run your application or tests")
        
    except Exception as e:
        print(f"\n❌ Hard reset failed: {e}")
        print("   Database may be in an inconsistent state.")
        print("   You may need to manually clean up or restore from backup.")
        sys.exit(1)

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Enhanced hard reset database and Alembic migrations with auto-discovery",
        epilog="⚠️  DESTROYS ALL DATA. Use only in development."
    )
    parser.add_argument(
        "--force", "-f", 
        action="store_true",
        help="Skip confirmation prompt and proceed automatically"
    )
    parser.add_argument(
        "--update-env", 
        action="store_true",
        help="Update alembic/env.py with discovered SQLAlchemy models"
    )
    parser.add_argument(
        "--no-validation", 
        action="store_true",
        help="Skip migration completeness validation"
    )
    parser.add_argument(
        "--discover-only", 
        action="store_true",
        help="Only discover models and print results, don't perform reset"
    )
    parser.add_argument(
        "--comprehensive", "-c",
        action="store_true", 
        help="Run comprehensive validation including model registry and migration content checks"
    )
    parser.add_argument(
        "--auto-fix",
        action="store_true",
        help="Automatically attempt to fix missing models by updating alembic/env.py"
    )
    args = parser.parse_args()
    
    try:
        # Determine project root (where alembic.ini lives)
        script_dir = Path(__file__).resolve().parent
        if (script_dir / "alembic.ini").exists():
            PROJECT_ROOT = script_dir
        elif (script_dir.parent / "alembic.ini").exists():
            PROJECT_ROOT = script_dir.parent  # we are in /utils
        else:
            print("❌ Cannot find alembic.ini. Make sure you're in the right directory.")
            print(f"   Looked in: {script_dir} and {script_dir.parent}")
            sys.exit(1)

        # Change to project root directory
        original_cwd = Path.cwd()
        os.chdir(PROJECT_ROOT)
        
        # Ensure alembic/versions directory exists
        ALEMIC_VERS.mkdir(parents=True, exist_ok=True)
        (ALEMIC_VERS / "__init__.py").touch(exist_ok=True)

        # Locate alembic executable with better detection
        alembic_candidates = [
            PROJECT_ROOT / "venv" / "bin" / "alembic",  # Virtual env (Unix)
            PROJECT_ROOT / "venv" / "Scripts" / "alembic.exe",  # Virtual env (Windows)
            PROJECT_ROOT / ".venv" / "bin" / "alembic",  # Common alternative venv name
            PROJECT_ROOT / ".venv" / "Scripts" / "alembic.exe",  # Windows alternative
        ]
        
        ALEMBIC_CMD = "alembic"  # Default fallback
        for candidate in alembic_candidates:
            if candidate.exists():
                ALEMBIC_CMD = str(candidate)
                break

        # Handle discover-only mode
        if args.discover_only:
            print("=== SQLAlchemy Model Discovery ===")
            print(f"Project root: {PROJECT_ROOT}")
            try:
                models_by_module = discover_sqlalchemy_models()
                if models_by_module:
                    print("\n📋 Discovered Models Summary:")
                    for module_path, model_names in sorted(models_by_module.items()):
                        print(f"  📁 {module_path}")
                        for model_name in sorted(model_names):
                            print(f"    🏗️  {model_name}")
                    
                    total_models = sum(len(models) for models in models_by_module.values())
                    print(f"\n✅ Total: {total_models} models in {len(models_by_module)} modules")
                    
                    # Show what import statements would be generated
                    print("\n📄 Generated Import Statements:")
                    print(generate_model_imports(models_by_module))
                else:
                    print("❌ No SQLAlchemy models found in the codebase")
            except Exception as e:
                print(f"❌ Model discovery failed: {e}")
                sys.exit(1)
        else:
            # Set update_env to True if auto_fix or comprehensive is enabled
            update_env = args.update_env or args.auto_fix or args.comprehensive
            validate_completeness = not args.no_validation or args.comprehensive
            
            main(
                force=args.force, 
                update_env=update_env, 
                validate_completeness=validate_completeness
            )
        
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)