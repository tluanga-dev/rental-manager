"""
Migration Manager Module

Handles Alembic database migrations for the rental management system.
Provides migration status, apply/rollback operations, and migration generation.
"""

import subprocess
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.syntax import Syntax

logger = logging.getLogger(__name__)
console = Console()


class MigrationManager:
    """Manages Alembic database migrations"""
    
    def __init__(self, session: AsyncSession, rental_api_dir: Path):
        self.session = session
        self.rental_api_dir = rental_api_dir
        self.alembic_dir = rental_api_dir / "alembic"
        self.versions_dir = self.alembic_dir / "versions"
        self.alembic_ini = rental_api_dir / "alembic.ini"
    
    def _run_alembic_command(self, command: List[str], capture_output: bool = True) -> Tuple[bool, str, str]:
        """Run an Alembic command and return results"""
        try:
            # Change to rental API directory
            original_cwd = Path.cwd()
            
            # Construct full command
            full_command = ["alembic"] + command
            
            result = subprocess.run(
                full_command,
                cwd=self.rental_api_dir,
                capture_output=capture_output,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            success = result.returncode == 0
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            
            return success, stdout, stderr
            
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out after 5 minutes"
        except Exception as e:
            return False, "", f"Error running Alembic command: {str(e)}"
    
    async def get_current_revision(self) -> Optional[str]:
        """Get current database revision"""
        try:
            query = text("SELECT version_num FROM alembic_version")
            result = await self.session.execute(query)
            row = result.fetchone()
            return row[0] if row else None
        except Exception as e:
            logger.error(f"Error getting current revision: {e}")
            return None
    
    def get_migration_history(self) -> List[Dict[str, Any]]:
        """Get migration history from Alembic"""
        success, stdout, stderr = self._run_alembic_command(["history", "--verbose"])
        
        if not success:
            console.print(f"[red]Error getting migration history: {stderr}[/red]")
            return []
        
        # Parse Alembic history output
        migrations = []
        current_migration = {}
        
        for line in stdout.split('\n'):
            line = line.strip()
            if not line:
                if current_migration:
                    migrations.append(current_migration)
                    current_migration = {}
                continue
            
            # Parse revision line (e.g., "Rev: abc123def456 (head)")
            if line.startswith("Rev:"):
                rev_match = re.match(r"Rev:\s*([a-f0-9]+)(?:\s*\(([^)]+)\))?", line)
                if rev_match:
                    current_migration['revision'] = rev_match.group(1)
                    current_migration['status'] = rev_match.group(2) or ""
            
            # Parse parent line
            elif line.startswith("Parent:"):
                parent_match = re.match(r"Parent:\s*([a-f0-9]+|<base>)", line)
                if parent_match:
                    current_migration['parent'] = parent_match.group(1)
            
            # Parse branch line
            elif line.startswith("Branch:"):
                current_migration['branch'] = line.replace("Branch:", "").strip()
            
            # Parse description (first non-metadata line)
            elif not any(line.startswith(prefix) for prefix in ["Rev:", "Parent:", "Branch:", "Path:"]):
                if 'description' not in current_migration and line:
                    current_migration['description'] = line
        
        # Add last migration if exists
        if current_migration:
            migrations.append(current_migration)
        
        return migrations
    
    def get_pending_migrations(self) -> List[str]:
        """Get list of pending migrations"""
        success, stdout, stderr = self._run_alembic_command(["show", "head"])
        
        if not success:
            return []
        
        # This is a simplified approach - in practice, you'd compare current vs head
        pending = []
        
        # Get current revision
        current_cmd_success, current_stdout, _ = self._run_alembic_command(["current"])
        if current_cmd_success and "head" not in current_stdout.lower():
            # If current is not at head, there are pending migrations
            history = self.get_migration_history()
            for migration in history:
                if "head" in migration.get('status', ''):
                    pending.append(migration['revision'])
                    break
        
        return pending
    
    def apply_migrations(self, target_revision: str = "head") -> Tuple[bool, str]:
        """Apply migrations to target revision"""
        console.print(f"[yellow]Applying migrations to {target_revision}...[/yellow]")
        
        success, stdout, stderr = self._run_alembic_command(["upgrade", target_revision])
        
        if success:
            message = f"Successfully applied migrations to {target_revision}"
            console.print(f"[green]✓ {message}[/green]")
            return True, message
        else:
            error_msg = f"Failed to apply migrations: {stderr}"
            console.print(f"[red]✗ {error_msg}[/red]")
            return False, error_msg
    
    def rollback_migration(self, target_revision: str = "-1") -> Tuple[bool, str]:
        """Rollback to target revision"""
        console.print(f"[yellow]Rolling back to {target_revision}...[/yellow]")
        
        success, stdout, stderr = self._run_alembic_command(["downgrade", target_revision])
        
        if success:
            message = f"Successfully rolled back to {target_revision}"
            console.print(f"[green]✓ {message}[/green]")
            return True, message
        else:
            error_msg = f"Failed to rollback migration: {stderr}"
            console.print(f"[red]✗ {error_msg}[/red]")
            return False, error_msg
    
    def generate_migration(self, message: str, autogenerate: bool = True) -> Tuple[bool, str, Optional[str]]:
        """Generate a new migration"""
        console.print(f"[yellow]Generating migration: {message}...[/yellow]")
        
        command = ["revision"]
        if autogenerate:
            command.append("--autogenerate")
        command.extend(["-m", message])
        
        success, stdout, stderr = self._run_alembic_command(command)
        
        if success:
            # Extract migration file path from output
            migration_file = None
            for line in stdout.split('\n'):
                if "Generating" in line and ".py" in line:
                    # Extract file path
                    path_match = re.search(r'([^/\s]+\.py)', line)
                    if path_match:
                        migration_file = path_match.group(1)
                        break
            
            success_msg = f"Successfully generated migration: {message}"
            console.print(f"[green]✓ {success_msg}[/green]")
            return True, success_msg, migration_file
        else:
            error_msg = f"Failed to generate migration: {stderr}"
            console.print(f"[red]✗ {error_msg}[/red]")
            return False, error_msg, None
    
    def get_migration_sql(self, from_revision: Optional[str] = None, to_revision: str = "head") -> Tuple[bool, str]:
        """Get SQL for migrations without applying them"""
        command = ["upgrade"]
        if from_revision:
            command.append(f"{from_revision}:{to_revision}")
        else:
            command.append(to_revision)
        command.append("--sql")
        
        success, stdout, stderr = self._run_alembic_command(command)
        
        if success:
            return True, stdout
        else:
            return False, f"Error getting migration SQL: {stderr}"
    
    def validate_migration_integrity(self) -> Tuple[bool, List[str]]:
        """Validate migration integrity"""
        issues = []
        
        # Check if alembic directory exists
        if not self.alembic_dir.exists():
            issues.append("Alembic directory not found")
            return False, issues
        
        # Check if versions directory exists
        if not self.versions_dir.exists():
            issues.append("Versions directory not found")
            return False, issues
        
        # Check if alembic.ini exists
        if not self.alembic_ini.exists():
            issues.append("alembic.ini not found")
            return False, issues
        
        # Test alembic connectivity
        success, stdout, stderr = self._run_alembic_command(["current"])
        if not success:
            issues.append(f"Alembic connectivity test failed: {stderr}")
        
        # Check for duplicate revisions
        migration_files = list(self.versions_dir.glob("*.py"))
        revisions = []
        
        for file_path in migration_files:
            if file_path.name == "__pycache__":
                continue
                
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    # Extract revision from file
                    rev_match = re.search(r'revision\s*=\s*["\']([^"\']+)["\']', content)
                    if rev_match:
                        revision = rev_match.group(1)
                        if revision in revisions:
                            issues.append(f"Duplicate revision found: {revision}")
                        else:
                            revisions.append(revision)
            except Exception as e:
                issues.append(f"Error reading migration file {file_path.name}: {str(e)}")
        
        return len(issues) == 0, issues
    
    def get_migration_file_content(self, migration_file: str) -> Optional[str]:
        """Get content of a migration file"""
        try:
            file_path = self.versions_dir / migration_file
            if file_path.exists():
                with open(file_path, 'r') as f:
                    return f.read()
            return None
        except Exception as e:
            logger.error(f"Error reading migration file: {e}")
            return None
    
    async def get_database_schema_version(self) -> Dict[str, Any]:
        """Get database schema version information"""
        try:
            # Get current revision
            current_rev = await self.get_current_revision()
            
            # Get database creation time (approximate)
            db_info_query = text("""
                SELECT 
                    current_database() as db_name,
                    pg_database_size(current_database()) as db_size,
                    (SELECT count(*) FROM information_schema.tables 
                     WHERE table_schema = 'public') as table_count
            """)
            
            result = await self.session.execute(db_info_query)
            db_info = result.fetchone()
            
            return {
                'current_revision': current_rev,
                'database_name': db_info[0] if db_info else "unknown",
                'database_size': db_info[1] if db_info else 0,
                'table_count': db_info[2] if db_info else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting database schema version: {e}")
            return {
                'current_revision': None,
                'database_name': "unknown",
                'database_size': 0,
                'table_count': 0,
                'error': str(e)
            }
    
    def display_migration_status(self, migrations: List[Dict[str, Any]], current_revision: Optional[str]) -> None:
        """Display migration status in a table"""
        if not migrations:
            console.print("[yellow]No migrations found[/yellow]")
            return
        
        table = Table(title="Migration Status", show_header=True, header_style="bold magenta")
        
        table.add_column("Revision", style="bold blue", width=12)
        table.add_column("Status", justify="center", width=10)
        table.add_column("Parent", style="dim", width=12)
        table.add_column("Description", style="green")
        
        for migration in reversed(migrations):  # Show newest first
            revision = migration.get('revision', 'unknown')
            parent = migration.get('parent', 'none')
            description = migration.get('description', 'No description')
            
            # Determine status
            if current_revision == revision:
                status = "🟢 Current"
            elif "head" in migration.get('status', ''):
                status = "📍 Head"
            else:
                status = "⚪ Applied"
            
            table.add_row(
                revision[:12],  # Truncate revision
                status,
                parent[:12] if parent != '<base>' else 'base',
                description[:60] + "..." if len(description) > 60 else description
            )
        
        console.print(table)
        
        # Show current status
        if current_revision:
            console.print(f"\n[bold blue]Current database revision:[/bold blue] {current_revision}")
        else:
            console.print(f"\n[bold red]⚠️  Database not initialized with Alembic[/bold red]")
    
    def display_migration_file(self, migration_file: str, content: str) -> None:
        """Display migration file content with syntax highlighting"""
        console.print(f"\n[bold blue]Migration File: {migration_file}[/bold blue]")
        
        # Show syntax highlighted code
        syntax = Syntax(content, "python", theme="monokai", line_numbers=True)
        console.print(syntax)
    
    def display_migration_sql(self, sql_content: str) -> None:
        """Display migration SQL with syntax highlighting"""
        console.print("\n[bold blue]Migration SQL:[/bold blue]")
        
        # Show syntax highlighted SQL
        syntax = Syntax(sql_content, "sql", theme="monokai", line_numbers=True)
        console.print(syntax)
    
    def display_schema_info(self, schema_info: Dict[str, Any]) -> None:
        """Display database schema information"""
        if 'error' in schema_info:
            console.print(f"[red]Error getting schema info: {schema_info['error']}[/red]")
            return
        
        panel_content = f"""
[bold blue]Database Name:[/bold blue] {schema_info['database_name']}
[bold blue]Current Revision:[/bold blue] {schema_info['current_revision'] or 'Not initialized'}
[bold blue]Database Size:[/bold blue] {schema_info['database_size'] / (1024**2):.2f} MB
[bold blue]Table Count:[/bold blue] {schema_info['table_count']}
        """
        
        panel = Panel(
            panel_content.strip(),
            title="🗃️ Database Schema Information",
            border_style="blue",
            padding=(1, 2)
        )
        
        console.print(panel)
    
    def confirm_migration_operation(self, operation: str, details: str = "") -> bool:
        """Confirm migration operation with user"""
        console.print(f"\n[bold yellow]⚠️  {operation.upper()} Operation[/bold yellow]")
        if details:
            console.print(f"[dim]{details}[/dim]")
        
        console.print("[red]This operation will modify your database schema.[/red]")
        console.print("[yellow]Make sure you have a backup before proceeding.[/yellow]")
        
        return Confirm.ask(f"\n[bold]Proceed with {operation}?", default=False)
    
    def get_migration_templates(self) -> Dict[str, str]:
        """Get common migration templates"""
        return {
            "add_table": """
# Add table migration template
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'new_table',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

def downgrade():
    op.drop_table('new_table')
""",
            "add_column": """
# Add column migration template
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('table_name', sa.Column('new_column', sa.String(255), nullable=True))

def downgrade():
    op.drop_column('table_name', 'new_column')
""",
            "add_index": """
# Add index migration template
from alembic import op

def upgrade():
    op.create_index('idx_table_column', 'table_name', ['column_name'])

def downgrade():
    op.drop_index('idx_table_column', 'table_name')
"""
        }
    
    def show_migration_templates(self) -> None:
        """Show available migration templates"""
        templates = self.get_migration_templates()
        
        console.print("[bold blue]Available Migration Templates:[/bold blue]\n")
        
        for template_name, template_code in templates.items():
            console.print(f"[bold green]{template_name.replace('_', ' ').title()}:[/bold green]")
            syntax = Syntax(template_code.strip(), "python", theme="monokai")
            console.print(syntax)
            console.print()  # Add spacing