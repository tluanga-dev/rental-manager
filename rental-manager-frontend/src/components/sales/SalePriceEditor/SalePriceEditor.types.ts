export interface SalePriceEditorProps {
  /** Current sale price value */
  currentPrice: number;
  
  /** Unit ID for updating sale price */
  unitId?: string;
  
  /** Currency symbol */
  currency?: string;
  
  /** Whether the price can be edited */
  editable?: boolean;
  
  /** Whether to show the "Change" button */
  showChangeButton?: boolean;
  
  /** Callback when price changes (for local state) */
  onPriceChange?: (newPrice: number) => void;
  
  /** Callback when edit is cancelled */
  onCancel?: () => void;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Whether the editor is in a loading state */
  loading?: boolean;
  
  /** Minimum allowed price value */
  minPrice?: number;
  
  /** Maximum allowed price value */
  maxPrice?: number;
  
  /** Whether to show validation errors */
  showErrors?: boolean;
  
  /** Custom placeholder text for input */
  placeholder?: string;
}

export interface SalePriceDisplayProps {
  price: number;
  currency?: string;
  onEditClick?: () => void;
  showChangeButton?: boolean;
  className?: string;
}

export interface SalePriceInputProps {
  value: number;
  onChange: (value: number) => void;
  onSave: (value: number) => void;
  onCancel: () => void;
  loading?: boolean;
  minPrice?: number;
  maxPrice?: number;
  placeholder?: string;
  currency?: string;
  error?: string;
  className?: string;
}