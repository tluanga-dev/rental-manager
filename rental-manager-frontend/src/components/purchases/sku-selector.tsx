'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

import { skusApi } from '@/services/api/skus';
import { cn } from '@/lib/utils';
import type { SKU } from '@/types/sku';

interface SkuSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  onSkuSelect?: (sku: SKU) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  saleable?: boolean;
}

export function SkuSelector({
  value,
  onValueChange,
  onSkuSelect,
  placeholder = 'Select SKU...',
  disabled = false,
  className,
  saleable = true
}: SkuSelectorProps) {
  const [open, setOpen] = useState(false);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load SKUs on mount and when search term changes
  useEffect(() => {
    const loadSkus = async () => {
      try {
        setLoading(true);
        const data = await skusApi.list({
          is_active: true,
          is_saleable: saleable,
          search: searchTerm,
          limit: 50
        });
        setSkus(data.items);
      } catch (error) {
        console.error('Failed to load SKUs:', error);
        setSkus([]);
      } finally {
        setLoading(false);
      }
    };

    loadSkus();
  }, [searchTerm, saleable]);

  const selectedSku = skus.find(sku => sku.id === value);

  const handleSkuSelect = (skuId: string) => {
    const sku = skus.find(s => s.id === skuId);
    onValueChange(skuId);
    if (sku && onSkuSelect) {
      onSkuSelect(sku);
    }
    setOpen(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          {selectedSku ? (
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{selectedSku.sku_name}</span>
              <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                {selectedSku.sku_code}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search SKUs..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading SKUs..." : "No SKUs found."}
            </CommandEmpty>
            <CommandGroup>
              {skus.map((sku) => (
                <CommandItem
                  key={sku.id}
                  value={sku.id}
                  onSelect={() => handleSkuSelect(sku.id)}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <Check
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        value === sku.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium truncate">
                          {sku.sku_name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {sku.sku_code}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {sku.sale_base_price && (
                          <span>Price: {formatCurrency(sku.sale_base_price)}</span>
                        )}
                        {sku.model_number && (
                          <span>Model: {sku.model_number}</span>
                        )}
                        <div className="flex items-center space-x-1">
                          {sku.is_saleable && (
                            <Badge variant="secondary" className="text-xs">
                              Saleable
                            </Badge>
                          )}
                          {sku.is_rentable && (
                            <Badge variant="outline" className="text-xs">
                              Rentable
                            </Badge>
                          )}
                        </div>
                      </div>
                      {sku.barcode && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Barcode: {sku.barcode}
                        </p>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}