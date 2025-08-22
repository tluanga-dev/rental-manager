'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Edit,
  Trash2,
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { brandsApi, Brand, BrandCreate, BrandUpdate } from '@/services/api/brands';

function BrandsContent() {
  const { addNotification } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [totalBrands, setTotalBrands] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Form states
  const [brandName, setBrandName] = useState('');
  const [brandCode, setBrandCode] = useState('');
  const [description, setDescription] = useState('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Load brands on component mount and when search changes
  useEffect(() => {
    loadBrands();
  }, [searchTerm]);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const response = await brandsApi.list({
        page_size: 100, // Maximum allowed page size
        search: searchTerm || undefined,
        is_active: true
      });
      setBrands(response.items);
      setTotalBrands(response.total);
    } catch (error: any) {
      console.error('Failed to load brands:', error);
      setBrands([]); // Reset to empty array on error
      setTotalBrands(0);
      
      // More specific error handling based on error type
      let errorMessage = 'Failed to load brands. Please try again.';
      let errorTitle = 'Error Loading Brands';
      
      if (error.message?.includes('Unable to connect')) {
        errorTitle = 'Connection Issue';
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.response?.status === 401) {
        errorTitle = 'Authentication Required';
        errorMessage = 'Please log in to view brands.';
      } else if (error.response?.status === 403) {
        errorTitle = 'Access Denied';
        errorMessage = 'You do not have permission to view brands.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      addNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!brandName.trim()) {
      errors.brandName = 'Brand name is required';
    }

    if (brandCode && !/^[A-Z0-9_-]+$/.test(brandCode)) {
      errors.brandCode = 'Brand code can only contain letters, numbers, hyphens, and underscores';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setBrandName('');
    setBrandCode('');
    setDescription('');
    setFormErrors({});
    setError(null);
  };

  const handleAddBrand = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const brandData: BrandCreate = {
        name: brandName.trim(),
        code: brandCode.trim() || undefined,
        description: description.trim() || undefined,
      };

      await brandsApi.create(brandData);
      
      setSuccessMessage(`Brand "${brandName}" has been created successfully`);
      setIsSuccessDialogOpen(true);
      setIsAddDialogOpen(false);
      resetForm();
      
      // Reload brands list with error handling that doesn't interfere with success
      try {
        await loadBrands();
      } catch (refreshError) {
        console.warn('Failed to refresh brands list after creation, but brand was created successfully:', refreshError);
        // Add a more specific notification that doesn't override the success
        addNotification({
          type: 'warning',
          title: 'Refresh Warning',
          message: 'Brand created successfully, but list refresh failed. Please refresh the page to see the new brand.',
        });
      }
    } catch (error: any) {
      console.error('Failed to create brand:', error);
      let errorMessage = 'Failed to create brand. Please try again.';
      
      // Handle different types of errors
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setIsErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBrand = async () => {
    if (!selectedBrand || !validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const brandData: BrandUpdate = {
        name: brandName.trim(),
        code: brandCode.trim() || undefined,
        description: description.trim() || undefined,
      };

      await brandsApi.update(selectedBrand.id, brandData);
      
      setSuccessMessage(`Brand "${brandName}" has been updated successfully`);
      setIsSuccessDialogOpen(true);
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedBrand(null);
      
      // Reload brands list with error handling that doesn't interfere with success
      try {
        await loadBrands();
      } catch (refreshError) {
        console.warn('Failed to refresh brands list after update, but brand was updated successfully:', refreshError);
        // Add a more specific notification that doesn't override the success
        addNotification({
          type: 'warning',
          title: 'Refresh Warning',
          message: 'Brand updated successfully, but list refresh failed. Please refresh the page to see the changes.',
        });
      }
    } catch (error: any) {
      console.error('Failed to update brand:', error);
      let errorMessage = 'Failed to update brand. Please try again.';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setIsErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brand: Brand) => {
    try {
      await brandsApi.delete(brand.id);
      
      setSuccessMessage(`Brand "${brand.name}" has been deleted successfully`);
      setIsSuccessDialogOpen(true);
      
      // Reload brands list with error handling that doesn't interfere with success
      try {
        await loadBrands();
      } catch (refreshError) {
        console.warn('Failed to refresh brands list after deletion, but brand was deleted successfully:', refreshError);
        // Add a more specific notification that doesn't override the success
        addNotification({
          type: 'warning',
          title: 'Refresh Warning',
          message: 'Brand deleted successfully, but list refresh failed. Please refresh the page to see the changes.',
        });
      }
    } catch (error: any) {
      console.error('Failed to delete brand:', error);
      let errorMessage = 'Failed to delete brand. Please try again.';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification({
        type: 'error',
        title: 'Error Deleting Brand',
        message: errorMessage,
      });
    }
  };

  const openEditDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setBrandName(brand.name);
    setBrandCode(brand.code || '');
    setDescription(brand.description || '');
    setFormErrors({});
    setError(null);
    setIsEditDialogOpen(true);
  };

  const filteredBrands = (brands || []).filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (brand.code && brand.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate stats
  const activeBrands = (brands || []).filter(b => b.is_active).length;
  const recentBrands = (brands || []).filter(b => {
    if (!b.created_at) return false;
    const createdDate = new Date(b.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return createdDate > thirtyDaysAgo;
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Brand Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage product brands and manufacturers
          </p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
          disabled={loading}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalBrands}
            </div>
            <p className="text-xs text-muted-foreground">All registered brands</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeBrands}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBrands > 0 ? Math.round((activeBrands / totalBrands) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : ((brands && brands[0])?.name || '-')}
            </div>
            <p className="text-xs text-muted-foreground">Most recent brand</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : recentBrands}
            </div>
            <p className="text-xs text-muted-foreground">Latest additions</p>
          </CardContent>
        </Card>
      </div>

      {/* Brands Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Brands</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
                disabled={loading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading brands...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Brand Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBrands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No brands found matching your search.' : 'No brands found. Add your first brand to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBrands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-2 text-gray-400" />
                          {brand.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {brand.code ? (
                          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {brand.code}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {brand.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={brand.is_active ? 'default' : 'secondary'}>
                          {brand.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {brand.updated_at ? new Date(brand.updated_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(brand)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBrand(brand)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Brand Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Brand</DialogTitle>
            <DialogDescription>
              Create a new brand for your products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="brand-name">Brand Name*</Label>
              <Input
                id="brand-name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g., Canon"
                className={formErrors.brandName ? 'border-red-500' : ''}
              />
              {formErrors.brandName && (
                <p className="text-sm text-red-600 mt-1">{formErrors.brandName}</p>
              )}
            </div>
            <div>
              <Label htmlFor="brand-code">Brand Code</Label>
              <Input
                id="brand-code"
                value={brandCode}
                onChange={(e) => setBrandCode(e.target.value.toUpperCase())}
                placeholder="e.g., CANON"
                className={`uppercase ${formErrors.brandCode ? 'border-red-500' : ''}`}
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional. Alphanumeric code, hyphens and underscores allowed
              </p>
              {formErrors.brandCode && (
                <p className="text-sm text-red-600 mt-1">{formErrors.brandCode}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the brand..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddBrand} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Brand'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Brand Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
            <DialogDescription>
              Update brand information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-brand-name">Brand Name*</Label>
              <Input
                id="edit-brand-name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className={formErrors.brandName ? 'border-red-500' : ''}
              />
              {formErrors.brandName && (
                <p className="text-sm text-red-600 mt-1">{formErrors.brandName}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-brand-code">Brand Code</Label>
              <Input
                id="edit-brand-code"
                value={brandCode}
                onChange={(e) => setBrandCode(e.target.value.toUpperCase())}
                className={`uppercase ${formErrors.brandCode ? 'border-red-500' : ''}`}
              />
              {formErrors.brandCode && (
                <p className="text-sm text-red-600 mt-1">{formErrors.brandCode}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditBrand} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Brand'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle className="text-green-900 dark:text-green-100">
                Success
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-green-700 dark:text-green-300">
            {successMessage}
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setIsSuccessDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <DialogTitle className="text-red-900 dark:text-red-100">
                Error
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-red-700 dark:text-red-300">
            {error}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setIsErrorDialogOpen(false)}
              variant="outline"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                setIsErrorDialogOpen(false);
                setError(null);
              }}
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BrandsPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <BrandsContent />
    </ProtectedRoute>
  );
}