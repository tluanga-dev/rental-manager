'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CategoryTree } from '@/components/inventory';
import { 
  Plus, 
  Search, 
  ChevronRight,
  Edit,
  Trash2,
  MoveVertical,
  Grid3X3,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { categoriesApi, type CategoryResponse, type CategoryTree } from '@/services/api/categories';
import { useAppStore } from '@/stores/app-store';
import { Category } from '@/types/api';

interface CategoryTreeNode extends CategoryTree {
  productCount?: number;
}

function CategoriesContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryTreeNode | null>(null);
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    rootCategories: 0,
    leafCategories: 0,
    recentCategories: 0
  });

  // Load categories from API
  const loadCategories = async () => {
    setIsLoading(true);
    try {
        // Use the list endpoint which is working instead of the tree endpoint
        const categoriesResponse = await categoriesApi.list({ 
          include_inactive: false,
          page_size: 100,  // Get a large number to capture all categories
          sort_field: 'name',
          sort_direction: 'asc'
        });
        
        if (!categoriesResponse || !Array.isArray(categoriesResponse.items)) {
          throw new Error('Invalid response structure from categories list API');
        }

        // Build tree structure from flat list
        const buildTree = (categories: CategoryResponse[]): CategoryTreeNode[] => {
          const categoryMap = new Map<string, CategoryTreeNode>();
          const rootCategories: CategoryTreeNode[] = [];

          // First pass: Create all category nodes
          categories.forEach(cat => {
            categoryMap.set(cat.id, {
              ...cat,
              children: [],
              productCount: cat.item_count || 0
            });
          });

          // Second pass: Build parent-child relationships
          categories.forEach(cat => {
            const categoryNode = categoryMap.get(cat.id)!;
            if (cat.parent_category_id) {
              const parent = categoryMap.get(cat.parent_category_id);
              if (parent) {
                parent.children = parent.children || [];
                parent.children.push(categoryNode);
              }
            } else {
              rootCategories.push(categoryNode);
            }
          });

          return rootCategories;
        };

        const categoryTree = buildTree(categoriesResponse.items);
        setCategories(categoryTree);
        
        // Calculate stats from tree structure
        const calculateStats = (nodes: CategoryTreeNode[]): { total: number; rootCategories: number; leafCategories: number; recentCategories: number } => {
          let total = 0;
          let leafCategories = 0;
          let recentCategories = 0;
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const traverseTree = (nodes: CategoryTreeNode[]) => {
            nodes.forEach(node => {
              total++;
              if (node.is_leaf) {
                leafCategories++;
              }
              if (node.created_at && new Date(node.created_at) > thirtyDaysAgo) {
                recentCategories++;
              }
              if (node.children && node.children.length > 0) {
                traverseTree(node.children);
              }
            });
          };
          
          traverseTree(nodes);
          
          return {
            total,
            rootCategories: nodes.length,
            leafCategories,
            recentCategories
          };
        };
        
        const stats = calculateStats(categoryTree);
        setStats(stats);
        
      } catch (error) {
        console.error('Error loading categories:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load categories. Please try again.',
        });
        setCategories([]);
        setStats({ total: 0, rootCategories: 0, leafCategories: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      loadCategories();
    }, [addNotification]);

  // Handle category operations
  const handleCreateCategory = async (data: any) => {
    try {
      const createPayload = {
        name: data.name,
        parent_category_id: data.parent_id || null,
        display_order: data.display_order || 0,
      };

      const createdCategory = await categoriesApi.create(createPayload);
      
      addNotification({
        type: 'success',
        title: 'Category Created',
        message: `Category "${createdCategory.name}" has been created successfully.`,
      });
      
      // Reload categories to show the new one
      loadCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error?.response?.data?.detail || 'Failed to create category. Please try again.',
      });
    }
  };

  const handleUpdateCategory = async (id: string, data: any) => {
    try {
      const updatePayload = {
        name: data.name,
        description: data.description || '',
        parent_category_id: data.parent_id || null,
        is_leaf: data.is_leaf ?? false,
        is_active: data.is_active ?? true,
        display_order: data.display_order || 0,
      };

      const updatedCategory = await categoriesApi.update(id, updatePayload);
      
      addNotification({
        type: 'success',
        title: 'Category Updated',
        message: `Category "${updatedCategory.name}" has been updated successfully.`,
      });
      
      // Reload categories to show the changes
      loadCategories();
      
      // Update selected category if it was the one being edited
      if (selectedCategory?.id === id) {
        setSelectedCategory(prev => prev ? { ...prev, ...updatedCategory } : null);
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error?.response?.data?.detail || 'Failed to update category. Please try again.',
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await categoriesApi.delete(id);
      
      addNotification({
        type: 'success',
        title: 'Category Deleted',
        message: 'Category has been deleted successfully.',
      });
      
      // Reload categories to remove the deleted one
      loadCategories();
      
      // Clear selected category if it was the one being deleted
      if (selectedCategory?.id === id) {
        setSelectedCategory(null);
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error?.response?.data?.detail || 'Failed to delete category. Please try again.',
      });
    }
  };

  const breadcrumb = selectedCategory?.category_path?.split('/') || [];

  // Function to flatten categories tree into a list
  const getAllCategories = () => {
    const flatList: CategoryTreeNode[] = [];
    
    const flatten = (categories: CategoryTreeNode[]) => {
      categories.forEach(category => {
        flatList.push(category);
        if (category.children && category.children.length > 0) {
          flatten(category.children);
        }
      });
    };
    
    flatten(categories);
    return flatList.sort((a, b) => (a.category_path || '').localeCompare(b.category_path || ''));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Category Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Organize your products with hierarchical categories
          </p>
        </div>
        <Button onClick={() => router.push('/products/categories/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Root Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.rootCategories}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leaf Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.leafCategories}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.recentCategories}
            </div>
            <p className="text-xs text-muted-foreground">Recent additions</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Category Tree */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Category Hierarchy</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryTree 
              categories={(() => {
                const transformCategory = (cat: CategoryTreeNode): Category => ({
                  id: cat.id,
                  name: cat.name,
                  description: cat.name,
                  parent_id: cat.parent_category_id || undefined,
                  is_active: cat.is_active,
                  created_at: cat.created_at || '',
                  updated_at: cat.updated_at || ''
                });
                
                // Transform all categories including nested ones
                const flattenCategories = (nodes: CategoryTreeNode[]): Category[] => {
                  const result: Category[] = [];
                  nodes.forEach(node => {
                    result.push(transformCategory(node));
                    if (node.children) {
                      result.push(...flattenCategories(node.children));
                    }
                  });
                  return result;
                };
                
                return flattenCategories(categories);
              })()}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onSelectCategory={(category) => {
                // Find the matching CategoryTreeNode from our state
                const findCategoryNode = (nodes: CategoryTreeNode[], targetId: string): CategoryTreeNode | null => {
                  for (const node of nodes) {
                    if (node.id === targetId) return node;
                    if (node.children) {
                      const found = findCategoryNode(node.children, targetId);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                
                const categoryNode = findCategoryNode(categories, category.id);
                if (categoryNode) {
                  setSelectedCategory(categoryNode);
                }
              }}
              selectedCategoryId={selectedCategory?.id}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Category Details */}
        <Card>
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCategory ? (
              <div className="space-y-4">
                {/* Breadcrumb */}
                <div className="flex items-center text-sm text-gray-600">
                  {breadcrumb.map((part: string, index: number) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
                      <span>{part}</span>
                    </div>
                  ))}
                </div>

                {/* Category Info */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Category Name</label>
                    <p className="text-lg">{selectedCategory.name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Category Type</label>
                    <p>
                      <Badge variant={selectedCategory.is_leaf ? 'default' : 'secondary'}>
                        {selectedCategory.is_leaf ? 'Leaf Category' : 'Parent Category'}
                      </Badge>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Hierarchy Level</label>
                    <p>Level {selectedCategory.category_level}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex items-center">
                      {selectedCategory.is_active ? (
                        <Eye className="h-4 w-4 text-green-600 mr-2" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400 mr-2" />
                      )}
                      <Badge variant={selectedCategory.is_active ? 'default' : 'secondary'}>
                        {selectedCategory.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Products</label>
                    <p>{selectedCategory.productCount || 0} products</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Created</label>
                    <p>{selectedCategory.created_at ? new Date(selectedCategory.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Unknown'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Last Updated</label>
                    <p>{selectedCategory.updated_at ? new Date(selectedCategory.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Unknown'}</p>
                  </div>

                  {selectedCategory.is_leaf && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        This is a leaf category. Products can be assigned to this category.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => router.push(`/products/categories/${selectedCategory.id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Category
                  </Button>
                  {!selectedCategory.is_leaf && (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => router.push('/products/categories/new')}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Subcategory
                    </Button>
                  )}
                  <Button className="w-full" variant="outline" disabled>
                    <MoveVertical className="mr-2 h-4 w-4" />
                    Move Category
                  </Button>
                  {selectedCategory.productCount === 0 && (
                    <Button className="w-full text-red-600" variant="outline" disabled>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Category
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Grid3X3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a category to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Categories List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Categories</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Grid3X3 className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Category Name</th>
                  <th className="text-left py-2 px-4">Full Path</th>
                  <th className="text-left py-2 px-4">Level</th>
                  <th className="text-left py-2 px-4">Type</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">Products</th>
                  <th className="text-left py-2 px-4">Subcategories</th>
                  <th className="text-left py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {getAllCategories().map((category) => (
                  <tr key={category.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-2 px-4">
                      <div className="flex items-center">
                        {category.category_level > 1 && (
                          <span className="text-gray-400 mr-2">
                            {'— '.repeat(category.category_level - 1)}
                          </span>
                        )}
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600">{category.category_path}</td>
                    <td className="py-2 px-4 text-sm">{category.category_level}</td>
                    <td className="py-2 px-4">
                      <Badge variant={category.is_leaf ? 'default' : 'secondary'}>
                        {category.is_leaf ? 'Leaf' : 'Parent'}
                      </Badge>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center">
                        {category.is_active ? (
                          <Eye className="h-4 w-4 text-green-600 mr-1" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400 mr-1" />
                        )}
                        <Badge variant={category.is_active ? 'default' : 'secondary'}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm">{category.productCount || 0}</td>
                    <td className="py-2 px-4 text-sm">
                      {category.children ? category.children.length : 0}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCategory(category)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/products/categories/${category.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {category.productCount === 0 && (!category.children || category.children.length === 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <CategoriesContent />
    </ProtectedRoute>
  );
}