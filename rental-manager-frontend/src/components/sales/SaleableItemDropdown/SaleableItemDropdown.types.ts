import type { SaleableItem } from '@/types/sales';

export interface SaleableItemDropdownProps {
  value?: string;
  onChange: (value: string, item?: SaleableItem) => void;
  placeholder?: string;
  disabled?: boolean;
  showSku?: boolean;
  showPrice?: boolean;
  showStock?: boolean;
  fullWidth?: boolean;
  className?: string;
  locationId?: string;
  categoryId?: string;
  brandId?: string;
}