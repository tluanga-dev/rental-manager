#!/usr/bin/env python3
"""
Master migration script to migrate all data from JSON files to database
"""
import asyncio
import sys
import os
import traceback
from pathlib import Path
from datetime import datetime
import logging

# Add the project root directory to the path so we can import the app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
if not os.getcwd().endswith('rental-manager-backend'):
    os.chdir(project_root)

# Setup logging
def setup_logging():
    """Setup comprehensive logging for migration process with separate success and error files"""
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Generate timestamp for log filename (mm-hh-dd-mm-yyyy format)
    now = datetime.now()
    timestamp = now.strftime("%m-%H-%d-%m-%Y")
    
    # Create separate log files
    success_log_path = logs_dir / f"data_migration_success_{timestamp}.txt"
    error_log_path = logs_dir / f"data_migration_error_{timestamp}.txt"
    
    # Clear existing loggers
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    # Create custom logger
    logger = logging.getLogger('migration_logger')
    logger.setLevel(logging.DEBUG)
    
    # Create formatters
    detailed_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_formatter = logging.Formatter('%(message)s')
    
    # Success file handler (INFO and above)
    success_handler = logging.FileHandler(success_log_path, mode='w', encoding='utf-8')
    success_handler.setLevel(logging.INFO)
    success_handler.setFormatter(detailed_formatter)
    
    # Error file handler (WARNING and above)
    error_handler = logging.FileHandler(error_log_path, mode='w', encoding='utf-8')
    error_handler.setLevel(logging.WARNING)
    error_handler.setFormatter(detailed_formatter)
    
    # Console handler (all levels)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    
    # Add handlers to logger
    logger.addHandler(success_handler)
    logger.addHandler(error_handler)
    logger.addHandler(console_handler)
    
    # Write initial headers to both files
    logger.info("=" * 80)
    logger.info("🎯 JSON TO DATABASE MIGRATION LOG")
    logger.info("=" * 80)
    logger.info(f"Migration started at: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Success log file: {success_log_path}")
    logger.info(f"Error log file: {error_log_path}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info(f"Python version: {sys.version}")
    logger.info("=" * 80)
    
    return logger, success_log_path, error_log_path

# Initialize logging
logger, success_log_path, error_log_path = setup_logging()

# Custom logging functions for detailed file writing
def log_success(message, details=None):
    """Log success message to both console and success file"""
    logger.info(message)
    if details:
        # Write additional details only to success file
        with open(success_log_path, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DETAILS - {details}\n")

def log_error(message, error_details=None, traceback_info=None):
    """Log error message to console, error file, and success file for context"""
    logger.error(message)
    
    # Write detailed error information to error file
    if error_details or traceback_info:
        with open(error_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - ERROR DETAILS\n")
            f.write(f"{'='*60}\n")
            if error_details:
                f.write(f"Error Details: {error_details}\n")
            if traceback_info:
                f.write(f"Full Traceback:\n{traceback_info}\n")
            f.write(f"{'='*60}\n\n")

def log_step_summary(step_name, success, duration, details=None, error=None):
    """Log comprehensive step summary to appropriate files"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if success:
        summary = f"✅ {step_name} - SUCCESS (Duration: {duration:.2f}s)"
        log_success(summary)
        
        # Write detailed success info to success file
        with open(success_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{timestamp} - STEP SUMMARY\n")
            f.write(f"{'='*50}\n")
            f.write(f"Step: {step_name}\n")
            f.write(f"Status: SUCCESS\n")
            f.write(f"Duration: {duration:.2f} seconds\n")
            if details:
                f.write(f"Details: {details}\n")
            f.write(f"{'='*50}\n\n")
    else:
        summary = f"❌ {step_name} - FAILED (Duration: {duration:.2f}s)"
        log_error(summary)
        
        # Write detailed error info to error file
        with open(error_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{timestamp} - STEP FAILURE\n")
            f.write(f"{'='*50}\n")
            f.write(f"Step: {step_name}\n")
            f.write(f"Status: FAILED\n")
            f.write(f"Duration: {duration:.2f} seconds\n")
            if error:
                f.write(f"Error: {error}\n")
            f.write(f"{'='*50}\n\n")

from utils.migrate_json.migrate_customers_from_json import migrate_customers
from utils.migrate_json.migrate_suppliers_from_json import migrate_suppliers, verify_migration as verify_suppliers
from utils.migrate_json.migrate_categories_from_json import migrate_categories, verify_categories_migration
from utils.migrate_json.migrate_units_from_json import migrate_units, verify_units_migration
from utils.migrate_json.migrate_locations_from_json import migrate_locations, verify_locations_migration
from utils.migrate_json.migrate_brands_from_json import migrate_brands, verify_brands_migration
from utils.migrate_json.migrate_items_from_json import migrate_items, verify_items_migration

async def check_prerequisites():
    """Check if all required files and database tables exist"""
    log_success("🔍 CHECKING PREREQUISITES")
    log_success("-" * 50)
    
    issues = []
    prereq_start = datetime.now()
    
    # Check required JSON files
    required_files = [
        ("categories.json", "Categories"),
        ("units.json", "Units of Measurement"),
        ("customers.json", "Customers"),
        ("suppliers.json", "Suppliers"),
        ("locations.json", "Locations"),
        ("brands.json", "Brands"),
    ]
    
    # Check for items files (either comprehensive_items.json or items.json)
    items_files = ["comprehensive_items.json", "items.json"]
    items_file_exists = any(os.path.exists(f"dummy_data/{file}") for file in items_files)
    
    for filename, description in required_files:
        if not os.path.exists(f"dummy_data/{filename}"):
            error_msg = f"❌ Missing file: dummy_data/{filename} (required for {description})"
            issues.append(error_msg)
            log_error(error_msg, error_details=f"File not found: dummy_data/{filename}")
        else:
            success_msg = f"✅ Found: dummy_data/{filename}"
            log_success(success_msg, details=f"File exists and accessible: dummy_data/{filename}")
    
    if not items_file_exists:
        error_msg = f"❌ Missing items file: Need either dummy_data/comprehensive_items.json or dummy_data/items.json"
        issues.append(error_msg)
        log_error(error_msg, error_details="No items JSON file found in dummy_data directory")
    else:
        existing_items_file = next((f for f in items_files if os.path.exists(f"dummy_data/{f}")), None)
        success_msg = f"✅ Found: dummy_data/{existing_items_file}"
        log_success(success_msg, details=f"Items file located: dummy_data/{existing_items_file}")
    
    # Check database tables
    try:
        from sqlalchemy import text
        from app.core.database import AsyncSessionLocal
        
        required_tables = [
            "categories", "units_of_measurement", "customers", 
            "suppliers", "locations", "brands", "items"
        ]
        
        async with AsyncSessionLocal() as session:
            for table in required_tables:
                try:
                    result = await session.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = '{table}'
                        );
                    """))
                    table_exists = result.scalar()
                    if table_exists:
                        success_msg = f"✅ Database table exists: {table}"
                        log_success(success_msg, details=f"Table {table} found in database schema")
                    else:
                        error_msg = f"❌ Missing database table: {table}"
                        issues.append(error_msg)
                        log_error(error_msg, error_details=f"Table {table} not found in database schema")
                except Exception as e:
                    error_msg = f"❌ Error checking table {table}: {e}"
                    issues.append(error_msg)
                    log_error(
                        error_msg, 
                        error_details=f"Database query failed for table {table}",
                        traceback_info=traceback.format_exc()
                    )
                    
    except Exception as e:
        error_msg = f"❌ Database connection error: {e}"
        issues.append(error_msg)
        log_error(
            error_msg,
            error_details="Failed to connect to database for table verification",
            traceback_info=traceback.format_exc()
        )
    
    prereq_end = datetime.now()
    prereq_duration = (prereq_end - prereq_start).total_seconds()
    
    if issues:
        log_error("⚠️  PREREQUISITE ISSUES FOUND:")
        
        # Write detailed prerequisite failure summary
        with open(error_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - PREREQUISITE FAILURE SUMMARY\n")
            f.write(f"{'='*60}\n")
            f.write(f"Total Issues Found: {len(issues)}\n")
            f.write(f"Check Duration: {prereq_duration:.2f} seconds\n")
            f.write(f"Issues:\n")
            for i, issue in enumerate(issues, 1):
                f.write(f"  {i}. {issue}\n")
            f.write(f"\nRecommended Actions:\n")
            f.write(f"  1. Run 'alembic upgrade head' to create missing database tables\n")
            f.write(f"  2. Create missing JSON files in the dummy_data/ directory\n")
            f.write(f"  3. Check database connection settings in .env file\n")
            f.write(f"{'='*60}\n\n")
        
        for issue in issues:
            log_error(f"   {issue}")
        log_success("🔧 RECOMMENDED ACTIONS:")
        log_success("   1. Run 'alembic upgrade head' to create missing database tables")
        log_success("   2. Create missing JSON files in the dummy_data/ directory")
        log_success("   3. Check database connection settings in .env file")
        return False
    else:
        log_success(f"✅ All prerequisites satisfied! (Check completed in {prereq_duration:.2f}s)")
        
        # Write successful prerequisite summary
        with open(success_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - PREREQUISITE CHECK SUCCESS\n")
            f.write(f"{'='*60}\n")
            f.write(f"All required files and database tables verified\n")
            f.write(f"Check Duration: {prereq_duration:.2f} seconds\n")
            f.write(f"Files Checked: {len(required_files) + 1} (including items file)\n")
            f.write(f"Database Tables Checked: {len(required_tables)}\n")
            f.write(f"{'='*60}\n\n")
        
        return True

async def run_migration_step(step_num, step_name, migration_func, verify_func=None):
    """Helper function to run a migration step with comprehensive logging"""
    step_start = datetime.now()
    
    # Log step start
    step_header = f"{step_num}️⃣ MIGRATING {step_name.upper()}"
    logger.info(f"\n{step_header}")
    logger.info("-" * len(step_header))
    log_success(f"Step {step_num} started at: {step_start.strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        log_success(f"Executing migration function for {step_name}...")
        result = await migration_func()
        
        if result:
            if verify_func:
                log_success(f"Running verification for {step_name}...")
                await verify_func()
            
            step_end = datetime.now()
            duration = (step_end - step_start).total_seconds()
            
            # Log successful step
            log_step_summary(
                step_name, 
                success=True, 
                duration=duration,
                details=f"Migration and verification completed successfully"
            )
            
            return {"success": True, "duration": duration}
        else:
            step_end = datetime.now()
            duration = (step_end - step_start).total_seconds()
            
            # Log failed step
            error_msg = "Migration function returned False"
            log_step_summary(
                step_name,
                success=False,
                duration=duration,
                error=error_msg
            )
            
            return {"success": False, "error": error_msg, "duration": duration}
            
    except Exception as e:
        step_end = datetime.now()
        duration = (step_end - step_start).total_seconds()
        
        # Log exception with full details
        traceback_info = traceback.format_exc()
        log_step_summary(
            step_name,
            success=False,
            duration=duration,
            error=str(e)
        )
        
        # Log detailed error information
        log_error(
            f"Exception in {step_name} migration: {e}",
            error_details=str(e),
            traceback_info=traceback_info
        )
        
        return {"success": False, "error": str(e), "duration": duration}

async def migrate_all():
    """Run all migrations in the correct order"""
    log_success("🚀 STARTING COMPLETE DATA MIGRATION FROM JSON FILES")
    log_success("=" * 60)
    
    success_count = 0
    total_migrations = 7
    failed_migrations = []
    successful_migrations = []
    
    start_time = datetime.now()
    log_success(f"Migration batch started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Define migration steps
    migration_steps = [
        (1, "Categories", migrate_categories, verify_categories_migration),
        (2, "Units of Measurement", migrate_units, verify_units_migration),
        (3, "Customers", migrate_customers, None),
        (4, "Suppliers", migrate_suppliers, verify_suppliers),
        (5, "Locations", migrate_locations, verify_locations_migration),
        (6, "Brands", migrate_brands, verify_brands_migration),
        (7, "Items", migrate_items, verify_items_migration),
    ]
    
    # Execute each migration step
    for step_num, step_name, migration_func, verify_func in migration_steps:
        result = await run_migration_step(step_num, step_name, migration_func, verify_func)
        
        if result["success"]:
            success_count += 1
            successful_migrations.append(step_name)
        else:
            failed_migrations.append({
                "name": step_name,
                "error": result["error"],
                "step": step_num,
                "duration": result["duration"]
            })
    

    
    # Final Summary
    end_time = datetime.now()
    total_duration = (end_time - start_time).total_seconds()
    
    log_success("\n" + "=" * 60)
    log_success("📊 MIGRATION SUMMARY")
    log_success("=" * 60)
    log_success(f"Migration batch completed at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    log_success(f"Total duration: {total_duration:.2f} seconds")
    log_success(f"✅ Successful migrations: {success_count}/{total_migrations}")
    
    if total_migrations - success_count > 0:
        log_error(f"❌ Failed migrations: {total_migrations - success_count}/{total_migrations}")
    
    # Write comprehensive summary to both files
    summary_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Success file summary
    with open(success_log_path, 'a', encoding='utf-8') as f:
        f.write(f"\n{summary_timestamp} - FINAL MIGRATION SUMMARY\n")
        f.write(f"{'='*70}\n")
        f.write(f"Migration Batch Completed: {end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total Duration: {total_duration:.2f} seconds\n")
        f.write(f"Successful Migrations: {success_count}/{total_migrations}\n")
        f.write(f"Failed Migrations: {total_migrations - success_count}/{total_migrations}\n")
        
        if successful_migrations:
            f.write(f"\nSuccessful Migrations:\n")
            for i, migration in enumerate(successful_migrations, 1):
                f.write(f"  {i}. ✅ {migration}\n")
        
        f.write(f"\nSystem Information:\n")
        f.write(f"  • Working Directory: {os.getcwd()}\n")
        f.write(f"  • Python Version: {sys.version.split()[0]}\n")
        f.write(f"  • Success Log: {success_log_path}\n")
        f.write(f"  • Error Log: {error_log_path}\n")
        f.write(f"{'='*70}\n\n")
    
    # Show successful migrations
    if successful_migrations:
        log_success(f"\n🎉 SUCCESSFUL MIGRATIONS:")
        for i, migration in enumerate(successful_migrations, 1):
            log_success(f"   {i}. ✅ {migration}")
    
    # Show failed migrations with detailed error information
    if failed_migrations:
        log_error(f"\n💥 FAILED MIGRATIONS:")
        
        # Write detailed failure summary to error file
        with open(error_log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n{summary_timestamp} - FAILED MIGRATIONS SUMMARY\n")
            f.write(f"{'='*70}\n")
            f.write(f"Total Failed: {len(failed_migrations)}\n")
            f.write(f"Failed Steps:\n")
            
            for failure in failed_migrations:
                f.write(f"\n  Step {failure['step']}: {failure['name']}\n")
                f.write(f"    Duration: {failure.get('duration', 'N/A'):.2f}s\n")
                f.write(f"    Error: {failure['error']}\n")
                
                # Provide specific troubleshooting suggestions
                if "No such file or directory" in failure['error'] or "FileNotFoundError" in failure['error']:
                    json_file = f"{failure['name'].lower().replace(' ', '_').replace('of_measurement', '')}.json"
                    if failure['name'] == "Units of Measurement":
                        json_file = "units.json"
                    elif failure['name'] == "Customers":
                        json_file = "customers.json"
                    elif failure['name'] == "Suppliers":
                        json_file = "suppliers.json"
                    elif failure['name'] == "Locations":
                        json_file = "locations.json"
                    elif failure['name'] == "Brands":
                        json_file = "brands.json"
                    elif failure['name'] == "Categories":
                        json_file = "categories.json"
                    elif failure['name'] == "Items":
                        json_file = "comprehensive_items.json or items.json"
                    f.write(f"    💡 Solution: Create the missing file 'dummy_data/{json_file}'\n")
                elif "does not exist" in failure['error'] and "table" in failure['error']:
                    f.write(f"    💡 Solution: Run database migrations first: 'alembic upgrade head'\n")
                elif "Migration function returned False" in failure['error']:
                    f.write(f"    💡 Solution: Check the individual migration logs for specific errors\n")
            
            f.write(f"\nTroubleshooting Steps:\n")
            f.write(f"  1. Ensure all required JSON files exist in dummy_data/ directory\n")
            f.write(f"  2. Run 'alembic upgrade head' to create database tables\n")
            f.write(f"  3. Check file permissions and JSON format validity\n")
            f.write(f"  4. Run individual migrations to see detailed error messages\n")
            f.write(f"  5. Verify database connection settings in .env file\n")
            f.write(f"{'='*70}\n\n")
        
        for failure in failed_migrations:
            log_error(f"   {failure['step']}. ❌ {failure['name']} (Duration: {failure.get('duration', 'N/A'):.2f}s)")
            log_error(f"      Error: {failure['error']}")
    
    # Log system information for debugging
    log_success(f"\n🔧 SYSTEM INFORMATION:")
    log_success(f"   • Working Directory: {os.getcwd()}")
    log_success(f"   • Python Version: {sys.version.split()[0]}")
    log_success(f"   • Success Log: {success_log_path}")
    log_success(f"   • Error Log: {error_log_path}")
    
    if success_count == total_migrations:
        log_success("\n🎉 All migrations completed successfully!")
        return True
    else:
        log_error(f"\n⚠️  {total_migrations - success_count} migration(s) failed. See detailed error information above.")
        return False

async def verify_all():
    """Verify all migrations were successful"""
    log_success("\n🔍 VERIFYING ALL MIGRATIONS")
    log_success("=" * 40)
    
    verify_start = datetime.now()
    log_success(f"Verification started at: {verify_start.strftime('%Y-%m-%d %H:%M:%S')}")
    
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as session:
        try:
            # Check categories
            result = await session.execute(text("SELECT COUNT(*) FROM categories WHERE is_active = true"))
            category_count = result.scalar()
            log_success(f"📁 Active categories: {category_count}")
            
            # Check units
            result = await session.execute(text("SELECT COUNT(*) FROM units_of_measurement WHERE is_active = true"))
            unit_count = result.scalar()
            log_success(f"📏 Active units of measurement: {unit_count}")
            
            # Check customers
            result = await session.execute(text("SELECT COUNT(*) FROM customers WHERE is_active = true"))
            customer_count = result.scalar()
            log_success(f"👥 Active customers: {customer_count}")
            
            # Check suppliers
            result = await session.execute(text("SELECT COUNT(*) FROM suppliers WHERE is_active = true"))
            supplier_count = result.scalar()
            log_success(f"🏭 Active suppliers: {supplier_count}")
            
            # Check locations
            result = await session.execute(text("SELECT COUNT(*) FROM locations WHERE is_active = true"))
            location_count = result.scalar()
            log_success(f"📍 Active locations: {location_count}")
            
            # Check brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE is_active = true"))
            brand_count = result.scalar()
            log_success(f"🏷️  Active brands: {brand_count}")
            
            # Check items
            result = await session.execute(text("SELECT COUNT(*) FROM items WHERE is_active = true"))
            item_count = result.scalar()
            log_success(f"📦 Active items: {item_count}")
            
            # Show total records
            total_records = category_count + unit_count + customer_count + supplier_count + location_count + brand_count + item_count
            log_success(f"📊 Total active records: {total_records}")
            
            verify_end = datetime.now()
            verify_duration = (verify_end - verify_start).total_seconds()
            log_success(f"Verification completed in: {verify_duration:.2f} seconds")
            
            # Write detailed verification results to success file
            with open(success_log_path, 'a', encoding='utf-8') as f:
                f.write(f"\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DATABASE VERIFICATION RESULTS\n")
                f.write(f"{'='*60}\n")
                f.write(f"Verification Duration: {verify_duration:.2f} seconds\n")
                f.write(f"Record Counts:\n")
                f.write(f"  • Categories: {category_count}\n")
                f.write(f"  • Units of Measurement: {unit_count}\n")
                f.write(f"  • Customers: {customer_count}\n")
                f.write(f"  • Suppliers: {supplier_count}\n")
                f.write(f"  • Locations: {location_count}\n")
                f.write(f"  • Brands: {brand_count}\n")
                f.write(f"  • Items: {item_count}\n")
                f.write(f"  • Total Records: {total_records}\n")
                f.write(f"{'='*60}\n\n")
            
            if total_records > 0:
                log_success("✅ Database verification successful!")
                return True
            else:
                log_error("❌ No active records found in database!")
                return False
                
        except Exception as e:
            log_error(
                f"❌ Verification failed: {e}",
                error_details="Database verification process encountered an error",
                traceback_info=traceback.format_exc()
            )
            return False

if __name__ == "__main__":
    async def main():
        try:
            log_success("🎯 JSON TO DATABASE MIGRATION TOOL")
            log_success("=" * 60)
            
            # Check prerequisites first
            prerequisites_ok = await check_prerequisites()
            
            if not prerequisites_ok:
                log_error("\n💥 Prerequisites check failed. Please resolve the issues above before running migrations.")
                log_success(f"📄 Success log available at: {success_log_path}")
                log_error(f"📄 Error log available at: {error_log_path}")
                sys.exit(1)
            
            log_success("\n" + "=" * 60)
            
            # Run all migrations
            migration_success = await migrate_all()
            
            if migration_success:
                # Verify all data
                verification_success = await verify_all()
                
                if verification_success:
                    log_success("\n🎊 ALL OPERATIONS COMPLETED SUCCESSFULLY!")
                    log_success("Your database is now populated with data from JSON files.")
                    log_success(f"📄 Success log available at: {success_log_path}")
                    log_success(f"📄 Error log available at: {error_log_path}")
                else:
                    log_error("\n⚠️  Migration completed but verification failed.")
                    log_success(f"📄 Success log available at: {success_log_path}")
                    log_error(f"📄 Error log available at: {error_log_path}")
            else:
                log_error("\n💥 Migration process failed. Please check the detailed error information above.")
                log_success(f"📄 Success log available at: {success_log_path}")
                log_error(f"📄 Error log available at: {error_log_path}")
                sys.exit(1)
                
        except Exception as e:
            log_error(
                f"💥 CRITICAL ERROR: Unexpected error in main execution: {e}",
                error_details="Unexpected system error during migration process",
                traceback_info=traceback.format_exc()
            )
            log_success(f"📄 Success log available at: {success_log_path}")
            log_error(f"📄 Error log available at: {error_log_path}")
            sys.exit(1)
        finally:
            # Final log entry
            final_time = datetime.now()
            final_message = f"Migration process ended at: {final_time.strftime('%Y-%m-%d %H:%M:%S')}"
            
            # Write final entries to both log files
            with open(success_log_path, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"{final_time.strftime('%Y-%m-%d %H:%M:%S')} - MIGRATION PROCESS COMPLETED\n")
                f.write(f"Success log file: {success_log_path}\n")
                f.write(f"Error log file: {error_log_path}\n")
                f.write(f"{'='*80}\n")
            
            with open(error_log_path, 'a', encoding='utf-8') as f:
                f.write(f"\n{'='*80}\n")
                f.write(f"{final_time.strftime('%Y-%m-%d %H:%M:%S')} - MIGRATION PROCESS COMPLETED\n")
                f.write(f"Success log file: {success_log_path}\n")
                f.write(f"Error log file: {error_log_path}\n")
                f.write(f"{'='*80}\n")
            
            log_success("=" * 80)
            log_success(final_message)
            log_success(f"Success log saved to: {success_log_path}")
            log_success(f"Error log saved to: {error_log_path}")
            log_success("=" * 80)
    
    asyncio.run(main())