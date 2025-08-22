'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { 
  ArrowLeft,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Move,
  Eye,
  EyeOff,
  Package,
  Folder
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { categoriesApi, type CategoryResponse, type CategoryUpdate } from '@/services/api/categories';
import { categoryKeys } from '@/lib/query-keys';

interface CategoryOption {
  id: string;
  name: string;
  path: string;
  level: number;
  isLeaf: boolean;
}

const convertToOption = (category: CategoryResponse): CategoryOption => ({
  id: category.id,
  name: category.name,
  path: category.category_path,
  level: category.category_level,
  isLeaf: category.is_leaf,
});

function EditCategoryContent() {
  const router = useRouter();
  const params = useParams();
  const { addNotification } = useAppStore();
  const queryClient = useQueryClient();
  const categoryId = params?.id as string;
  
  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [parentCategory, setParentCategory] = useState<string>('root');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLeaf, setIsLeaf] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [originalValues, setOriginalValues] = useState<any>(null);

  // React Query hooks
  const { data: category, isLoading } = useQuery({
    queryKey: categoryKeys.detail(categoryId),
    queryFn: () => categoriesApi.getById(categoryId),
    enabled: !!categoryId,
  });

  const { data: availableParents = [], isLoading: isLoadingParents } = useQuery({
    queryKey: categoryKeys.parents(categoryId, false),
    queryFn: () => categoriesApi.getAvailableParents(categoryId, { include_inactive: false }),
    enabled: !!categoryId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CategoryUpdate) => categoriesApi.update(categoryId, data),
    onSuccess: (updatedCategory) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      setIsSuccess(true);
      addNotification({
        type: 'success',
        title: 'Category Updated Successfully',
        message: `Category "${updatedCategory.name}" has been updated.`,
      });
      setTimeout(() => {
        router.push('/products/categories');
      }, 1000);
    },
    onError: (error: unknown) => {
      console.error('Error updating category:', error);
      
      let errorMessage = 'Failed to update category. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { 
          response?: { 
            data?: { detail?: string | Array<any>; message?: string; };
            status?: number;
          } 
        };
        
        if (apiError.response?.data?.detail) {
          if (Array.isArray(apiError.response.data.detail)) {
            errorMessage = apiError.response.data.detail.map(d => d.msg || d).join(', ');
          } else {
            errorMessage = apiError.response.data.detail;
          }
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Category Update Failed',
        message: errorMessage,
      });
    },
  });

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize form when category data is loaded
  useEffect(() => {
    if (category) {
      setCategoryName(category.name);
      setParentCategory(category.parent_category_id || 'root');
      setDescription(category.description || '');
      setIsActive(category.is_active);
      setIsLeaf(category.is_leaf);
      
      // Store original values for comparison
      const originals = {
        name: category.name,
        parent_category_id: category.parent_category_id || 'root',
        description: category.description || '',
        is_active: category.is_active,
        is_leaf: category.is_leaf,
      };
      setOriginalValues(originals);
    }
  }, [category]);

  const getSelectedParent = () => {
    if (parentCategory === 'root') {
      return { id: 'root', name: 'Root Category', path: '', level: 0, isLeaf: false };
    }
    return availableParents.find(cat => cat.id === parentCategory);
  };

  const getCategoryLevel = () => {
    const parent = getSelectedParent();
    if (!parent || parent.id === 'root') return 1;
    return parent.level + 1;
  };

  const getChangedFields = (): Partial<CategoryUpdate> => {
    if (!originalValues) return {};
    
    const changes: Partial<CategoryUpdate> = {};
    
    if (categoryName.trim() !== originalValues.name) {
      changes.name = categoryName.trim();
    }
    
    if (parentCategory !== originalValues.parent_category_id) {
      changes.parent_category_id = parentCategory === 'root' ? null : parentCategory;
    }
    
    if (description !== originalValues.description) {
      changes.description = description;
    }
    
    if (isActive !== originalValues.is_active) {
      changes.is_active = isActive;
    }
    
    if (isLeaf !== originalValues.is_leaf) {
      changes.is_leaf = isLeaf;
    }
    
    return changes;
  };

  const hasChanges = () => {
    const changes = getChangedFields();
    return Object.keys(changes).length > 0;
  };

  const validateLeafStatusChange = (): { isValid: boolean; message?: string } => {
    if (isLeaf !== originalValues?.is_leaf) {
      // Trying to change to leaf when category has children
      if (isLeaf && (category?.child_count ?? 0) > 0) {
        return {
          isValid: false,
          message: `Cannot change to leaf category because it has ${category?.child_count} subcategories. Remove subcategories first.`
        };
      }
      
      // Trying to change from leaf to parent when category has items
      if (!isLeaf && (category?.item_count ?? 0) > 0) {
        return {
          isValid: false,
          message: `Warning: Changing to parent category will affect ${category?.item_count} assigned products. Consider the impact before proceeding.`
        };
      }
    }
    return { isValid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Category name is required',
      });
      return;
    }

    if (!hasChanges()) {
      addNotification({
        type: 'info',
        title: 'No Changes',
        message: 'No changes were made to update.',
      });
      return;
    }

    // Validate leaf status change
    const leafValidation = validateLeafStatusChange();
    if (!leafValidation.isValid) {
      addNotification({
        type: 'error',
        title: 'Invalid Category Type Change',
        message: leafValidation.message || 'Cannot change category type.',
      });
      return;
    }

    const changes = getChangedFields();
    console.log('Updating category with changes:', changes);
    updateMutation.mutate(changes);
  };

  const breadcrumbPath = category?.category_path?.split('/').filter(Boolean) || [];

  // Don't render until mounted and data is loaded
  if (!isMounted || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2">Category Not Found</h2>
          <p className="text-gray-600 mb-4">The category you're looking for doesn't exist or you don't have permission to edit it.</p>
          <Button onClick={() => router.push('/products/categories')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 relative">
      {/* Loading/Success Overlay */}
      {(updateMutation.isPending || isSuccess) && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg flex items-center space-x-3">
            {isSuccess ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
            )}
            <div>
              <p className="font-medium">
                {isSuccess ? 'Category Updated!' : 'Updating Category'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSuccess ? 'Redirecting to categories...' : 'Please wait...'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            disabled={updateMutation.isPending || isSuccess}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Edit Category
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Modify category details and settings
            </p>
          </div>
        </div>
        {hasChanges() && (
          <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Unsaved changes
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Category Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="category-name">Category Name*</Label>
                <Input
                  id="category-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g., Mirrorless, Flash, Microphones"
                  required
                  disabled={updateMutation.isPending || isSuccess}
                />
                <p className="text-sm text-gray-500 mt-1">
                  The name of the category as it will appear in the hierarchy
                </p>
              </div>

              <div>
                <Label htmlFor="parent-category">Parent Category*</Label>
                
                {isLoadingParents ? (
                  <div className="flex items-center justify-center py-8 border border-dashed border-gray-300 rounded-md">
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading available parents...</span>
                    </div>
                  </div>
                ) : (
                  <Combobox
                    options={(() => {
                      const rootOption = { value: 'root', label: 'Root Category', level: 0 };
                      const parentOptions = availableParents.map(cat => ({
                        value: cat.id,
                        label: `${'—'.repeat(Math.max(0, cat.category_level - 1))} ${cat.name}`,
                        level: cat.category_level
                      }));
                      return [rootOption, ...parentOptions];
                    })()}
                    value={parentCategory}
                    onValueChange={(value) => {
                      console.log('📥 Selected parent category:', value);
                      setParentCategory(value);
                    }}
                    placeholder="Select parent category"
                    searchPlaceholder="Search categories..."
                    emptyText="No categories found"
                    className="w-full"
                    disabled={updateMutation.isPending || isSuccess}
                  />
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Choose where this category should be placed in the hierarchy
                </p>
                {parentCategory !== originalValues?.parent_category_id && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-center text-sm text-amber-700">
                      <Move className="h-4 w-4 mr-1" />
                      Moving this category will change its path and may affect subcategories
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this category..."
                  rows={3}
                  disabled={updateMutation.isPending || isSuccess}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is-active">Active Status</Label>
                  <p className="text-sm text-gray-500">
                    Inactive categories are hidden from product selection
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {isActive ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={updateMutation.isPending || isSuccess}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is-leaf">Category Type</Label>
                  <p className="text-sm text-gray-500">
                    Leaf categories can have products, parent categories can have subcategories
                  </p>
                  {(category?.child_count ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-1">
                      ⚠️ Cannot change to leaf: Has {category?.child_count} subcategories
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {isLeaf ? (
                    <Package className="h-4 w-4 text-green-600" />
                  ) : (
                    <Folder className="h-4 w-4 text-slate-600" />
                  )}
                  <Switch
                    id="is-leaf"
                    checked={isLeaf}
                    onCheckedChange={setIsLeaf}
                    disabled={updateMutation.isPending || isSuccess || (category?.child_count ?? 0) > 0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview and Current Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Category Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Current Path</Label>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                    {category.category_path}
                  </p>
                </div>

                <div>
                  <Label>Category Type</Label>
                  <p className="text-sm">
                    {category.is_leaf ? (
                      <span className="text-green-600">Leaf Category (can have products)</span>
                    ) : (
                      <span className="text-slate-600">Parent Category (can have subcategories)</span>
                    )}
                  </p>
                </div>

                <div>
                  <Label>Current Level</Label>
                  <p className="text-sm">Level {category.category_level}</p>
                </div>

                <div>
                  <Label>Status</Label>
                  <p className="text-sm">
                    {category.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {hasChanges() && (
              <Card className="bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-slate-100">
                    Preview Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {categoryName !== originalValues?.name && (
                    <div>
                      <Label>Name will change to:</Label>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{categoryName}</p>
                    </div>
                  )}
                  
                  {parentCategory !== originalValues?.parent_category_id && (
                    <div>
                      <Label>New parent:</Label>
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        {getSelectedParent()?.name || 'Root Category'}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        New level: {getCategoryLevel()}
                      </p>
                    </div>
                  )}

                  {isActive !== originalValues?.is_active && (
                    <div>
                      <Label>Status will change to:</Label>
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        {isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  )}

                  {isLeaf !== originalValues?.is_leaf && (
                    <div>
                      <Label>Category type will change to:</Label>
                      <div className="flex items-center">
                        {isLeaf ? (
                          <Package className="h-4 w-4 text-green-600 mr-2" />
                        ) : (
                          <Folder className="h-4 w-4 text-slate-600 mr-2" />
                        )}
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {isLeaf ? 'Leaf Category (can have products)' : 'Parent Category (can have subcategories)'}
                        </p>
                      </div>
                      {isLeaf && (category?.child_count ?? 0) > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ Warning: This category has {category?.child_count} subcategories
                        </p>
                      )}
                      {!isLeaf && (category?.item_count ?? 0) > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ Warning: This category has {category?.item_count} products assigned
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={updateMutation.isPending || isSuccess}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateMutation.isPending || !hasChanges()}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {updateMutation.isPending ? 'Updating Category...' : 'Update Category'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function EditCategoryPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <EditCategoryContent />
    </ProtectedRoute>
  );
}