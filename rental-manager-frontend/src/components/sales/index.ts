// Export all sales components
export { SaleForm } from './SaleForm';
export { SaleItemSelector } from './SaleItemSelector';
export { SalesHistoryTable } from './SalesHistoryTable';
export { SaleDetailView } from './SaleDetailView';

// Re-export types that components might need
export type {
  SaleFormData,
  SaleFormItem,
  SaleTransaction,
  SaleTransactionWithLines,
  CreateSaleRequest,
  SaleFilters,
  SaleableItem
} from '@/types/sales';