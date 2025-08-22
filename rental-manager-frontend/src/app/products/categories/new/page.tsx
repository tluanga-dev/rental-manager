'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Grid3X3,
  ChevronRight,
  Save,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { categoriesApi, type CategoryResponse } from '@/services/api/categories';

interface CategoryOption {
  id: string;
  name: string;
  path: string;
  level: number;
  isLeaf: boolean;
}

// Helper function to convert API response to form options
const convertToOption = (category: CategoryResponse): CategoryOption => ({
  id: category.id,
  name: category.name,
  path: category.category_path,
  level: category.category_level,
  isLeaf: category.is_leaf,
});

function NewCategoryContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [parentCategory, setParentCategory] = useState<string>('root');
  const [isLeaf, setIsLeaf] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Include all categories as potential parents (leaf categories can become parent categories)
  const parentOptions = categories;

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load categories on component mount
  useEffect(() => {
    if (!isMounted) return;
    
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        console.log('🔄 Loading parent categories from API...');
        
        // Use the available parents API which handles empty cases better
        const parentCategoriesResponse = await categoriesApi.getAvailableParents(undefined, { include_inactive: false });
        
        console.log('📨 Raw API response:', parentCategoriesResponse);
        
        // Validate response structure
        if (!Array.isArray(parentCategoriesResponse)) {
          console.error('❌ Invalid response structure:', parentCategoriesResponse);
          throw new Error('Invalid response structure from parent categories API');
        }
        
        // Convert response items to options
        const apiCategories = parentCategoriesResponse.map(convertToOption);
        
        // Add a root option for top-level categories
        const categoriesWithRoot: CategoryOption[] = [
          { id: 'root', name: 'Root Category', path: '', level: 0, isLeaf: false },
          ...apiCategories
        ];
        
        setCategories(categoriesWithRoot);
        
        // Debug logging
        console.log(`📊 Loaded ${categoriesWithRoot.length} total parent categories`);
        console.log(`📋 Categories data:`, categoriesWithRoot);
        console.log(`📂 All categories available as parents:`, categoriesWithRoot.map(c => ({ id: c.id, name: c.name, isLeaf: c.isLeaf })));
      } catch (error) {
        console.error('❌ Error loading parent categories:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Always set fallback data with root category
        const fallbackCategories = [
          { id: 'root', name: 'Root Category', path: '', level: 0, isLeaf: false }
        ];
        setCategories(fallbackCategories);
        console.log('🔄 Set fallback categories:', fallbackCategories);
        
        addNotification({
          type: 'warning',
          title: 'Warning',
          message: 'Could not load existing parent categories. You can still create a root category.',
        });
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, [isMounted, addNotification]);

  const getSelectedParent = () => {
    return parentOptions.find(cat => cat.id === parentCategory);
  };

  const getCategoryLevel = () => {
    const parent = getSelectedParent();
    if (!parent || parent.id === 'root') return 1;
    return parent.level + 1;
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

    if (!parentCategory) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Parent category is required',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the API request payload
      const createPayload = {
        name: categoryName.trim(),
        parent_category_id: (!parentCategory || parentCategory === 'root') ? null : parentCategory,
        display_order: 0,
      };

      console.log('Creating category with payload:', createPayload);
      console.log('Parent category state:', parentCategory);
      console.log('Available categories:', categories.map(c => ({ id: c.id, name: c.name })));

      // Make API call to create category
      const createdCategory = await categoriesApi.create(createPayload);

      console.log('Category created successfully:', createdCategory);

      // Show success state
      setIsSuccess(true);

      addNotification({
        type: 'success',
        title: 'Category Created Successfully',
        message: `Category "${createdCategory.name}" has been created at path: ${createdCategory.category_path}`,
      });

      // Redirect after showing success state
      setTimeout(() => {
        router.push('/products/categories');
      }, 1000);
    } catch (error: unknown) {
      console.error('Error creating category:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      let errorMessage = 'Failed to create category. Please try again.';
      let errorDetails = '';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { 
          response?: { 
            data?: { detail?: string | Array<any>; message?: string; };
            status?: number;
          } 
        };
        
        console.error('API Error Status:', apiError.response?.status);
        console.error('API Error Data:', apiError.response?.data);
        
        if (apiError.response?.data?.detail) {
          if (Array.isArray(apiError.response.data.detail)) {
            errorDetails = apiError.response.data.detail.map(d => d.msg || d).join(', ');
          } else {
            errorDetails = apiError.response.data.detail;
          }
        }
        
        errorMessage = errorDetails || apiError.response?.data?.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Category Creation Failed',
        message: errorMessage,
      });
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  const breadcrumbPath = getSelectedParent()?.path?.split('/').filter(Boolean) || [];

  // Don't render until mounted to prevent hydration mismatches
  if (!isMounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 relative">
      {/* Loading/Success Overlay */}
      {(isSubmitting || isSuccess) && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg flex items-center space-x-3">
            {isSuccess ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
            )}
            <div>
              <p className="font-medium">
                {isSuccess ? 'Category Created!' : 'Creating Category'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSuccess ? 'Redirecting to dashboard...' : 'Please wait...'}
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
            disabled={isSubmitting || isSuccess}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Create New Category
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Add a new category to organize your products
            </p>
          </div>
        </div>
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
                  disabled={isSubmitting || isSuccess}
                />
                <p className="text-sm text-gray-500 mt-1">
                  The name of the category as it will appear in the hierarchy
                </p>
              </div>

              <div>
                <Label htmlFor="parent-category">Parent Category*</Label>
                
                {isLoadingCategories ? (
                  <div className="flex items-center justify-center py-8 border border-dashed border-gray-300 rounded-md">
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading parent categories...</span>
                    </div>
                  </div>
                ) : (
                  <Combobox
                    options={(() => {
                      const options = parentOptions.map(cat => ({
                        value: cat.id,
                        label: cat.id === 'root' ? cat.name : `${'—'.repeat(Math.max(0, cat.level - 1))} ${cat.name}`,
                        level: cat.level
                      }));
                      console.log('📤 Combobox options:', options);
                      return options;
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
                    disabled={isSubmitting || isSuccess}
                  />
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Choose where this category should be placed in the hierarchy
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is-leaf">Leaf Category</Label>
                  <p className="text-sm text-gray-500">
                    Leaf categories can have products assigned to them
                  </p>
                </div>
                <Switch
                  id="is-leaf"
                  checked={isLeaf}
                  onCheckedChange={setIsLeaf}
                  disabled={isSubmitting || isSuccess}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this category..."
                  rows={3}
                  disabled={isSubmitting || isSuccess}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Full Category Path</Label>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    {breadcrumbPath.length > 0 && (
                      <>
                        {breadcrumbPath.map((part, index) => (
                          <div key={index} className="flex items-center">
                            {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
                            <span>{part}</span>
                          </div>
                        ))}
                        <ChevronRight className="h-4 w-4 mx-1" />
                      </>
                    )}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {categoryName || 'Category Name'}
                    </span>
                  </div>
                </div>

                <div>
                  <Label>Hierarchy Level</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Level {getCategoryLevel()}
                  </p>
                </div>

                <div>
                  <Label>Category Type</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {isLeaf ? 'Leaf Category (can have products)' : 'Parent Category (can have subcategories)'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-slate-100">
                  <Grid3X3 className="h-5 w-5 inline mr-2" />
                  Category Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                <p>• Categories can be nested up to unlimited levels</p>
                <p>• Only leaf categories can have products assigned</p>
                <p>• Parent categories can only contain subcategories</p>
                <p>• Category names should be clear and descriptive</p>
                <p>• Once created, the category type (leaf/parent) cannot be changed</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting || isSuccess}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSubmitting ? 'Creating Category...' : 'Create Category'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewCategoryPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <NewCategoryContent />
    </ProtectedRoute>
  );
}