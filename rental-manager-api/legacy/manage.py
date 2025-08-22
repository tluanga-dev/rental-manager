#!/usr/bin/env python3
"""
Management CLI for Rental Manager Backend
Provides comprehensive management commands including migrations
"""

import click
import asyncio
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from scripts.manage_migrations import MigrationManager


@click.group()
def cli():
    """Rental Manager Backend Management CLI"""
    pass


# Migration Commands Group
@cli.group()
def migrate():
    """Database migration management"""
    pass


@migrate.command()
@click.option('--json', is_flag=True, help='Output as JSON')
def status():
    """Check migration status"""
    async def run():
        manager = MigrationManager()
        status_info = await manager.check_migration_status()
        
        if click.get_current_context().params['json']:
            import json
            click.echo(json.dumps(status_info, indent=2))
        else:
            click.echo("\n" + "="*50)
            click.echo("Migration Status")
            click.echo("="*50)
            click.echo(f"Database Connected: {status_info['database_connected']}")
            click.echo(f"Migration Table: {status_info['migration_table_exists']}")
            click.echo(f"Current Revision: {status_info['current_revision'] or 'None'}")
            click.echo(f"Head Revision: {status_info['head_revision'] or 'None'}")
            click.echo(f"Up to Date: {status_info['is_up_to_date']}")
            
            if status_info['pending_migrations']:
                click.echo(f"\nPending Migrations ({len(status_info['pending_migrations'])}):")
                for migration in status_info['pending_migrations']:
                    click.echo(f"  - {migration}")
            
            if status_info['migration_files']:
                click.echo(f"\nMigration Files ({len(status_info['migration_files'])}):")
                for file in status_info['migration_files'][:5]:
                    click.echo(f"  - {file}")
                if len(status_info['migration_files']) > 5:
                    click.echo(f"  ... and {len(status_info['migration_files']) - 5} more")
    
    asyncio.run(run())


@migrate.command()
@click.argument('message')
@click.option('--auto/--manual', default=True, help='Auto-generate from models (default: auto)')
@click.option('--apply', is_flag=True, help='Apply migration immediately')
def generate(message, auto, apply):
    """Generate a new migration"""
    manager = MigrationManager()
    
    click.echo(f"Generating migration: {message}")
    success, filename = manager.generate_migration(message, auto)
    
    if success:
        click.secho(f"✓ Migration generated: {filename}", fg='green')
        
        if apply:
            click.echo("Applying migration...")
            if manager.apply_migrations():
                click.secho("✓ Migration applied successfully", fg='green')
            else:
                click.secho("✗ Failed to apply migration", fg='red')
                sys.exit(1)
    else:
        click.secho("✗ Failed to generate migration", fg='red')
        sys.exit(1)


@migrate.command()
@click.option('--target', default='head', help='Target revision (default: head)')
@click.option('--dry-run', is_flag=True, help='Show SQL without applying')
@click.option('--no-backup', is_flag=True, help='Skip backup creation')
def upgrade(target, dry_run, no_backup):
    """Apply pending migrations"""
    manager = MigrationManager()
    
    if not no_backup and not dry_run:
        click.echo("Creating backup...")
        backup_file = manager.backup_database()
        if backup_file:
            click.secho(f"✓ Backup created: {backup_file}", fg='green')
        else:
            if not click.confirm("Backup failed. Continue anyway?"):
                sys.exit(1)
    
    click.echo(f"{'[DRY RUN] ' if dry_run else ''}Applying migrations to {target}...")
    
    if manager.apply_migrations(target, dry_run):
        click.secho("✓ Migrations applied successfully", fg='green')
    else:
        click.secho("✗ Failed to apply migrations", fg='red')
        sys.exit(1)


@migrate.command()
@click.option('--steps', default=1, type=int, help='Number of steps to rollback')
@click.option('--no-backup', is_flag=True, help='Skip backup creation')
def downgrade(steps, no_backup):
    """Rollback migrations"""
    if not click.confirm(f"This will rollback {steps} migration(s). Are you sure?"):
        return
    
    manager = MigrationManager()
    
    if not no_backup:
        click.echo("Creating backup...")
        backup_file = manager.backup_database()
        if backup_file:
            click.secho(f"✓ Backup created: {backup_file}", fg='green')
    
    click.echo(f"Rolling back {steps} migration(s)...")
    
    if manager.rollback_migration(steps):
        click.secho(f"✓ Rolled back {steps} migration(s)", fg='green')
    else:
        click.secho("✗ Rollback failed", fg='red')
        sys.exit(1)


@migrate.command()
def history():
    """Show migration history"""
    manager = MigrationManager()
    migrations = manager.list_migrations()
    
    if not migrations:
        click.echo("No migrations found")
        return
    
    click.echo("\n" + "="*70)
    click.echo("Migration History")
    click.echo("="*70)
    
    for migration in migrations:
        click.echo(f"\n{migration['revision']}")
        if migration['file']:
            click.echo(f"  File: {migration['file']}")
        if migration['description']:
            click.echo(f"  Description: {migration['description']}")


@migrate.command()
@click.option('--revision', help='Specific revision to validate')
def validate(revision):
    """Validate migration files"""
    manager = MigrationManager()
    
    click.echo("Validating migrations...")
    
    if manager.validate_migration(revision):
        click.secho("✓ All migrations are valid", fg='green')
    else:
        click.secho("✗ Validation failed", fg='red')
        sys.exit(1)


@migrate.command()
def repair():
    """Repair migration state if corrupted"""
    async def run():
        manager = MigrationManager()
        
        click.echo("Checking migration state...")
        
        if await manager.repair_migration_state():
            click.secho("✓ Migration state repaired", fg='green')
        else:
            click.secho("✗ Repair failed", fg='red')
            sys.exit(1)
    
    asyncio.run(run())


# Database Commands Group
@cli.group()
def db():
    """Database management commands"""
    pass


@db.command()
def backup():
    """Create database backup"""
    manager = MigrationManager()
    
    click.echo("Creating database backup...")
    backup_file = manager.backup_database()
    
    if backup_file:
        click.secho(f"✓ Backup created: {backup_file}", fg='green')
    else:
        click.secho("✗ Backup failed", fg='red')
        sys.exit(1)


@db.command()
@click.argument('backup_file', type=click.Path(exists=True))
def restore(backup_file):
    """Restore database from backup"""
    if not click.confirm(f"This will restore from {backup_file}. All current data will be lost. Continue?"):
        return
    
    manager = MigrationManager()
    
    click.echo(f"Restoring from {backup_file}...")
    
    if manager.restore_backup(backup_file):
        click.secho("✓ Database restored successfully", fg='green')
    else:
        click.secho("✗ Restore failed", fg='red')
        sys.exit(1)


@db.command()
def reset():
    """Reset database (WARNING: Destructive!)"""
    click.secho("WARNING: This will DELETE ALL DATA!", fg='red', bold=True)
    
    confirm = click.prompt("Type 'RESET' to confirm", type=str)
    if confirm != 'RESET':
        click.echo("Cancelled")
        return
    
    # Create backup first
    manager = MigrationManager()
    click.echo("Creating backup before reset...")
    backup_file = manager.backup_database()
    if backup_file:
        click.secho(f"✓ Backup created: {backup_file}", fg='green')
    
    # Reset database
    click.echo("Resetting database...")
    
    try:
        # Downgrade to base
        subprocess.run(["alembic", "downgrade", "base"], check=True)
        
        # Upgrade to head
        subprocess.run(["alembic", "upgrade", "head"], check=True)
        
        # Initialize basic data
        subprocess.run(["python", "scripts/create_admin.py"], check=False)
        subprocess.run(["python", "scripts/seed_rbac.py"], check=False)
        subprocess.run(["python", "scripts/init_system_settings.py"], check=False)
        
        click.secho("✓ Database reset successfully", fg='green')
    except subprocess.CalledProcessError as e:
        click.secho(f"✗ Reset failed: {e}", fg='red')
        sys.exit(1)


# Admin Commands Group
@cli.group()
def admin():
    """Admin user management"""
    pass


@admin.command()
@click.option('--username', default='admin', help='Admin username')
@click.option('--email', default='admin@admin.com', help='Admin email')
@click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True, help='Admin password')
def create():
    """Create admin user"""
    os.environ['ADMIN_USERNAME'] = username
    os.environ['ADMIN_EMAIL'] = email
    os.environ['ADMIN_PASSWORD'] = password
    
    try:
        subprocess.run(["python", "scripts/create_admin.py"], check=True)
        click.secho("✓ Admin user created successfully", fg='green')
    except subprocess.CalledProcessError:
        click.secho("✗ Failed to create admin user", fg='red')
        sys.exit(1)


@admin.command()
@click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True, help='New password')
def reset_password(password):
    """Reset admin password"""
    os.environ['ADMIN_PASSWORD'] = password
    
    try:
        subprocess.run(["python", "scripts/update_admin_password.py"], check=True)
        click.secho("✓ Admin password updated", fg='green')
    except subprocess.CalledProcessError:
        click.secho("✗ Failed to update password", fg='red')
        sys.exit(1)


# Development Commands Group
@cli.group()
def dev():
    """Development utilities"""
    pass


@dev.command()
def seed():
    """Seed development data"""
    click.echo("Seeding development data...")
    
    scripts = [
        ("Creating admin user", "scripts/create_admin.py"),
        ("Seeding RBAC", "scripts/seed_rbac.py"),
        ("Initializing system settings", "scripts/init_system_settings.py"),
        ("Seeding master data", "scripts/seed_all_data.py")
    ]
    
    for description, script in scripts:
        click.echo(f"{description}...")
        try:
            subprocess.run(["python", script], check=False, capture_output=True)
            click.secho(f"  ✓ {description} complete", fg='green')
        except Exception as e:
            click.secho(f"  ✗ {description} failed: {e}", fg='yellow')


@dev.command()
def clear():
    """Clear all non-auth data"""
    if not click.confirm("This will clear all transaction and inventory data. Continue?"):
        return
    
    try:
        subprocess.run(["python", "scripts/clear_all_data_except_auth.py"], check=True)
        click.secho("✓ Data cleared successfully", fg='green')
    except subprocess.CalledProcessError:
        click.secho("✗ Failed to clear data", fg='red')
        sys.exit(1)


@dev.command()
@click.option('--host', default='0.0.0.0', help='Host to bind')
@click.option('--port', default=8000, type=int, help='Port to bind')
@click.option('--reload/--no-reload', default=True, help='Enable hot reload')
def run(host, port, reload):
    """Run development server"""
    cmd = [
        "uvicorn", "app.main:app",
        "--host", host,
        "--port", str(port)
    ]
    
    if reload:
        cmd.extend(["--reload", "--reload-dir", "app"])
    
    click.echo(f"Starting development server on {host}:{port}")
    subprocess.run(cmd)


# Test Commands Group
@cli.group()
def test():
    """Run tests"""
    pass


@test.command()
@click.option('--coverage', is_flag=True, help='Generate coverage report')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
def all(coverage, verbose):
    """Run all tests"""
    cmd = ["pytest"]
    
    if coverage:
        cmd.extend(["--cov=app", "--cov-report=html"])
    
    if verbose:
        cmd.append("-v")
    
    subprocess.run(cmd)


@test.command()
@click.argument('marker')
def marker(marker):
    """Run tests with specific marker"""
    subprocess.run(["pytest", "-m", marker])


# Utility Commands
@cli.command()
def version():
    """Show version information"""
    click.echo("Rental Manager Backend")
    click.echo("Version: 1.0.0")
    
    # Show Python version
    import sys
    click.echo(f"Python: {sys.version}")
    
    # Show Alembic version
    try:
        result = subprocess.run(["alembic", "--version"], capture_output=True, text=True)
        click.echo(f"Alembic: {result.stdout.strip()}")
    except:
        pass


@cli.command()
def health():
    """Check system health"""
    async def check_health():
        from sqlalchemy.ext.asyncio import create_async_engine
        from app.core.config import settings
        
        health_status = {
            "database": False,
            "redis": False,
            "migrations": False
        }
        
        # Check database
        try:
            engine = create_async_engine(settings.DATABASE_URL)
            async with engine.connect() as conn:
                await conn.execute("SELECT 1")
            await engine.dispose()
            health_status["database"] = True
        except:
            pass
        
        # Check Redis (if configured)
        try:
            import redis
            r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
            r.ping()
            health_status["redis"] = True
        except:
            pass
        
        # Check migrations
        manager = MigrationManager()
        migration_status = await manager.check_migration_status()
        health_status["migrations"] = migration_status.get("is_up_to_date", False)
        
        # Display results
        click.echo("\n" + "="*40)
        click.echo("System Health Check")
        click.echo("="*40)
        
        for component, status in health_status.items():
            symbol = "✓" if status else "✗"
            color = "green" if status else "red"
            click.secho(f"{symbol} {component.capitalize()}: {'OK' if status else 'FAILED'}", fg=color)
        
        # Overall status
        all_healthy = all(health_status.values())
        click.echo("\n" + "="*40)
        if all_healthy:
            click.secho("System Status: HEALTHY", fg='green', bold=True)
        else:
            click.secho("System Status: DEGRADED", fg='yellow', bold=True)
        
        return all_healthy
    
    is_healthy = asyncio.run(check_health())
    sys.exit(0 if is_healthy else 1)


if __name__ == '__main__':
    cli()