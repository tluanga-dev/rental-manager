'use client';

import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { skusApi } from '@/services/api/skus';
import type { SKU } from '@/types/sku';

interface SimpleSkuSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSkuSelect?: (sku: SKU) => void;
  placeholder?: string;
  saleable?: boolean;
}

export function SimpleSkuSelector({ 
  value, 
  onValueChange, 
  onSkuSelect,
  placeholder = "Select SKU",
  saleable = false 
}: SimpleSkuSelectorProps) {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSkus() {
      try {
        setLoading(true);
        const filters = { is_active: true, limit: 1000 };
        if (saleable) {
          // Add saleable filter if needed
        }
        const data = await skusApi.list(filters);
        setSkus(data.items);
      } catch (error) {
        console.error('Failed to load SKUs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSkus();
  }, [saleable]);

  const handleValueChange = (selectedValue: string) => {
    onValueChange?.(selectedValue);
    if (onSkuSelect) {
      const selectedSku = skus.find(sku => sku.id === selectedValue);
      if (selectedSku) {
        onSkuSelect(selectedSku);
      }
    }
  };

  if (loading) {
    return (
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Loading SKUs..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {skus.map((sku) => (
          <SelectItem key={sku.id} value={sku.id}>
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <div className="flex flex-col">
                <span>{sku.sku_name}</span>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{sku.sku_code}</span>
                  {sku.sale_base_price && (
                    <Badge variant="outline" className="text-xs">
                      ${sku.sale_base_price}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
        {skus.length === 0 && (
          <SelectItem value="no-skus" disabled>
            No SKUs found
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}