'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ItemList } from '@/components/items/ItemList';
import { useAppStore } from '@/stores/app-store';
import { itemsApi } from '@/services/api/items';
import { categoriesApi } from '@/services/api/categories';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { 
  Package, 
  Plus, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import type { Item, ItemSearchParams } from '@/types/item';
import type { CategoryResponse } from '@/services/api/categories';

function ItemsContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ItemSearchParams>({});
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
  }>({ open: false, itemId: '', itemName: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading items with params:', {
        ...filters,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        sort_by: 'item_name',
        sort_order: 'asc',
      });
      
      const response = await itemsApi.list({
        ...filters,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        sort_by: 'item_name',
        sort_order: 'asc',
      });
      
      console.log('Items API response:', response);
      console.log('Response type:', typeof response);
      console.log('Is array:', Array.isArray(response));
      console.log('Has items property:', 'items' in response);
      console.log('Items data:', response.items);
      console.log('Total count:', response.total);
      
      // Validate response structure
      if (response && typeof response === 'object' && 'items' in response) {
        setItems(response.items || []);
        setTotalCount(response.total || 0);
        console.log('Set items:', response.items?.length || 0, 'items');
      } else {
        console.error('Unexpected response format:', response);
        setItems([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      console.error('Error details:', error.response?.data || error.message);
      addNotification({
        type: 'error',
        title: 'Error Loading Items',
        message: 'Failed to load items. Please try again.',
      });
      // Set empty state on error
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize, addNotification]);

  // Load items when page, filters, or component mounts
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Load categories when component mounts
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoriesApi.list({ limit: 1000 }); // Get all categories
      setCategories(response.items);
      console.log('Loaded categories:', response.items?.length || 0);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Don't show error notification for categories as it's not critical
    }
  };

  // Create category lookup helper
  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId || !categories) return 'Uncategorized';
    const category = categories.find(cat => cat.id === categoryId);
    return category?.category_name || category?.name || 'Uncategorized';
  };

  const handleFilter = (newFilters: ItemSearchParams) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreateItem = () => {
    router.push('/products/items/new');
  };

  const handleEditItem = (itemId: string) => {
    router.push(`/products/items/${itemId}/edit`);
  };

  const handleViewItem = (itemId: string) => {
    router.push(`/products/items/${itemId}`);
  };

  const handleDeleteItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setDeleteDialog({
        open: true,
        itemId,
        itemName: item.item_name,
      });
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await itemsApi.delete(deleteDialog.itemId);
      
      addNotification({
        type: 'success',
        title: 'Item Deleted',
        message: `Item "${deleteDialog.itemName}" has been deleted successfully.`,
      });
      
      // Refresh the items list
      await loadItems();
      
      setDeleteDialog({ open: false, itemId: '', itemName: '' });
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      
      addNotification({
        type: 'error',
        title: 'Error Deleting Item',
        message: 'Failed to delete item. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate stats - ensure items is defined and handle missing properties
  const safeItems = Array.isArray(items) ? items : [];
  const activeItems = safeItems.filter(item => item?.item_status === 'ACTIVE').length;
  const rentalItems = safeItems.filter(item => item?.is_rentable === true).length;
  const saleItems = safeItems.filter(item => item?.is_saleable === true).length;
  const discontinuedItems = safeItems.filter(item => item?.item_status === 'DISCONTINUED').length;
  const totalValue = safeItems.reduce((sum, item) => {
    const price = parseFloat(item?.purchase_price?.toString() || '0');
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const totalRentalValue = safeItems.reduce((sum, item) => {
    const rate = parseFloat(item?.rental_rate_per_period?.toString() || '0');
    return sum + (isNaN(rate) ? 0 : rate);
  }, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Items Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your rental inventory items
          </p>
        </div>
        <Button 
          onClick={handleCreateItem}
          disabled={loading}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalCount}
            </div>
            <p className="text-xs text-muted-foreground">All inventory items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeItems}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCount > 0 ? Math.round((activeItems / totalCount) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rental Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : rentalItems}
            </div>
            <p className="text-xs text-muted-foreground">Available for rent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sale Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : saleItems}
            </div>
            <p className="text-xs text-muted-foreground">Available for sale</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Discontinued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : discontinuedItems}
            </div>
            <p className="text-xs text-muted-foreground">No longer available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">Inventory worth</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-slate-100 rounded-lg mr-4">
                <Package className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Items</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : `${Math.round((activeItems / Math.max(totalCount, 1)) * 100)}%`}
                </p>
                <p className="text-sm text-gray-500">Currently active items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mr-4">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Daily Rental Potential</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : formatCurrency(totalRentalValue)}
                </p>
                <p className="text-sm text-gray-500">If all items rented</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mr-4">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Type Distribution</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : `${rentalItems}R / ${saleItems}S`}
                </p>
                <p className="text-sm text-gray-500">Rental / Sale items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items List */}
      <ItemList
        items={items}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onFilter={handleFilter}
        onCreateItem={handleCreateItem}
        onEditItem={handleEditItem}
        onViewItem={handleViewItem}
        onDeleteItem={handleDeleteItem}
        isLoading={loading}
        getCategoryName={getCategoryName}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !isDeleting && setDeleteDialog(prev => ({ ...prev, open }))}
        title="Delete Item"
        description={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

export default function ItemsPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <ItemsContent />
    </ProtectedRoute>
  );
}