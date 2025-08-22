'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  MoreHorizontal,
  Package,
  Eye,
  Edit,
  ArrowRightLeft,
  Wrench,
  AlertTriangle,
  Download,
  Upload,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory';
import { useInventoryStore, selectHasActiveFilters } from '@/stores/inventory-store';
import type { InventoryUnit, InventoryStatus, ConditionGrade } from '@/types/inventory';

const statusOptions: { value: InventoryStatus; label: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-500' },
  { value: 'RESERVED', label: 'Reserved', color: 'bg-yellow-500' },
  { value: 'RENTED', label: 'Rented', color: 'bg-slate-500' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-purple-500' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'bg-orange-500' },
  { value: 'INSPECTION', label: 'Inspection', color: 'bg-indigo-500' },
  { value: 'DAMAGED', label: 'Damaged', color: 'bg-red-500' },
  { value: 'LOST', label: 'Lost', color: 'bg-gray-500' },
  { value: 'SOLD', label: 'Sold', color: 'bg-gray-400' },
];

const conditionOptions: { value: ConditionGrade; label: string; color: string }[] = [
  { value: 'A', label: 'Grade A', color: 'bg-green-100 text-green-800' },
  { value: 'B', label: 'Grade B', color: 'bg-slate-100 text-slate-800' },
  { value: 'C', label: 'Grade C', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'D', label: 'Grade D', color: 'bg-red-100 text-red-800' },
];

interface InventoryListProps {
  onEditUnit?: (unit: InventoryUnit) => void;
  onInspectUnit?: (unit: InventoryUnit) => void;
  onTransferUnit?: (unit: InventoryUnit) => void;
}

export function InventoryList({
  onEditUnit,
  onInspectUnit,
  onTransferUnit,
}: InventoryListProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InventoryStatus | 'all'>('all');
  const [selectedCondition, setSelectedCondition] = useState<ConditionGrade | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<InventoryStatus | null>(null);
  const [statusChangeNotes, setStatusChangeNotes] = useState('');

  const {
    filters,
    selectedUnits,
    setFilters,
    resetFilters,
    toggleUnitSelection,
    clearSelectedUnits,
    setLoadingState,
  } = useInventoryStore((state) => ({
    filters: state.filters,
    selectedUnits: state.selectedUnits,
    setFilters: state.setFilters,
    resetFilters: state.resetFilters,
    toggleUnitSelection: state.toggleUnitSelection,
    clearSelectedUnits: state.clearSelectedUnits,
    setLoadingState: state.setLoadingState,
  }));

  const hasActiveFilters = useInventoryStore(selectHasActiveFilters);

  // Update filters when local state changes
  useEffect(() => {
    const newFilters: any = { search: searchTerm };
    
    if (selectedStatus !== 'all') {
      newFilters.statuses = [selectedStatus];
    } else {
      newFilters.statuses = [];
    }
    
    if (selectedCondition !== 'all') {
      newFilters.condition_grades = [selectedCondition];
    } else {
      newFilters.condition_grades = [];
    }
    
    setFilters(newFilters);
  }, [searchTerm, selectedStatus, selectedCondition, setFilters]);

  // Fetch inventory units
  const { data: units = [], isLoading, refetch } = useQuery({
    queryKey: ['inventory-units', filters],
    queryFn: () => inventoryUnitsApi.list(filters),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ unitId, status, notes }: { unitId: string; status: InventoryStatus; notes?: string }) =>
      inventoryUnitsApi.updateStatus(unitId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      setStatusChangeDialog(false);
      setSelectedUnit(null);
      setNewStatus(null);
      setStatusChangeNotes('');
    },
  });

  useEffect(() => {
    setLoadingState('units', isLoading);
  }, [isLoading, setLoadingState]);

  const handleStatusChange = () => {
    if (selectedUnit && newStatus) {
      updateStatusMutation.mutate({
        unitId: selectedUnit.id,
        status: newStatus,
        notes: statusChangeNotes,
      });
    }
  };

  const handleBulkOperation = (operation: string) => {
    console.log(`Bulk operation: ${operation} on ${selectedUnits.length} units`);
    // Implement bulk operations
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Units</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and quick filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by serial number, SKU, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.color}`} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCondition} onValueChange={(value) => setSelectedCondition(value as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  {conditionOptions.map((condition) => (
                    <SelectItem key={condition.value} value={condition.value}>
                      <Badge className={condition.color}>{condition.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? 'border-slate-500' : ''}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {/* Bulk actions */}
            {selectedUnits.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('transfer')}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('status')}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Update Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('export')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearSelectedUnits}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inventory table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No inventory units found</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={resetFilters}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUnits.length === units.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          units.forEach((unit) => {
                            if (!selectedUnits.includes(unit.id)) {
                              toggleUnitSelection(unit.id);
                            }
                          });
                        } else {
                          clearSelectedUnits();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Serial/Batch</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Rental Rate</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUnits.includes(unit.id)}
                        onCheckedChange={() => toggleUnitSelection(unit.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {unit.batch_code && (
                          <div className="text-xs text-blue-600">Batch: {unit.batch_code}</div>
                        )}
                        {unit.serial_number && (
                          <div className="text-xs text-gray-600">SN: {unit.serial_number}</div>
                        )}
                        {!unit.batch_code && !unit.serial_number && 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{unit.sku}</TableCell>
                    <TableCell>{unit.location_id}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          statusOptions.find((s) => s.value === unit.status)?.color
                        }
                      >
                        {statusOptions.find((s) => s.value === unit.status)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          conditionOptions.find((c) => c.value === unit.condition)?.color
                        }
                      >
                        {unit.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {unit.quantity || 1}
                    </TableCell>
                    <TableCell>{formatCurrency(unit.purchase_price)}</TableCell>
                    <TableCell>{formatCurrency(unit.sale_price)}</TableCell>
                    <TableCell>
                      {unit.rental_rate_per_period ? (
                        <div>
                          {formatCurrency(unit.rental_rate_per_period)}
                          <span className="text-xs text-gray-500">/{unit.rental_period}d</span>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {unit.warranty_period_days > 0 ? (
                        <div className="text-xs">
                          {unit.warranty_period_days} days
                          {unit.warranty_expiry && (
                            <div className="text-gray-500">
                              Exp: {formatDate(unit.warranty_expiry)}
                            </div>
                          )}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onEditUnit?.(unit)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUnit(unit);
                              setStatusChangeDialog(true);
                            }}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Change Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onInspectUnit?.(unit)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Inspect
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onTransferUnit?.(unit)}>
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Transfer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Report Issue
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Status change dialog */}
      <Dialog open={statusChangeDialog} onOpenChange={setStatusChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Unit Status</DialogTitle>
            <DialogDescription>
              Update the status of unit {selectedUnit?.serial_number || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus || ''} onValueChange={(value) => setNewStatus(value as InventoryStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.color}`} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                placeholder="Add notes about this status change..."
                value={statusChangeNotes}
                onChange={(e) => setStatusChangeNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusChangeDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStatusChange}
                disabled={!newStatus || updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}