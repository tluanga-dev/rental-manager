"""
Database Inspector Module

Provides comprehensive database analysis and reporting functionality.
Shows table statistics, relationships, indexes, and database health information.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.progress import Progress, TaskID
import json

logger = logging.getLogger(__name__)
console = Console()


class DatabaseInspector:
    """Inspects and reports on database structure and statistics"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all_tables_with_counts(self) -> List[Dict[str, Any]]:
        """Get all tables with row counts and basic statistics"""
        try:
            # First, get basic table information from information_schema
            basic_query = text("""
                SELECT 
                    table_schema,
                    table_name
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
            
            result = await self.session.execute(basic_query)
            basic_rows = result.fetchall()
            
            if not basic_rows:
                return []  # No tables found
            
            # Now try to get statistics from pg_stat_user_tables
            stats_query = text("""
                SELECT 
                    schemaname,
                    relname as tablename,
                    COALESCE(n_live_tup, 0) as row_count,
                    COALESCE(n_dead_tup, 0) as dead_rows,
                    COALESCE(n_tup_ins, 0) as inserts,
                    COALESCE(n_tup_upd, 0) as updates,
                    COALESCE(n_tup_del, 0) as deletes,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY n_live_tup DESC NULLS LAST, relname;
            """)
            
            try:
                stats_result = await self.session.execute(stats_query)
                stats_rows = stats_result.fetchall()
                
                # Create a dictionary for quick lookup
                stats_dict = {}
                for row in stats_rows:
                    stats_dict[row[1]] = {  # tablename is at index 1
                        'row_count': row[2],
                        'dead_rows': row[3],
                        'inserts': row[4],
                        'updates': row[5],
                        'deletes': row[6],
                        'last_vacuum': row[7],
                        'last_autovacuum': row[8],
                        'last_analyze': row[9],
                        'last_autoanalyze': row[10]
                    }
            except Exception:
                # If stats query fails, just use empty stats
                stats_dict = {}
            
            # Combine basic table info with statistics
            tables = []
            for schema, table_name in basic_rows:
                stats = stats_dict.get(table_name, {
                    'row_count': 0,
                    'dead_rows': 0,
                    'inserts': 0,
                    'updates': 0,
                    'deletes': 0,
                    'last_vacuum': None,
                    'last_autovacuum': None,
                    'last_analyze': None,
                    'last_autoanalyze': None
                })
                
                tables.append({
                    'schema': schema,
                    'table_name': table_name,
                    **stats
                })
            
            return tables
            
        except Exception as e:
            logger.error(f"Error getting table counts: {e}")
            return []
    
    async def get_table_details(self, table_name: str) -> Dict[str, Any]:
        """Get detailed information about a specific table"""
        try:
            # Get column information
            columns_query = text("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :table_name
                ORDER BY ordinal_position;
            """)
            
            columns_result = await self.session.execute(columns_query, {"table_name": table_name})
            columns = []
            
            for row in columns_result.fetchall():
                columns.append({
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES',
                    'default': row[3],
                    'max_length': row[4],
                    'precision': row[5],
                    'scale': row[6]
                })
            
            # Get foreign key constraints
            fk_query = text("""
                SELECT 
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    tc.constraint_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND tc.table_name = :table_name
                    AND tc.table_schema = 'public';
            """)
            
            fk_result = await self.session.execute(fk_query, {"table_name": table_name})
            foreign_keys = []
            
            for row in fk_result.fetchall():
                foreign_keys.append({
                    'column': row[0],
                    'references_table': row[1],
                    'references_column': row[2],
                    'constraint_name': row[3]
                })
            
            # Get indexes
            indexes_query = text("""
                SELECT 
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = :table_name;
            """)
            
            indexes_result = await self.session.execute(indexes_query, {"table_name": table_name})
            indexes = []
            
            for row in indexes_result.fetchall():
                indexes.append({
                    'name': row[0],
                    'definition': row[1]
                })
            
            # Get table size
            size_query = text("""
                SELECT 
                    pg_size_pretty(pg_total_relation_size(:table_name)) as total_size,
                    pg_size_pretty(pg_relation_size(:table_name)) as table_size,
                    pg_size_pretty(pg_total_relation_size(:table_name) - pg_relation_size(:table_name)) as index_size
            """)
            
            size_result = await self.session.execute(size_query, {"table_name": table_name})
            size_row = size_result.fetchone()
            
            table_size = {
                'total_size': size_row[0] if size_row else "Unknown",
                'table_size': size_row[1] if size_row else "Unknown",
                'index_size': size_row[2] if size_row else "Unknown"
            }
            
            return {
                'table_name': table_name,
                'columns': columns,
                'foreign_keys': foreign_keys,
                'indexes': indexes,
                'size': table_size
            }
            
        except Exception as e:
            logger.error(f"Error getting table details for {table_name}: {e}")
            return {'error': str(e)}
    
    async def _safe_query(self, query, params=None):
        """Execute a query safely, handling transaction rollback if needed"""
        try:
            if params:
                return await self.session.execute(query, params)
            else:
                return await self.session.execute(query)
        except Exception as e:
            # Rollback the transaction and re-raise
            await self.session.rollback()
            raise e

    async def get_database_statistics(self) -> Dict[str, Any]:
        """Get overall database statistics"""
        try:
            # Database size and basic info
            db_info_query = text("""
                SELECT 
                    pg_database_size(current_database()) as db_size,
                    current_database() as db_name,
                    version() as pg_version,
                    current_timestamp as current_time;
            """)
            
            try:
                db_result = await self._safe_query(db_info_query)
                db_row = db_result.fetchone()
            except Exception:
                # Fallback values if database info query fails
                db_row = [0, "unknown", "PostgreSQL", "unknown"]
            
            # Table count
            table_count_query = text("""
                SELECT COUNT(*) as table_count
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
            """)
            
            try:
                table_count_result = await self._safe_query(table_count_query)
                table_count = table_count_result.scalar()
            except Exception:
                table_count = 0
            
            # Total rows across all tables (skip if no tables or stats unavailable)
            total_rows = 0
            if table_count > 0:
                total_rows_query = text("""
                    SELECT COALESCE(SUM(n_live_tup), 0) as total_rows
                    FROM pg_stat_user_tables
                    WHERE schemaname = 'public';
                """)
                
                try:
                    total_rows_result = await self._safe_query(total_rows_query)
                    total_rows = total_rows_result.scalar() or 0
                except Exception:
                    total_rows = 0
            
            # Connection info
            connections_query = text("""
                SELECT 
                    COUNT(*) as active_connections,
                    COUNT(*) FILTER (WHERE state = 'active') as active_queries,
                    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
                FROM pg_stat_activity
                WHERE datname = current_database();
            """)
            
            try:
                conn_result = await self._safe_query(connections_query)
                conn_row = conn_result.fetchone()
            except Exception:
                conn_row = [1, 1, 0]  # Fallback values
            
            return {
                'database_name': db_row[1],
                'database_size': f"{db_row[0] / (1024**3):.2f} GB" if db_row[0] else "Unknown",
                'database_size_bytes': db_row[0],
                'postgresql_version': db_row[2].split(' ')[1] if db_row[2] else "Unknown",
                'current_time': db_row[3],
                'table_count': table_count,
                'total_rows': total_rows,
                'active_connections': conn_row[0] if conn_row else 0,
                'active_queries': conn_row[1] if conn_row else 0,
                'idle_connections': conn_row[2] if conn_row else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting database statistics: {e}")
            return {'error': str(e)}
    
    async def get_table_relationships(self) -> Dict[str, List[Dict[str, str]]]:
        """Get all table relationships (foreign keys)"""
        try:
            query = text("""
                SELECT 
                    tc.table_name as from_table,
                    kcu.column_name as from_column,
                    ccu.table_name AS to_table,
                    ccu.column_name AS to_column,
                    tc.constraint_name
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND tc.table_schema = 'public'
                ORDER BY tc.table_name, kcu.column_name;
            """)
            
            result = await self.session.execute(query)
            relationships = {}
            
            for row in result.fetchall():
                from_table = row[0]
                if from_table not in relationships:
                    relationships[from_table] = []
                
                relationships[from_table].append({
                    'from_column': row[1],
                    'to_table': row[2],
                    'to_column': row[3],
                    'constraint_name': row[4]
                })
            
            return relationships
            
        except Exception as e:
            logger.error(f"Error getting table relationships: {e}")
            return {}
    
    async def analyze_table_health(self) -> List[Dict[str, Any]]:
        """Analyze table health and suggest optimizations"""
        try:
            # First check if we have any tables
            table_check_query = text("""
                SELECT COUNT(*) as table_count
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
            """)
            
            table_count_result = await self._safe_query(table_check_query)
            table_count = table_count_result.scalar()
            
            if table_count == 0:
                return []  # No tables to analyze
            
            # Try to get health statistics
            query = text("""
                SELECT 
                    schemaname,
                    relname as tablename,
                    COALESCE(n_live_tup, 0) as n_live_tup,
                    COALESCE(n_dead_tup, 0) as n_dead_tup,
                    CASE 
                        WHEN COALESCE(n_live_tup, 0) > 0 
                        THEN ROUND((COALESCE(n_dead_tup, 0)::numeric / n_live_tup::numeric) * 100, 2)
                        ELSE 0 
                    END as dead_row_percentage,
                    last_vacuum,
                    last_autovacuum,
                    last_analyze,
                    last_autoanalyze,
                    COALESCE(seq_scan, 0) as seq_scan,
                    COALESCE(seq_tup_read, 0) as seq_tup_read,
                    COALESCE(idx_scan, 0) as idx_scan,
                    COALESCE(idx_tup_fetch, 0) as idx_tup_fetch
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY n_live_tup DESC;
            """)
            
            try:
                result = await self._safe_query(query)
            except Exception:
                # If stats are not available, return basic table info
                basic_query = text("""
                    SELECT table_name
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                """)
                basic_result = await self._safe_query(basic_query)
                return [{'table_name': row[0], 'status': 'No statistics available', 'issues': [], 'recommendations': []} 
                       for row in basic_result.fetchall()]
            health_analysis = []
            
            for row in result.fetchall():
                table_name = row[1]
                live_tup = row[2] or 0
                dead_tup = row[3] or 0
                dead_percentage = row[4] or 0
                seq_scan = row[8] or 0
                idx_scan = row[10] or 0
                
                issues = []
                recommendations = []
                
                # Check for high dead row percentage
                if dead_percentage > 20:
                    issues.append(f"High dead row percentage: {dead_percentage}%")
                    recommendations.append("Consider running VACUUM")
                
                # Check for tables with no index usage
                if live_tup > 1000 and idx_scan == 0 and seq_scan > 0:
                    issues.append("No index usage detected")
                    recommendations.append("Consider adding indexes for frequent queries")
                
                # Check for tables that haven't been analyzed recently
                if not row[7] and not row[9]:  # No analyze dates
                    issues.append("Table statistics may be outdated")
                    recommendations.append("Consider running ANALYZE")
                
                health_analysis.append({
                    'table_name': table_name,
                    'live_rows': live_tup,
                    'dead_rows': dead_tup,
                    'dead_percentage': dead_percentage,
                    'sequential_scans': seq_scan,
                    'index_scans': idx_scan,
                    'issues': issues,
                    'recommendations': recommendations,
                    'health_score': self._calculate_health_score(dead_percentage, seq_scan, idx_scan, live_tup)
                })
            
            return health_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing table health: {e}")
            return []
    
    def _calculate_health_score(self, dead_percentage: float, seq_scan: int, idx_scan: int, live_tup: int) -> str:
        """Calculate a simple health score for a table"""
        score = 100
        
        # Deduct points for high dead row percentage
        if dead_percentage > 20:
            score -= 30
        elif dead_percentage > 10:
            score -= 15
        
        # Deduct points for excessive sequential scans on large tables
        if live_tup > 1000 and seq_scan > idx_scan * 2:
            score -= 20
        
        # Deduct points for no index usage on large tables
        if live_tup > 1000 and idx_scan == 0:
            score -= 25
        
        if score >= 90:
            return "🟢 Excellent"
        elif score >= 70:
            return "🟡 Good"
        elif score >= 50:
            return "🟠 Fair"
        else:
            return "🔴 Poor"
    
    def display_tables_summary(self, tables: List[Dict[str, Any]]) -> None:
        """Display tables summary in a formatted table"""
        if not tables:
            console.print("[yellow]No tables found[/yellow]")
            return
        
        table = Table(title="Database Tables Summary", show_header=True, header_style="bold magenta")
        
        table.add_column("Table Name", style="bold blue")
        table.add_column("Row Count", justify="right", style="green")
        table.add_column("Dead Rows", justify="right", style="red")
        table.add_column("Inserts", justify="right", style="cyan")
        table.add_column("Updates", justify="right", style="yellow")
        table.add_column("Deletes", justify="right", style="red")
        table.add_column("Last Vacuum", style="dim")
        
        total_rows = 0
        for table_info in tables:
            total_rows += table_info['row_count']
            
            last_vacuum = "Never"
            if table_info['last_vacuum']:
                last_vacuum = table_info['last_vacuum'].strftime("%Y-%m-%d")
            elif table_info['last_autovacuum']:
                last_vacuum = f"Auto: {table_info['last_autovacuum'].strftime('%Y-%m-%d')}"
            
            table.add_row(
                table_info['table_name'],
                f"{table_info['row_count']:,}",
                f"{table_info['dead_rows']:,}",
                f"{table_info['inserts']:,}",
                f"{table_info['updates']:,}",
                f"{table_info['deletes']:,}",
                last_vacuum
            )
        
        console.print(table)
        console.print(f"\n[bold green]Total rows across all tables: {total_rows:,}[/bold green]")
    
    def display_database_statistics(self, stats: Dict[str, Any]) -> None:
        """Display database statistics in a panel"""
        if 'error' in stats:
            console.print(f"[red]Error getting database statistics: {stats['error']}[/red]")
            return
        
        panel_content = f"""
[bold blue]Database Name:[/bold blue] {stats['database_name']}
[bold blue]Database Size:[/bold blue] {stats['database_size']}
[bold blue]PostgreSQL Version:[/bold blue] {stats['postgresql_version']}
[bold blue]Total Tables:[/bold blue] {stats['total_tables']}
[bold blue]Total Rows:[/bold blue] {stats['total_rows']:,}
[bold blue]Active Connections:[/bold blue] {stats['active_connections']}
[bold blue]Active Queries:[/bold blue] {stats['active_queries']}
[bold blue]Idle Connections:[/bold blue] {stats['idle_connections']}
[bold blue]Current Time:[/bold blue] {stats['current_time']}
        """
        
        panel = Panel(
            panel_content.strip(),
            title="📊 Database Statistics",
            border_style="blue",
            padding=(1, 2)
        )
        
        console.print(panel)
    
    def display_table_relationships(self, relationships: Dict[str, List[Dict[str, str]]]) -> None:
        """Display table relationships as a tree"""
        if not relationships:
            console.print("[yellow]No foreign key relationships found[/yellow]")
            return
        
        tree = Tree("🔗 Table Relationships")
        
        for from_table, relations in relationships.items():
            table_node = tree.add(f"[bold blue]{from_table}[/bold blue]")
            
            for relation in relations:
                relation_text = (
                    f"{relation['from_column']} → "
                    f"[green]{relation['to_table']}[/green]."
                    f"[cyan]{relation['to_column']}[/cyan]"
                )
                table_node.add(relation_text)
        
        console.print(tree)
    
    def display_table_details(self, details: Dict[str, Any]) -> None:
        """Display detailed table information"""
        if 'error' in details:
            console.print(f"[red]Error getting table details: {details['error']}[/red]")
            return
        
        console.print(f"\n[bold magenta]Table: {details['table_name']}[/bold magenta]")
        
        # Table size information
        size_info = details['size']
        console.print(f"[blue]Total Size:[/blue] {size_info['total_size']}")
        console.print(f"[blue]Table Size:[/blue] {size_info['table_size']}")
        console.print(f"[blue]Index Size:[/blue] {size_info['index_size']}\n")
        
        # Columns
        if details['columns']:
            columns_table = Table(title="Columns", show_header=True, header_style="bold magenta")
            columns_table.add_column("Name", style="bold blue")
            columns_table.add_column("Type", style="green")
            columns_table.add_column("Nullable", justify="center")
            columns_table.add_column("Default", style="yellow")
            
            for col in details['columns']:
                nullable = "✅" if col['nullable'] else "❌"
                default = col['default'] or "None"
                columns_table.add_row(col['name'], col['type'], nullable, default)
            
            console.print(columns_table)
        
        # Foreign Keys
        if details['foreign_keys']:
            fk_table = Table(title="Foreign Keys", show_header=True, header_style="bold magenta")
            fk_table.add_column("Column", style="bold blue")
            fk_table.add_column("References", style="green")
            fk_table.add_column("Constraint", style="dim")
            
            for fk in details['foreign_keys']:
                references = f"{fk['references_table']}.{fk['references_column']}"
                fk_table.add_row(fk['column'], references, fk['constraint_name'])
            
            console.print(fk_table)
        
        # Indexes
        if details['indexes']:
            indexes_table = Table(title="Indexes", show_header=True, header_style="bold magenta")
            indexes_table.add_column("Name", style="bold blue")
            indexes_table.add_column("Definition", style="green")
            
            for idx in details['indexes']:
                indexes_table.add_row(idx['name'], idx['definition'])
            
            console.print(indexes_table)
    
    def display_health_analysis(self, health_data: List[Dict[str, Any]]) -> None:
        """Display table health analysis"""
        if not health_data:
            console.print("[yellow]No health data available[/yellow]")
            return
        
        table = Table(title="Table Health Analysis", show_header=True, header_style="bold magenta")
        
        table.add_column("Table", style="bold blue")
        table.add_column("Health", justify="center")
        table.add_column("Live Rows", justify="right", style="green")
        table.add_column("Dead %", justify="right", style="red")
        table.add_column("Seq Scans", justify="right", style="yellow")
        table.add_column("Idx Scans", justify="right", style="cyan")
        table.add_column("Issues", style="orange")
        
        for health in health_data:
            issues_text = "; ".join(health['issues'][:2]) if health['issues'] else "None"
            if len(health['issues']) > 2:
                issues_text += "..."
            
            table.add_row(
                health['table_name'],
                health['health_score'],
                f"{health['live_rows']:,}",
                f"{health['dead_percentage']:.1f}%",
                f"{health['sequential_scans']:,}",
                f"{health['index_scans']:,}",
                issues_text
            )
        
        console.print(table)
        
        # Show recommendations for problematic tables
        problematic_tables = [h for h in health_data if h['recommendations']]
        if problematic_tables:
            console.print("\n[bold yellow]Recommendations:[/bold yellow]")
            for health in problematic_tables[:5]:  # Show top 5
                console.print(f"[blue]{health['table_name']}:[/blue] {'; '.join(health['recommendations'])}")
    
    async def export_schema_to_json(self, output_file: str) -> tuple[bool, str]:
        """Export database schema to JSON file"""
        try:
            tables = await self.get_all_tables_with_counts()
            schema_data = {
                'export_timestamp': datetime.utcnow().isoformat(),
                'database_statistics': await self.get_database_statistics(),
                'tables': []
            }
            
            for table_info in tables:
                table_details = await self.get_table_details(table_info['table_name'])
                if 'error' not in table_details:
                    schema_data['tables'].append({
                        'basic_info': table_info,
                        'details': table_details
                    })
            
            with open(output_file, 'w') as f:
                json.dump(schema_data, f, indent=2, default=str)
            
            return True, f"Schema exported to {output_file}"
            
        except Exception as e:
            logger.error(f"Error exporting schema: {e}")
            return False, f"Failed to export schema: {str(e)}"