export interface CurrencyConfig {
  currency_code: string;
  symbol: string;
  description: string;
  is_default: boolean;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface CurrencyUpdateRequest {
  currency_code: string;
  description?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const currencyApi = {
  /**
   * Get the current system currency configuration
   */
  async getCurrentCurrency(): Promise<CurrencyConfig> {
    try {
      const response = await fetch(`${BASE_URL}/system-settings/currency`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch currency config: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Silently fallback to default currency configuration
      // Only log in development mode to avoid console spam in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('Currency API not available, using default INR configuration');
      }
      return {
        currency_code: 'INR',
        symbol: '₹',
        description: 'Indian Rupee',
        is_default: true,
      };
    }
  },

  /**
   * Update the system currency configuration
   */
  async updateCurrency(currencyData: CurrencyUpdateRequest): Promise<CurrencyConfig> {
    const response = await fetch(`${BASE_URL}/system-settings/currency`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(currencyData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update currency: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies(): Promise<SupportedCurrency[]> {
    const response = await fetch(`${BASE_URL}/system-settings/currency/supported`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch supported currencies: ${response.statusText}`);
    }

    return response.json();
  },
};