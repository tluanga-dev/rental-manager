'use client';

import React, { useState, useEffect } from 'react';
import { Check, Settings, Globe } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { currencyApi, type CurrencyConfig, type SupportedCurrency } from '@/services/api/currency';
import { clearCurrencyCache, formatCurrencySync } from '@/lib/currency-utils';
import { useAppStore } from '@/stores/app-store';

interface CurrencySettingsProps {
  trigger?: React.ReactNode;
  onCurrencyChange?: (currency: CurrencyConfig) => void;
}

export function CurrencySettings({ trigger, onCurrencyChange }: CurrencySettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyConfig | null>(null);
  const [supportedCurrencies, setSupportedCurrencies] = useState<SupportedCurrency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const { addNotification } = useAppStore();

  // Load current currency and supported currencies
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [current, supported] = await Promise.all([
          currencyApi.getCurrentCurrency(),
          currencyApi.getSupportedCurrencies(),
        ]);
        
        setCurrentCurrency(current);
        setSupportedCurrencies(supported);
        setSelectedCurrency(current.currency_code);
      } catch (error) {
        console.error('Failed to load currency data:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load currency settings. Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleCurrencyUpdate = async () => {
    if (!selectedCurrency || selectedCurrency === currentCurrency?.currency_code) {
      setIsOpen(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const selectedCurrencyData = supportedCurrencies.find(c => c.code === selectedCurrency);
      const description = selectedCurrencyData 
        ? `Default currency (${selectedCurrencyData.name})`
        : `Default currency (${selectedCurrency})`;

      const updatedCurrency = await currencyApi.updateCurrency({
        currency_code: selectedCurrency,
        description,
      });

      // Clear the currency cache to force refresh
      clearCurrencyCache();
      
      setCurrentCurrency(updatedCurrency);
      setIsOpen(false);
      
      // Notify parent component
      if (onCurrencyChange) {
        onCurrencyChange(updatedCurrency);
      }

      addNotification({
        type: 'success',
        title: 'Currency Updated',
        message: `System currency changed to ${updatedCurrency.currency_code} (${updatedCurrency.symbol})`,
      });

      // Reload the page to apply currency changes throughout the app
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Failed to update currency:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update currency. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Globe className="h-4 w-4 mr-2" />
      Currency Settings
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Currency Settings
          </DialogTitle>
          <DialogDescription>
            Change the default currency used throughout the application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Currency Display */}
          {currentCurrency && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Current Currency</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono">
                      {currentCurrency.symbol}
                    </div>
                    <div>
                      <div className="font-medium">{currentCurrency.currency_code}</div>
                      <div className="text-sm text-muted-foreground">
                        {currentCurrency.description}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">Current</Badge>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Sample formatting: {formatCurrencySync(1234.56, { currencyCode: currentCurrency.currency_code })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Currency Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select New Currency</Label>
            <Select
              value={selectedCurrency}
              onValueChange={setSelectedCurrency}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a currency..." />
              </SelectTrigger>
              <SelectContent>
                {supportedCurrencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    <div className="flex items-center gap-3 w-full">
                      <div className="text-lg font-mono w-6">
                        {currency.symbol}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{currency.code}</div>
                        <div className="text-sm text-muted-foreground">
                          {currency.name}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrencySync(1234.56, { currencyCode: currency.code })}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCurrencyUpdate}
            disabled={isLoading || selectedCurrency === currentCurrency?.currency_code}
          >
            {isLoading ? (
              'Updating...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Update Currency
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}