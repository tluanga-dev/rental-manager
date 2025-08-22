'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Edit,
  CreditCard,
  ShoppingCart,
  Clock,
  FileText
} from 'lucide-react';
import { Customer, TransactionHeader } from '@/types/api';
import { ContactMethodManager } from './contact-method-manager';
import { usePaginatedQuery } from '@/hooks/use-api';

interface CustomerProfileProps {
  customer: Customer;
  onEdit: () => void;
  onUpdateContactMethod: (id: string, data: any) => void;
  onAddContactMethod: (data: any) => void;
  onDeleteContactMethod: (id: string) => void;
  onSetPrimaryContact: (id: string) => void;
  isLoading?: boolean;
}

export function CustomerProfile({
  customer,
  onEdit,
  onUpdateContactMethod,
  onAddContactMethod,
  onDeleteContactMethod,
  onSetPrimaryContact,
  isLoading,
}: CustomerProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: transactionHistoryData, isLoading: isLoadingTransactions } = 
    usePaginatedQuery<TransactionHeader>(
      ['transactions', customer.id],
      `/transactions?customer_id=${customer.id}`,
      1,
      10,
      { enabled: activeTab === 'transactions' || activeTab === 'overview' }
    );

  const { data: rentalHistoryData, isLoading: isLoadingRentals } =
    usePaginatedQuery<TransactionHeader>(
      ['rentals', customer.id],
      `/transactions?customer_id=${customer.id}&transaction_type=RENTAL`,
      1,
      10,
      { enabled: activeTab === 'rentals' || activeTab === 'overview' }
    );

  const transactions = transactionHistoryData?.items ?? [];
  const rentals = rentalHistoryData?.items ?? [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getCustomerTypeIcon = () => {
    return customer.customer_type === 'INDIVIDUAL' ? (
      <User className="h-5 w-5" />
    ) : (
      <Building className="h-5 w-5" />
    );
  };

  const getTierColor = (tier: string) => {
    const colors = {
      BRONZE: 'bg-amber-100 text-amber-800',
      SILVER: 'bg-gray-100 text-gray-800',
      GOLD: 'bg-yellow-100 text-yellow-800',
      PLATINUM: 'bg-purple-100 text-purple-800',
    };
    return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-slate-100 text-slate-800',
      RETURNED: 'bg-gray-100 text-gray-800',
      OVERDUE: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const creditUtilization = customer.credit_limit > 0 
    ? Math.min((customer.lifetime_value / customer.credit_limit) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary/10 rounded-full">
            {getCustomerTypeIcon()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {customer.customer_type === 'INDIVIDUAL' 
                ? `${customer.first_name} ${customer.last_name}`
                : customer.business_name
              }
            </h1>
            <p className="text-muted-foreground">
              Customer ID: {customer.customer_code || customer.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <Button onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Value</p>
                <p className="text-lg font-semibold">{formatCurrency(customer.lifetime_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-sm text-muted-foreground">Credit Limit</p>
                <p className="text-lg font-semibold">{formatCurrency(customer.credit_limit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge className={getTierColor(customer.customer_tier)}>
                {customer.customer_tier}
              </Badge>
              <div>
                <p className="text-sm text-muted-foreground">Customer Tier</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {customer.is_active ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Utilization */}
      {customer.credit_limit > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credit Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {formatCurrency(customer.lifetime_value)}</span>
                <span>Available: {formatCurrency(customer.credit_limit - customer.lifetime_value)}</span>
              </div>
              <Progress value={creditUtilization} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {creditUtilization.toFixed(1)}% of credit limit utilized
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Type</p>
                    <div className="flex items-center space-x-2">
                      {getCustomerTypeIcon()}
                      <span className="capitalize">{customer.customer_type.toLowerCase()}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer Tier</p>
                    <Badge className={getTierColor(customer.customer_tier)}>
                      {customer.customer_tier}
                    </Badge>
                  </div>
                </div>

                {customer.customer_type === 'INDIVIDUAL' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">First Name</p>
                      <p className="font-medium">{customer.first_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Name</p>
                      <p className="font-medium">{customer.last_name}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Business Name</p>
                    <p className="font-medium">{customer.business_name}</p>
                  </div>
                )}

                {customer.tax_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ID</p>
                    <p className="font-medium">{customer.tax_id}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Created Date</p>
                    <p className="font-medium">{formatDate(customer.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{formatDate(customer.updated_at)}</p>
                  </div>
                </div>

                {customer.last_transaction_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Last Transaction</p>
                    <p className="font-medium">{formatDate(customer.last_transaction_date)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="h-4 w-4 text-slate-500" />
                    <span>Total Transactions</span>
                  </div>
                  <span className="font-semibold">{transactionHistoryData?.total ?? 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span>Active Rentals</span>
                  </div>
                  <span className="font-semibold">
                    {rentals.filter(r => r.status === 'IN_PROGRESS').length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    <span>Total Rentals</span>
                  </div>
                  <span className="font-semibold">{rentalHistoryData?.total ?? 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-orange-500" />
                    <span>Avg Transaction</span>
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(customer.lifetime_value / (transactionHistoryData?.total || 1))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blacklist Status */}
          {customer.blacklist_status === 'BLACKLISTED' && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Blacklisted Customer</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700">
                  This customer has been blacklisted. Please contact management before processing any transactions.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <ContactMethodManager
            customerId={customer.id}
            contactMethods={customer.contact_methods}
            onAdd={onAddContactMethod}
            onUpdate={onUpdateContactMethod}
            onDelete={onDeleteContactMethod}
            onSetPrimary={onSetPrimaryContact}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.addresses.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No addresses found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customer.addresses.map((address) => (
                    <div key={address.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{address.address_type}</Badge>
                        {address.is_default && (
                          <Badge variant="default">Default</Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{address.address_line1}</p>
                        {address.address_line2 && (
                          <p className="text-sm text-muted-foreground">{address.address_line2}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {address.city}, {address.state} {address.postal_code}
                        </p>
                        <p className="text-sm text-muted-foreground">{address.country}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTransactions ? (
                    <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center">No transactions found.</TableCell></TableRow>
                  ) : (
                    transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.transaction_type}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(transaction.total_amount)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(transaction.status)}>
                          {transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentals">
          <Card>
            <CardHeader>
              <CardTitle>Rental History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rental Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRentals ? (
                     <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
                  ) : rentals.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center">No rentals found.</TableCell></TableRow>
                  ) : (
                    rentals.map((rental) => (
                    <TableRow key={rental.id}>
                      <TableCell>{formatDate(rental.transaction_date)}</TableCell>
                      <TableCell>{rental.due_date ? formatDate(rental.due_date) : 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(rental.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(rental.deposit_amount || 0)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(rental.status)}>
                          {rental.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}