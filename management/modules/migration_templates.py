"""
Migration Templates Module

Provides pre-built migration templates for common complex scenarios
in the rental management system.
"""

from typing import Dict, Any, List
from datetime import datetime


class MigrationTemplates:
    """Collection of migration templates for complex scenarios"""
    
    @staticmethod
    def get_available_templates() -> Dict[str, str]:
        """Get available migration templates"""
        return {
            "add_table_with_fk": "Add new table with foreign key relationships",
            "add_column_with_default": "Add column with default value and update existing records", 
            "rename_column": "Safely rename a column with data preservation",
            "change_column_type": "Change column type with data conversion",
            "add_index_concurrent": "Add index without blocking operations",
            "create_junction_table": "Create many-to-many relationship table",
            "split_table": "Split one table into multiple tables",
            "merge_tables": "Merge multiple tables into one",
            "add_enum_column": "Add column with enum/check constraints",
            "migrate_json_to_columns": "Extract JSON fields to separate columns"
        }
    
    @staticmethod
    def add_table_with_fk(table_name: str, referenced_table: str, columns: List[Dict[str, Any]]) -> str:
        """Template for adding a new table with foreign key"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Generate columns definition
        columns_def = []
        for col in columns:
            col_line = f"    sa.Column('{col['name']}', sa.{col['type']}"
            if not col.get('nullable', True):
                col_line += ", nullable=False"
            if col.get('primary_key', False):
                col_line += ", primary_key=True"
            if col.get('default'):
                col_line += f", default={col['default']}"
            col_line += "),"
            columns_def.append(col_line)
        
        # Add foreign key column
        fk_column = f"    sa.Column('{referenced_table.lower()}_id', sa.Integer(), sa.ForeignKey('{referenced_table.lower()}.id'), nullable=False),"
        columns_def.append(fk_column)
        
        columns_str = "\n".join(columns_def)
        
        return f'''"""Add {table_name} table with foreign key to {referenced_table}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create {table_name} table
    op.create_table(
        '{table_name.lower()}',
{columns_str}
    )
    
    # Create indexes for better performance
    op.create_index(
        'ix_{table_name.lower()}_{referenced_table.lower()}_id',
        '{table_name.lower()}',
        ['{referenced_table.lower()}_id']
    )

def downgrade():
    # Drop indexes first
    op.drop_index('ix_{table_name.lower()}_{referenced_table.lower()}_id', table_name='{table_name.lower()}')
    
    # Drop table
    op.drop_table('{table_name.lower()}')
'''
    
    @staticmethod
    def add_column_with_default(table_name: str, column_name: str, column_type: str, default_value: Any) -> str:
        """Template for adding column with default value"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Format default value based on type
        if isinstance(default_value, str):
            formatted_default = f"'{default_value}'"
        else:
            formatted_default = str(default_value)
        
        return f'''"""Add {column_name} column to {table_name} with default value

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add column with default value
    op.add_column(
        '{table_name}',
        sa.Column('{column_name}', sa.{column_type}(), nullable=False, server_default=sa.text({formatted_default}))
    )
    
    # Remove server default after adding (optional)
    # op.alter_column('{table_name}', '{column_name}', server_default=None)

def downgrade():
    # Drop the column
    op.drop_column('{table_name}', '{column_name}')
'''
    
    @staticmethod
    def rename_column_safe(table_name: str, old_name: str, new_name: str, column_type: str) -> str:
        """Template for safely renaming a column"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        return f'''"""Safely rename column {old_name} to {new_name} in {table_name}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Step 1: Add new column
    op.add_column('{table_name}', sa.Column('{new_name}', sa.{column_type}(), nullable=True))
    
    # Step 2: Copy data from old column to new column
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE {table_name} SET {new_name} = {old_name}")
    )
    
    # Step 3: Make new column non-nullable if needed
    op.alter_column('{table_name}', '{new_name}', nullable=False)
    
    # Step 4: Drop old column
    op.drop_column('{table_name}', '{old_name}')

def downgrade():
    # Reverse process: add old column, copy data, drop new column
    op.add_column('{table_name}', sa.Column('{old_name}', sa.{column_type}(), nullable=True))
    
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE {table_name} SET {old_name} = {new_name}")
    )
    
    op.alter_column('{table_name}', '{old_name}', nullable=False)
    op.drop_column('{table_name}', '{new_name}')
'''
    
    @staticmethod
    def change_column_type(table_name: str, column_name: str, old_type: str, new_type: str, conversion_sql: str = None) -> str:
        """Template for changing column type with data conversion"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Default conversion if not provided
        if not conversion_sql:
            conversion_sql = f"{column_name}::{new_type}"
        
        return f'''"""Change {column_name} type from {old_type} to {new_type} in {table_name}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # PostgreSQL approach: Create new column, copy with conversion, swap
    
    # Step 1: Add temporary column with new type
    op.add_column('{table_name}', sa.Column('{column_name}_temp', sa.{new_type}(), nullable=True))
    
    # Step 2: Copy data with type conversion
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE {table_name} SET {column_name}_temp = {conversion_sql}")
    )
    
    # Step 3: Drop old column
    op.drop_column('{table_name}', '{column_name}')
    
    # Step 4: Rename temp column
    op.alter_column('{table_name}', '{column_name}_temp', new_column_name='{column_name}')

def downgrade():
    # Reverse the type change
    op.add_column('{table_name}', sa.Column('{column_name}_temp', sa.{old_type}(), nullable=True))
    
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE {table_name} SET {column_name}_temp = {column_name}::{old_type}")
    )
    
    op.drop_column('{table_name}', '{column_name}')
    op.alter_column('{table_name}', '{column_name}_temp', new_column_name='{column_name}')
'''
    
    @staticmethod
    def add_index_concurrent(table_name: str, index_name: str, columns: List[str], unique: bool = False) -> str:
        """Template for adding index without blocking operations"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        columns_str = ", ".join([f"'{col}'" for col in columns])
        unique_str = ", unique=True" if unique else ""
        
        return f'''"""Add concurrent index {index_name} on {table_name}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create index concurrently to avoid locking table
    op.create_index(
        '{index_name}',
        '{table_name}',
        [{columns_str}]{unique_str},
        postgresql_concurrently=True
    )

def downgrade():
    # Drop index
    op.drop_index('{index_name}', table_name='{table_name}')
'''
    
    @staticmethod
    def create_junction_table(table1: str, table2: str, additional_columns: List[Dict[str, Any]] = None) -> str:
        """Template for creating many-to-many junction table"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        junction_name = f"{table1}_{table2}"
        
        # Add additional columns if provided
        additional_cols = ""
        if additional_columns:
            for col in additional_columns:
                col_line = f"        sa.Column('{col['name']}', sa.{col['type']}"
                if not col.get('nullable', True):
                    col_line += ", nullable=False"
                if col.get('default'):
                    col_line += f", default={col['default']}"
                col_line += "),"
                additional_cols += "\n" + col_line
        
        return f'''"""Create junction table for {table1} and {table2} many-to-many relationship

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create junction table
    op.create_table(
        '{junction_name}',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('{table1}_id', sa.Integer(), sa.ForeignKey('{table1}.id', ondelete='CASCADE'), nullable=False),
        sa.Column('{table2}_id', sa.Integer(), sa.ForeignKey('{table2}.id', ondelete='CASCADE'), nullable=False),{additional_cols}
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    )
    
    # Create indexes for performance
    op.create_index('ix_{junction_name}_{table1}_id', '{junction_name}', ['{table1}_id'])
    op.create_index('ix_{junction_name}_{table2}_id', '{junction_name}', ['{table2}_id'])
    
    # Create unique constraint to prevent duplicates
    op.create_unique_constraint(
        'uq_{junction_name}_{table1}_{table2}',
        '{junction_name}',
        ['{table1}_id', '{table2}_id']
    )

def downgrade():
    # Drop constraints and indexes first
    op.drop_constraint('uq_{junction_name}_{table1}_{table2}', '{junction_name}', type_='unique')
    op.drop_index('ix_{junction_name}_{table2}_id', table_name='{junction_name}')
    op.drop_index('ix_{junction_name}_{table1}_id', table_name='{junction_name}')
    
    # Drop junction table
    op.drop_table('{junction_name}')
'''
    
    @staticmethod
    def add_enum_column(table_name: str, column_name: str, enum_name: str, enum_values: List[str], default_value: str = None) -> str:
        """Template for adding enum column with check constraints"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        values_str = ", ".join([f"'{val}'" for val in enum_values])
        default_clause = f", server_default='{default_value}'" if default_value else ""
        
        return f'''"""Add {column_name} enum column to {table_name}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # For PostgreSQL: Create enum type first
    op.execute("CREATE TYPE {enum_name} AS ENUM ({values_str})")
    
    # Add column with enum type
    op.add_column(
        '{table_name}',
        sa.Column('{column_name}', sa.Enum(*{enum_values}, name='{enum_name}'), nullable=False{default_clause})
    )
    
    # Alternative for non-PostgreSQL databases: Use check constraint
    # op.add_column('{table_name}', sa.Column('{column_name}', sa.String(50), nullable=False{default_clause}))
    # op.create_check_constraint(
    #     'ck_{table_name}_{column_name}',
    #     '{table_name}',
    #     sa.text('{column_name} IN ({values_str})')
    # )

def downgrade():
    # Drop column
    op.drop_column('{table_name}', '{column_name}')
    
    # Drop enum type
    op.execute("DROP TYPE {enum_name}")
    
    # Alternative for check constraint:
    # op.drop_constraint('ck_{table_name}_{column_name}', '{table_name}', type_='check')
    # op.drop_column('{table_name}', '{column_name}')
'''
    
    @staticmethod
    def migrate_json_to_columns(table_name: str, json_column: str, new_columns: Dict[str, str]) -> str:
        """Template for extracting JSON fields to separate columns"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Generate new columns
        columns_def = []
        for col_name, col_type in new_columns.items():
            columns_def.append(f"    op.add_column('{table_name}', sa.Column('{col_name}', sa.{col_type}(), nullable=True))")
        
        columns_str = "\n".join(columns_def)
        
        # Generate data migration SQL
        update_statements = []
        for col_name in new_columns.keys():
            update_statements.append(f"        UPDATE {table_name} SET {col_name} = ({json_column}->>{repr(col_name)})::text WHERE {json_column} IS NOT NULL;")
        
        updates_str = "\n".join(update_statements)
        
        return f'''"""Extract JSON fields from {json_column} to separate columns in {table_name}

Revision ID: {timestamp}
Revises: 
Create Date: {datetime.utcnow()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{timestamp}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns
{columns_str}
    
    # Migrate data from JSON to new columns
    connection = op.get_bind()
    
    # Extract JSON fields to separate columns
    connection.execute(sa.text(\"\"\"
{updates_str}
    \"\"\"))
    
    # Optional: Drop the JSON column after migration
    # op.drop_column('{table_name}', '{json_column}')

def downgrade():
    # Reverse migration: recreate JSON column and populate from separate columns
    # op.add_column('{table_name}', sa.Column('{json_column}', sa.JSON(), nullable=True))
    
    # Rebuild JSON from separate columns (simplified example)
    # connection = op.get_bind()
    # connection.execute(sa.text(\"\"\"
    #     UPDATE {table_name} 
    #     SET {json_column} = json_build_object(
    #         {", ".join([f"'{col}', {col}" for col in new_columns.keys()])}
    #     )
    #     WHERE {" AND ".join([f"{col} IS NOT NULL" for col in new_columns.keys()])}
    # \"\"\"))
    
    # Drop the extracted columns
{chr(10).join([f"    op.drop_column('{table_name}', '{col_name}')" for col_name in new_columns.keys()])}
'''
    
    @classmethod
    def generate_template(cls, template_name: str, **kwargs) -> str:
        """Generate a migration template by name with parameters"""
        templates = {
            "add_table_with_fk": cls.add_table_with_fk,
            "add_column_with_default": cls.add_column_with_default,
            "rename_column": cls.rename_column_safe,
            "change_column_type": cls.change_column_type,
            "add_index_concurrent": cls.add_index_concurrent,
            "create_junction_table": cls.create_junction_table,
            "add_enum_column": cls.add_enum_column,
            "migrate_json_to_columns": cls.migrate_json_to_columns
        }
        
        if template_name not in templates:
            raise ValueError(f"Unknown template: {template_name}")
        
        return templates[template_name](**kwargs)
    
    @staticmethod
    def get_template_parameters(template_name: str) -> Dict[str, Any]:
        """Get required parameters for a template"""
        parameters = {
            "add_table_with_fk": {
                "table_name": "Name of the new table",
                "referenced_table": "Table being referenced by foreign key",
                "columns": "List of column definitions (name, type, nullable, etc.)"
            },
            "add_column_with_default": {
                "table_name": "Table to add column to",
                "column_name": "Name of new column",
                "column_type": "SQLAlchemy column type",
                "default_value": "Default value for existing rows"
            },
            "rename_column": {
                "table_name": "Table containing the column",
                "old_name": "Current column name",
                "new_name": "New column name",
                "column_type": "Column type"
            },
            "change_column_type": {
                "table_name": "Table containing the column",
                "column_name": "Column to modify",
                "old_type": "Current column type",
                "new_type": "New column type",
                "conversion_sql": "Optional SQL for data conversion"
            },
            "add_index_concurrent": {
                "table_name": "Table to index",
                "index_name": "Name of the index",
                "columns": "List of columns to index",
                "unique": "Whether index should be unique (default: False)"
            },
            "create_junction_table": {
                "table1": "First table in relationship",
                "table2": "Second table in relationship",
                "additional_columns": "Optional additional columns"
            },
            "add_enum_column": {
                "table_name": "Table to add column to",
                "column_name": "Name of enum column",
                "enum_name": "Name of enum type",
                "enum_values": "List of enum values",
                "default_value": "Optional default value"
            },
            "migrate_json_to_columns": {
                "table_name": "Table with JSON column",
                "json_column": "Name of JSON column",
                "new_columns": "Dict of new column names and types"
            }
        }
        
        return parameters.get(template_name, {})