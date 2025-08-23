#!/usr/bin/env python3
"""
Focused Migration Management Testing

Tests core migration functionality without complex model analysis
that may have dependency issues.
"""

import asyncio
import subprocess
import sys
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Add the rental-manager-api to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

from config import Config
from modules.migration_manager import MigrationManager

console = Console()

class FocusedMigrationTestSuite:
    """Focused migration management test suite"""
    
    def __init__(self):
        self.config = None
        self.session = None
        self.migration_manager = None
        self.rental_api_dir = Path(__file__).parent.parent / "rental-manager-api"
        self.test_results = {}
    
    async def setup(self):
        """Initialize components"""
        console.print("[bold blue]🔧 Setting up test environment...[/bold blue]")
        
        self.config = Config()
        
        async for session in self.config.get_session():
            self.session = session
            self.migration_manager = MigrationManager(session, self.rental_api_dir)
            break
    
    def record_test_result(self, test_name: str, success: bool, message: str = "", details: dict = None):
        """Record test result"""
        self.test_results[test_name] = {
            "success": success,
            "message": message,
            "details": details or {}
        }
        
        status = "✅" if success else "❌"
        console.print(f"  {status} {test_name}: {message}")
    
    async def test_database_setup(self):
        """Test if Alembic is properly initialized"""
        console.print("\n[bold yellow]🔍 Testing Database Setup[/bold yellow]")
        
        try:
            # Check if alembic_version table exists
            current_revision = await self.migration_manager.get_current_revision()
            
            if current_revision is None:
                # Database not initialized with Alembic
                console.print("[yellow]⚠️  Database not initialized with Alembic[/yellow]")
                
                # Initialize Alembic
                console.print("[blue]Initializing Alembic...[/blue]")
                success = await self._initialize_alembic()
                
                if success:
                    current_revision = await self.migration_manager.get_current_revision()
                    self.record_test_result("alembic_initialization", True, f"Initialized, revision: {current_revision}")
                else:
                    self.record_test_result("alembic_initialization", False, "Failed to initialize Alembic")
            else:
                self.record_test_result("alembic_already_initialized", True, f"Already initialized, revision: {current_revision}")
            
        except Exception as e:
            self.record_test_result("database_setup", False, f"Error: {e}")
    
    async def _initialize_alembic(self):
        """Initialize Alembic if not already done"""
        try:
            # Initialize alembic version table
            success, stdout, stderr = self.migration_manager._run_alembic_command(["stamp", "head"])
            
            if success:
                console.print("[green]✅ Alembic initialized successfully[/green]")
                return True
            else:
                console.print(f"[red]❌ Alembic initialization failed: {stderr}[/red]")
                return False
                
        except Exception as e:
            console.print(f"[red]❌ Error initializing Alembic: {e}[/red]")
            return False
    
    async def test_core_migration_features(self):
        """Test core migration management features"""
        console.print("\n[bold yellow]⚙️ Testing Core Migration Features[/bold yellow]")
        
        try:
            # Test 1: Get current revision
            current_revision = await self.migration_manager.get_current_revision()
            self.record_test_result(
                "get_current_revision", 
                current_revision is not None, 
                f"Current revision: {current_revision}"
            )
            
            # Test 2: Get migration history
            history = self.migration_manager.get_migration_history()
            self.record_test_result(
                "get_migration_history", 
                isinstance(history, list), 
                f"Found {len(history)} migrations in history"
            )
            
            # Test 3: Get pending migrations
            pending = self.migration_manager.get_pending_migrations()
            self.record_test_result(
                "get_pending_migrations", 
                isinstance(pending, list), 
                f"Found {len(pending)} pending migrations"
            )
            
            # Test 4: Validate migration integrity
            valid, issues = self.migration_manager.validate_migration_integrity()
            self.record_test_result(
                "validate_migration_integrity", 
                valid, 
                f"Validation {'passed' if valid else 'failed'}, {len(issues)} issues"
            )
            
            # Test 5: Get database schema version
            schema_info = await self.migration_manager.get_database_schema_version()
            self.record_test_result(
                "get_database_schema_version", 
                "error" not in schema_info, 
                f"Database: {schema_info.get('database_name', 'unknown')}, Tables: {schema_info.get('table_count', 0)}"
            )
            
        except Exception as e:
            self.record_test_result("core_migration_features", False, f"Error: {e}")
    
    def test_alembic_commands(self):
        """Test Alembic command execution"""
        console.print("\n[bold yellow]🔧 Testing Alembic Commands[/bold yellow]")
        
        try:
            # Test 1: Alembic current
            success, stdout, stderr = self.migration_manager._run_alembic_command(["current"])
            self.record_test_result(
                "alembic_current_command", 
                success, 
                f"Command {'successful' if success else 'failed'}"
            )
            
            # Test 2: Alembic history
            success, stdout, stderr = self.migration_manager._run_alembic_command(["history"])
            self.record_test_result(
                "alembic_history_command", 
                success, 
                f"History command {'successful' if success else 'failed'}"
            )
            
            # Test 3: Alembic heads
            success, stdout, stderr = self.migration_manager._run_alembic_command(["heads"])
            self.record_test_result(
                "alembic_heads_command", 
                success, 
                f"Heads command {'successful' if success else 'failed'}"
            )
            
            # Test 4: Get migration SQL (dry run)
            success, sql = self.migration_manager.get_migration_sql()
            self.record_test_result(
                "get_migration_sql", 
                success, 
                f"SQL generation {'successful' if success else 'failed'}"
            )
            
        except Exception as e:
            self.record_test_result("alembic_commands", False, f"Error: {e}")
    
    def test_migration_files(self):
        """Test migration file operations"""
        console.print("\n[bold yellow]📁 Testing Migration Files[/bold yellow]")
        
        try:
            # Check versions directory
            versions_dir = self.rental_api_dir / "alembic" / "versions"
            
            if not versions_dir.exists():
                self.record_test_result("versions_directory", False, "Versions directory not found")
                return
            
            # Get migration files
            migration_files = list(versions_dir.glob("*.py"))
            migration_files = [f for f in migration_files if not f.name.startswith("__")]
            
            self.record_test_result(
                "migration_files_found", 
                len(migration_files) > 0, 
                f"Found {len(migration_files)} migration files"
            )
            
            # Test reading a migration file
            if migration_files:
                sample_file = migration_files[0]
                content = self.migration_manager.get_migration_file_content(sample_file.name)
                self.record_test_result(
                    "read_migration_file", 
                    content is not None and len(content) > 0, 
                    f"Read {len(content) if content else 0} characters from {sample_file.name}"
                )
            
        except Exception as e:
            self.record_test_result("migration_files", False, f"Error: {e}")
    
    def test_migration_templates(self):
        """Test migration templates"""
        console.print("\n[bold yellow]📝 Testing Migration Templates[/bold yellow]")
        
        try:
            # Get templates
            templates = self.migration_manager.get_migration_templates()
            
            self.record_test_result(
                "get_migration_templates", 
                len(templates) > 0, 
                f"Found {len(templates)} templates"
            )
            
            # Check template content
            expected_templates = ["add_table", "add_column", "add_index"]
            missing_templates = []
            
            for template_name in expected_templates:
                if template_name not in templates:
                    missing_templates.append(template_name)
            
            self.record_test_result(
                "validate_template_content", 
                len(missing_templates) == 0, 
                f"All expected templates present" if len(missing_templates) == 0 else f"Missing: {', '.join(missing_templates)}"
            )
            
            # Test template display
            self.migration_manager.show_migration_templates()
            self.record_test_result("display_templates", True, "Templates displayed successfully")
            
        except Exception as e:
            self.record_test_result("migration_templates", False, f"Error: {e}")
    
    async def test_migration_display_features(self):
        """Test migration display and UI features"""
        console.print("\n[bold yellow]🎨 Testing Display Features[/bold yellow]")
        
        try:
            # Test migration status display
            current_revision = await self.migration_manager.get_current_revision()
            history = self.migration_manager.get_migration_history()
            
            self.migration_manager.display_migration_status(history, current_revision)
            self.record_test_result("display_migration_status", True, "Status display completed")
            
            # Test schema info display
            schema_info = await self.migration_manager.get_database_schema_version()
            self.migration_manager.display_schema_info(schema_info)
            self.record_test_result("display_schema_info", True, "Schema info displayed")
            
            # Test SQL display (if SQL is available)
            success, sql = self.migration_manager.get_migration_sql()
            if success and sql:
                # Show only first 200 characters
                preview_sql = sql[:200] + "..." if len(sql) > 200 else sql
                self.migration_manager.display_migration_sql(preview_sql)
                self.record_test_result("display_migration_sql", True, f"SQL displayed ({len(sql)} chars)")
            else:
                self.record_test_result("display_migration_sql", True, "No SQL to display")
            
        except Exception as e:
            self.record_test_result("display_features", False, f"Error: {e}")
    
    def display_test_results(self):
        """Display comprehensive test results"""
        console.print(f"\n[bold cyan]🎯 FOCUSED MIGRATION TESTING RESULTS[/bold cyan]")
        console.print("=" * 70)
        
        # Summary statistics
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        summary_content = f"""
[bold blue]Total Tests:[/bold blue] {total_tests}
[bold green]Passed:[/bold green] {passed_tests}
[bold red]Failed:[/bold red] {failed_tests}
[bold yellow]Pass Rate:[/bold yellow] {pass_rate:.1f}%
        """
        
        summary_panel = Panel(
            summary_content.strip(),
            title="📊 Test Summary",
            border_style="blue",
            padding=(1, 2)
        )
        console.print(summary_panel)
        
        # Detailed results table
        results_table = Table(title="🔍 Test Results", show_header=True, header_style="bold magenta")
        results_table.add_column("Test Name", style="bold blue", width=35)
        results_table.add_column("Status", justify="center", width=8)
        results_table.add_column("Message", style="white")
        
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result["success"] else "❌"
            status_color = "green" if result["success"] else "red"
            
            results_table.add_row(
                test_name.replace("_", " ").title(),
                f"[{status_color}]{status_icon}[/{status_color}]",
                result["message"]
            )
        
        console.print(results_table)
        
        # Overall assessment
        if pass_rate == 100:
            console.print("\n[bold green]🎉 ALL TESTS PASSED! MIGRATION SYSTEM IS FUNCTIONAL![/bold green]")
            console.print("  ✅ Database setup is correct")
            console.print("  ✅ Core migration features work")
            console.print("  ✅ Alembic commands execute properly")
            console.print("  ✅ Migration files are accessible")
            console.print("  ✅ Display features function correctly")
        elif pass_rate >= 80:
            console.print("\n[bold yellow]⚠️ MOSTLY FUNCTIONAL - Some Minor Issues[/bold yellow]")
            console.print("  • Core functionality is working")
            console.print("  • Address failed tests for full functionality")
        else:
            console.print("\n[bold red]❌ SIGNIFICANT ISSUES FOUND[/bold red]")
            console.print("  • Review failed tests")
            console.print("  • Check database connectivity")
            console.print("  • Verify Alembic configuration")
        
        return pass_rate == 100

async def main():
    """Run focused migration management tests"""
    console.print("[bold cyan]🏠 FOCUSED MIGRATION MANAGEMENT TESTING[/bold cyan]")
    console.print("=" * 70)
    
    test_suite = FocusedMigrationTestSuite()
    
    try:
        # Setup
        await test_suite.setup()
        
        # Run focused tests
        await test_suite.test_database_setup()
        await test_suite.test_core_migration_features()
        test_suite.test_alembic_commands()
        test_suite.test_migration_files()
        test_suite.test_migration_templates()
        await test_suite.test_migration_display_features()
        
        # Display results
        success = test_suite.display_test_results()
        return success
        
    except Exception as e:
        console.print(f"[red]❌ Test suite setup failed: {e}[/red]")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)