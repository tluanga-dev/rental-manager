#!/usr/bin/env python3
"""
Rental Manager Management Console

A comprehensive management interface for the rental management system.
Provides database administration, user management, and system maintenance tools.

Usage:
    python management/main.py                    # Interactive menu
    python management/main.py admin create       # Direct command
    python management/main.py db inspect         # Direct command
    python management/main.py --help            # Show help

Requirements:
    - Docker PostgreSQL must be running
    - Access to rental-manager-api directory
"""

import asyncio
import sys
import os
import subprocess
from pathlib import Path
from typing import Optional, List
from datetime import datetime

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

# Import all models first to ensure proper SQLAlchemy initialization
# Import base models first
from app.models.base import Base
from app.models.user import User, UserRole

# Import transaction models explicitly
from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionEvent, TransactionMetadata
)

# Import all other models
from app.models import *  # This ensures all models are registered

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm, IntPrompt
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.layout import Layout
from rich.live import Live
from rich.text import Text

# Import management modules
from config import config
from modules.admin_manager import AdminManager
from modules.database_inspector import DatabaseInspector
from modules.table_cleaner import TableCleaner
from modules.seed_manager import SeedManager
from modules.migration_manager import MigrationManager
from modules.backup_manager import BackupManager

console = Console()
app = typer.Typer(rich_markup_mode="rich", help="Rental Manager Management Console")


def show_banner():
    """Display the application banner"""
    banner = Panel.fit(
        "[bold blue]🏠 Rental Manager - Management Console[/bold blue]\n"
        "[dim]Database Administration & System Management Tools[/dim]",
        border_style="blue",
        padding=(1, 2)
    )
    console.print(banner)
    console.print()


def check_prerequisites() -> bool:
    """Check if all prerequisites are met"""
    issues = []
    
    # Check if Docker PostgreSQL is running
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=postgres", "--format", "table {{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "postgres" not in result.stdout:
            issues.append("PostgreSQL Docker container not running")
    except Exception:
        issues.append("Docker not available or not running")
    
    # Check rental-manager-api directory
    if not config.RENTAL_API_DIR.exists():
        issues.append(f"Rental API directory not found: {config.RENTAL_API_DIR}")
    
    # Validate configuration
    valid, config_issues = config.validate_environment()
    if not valid:
        issues.extend(config_issues)
    
    if issues:
        console.print("[bold red]❌ Prerequisites Check Failed[/bold red]")
        for issue in issues:
            console.print(f"  • [red]{issue}[/red]")
        console.print("\n[yellow]Please resolve these issues before continuing.[/yellow]")
        
        if "postgres" in str(issues).lower():
            console.print("\n[blue]To start PostgreSQL:[/blue]")
            console.print("  cd rental-manager-api")
            console.print("  docker-compose up -d postgres")
        
        return False
    
    console.print("[green]✅ All prerequisites satisfied[/green]")
    return True


async def test_connections():
    """Test database and Redis connections"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        # Test database connection
        task1 = progress.add_task("Testing database connection...", total=None)
        db_success, db_message = await config.test_database_connection()
        
        if db_success:
            progress.update(task1, description="[green]✓ Database connected[/green]")
        else:
            progress.update(task1, description=f"[red]✗ Database failed: {db_message}[/red]")
        
        # Test Redis connection
        task2 = progress.add_task("Testing Redis connection...", total=None)
        redis_success, redis_message = await config.test_redis_connection()
        
        if redis_success:
            progress.update(task2, description="[green]✓ Redis connected[/green]")
        else:
            progress.update(task2, description=f"[yellow]⚠ Redis not available: {redis_message}[/yellow]")
    
    return db_success


def display_main_menu() -> str:
    """Display main menu and get user selection"""
    menu_options = {
        "1": "👤 Admin Management",
        "2": "📊 Database Inspector", 
        "3": "🗑️ Table Cleaner",
        "4": "🌱 Seed Manager",
        "5": "🔄 Migration Manager",
        "6": "💾 Backup & Restore",
        "7": "⚙️ System Status",
        "0": "❌ Exit"
    }
    
    # Create menu table
    menu_table = Table(title="Management Console Menu", show_header=False, box=None, padding=(0, 2))
    menu_table.add_column("Option", style="bold blue", width=6)
    menu_table.add_column("Description", style="white")
    
    for key, desc in menu_options.items():
        menu_table.add_row(f"[{key}]", desc)
    
    console.print(menu_table)
    console.print()
    
    while True:
        choice = Prompt.ask("[bold]Select an option", choices=list(menu_options.keys()))
        return choice


# Main menu handlers
async def handle_admin_management():
    """Handle admin management operations"""
    console.print("\n[bold blue]👤 Admin Management[/bold blue]")
    
    async for session in config.get_session():
        admin_manager = AdminManager(session, config.admin)
        
        while True:
            console.print("\n[dim]Admin Management Options:[/dim]")
            console.print("  [1] Create admin user")
            console.print("  [2] List all admin users") 
            console.print("  [3] Reset admin password")
            console.print("  [4] Validate admin credentials")
            console.print("  [0] Return to main menu")
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "0"])
            
            if choice == "0":
                break
            elif choice == "1":
                # Create admin user
                force = Confirm.ask("Force update if admin already exists?", default=False)
                success, message, user = await admin_manager.create_admin_user(force=force)
                
                if success and user:
                    console.print(f"[green]✓ {message}[/green]")
                    admin_manager.display_admin_summary(user)
                else:
                    console.print(f"[red]✗ {message}[/red]")
            
            elif choice == "2":
                # List admin users
                admins = await admin_manager.list_all_admins()
                admin_manager.display_admin_table(admins)
            
            elif choice == "3":
                # Reset password
                username = Prompt.ask("Enter admin username")
                new_password = Prompt.ask("Enter new password", password=True)
                
                success, message = await admin_manager.reset_admin_password(username, new_password)
                if success:
                    console.print(f"[green]✓ {message}[/green]")
                else:
                    console.print(f"[red]✗ {message}[/red]")
            
            elif choice == "4":
                # Validate credentials
                username = Prompt.ask("Enter username")
                password = Prompt.ask("Enter password", password=True)
                
                success, message, user = await admin_manager.validate_admin_credentials(username, password)
                if success and user:
                    console.print(f"[green]✓ {message}[/green]")
                    admin_manager.display_admin_summary(user)
                else:
                    console.print(f"[red]✗ {message}[/red]")


async def handle_database_inspector():
    """Handle database inspection operations"""
    console.print("\n[bold blue]📊 Database Inspector[/bold blue]")
    
    async for session in config.get_session():
        db_inspector = DatabaseInspector(session)
        
        while True:
            console.print("\n[dim]Database Inspector Options:[/dim]")
            console.print("  [1] Show all tables with counts")
            console.print("  [2] Show table relationships")
            console.print("  [3] Show database statistics")
            console.print("  [4] Show table details")
            console.print("  [5] Analyze table health")
            console.print("  [6] Export schema to JSON")
            console.print("  [0] Return to main menu")
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "5", "6", "0"])
            
            if choice == "0":
                break
            elif choice == "1":
                # Show all tables
                tables = await db_inspector.get_all_tables_with_counts()
                db_inspector.display_tables_summary(tables)
            
            elif choice == "2":
                # Show relationships
                relationships = await db_inspector.get_table_relationships()
                db_inspector.display_table_relationships(relationships)
            
            elif choice == "3":
                # Show database statistics
                stats = await db_inspector.get_database_statistics()
                db_inspector.display_database_statistics(stats)
            
            elif choice == "4":
                # Show table details
                table_name = Prompt.ask("Enter table name")
                details = await db_inspector.get_table_details(table_name)
                db_inspector.display_table_details(details)
            
            elif choice == "5":
                # Analyze table health
                health_data = await db_inspector.analyze_table_health()
                db_inspector.display_health_analysis(health_data)
            
            elif choice == "6":
                # Export schema
                output_file = Prompt.ask("Enter output file name", default="database_schema.json")
                output_path = config.BASE_DIR / output_file
                
                success, message = await db_inspector.export_schema_to_json(str(output_path))
                if success:
                    console.print(f"[green]✓ {message}[/green]")
                else:
                    console.print(f"[red]✗ {message}[/red]")


async def handle_table_cleaner():
    """Handle table cleaning operations"""
    console.print("\n[bold blue]🗑️ Table Cleaner[/bold blue]")
    
    async for session in config.get_session():
        table_cleaner = TableCleaner(session)
        
        while True:
            console.print("\n[dim]Table Cleaner Options:[/dim]")
            console.print("  [1] Clear selected tables")
            console.print("  [2] Clear all except auth data")
            console.print("  [3] Show table dependencies")
            console.print("  [4] Preview table data")
            console.print("  [0] Return to main menu")
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "0"])
            
            if choice == "0":
                break
            elif choice == "1":
                # Clear selected tables
                tables = await table_cleaner.get_all_user_tables()
                selected_tables = await table_cleaner.interactive_table_selection(tables)
                
                if selected_tables:
                    # Show dependencies
                    dependencies = await table_cleaner.analyze_table_dependencies(selected_tables)
                    if dependencies:
                        console.print("\n[yellow]Table Dependencies:[/yellow]")
                        table_cleaner.display_dependencies_tree(dependencies)
                    
                    # Confirm operation
                    if await table_cleaner.confirm_cleanup_operation(selected_tables):
                        dry_run = Confirm.ask("Perform dry run first?", default=True)
                        
                        # Execute cleanup
                        results = await table_cleaner.clear_tables(
                            selected_tables, 
                            preserve_auth=True,
                            dry_run=dry_run
                        )
                        
                        table_cleaner.display_cleanup_results(results)
                        
                        # If dry run was successful, ask to proceed
                        if dry_run and results['success'] and Confirm.ask("Proceed with actual cleanup?"):
                            results = await table_cleaner.clear_tables(
                                selected_tables,
                                preserve_auth=True,
                                dry_run=False
                            )
                            table_cleaner.display_cleanup_results(results)
            
            elif choice == "2":
                # Clear all except auth
                tables = await table_cleaner.get_all_user_tables()
                non_auth_tables = [t['table_name'] for t in tables if not t['is_protected']]
                
                if non_auth_tables:
                    console.print(f"[yellow]This will clear {len(non_auth_tables)} tables while preserving authentication data.[/yellow]")
                    
                    if await table_cleaner.confirm_cleanup_operation(non_auth_tables):
                        results = await table_cleaner.clear_tables(non_auth_tables, preserve_auth=True)
                        table_cleaner.display_cleanup_results(results)
            
            elif choice == "3":
                # Show dependencies
                tables = await table_cleaner.get_all_user_tables()
                table_names = [t['table_name'] for t in tables]
                dependencies = await table_cleaner.analyze_table_dependencies(table_names)
                table_cleaner.display_dependencies_tree(dependencies)
            
            elif choice == "4":
                # Preview table data
                table_name = Prompt.ask("Enter table name")
                preview_data = await table_cleaner.get_table_preview(table_name, limit=5)
                table_cleaner.display_table_preview(table_name, preview_data)


async def handle_seed_manager():
    """Handle data seeding operations"""
    console.print("\n[bold blue]🌱 Seed Manager[/bold blue]")
    
    async for session in config.get_session():
        seed_manager = SeedManager(session, config.DATA_DIR)
        
        while True:
            console.print("\n[dim]Seed Manager Options:[/dim]")
            console.print("  [1] Validate seed files")
            console.print("  [2] Seed all data")
            console.print("  [3] Seed specific entity")
            console.print("  [4] Show seed file contents")
            console.print("  [0] Return to main menu")
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "0"])
            
            if choice == "0":
                break
            elif choice == "1":
                # Validate seed files
                validation_results = seed_manager.validate_seed_files()
                seed_manager.display_validation_results(validation_results)
            
            elif choice == "2":
                # Seed all data
                skip_existing = Confirm.ask("Skip entities that already have data?", default=True)
                
                if Confirm.ask("Proceed with seeding all data?", default=False):
                    results = await seed_manager.seed_all(skip_existing=skip_existing)
                    seed_manager.display_seed_results(results)
            
            elif choice == "3":
                # Seed specific entity
                console.print("\n[dim]Available entities:[/dim]")
                for i, entity in enumerate(seed_manager.SEED_ORDER, 1):
                    console.print(f"  [{i}] {entity}")
                
                try:
                    choice_num = IntPrompt.ask("Select entity", choices=list(range(1, len(seed_manager.SEED_ORDER) + 1)))
                    entity_type = seed_manager.SEED_ORDER[choice_num - 1]
                    
                    skip_existing = Confirm.ask("Skip if data already exists?", default=True)
                    
                    created_count, errors, message = await seed_manager.seed_entity(entity_type, skip_existing)
                    
                    if created_count > 0:
                        console.print(f"[green]✓ {message}[/green]")
                    else:
                        console.print(f"[yellow]⚠ {message}[/yellow]")
                    
                    if errors:
                        console.print(f"[red]Errors encountered:[/red]")
                        for error in errors[:5]:  # Show first 5 errors
                            console.print(f"  • {error}")
                        
                except (ValueError, IndexError):
                    console.print("[red]Invalid selection[/red]")
            
            elif choice == "4":
                # Show seed file contents
                entity_type = Prompt.ask("Enter entity type", default="brands")
                success, data, message = seed_manager.load_seed_file(entity_type)
                
                if success:
                    console.print(f"[green]✓ {message}[/green]")
                    # Show first few records
                    for i, record in enumerate(data[:3]):
                        console.print(f"\n[blue]Record {i+1}:[/blue]")
                        for key, value in record.items():
                            console.print(f"  {key}: {value}")
                    
                    if len(data) > 3:
                        console.print(f"\n[dim]... and {len(data) - 3} more records[/dim]")
                else:
                    console.print(f"[red]✗ {message}[/red]")


async def handle_migration_manager():
    """Handle database migration operations with enhanced features"""
    console.print("\n[bold blue]🔄 Enhanced Migration Manager[/bold blue]")
    
    try:
        async for session in config.get_session():
            # Import enhanced migration manager
            from modules.migration_manager_enhanced import EnhancedMigrationManager, MigrationMode, MigrationStrategy
            from modules.migration_manager import MigrationManager
            
            # Initialize both basic and enhanced managers
            basic_manager = MigrationManager(session, config.RENTAL_API_DIR)
            enhanced_manager = EnhancedMigrationManager(session, config.RENTAL_API_DIR, config)
            
            while True:
                console.print("\n[dim]Enhanced Migration Manager Options:[/dim]")
                console.print("  [1] 🔬 Deep Model Analysis")
                console.print("  [2] 🚀 Generate Fresh Baseline Migration")
                console.print("  [3] ⬆️ Create Smart Upgrade Migration")
                console.print("  [4] 💾 Safe Migration with Auto-Backup")
                console.print("  [5] 🧪 Detect Schema Changes")
                console.print("  [6] 📊 Migration History & Status")
                console.print("  [7] 🛡️ Emergency Rollback")
                console.print("  [8] 🔧 Basic Migration Operations")
                console.print("  [0] Return to main menu")
                
                choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "5", "6", "7", "8", "0"])
                
                if choice == "0":
                    break
                    
                elif choice == "1":
                    # Deep Model Analysis
                    try:
                        report = await enhanced_manager.analyze_models_deep()
                        
                        # Show detailed analysis options
                        while True:
                            console.print("\n[dim]Analysis Options:[/dim]")
                            console.print("  [1] Show dependency graph")
                            console.print("  [2] Show model details")
                            console.print("  [3] Export analysis report")
                            console.print("  [0] Back to migration menu")
                            
                            analysis_choice = Prompt.ask("Select option", choices=["1", "2", "3", "0"])
                            
                            if analysis_choice == "0":
                                break
                            elif analysis_choice == "1":
                                enhanced_manager.model_analyzer.display_dependency_graph(report)
                            elif analysis_choice == "2":
                                model_name = Prompt.ask("Enter model name to analyze")
                                enhanced_manager.model_analyzer.display_model_details(model_name, report)
                            elif analysis_choice == "3":
                                # Export analysis report
                                output_file = Prompt.ask("Enter output file name", default="model_analysis_report.json")
                                output_path = config.BASE_DIR / output_file
                                
                                report_data = {
                                    "analysis_timestamp": report.analysis_timestamp.isoformat(),
                                    "total_models": report.total_models,
                                    "total_tables": report.total_tables,
                                    "total_relationships": report.total_relationships,
                                    "circular_dependencies": report.circular_dependencies,
                                    "orphaned_models": report.orphaned_models,
                                    "base_model_inconsistencies": report.base_model_inconsistencies,
                                    "dependency_order": report.dependency_order
                                }
                                
                                import json
                                with open(output_path, 'w') as f:
                                    json.dump(report_data, f, indent=2, default=str)
                                
                                console.print(f"[green]✅ Analysis report exported to {output_path}[/green]")
                        
                    except Exception as e:
                        console.print(f"[red]❌ Model analysis failed: {e}[/red]")
                
                elif choice == "2":
                    # Generate Fresh Baseline Migration
                    try:
                        # Create migration plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.FRESH_BASELINE,
                            MigrationStrategy.STANDARD
                        )
                        
                        # Display plan and get confirmation
                        if enhanced_manager.confirm_migration_execution(plan):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\n[bold green]🎉 Fresh baseline migration completed successfully![/bold green]")
                            else:
                                console.print("\n[bold red]❌ Fresh baseline migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Fresh baseline migration failed: {e}[/red]")
                
                elif choice == "3":
                    # Create Smart Upgrade Migration
                    try:
                        # Choose strategy
                        console.print("\n[bold blue]Select Migration Strategy:[/bold blue]")
                        console.print("  [1] Conservative (Maximum safety)")
                        console.print("  [2] Standard (Balanced)")
                        console.print("  [3] Aggressive (Fast execution)")
                        
                        strategy_choice = Prompt.ask("Select strategy", choices=["1", "2", "3"], default="2")
                        strategy_map = {
                            "1": MigrationStrategy.CONSERVATIVE,
                            "2": MigrationStrategy.STANDARD,
                            "3": MigrationStrategy.AGGRESSIVE
                        }
                        strategy = strategy_map[strategy_choice]
                        
                        # Create migration plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.INCREMENTAL,
                            strategy
                        )
                        
                        # Display plan and get confirmation
                        if enhanced_manager.confirm_migration_execution(plan):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\n[bold green]🎉 Smart upgrade migration completed successfully![/bold green]")
                            else:
                                console.print("\n[bold red]❌ Smart upgrade migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Smart upgrade migration failed: {e}[/red]")
                
                elif choice == "4":
                    # Safe Migration with Auto-Backup
                    try:
                        # Create safe upgrade plan
                        plan = await enhanced_manager.create_migration_plan(
                            MigrationMode.INCREMENTAL,
                            MigrationStrategy.CONSERVATIVE
                        )
                        
                        # Show backup options
                        console.print("\n[yellow]🛡️ This operation will create an automatic backup[/yellow]")
                        if Confirm.ask("Proceed with safe migration?", default=True):
                            result = await enhanced_manager.execute_migration_plan(plan)
                            
                            if result.success:
                                console.print("\n[bold green]🎉 Safe migration completed successfully![/bold green]")
                            else:
                                console.print("\n[bold red]❌ Safe migration failed![/bold red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Safe migration failed: {e}[/red]")
                
                elif choice == "5":
                    # Detect Schema Changes
                    try:
                        console.print("\n[yellow]🧪 Analyzing schema changes...[/yellow]")
                        changes = await enhanced_manager.detect_schema_changes()
                        
                        if changes:
                            console.print(f"\n[bold yellow]📋 Found {len(changes)} schema changes:[/bold yellow]")
                            for change in changes[:10]:  # Show first 10
                                console.print(f"  • {change}")
                            if len(changes) > 10:
                                console.print(f"  ... and {len(changes) - 10} more changes")
                        else:
                            console.print("\n[green]✅ No schema changes detected[/green]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Schema change detection failed: {e}[/red]")
                
                elif choice == "6":
                    # Migration History & Status
                    try:
                        # Show comprehensive migration status
                        current_rev = await basic_manager.get_current_revision()
                        history = basic_manager.get_migration_history()
                        schema_info = await basic_manager.get_database_schema_version()
                        
                        basic_manager.display_schema_info(schema_info)
                        basic_manager.display_migration_status(history, current_rev)
                        
                        # Show pending migrations
                        pending = basic_manager.get_pending_migrations()
                        if pending:
                            console.print(f"\n[yellow]📋 Pending migrations: {len(pending)}[/yellow]")
                        else:
                            console.print("\n[green]✅ No pending migrations[/green]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Migration status failed: {e}[/red]")
                
                elif choice == "7":
                    # Emergency Rollback
                    try:
                        console.print("\n[bold red]🚨 Emergency Rollback[/bold red]")
                        console.print("[yellow]This will rollback the last migration[/yellow]")
                        
                        if Confirm.ask("Are you sure you want to rollback?", default=False):
                            success, message = basic_manager.rollback_migration()
                            if success:
                                console.print(f"[green]✅ {message}[/green]")
                            else:
                                console.print(f"[red]❌ {message}[/red]")
                    
                    except Exception as e:
                        console.print(f"[red]❌ Emergency rollback failed: {e}[/red]")
                
                elif choice == "8":
                    # Basic Migration Operations
                    while True:
                        console.print("\n[dim]Basic Migration Operations:[/dim]")
                        console.print("  [1] Show migration status")
                        console.print("  [2] Apply migrations")
                        console.print("  [3] Rollback migration")
                        console.print("  [4] Generate migration")
                        console.print("  [5] Show migration SQL")
                        console.print("  [6] Validate migration integrity")
                        console.print("  [0] Back to enhanced menu")
                        
                        basic_choice = Prompt.ask("Select option", choices=["1", "2", "3", "4", "5", "6", "0"])
                        
                        if basic_choice == "0":
                            break
                        elif basic_choice == "1":
                            # Show migration status
                            current_rev = await basic_manager.get_current_revision()
                            history = basic_manager.get_migration_history()
                            basic_manager.display_migration_status(history, current_rev)
                        
                        elif basic_choice == "2":
                            # Apply migrations
                            target = Prompt.ask("Target revision", default="head")
                            
                            if basic_manager.confirm_migration_operation("Apply Migrations", f"Target: {target}"):
                                success, message = basic_manager.apply_migrations(target)
                                if success:
                                    console.print(f"[green]✓ {message}[/green]")
                                else:
                                    console.print(f"[red]✗ {message}[/red]")
                        
                        elif basic_choice == "3":
                            # Rollback migration
                            target = Prompt.ask("Target revision", default="-1")
                            
                            if basic_manager.confirm_migration_operation("Rollback Migration", f"Target: {target}"):
                                success, message = basic_manager.rollback_migration(target)
                                if success:
                                    console.print(f"[green]✓ {message}[/green]")
                                else:
                                    console.print(f"[red]✗ {message}[/red]")
                        
                        elif basic_choice == "4":
                            # Generate migration
                            message = Prompt.ask("Migration message")
                            autogenerate = Confirm.ask("Auto-generate from model changes?", default=True)
                            
                            success, result_message, migration_file = basic_manager.generate_migration(message, autogenerate)
                            
                            if success:
                                console.print(f"[green]✓ {result_message}[/green]")
                                if migration_file:
                                    console.print(f"[blue]Migration file: {migration_file}[/blue]")
                            else:
                                console.print(f"[red]✗ {result_message}[/red]")
                        
                        elif basic_choice == "5":
                            # Show migration SQL
                            from_rev = Prompt.ask("From revision (optional)", default="")
                            to_rev = Prompt.ask("To revision", default="head")
                            
                            success, sql = basic_manager.get_migration_sql(
                                from_revision=from_rev if from_rev else None,
                                to_revision=to_rev
                            )
                            
                            if success:
                                basic_manager.display_migration_sql(sql)
                            else:
                                console.print(f"[red]✗ {sql}[/red]")
                        
                        elif basic_choice == "6":
                            # Validate migration integrity
                            valid, issues = basic_manager.validate_migration_integrity()
                            
                            if valid:
                                console.print("[green]✓ Migration integrity check passed[/green]")
                            else:
                                console.print("[red]✗ Migration integrity issues found:[/red]")
                                for issue in issues:
                                    console.print(f"  • {issue}")
            
            # Add some spacing for better readability
            console.print()
    
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️ Migration manager interrupted[/yellow]")
    except Exception as e:
        console.print(f"[red]❌ Unexpected error in migration manager: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")


async def handle_backup_manager():
    """Handle backup and restore operations"""
    console.print("\n[bold blue]💾 Backup & Restore[/bold blue]")
    
    async for session in config.get_session():
        backup_manager = BackupManager(session, config.BACKUP_DIR, config.db)
        
        while True:
            console.print("\n[dim]Backup & Restore Options:[/dim]")
            console.print("  [1] Create full backup")
            console.print("  [2] Create schema backup")
            console.print("  [3] Create table backup")
            console.print("  [4] List all backups")
            console.print("  [5] Restore from backup")
            console.print("  [6] Delete backup")
            console.print("  [7] Cleanup old backups")
            console.print("  [0] Return to main menu")
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "5", "6", "7", "0"])
            
            if choice == "0":
                break
            elif choice == "1":
                # Create full backup
                backup_name = Prompt.ask("Backup name (optional)", default="")
                compress = Confirm.ask("Compress backup?", default=True)
                
                success, message, backup_file = backup_manager.create_full_backup(
                    backup_name=backup_name if backup_name else None,
                    compress=compress
                )
                
                if success:
                    console.print(f"[green]✓ {message}[/green]")
                    if backup_file:
                        console.print(f"[blue]Backup file: {backup_file}[/blue]")
                else:
                    console.print(f"[red]✗ {message}[/red]")
            
            elif choice == "2":
                # Create schema backup
                backup_name = Prompt.ask("Backup name (optional)", default="")
                
                success, message, backup_file = backup_manager.create_schema_backup(
                    backup_name=backup_name if backup_name else None
                )
                
                if success:
                    console.print(f"[green]✓ {message}[/green]")
                else:
                    console.print(f"[red]✗ {message}[/red]")
            
            elif choice == "4":
                # List backups
                backups = backup_manager.list_backups()
                backup_manager.display_backups_table(backups)
                
                # Show recommendations
                db_info = await backup_manager.get_database_info_for_backup()
                recommendations = backup_manager.get_backup_recommendations(db_info)
                
                if recommendations:
                    console.print("\n[bold blue]💡 Backup Recommendations:[/bold blue]")
                    for rec in recommendations:
                        console.print(f"  {rec}")
            
            elif choice == "7":
                # Cleanup old backups
                keep_days = IntPrompt.ask("Keep backups from last N days", default=30)
                keep_count = IntPrompt.ask("Keep at least N newest backups", default=10)
                
                if Confirm.ask(f"Delete backups older than {keep_days} days (keeping {keep_count} newest)?"):
                    cleanup_results = backup_manager.cleanup_old_backups(keep_days, keep_count)
                    backup_manager.display_cleanup_results(cleanup_results)


async def handle_system_status():
    """Display system status information"""
    console.print("\n[bold blue]⚙️ System Status[/bold blue]")
    
    # Test connections
    console.print("\n[dim]Connection Status:[/dim]")
    await test_connections()
    
    # Show configuration
    console.print("\n[dim]Configuration:[/dim]")
    config_table = Table(show_header=False, box=None, padding=(0, 2))
    config_table.add_column("Setting", style="blue", width=20)
    config_table.add_column("Value", style="white")
    
    config_table.add_row("Database Host", config.db.POSTGRES_HOST)
    config_table.add_row("Database Port", str(config.db.POSTGRES_PORT))
    config_table.add_row("Database Name", config.db.POSTGRES_DB)
    config_table.add_row("Redis URL", config.redis.REDIS_URL)
    config_table.add_row("Data Directory", str(config.DATA_DIR))
    config_table.add_row("Backup Directory", str(config.BACKUP_DIR))
    config_table.add_row("API Directory", str(config.RENTAL_API_DIR))
    
    console.print(config_table)
    
    # Show Docker status
    console.print("\n[dim]Docker Services:[/dim]")
    try:
        result = subprocess.run(
            ["docker-compose", "ps", "--format", "table {{.Name}}\t{{.Status}}\t{{.Ports}}"],
            cwd=config.RENTAL_API_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            console.print(result.stdout)
        else:
            console.print(f"[red]Error checking Docker status: {result.stderr}[/red]")
            
    except Exception as e:
        console.print(f"[red]Error checking Docker services: {e}[/red]")


async def main_interactive():
    """Main interactive menu loop"""
    show_banner()
    
    # Check prerequisites
    if not check_prerequisites():
        return
    
    # Test connections
    console.print()
    if not await test_connections():
        console.print("\n[red]❌ Database connection failed. Please check your configuration.[/red]")
        return
    
    console.print("\n[green]🚀 Management console ready![/green]")
    
    # Main menu loop
    while True:
        console.print("\n" + "="*60)
        choice = display_main_menu()
        
        try:
            if choice == "0":
                console.print("\n[blue]👋 Goodbye![/blue]")
                break
            elif choice == "1":
                await handle_admin_management()
            elif choice == "2":
                await handle_database_inspector()
            elif choice == "3":
                await handle_table_cleaner()
            elif choice == "4":
                await handle_seed_manager()
            elif choice == "5":
                await handle_migration_manager()
            elif choice == "6":
                await handle_backup_manager()
            elif choice == "7":
                await handle_system_status()
            
        except KeyboardInterrupt:
            console.print("\n\n[yellow]⚠ Operation cancelled by user[/yellow]")
        except Exception as e:
            console.print(f"\n[red]❌ Unexpected error: {e}[/red]")
            import traceback
            console.print(f"[dim]{traceback.format_exc()}[/dim]")


# CLI Commands using Typer
@app.command()
def interactive():
    """Launch interactive management console"""
    asyncio.run(main_interactive())


@app.command()
def status():
    """Show system status"""
    asyncio.run(handle_system_status())


@app.callback()
def main(ctx: typer.Context):
    """
    Rental Manager Management Console
    
    A comprehensive database administration and system management tool.
    """
    # If no subcommand is provided, run interactive mode
    if ctx.invoked_subcommand is None:
        interactive()


if __name__ == "__main__":
    # Direct execution runs interactive mode
    try:
        asyncio.run(main_interactive())
    except KeyboardInterrupt:
        console.print("\n\n[yellow]👋 Management console terminated by user[/yellow]")
    except Exception as e:
        console.print(f"\n[red]❌ Fatal error: {e}[/red]")
        sys.exit(1)