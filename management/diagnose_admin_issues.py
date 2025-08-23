#!/usr/bin/env python3
"""
Admin Management Diagnostic Script

Comprehensive diagnostic tool for troubleshooting admin creation and management issues.
This script checks all prerequisites, configurations, and potential problems.
"""

import asyncio
import sys
import os
import subprocess
import traceback
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

class AdminDiagnostics:
    """Comprehensive diagnostics for admin management"""
    
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.info = []
        self.config = None
    
    def add_issue(self, category: str, message: str, severity: str = "error"):
        """Add a diagnostic issue"""
        entry = {
            'category': category,
            'message': message,
            'severity': severity
        }
        
        if severity == "error":
            self.issues.append(entry)
        elif severity == "warning":
            self.warnings.append(entry)
        else:
            self.info.append(entry)
    
    def add_info(self, category: str, message: str, severity: str = "info"):
        """Add diagnostic info (alias for add_issue)"""
        self.add_issue(category, message, severity)
    
    def show_banner(self):
        """Display diagnostic banner"""
        banner = Panel.fit(
            "[bold blue]🔍 Admin Management Diagnostics[/bold blue]\n"
            "[dim]Comprehensive system analysis and troubleshooting[/dim]",
            border_style="blue",
            padding=(1, 2)
        )
        console.print(banner)
    
    async def check_environment(self):
        """Check system environment and prerequisites"""
        console.print("\n[bold blue]🌍 Environment Check[/bold blue]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            # Check Python version
            task1 = progress.add_task("Checking Python version...", total=None)
            try:
                python_version = sys.version_info
                if python_version >= (3, 9):
                    progress.update(task1, description="[green]✓ Python version OK[/green]")
                    self.add_info("Environment", f"Python {python_version.major}.{python_version.minor}.{python_version.micro}", "info")
                else:
                    progress.update(task1, description="[red]✗ Python version too old[/red]")
                    self.add_issue("Environment", f"Python {python_version.major}.{python_version.minor} < 3.9 required")
            except Exception as e:
                progress.update(task1, description="[red]✗ Python version check failed[/red]")
                self.add_issue("Environment", f"Python version check failed: {e}")
            
            # Check Docker services
            task2 = progress.add_task("Checking Docker services...", total=None)
            try:
                result = subprocess.run(
                    ["docker", "ps", "--filter", "name=postgres", "--format", "{{.Names}}"],
                    capture_output=True, text=True, timeout=10
                )
                if "postgres" in result.stdout:
                    progress.update(task2, description="[green]✓ PostgreSQL Docker running[/green]")
                    self.add_info("Environment", "PostgreSQL Docker container running", "info")
                else:
                    progress.update(task2, description="[red]✗ PostgreSQL Docker not running[/red]")
                    self.add_issue("Environment", "PostgreSQL Docker container not running")
            except FileNotFoundError:
                progress.update(task2, description="[red]✗ Docker not found[/red]")
                self.add_issue("Environment", "Docker not installed or not in PATH")
            except subprocess.TimeoutExpired:
                progress.update(task2, description="[red]✗ Docker check timeout[/red]")
                self.add_issue("Environment", "Docker command timed out")
            except Exception as e:
                progress.update(task2, description="[red]✗ Docker check failed[/red]")
                self.add_issue("Environment", f"Docker check failed: {e}")
            
            # Check directory structure
            task3 = progress.add_task("Checking directory structure...", total=None)
            try:
                required_dirs = [
                    Path("../rental-manager-api"),
                    Path("../rental-manager-api/app"),
                    Path("../rental-manager-api/app/models"),
                    Path("modules"),
                    Path("data"),
                ]
                
                missing_dirs = [d for d in required_dirs if not d.exists()]
                if not missing_dirs:
                    progress.update(task3, description="[green]✓ Directory structure OK[/green]")
                    self.add_info("Environment", "All required directories present", "info")
                else:
                    progress.update(task3, description="[red]✗ Missing directories[/red]")
                    for d in missing_dirs:
                        self.add_issue("Environment", f"Missing directory: {d}")
                        
            except Exception as e:
                progress.update(task3, description="[red]✗ Directory check failed[/red]")
                self.add_issue("Environment", f"Directory structure check failed: {e}")
    
    async def check_dependencies(self):
        """Check Python dependencies"""
        console.print("\n[bold blue]📦 Dependencies Check[/bold blue]")
        
        required_packages = [
            ("rich", "Rich console library"),
            ("sqlalchemy", "SQLAlchemy ORM"),
            ("asyncpg", "Async PostgreSQL driver"),
            ("passlib", "Password hashing"),
            ("bcrypt", "Bcrypt hashing"),
            ("typer", "CLI framework"),
        ]
        
        for package, description in required_packages:
            try:
                __import__(package)
                console.print(f"[green]✓ {package}[/green] - {description}")
                self.add_info("Dependencies", f"{package} available", "info")
            except ImportError:
                console.print(f"[red]✗ {package}[/red] - {description}")
                self.add_issue("Dependencies", f"Missing package: {package}")
    
    async def check_configuration(self):
        """Check configuration and settings"""
        console.print("\n[bold blue]⚙️ Configuration Check[/bold blue]")
        
        try:
            from config import config
            self.config = config
            
            # Test configuration validation
            valid_config, issues = config.validate_environment()
            
            if valid_config:
                console.print("[green]✓ Configuration validation passed[/green]")
                self.add_info("Configuration", "All configuration valid", "info")
            else:
                console.print("[red]✗ Configuration validation failed[/red]")
                for issue in issues:
                    console.print(f"[red]  • {issue}[/red]")
                    self.add_issue("Configuration", issue)
            
            # Check specific config values
            config_checks = [
                ("Admin username", config.admin.ADMIN_USERNAME, lambda x: len(x) >= 3),
                ("Admin email", config.admin.ADMIN_EMAIL, lambda x: "@" in x and "." in x),
                ("Admin password", "***", lambda x: len(config.admin.ADMIN_PASSWORD) >= 8),
                ("Database URL", config.db.DATABASE_URL, lambda x: x.startswith("postgresql")),
            ]
            
            for name, value, check in config_checks:
                if check(value):
                    console.print(f"[green]✓ {name}: {value}[/green]")
                    self.add_info("Configuration", f"{name} OK", "info")
                else:
                    console.print(f"[red]✗ {name}: Invalid[/red]")
                    self.add_issue("Configuration", f"Invalid {name}")
                    
        except Exception as e:
            console.print(f"[red]✗ Configuration check failed: {e}[/red]")
            self.add_issue("Configuration", f"Configuration loading failed: {e}")
    
    async def check_database_connection(self):
        """Check database connectivity and schema"""
        console.print("\n[bold blue]🗄️ Database Check[/bold blue]")
        
        if not self.config:
            console.print("[red]✗ Cannot check database - config not loaded[/red]")
            self.add_issue("Database", "Configuration not available for database check")
            return
        
        try:
            # Test basic connection
            success, message = await self.config.test_database_connection()
            if success:
                console.print(f"[green]✓ Database connection: {message}[/green]")
                self.add_info("Database", message, "info")
            else:
                console.print(f"[red]✗ Database connection: {message}[/red]")
                self.add_issue("Database", f"Connection failed: {message}")
                return
            
            # Test table existence
            async for session in self.config.get_session():
                from sqlalchemy import text
                
                # Check if users table exists
                result = await session.execute(text(
                    "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
                ))
                users_table = result.fetchone()
                
                if users_table:
                    console.print("[green]✓ Users table exists[/green]")
                    self.add_info("Database", "Users table exists", "info")
                else:
                    console.print("[red]✗ Users table missing[/red]")
                    self.add_issue("Database", "Users table does not exist - run migrations")
                
                # Check admin user exists
                try:
                    from app.models.user import User, UserRole
                    from sqlalchemy import select
                    
                    stmt = select(User).where(User.role == UserRole.ADMIN.value).limit(1)
                    result = await session.execute(stmt)
                    admin_user = result.scalar_one_or_none()
                    
                    if admin_user:
                        console.print(f"[green]✓ Admin user exists: {admin_user.username}[/green]")
                        self.add_info("Database", f"Admin user {admin_user.username} exists", "info")
                    else:
                        console.print("[yellow]⚠ No admin user found[/yellow]")
                        self.add_issue("Database", "No admin user exists", "warning")
                        
                except Exception as e:
                    console.print(f"[red]✗ Admin user check failed: {e}[/red]")
                    self.add_issue("Database", f"Admin user check failed: {e}")
                
                break
                
        except Exception as e:
            console.print(f"[red]✗ Database check failed: {e}[/red]")
            self.add_issue("Database", f"Database check failed: {e}")
    
    async def check_model_imports(self):
        """Check model imports and SQLAlchemy configuration"""
        console.print("\n[bold blue]🏗️ Model Imports Check[/bold blue]")
        
        critical_imports = [
            ("app.models.base", "Base"),
            ("app.models.user", "User, UserRole"),
            ("app.core.security", "SecurityManager"),
            ("app.models.transaction", "TransactionHeader, TransactionLine"),
        ]
        
        for module, components in critical_imports:
            try:
                __import__(module)
                console.print(f"[green]✓ {module}[/green] - {components}")
                self.add_info("Models", f"{module} imports OK", "info")
            except Exception as e:
                console.print(f"[red]✗ {module}[/red] - {e}")
                self.add_issue("Models", f"Import failed: {module} - {e}")
        
        # Test mapper configuration
        try:
            from sqlalchemy.orm import configure_mappers
            configure_mappers()
            console.print("[green]✓ SQLAlchemy mappers configured[/green]")
            self.add_info("Models", "SQLAlchemy mappers OK", "info")
        except Exception as e:
            console.print(f"[red]✗ Mapper configuration failed: {e}[/red]")
            self.add_issue("Models", f"Mapper configuration failed: {e}")
    
    async def test_admin_operations(self):
        """Test actual admin operations"""
        console.print("\n[bold blue]👤 Admin Operations Test[/bold blue]")
        
        if not self.config:
            console.print("[red]✗ Cannot test admin operations - config not loaded[/red]")
            self.add_issue("Admin Operations", "Configuration not available")
            return
        
        try:
            async for session in self.config.get_session():
                from modules.admin_manager import AdminManager
                admin_manager = AdminManager(session, self.config.admin)
                
                # Test admin creation/update
                success, message, user = await admin_manager.create_admin_user(force=True)
                if success and user:
                    console.print(f"[green]✓ Admin creation: {message}[/green]")
                    self.add_info("Admin Operations", "Admin creation successful", "info")
                    
                    # Test credential validation
                    val_success, val_message, val_user = await admin_manager.validate_admin_credentials(
                        self.config.admin.ADMIN_USERNAME,
                        self.config.admin.ADMIN_PASSWORD
                    )
                    
                    if val_success and val_user:
                        console.print("[green]✓ Credential validation successful[/green]")
                        self.add_info("Admin Operations", "Credential validation OK", "info")
                    else:
                        console.print(f"[red]✗ Credential validation failed: {val_message}[/red]")
                        self.add_issue("Admin Operations", f"Credential validation failed: {val_message}")
                        
                else:
                    console.print(f"[red]✗ Admin creation failed: {message}[/red]")
                    self.add_issue("Admin Operations", f"Admin creation failed: {message}")
                
                break
                
        except Exception as e:
            console.print(f"[red]✗ Admin operations test failed: {e}[/red]")
            self.add_issue("Admin Operations", f"Operations test failed: {e}")
    
    def display_summary(self):
        """Display comprehensive diagnostic summary"""
        console.print("\n" + "="*80)
        console.print("[bold cyan]📋 DIAGNOSTIC SUMMARY[/bold cyan]")
        console.print("="*80)
        
        # Status overview
        total_issues = len(self.issues)
        total_warnings = len(self.warnings)
        total_info = len(self.info)
        
        status_table = Table(title="System Status", show_header=True, header_style="bold magenta")
        status_table.add_column("Category", style="blue", width=15)
        status_table.add_column("Count", justify="center", width=8)
        status_table.add_column("Status", justify="center", width=12)
        
        status_table.add_row("Errors", str(total_issues), "🔴 Critical" if total_issues > 0 else "🟢 Good")
        status_table.add_row("Warnings", str(total_warnings), "🟡 Caution" if total_warnings > 0 else "🟢 Good")
        status_table.add_row("Info", str(total_info), "📋 Details")
        
        console.print(status_table)
        
        # Detailed issues
        if self.issues:
            console.print("\n[bold red]🔴 CRITICAL ISSUES[/bold red]")
            issues_table = Table(show_header=True, header_style="bold red")
            issues_table.add_column("Category", style="red", width=20)
            issues_table.add_column("Issue", style="white", width=50)
            
            for issue in self.issues:
                issues_table.add_row(issue['category'], issue['message'])
            
            console.print(issues_table)
        
        if self.warnings:
            console.print("\n[bold yellow]🟡 WARNINGS[/bold yellow]")
            warnings_table = Table(show_header=True, header_style="bold yellow")
            warnings_table.add_column("Category", style="yellow", width=20)
            warnings_table.add_column("Warning", style="white", width=50)
            
            for warning in self.warnings:
                warnings_table.add_row(warning['category'], warning['message'])
            
            console.print(warnings_table)
        
        # Recommendations
        console.print("\n[bold blue]💡 RECOMMENDATIONS[/bold blue]")
        
        if total_issues == 0 and total_warnings == 0:
            console.print("[green]✅ System is healthy! Admin management should work perfectly.[/green]")
            recommendations = [
                "Regular testing with test_admin_comprehensive.py",
                "Monitor logs for any unusual activity",
                "Keep database backups current"
            ]
        else:
            recommendations = []
            
            if any("Docker" in issue['message'] for issue in self.issues):
                recommendations.append("Start PostgreSQL: docker-compose up -d postgres")
            
            if any("Migration" in issue['message'] or "table" in issue['message'] for issue in self.issues):
                recommendations.append("Run database migrations: make migrate")
            
            if any("package" in issue['message'] or "import" in issue['message'] for issue in self.issues):
                recommendations.append("Install dependencies: pip install -r requirements.txt")
            
            if any("Configuration" in issue['category'] for issue in self.issues):
                recommendations.append("Check environment variables in .env file")
            
            if not recommendations:
                recommendations.append("Review detailed error messages above")
                recommendations.append("Check logs in management.log")
                recommendations.append("Run individual test scripts for more details")
        
        for i, rec in enumerate(recommendations, 1):
            console.print(f"[blue]{i}.[/blue] {rec}")
        
        # Overall assessment
        if total_issues == 0:
            if total_warnings == 0:
                console.print("\n[bold green]🎉 SYSTEM STATUS: EXCELLENT[/bold green]")
                console.print("[green]All admin management functionality should work perfectly![/green]")
            else:
                console.print("\n[bold yellow]⚠️ SYSTEM STATUS: GOOD WITH WARNINGS[/bold yellow]")
                console.print("[yellow]Admin management should work but address warnings when possible.[/yellow]")
        else:
            console.print(f"\n[bold red]🚨 SYSTEM STATUS: NEEDS ATTENTION[/bold red]")
            console.print(f"[red]{total_issues} critical issue(s) must be resolved before admin management will work properly.[/red]")
        
        return total_issues == 0

async def main():
    """Run comprehensive diagnostics"""
    diagnostics = AdminDiagnostics()
    diagnostics.show_banner()
    
    # Run all diagnostic checks
    checks = [
        ("Environment", diagnostics.check_environment),
        ("Dependencies", diagnostics.check_dependencies),
        ("Configuration", diagnostics.check_configuration),
        ("Database", diagnostics.check_database_connection),
        ("Models", diagnostics.check_model_imports),
        ("Admin Operations", diagnostics.test_admin_operations),
    ]
    
    for check_name, check_func in checks:
        try:
            await check_func()
        except Exception as e:
            console.print(f"[red]✗ {check_name} check crashed: {e}[/red]")
            diagnostics.add_issue(check_name, f"Check crashed: {e}")
    
    # Display comprehensive summary
    return diagnostics.display_summary()

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠ Diagnostics interrupted by user[/yellow]")
        exit(1)
    except Exception as e:
        console.print(f"\n[red]❌ Diagnostics failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        exit(1)