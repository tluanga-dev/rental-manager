'use client';

import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { suppliersApi } from '@/services/api/suppliers';
import type { SupplierResponse } from '@/services/api/suppliers';

interface SimpleSupplierSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
}

export function SimpleSupplierSelector({ 
  value, 
  onValueChange, 
  placeholder = "Select supplier",
  allowCreate = false 
}: SimpleSupplierSelectorProps) {
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        setLoading(true);
        const data = await suppliersApi.list({ active_only: true, limit: 1000 });
        setSuppliers(data.items);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSuppliers();
  }, []);

  if (loading) {
    return (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Loading suppliers..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {suppliers.map((supplier) => (
          <SelectItem key={supplier.id} value={supplier.id}>
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>{supplier.display_name}</span>
              {supplier.supplier_tier && (
                <Badge variant="secondary" className="text-xs">
                  {supplier.supplier_tier}
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
        {suppliers.length === 0 && (
          <SelectItem value="no-suppliers" disabled>
            No suppliers found
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}