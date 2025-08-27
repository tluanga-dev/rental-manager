'use client';

import { useQuery } from '@tanstack/react-query';
import { systemApi } from '@/services/api/system';
import type { CompanyInfo } from '@/types/system';

interface CompanyProfileData extends CompanyInfo {
  logo_url?: string;
  currency_code?: string;
  currency_symbol?: string;
  tax_number?: string;
  website?: string;
}

interface UseCompanyProfileResult {
  companyProfile: CompanyProfileData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch and manage company profile information from system settings
 * This provides a centralized way to access company information for all print operations
 */
export function useCompanyProfile(): UseCompanyProfileResult {
  const {
    data: companyProfile,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      try {
        const companyInfo = await systemApi.getCompanyInfo();
        
        // Enhance with additional data if needed
        const enhancedProfile: CompanyProfileData = {
          ...companyInfo,
          currency_code: 'INR', // Default currency, can be fetched from system settings
          currency_symbol: '₹', // Default symbol, can be fetched from system settings
          logo_url: undefined, // Will be implemented when logo upload is added
          website: undefined, // Can be added to system settings
          tax_number: companyInfo.company_gst_no || undefined,
        };

        return enhancedProfile;
      } catch (error) {
        console.error('Failed to fetch company profile:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - company info doesn't change frequently
    cacheTime: 30 * 60 * 1000, // 30 minutes - keep in cache for longer
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    companyProfile: companyProfile || null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to get company profile with fallback defaults
 * This ensures print operations never fail due to missing company information
 */
export function useCompanyProfileWithDefaults(): CompanyProfileData {
  const { companyProfile, isLoading } = useCompanyProfile();

  // Always return a valid object with defaults
  const defaultProfile: CompanyProfileData = {
    company_name: 'Your Company Name',
    company_address: '123 Business Street',
    company_email: 'info@yourcompany.com',
    company_phone: '(555) 123-4567',
    company_gst_no: '',
    company_registration_number: '',
    currency_code: 'INR',
    currency_symbol: '₹',
    tax_number: '',
    logo_url: undefined,
    website: undefined,
  };

  // Return defaults while loading or if no company profile exists
  if (isLoading || !companyProfile) {
    return defaultProfile;
  }

  // Ensure all required fields have values even if API returns null/undefined
  return {
    ...defaultProfile,
    ...companyProfile,
    company_name: companyProfile.company_name || defaultProfile.company_name,
    company_address: companyProfile.company_address || defaultProfile.company_address,
    company_email: companyProfile.company_email || defaultProfile.company_email,
    company_phone: companyProfile.company_phone || defaultProfile.company_phone,
  };
}

/**
 * Utility function to format currency using company profile settings
 */
export function formatCurrencyWithProfile(
  amount: number, 
  companyProfile?: CompanyProfileData | null
): string {
  const currencyCode = companyProfile?.currency_code || 'INR';
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Utility function to get company address formatted for print
 */
export function getFormattedCompanyAddress(companyProfile?: CompanyProfileData | null): string {
  if (!companyProfile || !companyProfile.company_address) {
    return '123 Business Street\nCity, State 12345';
  }
  
  return companyProfile.company_address;
}

/**
 * Utility function to get company contact information formatted for print
 */
export function getCompanyContactInfo(companyProfile?: CompanyProfileData | null): {
  phone: string;
  email: string;
  website?: string;
} {
  return {
    phone: companyProfile?.company_phone || '(555) 123-4567',
    email: companyProfile?.company_email || 'info@yourcompany.com',
    website: companyProfile?.website,
  };
}