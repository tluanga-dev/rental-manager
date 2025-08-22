# Category Code System - Frontend Developer Documentation

**Document Version:** 1.0  
**Created:** 31-07-2025  
**Last Updated:** 31-07-2025  
**Author:** System Development Team  

## Table of Contents

1. [Overview](#overview)
2. [API Integration](#api-integration)
3. [TypeScript Interfaces](#typescript-interfaces)
4. [React Components](#react-components)
5. [State Management](#state-management)
6. [Form Handling](#form-handling)
7. [Validation](#validation)
8. [UI/UX Guidelines](#uiux-guidelines)
9. [Error Handling](#error-handling)
10. [Testing](#testing)
11. [Best Practices](#best-practices)

## Overview

The Category Code System provides automatic generation and management of unique, hierarchical category codes for rental equipment categories. This frontend documentation covers integration with the backend API and user interface implementation.

### Key Features for Frontend

- **Auto-Generated Codes**: Codes are automatically generated when not provided
- **Real-Time Validation**: Immediate feedback on code format and uniqueness
- **Hierarchical Display**: Tree-like category structure with visual hierarchy
- **Search & Filter**: Find categories by name or code
- **Drag & Drop**: Reorder categories within the same parent (future enhancement)

### Code Display Patterns

```
Root Categories:    CON, CAT, EVT, PWR, CLN
Sub Categories:     CON-EXC, CAT-COOK, EVT-AUD
Leaf Categories:    CON-EXC-MIN, CAT-COOK-OV
```

## API Integration

### Base Configuration

```typescript
// src/config/api.ts
export const API_ENDPOINTS = {
  CATEGORIES: '/api/master-data/categories',
  CATEGORY_BY_ID: (id: string) => `/api/master-data/categories/${id}`,
  CATEGORY_TREE: '/api/master-data/categories/tree',
  CATEGORY_VALIDATE: '/api/master-data/categories/validate-code'
} as const;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

### API Service Layer

```typescript
// src/services/categoryService.ts
import { ApiResponse, PaginatedResponse } from '@/types/api';
import { Category, CategoryCreate, CategoryUpdate, CategoryTree } from '@/types/category';

export class CategoryService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Create category (code auto-generated if not provided)
  async createCategory(data: CategoryCreate): Promise<ApiResponse<Category>> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CATEGORIES}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get single category
  async getCategory(id: string): Promise<ApiResponse<Category>> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CATEGORY_BY_ID(id)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get paginated categories
  async getCategories(params?: {
    page?: number;
    pageSize?: number;
    parentId?: string;
    level?: number;
    search?: string;
  }): Promise<PaginatedResponse<Category>> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('page_size', params.pageSize.toString());
    if (params?.parentId) searchParams.set('parent_id', params.parentId);
    if (params?.level) searchParams.set('level', params.level.toString());
    if (params?.search) searchParams.set('search', params.search);

    const response = await fetch(
      `${this.baseUrl}${API_ENDPOINTS.CATEGORIES}?${searchParams}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Get category tree
  async getCategoryTree(rootId?: string): Promise<ApiResponse<CategoryTree[]>> {
    const url = rootId 
      ? `${this.baseUrl}${API_ENDPOINTS.CATEGORY_TREE}?root_id=${rootId}`
      : `${this.baseUrl}${API_ENDPOINTS.CATEGORY_TREE}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Update category
  async updateCategory(id: string, data: CategoryUpdate): Promise<ApiResponse<Category>> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CATEGORY_BY_ID(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CATEGORY_BY_ID(id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // Validate category code
  async validateCategoryCode(code: string, excludeId?: string): Promise<{
    isValid: boolean;
    message?: string;
  }> {
    const params = new URLSearchParams({ code });
    if (excludeId) params.set('exclude_id', excludeId);

    const response = await fetch(
      `${this.baseUrl}${API_ENDPOINTS.CATEGORY_VALIDATE}?${params}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const categoryService = new CategoryService();
```

## TypeScript Interfaces

### Core Category Types

```typescript
// src/types/category.ts
export interface Category {
  id: string;
  name: string;
  category_code: string;
  parent_category_id: string | null;
  category_path: string;
  category_level: number;
  display_order: number;
  is_leaf: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  
  // Computed fields
  child_count: number;
  item_count: number;
  can_have_items: boolean;
  can_have_children: boolean;
  can_delete: boolean;
  is_root: boolean;
  has_children: boolean;
  has_items: boolean;
  breadcrumb: string[];
  full_name: string;
}

export interface CategoryCreate {
  name: string;
  parent_category_id?: string | null;
  display_order?: number;
  category_code?: string; // Optional - auto-generated if not provided
}

export interface CategoryUpdate {
  name?: string;
  category_code?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
  depth: number;
  path_segments: string[];
}

// Form-specific types
export interface CategoryFormData {
  name: string;
  parent_category_id?: string;
  display_order: number;
  category_code?: string;
  generate_code_automatically: boolean; // UI-only field
}

// Filter and search types
export interface CategoryFilter {
  search?: string;
  parent_id?: string;
  level?: number;
  is_active?: boolean;
  has_children?: boolean;
  has_items?: boolean;
}

// Display types
export interface CategoryDisplay extends Category {
  indented_name: string;
  level_indicator: string;
  status_color: 'green' | 'yellow' | 'red' | 'gray';
  actions_available: string[];
}
```

### API Response Types

```typescript
// src/types/api.ts
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  detail: string | ValidationError[];
  status_code: number;
}
```

## React Components

### 1. Category Tree Component

```typescript
// src/components/categories/CategoryTree.tsx
import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { CategoryTree as CategoryTreeType } from '@/types/category';
import { categoryService } from '@/services/categoryService';

interface CategoryTreeProps {
  rootId?: string;
  onCategorySelect?: (category: CategoryTreeType) => void;
  selectedCategoryId?: string;
  showCodes?: boolean;
  maxDepth?: number;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  rootId,
  onCategorySelect,
  selectedCategoryId,
  showCodes = true,
  maxDepth = 5
}) => {
  const [categories, setCategories] = useState<CategoryTreeType[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [rootId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.getCategoryTree(rootId);
      setCategories(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderCategory = (category: CategoryTreeType, depth: number = 0) => {
    if (depth >= maxDepth) return null;

    const isExpanded = expandedNodes.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div key={category.id} className="category-tree-node">
        <div
          className={`
            flex items-center py-2 px-3 cursor-pointer hover:bg-gray-50
            ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
          `}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => onCategorySelect?.(category)}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(category.id);
              }}
              className="mr-2 p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Folder Icon */}
          <div className="mr-2">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpenIcon className="w-5 h-5 text-blue-500" />
              ) : (
                <FolderIcon className="w-5 h-5 text-blue-500" />
              )
            ) : (
              <div className="w-5 h-5 bg-gray-300 rounded-sm" />
            )}
          </div>

          {/* Category Name and Code */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 truncate">
                {category.name}
              </span>
              {showCodes && (
                <span className="ml-2 px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                  {category.category_code}
                </span>
              )}
            </div>
            
            {/* Additional Info */}
            <div className="flex items-center mt-1 text-xs text-gray-500">
              <span>Level {category.category_level}</span>
              {category.child_count > 0 && (
                <span className="ml-2">{category.child_count} children</span>
              )}
              {category.item_count > 0 && (
                <span className="ml-2">{category.item_count} items</span>
              )}
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="category-children">
            {category.children.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-8">
        <p>Error loading categories: {error}</p>
        <button
          onClick={loadCategories}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="category-tree">
      {categories.map(category => renderCategory(category))}
      {categories.length === 0 && (
        <div className="text-gray-500 text-center py-8">
          No categories found
        </div>
      )}
    </div>
  );
};
```

### 2. Category Form Component

```typescript
// src/components/categories/CategoryForm.tsx
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Category, CategoryCreate, CategoryUpdate } from '@/types/category';
import { categoryService } from '@/services/categoryService';

// Validation schema
const categorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  parent_category_id: z.string().optional(),
  display_order: z.number().min(0, 'Display order must be non-negative'),
  category_code: z.string()
    .max(10, 'Code cannot exceed 10 characters')
    .regex(/^[A-Z0-9\-]*$/, 'Code must contain only uppercase letters, numbers, and dashes')
    .optional(),
  generate_code_automatically: z.boolean().default(true)
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  category?: Category; // For editing
  parentCategories?: Category[];
  onSubmit: (data: CategoryCreate | CategoryUpdate) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
  category,
  parentCategories = [],
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [codeValidation, setCodeValidation] = useState<{
    isValidating: boolean;
    isValid: boolean;
    message?: string;
  }>({ isValidating: false, isValid: true });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      parent_category_id: category?.parent_category_id || '',
      display_order: category?.display_order || 0,
      category_code: category?.category_code || '',
      generate_code_automatically: !category?.category_code
    }
  });

  const watchName = watch('name');
  const watchCode = watch('category_code');
  const watchAutoGenerate = watch('generate_code_automatically');

  // Auto-generate code preview when name changes and auto-generate is enabled
  useEffect(() => {
    if (watchAutoGenerate && watchName && !category) {
      generateCodePreview(watchName);
    }
  }, [watchName, watchAutoGenerate, category]);

  // Validate custom code when entered
  useEffect(() => {
    if (!watchAutoGenerate && watchCode && watchCode.length > 0) {
      validateCode(watchCode);
    }
  }, [watchCode, watchAutoGenerate]);

  const generateCodePreview = (name: string) => {
    // Simple preview generation (actual generation happens on server)
    const words = name.trim().split(/\\s+/);
    let preview = '';
    
    if (words.length === 1) {
      preview = words[0].substring(0, 4).toUpperCase();
    } else {
      preview = words.map(word => word[0]).join('').substring(0, 4).toUpperCase();
    }
    
    setValue('category_code', preview);
  };

  const validateCode = async (code: string) => {
    if (code.length === 0) return;

    setCodeValidation({ isValidating: true, isValid: true });

    try {
      const result = await categoryService.validateCategoryCode(code, category?.id);
      setCodeValidation({
        isValidating: false,
        isValid: result.isValid,
        message: result.message
      });
    } catch (error) {
      setCodeValidation({
        isValidating: false,
        isValid: false,
        message: 'Failed to validate code'
      });
    }
  };

  const onFormSubmit = async (data: CategoryFormData) => {
    const submitData: CategoryCreate | CategoryUpdate = {
      name: data.name,
      parent_category_id: data.parent_category_id || null,
      display_order: data.display_order,
    };

    // Only include category_code if not auto-generating
    if (!data.generate_code_automatically && data.category_code) {
      submitData.category_code = data.category_code;
    }

    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Category Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category Name *
        </label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              className={`
                w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${errors.name ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="Enter category name"
            />
          )}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Parent Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Parent Category
        </label>
        <Controller
          name="parent_category_id"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select parent category (optional)</option>
              {parentCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.category_path} ({cat.category_code})
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Code Generation Options */}
      <div className="space-y-4">
        <div className="flex items-center">
          <Controller
            name="generate_code_automatically"
            control={control}
            render={({ field: { value, onChange } }) => (
              <input
                type="checkbox"
                checked={value}
                onChange={onChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 text-sm text-gray-700">
            Generate category code automatically
          </label>
        </div>

        {/* Manual Code Entry */}
        {!watchAutoGenerate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Code
            </label>
            <Controller
              name="category_code"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <input
                    {...field}
                    type="text"
                    maxLength={10}
                    className={`
                      w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono
                      ${errors.category_code || !codeValidation.isValid ? 'border-red-300' : 'border-gray-300'}
                    `}
                    placeholder="Enter category code (max 10 chars)"
                  />
                  {codeValidation.isValidating && (
                    <div className="absolute right-3 top-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              )}
            />
            
            {/* Validation Messages */}
            {errors.category_code && (
              <p className="mt-1 text-sm text-red-600">{errors.category_code.message}</p>
            )}
            {!codeValidation.isValid && codeValidation.message && (
              <p className="mt-1 text-sm text-red-600">{codeValidation.message}</p>
            )}
            {codeValidation.isValid && watchCode && (
              <p className="mt-1 text-sm text-green-600">✓ Code is available</p>
            )}
            
            {/* Format Guidelines */}
            <div className="mt-2 text-xs text-gray-500">
              <p>Format: Uppercase letters, numbers, and dashes only</p>
              <p>Examples: CON, CAT-COOK, EVT-AUD-SYS</p>
            </div>
          </div>
        )}

        {/* Auto-Generated Code Preview */}
        {watchAutoGenerate && watchCode && (
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Generated Code Preview:</strong> 
              <span className="font-mono ml-2 bg-white px-2 py-1 rounded">
                {watchCode}
              </span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Final code will be generated automatically when creating the category
            </p>
          </div>
        )}
      </div>

      {/* Display Order */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Display Order
        </label>
        <Controller
          name="display_order"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              min={0}
              className={`
                w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${errors.display_order ? 'border-red-300' : 'border-gray-300'}
              `}
              placeholder="0"
            />
          )}
        />
        {errors.display_order && (
          <p className="mt-1 text-sm text-red-600">{errors.display_order.message}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loading || (!watchAutoGenerate && !codeValidation.isValid)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting || loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
              {category ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            category ? 'Update Category' : 'Create Category'
          )}
        </button>
      </div>
    </form>
  );
};
```

### 3. Category List Component

```typescript
// src/components/categories/CategoryList.tsx
import React, { useState, useEffect } from 'react';
import { 
  PencilIcon, 
  TrashIcon, 
  FolderIcon, 
  DocumentIcon,
  MagnifyingGlassIcon,
  FunnelIcon 
} from '@heroicons/react/24/outline';
import { Category, CategoryFilter } from '@/types/category';
import { categoryService } from '@/services/categoryService';

interface CategoryListProps {
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onSelect?: (category: Category) => void;
  selectedCategoryId?: string;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  onEdit,
  onDelete,
  onSelect,
  selectedCategoryId
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CategoryFilter>({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    loadCategories();
  }, [filters, pagination.page]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.getCategories({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters
      });
      
      setCategories(response.items);
      setPagination({
        page: response.page,
        pageSize: response.page_size,
        total: response.total,
        pages: response.pages
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search });
    setPagination({ ...pagination, page: 1 });
  };

  const handleFilterChange = (newFilters: Partial<CategoryFilter>) => {
    setFilters({ ...filters, ...newFilters });
    setPagination({ ...pagination, page: 1 });
  };

  const getStatusColor = (category: Category): string => {
    if (!category.is_active) return 'text-gray-500';
    if (category.has_items) return 'text-green-600';
    if (category.has_children) return 'text-blue-600';
    return 'text-gray-700';
  };

  const getStatusIcon = (category: Category) => {
    if (category.has_children) {
      return <FolderIcon className="w-5 h-5" />;
    }
    return <DocumentIcon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories by name or code..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <select
            onChange={(e) => handleFilterChange({ level: e.target.value ? parseInt(e.target.value) : undefined })}
            className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Levels</option>
            <option value="1">Level 1 (Root)</option>
            <option value="2">Level 2 (Sub)</option>
            <option value="3">Level 3 (Leaf)</option>
          </select>
          <FunnelIcon className="w-4 h-4 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Category Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadCategories}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Children/Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className={`
                    hover:bg-gray-50 cursor-pointer
                    ${selectedCategoryId === category.id ? 'bg-blue-50' : ''}
                  `}
                  onClick={() => onSelect?.(category)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`mr-3 ${getStatusColor(category)}`}>
                        {getStatusIcon(category)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {category.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {category.category_path}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                      {category.category_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Level {category.category_level}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-4">
                      {category.child_count > 0 && (
                        <span>{category.child_count} children</span>
                      )}
                      {category.item_count > 0 && (
                        <span>{category.item_count} items</span>
                      )}
                      {category.child_count === 0 && category.item_count === 0 && (
                        <span className="text-gray-400">Empty</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`
                      inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${category.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                      }
                    `}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {onEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(category);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          title="Edit category"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && category.can_delete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(category);
                          }}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete category"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && categories.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination({ ...pagination, page: pageNum })}
                        className={`
                          relative inline-flex items-center px-4 py-2 border text-sm font-medium
                          ${pagination.page === pageNum
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && categories.length === 0 && (
          <div className="text-center py-12">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No categories found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.search 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Get started by creating your first category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```

## State Management

### Zustand Store for Categories

```typescript
// src/stores/categoryStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Category, CategoryTree, CategoryFilter } from '@/types/category';
import { categoryService } from '@/services/categoryService';

interface CategoryState {
  // Data
  categories: Category[];
  categoryTree: CategoryTree[];
  selectedCategory: Category | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  filters: CategoryFilter;
  
  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  
  // Actions
  loadCategories: () => Promise<void>;
  loadCategoryTree: (rootId?: string) => Promise<void>;
  createCategory: (data: CategoryCreate) => Promise<Category>;
  updateCategory: (id: string, data: CategoryUpdate) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  selectCategory: (category: Category | null) => void;
  setFilters: (filters: Partial<CategoryFilter>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
}

export const useCategoryStore = create<CategoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      categories: [],
      categoryTree: [],
      selectedCategory: null,
      loading: false,
      error: null,
      filters: {},
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        pages: 0
      },

      // Actions
      loadCategories: async () => {
        set({ loading: true, error: null });
        
        try {
          const { filters, pagination } = get();
          const response = await categoryService.getCategories({
            page: pagination.page,
            pageSize: pagination.pageSize,
            ...filters
          });
          
          set({
            categories: response.items,
            pagination: {
              page: response.page,
              pageSize: response.page_size,
              total: response.total,
              pages: response.pages
            },
            loading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load categories',
            loading: false
          });
        }
      },

      loadCategoryTree: async (rootId?: string) => {
        set({ loading: true, error: null });
        
        try {
          const response = await categoryService.getCategoryTree(rootId);
          set({
            categoryTree: response.data,
            loading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load category tree',
            loading: false
          });
        }
      },

      createCategory: async (data) => {
        set({ loading: true, error: null });
        
        try {
          const response = await categoryService.createCategory(data);
          const newCategory = response.data;
          
          // Add to categories list
          set(state => ({
            categories: [newCategory, ...state.categories],
            loading: false
          }));
          
          // Reload tree to reflect hierarchy changes
          await get().loadCategoryTree();
          
          return newCategory;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create category',
            loading: false
          });
          throw error;
        }
      },

      updateCategory: async (id, data) => {
        set({ loading: true, error: null });
        
        try {
          const response = await categoryService.updateCategory(id, data);
          const updatedCategory = response.data;
          
          // Update in categories list
          set(state => ({
            categories: state.categories.map(cat => 
              cat.id === id ? updatedCategory : cat
            ),
            selectedCategory: state.selectedCategory?.id === id 
              ? updatedCategory 
              : state.selectedCategory,
            loading: false
          }));
          
          // Reload tree to reflect changes
          await get().loadCategoryTree();
          
          return updatedCategory;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update category',
            loading: false
          });
          throw error;
        }
      },

      deleteCategory: async (id) => {
        set({ loading: true, error: null });
        
        try {
          await categoryService.deleteCategory(id);
          
          // Remove from categories list
          set(state => ({
            categories: state.categories.filter(cat => cat.id !== id),
            selectedCategory: state.selectedCategory?.id === id 
              ? null 
              : state.selectedCategory,
            loading: false
          }));
          
          // Reload tree to reflect changes
          await get().loadCategoryTree();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete category',
            loading: false
          });
          throw error;
        }
      },

      selectCategory: (category) => {
        set({ selectedCategory: category });
      },

      setFilters: (newFilters) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
          pagination: { ...state.pagination, page: 1 } // Reset to first page
        }));
        
        // Trigger reload
        get().loadCategories();
      },

      setPage: (page) => {
        set(state => ({
          pagination: { ...state.pagination, page }
        }));
        
        // Trigger reload
        get().loadCategories();
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'category-store'
    }
  )
);
```

### React Query Integration (Alternative)

```typescript
// src/hooks/useCategories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, CategoryCreate, CategoryUpdate, CategoryFilter } from '@/types/category';
import { categoryService } from '@/services/categoryService';

// Query keys
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters: CategoryFilter) => [...categoryKeys.lists(), filters] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
  tree: (rootId?: string) => [...categoryKeys.all, 'tree', rootId] as const,
};

// Custom hooks
export const useCategories = (filters: CategoryFilter = {}) => {
  return useQuery({
    queryKey: categoryKeys.list(filters),
    queryFn: () => categoryService.getCategories(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCategoryTree = (rootId?: string) => {
  return useQuery({
    queryKey: categoryKeys.tree(rootId),
    queryFn: () => categoryService.getCategoryTree(rootId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCategory = (id: string) => {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => categoryService.getCategory(id),
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CategoryCreate) => categoryService.createCategory(data),
    onSuccess: () => {
      // Invalidate and refetch categories
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryUpdate }) => 
      categoryService.updateCategory(id, data),
    onSuccess: (updatedCategory) => {
      // Update specific category in cache
      queryClient.setQueryData(
        categoryKeys.detail(updatedCategory.data.id), 
        updatedCategory
      );
      
      // Invalidate lists to refetch with updated data
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => categoryService.deleteCategory(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: categoryKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};
```

## Form Handling

### React Hook Form Integration

```typescript
// src/components/categories/hooks/useCategoryForm.ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Category, CategoryCreate, CategoryUpdate } from '@/types/category';

const categoryFormSchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  parent_category_id: z.string().optional(),
  display_order: z.number()
    .min(0, 'Display order must be non-negative')
    .default(0),
  category_code: z.string()
    .max(10, 'Code cannot exceed 10 characters')
    .regex(/^[A-Z0-9\-]*$/, 'Code must contain only uppercase letters, numbers, and dashes')
    .optional(),
  generate_code_automatically: z.boolean().default(true)
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface UseCategoryFormProps {
  category?: Category;
  onSubmit: (data: CategoryCreate | CategoryUpdate) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useCategoryForm = ({
  category,
  onSubmit,
  onSuccess,
  onError
}: UseCategoryFormProps) => {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || '',
      parent_category_id: category?.parent_category_id || '',
      display_order: category?.display_order || 0,
      category_code: category?.category_code || '',
      generate_code_automatically: !category?.category_code
    }
  });

  const watchAutoGenerate = form.watch('generate_code_automatically');
  const watchName = form.watch('name');

  // Auto-generate code preview
  useEffect(() => {
    if (watchAutoGenerate && watchName && !category) {
      const preview = generateCodePreview(watchName);
      form.setValue('category_code', preview);
    }
  }, [watchName, watchAutoGenerate, category, form]);

  const generateCodePreview = (name: string): string => {
    const words = name.trim().split(/\\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 4).toUpperCase();
    }
    return words.map(word => word[0]).join('').substring(0, 4).toUpperCase();
  };

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      const submitData: CategoryCreate | CategoryUpdate = {
        name: data.name,
        parent_category_id: data.parent_category_id || null,
        display_order: data.display_order,
      };

      // Only include category_code if not auto-generating
      if (!data.generate_code_automatically && data.category_code) {
        submitData.category_code = data.category_code;
      }

      await onSubmit(submitData);
      onSuccess?.();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Submission failed'));
    }
  };

  return {
    form,
    handleSubmit: form.handleSubmit(handleSubmit),
    isSubmitting: form.formState.isSubmitting,
    errors: form.formState.errors,
    watchAutoGenerate,
    generateCodePreview
  };
};
```

## Validation

### Client-Side Validation Rules

```typescript
// src/utils/categoryValidation.ts
export const CATEGORY_CODE_PATTERN = /^[A-Z0-9\-]+$/;
export const CATEGORY_CODE_MAX_LENGTH = 10;
export const CATEGORY_NAME_MAX_LENGTH = 100;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateCategoryCode = (code: string): ValidationResult => {
  const errors: string[] = [];

  if (!code || code.trim().length === 0) {
    return { isValid: true, errors: [] }; // Optional field
  }

  const trimmedCode = code.trim().toUpperCase();

  if (trimmedCode.length > CATEGORY_CODE_MAX_LENGTH) {
    errors.push(`Code cannot exceed ${CATEGORY_CODE_MAX_LENGTH} characters`);
  }

  if (!CATEGORY_CODE_PATTERN.test(trimmedCode)) {
    errors.push('Code must contain only uppercase letters, numbers, and dashes');
  }

  if (trimmedCode.startsWith('-') || trimmedCode.endsWith('-')) {
    errors.push('Code cannot start or end with a dash');
  }

  if (trimmedCode.includes('--')) {
    errors.push('Code cannot contain consecutive dashes');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateCategoryName = (name: string): ValidationResult => {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Category name is required');
  } else if (name.trim().length > CATEGORY_NAME_MAX_LENGTH) {
    errors.push(`Name cannot exceed ${CATEGORY_NAME_MAX_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateCategoryHierarchy = (
  category: Category,
  newParentId?: string
): ValidationResult => {
  const errors: string[] = [];

  // Prevent circular references
  if (newParentId === category.id) {
    errors.push('Category cannot be its own parent');
  }

  // Check maximum depth (if implementing depth limits)
  if (category.category_level >= 5) {
    errors.push('Maximum category depth exceeded');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
```

### Real-Time Validation Hook

```typescript
// src/hooks/useRealTimeValidation.ts
import { useState, useEffect, useCallback } from 'react';
import { validateCategoryCode } from '@/utils/categoryValidation';
import { categoryService } from '@/services/categoryService';

interface UseRealTimeValidationProps {
  value: string;
  excludeId?: string;
  debounceMs?: number;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  errors: string[];
  serverError?: string;
}

export const useRealTimeValidation = ({
  value,
  excludeId,
  debounceMs = 500
}: UseRealTimeValidationProps) => {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    isValid: true,
    errors: []
  });

  const validateValue = useCallback(async (val: string) => {
    if (!val || val.trim().length === 0) {
      setState({ isValidating: false, isValid: true, errors: [] });
      return;
    }

    setState(prev => ({ ...prev, isValidating: true }));

    // Client-side validation
    const clientValidation = validateCategoryCode(val);
    if (!clientValidation.isValid) {
      setState({
        isValidating: false,
        isValid: false,
        errors: clientValidation.errors
      });
      return;
    }

    // Server-side validation (uniqueness check)
    try {
      const serverValidation = await categoryService.validateCategoryCode(val, excludeId);
      setState({
        isValidating: false,
        isValid: serverValidation.isValid,
        errors: serverValidation.isValid ? [] : [serverValidation.message || 'Code is not available'],
        serverError: serverValidation.isValid ? undefined : serverValidation.message
      });
    } catch (error) {
      setState({
        isValidating: false,
        isValid: false,
        errors: ['Failed to validate code'],
        serverError: 'Validation service error'
      });
    }
  }, [excludeId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      validateValue(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, validateValue, debounceMs]);

  return state;
};
```

## UI/UX Guidelines

### Visual Hierarchy

```css
/* Category hierarchy visual indicators */
.category-level-1 { @apply text-lg font-bold text-gray-900; }
.category-level-2 { @apply text-base font-semibold text-gray-800; }
.category-level-3 { @apply text-sm font-medium text-gray-700; }

/* Category code styling */
.category-code {
  @apply inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded;
}

.category-code-root { @apply bg-blue-100 text-blue-800; }
.category-code-sub { @apply bg-green-100 text-green-800; }
.category-code-leaf { @apply bg-yellow-100 text-yellow-800; }

/* Status indicators */
.category-status-active { @apply text-green-600; }
.category-status-inactive { @apply text-gray-400; }
.category-status-has-children { @apply text-blue-600; }
.category-status-has-items { @apply text-purple-600; }
```

### Accessibility Guidelines

```typescript
// Accessibility helpers
export const getCategoryAriaLabel = (category: Category): string => {
  const levelText = `Level ${category.category_level}`;
  const statusText = category.is_active ? 'Active' : 'Inactive';
  const childrenText = category.child_count > 0 ? `${category.child_count} children` : 'No children';
  const itemsText = category.item_count > 0 ? `${category.item_count} items` : 'No items';
  
  return `${category.name}, ${levelText}, ${statusText}, ${childrenText}, ${itemsText}`;
};

export const getCategoryRoleProps = (category: Category) => ({
  role: category.has_children ? 'treeitem' : 'option',
  'aria-expanded': category.has_children ? undefined : null,
  'aria-level': category.category_level,
  'aria-label': getCategoryAriaLabel(category)
});
```

### Loading States

```typescript
// Loading skeleton component
export const CategoryListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
        <div className="w-6 h-6 bg-gray-200 rounded"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="w-16 h-6 bg-gray-200 rounded"></div>
      </div>
    ))}
  </div>
);
```

## Error Handling

### Error Boundary Component

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class CategoryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Category Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Something went wrong with categories
          </h3>
          <p className="text-gray-500 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Error Notification System

```typescript
// src/components/notifications/CategoryNotifications.tsx
import { toast } from 'react-hot-toast';

export const categoryNotifications = {
  success: {
    created: (categoryName: string, code: string) => 
      toast.success(`Category "${categoryName}" created with code ${code}`),
    updated: (categoryName: string) => 
      toast.success(`Category "${categoryName}" updated successfully`),
    deleted: (categoryName: string) => 
      toast.success(`Category "${categoryName}" deleted successfully`),
  },

  error: {
    created: (error: string) => 
      toast.error(`Failed to create category: ${error}`),
    updated: (error: string) => 
      toast.error(`Failed to update category: ${error}`),
    deleted: (error: string) => 
      toast.error(`Failed to delete category: ${error}`),
    validation: (errors: string[]) => 
      toast.error(`Validation errors: ${errors.join(', ')}`),
    network: () => 
      toast.error('Network error. Please check your connection and try again.'),
  },

  warning: {
    codeGenerated: (code: string) => 
      toast(`Code "${code}" was auto-generated`, { icon: '🔧' }),
    hasChildren: () => 
      toast.error('Cannot delete category that has subcategories'),
    hasItems: () => 
      toast.error('Cannot delete category that contains items'),
  }
};
```

## Testing

### Component Testing with Jest and React Testing Library

```typescript
// src/components/categories/__tests__/CategoryForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from '../CategoryForm';
import { categoryService } from '@/services/categoryService';

// Mock the service
jest.mock('@/services/categoryService');
const mockCategoryService = categoryService as jest.Mocked<typeof categoryService>;

describe('CategoryForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form fields correctly', () => {
    render(
      <CategoryForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/category name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parent category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/generate code automatically/i)).toBeChecked();
  });

  it('generates code preview when name is entered', async () => {
    const user = userEvent.setup();
    
    render(
      <CategoryForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByLabelText(/category name/i);
    await user.type(nameInput, 'Construction Equipment');

    await waitFor(() => {
      expect(screen.getByDisplayValue('CE')).toBeInTheDocument();
    });
  });

  it('validates custom category code', async () => {
    const user = userEvent.setup();
    mockCategoryService.validateCategoryCode.mockResolvedValue({
      isValid: false,
      message: 'Code already exists'
    });

    render(
      <CategoryForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Disable auto-generation
    const autoGenerateCheckbox = screen.getByLabelText(/generate code automatically/i);
    await user.click(autoGenerateCheckbox);

    // Enter custom code
    const codeInput = screen.getByLabelText(/category code/i);
    await user.type(codeInput, 'CON');

    await waitFor(() => {
      expect(screen.getByText(/code already exists/i)).toBeInTheDocument();
    });
  });

  it('submits form with correct data', async () => {
    const user = userEvent.setup();
    
    render(
      <CategoryForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await user.type(screen.getByLabelText(/category name/i), 'Test Category');
    await user.click(screen.getByRole('button', { name: /create category/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Category',
        parent_category_id: null,
        display_order: 0
      });
    });
  });
});
```

### E2E Testing with Playwright

```typescript
// tests/e2e/categories.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
  });

  test('creates category with auto-generated code', async ({ page }) => {
    // Click create button
    await page.click('[data-testid="create-category-btn"]');

    // Fill form
    await page.fill('[data-testid="category-name-input"]', 'Test Category');
    
    // Verify auto-generation is enabled
    await expect(page.locator('[data-testid="auto-generate-checkbox"]')).toBeChecked();
    
    // Submit form
    await page.click('[data-testid="submit-btn"]');

    // Verify success
    await expect(page.locator('[data-testid="success-notification"]')).toContainText('created');
    
    // Verify category appears in list
    await expect(page.locator('[data-testid="category-list"]')).toContainText('Test Category');
  });

  test('validates category code format', async ({ page }) => {
    await page.click('[data-testid="create-category-btn"]');
    await page.fill('[data-testid="category-name-input"]', 'Test Category');
    
    // Disable auto-generation
    await page.uncheck('[data-testid="auto-generate-checkbox"]');
    
    // Enter invalid code
    await page.fill('[data-testid="category-code-input"]', 'invalid-code');
    
    // Verify validation error
    await expect(page.locator('[data-testid="code-validation-error"]'))
      .toContainText('uppercase letters');
  });

  test('displays category hierarchy correctly', async ({ page }) => {
    // Create root category
    await page.click('[data-testid="create-category-btn"]');
    await page.fill('[data-testid="category-name-input"]', 'Construction Equipment');
    await page.click('[data-testid="submit-btn"]');
    
    // Wait for creation
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    
    // Create subcategory
    await page.click('[data-testid="create-category-btn"]');
    await page.fill('[data-testid="category-name-input"]', 'Excavators');
    await page.selectOption('[data-testid="parent-category-select"]', 'Construction Equipment');
    await page.click('[data-testid="submit-btn"]');
    
    // Verify hierarchy display
    await expect(page.locator('[data-testid="category-tree"]'))
      .toContainText('Construction Equipment');
    await expect(page.locator('[data-testid="category-tree"]'))
      .toContainText('Excavators');
  });
});
```

## Best Practices

### Performance Optimization

1. **Lazy Loading**: Load category tree nodes on demand
2. **Virtualization**: Use virtual scrolling for large category lists
3. **Memoization**: Cache category data and computed values
4. **Debounced Search**: Prevent excessive API calls during search

```typescript
// Example: Memoized category tree
const MemoizedCategoryTree = React.memo(CategoryTree, (prevProps, nextProps) => {
  return (
    prevProps.selectedCategoryId === nextProps.selectedCategoryId &&
    prevProps.categories === nextProps.categories &&
    prevProps.expandedNodes === nextProps.expandedNodes
  );
});
```

### Code Quality

1. **TypeScript**: Use strict typing for all category-related data
2. **Error Boundaries**: Wrap category components in error boundaries
3. **Testing**: Maintain high test coverage for critical category operations
4. **Documentation**: Document complex category logic and business rules

### User Experience

1. **Loading States**: Show appropriate loading indicators
2. **Error Feedback**: Provide clear, actionable error messages
3. **Validation**: Real-time validation with helpful hints
4. **Accessibility**: Support keyboard navigation and screen readers

### Security

1. **Input Sanitization**: Validate all user inputs
2. **XSS Prevention**: Escape category names in displays
3. **Authorization**: Check permissions before category operations
4. **Rate Limiting**: Implement client-side request throttling

---

## Appendix

### Common Patterns and Examples

```typescript
// Category selection handler
const handleCategorySelect = useCallback((category: Category) => {
  // Update selection state
  setSelectedCategory(category);
  
  // Trigger side effects
  onCategorySelect?.(category);
  
  // Update URL if using routing
  if (useRouting) {
    router.push(`/categories/${category.id}`);
  }
}, [onCategorySelect, router, useRouting]);

// Category code display utility
const formatCategoryCode = (code: string, level: number): string => {
  const levelColors = {
    1: 'blue',
    2: 'green', 
    3: 'yellow'
  };
  
  return `category-code-${levelColors[level] || 'gray'}`;
};

// Category path breadcrumb
const CategoryBreadcrumb: React.FC<{ category: Category }> = ({ category }) => (
  <nav className="flex" aria-label="Breadcrumb">
    <ol className="flex items-center space-x-4">
      {category.breadcrumb.map((segment, index) => (
        <li key={index} className="flex items-center">
          {index > 0 && (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 mx-2" />
          )}
          <span className={index === category.breadcrumb.length - 1 
            ? 'text-gray-900 font-medium' 
            : 'text-gray-500 hover:text-gray-700'
          }>
            {segment}
          </span>
        </li>
      ))}
    </ol>
  </nav>
);
```

### Configuration Examples

```typescript
// Category system configuration
export const CATEGORY_CONFIG = {
  MAX_DEPTH: 5,
  CODE_MAX_LENGTH: 10,
  NAME_MAX_LENGTH: 100,
  PAGINATION_SIZE: 20,
  SEARCH_DEBOUNCE_MS: 500,
  VALIDATION_DEBOUNCE_MS: 300,
  AUTO_SAVE_DELAY_MS: 2000,
  
  // UI Configuration
  TREE_INDENT_PX: 20,
  ICON_SIZE: 'w-5 h-5',
  LOADING_SKELETON_ROWS: 5,
  
  // Validation patterns
  CODE_PATTERN: /^[A-Z0-9\-]+$/,
  NAME_PATTERN: /^[a-zA-Z0-9\s\-&'(),\.]+$/,
} as const;
```

---

**End of Frontend Documentation**

For backend implementation details, see: `backend-category-code-system-31-07-2025.md`