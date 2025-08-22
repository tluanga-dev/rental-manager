import axios from '@/lib/axios';
import { AxiosResponse } from 'axios';

export interface ExtensionAvailabilityRequest {
  new_end_date: string;
}

export interface ExtensionAvailabilityResponse {
  can_extend: boolean;
  conflicts: Record<string, any>;
  extension_charges: number;
  current_balance: number;
  total_with_extension: number;
  payment_required: boolean;
  items: Array<{
    line_id: string;
    item_id: string;
    item_name: string;
    current_end_date: string;
    can_extend_to?: string;
    max_extension_date?: string;
    has_conflict: boolean;
  }>;
}

export interface ExtensionItem {
  line_id: string;
  action: 'EXTEND' | 'PARTIAL_RETURN' | 'FULL_RETURN';
  extend_quantity?: number;
  return_quantity?: number;
  new_end_date?: string;
  return_condition?: 'GOOD' | 'DAMAGED' | 'BEYOND_REPAIR';
  condition_notes?: string;
  damage_assessment?: number;
}

export interface RentalExtensionRequest {
  new_end_date: string;
  items: ExtensionItem[];
  payment_option: 'PAY_NOW' | 'PAY_LATER';
  payment_amount?: number;
  payment_method?: string;
  payment_reference?: string;
  payment_notes?: string;
  notes?: string;
}

export interface RentalExtensionResponse {
  success: boolean;
  extension_id: string;
  rental_id: string;
  transaction_number: string;
  original_end_date: string;
  new_end_date: string;
  extension_type: string;
  extension_charges: number;
  payment_received: number;
  total_balance: number;
  payment_status: string;
  extension_count: number;
  message?: string;
}

export interface RentalBalanceResponse {
  rental_id: string;
  transaction_number: string;
  original_rental: number;
  extension_charges: number;
  late_fees: number;
  damage_fees: number;
  total_charges: number;
  payments_received: number;
  balance_due: number;
  payment_status: string;
  extension_count: number;
}

export interface ExtensionHistoryItem {
  extension_id: string;
  extension_date: string;
  original_end_date: string;
  new_end_date: string;
  extension_type: string;
  extension_charges: number;
  payment_received: number;
  payment_status: string;
  extended_by?: string;
  notes?: string;
}

export interface ExtensionHistoryResponse {
  rental_id: string;
  transaction_number: string;
  total_extensions: number;
  extensions: ExtensionHistoryItem[];
}

class RentalExtensionService {
  private baseUrl = '/transactions/rentals';

  /**
   * Check if a rental can be extended to a specific date
   */
  async checkAvailability(
    rentalId: string,
    newEndDate: string
  ): Promise<ExtensionAvailabilityResponse> {
    const response: AxiosResponse<ExtensionAvailabilityResponse> = await axios.get(
      `${this.baseUrl}/${rentalId}/extension-availability`,
      { params: { new_end_date: newEndDate } }
    );
    return response.data;
  }

  /**
   * Process a rental extension
   */
  async processExtension(
    rentalId: string,
    request: RentalExtensionRequest
  ): Promise<RentalExtensionResponse> {
    const response: AxiosResponse<RentalExtensionResponse> = await axios.post(
      `${this.baseUrl}/${rentalId}/extend`,
      request
    );
    return response.data;
  }

  /**
   * Get current balance for a rental
   */
  async getBalance(rentalId: string): Promise<RentalBalanceResponse> {
    const response: AxiosResponse<RentalBalanceResponse> = await axios.get(
      `${this.baseUrl}/${rentalId}/balance`
    );
    return response.data;
  }

  /**
   * Get extension history for a rental
   */
  async getExtensionHistory(rentalId: string): Promise<ExtensionHistoryResponse> {
    const response: AxiosResponse<ExtensionHistoryResponse> = await axios.get(
      `${this.baseUrl}/${rentalId}/extension-history`
    );
    return response.data;
  }

  /**
   * Calculate extension charges preview
   */
  calculateExtensionCharges(
    items: Array<{ quantity: number; daily_rate: number }>,
    days: number
  ): number {
    return items.reduce((total, item) => {
      return total + (item.quantity * item.daily_rate * days);
    }, 0);
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  /**
   * Check if extension is possible based on status
   */
  canExtend(rentalStatus: string): boolean {
    const extendableStatuses = [
      'RENTAL_INPROGRESS',
      'RENTAL_EXTENDED',
      'RENTAL_LATE',
      'RENTAL_PARTIAL_RETURN',
      'RENTAL_LATE_PARTIAL_RETURN'
    ];
    return extendableStatuses.includes(rentalStatus);
  }

  /**
   * Check availability for period-based extension
   */
  async checkPeriodAvailability(
    rentalId: string,
    periodCount: number,
    periodType: 'DAY' | 'WEEK' | 'MONTH',
    currentEndDate: string
  ): Promise<ExtensionAvailabilityResponse> {
    // Calculate the new end date based on period
    const endDate = this.calculateEndDateFromPeriod(currentEndDate, periodCount, periodType);
    return this.checkAvailability(rentalId, endDate);
  }

  /**
   * Calculate end date from period count and type
   */
  calculateEndDateFromPeriod(
    startDate: string,
    periodCount: number,
    periodType: 'DAY' | 'WEEK' | 'MONTH'
  ): string {
    const date = new Date(startDate);
    // Add one day to start from the day after current end date
    date.setDate(date.getDate() + 1);
    
    switch (periodType) {
      case 'DAY':
        date.setDate(date.getDate() + periodCount);
        break;
      case 'WEEK':
        date.setDate(date.getDate() + (periodCount * 7));
        break;
      case 'MONTH':
        date.setMonth(date.getMonth() + periodCount);
        break;
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate total days from period
   */
  calculateDaysFromPeriod(
    periodCount: number,
    periodType: 'DAY' | 'WEEK' | 'MONTH',
    startDate?: string
  ): number {
    switch (periodType) {
      case 'DAY':
        return periodCount;
      case 'WEEK':
        return periodCount * 7;
      case 'MONTH':
        // If start date provided, calculate actual days for months
        if (startDate) {
          const start = new Date(startDate);
          start.setDate(start.getDate() + 1); // Start from next day
          const end = new Date(start);
          end.setMonth(end.getMonth() + periodCount);
          return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
        // Default approximation
        return periodCount * 30;
      default:
        return periodCount;
    }
  }

  /**
   * Build extension request for period-based extension
   */
  buildPeriodExtensionRequest(
    items: Array<{ line_id: string; quantity: number }>,
    periodCount: number,
    periodType: 'DAY' | 'WEEK' | 'MONTH',
    currentEndDate: string,
    paymentOption: 'PAY_NOW' | 'PAY_LATER' = 'PAY_LATER',
    notes?: string
  ): RentalExtensionRequest {
    const newEndDate = this.calculateEndDateFromPeriod(currentEndDate, periodCount, periodType);
    const periodDescription = `${periodCount} ${periodType.toLowerCase()}${periodCount > 1 ? 's' : ''}`;
    
    return {
      new_end_date: newEndDate,
      items: items.map(item => ({
        line_id: item.line_id,
        action: 'EXTEND' as const,
        extend_quantity: item.quantity,
        new_end_date: newEndDate
      })),
      payment_option: paymentOption,
      notes: notes || `Extension for ${periodDescription}`
    };
  }
}

export const rentalExtensionService = new RentalExtensionService();