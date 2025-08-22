'use client';

import { useState, useEffect } from 'react';
import { Search, User, Mail, Phone, MapPin, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WizardData } from '../RentalCreationWizard';
import { customersApi } from '@/services/api/customers';
import { transformCustomerResponse, getCustomerDisplayName, filterCustomers, sortCustomersByRelevance } from '@/utils/customer-utils';
import type { CustomerResponse } from '@/services/api/customers';

interface CustomerStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

// Extended customer interface for the wizard
interface CustomerForWizard {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  code: string;
  type: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE';
  totalRentals: number;
  lastRental: string | null;
  blacklist_status: 'CLEAR' | 'BLACKLISTED';
}

export function CustomerStep({ data, onUpdate, onNext }: CustomerStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerForWizard[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerForWizard[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerForWizard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform CustomerResponse to our wizard format
  const transformCustomerForWizard = (customer: CustomerResponse): CustomerForWizard => {
    return {
      id: customer.id,
      name: getCustomerDisplayName(customer),
      email: customer.email,
      phone: customer.phone,
      address: `${customer.address_line1}, ${customer.city}, ${customer.state} ${customer.postal_code}`,
      status: customer.is_active ? 'active' : 'inactive',
      code: customer.customer_code,
      type: customer.customer_type,
      totalRentals: customer.total_rentals,
      lastRental: customer.last_rental_date,
      blacklist_status: customer.blacklist_status,
    };
  };

  // Load customers from API
  useEffect(() => {
    fetchCustomers();
  }, [data.customer_id]);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customersApi.list({
        status: 'ACTIVE',
        limit: 100,
      });
      
      const transformedCustomers = response.items.map(transformCustomerForWizard);
      setCustomers(transformedCustomers);
      setFilteredCustomers(transformedCustomers);
      
      // If there's a selected customer ID, find and set it
      if (data.customer_id) {
        const selected = transformedCustomers.find((c) => c.id === data.customer_id);
        if (selected) {
          setSelectedCustomer(selected);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.phone.includes(searchTerm) ||
      customer.code.toLowerCase().includes(searchLower) ||
      customer.type.toLowerCase().includes(searchLower)
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleCustomerSelect = (customer: CustomerForWizard) => {
    setSelectedCustomer(customer);
    onUpdate({ customer_id: customer.id, customer });
  };

  const handleNext = () => {
    if (selectedCustomer) {
      onNext();
    }
  };

  const getCustomerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Search Section - Only show when no customer is selected */}
      {!selectedCustomer && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search customers by name, email, phone, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error loading customers:</span>
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCustomers}
              className="mt-2"
              disabled={isLoading}
            >
              {isLoading ? 'Retrying...' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading customers...</p>
        </div>
      )}

      {/* Selected Customer */}
      {selectedCustomer && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-800">Selected Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                  {getCustomerInitials(selectedCustomer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-green-900 truncate">{selectedCustomer.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {selectedCustomer.code}
                  </Badge>
                  {selectedCustomer.blacklist_status === 'BLACKLISTED' && (
                    <Badge variant="destructive" className="text-xs">
                      Blacklisted
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-green-700 mt-0.5">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{selectedCustomer.email}</span>
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Phone className="w-3 h-3" />
                    {selectedCustomer.phone}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCustomer(null);
                  onUpdate({ customer_id: '', customer: null });
                }}
              >
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer List - Only show when no customer is selected */}
      {!isLoading && !error && !selectedCustomer && (
        <div className="grid gap-2">
          {filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              className="cursor-pointer transition-all hover:shadow-md hover:bg-gray-50"
              onClick={() => handleCustomerSelect(customer)}
            >
              <CardContent className="p-2">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                      {getCustomerInitials(customer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm text-gray-900 truncate">{customer.name}</h3>
                      <Badge
                        variant={customer.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs flex-shrink-0"
                      >
                        {customer.status}
                      </Badge>
                      {customer.blacklist_status === 'BLACKLISTED' && (
                        <Badge variant="destructive" className="text-xs flex-shrink-0">
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 flex-shrink-0">
                    <div className="font-medium">{customer.code}</div>
                    <div>{customer.totalRentals} rentals</div>
                    {customer.lastRental && (
                      <div>Last: {new Date(customer.lastRental).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !error && !selectedCustomer && filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Try adjusting your search terms' : 'No customers available'}
          </p>
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add New Customer
          </Button>
        </div>
      )}

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {selectedCustomer ? (
            <span className="text-green-600 font-medium">
              ✓ Customer selected: {selectedCustomer.name}
            </span>
          ) : (
            'Please select a customer to continue'
          )}
        </div>
        <Button
          onClick={handleNext}
          disabled={!selectedCustomer}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continue to Rental Details
        </Button>
      </div>
    </div>
  );
}
