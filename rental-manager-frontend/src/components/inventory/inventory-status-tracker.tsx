'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Wrench, 
  Eye,
  RefreshCw,
  ArrowRight,
  History,
  Edit,
  MapPin,
  User
} from 'lucide-react';
import { 
  InventoryUnit, 
  InventoryMovement, 
  ConditionGrade, 
  MovementType 
} from '@/types/inventory';
import type { InventoryStatus } from '@/types/inventory';

// Define the inventory status values array since we can't use Object.values() on a union type
const INVENTORY_STATUS_VALUES: InventoryStatus[] = [
  'AVAILABLE',
  'RESERVED', 
  'RENTED',
  'IN_TRANSIT',
  'MAINTENANCE',
  'INSPECTION',
  'DAMAGED',
  'LOST',
  'SOLD'
];
import { Location, SKU } from '@/types/api';

interface InventoryStatusTrackerProps {
  inventoryUnits: InventoryUnit[];
  movements: InventoryMovement[];
  locations: Location[];
  skus: SKU[];
  onStatusChange: (unitId: string, newStatus: InventoryStatus, notes?: string) => void;
  onViewHistory: (unitId: string) => void;
  onBulkStatusChange: (unitIds: string[], newStatus: InventoryStatus, notes?: string) => void;
  isLoading?: boolean;
}

const statusIcons = {
  AVAILABLE: CheckCircle,
  RESERVED: Clock,
  RENTED: Package,
  IN_TRANSIT: RefreshCw,
  MAINTENANCE: Wrench,
  INSPECTION: Eye,
  DAMAGED: AlertTriangle,
  LOST: AlertTriangle,
  SOLD: Package,
};

const statusColors = {
  AVAILABLE: 'bg-green-100 text-green-800',
  RESERVED: 'bg-slate-100 text-slate-800',
  RENTED: 'bg-purple-100 text-purple-800',
  IN_TRANSIT: 'bg-orange-100 text-orange-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  INSPECTION: 'bg-cyan-100 text-cyan-800',
  DAMAGED: 'bg-red-100 text-red-800',
  LOST: 'bg-red-200 text-red-900',
  SOLD: 'bg-gray-100 text-gray-800',
};

const conditionColors = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-slate-100 text-slate-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-red-100 text-red-800',
};

// Define valid status transitions
const statusTransitions: Record<InventoryStatus, InventoryStatus[]> = {
  AVAILABLE: ['RESERVED', 'RENTED', 'MAINTENANCE', 'INSPECTION', 'DAMAGED', 'SOLD'],
  RESERVED: ['AVAILABLE', 'RENTED', 'IN_TRANSIT'],
  RENTED: ['IN_TRANSIT', 'INSPECTION'],
  IN_TRANSIT: ['AVAILABLE', 'INSPECTION'],
  MAINTENANCE: ['AVAILABLE', 'INSPECTION', 'DAMAGED'],
  INSPECTION: ['AVAILABLE', 'MAINTENANCE', 'DAMAGED'],
  DAMAGED: ['MAINTENANCE', 'LOST'],
  LOST: [],
  SOLD: [],
};

export function InventoryStatusTracker({
  inventoryUnits,
  movements,
  locations,
  skus,
  onStatusChange,
  onViewHistory,
  onBulkStatusChange,
  isLoading,
}: InventoryStatusTrackerProps) {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [statusChangeDialog, setStatusChangeDialog] = useState(false);
  const [bulkChangeDialog, setBulkChangeDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [newStatus, setNewStatus] = useState<InventoryStatus>('AVAILABLE');
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | 'ALL'>('ALL');

  const getStatusIcon = (status: InventoryStatus) => {
    const Icon = statusIcons[status];
    return <Icon className="h-4 w-4" />;
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Unknown Location';
  };

  const getSKUCode = (skuId: string) => {
    return skus.find(s => s.id === skuId)?.sku_code || 'Unknown SKU';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  const handleStatusChange = (unit: InventoryUnit) => {
    setSelectedUnit(unit);
    setNewStatus(unit.status);
    setNotes('');
    setStatusChangeDialog(true);
  };

  const handleSubmitStatusChange = () => {
    if (selectedUnit) {
      onStatusChange(selectedUnit.id, newStatus, notes);
      setStatusChangeDialog(false);
      setSelectedUnit(null);
      setNotes('');
    }
  };

  const handleBulkStatusChange = () => {
    if (selectedUnits.length > 0) {
      onBulkStatusChange(selectedUnits, newStatus, notes);
      setBulkChangeDialog(false);
      setSelectedUnits([]);
      setNotes('');
    }
  };

  const toggleUnitSelection = (unitId: string) => {
    setSelectedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const selectAllVisible = () => {
    const visibleUnits = filteredUnits.map(unit => unit.id);
    setSelectedUnits(visibleUnits);
  };

  const clearSelection = () => {
    setSelectedUnits([]);
  };

  const filteredUnits = inventoryUnits.filter(unit => 
    filterStatus === 'ALL' || unit.status === filterStatus
  );

  // Calculate status breakdown
  const statusBreakdown = INVENTORY_STATUS_VALUES.map(status => ({
    status,
    count: inventoryUnits.filter(unit => unit.status === status).length,
  }));

  const getValidTransitions = (currentStatus: InventoryStatus) => {
    return statusTransitions[currentStatus] || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Status Tracker</h2>
          <p className="text-muted-foreground">
            Monitor and manage inventory unit status transitions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {selectedUnits.length > 0 && (
            <Badge variant="secondary">
              {selectedUnits.length} selected
            </Badge>
          )}
          <Button 
            variant="outline" 
            disabled={selectedUnits.length === 0}
            onClick={() => setBulkChangeDialog(true)}
          >
            Bulk Update
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statusBreakdown.map(({ status, count }) => (
          <Card 
            key={status} 
            className={`cursor-pointer transition-all ${
              filterStatus === status ? 'ring-2 ring-slate-500' : ''
            }`}
            onClick={() => setFilterStatus(filterStatus === status ? 'ALL' : status)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(status)}
                <div>
                  <p className="text-sm text-muted-foreground capitalize">
                    {status.toLowerCase().replace('_', ' ')}
                  </p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inventory Units</span>
            <div className="flex items-center space-x-2">
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as InventoryStatus | 'ALL')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {INVENTORY_STATUS_VALUES.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {filteredUnits.length > 0 && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllVisible}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedUnits.length === filteredUnits.length && filteredUnits.length > 0}
                    onChange={() => 
                      selectedUnits.length === filteredUnits.length 
                        ? clearSelection() 
                        : selectAllVisible()
                    }
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Unit Details</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Last Inspection</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading inventory units...
                  </TableCell>
                </TableRow>
              ) : filteredUnits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No inventory units found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUnits.includes(unit.id)}
                        onChange={() => toggleUnitSelection(unit.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{getSKUCode(unit.sku_id)}</div>
                        {unit.serial_number && (
                          <div className="text-sm text-muted-foreground">
                            S/N: {unit.serial_number}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          ID: {unit.id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{getLocationName(unit.location_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[unit.status]}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(unit.status)}
                          <span>{unit.status.replace('_', ' ')}</span>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={conditionColors[unit.condition_grade]}>
                        Grade {unit.condition_grade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {unit.last_inspection_date 
                          ? formatDate(unit.last_inspection_date)
                          : 'Never'
                        }
                      </div>
                      {unit.next_inspection_date && (
                        <div className="text-xs text-muted-foreground">
                          Next: {formatDate(unit.next_inspection_date)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-32 truncate">
                        {unit.notes || 'No notes'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(unit)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(unit.id)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialog} onOpenChange={setStatusChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUnit && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-muted-foreground">Unit:</div>
                <div className="font-medium">{getSKUCode(selectedUnit.sku_id)}</div>
                {selectedUnit.serial_number && (
                  <div className="text-sm">S/N: {selectedUnit.serial_number}</div>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-sm">Current Status:</span>
                  <Badge className={statusColors[selectedUnit.status]}>
                    {selectedUnit.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new_status">New Status</Label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as InventoryStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedUnit && getValidTransitions(selectedUnit.status).map(status => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(status)}
                        <span>{status.replace('_', ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this status change..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setStatusChangeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitStatusChange}>
                Update Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Change Dialog */}
      <Dialog open={bulkChangeDialog} onOpenChange={setBulkChangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Status Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                Updating {selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk_status">New Status</Label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as InventoryStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_STATUS_VALUES.map(status => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(status)}
                        <span>{status.replace('_', ' ')}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk_notes">Notes (Optional)</Label>
              <Textarea
                id="bulk_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this bulk status change..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setBulkChangeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusChange}>
                Update {selectedUnits.length} Unit{selectedUnits.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}