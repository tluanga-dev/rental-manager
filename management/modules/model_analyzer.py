"""
Model Analyzer Module

Comprehensive SQLAlchemy model analysis system for the rental management system.
Provides deep model scanning, relationship mapping, and change detection capabilities.
"""

import logging
import inspect
import importlib
from typing import Dict, List, Any, Set, Optional, Tuple, Type
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Table, Index
from sqlalchemy.orm import relationship, RelationshipProperty
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy.inspection import inspect as sqlalchemy_inspect
from sqlalchemy.sql.schema import MetaData
from rich.console import Console
from rich.table import Table as RichTable
from rich.tree import Tree
from rich.panel import Panel

# Import from existing rental-manager-api
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "rental-manager-api"))

logger = logging.getLogger(__name__)
console = Console()


class ChangeType(Enum):
    """Types of schema changes detected"""
    TABLE_ADDED = "table_added"
    TABLE_REMOVED = "table_removed"
    TABLE_RENAMED = "table_renamed"
    COLUMN_ADDED = "column_added"
    COLUMN_REMOVED = "column_removed"
    COLUMN_MODIFIED = "column_modified"
    COLUMN_RENAMED = "column_renamed"
    INDEX_ADDED = "index_added"
    INDEX_REMOVED = "index_removed"
    CONSTRAINT_ADDED = "constraint_added"
    CONSTRAINT_REMOVED = "constraint_removed"
    RELATIONSHIP_ADDED = "relationship_added"
    RELATIONSHIP_REMOVED = "relationship_removed"
    RELATIONSHIP_MODIFIED = "relationship_modified"


class ImpactLevel(Enum):
    """Impact levels for schema changes"""
    LOW = "low"           # Non-breaking changes, safe to apply
    MEDIUM = "medium"     # Potentially breaking, needs review
    HIGH = "high"         # Breaking changes, requires data migration
    CRITICAL = "critical" # Dangerous changes, may cause data loss


@dataclass
class ColumnInfo:
    """Information about a database column"""
    name: str
    type_: str
    nullable: bool
    default: Optional[Any] = None
    primary_key: bool = False
    foreign_key: Optional[str] = None
    unique: bool = False
    index: bool = False
    comment: Optional[str] = None


@dataclass
class RelationshipInfo:
    """Information about a SQLAlchemy relationship"""
    name: str
    target_model: str
    relationship_type: str  # one-to-one, one-to-many, many-to-many
    foreign_key: Optional[str] = None
    back_populates: Optional[str] = None
    cascade: List[str] = field(default_factory=list)
    lazy: str = "select"


@dataclass
class ModelInfo:
    """Comprehensive information about a SQLAlchemy model"""
    name: str
    table_name: str
    module: str
    columns: Dict[str, ColumnInfo] = field(default_factory=dict)
    relationships: Dict[str, RelationshipInfo] = field(default_factory=dict)
    indexes: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    inherits_from: Optional[str] = None
    base_classes: List[str] = field(default_factory=list)
    model_class: Optional[Type] = None


@dataclass
class SchemaChange:
    """Represents a detected schema change"""
    change_type: ChangeType
    target: str  # table.column or table name
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    impact_level: ImpactLevel = ImpactLevel.MEDIUM
    description: str = ""
    migration_hint: str = ""
    requires_data_migration: bool = False


@dataclass
class ModelAnalysisReport:
    """Comprehensive model analysis report"""
    models: Dict[str, ModelInfo] = field(default_factory=dict)
    relationships_graph: Dict[str, List[str]] = field(default_factory=dict)
    dependency_order: List[str] = field(default_factory=list)
    circular_dependencies: List[Tuple[str, str]] = field(default_factory=list)
    orphaned_models: List[str] = field(default_factory=list)
    base_model_inconsistencies: List[str] = field(default_factory=list)
    analysis_timestamp: datetime = field(default_factory=datetime.utcnow)
    total_models: int = 0
    total_tables: int = 0
    total_relationships: int = 0


class ModelAnalyzer:
    """Advanced SQLAlchemy model analyzer"""
    
    def __init__(self, models_directory: Path):
        self.models_directory = models_directory
        self.discovered_models: Dict[str, Type] = {}
        self.model_info: Dict[str, ModelInfo] = {}
        self.metadata: Optional[MetaData] = None
    
    def discover_models(self) -> Dict[str, Type]:
        """Discover all SQLAlchemy models in the models directory"""
        console.print("[yellow]🔍 Discovering SQLAlchemy models...[/yellow]")
        
        models = {}
        
        # Scan all Python files in models directory
        for model_file in self.models_directory.glob("*.py"):
            if model_file.name.startswith("__"):
                continue
            
            try:
                # Import the module
                module_name = f"app.models.{model_file.stem}"
                module = importlib.import_module(module_name)
                
                # Find SQLAlchemy models in the module
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if (hasattr(obj, '__tablename__') and 
                        hasattr(obj, '__table__') and
                        name not in ['Base', 'RentalManagerBaseModel']):
                        
                        models[name] = obj
                        logger.info(f"Discovered model: {name} from {module_name}")
                
            except Exception as e:
                logger.error(f"Error importing {model_file}: {e}")
                console.print(f"[red]⚠️ Error importing {model_file.name}: {e}[/red]")
        
        self.discovered_models = models
        console.print(f"[green]✅ Discovered {len(models)} SQLAlchemy models[/green]")
        
        return models
    
    def analyze_model(self, model_class: Type) -> ModelInfo:
        """Analyze a single SQLAlchemy model in detail"""
        model_name = model_class.__name__
        table_name = getattr(model_class, '__tablename__', model_name.lower())
        module_name = model_class.__module__
        
        model_info = ModelInfo(
            name=model_name,
            table_name=table_name,
            module=module_name,
            model_class=model_class
        )
        
        # Analyze base classes
        base_classes = [base.__name__ for base in model_class.__bases__ if base.__name__ != 'object']
        model_info.base_classes = base_classes
        
        if base_classes:
            model_info.inherits_from = base_classes[0]
        
        # Analyze columns
        if hasattr(model_class, '__table__'):
            table = model_class.__table__
            
            for column in table.columns:
                column_info = ColumnInfo(
                    name=column.name,
                    type_=str(column.type),
                    nullable=column.nullable,
                    default=column.default,
                    primary_key=column.primary_key,
                    unique=column.unique,
                    comment=column.comment
                )
                
                # Check for foreign keys
                if column.foreign_keys:
                    fk = list(column.foreign_keys)[0]
                    column_info.foreign_key = str(fk.column)
                
                # Check for indexes
                if column.index:
                    column_info.index = True
                
                model_info.columns[column.name] = column_info
            
            # Analyze indexes
            for index in table.indexes:
                index_desc = f"{index.name}: {[col.name for col in index.columns]}"
                model_info.indexes.append(index_desc)
            
            # Analyze constraints
            for constraint in table.constraints:
                constraint_desc = f"{constraint.__class__.__name__}: {constraint.name}"
                model_info.constraints.append(constraint_desc)
        
        # Analyze relationships
        inspector = sqlalchemy_inspect(model_class)
        
        for relationship_name, relationship_prop in inspector.relationships.items():
            if isinstance(relationship_prop, RelationshipProperty):
                rel_info = self._analyze_relationship(relationship_name, relationship_prop)
                model_info.relationships[relationship_name] = rel_info
        
        return model_info
    
    def _analyze_relationship(self, name: str, relationship_prop: RelationshipProperty) -> RelationshipInfo:
        """Analyze a SQLAlchemy relationship"""
        target_model = relationship_prop.mapper.class_.__name__
        
        # Determine relationship type
        relationship_type = "unknown"
        if relationship_prop.uselist:
            if relationship_prop.secondary is not None:
                relationship_type = "many-to-many"
            else:
                relationship_type = "one-to-many"
        else:
            relationship_type = "one-to-one"
        
        # Extract relationship properties
        foreign_key = None
        if hasattr(relationship_prop, 'local_columns') and relationship_prop.local_columns:
            fk_column = list(relationship_prop.local_columns)[0]
            if fk_column.foreign_keys:
                foreign_key = str(list(fk_column.foreign_keys)[0].column)
        
        back_populates = getattr(relationship_prop, 'back_populates', None)
        cascade = list(relationship_prop.cascade) if relationship_prop.cascade else []
        lazy = str(relationship_prop.lazy) if relationship_prop.lazy else "select"
        
        return RelationshipInfo(
            name=name,
            target_model=target_model,
            relationship_type=relationship_type,
            foreign_key=foreign_key,
            back_populates=back_populates,
            cascade=cascade,
            lazy=lazy
        )
    
    def build_dependency_graph(self) -> Dict[str, List[str]]:
        """Build a dependency graph based on foreign key relationships"""
        dependency_graph = {}
        
        for model_name, model_info in self.model_info.items():
            dependencies = []
            
            # Check foreign key dependencies
            for column_info in model_info.columns.values():
                if column_info.foreign_key:
                    # Extract referenced table name
                    referenced_table = column_info.foreign_key.split('.')[0]
                    
                    # Find model that owns this table
                    for other_model_name, other_model_info in self.model_info.items():
                        if other_model_info.table_name == referenced_table:
                            if other_model_name != model_name:  # Avoid self-references
                                dependencies.append(other_model_name)
                            break
            
            dependency_graph[model_name] = list(set(dependencies))  # Remove duplicates
        
        return dependency_graph
    
    def detect_circular_dependencies(self, dependency_graph: Dict[str, List[str]]) -> List[Tuple[str, str]]:
        """Detect circular dependencies in the model relationships"""
        circular_deps = []
        visited = set()
        rec_stack = set()
        
        def dfs(node: str, path: List[str]) -> bool:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in dependency_graph.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor, path):
                        return True
                elif neighbor in rec_stack:
                    # Found circular dependency
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    for i in range(len(cycle) - 1):
                        circular_deps.append((cycle[i], cycle[i + 1]))
                    return True
            
            rec_stack.remove(node)
            path.pop()
            return False
        
        for model in dependency_graph:
            if model not in visited:
                dfs(model, [])
        
        return list(set(circular_deps))  # Remove duplicates
    
    def calculate_dependency_order(self, dependency_graph: Dict[str, List[str]]) -> List[str]:
        """Calculate the correct order for model operations based on dependencies"""
        # Topological sort using Kahn's algorithm
        in_degree = {node: 0 for node in dependency_graph}
        
        # Calculate in-degrees
        for node in dependency_graph:
            for neighbor in dependency_graph[node]:
                if neighbor in in_degree:
                    in_degree[neighbor] += 1
        
        # Find nodes with no incoming edges
        queue = [node for node, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            node = queue.pop(0)
            result.append(node)
            
            # Reduce in-degree for neighbors
            for neighbor in dependency_graph.get(node, []):
                if neighbor in in_degree:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
        
        return result
    
    def detect_base_model_inconsistencies(self) -> List[str]:
        """Detect inconsistencies in base model usage"""
        inconsistencies = []
        base_models = set()
        
        for model_info in self.model_info.values():
            if model_info.inherits_from:
                base_models.add(model_info.inherits_from)
        
        # Check for mixed base model inheritance
        if len(base_models) > 1:
            inconsistencies.append(f"Multiple base models detected: {', '.join(base_models)}")
        
        # Check for models without base model
        models_without_base = [
            model_info.name for model_info in self.model_info.values()
            if not model_info.inherits_from and 'Base' not in model_info.base_classes
        ]
        
        if models_without_base:
            inconsistencies.append(f"Models without base model: {', '.join(models_without_base)}")
        
        return inconsistencies
    
    def find_orphaned_models(self, dependency_graph: Dict[str, List[str]]) -> List[str]:
        """Find models that are not referenced by any other models"""
        referenced_models = set()
        
        for dependencies in dependency_graph.values():
            referenced_models.update(dependencies)
        
        all_models = set(dependency_graph.keys())
        orphaned = list(all_models - referenced_models)
        
        # Filter out models that are typically standalone (like User, Company)
        standalone_models = {'User', 'Company', 'Category'}  # Root entities
        orphaned = [model for model in orphaned if model not in standalone_models]
        
        return orphaned
    
    async def perform_comprehensive_analysis(self) -> ModelAnalysisReport:
        """Perform comprehensive analysis of all models"""
        console.print("\n[bold blue]🔬 Starting Comprehensive Model Analysis[/bold blue]")
        
        # Step 1: Discover models
        self.discover_models()
        
        # Step 2: Analyze each model
        console.print("[yellow]📊 Analyzing individual models...[/yellow]")
        for model_name, model_class in self.discovered_models.items():
            self.model_info[model_name] = self.analyze_model(model_class)
        
        # Step 3: Build dependency graph
        console.print("[yellow]🕸️ Building dependency graph...[/yellow]")
        dependency_graph = self.build_dependency_graph()
        
        # Step 4: Detect circular dependencies
        console.print("[yellow]🔄 Detecting circular dependencies...[/yellow]")
        circular_deps = self.detect_circular_dependencies(dependency_graph)
        
        # Step 5: Calculate dependency order
        console.print("[yellow]📋 Calculating dependency order...[/yellow]")
        dependency_order = self.calculate_dependency_order(dependency_graph)
        
        # Step 6: Find orphaned models
        console.print("[yellow]🕵️ Finding orphaned models...[/yellow]")
        orphaned_models = self.find_orphaned_models(dependency_graph)
        
        # Step 7: Check base model consistency
        console.print("[yellow]🏗️ Checking base model consistency...[/yellow]")
        base_inconsistencies = self.detect_base_model_inconsistencies()
        
        # Calculate statistics
        total_relationships = sum(len(model.relationships) for model in self.model_info.values())
        unique_tables = set(model.table_name for model in self.model_info.values())
        
        # Create comprehensive report
        report = ModelAnalysisReport(
            models=self.model_info,
            relationships_graph=dependency_graph,
            dependency_order=dependency_order,
            circular_dependencies=circular_deps,
            orphaned_models=orphaned_models,
            base_model_inconsistencies=base_inconsistencies,
            total_models=len(self.model_info),
            total_tables=len(unique_tables),
            total_relationships=total_relationships
        )
        
        console.print("[green]✅ Model analysis complete![/green]")
        return report
    
    def display_analysis_summary(self, report: ModelAnalysisReport) -> None:
        """Display a comprehensive analysis summary"""
        # Create summary panel
        summary_content = f"""
[bold blue]Total Models:[/bold blue] {report.total_models}
[bold blue]Total Tables:[/bold blue] {report.total_tables}
[bold blue]Total Relationships:[/bold blue] {report.total_relationships}
[bold blue]Circular Dependencies:[/bold blue] {len(report.circular_dependencies)}
[bold blue]Orphaned Models:[/bold blue] {len(report.orphaned_models)}
[bold blue]Base Model Issues:[/bold blue] {len(report.base_model_inconsistencies)}
[bold blue]Analysis Time:[/bold blue] {report.analysis_timestamp.strftime('%Y-%m-%d %H:%M:%S')}
        """
        
        summary_panel = Panel(
            summary_content.strip(),
            title="📊 Model Analysis Summary",
            border_style="blue",
            padding=(1, 2)
        )
        console.print(summary_panel)
        
        # Display issues if any
        if report.circular_dependencies:
            console.print("\n[bold red]⚠️ Circular Dependencies Detected:[/bold red]")
            for dep1, dep2 in report.circular_dependencies:
                console.print(f"  • {dep1} ↔ {dep2}")
        
        if report.orphaned_models:
            console.print("\n[bold yellow]🕵️ Orphaned Models:[/bold yellow]")
            for model in report.orphaned_models:
                console.print(f"  • {model}")
        
        if report.base_model_inconsistencies:
            console.print("\n[bold orange]🏗️ Base Model Issues:[/bold orange]")
            for issue in report.base_model_inconsistencies:
                console.print(f"  • {issue}")
    
    def display_dependency_graph(self, report: ModelAnalysisReport) -> None:
        """Display the model dependency graph as a tree"""
        if not report.relationships_graph:
            console.print("[yellow]No dependencies found[/yellow]")
            return
        
        tree = Tree("🕸️ Model Dependencies")
        
        # Group by dependency level
        processed = set()
        
        def add_dependencies(model_name: str, parent_node, depth: int = 0):
            if depth > 3 or model_name in processed:  # Prevent infinite recursion
                return
            
            processed.add(model_name)
            dependencies = report.relationships_graph.get(model_name, [])
            
            if dependencies:
                model_node = parent_node.add(f"[bold blue]{model_name}[/bold blue]")
                for dep in dependencies:
                    dep_node = model_node.add(f"[green]{dep}[/green]")
                    add_dependencies(dep, dep_node, depth + 1)
            else:
                parent_node.add(f"[cyan]{model_name}[/cyan] (no dependencies)")
        
        # Start with models that have no incoming dependencies
        root_models = [model for model in report.dependency_order[:5]]  # Show first 5
        
        for model in root_models:
            add_dependencies(model, tree)
        
        console.print(tree)
    
    def display_model_details(self, model_name: str, report: ModelAnalysisReport) -> None:
        """Display detailed information about a specific model"""
        if model_name not in report.models:
            console.print(f"[red]Model '{model_name}' not found[/red]")
            return
        
        model_info = report.models[model_name]
        
        # Model overview
        overview_content = f"""
[bold blue]Model Name:[/bold blue] {model_info.name}
[bold blue]Table Name:[/bold blue] {model_info.table_name}
[bold blue]Module:[/bold blue] {model_info.module}
[bold blue]Base Classes:[/bold blue] {', '.join(model_info.base_classes)}
[bold blue]Columns:[/bold blue] {len(model_info.columns)}
[bold blue]Relationships:[/bold blue] {len(model_info.relationships)}
        """
        
        panel = Panel(
            overview_content.strip(),
            title=f"📋 Model Details: {model_name}",
            border_style="blue",
            padding=(1, 2)
        )
        console.print(panel)
        
        # Columns table
        if model_info.columns:
            columns_table = RichTable(title="Columns", show_header=True, header_style="bold magenta")
            columns_table.add_column("Name", style="bold blue")
            columns_table.add_column("Type", style="green")
            columns_table.add_column("Nullable", justify="center")
            columns_table.add_column("Default", style="yellow")
            columns_table.add_column("Constraints", style="cyan")
            
            for col_name, col_info in model_info.columns.items():
                constraints = []
                if col_info.primary_key:
                    constraints.append("PK")
                if col_info.foreign_key:
                    constraints.append(f"FK→{col_info.foreign_key}")
                if col_info.unique:
                    constraints.append("UNIQUE")
                if col_info.index:
                    constraints.append("INDEX")
                
                columns_table.add_row(
                    col_name,
                    col_info.type_,
                    "✅" if col_info.nullable else "❌",
                    str(col_info.default) if col_info.default else "None",
                    ", ".join(constraints) or "None"
                )
            
            console.print(columns_table)
        
        # Relationships table
        if model_info.relationships:
            rel_table = RichTable(title="Relationships", show_header=True, header_style="bold magenta")
            rel_table.add_column("Name", style="bold blue")
            rel_table.add_column("Target Model", style="green")
            rel_table.add_column("Type", style="yellow")
            rel_table.add_column("Foreign Key", style="cyan")
            rel_table.add_column("Back Populates", style="dim")
            
            for rel_name, rel_info in model_info.relationships.items():
                rel_table.add_row(
                    rel_name,
                    rel_info.target_model,
                    rel_info.relationship_type,
                    rel_info.foreign_key or "None",
                    rel_info.back_populates or "None"
                )
            
            console.print(rel_table)