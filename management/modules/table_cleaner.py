"""
Table Cleaner Module

Provides selective table cleaning functionality with safety checks and dependency handling.
Allows users to clear specific tables while preserving important data like authentication.
"""

import logging
from typing import List, Dict, Any, Set, Tuple, Optional
from sqlalchemy import text, MetaData, Table as SQLTable, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.tree import Tree
import asyncio

logger = logging.getLogger(__name__)
console = Console()


class TableCleaner:
    """Handles selective table cleaning with dependency management"""
    
    # Tables that should be preserved by default to maintain system integrity
    PROTECTED_TABLES = {
        'users',           # User accounts
        'alembic_version', # Migration tracking
        'pg_stat_statements', # PostgreSQL statistics (system table)
    }
    
    # Core authentication and system tables (extra protection)
    CRITICAL_TABLES = {
        'users',
        'alembic_version'
    }
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self._table_dependencies = {}
        self._table_info = {}
    
    async def get_all_user_tables(self) -> List[Dict[str, Any]]:
        """Get all user tables with row counts"""
        try:
            query = text("""
                SELECT 
                    t.table_name,
                    COALESCE(s.n_live_tup, 0) as row_count,
                    t.table_type,
                    obj_description(c.oid, 'pg_class') as table_comment
                FROM information_schema.tables t
                LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name AND s.schemaname = 'public'
                LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (
                    SELECT oid FROM pg_namespace WHERE nspname = 'public'
                )
                WHERE t.table_schema = 'public' 
                    AND t.table_type = 'BASE TABLE'
                ORDER BY s.n_live_tup DESC NULLS LAST, t.table_name;
            """)
            
            result = await self.session.execute(query)
            tables = []
            
            for row in result.fetchall():
                table_name = row[0]
                is_protected = table_name in self.PROTECTED_TABLES
                is_critical = table_name in self.CRITICAL_TABLES
                
                tables.append({
                    'table_name': table_name,
                    'row_count': row[1],
                    'table_type': row[2],
                    'comment': row[3] or '',
                    'is_protected': is_protected,
                    'is_critical': is_critical,
                    'status': self._get_table_status(table_name, is_protected, is_critical)
                })
            
            return tables
            
        except Exception as e:
            logger.error(f"Error getting user tables: {e}")
            return []
    
    def _get_table_status(self, table_name: str, is_protected: bool, is_critical: bool) -> str:
        """Get status indicator for table"""
        if is_critical:
            return "🔒 Critical"
        elif is_protected:
            return "🛡️ Protected"
        else:
            return "✅ Safe to clear"
    
    async def analyze_table_dependencies(self, tables: List[str]) -> Dict[str, List[str]]:
        """Analyze foreign key dependencies for given tables"""
        try:
            # Get all foreign key relationships
            fk_query = text("""
                SELECT DISTINCT
                    tc.table_name as dependent_table,
                    ccu.table_name as referenced_table,
                    tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu 
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = 'public'
                    AND ccu.table_schema = 'public'
                ORDER BY tc.table_name;
            """)
            
            result = await self.session.execute(fk_query)
            dependencies = {}
            
            for row in result.fetchall():
                dependent_table = row[0]
                referenced_table = row[1]
                
                # Only consider dependencies for tables we're interested in
                if dependent_table in tables or referenced_table in tables:
                    if dependent_table not in dependencies:
                        dependencies[dependent_table] = []
                    
                    if referenced_table not in dependencies[dependent_table]:
                        dependencies[dependent_table].append(referenced_table)
            
            self._table_dependencies = dependencies
            return dependencies
            
        except Exception as e:
            logger.error(f"Error analyzing table dependencies: {e}")
            return {}
    
    def get_deletion_order(self, tables_to_clean: List[str]) -> List[str]:
        """Determine the correct order to delete tables based on foreign key dependencies"""
        if not self._table_dependencies:
            return tables_to_clean
        
        # Build a dependency graph
        remaining_tables = set(tables_to_clean)
        deletion_order = []
        
        while remaining_tables:
            # Find tables with no dependencies to remaining tables
            can_delete = []
            
            for table in remaining_tables:
                dependencies = self._table_dependencies.get(table, [])
                # Check if all dependencies are either not in our list or already deleted
                blocking_deps = [dep for dep in dependencies if dep in remaining_tables]
                
                if not blocking_deps:
                    can_delete.append(table)
            
            if not can_delete:
                # Circular dependency or missing analysis - just add remaining tables
                console.print("[yellow]Warning: Potential circular dependency detected[/yellow]")
                can_delete = list(remaining_tables)
            
            # Add to deletion order and remove from remaining
            deletion_order.extend(can_delete)
            remaining_tables -= set(can_delete)
        
        return deletion_order
    
    async def get_table_preview(self, table_name: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get a preview of table data"""
        try:
            query = text(f"SELECT * FROM {table_name} LIMIT :limit")
            result = await self.session.execute(query, {"limit": limit})
            
            # Get column names
            columns = result.keys()
            rows = result.fetchall()
            
            preview_data = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                preview_data.append(row_dict)
            
            return preview_data
            
        except Exception as e:
            logger.error(f"Error getting table preview for {table_name}: {e}")
            return []
    
    async def clear_table(self, table_name: str, cascade: bool = False) -> Tuple[bool, str, int]:
        """Clear a single table"""
        try:
            # First get row count
            count_query = text(f"SELECT COUNT(*) FROM {table_name}")
            count_result = await self.session.execute(count_query)
            initial_count = count_result.scalar()
            
            # Clear the table
            if cascade:
                delete_query = text(f"DELETE FROM {table_name} CASCADE")
            else:
                delete_query = text(f"DELETE FROM {table_name}")
            
            await self.session.execute(delete_query)
            
            return True, f"Successfully cleared table '{table_name}'", initial_count
            
        except Exception as e:
            logger.error(f"Error clearing table {table_name}: {e}")
            return False, f"Failed to clear table '{table_name}': {str(e)}", 0
    
    async def clear_tables(self, tables_to_clean: List[str], preserve_auth: bool = True, 
                          dry_run: bool = False) -> Dict[str, Any]:
        """Clear multiple tables in the correct order"""
        
        # Filter out protected tables if preserve_auth is True
        if preserve_auth:
            tables_to_clean = [t for t in tables_to_clean if t not in self.PROTECTED_TABLES]
        
        # Always protect critical tables
        tables_to_clean = [t for t in tables_to_clean if t not in self.CRITICAL_TABLES]
        
        if not tables_to_clean:
            return {
                'success': False,
                'message': 'No tables to clean after applying protection filters',
                'results': {}
            }
        
        # Analyze dependencies
        await self.analyze_table_dependencies(tables_to_clean)
        
        # Get deletion order
        deletion_order = self.get_deletion_order(tables_to_clean)
        
        results = {
            'success': True,
            'message': f"{'Dry run: Would clear' if dry_run else 'Cleared'} {len(deletion_order)} tables",
            'results': {},
            'total_rows_cleared': 0,
            'deletion_order': deletion_order
        }
        
        if dry_run:
            console.print("[yellow]DRY RUN MODE - No data will actually be deleted[/yellow]")
        
        # Clear tables in order
        for table_name in deletion_order:
            try:
                if dry_run:
                    # Just get count for dry run
                    count_query = text(f"SELECT COUNT(*) FROM {table_name}")
                    count_result = await self.session.execute(count_query)
                    row_count = count_result.scalar()
                    
                    results['results'][table_name] = {
                        'success': True,
                        'rows_affected': row_count,
                        'message': f"Would clear {row_count} rows"
                    }
                    results['total_rows_cleared'] += row_count
                else:
                    # Actually clear the table
                    success, message, rows_cleared = await self.clear_table(table_name)
                    
                    results['results'][table_name] = {
                        'success': success,
                        'rows_affected': rows_cleared,
                        'message': message
                    }
                    
                    if success:
                        results['total_rows_cleared'] += rows_cleared
                    else:
                        results['success'] = False
                        console.print(f"[red]Failed to clear {table_name}: {message}[/red]")
                        break
                
            except Exception as e:
                error_msg = f"Unexpected error clearing {table_name}: {str(e)}"
                logger.error(error_msg)
                results['results'][table_name] = {
                    'success': False,
                    'rows_affected': 0,
                    'message': error_msg
                }
                results['success'] = False
                break
        
        # Commit transaction if not dry run and successful
        if not dry_run and results['success']:
            try:
                await self.session.commit()
            except Exception as e:
                await self.session.rollback()
                results['success'] = False
                results['message'] = f"Failed to commit changes: {str(e)}"
        elif not dry_run and not results['success']:
            await self.session.rollback()
        
        return results
    
    async def reset_table_sequences(self, tables: List[str]) -> Dict[str, bool]:
        """Reset auto-increment sequences for cleared tables"""
        results = {}
        
        for table_name in tables:
            try:
                # Find sequences for this table
                seq_query = text("""
                    SELECT column_name, column_default
                    FROM information_schema.columns
                    WHERE table_name = :table_name 
                        AND table_schema = 'public'
                        AND column_default LIKE 'nextval%'
                """)
                
                seq_result = await self.session.execute(seq_query, {"table_name": table_name})
                
                for row in seq_result.fetchall():
                    # Extract sequence name from default value
                    default_value = row[1]
                    if 'nextval' in default_value:
                        # Extract sequence name (between quotes)
                        seq_name = default_value.split("'")[1] if "'" in default_value else None
                        
                        if seq_name:
                            reset_query = text(f"SELECT setval('{seq_name}', 1, false)")
                            await self.session.execute(reset_query)
                
                results[table_name] = True
                
            except Exception as e:
                logger.error(f"Error resetting sequences for {table_name}: {e}")
                results[table_name] = False
        
        return results
    
    def display_tables_for_selection(self, tables: List[Dict[str, Any]]) -> None:
        """Display tables in a selection-friendly format"""
        table = Table(title="Database Tables", show_header=True, header_style="bold magenta")
        
        table.add_column("#", style="dim", width=4)
        table.add_column("Table Name", style="bold blue")
        table.add_column("Status", justify="center")
        table.add_column("Row Count", justify="right", style="green")
        table.add_column("Comment", style="dim")
        
        for idx, table_info in enumerate(tables, 1):
            table.add_row(
                str(idx),
                table_info['table_name'],
                table_info['status'],
                f"{table_info['row_count']:,}",
                table_info['comment'][:50] + "..." if len(table_info['comment']) > 50 else table_info['comment']
            )
        
        console.print(table)
    
    def display_dependencies_tree(self, dependencies: Dict[str, List[str]]) -> None:
        """Display table dependencies as a tree"""
        if not dependencies:
            console.print("[yellow]No foreign key dependencies found[/yellow]")
            return
        
        tree = Tree("🔗 Table Dependencies")
        
        for table, deps in dependencies.items():
            if deps:
                table_node = tree.add(f"[bold red]{table}[/bold red] depends on:")
                for dep in deps:
                    table_node.add(f"[blue]{dep}[/blue]")
            else:
                tree.add(f"[green]{table}[/green] (no dependencies)")
        
        console.print(tree)
    
    def display_cleanup_results(self, results: Dict[str, Any]) -> None:
        """Display cleanup results in a formatted table"""
        success = results['success']
        message = results['message']
        table_results = results['results']
        total_rows = results['total_rows_cleared']
        deletion_order = results.get('deletion_order', [])
        
        # Overall status
        status_color = "green" if success else "red"
        console.print(f"[{status_color}]{message}[/{status_color}]")
        console.print(f"[bold blue]Total rows affected: {total_rows:,}[/bold blue]")
        
        if not table_results:
            return
        
        # Results table
        results_table = Table(title="Cleanup Results", show_header=True, header_style="bold magenta")
        
        results_table.add_column("Order", style="dim", width=6)
        results_table.add_column("Table", style="bold blue")
        results_table.add_column("Status", justify="center")
        results_table.add_column("Rows Affected", justify="right", style="green")
        results_table.add_column("Message", style="yellow")
        
        for idx, table_name in enumerate(deletion_order, 1):
            if table_name in table_results:
                result = table_results[table_name]
                status = "✅ Success" if result['success'] else "❌ Failed"
                
                results_table.add_row(
                    str(idx),
                    table_name,
                    status,
                    f"{result['rows_affected']:,}",
                    result['message'][:50] + "..." if len(result['message']) > 50 else result['message']
                )
        
        console.print(results_table)
    
    def display_table_preview(self, table_name: str, preview_data: List[Dict[str, Any]]) -> None:
        """Display a preview of table data"""
        if not preview_data:
            console.print(f"[yellow]Table '{table_name}' is empty or could not be accessed[/yellow]")
            return
        
        # Create table with dynamic columns based on first row
        preview_table = Table(title=f"Preview: {table_name} (first {len(preview_data)} rows)", 
                            show_header=True, header_style="bold magenta")
        
        # Add columns from first row
        columns = list(preview_data[0].keys())
        for col in columns:
            preview_table.add_column(col, style="cyan")
        
        # Add rows
        for row_data in preview_data:
            row_values = []
            for col in columns:
                value = str(row_data.get(col, ''))
                # Truncate long values
                if len(value) > 30:
                    value = value[:27] + "..."
                row_values.append(value)
            
            preview_table.add_row(*row_values)
        
        console.print(preview_table)
    
    async def interactive_table_selection(self, tables: List[Dict[str, Any]]) -> List[str]:
        """Interactive table selection interface"""
        console.print("\n[bold blue]Select tables to clear:[/bold blue]")
        console.print("[dim]Enter table numbers separated by commas (e.g., 1,3,5-8) or 'all' for all non-protected tables[/dim]")
        console.print("[dim]Protected tables are automatically excluded[/dim]\n")
        
        self.display_tables_for_selection(tables)
        
        while True:
            selection = Prompt.ask("\n[bold]Select tables")
            
            if selection.lower() == 'all':
                return [t['table_name'] for t in tables if not t['is_protected']]
            
            try:
                selected_indices = []
                
                # Parse comma-separated values
                parts = selection.split(',')
                for part in parts:
                    part = part.strip()
                    if '-' in part:
                        # Handle ranges like "5-8"
                        start, end = map(int, part.split('-'))
                        selected_indices.extend(range(start, end + 1))
                    else:
                        selected_indices.append(int(part))
                
                # Convert to table names
                selected_tables = []
                for idx in selected_indices:
                    if 1 <= idx <= len(tables):
                        table_info = tables[idx - 1]
                        if not table_info['is_critical']:  # Never allow critical tables
                            selected_tables.append(table_info['table_name'])
                        else:
                            console.print(f"[red]Warning: Skipping critical table '{table_info['table_name']}'[/red]")
                    else:
                        console.print(f"[yellow]Warning: Invalid table number {idx}[/yellow]")
                
                if selected_tables:
                    return selected_tables
                else:
                    console.print("[red]No valid tables selected. Please try again.[/red]")
                    
            except ValueError:
                console.print("[red]Invalid selection format. Please use numbers, ranges, or 'all'.[/red]")
    
    async def confirm_cleanup_operation(self, tables_to_clean: List[str], 
                                      preserve_auth: bool = True) -> bool:
        """Confirm cleanup operation with user"""
        console.print(f"\n[bold red]⚠️  WARNING: This will permanently delete data![/bold red]")
        console.print(f"[yellow]Tables to be cleared: {len(tables_to_clean)}[/yellow]")
        
        for table in tables_to_clean:
            console.print(f"  • {table}")
        
        if preserve_auth:
            console.print(f"\n[green]✓ Authentication data will be preserved[/green]")
        else:
            console.print(f"\n[red]⚠️  Authentication data will NOT be preserved![/red]")
        
        return Confirm.ask("\n[bold]Are you sure you want to proceed?", default=False)