'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Phone, Mail, Smartphone, Printer, CheckCircle, XCircle } from 'lucide-react';
import { contactMethodSchema, type ContactMethodFormData } from '@/lib/validations';
import { CustomerContactMethod } from '@/types/api';

interface ContactMethodManagerProps {
  customerId: string;
  contactMethods: CustomerContactMethod[];
  onAdd: (contactMethod: ContactMethodFormData) => void;
  onUpdate: (id: string, contactMethod: ContactMethodFormData) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
  isLoading?: boolean;
}

const contactTypeIcons = {
  EMAIL: Mail,
  MOBILE: Smartphone,
  PHONE: Phone,
  FAX: Printer,
};

export function ContactMethodManager({
  customerId,
  contactMethods,
  onAdd,
  onUpdate,
  onDelete,
  onSetPrimary,
  isLoading,
}: ContactMethodManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContactMethod | null>(null);

  const form = useForm({
    resolver: zodResolver(contactMethodSchema),
    defaultValues: {
      contact_type: 'EMAIL',
      contact_value: '',
      contact_label: '',
      is_primary: false,
      opt_in_marketing: true,
    },
  });

  const handleSubmit = (data: ContactMethodFormData) => {
    if (editingContact) {
      onUpdate(editingContact.id, data);
    } else {
      onAdd(data);
    }
    
    setDialogOpen(false);
    setEditingContact(null);
    form.reset();
  };

  const handleEdit = (contact: CustomerContactMethod) => {
    setEditingContact(contact);
    form.reset({
      contact_type: contact.contact_type,
      contact_value: contact.contact_value,
      contact_label: contact.contact_label || '',
      is_primary: contact.is_primary,
      opt_in_marketing: contact.opt_in_marketing,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    form.reset({
      contact_type: 'EMAIL',
      contact_value: '',
      contact_label: '',
      is_primary: false,
      opt_in_marketing: true,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this contact method?')) {
      onDelete(id);
    }
  };

  const formatContactValue = (type: string, value: string) => {
    if (type === 'EMAIL') {
      return value.toLowerCase();
    }
    if (type === 'MOBILE' || type === 'PHONE') {
      // Format phone numbers
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return value;
    }
    return value;
  };

  const getContactTypeIcon = (type: string) => {
    const Icon = contactTypeIcons[type as keyof typeof contactTypeIcons] || Phone;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contact Methods</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Edit Contact Method' : 'Add Contact Method'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact_type">Contact Type</Label>
                <Select
                  value={form.watch('contact_type')}
                  onValueChange={(value) => form.setValue('contact_type', value as any)}
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
                <Label htmlFor="contact_value">Contact Value</Label>
                <Input
                  id="contact_value"
                  {...form.register('contact_value')}
                  placeholder={
                    form.watch('contact_type') === 'EMAIL'
                      ? 'email@example.com'
                      : '+1234567890'
                  }
                />
                {form.formState.errors.contact_value && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.contact_value.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_label">Label (Optional)</Label>
                <Input
                  id="contact_label"
                  {...form.register('contact_label')}
                  placeholder="e.g., Work, Personal, Emergency"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_primary"
                    checked={form.watch('is_primary')}
                    onCheckedChange={(checked) =>
                      form.setValue('is_primary', checked as boolean)
                    }
                  />
                  <Label htmlFor="is_primary">Primary Contact</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="opt_in_marketing"
                    checked={form.watch('opt_in_marketing')}
                    onCheckedChange={(checked) =>
                      form.setValue('opt_in_marketing', checked as boolean)
                    }
                  />
                  <Label htmlFor="opt_in_marketing">Marketing Opt-in</Label>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingContact ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contactMethods.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No contact methods added yet.</p>
            <p className="text-sm">Add at least one contact method to reach the customer.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactMethods.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getContactTypeIcon(contact.contact_type)}
                      <span className="capitalize">
                        {contact.contact_type.toLowerCase()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {formatContactValue(contact.contact_type, contact.contact_value)}
                      </div>
                      {contact.is_primary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.contact_label && (
                      <Badge variant="outline">{contact.contact_label}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {contact.is_verified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm">
                        {contact.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.opt_in_marketing ? 'default' : 'secondary'}>
                      {contact.opt_in_marketing ? 'Opted In' : 'Opted Out'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {!contact.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSetPrimary(contact.id)}
                          title="Set as primary"
                        >
                          Primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id)}
                        disabled={contact.is_primary && contactMethods.length === 1}
                        title={
                          contact.is_primary && contactMethods.length === 1
                            ? 'Cannot delete the only primary contact'
                            : 'Delete contact method'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}