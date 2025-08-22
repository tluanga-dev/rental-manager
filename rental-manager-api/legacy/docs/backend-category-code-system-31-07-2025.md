# Category Code System - Backend Developer Documentation

**Document Version:** 1.0  
**Created:** 31-07-2025  
**Last Updated:** 31-07-2025  
**Author:** System Development Team  

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Core Components](#core-components)
4. [API Endpoints](#api-endpoints)
5. [Code Generation Algorithm](#code-generation-algorithm)
6. [Implementation Details](#implementation-details)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)

## Overview

The Category Code System provides automatic generation and management of unique, hierarchical category codes for the rental management system. This system supports construction, catering, and event management equipment categories with intelligent code generation following business-specific patterns.

### Key Features

- **Automatic Code Generation**: Generates unique codes from category names
- **Hierarchical Structure**: Supports up to 3+ levels with parent-child relationships
- **10-Character Limit**: All codes respect maximum length constraints
- **Uniqueness Guarantee**: Database-level uniqueness with conflict resolution
- **Format Validation**: Strict format rules (A-Z, 0-9, dashes only)
- **Rental Industry Focus**: Optimized for construction, catering, and event equipment

### Code Patterns

```
Level 1 (Root):     CON, CAT, EVT, PWR, CLN
Level 2 (Sub):      CON-EXC, CAT-COOK, EVT-AUD
Level 3 (Leaf):     CON-EXC-MIN, CAT-COOK-OV
```

## Database Schema

### Migration Details

**Migration File:** `f3c3cfc9d034_add_category_code_field_to_categories_.py`

```sql
-- Add category_code column
ALTER TABLE categories 
ADD COLUMN category_code VARCHAR(10) NOT NULL;

-- Create unique index
CREATE UNIQUE INDEX ix_categories_category_code 
ON categories (category_code);
```

### Table Structure

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category_code VARCHAR(10) NOT NULL UNIQUE,
    parent_category_id UUID REFERENCES categories(id),
    category_path VARCHAR(500) NOT NULL,
    category_level INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_leaf BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);
```

### Indexes

```sql
-- Primary indexes
CREATE UNIQUE INDEX ix_categories_category_code ON categories (category_code);
CREATE INDEX idx_category_parent ON categories (parent_category_id);
CREATE INDEX idx_category_path ON categories (category_path);
CREATE INDEX idx_category_level ON categories (category_level);

-- Composite indexes
CREATE UNIQUE INDEX uk_category_name_parent ON categories (name, parent_category_id);
CREATE INDEX idx_category_active_leaf ON categories (is_active, is_leaf);
```

## Core Components

### 1. Category Model (`app/modules/master_data/categories/models.py`)

```python
class Category(BaseModel):
    __tablename__ = "categories"
    
    name = Column(String(100), nullable=False)
    category_code = Column(String(10), nullable=False, unique=True, index=True)
    parent_category_id = Column(UUIDType(), ForeignKey("categories.id"), nullable=True)
    category_path = Column(String(500), nullable=False, index=True)
    category_level = Column(Integer, nullable=False, default=1)
    display_order = Column(Integer, nullable=False, default=0)
    is_leaf = Column(Boolean, nullable=False, default=True)
    
    def __init__(self, name: str, category_code: str, parent_category_id: Optional[UUID] = None, **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.category_code = category_code
        self.parent_category_id = parent_category_id
        # ... other fields
        self._validate()
```

**Key Validation Rules:**
- `category_code`: Required, max 10 chars, uppercase alphanumeric + dashes
- `name`: Required, max 100 chars
- Format: `^[A-Z0-9\-]+$` (no leading/trailing dashes, no consecutive dashes)

### 2. Code Generator Service (`app/shared/utils/category_code_generator.py`)

```python
class CategoryCodeGenerator:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def generate_category_code(
        self, 
        category_name: str, 
        parent_category_id: Optional[str] = None,
        category_level: int = 1,
        exclude_id: Optional[str] = None
    ) -> str:
        """Generate unique category code following hierarchical patterns."""
        # Implementation details below...
```

**Algorithm Features:**
- **Smart Abbreviation**: Extracts meaningful abbreviations from category names
- **Uniqueness Check**: Database validation with conflict resolution
- **Length Management**: Ensures codes fit within 10-character limit
- **Hierarchical Logic**: Incorporates parent codes for child categories

### 3. Pydantic Schemas (`app/modules/master_data/categories/schemas.py`)

```python
class CategoryCreate(CategoryBase):
    category_code: Optional[str] = Field(None, max_length=10, description="Auto-generated if not provided")
    
    @field_validator('category_code')
    @classmethod
    def validate_category_code(cls, v):
        if v is not None:
            v = v.strip().upper()
            if not re.match(r'^[A-Z0-9\-]+$', v):
                raise ValueError('Invalid category code format')
        return v

class CategoryResponse(CategoryBase):
    id: UUID
    category_code: str  # Required in response
    category_path: str
    category_level: int
    is_leaf: bool
    # ... other fields
```

### 4. Repository Layer (`app/modules/master_data/categories/repository.py`)

```python
class CategoryRepository(BaseRepository[Category]):
    async def create(self, obj_data: Dict[str, Any]) -> Category:
        """Create category with proper category_code handling."""
        if 'category_code' not in obj_data:
            raise ValueError("category_code is required")
        
        db_obj = Category(
            name=obj_data['name'],
            category_code=obj_data['category_code'],
            parent_category_id=obj_data.get('parent_category_id'),
            category_path=obj_data.get('category_path'),
            category_level=obj_data.get('category_level', 1),
            # ... other fields
        )
        
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj
```

### 5. Service Layer (`app/modules/master_data/categories/service.py`)

```python
class CategoryService:
    async def create_category(self, category_data: CategoryCreate, created_by: Optional[str] = None) -> CategoryResponse:
        """Create category with auto-generated code if needed."""
        
        # Generate category code if not provided
        category_code = category_data.category_code
        if not category_code:
            code_generator = CategoryCodeGenerator(self.repository.session)
            category_code = await code_generator.generate_category_code(
                category_name=category_data.name,
                parent_category_id=str(category_data.parent_category_id) if category_data.parent_category_id else None,
                category_level=category_level
            )
        else:
            # Validate provided code
            code_generator = CategoryCodeGenerator(self.repository.session)
            is_valid, error_message = await code_generator.validate_category_code(category_code)
            if not is_valid:
                raise ValidationError(error_message)
        
        # Create with generated/validated code
        create_data = category_data.model_dump()
        create_data.update({
            "category_code": category_code,
            "category_level": category_level,
            "category_path": category_path,
            "created_by": created_by
        })
        
        category = await self.repository.create(create_data)
        return await self._to_response(category)
```

## API Endpoints

### Create Category

**Endpoint:** `POST /api/master-data/categories/`

**Request Body:**
```json
{
  "name": "Construction Equipment",
  "parent_category_id": null,
  "display_order": 1,
  "category_code": "CON"  // Optional - auto-generated if not provided
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "name": "Construction Equipment",
  "category_code": "CON",
  "parent_category_id": null,
  "category_path": "Construction Equipment",
  "category_level": 1,
  "display_order": 1,
  "is_leaf": false,
  "is_active": true,
  "created_at": "2025-07-31T10:00:00Z",
  "child_count": 5,
  "item_count": 0
}
```

### Get Category

**Endpoint:** `GET /api/master-data/categories/{category_id}`

**Response:** Same as create response

### Update Category

**Endpoint:** `PUT /api/master-data/categories/{category_id}`

**Request Body:**
```json
{
  "name": "Updated Name",
  "category_code": "NEW-CODE",  // Optional
  "display_order": 2
}
```

### List Categories

**Endpoint:** `GET /api/master-data/categories/`

**Query Parameters:**
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 20)
- `parent_id`: Filter by parent category
- `level`: Filter by category level
- `search`: Search by name or code

## Code Generation Algorithm

### Level-Based Generation Rules

```python
def generate_category_code(category_name, parent_code=None, level=1):
    if level == 1:  # Root categories
        max_length = 4
        return generate_abbreviation(category_name, max_length)
    
    elif level == 2:  # Second level
        parent_prefix = f"{parent_code}-"
        remaining_length = 10 - len(parent_prefix)
        abbrev = generate_abbreviation(category_name, min(4, remaining_length))
        return f"{parent_prefix}{abbrev}"
    
    elif level >= 3:  # Third level and beyond
        parent_prefix = f"{parent_code}-"
        remaining_length = 10 - len(parent_prefix)
        abbrev = generate_abbreviation(category_name, max(2, min(3, remaining_length)))
        return f"{parent_prefix}{abbrev}"
```

### Abbreviation Generation Strategy

1. **Multiple Words**: Take first letter of each word
   - "Construction Equipment" → "CE"
   - "Audio Visual Equipment" → "AVE"

2. **Single Word**: Use consonants first, then vowels
   - "Excavators" → "XCVT" → "EXC" (trimmed to fit)
   - "Lighting" → "LGHT" → "LGT"

3. **Conflict Resolution**: Append numbers for uniqueness
   - "CON" → "CON" (if available)
   - "CON" → "C1" (if CON exists)
   - "CON" → "C2" (if CON and C1 exist)

### Example Generation Flow

```
Input: "Commercial Ovens" (parent: "CAT-COOK", level: 3)

Step 1: Calculate available space
- Parent code: "CAT-COOK"
- Base: "CAT-COOK-"
- Remaining: 10 - 9 = 1 character (not enough!)

Step 2: Optimize parent code usage
- Try abbreviated base or use numbers
- Result: "CAT-CK-OV" or similar pattern

Step 3: Uniqueness check
- Query database for existing codes
- Append number if needed: "CAT-CK-O1"
```

## Implementation Details

### Database Constraints

```sql
-- Ensure category_code uniqueness
CONSTRAINT uk_category_code UNIQUE (category_code)

-- Ensure name uniqueness within parent
CONSTRAINT uk_category_name_parent UNIQUE (name, parent_category_id)

-- Format validation (handled in application layer)
```

### Validation Rules

**Category Code Format:**
- Length: 1-10 characters
- Characters: A-Z, 0-9, hyphens (-)
- Pattern: `^[A-Z0-9\-]+$`
- No leading/trailing hyphens
- No consecutive hyphens

**Business Rules:**
- Root categories (level 1): No parent required
- Sub categories (level 2+): Parent required
- Codes must be unique across all categories
- Names must be unique within same parent

### Performance Considerations

**Indexes:**
- `category_code` has unique index for fast lookups
- Composite index on `(name, parent_category_id)` for duplicate checking
- `category_level` indexed for level-based queries

**Query Optimization:**
```python
# Fast parent code lookup
parent_code = await session.scalar(
    select(Category.category_code)
    .where(Category.id == parent_id)
)

# Efficient uniqueness check
exists = await session.scalar(
    select(func.count())
    .select_from(Category)
    .where(Category.category_code == proposed_code)
) > 0
```

## Error Handling

### Common Error Scenarios

**1. Code Too Long**
```json
{
  "detail": [{
    "type": "string_too_long",
    "loc": ["body", "category_code"],
    "msg": "String should have at most 10 characters",
    "input": "VERY-LONG-CODE"
  }]
}
```

**2. Invalid Format**
```json
{
  "detail": "Category code must contain only uppercase letters, numbers, and dashes"
}
```

**3. Duplicate Code**
```json
{
  "detail": "Category code 'CON' already exists"
}
```

**4. Parent Not Found**
```json
{
  "detail": "Parent category with id {uuid} not found"
}
```

### Error Handling in Code

```python
try:
    category_code = await code_generator.generate_category_code(
        category_name=category_data.name,
        parent_category_id=parent_id,
        category_level=level
    )
except ValueError as e:
    raise ValidationError(str(e))
except Exception as e:
    logger.error(f"Code generation failed: {e}")
    raise BusinessRuleError("Unable to generate category code")
```

## Testing

### Unit Tests

**Test File:** `tests/test_category_code_generator.py`

```python
@pytest.mark.asyncio
async def test_generate_root_category_code():
    generator = CategoryCodeGenerator(mock_session)
    code = await generator.generate_category_code("Construction Equipment", level=1)
    assert code == "CE"
    assert len(code) <= 10

@pytest.mark.asyncio
async def test_generate_subcategory_code():
    generator = CategoryCodeGenerator(mock_session)
    code = await generator.generate_category_code(
        "Excavators", 
        parent_category_id="parent-uuid",
        level=2
    )
    assert code.startswith("CON-")
    assert len(code) <= 10
```

### Integration Tests

**Test File:** `tests/test_category_api.py`

```python
async def test_create_category_with_auto_code(client):
    response = await client.post("/api/master-data/categories/", json={
        "name": "Test Category",
        "display_order": 1
    })
    assert response.status_code == 201
    data = response.json()
    assert "category_code" in data
    assert len(data["category_code"]) <= 10
```

### Test Data

```python
# Test category hierarchy
test_categories = [
    {"name": "Construction Equipment", "expected_code": "CE", "level": 1},
    {"name": "Excavators", "parent": "CE", "expected_pattern": "CE-*", "level": 2},
    {"name": "Mini Excavators", "parent": "CE-EXC", "expected_pattern": "CE-EXC-*", "level": 3}
]
```

## Migration Guide

### Pre-Migration Checklist

1. **Backup Database**: Full backup before migration
2. **Test Environment**: Run migration on staging first  
3. **Dependency Check**: Ensure all dependent services are compatible
4. **Rollback Plan**: Prepare rollback migration if needed

### Migration Steps

```bash
# 1. Run migration
source venv/bin/activate
alembic upgrade head

# 2. Verify schema changes
psql -c "\\d categories"

# 3. Clear existing data if needed (development only)
python clear_data_simple.py

# 4. Reload categories with codes
python load_categories_comprehensive.py

# 5. Verify data integrity
python verify_category_codes.py
```

### Post-Migration Validation

```python
# Validate all categories have codes
categories_without_codes = await session.execute(
    select(Category).where(Category.category_code.is_(None))
)
assert categories_without_codes.scalars().first() is None

# Validate code uniqueness
duplicate_codes = await session.execute(
    select(Category.category_code, func.count())
    .group_by(Category.category_code)
    .having(func.count() > 1)
)
assert duplicate_codes.scalars().first() is None
```

### Rollback Process

If rollback is needed:

```sql
-- Remove category_code column
ALTER TABLE categories DROP COLUMN category_code;

-- Drop related indexes
DROP INDEX IF EXISTS ix_categories_category_code;
```

## Best Practices

### Code Generation

1. **Always Use Service Layer**: Never create categories directly through repository
2. **Validate Input**: Always validate category names before code generation
3. **Handle Conflicts**: Implement proper conflict resolution strategies
4. **Log Generation**: Log all code generation for debugging

```python
# Good practice
category = await category_service.create_category(
    CategoryCreate(name="New Category"),
    created_by=current_user.username
)

# Avoid direct repository usage
# category = await repository.create({...})  # Don't do this
```

### Performance

1. **Batch Operations**: Use transactions for multiple category creation
2. **Cache Parent Codes**: Cache frequently accessed parent codes
3. **Limit Deep Nesting**: Avoid categories deeper than 3-4 levels
4. **Index Usage**: Ensure queries use appropriate indexes

### Error Handling

1. **Graceful Degradation**: Provide meaningful error messages
2. **Retry Logic**: Implement retry for transient failures
3. **Audit Trail**: Log all category creation attempts
4. **User Feedback**: Return actionable error messages to frontend

### Security

1. **Input Sanitization**: Validate all input thoroughly
2. **SQL Injection**: Use parameterized queries (handled by SQLAlchemy)
3. **Authorization**: Check user permissions before category operations
4. **Audit Logging**: Log all category modifications with user context

### Monitoring

1. **Code Generation Metrics**: Monitor generation success/failure rates
2. **Performance Metrics**: Track code generation latency
3. **Uniqueness Violations**: Alert on constraint violations
4. **Usage Patterns**: Monitor category creation patterns

```python
# Example monitoring
import logging

logger = logging.getLogger(__name__)

async def create_category_with_monitoring(category_data):
    start_time = time.time()
    try:
        result = await category_service.create_category(category_data)
        duration = time.time() - start_time
        logger.info(f"Category created successfully in {duration:.2f}s", 
                   extra={"category_code": result.category_code})
        return result
    except Exception as e:
        logger.error(f"Category creation failed: {e}", 
                    extra={"category_name": category_data.name})
        raise
```

---

## Appendix

### File Structure

```
app/
├── modules/master_data/categories/
│   ├── models.py              # Category model with category_code
│   ├── schemas.py             # Pydantic schemas
│   ├── repository.py          # Data access layer
│   ├── service.py             # Business logic
│   └── routes.py              # API endpoints
├── shared/utils/
│   └── category_code_generator.py  # Code generation service
└── db/
    └── migrations/            # Alembic migration files
```

### Configuration

```python
# settings.py
CATEGORY_CODE_MAX_LENGTH = 10
CATEGORY_CODE_PATTERN = r'^[A-Z0-9\-]+$'
CATEGORY_MAX_DEPTH = 5
```

### Useful Queries

```sql
-- Find categories without codes (should be empty after migration)
SELECT * FROM categories WHERE category_code IS NULL;

-- Check code length distribution
SELECT LENGTH(category_code) as code_length, COUNT(*) 
FROM categories 
GROUP BY LENGTH(category_code);

-- Find potential duplicates
SELECT category_code, COUNT(*) 
FROM categories 
GROUP BY category_code 
HAVING COUNT(*) > 1;

-- Category hierarchy with codes
SELECT 
  REPEAT('  ', category_level - 1) || name as indented_name,
  category_code,
  category_level,
  category_path
FROM categories 
ORDER BY category_path;
```

---

**End of Backend Documentation**

For frontend integration details, see: `frontend-category-code-system-31-07-2025.md`