'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { suppliersApi } from '@/services/api/suppliers';
import { cn } from '@/lib/utils';
import type { SupplierResponse } from '@/services/api/suppliers';

interface SupplierSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCreate?: boolean;
}

export function SupplierSelector({
  value,
  onValueChange,
  placeholder = 'Select supplier...',
  disabled = false,
  className,
  allowCreate = false
}: SupplierSelectorProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load suppliers on mount and when search term changes
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        setLoading(true);
        const data = await suppliersApi.list({
          is_active: true,
          search: searchTerm,
          limit: 50
        });
        setSuppliers(data.items);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };

    loadSuppliers();
  }, [searchTerm]);

  const selectedSupplier = suppliers.find(supplier => supplier.id === value);

  const handleSupplierSelect = (supplierId: string) => {
    onValueChange(supplierId);
    setOpen(false);
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'PREFERRED':
        return 'default';
      case 'STANDARD':
        return 'secondary';
      case 'RESTRICTED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'MANUFACTURER':
        return 'default';
      case 'DISTRIBUTOR':
        return 'secondary';
      case 'WHOLESALER':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
            disabled={disabled}
          >
            {selectedSupplier ? (
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{selectedSupplier.display_name}</span>
                <Badge 
                  variant={getTierBadgeVariant(selectedSupplier.supplier_tier)} 
                  className="ml-auto flex-shrink-0"
                >
                  {selectedSupplier.supplier_tier}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput 
              placeholder="Search suppliers..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  "Loading suppliers..."
                ) : (
                  <div className="py-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      No suppliers found.
                    </p>
                    {allowCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCreateDialog(true);
                          setOpen(false);
                        }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create New Supplier
                      </Button>
                    )}
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {suppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={supplier.id}
                    onSelect={() => handleSupplierSelect(supplier.id)}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          value === supplier.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium truncate">
                            {supplier.company_name}
                          </span>
                          <Badge 
                            variant={getTierBadgeVariant(supplier.supplier_tier)}
                            className="text-xs"
                          >
                            {supplier.supplier_tier}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{supplier.supplier_code}</span>
                          <Badge 
                            variant={getTypeBadgeVariant(supplier.supplier_type)}
                            className="text-xs"
                          >
                            {supplier.supplier_type}
                          </Badge>
                        </div>
                        {supplier.contact_person && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Contact: {supplier.contact_person}
                          </p>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && suppliers.length > 0 && (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setShowCreateDialog(true);
                      setOpen(false);
                    }}
                    className="border-t"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Supplier
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Supplier Dialog */}
      {allowCreate && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Supplier</DialogTitle>
              <DialogDescription>
                Add a new supplier to your system. You can edit details later.
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Supplier creation form would go here.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                For now, please use the Suppliers section to create new suppliers.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowCreateDialog(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}