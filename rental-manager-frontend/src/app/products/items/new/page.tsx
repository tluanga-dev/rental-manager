'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemForm, type ItemFormData } from '@/components/items/ItemForm';
import { ItemCreationSuccessDialog } from '@/components/dialogs/ItemCreationSuccessDialog';
import { useAppStore } from '@/stores/app-store';
import { itemsApi } from '@/services/api/items';
import { 
  ArrowLeft,
  Package,
  ChevronRight,
  CheckCircle
} from 'lucide-react';

function NewItemContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdItem, setCreatedItem] = useState<any>(null);
  const formRef = useRef<any>(null);

  const handleSubmit = async (data: ItemFormData) => {
    setIsSubmitting(true);
    
    try {
      const newItem = await itemsApi.create(data);
      
      // Store the created item data
      setCreatedItem({
        id: newItem.id,
        item_name: newItem.item_name || data.item_name,
        sku: newItem.sku,
        is_rentable: newItem.is_rentable || data.is_rentable,
        is_salable: newItem.is_salable || data.is_salable,
        rental_rate_per_day: newItem.rental_rate_per_day || data.rental_rate_per_day,
        sale_price: newItem.sale_price || data.sale_price,
      });
      
      // Show success dialog instead of immediate redirect
      setShowSuccessDialog(true);
      
      // Don't show notification here - let the dialog handle it
    } catch (error: any) {
      console.error('Failed to create item:', error);
      console.error('Error response:', error.response);
      
      let errorMessage = 'Failed to create item. Please try again.';
      let errorTitle = 'Error Creating Item';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Customize error title based on status code
      if (error.response?.status === 409) {
        errorTitle = 'Duplicate Item';
      } else if (error.response?.status === 422) {
        errorTitle = 'Validation Error';
      } else if (error.response?.status === 500) {
        errorTitle = 'Server Error';
      }
      
      addNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewItem = () => {
    if (createdItem?.id) {
      setShowSuccessDialog(false);
      router.push(`/products/items/${createdItem.id}`);
    }
  };

  const handleCreateAnother = () => {
    setShowSuccessDialog(false);
    setCreatedItem(null);
    // Reset the form - this will need to be implemented in ItemForm
    if (formRef.current?.reset) {
      formRef.current.reset();
    }
    // Clear any validation states
    window.location.reload(); // Simple reload to reset everything
  };

  const handleGoToList = () => {
    setShowSuccessDialog(false);
    router.push('/products/items');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/products/items')}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
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
            <span>New Item</span>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Package className="h-8 w-8 text-slate-600" />
              Create New Item
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="submit-button"
                disabled={isSubmitting}
                className="min-w-[120px]"
                form="item-form"
              >
                {isSubmitting ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Item'
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ItemForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            submitLabel="Create Item"
            cancelLabel="Cancel"
            mode="create"
            hideButtons={true}
            formId="item-form"
          />
        </CardContent>
      </Card>

      {/* Success Dialog */}
      {createdItem && (
        <ItemCreationSuccessDialog
          open={showSuccessDialog}
          onOpenChange={setShowSuccessDialog}
          itemData={createdItem}
          onViewItem={handleViewItem}
          onCreateAnother={handleCreateAnother}
          onGoToList={handleGoToList}
          autoRedirectSeconds={5}
        />
      )}
    </div>
  );
}

export default function NewItemPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_CREATE']}>
      <NewItemContent />
    </ProtectedRoute>
  );
}