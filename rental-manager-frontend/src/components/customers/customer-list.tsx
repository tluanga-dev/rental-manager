'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Plus, 
  Edit, 
  Eye, 
  User, 
  Building, 
  Phone, 
  Mail, 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { customerFilterSchema, type CustomerFilterFormData } from '@/lib/validations';
import { CustomerSummary, CustomerType, CustomerTier, BlacklistStatus } from '@/types/api';

interface CustomerListProps {
  customers: CustomerSummary[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilter: (filters: CustomerFilterFormData) => void;
  onCreateCustomer: () => void;
  onEditCustomer: (customerId: string) => void;
  onViewCustomer: (customerId: string) => void;
  isLoading?: boolean;
}

const customerTierColors = {
  BRONZE: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-gray-100 text-gray-800',
  GOLD: 'bg-yellow-100 text-yellow-800',
  PLATINUM: 'bg-purple-100 text-purple-800',
};

const blacklistStatusColors = {
  CLEAR: 'bg-green-100 text-green-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
};

export function CustomerList({
  customers,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onFilter,
  onCreateCustomer,
  onEditCustomer,
  onViewCustomer,
  isLoading,
}: CustomerListProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const filterForm = useForm<CustomerFilterFormData>({
    resolver: zodResolver(customerFilterSchema),
    defaultValues: {
      search: '',
      customer_type: undefined,
      customer_tier: undefined,
      is_active: undefined,
      blacklist_status: undefined,
      city: '',
      state: '',
      min_lifetime_value: undefined,
      max_lifetime_value: undefined,
    },
  });

  const handleFilter = (data: CustomerFilterFormData) => {
    onFilter(data);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    filterForm.reset();
    onFilter({});
  };

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({ search: quickSearch });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getCustomerTypeIcon = (type: CustomerType) => {
    return type === 'INDIVIDUAL' ? (
      <User className="h-4 w-4" />
    ) : (
      <Building className="h-4 w-4" />
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customers</h2>
          <p className="text-muted-foreground">
            {totalCount} customer{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button onClick={onCreateCustomer}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Search */}
          <form onSubmit={handleQuickSearch} className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or customer code..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              Search
            </Button>
          </form>

          {/* Advanced Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <form onSubmit={filterForm.handleSubmit(handleFilter)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select
                      value={filterForm.watch('customer_type') || ''}
                      onValueChange={(value) =>
                        filterForm.setValue('customer_type', value || undefined as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        <SelectItem value="BUSINESS">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Customer Tier</Label>
                    <Select
                      value={filterForm.watch('customer_tier') || ''}
                      onValueChange={(value) =>
                        filterForm.setValue('customer_tier', value || undefined as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All tiers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tiers</SelectItem>
                        <SelectItem value="BRONZE">Bronze</SelectItem>
                        <SelectItem value="SILVER">Silver</SelectItem>
                        <SelectItem value="GOLD">Gold</SelectItem>
                        <SelectItem value="PLATINUM">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={
                        filterForm.watch('is_active') !== undefined
                          ? filterForm.watch('is_active')?.toString()
                          : ''
                      }
                      onValueChange={(value) =>
                        filterForm.setValue(
                          'is_active',
                          value === '' ? undefined : value === 'true'
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Blacklist Status</Label>
                    <Select
                      value={filterForm.watch('blacklist_status') || ''}
                      onValueChange={(value) =>
                        filterForm.setValue('blacklist_status', value || undefined as any)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="CLEAR">Clear</SelectItem>
                        <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      {...filterForm.register('city')}
                      placeholder="Filter by city"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      {...filterForm.register('state')}
                      placeholder="Filter by state"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Lifetime Value</Label>
                    <Input
                      type="number"
                      min="0"
                      {...filterForm.register('min_lifetime_value', { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Lifetime Value</Label>
                    <Input
                      type="number"
                      min="0"
                      {...filterForm.register('max_lifetime_value', { valueAsNumber: true })}
                      placeholder="No limit"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    Apply Filters
                  </Button>
                </div>
              </form>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Lifetime Value</TableHead>
                <TableHead>Last Transaction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading customers...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p>No customers found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{customer.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          ID: {customer.id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getCustomerTypeIcon(customer.customer_type)}
                        <span className="capitalize">
                          {customer.customer_type.toLowerCase()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {customer.primary_email && (
                          <div className="flex items-center space-x-1 text-sm">
                            <Mail className="h-3 w-3" />
                            <span>{customer.primary_email}</span>
                          </div>
                        )}
                        {customer.primary_phone && (
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>{customer.primary_phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={customerTierColors[customer.customer_tier]}
                      >
                        {customer.customer_tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(customer.lifetime_value)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(customer.last_transaction_date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          {customer.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-gray-400" />
                          )}
                          <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Badge
                          variant="outline"
                          className={blacklistStatusColors[customer.blacklist_status]}
                        >
                          {customer.blacklist_status === 'CLEAR' ? 'Clear' : 'Blacklisted'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewCustomer(customer.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditCustomer(customer.id)}
                        >
                          <Edit className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} customers
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      disabled={isLoading}
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    {currentPage < totalPages - 2 && <span>...</span>}
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(totalPages)}
                      disabled={isLoading}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}