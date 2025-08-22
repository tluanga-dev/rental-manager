'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemDetail } from '@/components/items/ItemDetail';
import { useAppStore } from '@/stores/app-store';
import { itemsApi } from '@/services/api/items';
import { 
  ArrowLeft,
  Package,
  ChevronRight,
  Loader2,
  Edit,
  RefreshCw,
  Warehouse,
  AlertCircle
} from 'lucide-react';
import type { Item } from '@/types/item';

function ItemDetailContentBySku() {
  const router = useRouter();
  const params = useParams();
  const { addNotification } = useAppStore();
  
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemSku = params.sku as string;

  useEffect(() => {
    if (itemSku) {
      loadItem();
    }
  }, [itemSku]);

  const loadItem = async () => {
    try {
      setLoading(true);
      setError(null);
      const itemData = await itemsApi.getBySku(itemSku);
      setItem(itemData);
    } catch (error: any) {
      console.error('Failed to load item:', error);
      
      let errorMessage = 'Failed to load item details.';
      
      if (error.response?.status === 404) {
        errorMessage = 'Item not found with the provided SKU.';
      } else if (error.response?.data?.detail) {
        // Handle detailed error messages from API
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // Handle validation errors array
          const validationErrors = error.response.data.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            return 'Validation error';
          }).join('; ');
          errorMessage = `Validation errors: ${validationErrors}`;
        } else {
          errorMessage = 'Server returned an error response.';
        }
      } else if (error.message && typeof error.message === 'string') {
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

  const handleEdit = (item: Item) => {
    router.push(`/products/items/${item.id}/edit`);
  };

  const handleRent = (item: Item) => {
    // TODO: Implement rental flow
    addNotification({
      type: 'info',
      title: 'Rental Feature',
      message: 'Rental functionality will be implemented in a future update.',
    });
  };

  const handleUpdateStock = (item: Item) => {
    // TODO: Implement stock update modal/flow
    addNotification({
      type: 'info',
      title: 'Stock Update',
      message: 'Stock update functionality will be implemented in a future update.',
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
              <p className="text-gray-600 mb-4">
                {typeof error === 'string' ? error : 'An unexpected error occurred.'}
              </p>
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
            <span className="truncate max-w-[200px]">
              {item?.item_name || 'Unknown Item'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {item.initial_stock_quantity && item.initial_stock_quantity > 0 && (
            <Button onClick={() => handleRent(item)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rent Item
            </Button>
          )}
          <Button variant="outline" onClick={() => handleUpdateStock(item)}>
            <Warehouse className="h-4 w-4 mr-2" />
            Update Stock
          </Button>
          <Button variant="outline" onClick={() => handleEdit(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Item
          </Button>
        </div>
      </div>

      {/* Item Detail */}
      {item && typeof item === 'object' && item.id && (
        <ItemDetail
          item={item}
          onEdit={handleEdit}
          onRent={handleRent}
          onUpdateStock={handleUpdateStock}
        />
      )}
    </div>
  );
}

export default function ItemDetailPageBySku() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <ItemDetailContentBySku />
    </ProtectedRoute>
  );
}
