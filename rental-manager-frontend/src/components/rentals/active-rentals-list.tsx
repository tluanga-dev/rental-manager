'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Package,
  Calendar,
  User,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Phone,
} from 'lucide-react';

import { rentalsApi } from '@/services/api/rentals';
import { format } from 'date-fns';
import type { RentalStatus } from '@/types/rentals';
import { RentalStatusBadge } from '@/components/rentals';

export function ActiveRentalsList() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RentalStatus | 'ALL'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');

  // Fetch active rentals
  const { data, isLoading, error } = useQuery({
    queryKey: ['active-rentals', statusFilter, locationFilter, searchQuery],
    queryFn: () =>
      rentalsApi.getRentals({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        location_id: locationFilter !== 'ALL' ? locationFilter : undefined,
        search: searchQuery || undefined,
        skip: 0,
        limit: 100,
        // Filter for active rental statuses
        ...(statusFilter === 'ALL' && {
          status_in: ['RESERVED', 'CONFIRMED', 'PICKED_UP', 'ACTIVE', 'EXTENDED', 'PARTIAL_RETURN', 'LATE', 'LATE_PARTIAL_RETURN'] as RentalStatus[],
        }),
      }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      // This would be replaced with actual locations API call
      return [
        { id: '1', name: 'Main Warehouse' },
        { id: '2', name: 'Downtown Branch' },
        { id: '3', name: 'Airport Location' },
      ];
    },
  });

  const activeRentals = data?.items || [];
  const totalActive = data?.total || 0;

  const getDaysRemaining = (rental: any) => {
    // Check if rental has rental_period
    const endDate = rental.rental_period?.end_date || rental.rental_end_date;
    if (!endDate) return 0;
    
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysRemainingBadge = (rental: any) => {
    const days = rental.rental_period?.days_remaining ?? getDaysRemaining(rental);
    const isOverdue = rental.rental_period?.is_overdue || days < 0;
    
    if (isOverdue) {
      return <Badge variant="destructive">{Math.abs(days)}d overdue</Badge>;
    } else if (days === 0) {
      return <Badge variant="destructive">Due today</Badge>;
    } else if (days <= 3) {
      return <Badge variant="outline" className="text-orange-600 border-orange-600">{days}d left</Badge>;
    }
    return <Badge variant="secondary">{days}d left</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
            <p className="text-xs text-muted-foreground">Currently on rent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeRentals.filter(r => getDaysRemaining(r) === 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late/Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeRentals.filter(r => 
                ['LATE', 'LATE_PARTIAL_RETURN', 'OVERDUE'].includes(r.rental_status) ||
                r.rental_period?.is_overdue || 
                getDaysRemaining(r) < 0
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">Need immediate action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picked Up</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeRentals.filter(r => r.rental_status === 'PICKED_UP').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently with customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer, rental number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RentalStatus | 'ALL')}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Active</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXTENDED">Extended</SelectItem>
                  <SelectItem value="PARTIAL_RETURN">Partial Return</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="LATE_PARTIAL_RETURN">Late Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Locations</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Rentals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Rental Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading active rentals...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Failed to load rentals. Please try again.
            </div>
          ) : activeRentals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active rentals found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rental #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time Left</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRentals.map((rental) => {
                    const startDate = rental.rental_period?.start_date || rental.rental_start_date;
                    const endDate = rental.rental_period?.end_date || rental.rental_end_date;
                    const customerName = rental.customer?.name || rental.customer_name || 'Unknown';
                    const customerPhone = rental.customer?.phone || rental.customer_phone;
                    const totalAmount = rental.financial_summary?.total_amount || rental.total_amount || 0;
                    const balanceDue = rental.financial_summary?.balance_due || rental.balance_due || 0;
                    const itemCount = rental.rental_items?.length || rental.line_items?.length || 0;
                    
                    return (
                      <TableRow key={rental.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {rental.transaction_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{customerName}</p>
                            {customerPhone && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customerPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{itemCount} items</p>
                            <p className="text-sm text-gray-500">
                              {rental.rental_items?.slice(0, 2).map(item => item.item?.name || 'Item').join(', ')}
                              {itemCount > 2 && '...'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {startDate && <p>{format(new Date(startDate), 'MMM d')}</p>}
                            {endDate && <p className="text-gray-500">to {format(new Date(endDate), 'MMM d')}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RentalStatusBadge status={rental.rental_status} size="sm" />
                        </TableCell>
                        <TableCell>
                          {getDaysRemainingBadge(rental)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">₹{totalAmount.toLocaleString()}</p>
                            {balanceDue > 0 && (
                              <p className="text-sm text-orange-600">
                                Due: ₹{balanceDue.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/rentals/${rental.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}