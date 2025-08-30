'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit2, Plus, AlertCircle, Check } from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import {
  useItemPricingTiers,
  useCreateStandardPricing,
  useUpdatePricingTier,
  useDeletePricingTier,
} from '@/hooks/useRentalPricing';
import { rentalPricingApi } from '@/services/api/rental-pricing';
import { useQueryClient } from '@tanstack/react-query';

interface PricingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  currentDailyRate?: number;
  onPricingUpdated?: () => void;
}

export function PricingManagementModal({
  isOpen,
  onClose,
  itemId,
  itemName,
  currentDailyRate,
  onPricingUpdated,
}: PricingManagementModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('existing');
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Form states for standard pricing
  const [standardDaily, setStandardDaily] = useState(currentDailyRate?.toString() || '');
  const [weeklyDiscount, setWeeklyDiscount] = useState('10');
  const [monthlyDiscount, setMonthlyDiscount] = useState('20');
  
  // Form states for custom pricing
  const [customTierName, setCustomTierName] = useState('');
  const [customPeriodType, setCustomPeriodType] = useState('DAILY');
  const [customPeriodDays, setCustomPeriodDays] = useState('1');
  const [customPeriodHours, setCustomPeriodHours] = useState('1');
  const [customPeriodUnit, setCustomPeriodUnit] = useState('DAY');
  const [customRate, setCustomRate] = useState('');
  const [customMinPeriods, setCustomMinPeriods] = useState('');
  const [customMaxPeriods, setCustomMaxPeriods] = useState('');
  const [customIsDefault, setCustomIsDefault] = useState(false);
  
  // Form states for editing
  const [editRate, setEditRate] = useState('');
  const [editMinDays, setEditMinDays] = useState('');
  const [editMaxDays, setEditMaxDays] = useState('');

  // Queries and mutations
  const { data: pricingTiers = [], isLoading, refetch } = useItemPricingTiers(itemId);
  const createStandardPricing = useCreateStandardPricing();
  const updatePricingTier = useUpdatePricingTier();
  const deletePricingTier = useDeletePricingTier();

  const handleCreateStandardPricing = async () => {
    try {
      await createStandardPricing.mutateAsync({
        itemId,
        template: {
          daily_rate: parseFloat(standardDaily),
          weekly_discount_percentage: parseFloat(weeklyDiscount),
          monthly_discount_percentage: parseFloat(monthlyDiscount),
        },
      });
      
      // Show success message
      toast.success('Standard pricing tiers created successfully');
      
      // Reset form and refresh
      setStandardDaily('');
      setWeeklyDiscount('10');
      setMonthlyDiscount('20');
      setActiveTab('existing');
      refetch();
      // Notify parent component of pricing update
      onPricingUpdated?.();
    } catch (error: any) {
      console.error('Error creating standard pricing:', error);
      
      // Show user-friendly error message
      const errorMessage = error?.response?.data?.detail || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to create standard pricing';
      
      toast.error(errorMessage);
    }
  };

  const handleCreateCustomPricing = async () => {
    try {
      const pricingData: any = {
        item_id: itemId,
        tier_name: customTierName,
        period_type: customPeriodType,
        period_unit: customPeriodUnit,
        rate_per_period: parseFloat(customRate),
        is_default: customIsDefault,
        is_active: true,
        priority: 100,
      };

      // Set period value based on unit
      if (customPeriodUnit === 'DAY') {
        const periodDays = customPeriodType === 'DAILY' ? 1 :
                          customPeriodType === 'WEEKLY' ? 7 :
                          customPeriodType === 'MONTHLY' ? 30 :
                          parseInt(customPeriodDays);
        pricingData.period_days = periodDays;
        pricingData.period_hours = null;
      } else {
        // For HOUR unit
        const periodHours = customPeriodType === 'HOURLY' ? 1 : parseInt(customPeriodHours);
        pricingData.period_hours = periodHours;
        pricingData.period_days = null;
      }

      // Set rental period constraints
      if (customMinPeriods) {
        pricingData.min_rental_periods = parseInt(customMinPeriods);
      }
      if (customMaxPeriods) {
        pricingData.max_rental_periods = parseInt(customMaxPeriods);
      }

      console.log('Creating pricing tier with data:', pricingData);
      
      await rentalPricingApi.createPricingTier(pricingData);

      // Show success message
      toast.success('Pricing tier created successfully');

      // Reset form
      setCustomTierName('');
      setCustomPeriodType('DAILY');
      setCustomPeriodDays('1');
      setCustomPeriodHours('1');
      setCustomPeriodUnit('DAY');
      setCustomRate('');
      setCustomMinPeriods('');
      setCustomMaxPeriods('');
      setCustomIsDefault(false);
      setActiveTab('existing');
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['rental-pricing'] });
      refetch();
      // Notify parent component of pricing update
      onPricingUpdated?.();
    } catch (error: any) {
      console.error('Error creating custom pricing:', error);
      
      // Show user-friendly error message
      const errorMessage = error?.response?.data?.detail || 
                          error?.response?.data?.message || 
                          error?.message || 
                          'Failed to create pricing tier';
      
      toast.error(errorMessage);
    }
  };

  const handleUpdateTier = async (tierId: string) => {
    try {
      await updatePricingTier.mutateAsync({
        pricingId: tierId,
        updateData: {
          rate_per_period: parseFloat(editRate),
          min_rental_days: editMinDays ? parseInt(editMinDays) : null,
          max_rental_days: editMaxDays ? parseInt(editMaxDays) : null,
        },
      });
      
      setEditingTier(null);
      refetch();
      // Notify parent component of pricing update
      onPricingUpdated?.();
    } catch (error) {
      console.error('Error updating tier:', error);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    try {
      await deletePricingTier.mutateAsync(tierId);
      setDeleteConfirm(null);
      refetch();
      // Notify parent component of pricing update
      onPricingUpdated?.();
    } catch (error) {
      console.error('Error deleting tier:', error);
    }
  };

  const startEditTier = (tier: any) => {
    setEditingTier(tier.id);
    setEditRate(tier.rate_per_period.toString());
    setEditMinDays(tier.min_rental_days?.toString() || '');
    setEditMaxDays(tier.max_rental_days?.toString() || '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Rental Pricing</DialogTitle>
          <DialogDescription>
            Configure pricing tiers for: <strong>{itemName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="existing">Existing Tiers</TabsTrigger>
            <TabsTrigger value="standard">Standard Template</TabsTrigger>
            <TabsTrigger value="custom">Custom Tier</TabsTrigger>
          </TabsList>

          {/* Existing Tiers Tab */}
          <TabsContent value="existing" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : pricingTiers.length > 0 ? (
              <div className="space-y-3">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {editingTier === tier.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{tier.tier_name}</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTier(tier.id)}
                              disabled={updatePricingTier.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTier(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor={`rate-${tier.id}`}>
                              Rate per {tier.period_value || tier.period_days || tier.period_hours || 1}{' '}
                              {tier.period_unit === 'HOUR' ? 
                                `hour${(tier.period_value || tier.period_hours || 1) > 1 ? 's' : ''}` :
                                `day${(tier.period_value || tier.period_days || 1) > 1 ? 's' : ''}`
                              }
                            </Label>
                            <Input
                              id={`rate-${tier.id}`}
                              type="number"
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              step="0.01"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`min-${tier.id}`}>Min Periods (optional)</Label>
                            <Input
                              id={`min-${tier.id}`}
                              type="number"
                              value={editMinDays}
                              onChange={(e) => setEditMinDays(e.target.value)}
                              placeholder="Min rental periods"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`max-${tier.id}`}>Max Periods (optional)</Label>
                            <Input
                              id={`max-${tier.id}`}
                              type="number"
                              value={editMaxDays}
                              onChange={(e) => setEditMaxDays(e.target.value)}
                              placeholder="Max rental periods"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{tier.tier_name}</h4>
                            {tier.is_default && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                            {!tier.is_active && (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditTier(tier)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {deleteConfirm === tier.id ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteTier(tier.id)}
                                  disabled={deletePricingTier.isPending}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteConfirm(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirm(tier.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Period:</span>
                            <p className="font-medium">
                              {tier.period_value || tier.period_days || tier.period_hours || 1}{' '}
                              {tier.period_unit === 'HOUR' ? 
                                `hour${(tier.period_value || tier.period_hours || 1) > 1 ? 's' : ''}` :
                                `day${(tier.period_value || tier.period_days || 1) > 1 ? 's' : ''}`
                              }
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rate:</span>
                            <p className="font-medium">{formatCurrencySync(tier.rate_per_period)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Daily Equivalent:</span>
                            <p className="font-medium">
                              {formatCurrencySync(tier.daily_equivalent_rate || tier.rate_per_period / (tier.period_days || 1))}/day
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rental Range:</span>
                            <p className="font-medium">
                              {tier.min_rental_periods || tier.min_rental_days || 1} - {tier.max_rental_periods || tier.max_rental_days || '∞'} periods
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No pricing tiers configured. Create a standard template or custom tier to get started.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Standard Template Tab */}
          <TabsContent value="standard" className="space-y-4">
            <Alert>
              <AlertDescription>
                Create standard daily, weekly, and monthly pricing tiers with automatic discounts.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="standard-daily">Daily Rate</Label>
                <Input
                  id="standard-daily"
                  type="number"
                  value={standardDaily}
                  onChange={(e) => setStandardDaily(e.target.value)}
                  placeholder="Enter daily rate"
                  step="0.01"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weekly-discount">Weekly Discount (%)</Label>
                  <Input
                    id="weekly-discount"
                    type="number"
                    value={weeklyDiscount}
                    onChange={(e) => setWeeklyDiscount(e.target.value)}
                    placeholder="e.g., 10"
                    min="0"
                    max="100"
                  />
                  {standardDaily && weeklyDiscount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Weekly rate: {formatCurrencySync(
                        parseFloat(standardDaily) * 7 * (1 - parseFloat(weeklyDiscount) / 100)
                      )}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="monthly-discount">Monthly Discount (%)</Label>
                  <Input
                    id="monthly-discount"
                    type="number"
                    value={monthlyDiscount}
                    onChange={(e) => setMonthlyDiscount(e.target.value)}
                    placeholder="e.g., 20"
                    min="0"
                    max="100"
                  />
                  {standardDaily && monthlyDiscount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Monthly rate: {formatCurrencySync(
                        parseFloat(standardDaily) * 30 * (1 - parseFloat(monthlyDiscount) / 100)
                      )}
                    </p>
                  )}
                </div>
              </div>
              
              <Button
                onClick={handleCreateStandardPricing}
                disabled={!standardDaily || createStandardPricing.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Standard Pricing
              </Button>
            </div>
          </TabsContent>

          {/* Custom Tier Tab */}
          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="tier-name">Tier Name</Label>
                <Input
                  id="tier-name"
                  value={customTierName}
                  onChange={(e) => setCustomTierName(e.target.value)}
                  placeholder="e.g., Weekend Special, 4-Hour Block"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="period-unit">Period Unit</Label>
                  <Select 
                    value={customPeriodUnit} 
                    onValueChange={(value) => {
                      setCustomPeriodUnit(value);
                      // Reset period type when switching units
                      if (value === 'HOUR') {
                        setCustomPeriodType('HOURLY');
                      } else {
                        setCustomPeriodType('DAILY');
                      }
                    }}
                  >
                    <SelectTrigger id="period-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOUR">Hours</SelectItem>
                      <SelectItem value="DAY">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="period-type">Period Type</Label>
                  <Select value={customPeriodType} onValueChange={setCustomPeriodType}>
                    <SelectTrigger id="period-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customPeriodUnit === 'DAY' ? (
                        <>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="CUSTOM">Custom Days</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                          <SelectItem value="CUSTOM">Custom Hours</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="period-value">
                  {customPeriodUnit === 'DAY' ? 
                    (customPeriodType === 'CUSTOM' ? 'Number of Days' : 'Days (auto)') :
                    (customPeriodType === 'CUSTOM' ? 'Number of Hours' : 'Hours (auto)')
                  }
                </Label>
                <Input
                  id="period-value"
                  type="number"
                  min="1"
                  value={
                    customPeriodUnit === 'DAY' ? (
                      customPeriodType === 'DAILY' ? '1' :
                      customPeriodType === 'WEEKLY' ? '7' :
                      customPeriodType === 'MONTHLY' ? '30' :
                      customPeriodDays
                    ) : (
                      customPeriodType === 'HOURLY' ? '1' :
                      customPeriodHours
                    )
                  }
                  onChange={(e) => {
                    if (customPeriodUnit === 'DAY') {
                      setCustomPeriodDays(e.target.value);
                    } else {
                      setCustomPeriodHours(e.target.value);
                    }
                  }}
                  disabled={customPeriodType !== 'CUSTOM'}
                  placeholder="e.g., 10 days, 4 hours, 11 days"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Examples: {customPeriodUnit === 'DAY' ? '10 days, 11 days, 14 days' : '4 hours, 8 hours, 12 hours'}
                </p>
              </div>
              
              <div>
                <Label htmlFor="rate">Rate per Period</Label>
                <Input
                  id="rate"
                  type="number"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="Enter rate"
                  step="0.01"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min-rental">Min Rental Periods (optional)</Label>
                  <Input
                    id="min-rental"
                    type="number"
                    min="1"
                    value={customMinPeriods}
                    onChange={(e) => setCustomMinPeriods(e.target.value)}
                    placeholder="e.g., 1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum: 1 period = {customPeriodUnit === 'DAY' ? 
                      `${customPeriodType === 'DAILY' ? '1' : customPeriodType === 'WEEKLY' ? '7' : customPeriodType === 'MONTHLY' ? '30' : customPeriodDays || '1'} day(s)` :
                      `${customPeriodType === 'HOURLY' ? '1' : customPeriodHours || '1'} hour(s)`
                    }
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="max-rental">Max Rental Periods (optional)</Label>
                  <Input
                    id="max-rental"
                    type="number"
                    min="1"
                    value={customMaxPeriods}
                    onChange={(e) => setCustomMaxPeriods(e.target.value)}
                    placeholder="e.g., 5"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Leave empty for unlimited rental duration
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-default"
                  checked={customIsDefault}
                  onCheckedChange={setCustomIsDefault}
                />
                <Label htmlFor="is-default">Set as default tier</Label>
              </div>
              
              {/* Show validation hints */}
              {(!customTierName || !customRate || 
                (customPeriodType === 'CUSTOM' && customPeriodUnit === 'DAY' && (!customPeriodDays || parseInt(customPeriodDays) < 1)) ||
                (customPeriodType === 'CUSTOM' && customPeriodUnit === 'HOUR' && (!customPeriodHours || parseInt(customPeriodHours) < 1))) && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {!customTierName && <div>• Please enter a tier name</div>}
                    {!customRate && <div>• Please enter a rate per period</div>}
                    {customPeriodType === 'CUSTOM' && customPeriodUnit === 'DAY' && (!customPeriodDays || parseInt(customPeriodDays) < 1) && (
                      <div>• Please enter number of days (must be at least 1)</div>
                    )}
                    {customPeriodType === 'CUSTOM' && customPeriodUnit === 'HOUR' && (!customPeriodHours || parseInt(customPeriodHours) < 1) && (
                      <div>• Please enter number of hours (must be at least 1)</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                onClick={() => {
                  console.log('Button clicked! Current state:', {
                    customTierName,
                    customRate,
                    customPeriodType,
                    customPeriodUnit,
                    customPeriodDays,
                    customPeriodHours,
                    customMinPeriods,
                    customMaxPeriods,
                    customIsDefault
                  });
                  handleCreateCustomPricing();
                }}
                disabled={
                  !customTierName || 
                  !customRate || 
                  (customPeriodType === 'CUSTOM' && customPeriodUnit === 'DAY' && (!customPeriodDays || parseInt(customPeriodDays) < 1)) ||
                  (customPeriodType === 'CUSTOM' && customPeriodUnit === 'HOUR' && (!customPeriodHours || parseInt(customPeriodHours) < 1))
                }
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Custom Tier
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}