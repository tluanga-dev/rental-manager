'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit, 
  Trash2, 
  Folder, 
  FolderOpen,
  Package
} from 'lucide-react';
import { Category } from '@/types/api';
import { CategoryForm } from './category-form';
import { CategoryFormData } from '@/lib/validations';
import { categoriesApi } from '@/services/api/categories';

interface CategoryTreeProps {
  categories: Category[];
  onCreateCategory: (data: CategoryFormData) => void;
  onUpdateCategory: (id: string, data: CategoryFormData) => void;
  onDeleteCategory: (id: string) => void;
  onSelectCategory?: (category: Category) => void;
  selectedCategoryId?: string;
  isLoading?: boolean;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  level: number;
}

export function CategoryTree({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSelectCategory,
  selectedCategoryId,
  isLoading,
}: CategoryTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [availableParents, setAvailableParents] = useState<Category[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  // Build tree structure
  const buildTree = (categories: Category[]): CategoryNode[] => {
    const categoryMap = new Map<string, CategoryNode>();
    const rootNodes: CategoryNode[] = [];

    // First pass: create all nodes
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
        level: 0,
      });
    });

    // Second pass: build hierarchy
    categories.forEach(category => {
      const node = categoryMap.get(category.id)!;
      
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(node);
          node.level = parent.level + 1;
        } else {
          // Parent not found, treat as root
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Sort children by name
    const sortChildren = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(node => sortChildren(node.children));
    };

    sortChildren(rootNodes);
    return rootNodes;
  };

  const categoryTree = buildTree(categories);

  // Load available parent categories
  const loadAvailableParents = async (excludeId?: string) => {
    setLoadingParents(true);
    try {
      const parents = await categoriesApi.getAvailableParents(excludeId, {
        include_inactive: false
      });
      
      // Convert CategoryResponse[] to Category[] format
      const convertedParents: Category[] = parents.map(parent => ({
        id: parent.id,
        name: parent.name,
        description: parent.description || '',
        parent_id: parent.parent_category_id || undefined,
        is_active: parent.is_active,
        created_at: parent.created_at,
        updated_at: parent.updated_at
      }));
      
      setAvailableParents(convertedParents);
    } catch (error) {
      console.error('Error loading available parents:', error);
      setAvailableParents([]);
    } finally {
      setLoadingParents(false);
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

  const handleCreateCategory = (data: CategoryFormData) => {
    const categoryData = {
      ...data,
      parent_id: parentForNew || undefined,
    };
    onCreateCategory(categoryData);
    setDialogOpen(false);
    setParentForNew(null);
  };

  const handleUpdateCategory = (data: CategoryFormData) => {
    if (editingCategory) {
      onUpdateCategory(editingCategory.id, data);
      setDialogOpen(false);
      setEditingCategory(null);
    }
  };

  const handleEdit = async (category: Category) => {
    setEditingCategory(category);
    setParentForNew(null);
    setDialogOpen(true);
    // Load available parents excluding this category and its descendants
    await loadAvailableParents(category.id);
  };

  const handleAddChild = async (parentId: string) => {
    setParentForNew(parentId);
    setEditingCategory(null);
    setDialogOpen(true);
    // Load available parents for new category (no exclusions needed)
    await loadAvailableParents();
  };

  const handleAddRoot = async () => {
    setParentForNew(null);
    setEditingCategory(null);
    setDialogOpen(true);
    // Load available parents for new category (no exclusions needed)
    await loadAvailableParents();
  };

  const handleDelete = (category: Category) => {
    if (category.children.length > 0) {
      alert('Cannot delete category with subcategories. Please move or delete subcategories first.');
      return;
    }
    
    if (confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      onDeleteCategory(category.id);
    }
  };

  const renderTreeNode = (node: CategoryNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedCategoryId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
            isSelected ? 'bg-slate-50 border border-slate-200' : ''
          }`}
          style={{ paddingLeft: `${node.level * 20 + 8}px` }}
          onClick={() => onSelectCategory?.(node)}
        >
          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) {
                toggleExpanded(node.id);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          {/* Folder Icon */}
          <div className="flex items-center space-x-2 flex-1">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-slate-500" />
              ) : (
                <Folder className="h-4 w-4 text-slate-500" />
              )
            ) : (
              <Package className="h-4 w-4 text-gray-500" />
            )}
            
            {/* Category Name */}
            <span className="font-medium">{node.name}</span>
            
            {/* Item Count Badge */}
            <Badge variant="secondary" className="text-xs">
              {hasChildren ? `${node.children.length} subcategories` : '0 items'}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleAddChild(node.id);
              }}
              title="Add subcategory"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(node);
              }}
              title="Edit category"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node);
              }}
              title="Delete category"
              disabled={hasChildren}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node.children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Product Categories</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleAddRoot}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory 
                    ? 'Edit Category' 
                    : parentForNew 
                    ? 'Add Subcategory' 
                    : 'Add Root Category'
                  }
                </DialogTitle>
              </DialogHeader>
              <CategoryForm
                onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingCategory(null);
                  setParentForNew(null);
                }}
                initialData={editingCategory ? {
                  name: editingCategory.name,
                  description: editingCategory.description || '',
                  parent_id: editingCategory.parent_id || undefined,
                  is_leaf: (editingCategory as any).is_leaf ?? false,
                  is_active: editingCategory.is_active ?? true,
                  display_order: (editingCategory as any).display_order || 0,
                } : {
                  is_leaf: false,
                  is_active: true,
                  display_order: 0,
                }}
                parentCategories={availableParents}
                isLoading={isLoading || loadingParents}
                isEditing={!!editingCategory}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {categoryTree.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No categories found</p>
              <p className="text-sm">Create your first product category to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {categoryTree.map(node => renderTreeNode(node))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Folder className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Categories</p>
                <p className="text-lg font-semibold">{categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Root Categories</p>
                <p className="text-lg font-semibold">
                  {categories.filter(c => !c.parent_id).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Max Depth</p>
                <p className="text-lg font-semibold">
                  {categoryTree.length > 0 
                    ? Math.max(...categories.map(c => {
                        let depth = 0;
                        let current = c;
                        const visited = new Set();
                        while (current.parent_id && !visited.has(current.id)) {
                          visited.add(current.id);
                          depth++;
                          current = categories.find(cat => cat.id === current.parent_id) || current;
                        }
                        return depth;
                      })) + 1
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}