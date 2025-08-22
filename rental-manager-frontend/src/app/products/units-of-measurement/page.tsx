'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { unitOfMeasurementApi } from '@/services/api/unit-of-measurement';
import { unitOfMeasurementKeys } from '@/lib/query-keys';
import { 
  UnitOfMeasurementForm, 
  UnitOfMeasurementList, 
  useUnitsOfMeasurement,
  type UnitFilters 
} from '@/components/units-of-measurement';
import type { 
  UnitOfMeasurement, 
  CreateUnitOfMeasurementRequest,
  UnitOfMeasurementUpdateFormData 
} from '@/types/unit-of-measurement';

function UnitsOfMeasurementContent() {
  const { addNotification } = useAppStore();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasurement | null>(null);
  
  // List state
  const [filters, setFilters] = useState<UnitFilters>({
    is_active: 'ALL',
    has_code: 'ALL',
    sort_field: 'name',
    sort_direction: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Data fetching
  const { 
    data: unitsResponse, 
    isLoading, 
    error: fetchError,
    refetch 
  } = useUnitsOfMeasurement({
    search: searchQuery,
    page: currentPage,
    page_size: pageSize,
    sort_field: filters.sort_field,
    sort_direction: filters.sort_direction,
    is_active: filters.is_active === 'ALL' ? undefined : filters.is_active,
    includeInactive: filters.is_active === 'ALL' || filters.is_active === false,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateUnitOfMeasurementRequest) => unitOfMeasurementApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Unit Created',
        message: `Unit "${data.name}" has been created successfully.`,
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error.response?.data?.detail || 'Failed to create unit. Please try again.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UnitOfMeasurementUpdateFormData }) => 
      unitOfMeasurementApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Unit Updated',
        message: `Unit "${data.name}" has been updated successfully.`,
      });
      setIsEditDialogOpen(false);
      setSelectedUnit(null);
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.response?.data?.detail || 'Failed to update unit. Please try again.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitOfMeasurementApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Unit Deleted',
        message: 'Unit has been deleted successfully.',
      });
      setIsDeleteDialogOpen(false);
      setSelectedUnit(null);
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.response?.data?.detail || 'Failed to delete unit. Please try again.',
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => unitOfMeasurementApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Unit Activated',
        message: 'Unit has been activated successfully.',
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Activation Failed',
        message: error.response?.data?.detail || 'Failed to activate unit.',
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => unitOfMeasurementApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Unit Deactivated',
        message: 'Unit has been deactivated successfully.',
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Deactivation Failed',
        message: error.response?.data?.detail || 'Failed to deactivate unit.',
      });
    },
  });

  const bulkActivateMutation = useMutation({
    mutationFn: (unitIds: string[]) => unitOfMeasurementApi.bulkOperation(unitIds, 'activate'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Bulk Activation Complete',
        message: `${result.success_count} units activated successfully.`,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Bulk Activation Failed',
        message: error.response?.data?.detail || 'Failed to activate units.',
      });
    },
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: (unitIds: string[]) => unitOfMeasurementApi.bulkOperation(unitIds, 'deactivate'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Bulk Deactivation Complete',
        message: `${result.success_count} units deactivated successfully.`,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Bulk Deactivation Failed',
        message: error.response?.data?.detail || 'Failed to deactivate units.',
      });
    },
  });

  // Event handlers
  const handleCreateUnit = useCallback((data: CreateUnitOfMeasurementRequest) => {
    createMutation.mutate(data);
  }, [createMutation]);

  const handleUpdateUnit = useCallback((data: UnitOfMeasurementUpdateFormData) => {
    if (!selectedUnit) return;
    updateMutation.mutate({ id: selectedUnit.id, data });
  }, [selectedUnit, updateMutation]);

  const handleDeleteUnit = useCallback((unit: UnitOfMeasurement) => {
    setSelectedUnit(unit);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selectedUnit) return;
    deleteMutation.mutate(selectedUnit.id);
  }, [selectedUnit, deleteMutation]);

  const handleEditUnit = useCallback((unit: UnitOfMeasurement) => {
    setSelectedUnit(unit);
    setIsEditDialogOpen(true);
  }, []);

  const handleActivateUnit = useCallback((unit: UnitOfMeasurement) => {
    activateMutation.mutate(unit.id);
  }, [activateMutation]);

  const handleDeactivateUnit = useCallback((unit: UnitOfMeasurement) => {
    deactivateMutation.mutate(unit.id);
  }, [deactivateMutation]);

  const handleBulkActivate = useCallback((unitIds: string[]) => {
    bulkActivateMutation.mutate(unitIds);
  }, [bulkActivateMutation]);

  const handleBulkDeactivate = useCallback((unitIds: string[]) => {
    bulkDeactivateMutation.mutate(unitIds);
  }, [bulkDeactivateMutation]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page
  }, []);

  const handleFilter = useCallback((newFilters: UnitFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page
  }, []);

  const handleSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sort_field: field, sort_direction: direction }));
  }, []);

  const handleExport = useCallback(async (includeInactive: boolean) => {
    try {
      const data = await unitOfMeasurementApi.export(includeInactive);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `units-of-measurement-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      addNotification({
        type: 'success',
        title: 'Export Complete',
        message: 'Units of measurement exported successfully.',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export units.',
      });
    }
  }, [addNotification]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await unitOfMeasurementApi.import(data);
      
      queryClient.invalidateQueries({ queryKey: unitOfMeasurementKeys.all });
      addNotification({
        type: 'success',
        title: 'Import Complete',
        message: `${result.successful_imports} units imported successfully.`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: 'Failed to import units. Please check the file format.',
      });
    }
  }, [queryClient, addNotification]);

  // Calculate stats
  const units = unitsResponse?.items || [];
  const totalUnits = unitsResponse?.total || 0;
  const activeUnits = units.filter(u => u.is_active).length;
  const unitsWithCode = units.filter(u => u.code).length;
  const recentUnits = units.filter(u => {
    const createdDate = new Date(u.created_at);
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
            Units of Measurement
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage measurement units for your inventory items
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={isLoading}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Add Unit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalUnits}
            </div>
            <p className="text-xs text-muted-foreground">All measurement units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeUnits}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalUnits > 0 ? Math.round((activeUnits / totalUnits) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : unitsWithCode}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalUnits > 0 ? Math.round((unitsWithCode / totalUnits) * 100) : 0}% have codes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : recentUnits}
            </div>
            <p className="text-xs text-muted-foreground">Recent additions</p>
          </CardContent>
        </Card>
      </div>

      {/* Units List */}
      <UnitOfMeasurementList
        units={units}
        isLoading={isLoading}
        error={fetchError?.message}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onSort={handleSort}
        onRefresh={refetch}
        onEdit={handleEditUnit}
        onDelete={handleDeleteUnit}
        onActivate={handleActivateUnit}
        onDeactivate={handleDeactivateUnit}
        onBulkActivate={handleBulkActivate}
        onBulkDeactivate={handleBulkDeactivate}
        onExport={handleExport}
        onImport={handleImport}
        onCreate={() => setIsCreateDialogOpen(true)}
        currentPage={currentPage}
        totalPages={unitsResponse?.total_pages || 1}
        pageSize={pageSize}
        total={totalUnits}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Create Unit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Unit</DialogTitle>
            <DialogDescription>
              Add a new unit of measurement to your inventory system.
            </DialogDescription>
          </DialogHeader>
          <UnitOfMeasurementForm
            onSubmit={handleCreateUnit}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={createMutation.isPending}
            error={createMutation.error?.message}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Unit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>
              Update the unit information.
            </DialogDescription>
          </DialogHeader>
          <UnitOfMeasurementForm
            onSubmit={handleUpdateUnit}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setSelectedUnit(null);
            }}
            initialData={selectedUnit || undefined}
            isLoading={updateMutation.isPending}
            isEditing={true}
            error={updateMutation.error?.message}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <DialogTitle>Delete Unit</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete "{selectedUnit?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UnitsOfMeasurementPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <UnitsOfMeasurementContent />
    </ProtectedRoute>
  );
}