'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { customerCreateSchema, type CustomerCreateFormData } from '@/lib/validations';

interface CustomerFormProps {
  onSubmit: (data: CustomerCreateFormData) => void;
  initialData?: Partial<CustomerCreateFormData>;
  isLoading?: boolean;
}

export function CustomerForm({ onSubmit, initialData, isLoading }: CustomerFormProps) {
  const [customerType, setCustomerType] = useState<'INDIVIDUAL' | 'BUSINESS'>(
    initialData?.customer?.customer_type || 'INDIVIDUAL'
  );

  const form = useForm<CustomerCreateFormData>({
    resolver: zodResolver(customerCreateSchema) as any,
    defaultValues: {
      customer: {
        customer_type: 'INDIVIDUAL',
        customer_tier: 'BRONZE',
        credit_limit: 0,
        first_name: '',
        last_name: '',
        business_name: '',
        tax_id: '',
        ...initialData?.customer,
      },
      contact_methods: initialData?.contact_methods || [
        {
          contact_type: 'EMAIL',
          contact_value: '',
          is_primary: true,
          opt_in_marketing: true,
        },
      ],
      addresses: initialData?.addresses || [
        {
          address_type: 'BOTH',
          address_line1: '',
          city: '',
          state: '',
          country: 'India',
          is_default: true,
        },
      ],
      contact_persons: initialData?.contact_persons || [],
    },
  });

  const {
    fields: contactFields,
    append: addContact,
    remove: removeContact,
  } = useFieldArray({
    control: form.control,
    name: 'contact_methods',
  });

  const {
    fields: addressFields,
    append: addAddress,
    remove: removeAddress,
  } = useFieldArray({
    control: form.control,
    name: 'addresses',
  });

  const {
    fields: contactPersonFields,
    append: addContactPerson,
    remove: removeContactPerson,
  } = useFieldArray({
    control: form.control,
    name: 'contact_persons',
  });

  const handleCustomerTypeChange = (type: 'INDIVIDUAL' | 'BUSINESS') => {
    setCustomerType(type);
    form.setValue('customer.customer_type', type);
    
    // Clear type-specific fields when switching
    if (type === 'INDIVIDUAL') {
      form.setValue('customer.business_name', '');
      form.setValue('customer.tax_id', '');
    } else {
      form.setValue('customer.first_name', '');
      form.setValue('customer.last_name', '');
    }
  };

  const handleSubmit = (data: CustomerCreateFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Type Selection */}
          <div className="space-y-2">
            <Label>Customer Type</Label>
            <Select value={customerType} onValueChange={handleCustomerTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Fields Based on Customer Type */}
          {customerType === 'INDIVIDUAL' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  {...form.register('customer.first_name')}
                  placeholder="Enter first name"
                />
                {form.formState.errors.customer?.first_name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.customer.first_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  {...form.register('customer.last_name')}
                  placeholder="Enter last name"
                />
                {form.formState.errors.customer?.last_name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.customer.last_name.message}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  {...form.register('customer.business_name')}
                  placeholder="Enter business name"
                />
                {form.formState.errors.customer?.business_name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.customer.business_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  {...form.register('customer.tax_id')}
                  placeholder="Enter tax ID"
                />
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_tier">Customer Tier</Label>
              <Select
                value={form.watch('customer.customer_tier')}
                onValueChange={(value) => form.setValue('customer.customer_tier', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRONZE">Bronze</SelectItem>
                  <SelectItem value="SILVER">Silver</SelectItem>
                  <SelectItem value="GOLD">Gold</SelectItem>
                  <SelectItem value="PLATINUM">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_limit">Credit Limit</Label>
              <Input
                id="credit_limit"
                type="number"
                min="0"
                {...form.register('customer.credit_limit', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts">Contact Methods</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="contact-persons" disabled={customerType === 'INDIVIDUAL'}>
            Contact Persons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contact Methods</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addContact({
                    contact_type: 'EMAIL',
                    contact_value: '',
                    is_primary: false,
                    opt_in_marketing: true,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactFields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant={form.watch(`contact_methods.${index}.is_primary`) ? 'default' : 'secondary'}>
                        {form.watch(`contact_methods.${index}.is_primary`) ? 'Primary' : 'Secondary'}
                      </Badge>
                      <Badge variant="outline">
                        {form.watch(`contact_methods.${index}.contact_type`)}
                      </Badge>
                    </div>
                    {contactFields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeContact(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Type</Label>
                      <Select
                        value={form.watch(`contact_methods.${index}.contact_type`)}
                        onValueChange={(value) =>
                          form.setValue(`contact_methods.${index}.contact_type`, value as any)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="MOBILE">Mobile</SelectItem>
                          <SelectItem value="PHONE">Phone</SelectItem>
                          <SelectItem value="FAX">Fax</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Contact Value</Label>
                      <Input
                        {...form.register(`contact_methods.${index}.contact_value`)}
                        placeholder={
                          form.watch(`contact_methods.${index}.contact_type`) === 'EMAIL'
                            ? 'email@example.com'
                            : '+1234567890'
                        }
                      />
                      {form.formState.errors.contact_methods?.[index]?.contact_value && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.contact_methods[index]?.contact_value?.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Label (Optional)</Label>
                      <Input
                        {...form.register(`contact_methods.${index}.contact_label`)}
                        placeholder="e.g., Work, Personal"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`primary-${index}`}
                        checked={form.watch(`contact_methods.${index}.is_primary`)}
                        onCheckedChange={(checked) =>
                          form.setValue(`contact_methods.${index}.is_primary`, checked as boolean)
                        }
                      />
                      <Label htmlFor={`primary-${index}`}>Primary Contact</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`marketing-${index}`}
                        checked={form.watch(`contact_methods.${index}.opt_in_marketing`)}
                        onCheckedChange={(checked) =>
                          form.setValue(`contact_methods.${index}.opt_in_marketing`, checked as boolean)
                        }
                      />
                      <Label htmlFor={`marketing-${index}`}>Marketing Opt-in</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Addresses</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addAddress({
                    address_type: 'BOTH',
                    address_line1: '',
                    city: '',
                    state: '',
                    country: 'India',
                    is_default: false,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {addressFields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant={form.watch(`addresses.${index}.is_default`) ? 'default' : 'secondary'}>
                        {form.watch(`addresses.${index}.is_default`) ? 'Default' : 'Additional'}
                      </Badge>
                      <Badge variant="outline">
                        {form.watch(`addresses.${index}.address_type`)}
                      </Badge>
                    </div>
                    {addressFields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAddress(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Address Type</Label>
                      <Select
                        value={form.watch(`addresses.${index}.address_type`)}
                        onValueChange={(value) =>
                          form.setValue(`addresses.${index}.address_type`, value as any)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BILLING">Billing</SelectItem>
                          <SelectItem value="SHIPPING">Shipping</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-8">
                      <Checkbox
                        id={`default-${index}`}
                        checked={form.watch(`addresses.${index}.is_default`)}
                        onCheckedChange={(checked) =>
                          form.setValue(`addresses.${index}.is_default`, checked as boolean)
                        }
                      />
                      <Label htmlFor={`default-${index}`}>Default Address</Label>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Address Line 1</Label>
                      <Input
                        {...form.register(`addresses.${index}.address_line1`)}
                        placeholder="Street address, building, etc."
                      />
                      {form.formState.errors.addresses?.[index]?.address_line1 && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.addresses[index]?.address_line1?.message}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Address Line 2 (Optional)</Label>
                      <Input
                        {...form.register(`addresses.${index}.address_line2`)}
                        placeholder="Apartment, floor, unit, etc."
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          {...form.register(`addresses.${index}.city`)}
                          placeholder="City"
                        />
                        {form.formState.errors.addresses?.[index]?.city && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.addresses[index]?.city?.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          {...form.register(`addresses.${index}.state`)}
                          placeholder="State"
                        />
                        {form.formState.errors.addresses?.[index]?.state && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.addresses[index]?.state?.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input
                          {...form.register(`addresses.${index}.country`)}
                          placeholder="Country"
                        />
                        {form.formState.errors.addresses?.[index]?.country && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.addresses[index]?.country?.message}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Postal Code</Label>
                        <Input
                          {...form.register(`addresses.${index}.postal_code`)}
                          placeholder="Postal code"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-persons" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contact Persons</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addContactPerson({
                    contact_name: '',
                    designation: '',
                    department: '',
                    is_primary: false,
                    contact_methods: [
                      {
                        contact_type: 'EMAIL',
                        contact_value: '',
                        is_primary: true,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact Person
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactPersonFields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={form.watch(`contact_persons.${index}.is_primary`) ? 'default' : 'secondary'}>
                      {form.watch(`contact_persons.${index}.is_primary`) ? 'Primary Contact' : 'Additional Contact'}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeContactPerson(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input
                        {...form.register(`contact_persons.${index}.contact_name`)}
                        placeholder="Full name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Designation</Label>
                      <Input
                        {...form.register(`contact_persons.${index}.designation`)}
                        placeholder="Job title"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        {...form.register(`contact_persons.${index}.department`)}
                        placeholder="Department"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`primary-person-${index}`}
                      checked={form.watch(`contact_persons.${index}.is_primary`)}
                      onCheckedChange={(checked) =>
                        form.setValue(`contact_persons.${index}.is_primary`, checked as boolean)
                      }
                    />
                    <Label htmlFor={`primary-person-${index}`}>Primary Contact Person</Label>
                  </div>
                </div>
              ))}
              
              {contactPersonFields.length === 0 && customerType === 'BUSINESS' && (
                <div className="text-center text-muted-foreground py-8">
                  <p>No contact persons added yet.</p>
                  <p className="text-sm">It's recommended to add at least one contact person for business customers.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Customer'}
        </Button>
      </div>
    </form>
  );
}