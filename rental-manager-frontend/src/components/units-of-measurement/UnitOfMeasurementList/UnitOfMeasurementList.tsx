'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Ruler, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  AlertCircle,
  Filter,
  RefreshCw,
  Eye,
  FileDown,
  FileUp,
  CheckSquare,
  TrendingUp,
  Archive
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { UnitOfMeasurement } from '@/types/unit-of-measurement';

interface UnitOfMeasurementListProps {
  units: UnitOfMeasurement[];
  isLoading?: boolean;
  error?: string;
  onSearch?: (query: string) => void;
  onFilter?: (filters: UnitFilters) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onRefresh?: () => void;
  onView?: (unit: UnitOfMeasurement) => void;
  onEdit?: (unit: UnitOfMeasurement) => void;
  onDelete?: (unit: UnitOfMeasurement) => void;
  onActivate?: (unit: UnitOfMeasurement) => void;
  onDeactivate?: (unit: UnitOfMeasurement) => void;
  onBulkActivate?: (unitIds: string[]) => void;
  onBulkDeactivate?: (unitIds: string[]) => void;
  onBulkDelete?: (unitIds: string[]) => void;
  onExport?: (includeInactive: boolean) => void;
  onImport?: (file: File) => void;
  onStats?: () => void;
  onCreate?: () => void;
  // Pagination
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export interface UnitFilters {
  is_active?: boolean | 'ALL';
  has_code?: boolean | 'ALL';
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'code', label: 'Code' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
];

export function UnitOfMeasurementList({
  units,
  isLoading = false,
  error,
  onSearch,
  onFilter,
  onSort,
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete,
  onExport,
  onImport,
  onStats,
  onCreate,
  currentPage = 1,
  totalPages = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  onPageSizeChange,
}: UnitOfMeasurementListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<UnitFilters>({
    is_active: 'ALL',
    has_code: 'ALL',
    sort_field: 'name',
    sort_direction: 'asc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilterChange = (key: keyof UnitFilters, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  const handleSortChange = (field: string) => {
    const direction = filters.sort_field === field && filters.sort_direction === 'asc' ? 'desc' : 'asc';
    handleFilterChange('sort_field', field);
    handleFilterChange('sort_direction', direction);
    onSort?.(field, direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUnits(units.map(unit => unit.id));
    } else {
      setSelectedUnits([]);
    }
  };

  const handleSelectUnit = (unitId: string, checked: boolean) => {
    if (checked) {
      setSelectedUnits([...selectedUnits, unitId]);
    } else {
      setSelectedUnits(selectedUnits.filter(id => id !== unitId));
    }
  };

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUnits.length === 0) return;

    switch (action) {
      case 'activate':
        onBulkActivate?.(selectedUnits);
        break;
      case 'deactivate':
        onBulkDeactivate?.(selectedUnits);
        break;
      case 'delete':
        onBulkDelete?.(selectedUnits);
        break;
    }
    setSelectedUnits([]);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport?.(file);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (isActive: boolean) => (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const getSortIcon = (field: string) => {
    if (filters.sort_field !== field) return null;
    return filters.sort_direction === 'asc' ? '↑' : '↓';
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="flex items-center text-sm text-gray-500">
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} units
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          {pages.map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange?.(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Units of Measurement</h2>
          <p className="text-muted-foreground">
            Manage measurement units used throughout the inventory system
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {onStats && (
            <Button variant="outline" onClick={onStats}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Statistics
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={() => onExport(filters.is_active !== true)}>
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          {onImport && (
            <div className="relative">
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleImportFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline">
                <FileUp className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          )}
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search units by name or code..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.is_active === true ? 'ACTIVE' : filters.is_active === false ? 'INACTIVE' : 'ALL'}
                onValueChange={(value) => 
                  handleFilterChange('is_active', 
                    value === 'ACTIVE' ? true : 
                    value === 'INACTIVE' ? false : 
                    'ALL'
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Select
                value={filters.has_code === true ? 'HAS_CODE' : filters.has_code === false ? 'NO_CODE' : 'ALL'}
                onValueChange={(value) => 
                  handleFilterChange('has_code', 
                    value === 'HAS_CODE' ? true : 
                    value === 'NO_CODE' ? false : 
                    'ALL'
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="HAS_CODE">Has Code</SelectItem>
                  <SelectItem value="NO_CODE">No Code</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select
                value={filters.sort_field || 'name'}
                onValueChange={(value) => handleSortChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Page Size</label>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => onPageSizeChange?.(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUnits.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-800">
                {selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {onBulkActivate && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('activate')}>
                  <Power className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              )}
              {onBulkDeactivate && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              )}
              {onBulkDelete && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('delete')}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedUnits([])}>
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Units Table */}
      <div className="border rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (units || []).length === 0 ? (
          <div className="text-center py-12">
            <Ruler className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No units found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || Object.values(filters).some(f => f !== 'ALL' && f !== undefined)
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first unit of measurement'
              }
            </p>
            {onCreate && (
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
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
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSortChange('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Unit Name</span>
                    <span className="text-gray-400">{getSortIcon('name')}</span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSortChange('code')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Code</span>
                    <span className="text-gray-400">{getSortIcon('code')}</span>
                  </div>
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items Using</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSortChange('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created</span>
                    <span className="text-gray-400">{getSortIcon('created_at')}</span>
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSortChange('updated_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Updated</span>
                    <span className="text-gray-400">{getSortIcon('updated_at')}</span>
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(units || []).map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUnits.includes(unit.id)}
                      onCheckedChange={(checked) => handleSelectUnit(unit.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{unit.name}</div>
                  </TableCell>
                  <TableCell>
                    {unit.code ? (
                      <Badge variant="outline">{unit.code}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-48 truncate">
                      {unit.description || (
                        <span className="text-gray-400">No description</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(unit.is_active)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {/* This would come from the API response */}
                      — items
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(unit.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {unit.updated_at ? formatDate(unit.updated_at) : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {onView && (
                        <Button variant="ghost" size="sm" onClick={() => onView(unit)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(unit)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {unit.is_active ? (
                        onDeactivate && (
                          <Button variant="ghost" size="sm" onClick={() => onDeactivate(unit)}>
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        )
                      ) : (
                        onActivate && (
                          <Button variant="ghost" size="sm" onClick={() => onActivate(unit)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      {onDelete && !unit.is_active && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onDelete(unit)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {/* Pagination */}
        {renderPagination()}
      </div>
    </div>
  );
}