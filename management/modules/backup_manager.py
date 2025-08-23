"""
Backup Manager Module

Handles database backup and restore operations for the rental management system.
Supports full database backups, selective table backups, and automated backup scheduling.
"""

import subprocess
import logging
import gzip
import shutil
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, TaskID
from rich.prompt import Confirm, Prompt
import json

logger = logging.getLogger(__name__)
console = Console()


class BackupManager:
    """Manages database backup and restore operations"""
    
    def __init__(self, session: AsyncSession, backup_dir: Path, db_config):
        self.session = session
        self.backup_dir = backup_dir
        self.db_config = db_config
        
        # Ensure backup directory exists
        self.backup_dir.mkdir(exist_ok=True)
        
        # Create subdirectories for organization
        self.full_backup_dir = backup_dir / "full"
        self.table_backup_dir = backup_dir / "tables"
        self.schema_backup_dir = backup_dir / "schema"
        
        self.full_backup_dir.mkdir(exist_ok=True)
        self.table_backup_dir.mkdir(exist_ok=True)
        self.schema_backup_dir.mkdir(exist_ok=True)
    
    def _get_pg_dump_command(self, additional_args: List[str] = None) -> List[str]:
        """Get base pg_dump command with connection parameters"""
        command = [
            "pg_dump",
            "--host", self.db_config.POSTGRES_HOST,
            "--port", str(self.db_config.POSTGRES_PORT),
            "--username", self.db_config.POSTGRES_USER,
            "--dbname", self.db_config.POSTGRES_DB,
            "--no-password",  # Use PGPASSWORD environment variable
            "--verbose"
        ]
        
        if additional_args:
            command.extend(additional_args)
        
        return command
    
    def _get_psql_command(self, additional_args: List[str] = None) -> List[str]:
        """Get base psql command with connection parameters"""
        command = [
            "psql",
            "--host", self.db_config.POSTGRES_HOST,
            "--port", str(self.db_config.POSTGRES_PORT),
            "--username", self.db_config.POSTGRES_USER,
            "--dbname", self.db_config.POSTGRES_DB,
            "--no-password"  # Use PGPASSWORD environment variable
        ]
        
        if additional_args:
            command.extend(additional_args)
        
        return command
    
    def _run_pg_command(self, command: List[str], output_file: Optional[Path] = None, 
                       input_file: Optional[Path] = None) -> Tuple[bool, str]:
        """Run a PostgreSQL command with proper environment"""
        try:
            # Set environment for PostgreSQL password
            env = {
                "PGPASSWORD": self.db_config.POSTGRES_PASSWORD
            }
            
            # Prepare command execution
            if output_file:
                with open(output_file, 'w') as f:
                    result = subprocess.run(
                        command,
                        stdout=f,
                        stderr=subprocess.PIPE,
                        text=True,
                        env=env,
                        timeout=1800  # 30 minute timeout
                    )
            elif input_file:
                with open(input_file, 'r') as f:
                    result = subprocess.run(
                        command,
                        stdin=f,
                        stderr=subprocess.PIPE,
                        text=True,
                        env=env,
                        timeout=1800  # 30 minute timeout
                    )
            else:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=1800  # 30 minute timeout
                )
            
            success = result.returncode == 0
            error_output = result.stderr or ""
            
            if not success:
                logger.error(f"PostgreSQL command failed: {' '.join(command)}")
                logger.error(f"Error output: {error_output}")
            
            return success, error_output
            
        except subprocess.TimeoutExpired:
            return False, "Command timed out after 30 minutes"
        except Exception as e:
            return False, f"Error running PostgreSQL command: {str(e)}"
    
    def create_full_backup(self, backup_name: Optional[str] = None, compress: bool = True) -> Tuple[bool, str, Optional[Path]]:
        """Create a full database backup"""
        if not backup_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"full_backup_{timestamp}"
        
        # Prepare file paths
        sql_file = self.full_backup_dir / f"{backup_name}.sql"
        final_file = sql_file
        
        if compress:
            final_file = self.full_backup_dir / f"{backup_name}.sql.gz"
        
        console.print(f"[yellow]Creating full database backup: {backup_name}...[/yellow]")
        
        try:
            # Create pg_dump command
            dump_command = self._get_pg_dump_command([
                "--format=plain",
                "--no-owner",
                "--no-acl",
                "--create",
                "--clean"
            ])
            
            # Run backup
            success, error_output = self._run_pg_command(dump_command, output_file=sql_file)
            
            if not success:
                return False, f"Backup failed: {error_output}", None
            
            # Compress if requested
            if compress:
                try:
                    with open(sql_file, 'rb') as f_in:
                        with gzip.open(final_file, 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    
                    # Remove uncompressed file
                    sql_file.unlink()
                    
                except Exception as e:
                    return False, f"Compression failed: {str(e)}", None
            
            # Create metadata file
            metadata = {
                'backup_name': backup_name,
                'backup_type': 'full',
                'created_at': datetime.now().isoformat(),
                'database_name': self.db_config.POSTGRES_DB,
                'compressed': compress,
                'file_size': final_file.stat().st_size,
                'file_path': str(final_file)
            }
            
            metadata_file = self.full_backup_dir / f"{backup_name}.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            success_msg = f"Full backup created successfully: {final_file.name}"
            console.print(f"[green]✓ {success_msg}[/green]")
            
            return True, success_msg, final_file
            
        except Exception as e:
            error_msg = f"Unexpected error during backup: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, None
    
    def create_schema_backup(self, backup_name: Optional[str] = None) -> Tuple[bool, str, Optional[Path]]:
        """Create a schema-only backup"""
        if not backup_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"schema_backup_{timestamp}"
        
        schema_file = self.schema_backup_dir / f"{backup_name}.sql"
        
        console.print(f"[yellow]Creating schema backup: {backup_name}...[/yellow]")
        
        try:
            # Create schema-only pg_dump command
            dump_command = self._get_pg_dump_command([
                "--schema-only",
                "--format=plain",
                "--no-owner",
                "--no-acl"
            ])
            
            success, error_output = self._run_pg_command(dump_command, output_file=schema_file)
            
            if not success:
                return False, f"Schema backup failed: {error_output}", None
            
            # Create metadata
            metadata = {
                'backup_name': backup_name,
                'backup_type': 'schema',
                'created_at': datetime.now().isoformat(),
                'database_name': self.db_config.POSTGRES_DB,
                'file_size': schema_file.stat().st_size,
                'file_path': str(schema_file)
            }
            
            metadata_file = self.schema_backup_dir / f"{backup_name}.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            success_msg = f"Schema backup created successfully: {schema_file.name}"
            console.print(f"[green]✓ {success_msg}[/green]")
            
            return True, success_msg, schema_file
            
        except Exception as e:
            error_msg = f"Unexpected error during schema backup: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, None
    
    def create_table_backup(self, tables: List[str], backup_name: Optional[str] = None) -> Tuple[bool, str, Optional[Path]]:
        """Create backup of specific tables"""
        if not backup_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            tables_str = "_".join(tables[:3])  # Use first 3 table names
            if len(tables) > 3:
                tables_str += "_and_more"
            backup_name = f"tables_{tables_str}_{timestamp}"
        
        backup_file = self.table_backup_dir / f"{backup_name}.sql"
        
        console.print(f"[yellow]Creating table backup: {backup_name}...[/yellow]")
        
        try:
            # Create table-specific pg_dump command
            dump_command = self._get_pg_dump_command([
                "--data-only",
                "--format=plain",
                "--no-owner",
                "--no-acl"
            ])
            
            # Add table specifications
            for table in tables:
                dump_command.extend(["--table", table])
            
            success, error_output = self._run_pg_command(dump_command, output_file=backup_file)
            
            if not success:
                return False, f"Table backup failed: {error_output}", None
            
            # Create metadata
            metadata = {
                'backup_name': backup_name,
                'backup_type': 'tables',
                'tables': tables,
                'created_at': datetime.now().isoformat(),
                'database_name': self.db_config.POSTGRES_DB,
                'file_size': backup_file.stat().st_size,
                'file_path': str(backup_file)
            }
            
            metadata_file = self.table_backup_dir / f"{backup_name}.json"
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            success_msg = f"Table backup created successfully: {backup_file.name}"
            console.print(f"[green]✓ {success_msg}[/green]")
            
            return True, success_msg, backup_file
            
        except Exception as e:
            error_msg = f"Unexpected error during table backup: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, None
    
    def restore_from_backup(self, backup_file: Path, restore_type: str = "full") -> Tuple[bool, str]:
        """Restore database from backup file"""
        if not backup_file.exists():
            return False, f"Backup file not found: {backup_file}"
        
        console.print(f"[yellow]Restoring from backup: {backup_file.name}...[/yellow]")
        
        try:
            # Handle compressed files
            temp_file = None
            restore_file = backup_file
            
            if backup_file.suffix == '.gz':
                temp_file = backup_file.parent / f"temp_{backup_file.stem}"
                with gzip.open(backup_file, 'rb') as f_in:
                    with open(temp_file, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                restore_file = temp_file
            
            # Create restore command
            if restore_type == "full":
                restore_command = self._get_psql_command(["--quiet"])
            else:
                restore_command = self._get_psql_command(["--quiet", "--single-transaction"])
            
            success, error_output = self._run_pg_command(restore_command, input_file=restore_file)
            
            # Clean up temp file
            if temp_file and temp_file.exists():
                temp_file.unlink()
            
            if not success:
                return False, f"Restore failed: {error_output}"
            
            success_msg = f"Database restored successfully from {backup_file.name}"
            console.print(f"[green]✓ {success_msg}[/green]")
            
            return True, success_msg
            
        except Exception as e:
            error_msg = f"Unexpected error during restore: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def list_backups(self) -> Dict[str, List[Dict[str, Any]]]:
        """List all available backups"""
        backups = {
            'full': [],
            'schema': [],
            'tables': []
        }
        
        # Scan backup directories
        for backup_type, backup_dir in [
            ('full', self.full_backup_dir),
            ('schema', self.schema_backup_dir),
            ('tables', self.table_backup_dir)
        ]:
            for metadata_file in backup_dir.glob("*.json"):
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                    
                    # Add file info
                    backup_file = Path(metadata['file_path'])
                    if backup_file.exists():
                        metadata['exists'] = True
                        metadata['size_mb'] = round(metadata['file_size'] / (1024*1024), 2)
                        metadata['age_days'] = (datetime.now() - datetime.fromisoformat(metadata['created_at'])).days
                    else:
                        metadata['exists'] = False
                    
                    backups[backup_type].append(metadata)
                    
                except Exception as e:
                    logger.error(f"Error reading backup metadata {metadata_file}: {e}")
        
        # Sort by creation date (newest first)
        for backup_type in backups:
            backups[backup_type].sort(key=lambda x: x['created_at'], reverse=True)
        
        return backups
    
    def delete_backup(self, backup_file: Path) -> Tuple[bool, str]:
        """Delete a backup file and its metadata"""
        try:
            metadata_file = backup_file.with_suffix('.json')
            
            # Delete backup file
            if backup_file.exists():
                backup_file.unlink()
            
            # Delete metadata file
            if metadata_file.exists():
                metadata_file.unlink()
            
            success_msg = f"Backup deleted successfully: {backup_file.name}"
            console.print(f"[green]✓ {success_msg}[/green]")
            
            return True, success_msg
            
        except Exception as e:
            error_msg = f"Error deleting backup: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def cleanup_old_backups(self, keep_days: int = 30, keep_count: int = 10) -> Dict[str, Any]:
        """Clean up old backup files"""
        cutoff_date = datetime.now() - timedelta(days=keep_days)
        
        cleanup_results = {
            'deleted_files': [],
            'kept_files': [],
            'errors': [],
            'space_freed': 0
        }
        
        all_backups = self.list_backups()
        
        for backup_type, backups in all_backups.items():
            # Sort by date and keep the newest ones
            backups.sort(key=lambda x: x['created_at'], reverse=True)
            
            for i, backup in enumerate(backups):
                backup_date = datetime.fromisoformat(backup['created_at'])
                backup_file = Path(backup['file_path'])
                
                # Keep if it's within keep_count newest or within keep_days
                if i < keep_count or backup_date > cutoff_date:
                    cleanup_results['kept_files'].append(backup['backup_name'])
                else:
                    try:
                        file_size = backup.get('file_size', 0)
                        success, message = self.delete_backup(backup_file)
                        
                        if success:
                            cleanup_results['deleted_files'].append(backup['backup_name'])
                            cleanup_results['space_freed'] += file_size
                        else:
                            cleanup_results['errors'].append(f"{backup['backup_name']}: {message}")
                    except Exception as e:
                        cleanup_results['errors'].append(f"{backup['backup_name']}: {str(e)}")
        
        return cleanup_results
    
    async def get_database_info_for_backup(self) -> Dict[str, Any]:
        """Get database information for backup metadata"""
        try:
            query = text("""
                SELECT 
                    current_database() as db_name,
                    pg_database_size(current_database()) as db_size,
                    (SELECT count(*) FROM information_schema.tables 
                     WHERE table_schema = 'public') as table_count,
                    (SELECT COALESCE(SUM(n_live_tup), 0) 
                     FROM pg_stat_user_tables WHERE schemaname = 'public') as total_rows
            """)
            
            result = await self.session.execute(query)
            row = result.fetchone()
            
            return {
                'database_name': row[0],
                'database_size': row[1],
                'table_count': row[2],
                'total_rows': row[3],
                'backup_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting database info: {e}")
            return {
                'error': str(e),
                'backup_timestamp': datetime.now().isoformat()
            }
    
    def display_backups_table(self, backups: Dict[str, List[Dict[str, Any]]]) -> None:
        """Display backups in a formatted table"""
        for backup_type, backup_list in backups.items():
            if not backup_list:
                continue
                
            table = Table(title=f"{backup_type.title()} Backups", show_header=True, header_style="bold magenta")
            
            table.add_column("Name", style="bold blue")
            table.add_column("Created", style="green")
            table.add_column("Size", justify="right", style="cyan")
            table.add_column("Age", justify="right", style="yellow")
            table.add_column("Status", justify="center")
            
            if backup_type == "tables":
                table.add_column("Tables", style="dim")
            
            for backup in backup_list:
                status = "✅ Available" if backup['exists'] else "❌ Missing"
                created = datetime.fromisoformat(backup['created_at']).strftime("%Y-%m-%d %H:%M")
                
                row_data = [
                    backup['backup_name'],
                    created,
                    f"{backup.get('size_mb', 0):.1f} MB",
                    f"{backup.get('age_days', 0)} days",
                    status
                ]
                
                if backup_type == "tables":
                    tables_str = ", ".join(backup.get('tables', [])[:3])
                    if len(backup.get('tables', [])) > 3:
                        tables_str += "..."
                    row_data.append(tables_str)
                
                table.add_row(*row_data)
            
            console.print(table)
            console.print()  # Add spacing between tables
    
    def display_cleanup_results(self, results: Dict[str, Any]) -> None:
        """Display backup cleanup results"""
        deleted_count = len(results['deleted_files'])
        kept_count = len(results['kept_files'])
        error_count = len(results['errors'])
        space_freed = results['space_freed']
        
        console.print(f"[green]✓ Deleted {deleted_count} old backups[/green]")
        console.print(f"[blue]✓ Kept {kept_count} recent backups[/blue]")
        console.print(f"[cyan]✓ Space freed: {space_freed / (1024*1024):.1f} MB[/cyan]")
        
        if error_count > 0:
            console.print(f"[red]⚠️ {error_count} errors occurred[/red]")
            for error in results['errors']:
                console.print(f"  • {error}")
    
    def confirm_restore_operation(self, backup_file: Path) -> bool:
        """Confirm restore operation with user"""
        console.print(f"\n[bold red]⚠️  DANGEROUS OPERATION[/bold red]")
        console.print(f"[yellow]This will COMPLETELY REPLACE your current database![/yellow]")
        console.print(f"[red]All current data will be PERMANENTLY LOST![/red]")
        console.print(f"\n[blue]Backup file:[/blue] {backup_file.name}")
        console.print(f"[blue]Target database:[/blue] {self.db_config.POSTGRES_DB}")
        
        console.print("\n[bold yellow]Recommended steps before restore:[/bold yellow]")
        console.print("  1. Create a current backup")
        console.print("  2. Verify the restore file is correct")
        console.print("  3. Ensure no other applications are using the database")
        
        return Confirm.ask("\n[bold]Are you ABSOLUTELY SURE you want to proceed?", default=False)
    
    def get_backup_recommendations(self, db_info: Dict[str, Any]) -> List[str]:
        """Get backup recommendations based on database info"""
        recommendations = []
        
        if 'error' in db_info:
            recommendations.append("⚠️ Unable to analyze database - check connection")
            return recommendations
        
        db_size_mb = db_info.get('database_size', 0) / (1024*1024)
        table_count = db_info.get('table_count', 0)
        total_rows = db_info.get('total_rows', 0)
        
        # Size-based recommendations
        if db_size_mb > 1000:  # > 1GB
            recommendations.append("💾 Large database detected - consider compressed backups")
            recommendations.append("⏰ Schedule automated backups during low-usage hours")
        elif db_size_mb > 100:  # > 100MB
            recommendations.append("📦 Consider using compressed backups for space efficiency")
        
        # Activity-based recommendations
        if total_rows > 100000:
            recommendations.append("🔄 High data volume - implement daily backup schedule")
        elif total_rows > 10000:
            recommendations.append("📅 Moderate data volume - weekly backups recommended")
        
        # Table-based recommendations
        if table_count > 20:
            recommendations.append("📊 Multiple tables - consider selective table backups for development")
        
        # General recommendations
        recommendations.extend([
            "🛡️ Test restore procedures regularly",
            "🌍 Store backups in multiple locations",
            "📝 Document backup and restore procedures"
        ])
        
        return recommendations