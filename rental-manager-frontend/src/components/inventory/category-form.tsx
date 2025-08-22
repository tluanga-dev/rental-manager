'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { categorySchema, type CategoryFormData } from '@/lib/validations';
import { Category } from '@/types/api';
import { 
  Info, 
  ChevronRight, 
  Folder, 
  Package, 
  AlertTriangle,
  Check,
  X,
  Save,
  Loader2
} from 'lucide-react';

interface ExtendedCategoryFormData extends CategoryFormData {
  is_leaf?: boolean;
  is_active?: boolean;
  display_order?: number;
}

interface CategoryFormProps {
  onSubmit: (data: ExtendedCategoryFormData) => void;
  onCancel?: () => void;
  initialData?: Partial<ExtendedCategoryFormData>;
  parentCategories?: Category[];
  isLoading?: boolean;
  isEditing?: boolean;
}

export function CategoryForm({ 
  onSubmit, 
  onCancel,
  initialData, 
  parentCategories = [], 
  isLoading, 
  isEditing 
}: CategoryFormProps) {
  const form = useForm<ExtendedCategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      parent_id: initialData?.parent_id || undefined,
      is_leaf: initialData?.is_leaf ?? false,
      is_active: initialData?.is_active ?? true,
      display_order: initialData?.display_order || 0,
    },
  });

  const handleSubmit = (data: ExtendedCategoryFormData) => {
    onSubmit(data);
  };

  // Build hierarchical display names for parent categories
  const buildCategoryPath = (category: Category, allCategories: Category[]): string => {
    if (!category.parent_id) {
      return category.name;
    }
    
    const parent = allCategories.find(c => c.id === category.parent_id);
    if (parent) {
      return `${buildCategoryPath(parent, allCategories)} > ${category.name}`;
    }
    
    return category.name;
  };

  const availableParents = parentCategories.map(category => ({
    ...category,
    displayName: buildCategoryPath(category, parentCategories)
  }));

  const selectedParent = availableParents.find(p => p.id === form.watch('parent_id'));
  const isLeaf = form.watch('is_leaf');
  const isActive = form.watch('is_active');

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Single Comprehensive Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Folder className="h-5 w-5" />
              {isEditing ? 'Edit Category' : 'Create Category'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info - 2 column grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1">
                  Category Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="e.g., Cameras, Audio Equipment"
                  disabled={isLoading}
                  className="h-9"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="display_order" className="text-sm font-medium">Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  {...form.register('display_order', { valueAsNumber: true })}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                  className="h-9"
                />
              </div>
            </div>

            <Separator className="my-3" />

            {/* Parent Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="parent_id" className="text-sm font-medium">Parent Category</Label>
              <Select
                value={form.watch('parent_id') || 'none'}
                onValueChange={(value) => 
                  form.setValue('parent_id', value === 'none' ? undefined : value)
                }
                disabled={isLoading}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Folder className="h-3 w-3" />
                      <span className="text-sm">None (Root Category)</span>
                    </div>
                  </SelectItem>
                  {availableParents.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3" />
                        <span className="text-sm">{category.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Compact path preview */}
              {selectedParent && (
                <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/20 px-2 py-1 rounded">
                  <span>Path: </span>
                  <span className="text-slate-600">{selectedParent.displayName}</span>
                  <ChevronRight className="h-3 w-3 inline mx-1" />
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {form.watch('name') || 'New Category'}
                  </span>
                </div>
              )}
              
              {/* Help text for editing */}
              {isEditing && (
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                  <Info className="h-3 w-3 inline mr-1 text-blue-600" />
                  <span>Note: This category and its subcategories cannot be selected as parents to prevent circular references.</span>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            {/* Category Settings - Compact 2x2 grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <Label className="text-sm font-medium">Active Status</Label>
                  </div>
                  <Badge 
                    variant={isActive ? "default" : "secondary"} 
                    className={`text-xs ${
                      isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => form.setValue('is_active', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Category Type */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isLeaf ? (
                      <Package className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Folder className="h-4 w-4 text-purple-600" />
                    )}
                    <Label className="text-sm font-medium">Category Type</Label>
                  </div>
                  <Badge 
                    variant={isLeaf ? "default" : "secondary"} 
                    className={`text-xs ${
                      isLeaf ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {isLeaf ? 'Leaf (Products)' : 'Parent (Subcategories)'}
                  </Badge>
                </div>
                <Switch
                  checked={isLeaf}
                  onCheckedChange={(checked) => form.setValue('is_leaf', checked)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Description - Full width */}
            <div className="space-y-1">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Optional description for this category..."
                rows={2}
                disabled={isLoading}
                className="text-sm"
              />
            </div>

            {/* Compact Guidelines */}
            <div className="bg-slate-50 dark:bg-slate-900/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <p className="font-medium mb-1">Quick Tips:</p>
                  <p><strong>Leaf categories</strong> contain products, <strong>Parent categories</strong> contain subcategories. You can change these settings anytime.</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} size="sm">
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} size="sm">
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    {isEditing ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}