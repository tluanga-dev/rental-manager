'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemForm } from '@/components/items/ItemForm';
import { useAppStore } from '@/stores/app-store';
import { itemsApi } from '@/services/api/items';
import { ItemUpdateSuccessDialog } from '@/components/dialogs/ItemUpdateSuccessDialog';
import { detectChanges } from '@/utils/item-change-detector';
import { 
  ArrowLeft,
  Package,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { Item } from '@/types/item';
import type { ItemFormData } from '@/components/items/ItemForm';
import type { FieldChange } from '@/utils/item-change-detector';

function EditItemContent() {
  const router = useRouter();
  const params = useParams();
  const { addNotification } = useAppStore();
  
  const [item, setItem] = useState<Item | null>(null);
  const [originalItem, setOriginalItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [itemChanges, setItemChanges] = useState<FieldChange[]>([]);
  const [updatedItemName, setUpdatedItemName] = useState<string>('');

  const itemId = params.id as string;

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      setError(null);
      const itemData = await itemsApi.getById(itemId);
      setItem(itemData);
      setOriginalItem(itemData); // Store original for change detection
    } catch (error: any) {
      console.error('Failed to load item:', error);
      
      let errorMessage = 'Failed to load item details.';
      if (error.response?.status === 404) {
        errorMessage = 'Item not found.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Error Loading Item',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ItemFormData) => {
    if (!item || !originalItem) return;
    
    setIsSubmitting(true);
    
    try {
      const updatedItem = await itemsApi.update(item.id, data);
      
      // Detect changes made
      const changes = detectChanges(originalItem, data);
      setItemChanges(changes);
      setUpdatedItemName(data.item_name || originalItem.item_name);
      
      // Update the current item with new data
      setItem(updatedItem);
      setOriginalItem(updatedItem); // Update original for next edit
      
      // Show success dialog
      setShowSuccessDialog(true);
      
    } catch (error: any) {
      console.error('Failed to update item:', error);
      
      let errorMessage = 'Failed to update item. Please try again.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Error Updating Item',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/products/items/${itemId}`);
  };

  const handleViewItem = () => {
    setShowSuccessDialog(false);
    router.push(`/products/items/${itemId}`);
  };

  const handleContinueEditing = () => {
    setShowSuccessDialog(false);
    // Reset notification to show user can continue editing
    addNotification({
      type: 'info',
      title: 'Continue Editing',
      message: 'You can continue making changes to the item.',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
            <p className="text-gray-600">Loading item details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/products/items')}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
          </Button>
        </div>

        {/* Error State */}
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Unable to Load Item
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-2">
                <Button onClick={loadItem} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={() => router.push('/products/items')}>
                  Back to Items
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/products/items/${itemId}`)}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Item
          </Button>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>Products</span>
            <ChevronRight className="h-4 w-4" />
            <span 
              className="text-slate-600 hover:text-slate-800 cursor-pointer"
              onClick={() => router.push('/products/items')}
            >
              Items
            </span>
            <ChevronRight className="h-4 w-4" />
            <span 
              className="text-slate-600 hover:text-slate-800 cursor-pointer truncate max-w-[150px]"
              onClick={() => router.push(`/products/items/${itemId}`)}
            >
              {item.item_name}
            </span>
            <ChevronRight className="h-4 w-4" />
            <span>Edit</span>
          </div>
        </div>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Package className="h-8 w-8 text-slate-600" />
          Edit Item: {item.item_name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Update the item details below. All changes will be saved to your inventory.
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemForm
            initialData={item}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            submitLabel="Update Item"
            cancelLabel="Cancel"
            mode="edit"
          />
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <ItemUpdateSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        itemName={updatedItemName}
        changes={itemChanges}
        onViewItem={handleViewItem}
        onContinueEditing={handleContinueEditing}
        autoRedirectSeconds={10}
      />
    </div>
  );
}

export default function EditItemPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_UPDATE']}>
      <EditItemContent />
    </ProtectedRoute>
  );
}