export interface RentalRateEditorProps {
  /** Current rental rate value */
  currentRate: number;
  
  /** Item ID for updating master data */
  itemId?: string;
  
  /** Period duration text (e.g., "3 days", "1 day") */
  periodText?: string;
  
  /** Currency symbol */
  currency?: string;
  
  /** Whether the rate can be edited */
  editable?: boolean;
  
  /** Whether to show the "Change" button */
  showChangeButton?: boolean;
  
  /** Whether to save changes to master data */
  saveToMaster?: boolean;
  
  /** Callback when rate changes (for local state) */
  onRateChange?: (newRate: number) => void;
  
  /** Callback when rate is saved to master data */
  onMasterDataUpdate?: (itemId: string, newRate: number) => Promise<void>;
  
  /** Callback when edit is cancelled */
  onCancel?: () => void;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Whether the editor is in a loading state */
  loading?: boolean;
  
  /** Minimum allowed rate value */
  minRate?: number;
  
  /** Maximum allowed rate value */
  maxRate?: number;
  
  /** Whether to show validation errors */
  showErrors?: boolean;
  
  /** Custom placeholder text for input */
  placeholder?: string;
}

export interface RentalRateDisplayProps {
  rate: number;
  currency?: string;
  periodText?: string;
  onEditClick?: () => void;
  showChangeButton?: boolean;
  className?: string;
}

export interface RentalRateInputProps {
  value: number;
  onChange: (value: number) => void;
  onSave: (value: number) => void;
  onCancel: () => void;
  loading?: boolean;
  minRate?: number;
  maxRate?: number;
  placeholder?: string;
  currency?: string;
  periodText?: string;
  error?: string;
  className?: string;
}