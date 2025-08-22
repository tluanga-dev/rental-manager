'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronsUpDown, Search, Building2, Mail, Phone, User, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';

export interface Supplier {
  id: string;
  company_name: string;
  display_name?: string;
  supplier_type?: string;
  supplier_tier?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  is_active?: boolean;
}

interface SupplierSelectorProps {
  value?: string;
  onValueChange?: (supplierId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCreateButton?: boolean;
  onCreateNew?: () => void;
}

export function SupplierSelector({
  value,
  onValueChange,
  placeholder = "Select supplier...",
  disabled = false,
  className,
  showCreateButton = true,
  onCreateNew,
}: SupplierSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSupplier = suppliers.find(s => s.id === value);

  // Fetch suppliers with search
  const fetchSuppliers = useCallback(async (search: string = "") => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams({
        skip: '0',
        limit: '50',
        is_active: 'true',
        ...(search && { search })
      });

      const response = await fetch(`/api/v1/suppliers/?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch suppliers: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const suppliersData = data.items || data;

      setSuppliers(suppliersData);
      setHasSearched(true);
    } catch (error: unknown) {
      const errorInstance = error as Error & { name?: string };
      if (errorInstance?.name !== 'AbortError') {
        console.error('Failed to fetch suppliers:', error);
        setError(errorInstance?.message || 'Failed to load suppliers');
        setSuppliers([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (open && !hasSearched) {
      fetchSuppliers();
    }
  }, [open, hasSearched, fetchSuppliers]);

  // Search when debounced term changes
  useEffect(() => {
    if (hasSearched) {
      fetchSuppliers(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, hasSearched, fetchSuppliers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelect = (supplierId: string) => {
    const newValue = value === supplierId ? null : supplierId;
    onValueChange?.(newValue);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setOpen(false);
    if (onCreateNew) {
      onCreateNew();
    } else {
      // Default action - open in new tab
      window.open('/purchases/suppliers/new', '_blank');
    }
  };

  const getSupplierTypeColor = (type?: string) => {
    const colors = {
      'MANUFACTURER': 'bg-slate-100 text-slate-800',
      'DISTRIBUTOR': 'bg-green-100 text-green-800',
      'WHOLESALER': 'bg-yellow-100 text-yellow-800',
      'RETAILER': 'bg-purple-100 text-purple-800',
      'SERVICE_PROVIDER': 'bg-indigo-100 text-indigo-800',
      'BUSINESS': 'bg-gray-100 text-gray-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSupplierTierColor = (tier?: string) => {
    const colors = {
      'PREFERRED': 'bg-green-100 text-green-800',
      'STANDARD': 'bg-slate-100 text-slate-800',
      'RESTRICTED': 'bg-red-100 text-red-800',
    };
    return colors[tier as keyof typeof colors] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <div className="flex items-center">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              {selectedSupplier ? (
                <span className="truncate">{selectedSupplier.company_name || selectedSupplier.display_name}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          {/* Search Header */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-auto">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Searching suppliers...</span>
              </div>
            )}

            {error && (
              <div className="p-3">
                <div className="text-sm text-red-600 mb-2">{error}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchSuppliers(searchTerm)}
                  disabled={loading}
                >
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && suppliers.length === 0 && hasSearched && (
              <div className="p-4 text-center">
                <Building2 className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  {searchTerm ? `No suppliers found for "${searchTerm}"` : 'No suppliers found'}
                </p>
                {showCreateButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateNew}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Supplier
                  </Button>
                )}
              </div>
            )}

            {!loading && !error && suppliers.length > 0 && (
              <div className="py-1">
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    onClick={() => handleSelect(supplier.id)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-start px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === supplier.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 mt-0.5",
                        value === supplier.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {supplier.company_name || supplier.display_name}
                        </span>
                        {supplier.supplier_type && (
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getSupplierTypeColor(supplier.supplier_type))}
                          >
                            {supplier.supplier_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {supplier.supplier_tier && (
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getSupplierTierColor(supplier.supplier_tier))}
                          >
                            {supplier.supplier_tier}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {supplier.contact_person && (
                          <div className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            <span className="truncate">{supplier.contact_person}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            <span className="truncate">{supplier.email}</span>
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            <span className="truncate">{supplier.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {showCreateButton && !loading && !error && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateNew}
                className="w-full justify-start"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Supplier
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected Supplier Info */}
      {selectedSupplier && (
        <Card className="mt-2 bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{selectedSupplier.company_name || selectedSupplier.display_name}</span>
                  {selectedSupplier.supplier_type && (
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", getSupplierTypeColor(selectedSupplier.supplier_type))}
                    >
                      {selectedSupplier.supplier_type.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {selectedSupplier.contact_person && (
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {selectedSupplier.contact_person}
                    </div>
                  )}
                  {selectedSupplier.email && (
                    <div className="flex items-center">
                      <Mail className="w-3 h-3 mr-1" />
                      {selectedSupplier.email}
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div className="flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      {selectedSupplier.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
