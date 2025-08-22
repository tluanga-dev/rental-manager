'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calculator, 
  Percent, 
  Tag, 
  Package, 
  TrendingDown, 
  Info,
  Gift
} from 'lucide-react';
import { CartItem, DiscountRule, DiscountType, PricingBreakdown, TierPricing } from '@/types/transactions';
import { CustomerTier } from '@/types/api';

interface PricingCalculatorProps {
  cartItems: CartItem[];
  customerTier?: CustomerTier;
  availableDiscounts: DiscountRule[];
  onPricingUpdate: (pricing: PricingBreakdown) => void;
  onDiscountApply: (discountAmount: number, discountDescription?: string) => void;
}

export function PricingCalculator({
  cartItems,
  customerTier,
  availableDiscounts,
  onPricingUpdate,
  onDiscountApply,
}: PricingCalculatorProps) {
  const [selectedDiscount, setSelectedDiscount] = useState<DiscountRule | null>(null);
  const [customDiscountType, setCustomDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [customDiscountValue, setCustomDiscountValue] = useState<number>(0);
  const [manualDiscountAmount, setManualDiscountAmount] = useState<number>(0);

  // Tax configuration (could be made configurable)
  const TAX_RATE = 0.18; // 18% GST

  // Customer tier discounts
  const tierDiscounts: Record<CustomerTier, number> = {
    BRONZE: 0,
    SILVER: 5,
    GOLD: 10,
    PLATINUM: 15,
  };

  // Rental duration discounts (example tier pricing)
  const rentalTierPricing: TierPricing[] = [
    { min_days: 1, max_days: 3, discount_percentage: 0, price_per_day: 1.0 },
    { min_days: 4, max_days: 7, discount_percentage: 5, price_per_day: 0.95 },
    { min_days: 8, max_days: 14, discount_percentage: 10, price_per_day: 0.90 },
    { min_days: 15, max_days: 30, discount_percentage: 15, price_per_day: 0.85 },
    { min_days: 31, discount_percentage: 20, price_per_day: 0.80 },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateLineTotal = (item: CartItem, applyDiscounts = true) => {
    let baseAmount = item.quantity * item.unit_price;
    
    // Apply rental days
    if (item.rental_days) {
      baseAmount *= item.rental_days;
      
      // Apply tier pricing for longer rentals
      if (applyDiscounts && item.rental_days > 3) {
        const tierPricing = rentalTierPricing.find(tier => 
          item.rental_days >= tier.min_days && 
          (tier.max_days === undefined || item.rental_days <= tier.max_days)
        );
        
        if (tierPricing) {
          baseAmount *= tierPricing.price_per_day;
        }
      }
    }
    
    // Apply item-level discount
    if (applyDiscounts && item.discount_percentage > 0) {
      const discountAmount = baseAmount * (item.discount_percentage / 100);
      baseAmount -= discountAmount;
    }
    
    return baseAmount;
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const calculateTierDiscount = (subtotal: number) => {
    if (!customerTier) return 0;
    const discountPercentage = tierDiscounts[customerTier] || 0;
    return subtotal * (discountPercentage / 100);
  };

  const calculateBulkDiscount = (subtotal: number) => {
    // Apply bulk discount for large orders
    if (subtotal > 50000) return subtotal * 0.05; // 5% for orders > ₹50,000
    if (subtotal > 25000) return subtotal * 0.03; // 3% for orders > ₹25,000
    if (subtotal > 10000) return subtotal * 0.02; // 2% for orders > ₹10,000
    return 0;
  };

  const calculateSelectedDiscountAmount = (subtotal: number) => {
    if (!selectedDiscount) return 0;
    
    switch (selectedDiscount.type) {
      case 'PERCENTAGE':
        return subtotal * (selectedDiscount.value / 100);
      case 'FIXED_AMOUNT':
        return Math.min(selectedDiscount.value, subtotal);
      case 'BUY_X_GET_Y':
        // Simplified implementation
        return subtotal * 0.1; // 10% for buy X get Y
      default:
        return 0;
    }
  };

  const calculateCustomDiscount = (subtotal: number) => {
    if (customDiscountValue <= 0) return 0;
    
    if (customDiscountType === 'percentage') {
      return subtotal * (Math.min(customDiscountValue, 100) / 100);
    } else {
      return Math.min(customDiscountValue, subtotal);
    }
  };

  const calculateDepositTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.deposit_per_unit * item.quantity), 0);
  };

  const calculatePricing = (): PricingBreakdown => {
    const subtotal = calculateSubtotal();
    
    // Calculate all possible discounts
    const tierDiscount = calculateTierDiscount(subtotal);
    const bulkDiscount = calculateBulkDiscount(subtotal);
    const selectedDiscountAmount = calculateSelectedDiscountAmount(subtotal);
    const customDiscountAmount = calculateCustomDiscount(subtotal);
    
    // Total discount is the sum of all applicable discounts
    const totalDiscount = tierDiscount + bulkDiscount + selectedDiscountAmount + customDiscountAmount + manualDiscountAmount;
    
    // Ensure discount doesn't exceed subtotal
    const discount_amount = Math.min(totalDiscount, subtotal);
    
    const taxable_amount = subtotal - discount_amount;
    const tax_amount = taxable_amount * TAX_RATE;
    const total_amount = taxable_amount + tax_amount;
    const deposit_total = calculateDepositTotal();
    const payment_due = total_amount + deposit_total;

    return {
      subtotal,
      discount_amount,
      tax_amount,
      deposit_total,
      total_amount,
      payment_due,
    };
  };

  // Update pricing whenever cart or discounts change
  useEffect(() => {
    const pricing = calculatePricing();
    onPricingUpdate(pricing);
  }, [cartItems, selectedDiscount, customDiscountValue, customDiscountType, manualDiscountAmount, customerTier, onPricingUpdate]);

  const applyDiscount = (rule: DiscountRule) => {
    setSelectedDiscount(rule);
    const subtotal = calculateSubtotal();
    const discountAmount = calculateSelectedDiscountAmount(subtotal);
    onDiscountApply(discountAmount, rule.name);
  };

  const applyCustomDiscount = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateCustomDiscount(subtotal);
    setManualDiscountAmount(discountAmount);
    onDiscountApply(discountAmount, `Custom ${customDiscountType} discount`);
  };

  const clearDiscounts = () => {
    setSelectedDiscount(null);
    setCustomDiscountValue(0);
    setManualDiscountAmount(0);
    onDiscountApply(0);
  };

  const pricing = calculatePricing();
  const savings = pricing.subtotal - pricing.total_amount;

  // Get applicable discounts based on cart contents and customer
  const applicableDiscounts = availableDiscounts.filter(discount => {
    if (!discount.is_active) return false;
    
    // Check minimum amount
    if (discount.minimum_amount && pricing.subtotal < discount.minimum_amount) return false;
    
    // Check customer tier
    if (discount.customer_tiers && customerTier && !discount.customer_tiers.includes(customerTier)) return false;
    
    // Check date validity
    if (discount.start_date && new Date(discount.start_date) > new Date()) return false;
    if (discount.end_date && new Date(discount.end_date) < new Date()) return false;
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calculator className="h-5 w-5" />
          <h2 className="text-xl font-bold">Pricing Calculator</h2>
        </div>
        {savings > 0 && (
          <Badge className="bg-green-100 text-green-800">
            <TrendingDown className="h-3 w-3 mr-1" />
            Saving {formatCurrency(savings)}
          </Badge>
        )}
      </div>

      {/* Line Items Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {cartItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No items in cart
            </p>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item, index) => {
                const lineTotal = calculateLineTotal(item);
                const originalTotal = calculateLineTotal(item, false);
                const lineSavings = originalTotal - lineTotal;
                
                return (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">SKU: {item.sku_id}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                        {item.rental_days && ` × ${item.rental_days} days`}
                        {item.discount_percentage > 0 && (
                          <span className="text-green-600 ml-2">
                            ({item.discount_percentage}% off)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(lineTotal)}</div>
                      {lineSavings > 0 && (
                        <div className="text-sm text-green-600">
                          Save {formatCurrency(lineSavings)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Discounts */}
      {applicableDiscounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Gift className="h-5 w-5" />
              <span>Available Discounts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {applicableDiscounts.map((discount) => (
                <div
                  key={discount.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDiscount?.id === discount.id
                      ? 'border-slate-500 bg-slate-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => applyDiscount(discount)}
                >
                  <div className="font-medium">{discount.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {discount.type === 'PERCENTAGE'
                      ? `${discount.value}% off`
                      : `${formatCurrency(discount.value)} off`
                    }
                    {discount.minimum_amount && (
                      <span className="ml-2">
                        (Min: {formatCurrency(discount.minimum_amount)})
                      </span>
                    )}
                  </div>
                  {selectedDiscount?.id === discount.id && (
                    <Badge variant="secondary" className="mt-2">
                      Applied
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Tier Benefits */}
      {customerTier && tierDiscounts[customerTier] > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-purple-500" />
                <span className="font-medium">{customerTier} Tier Discount</span>
                <Badge variant="outline">{tierDiscounts[customerTier]}% off</Badge>
              </div>
              <div className="font-medium text-purple-600">
                -{formatCurrency(calculateTierDiscount(pricing.subtotal))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Discount */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Percent className="h-5 w-5" />
            <span>Custom Discount</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={customDiscountType} onValueChange={(value: 'percentage' | 'fixed') => setCustomDiscountType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input
                type="number"
                min="0"
                max={customDiscountType === 'percentage' ? 100 : pricing.subtotal}
                value={customDiscountValue}
                onChange={(e) => setCustomDiscountValue(Number(e.target.value))}
                placeholder={customDiscountType === 'percentage' ? '10' : '1000'}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={applyCustomDiscount} className="w-full">
                Apply Custom
              </Button>
            </div>
          </div>
          
          {customDiscountValue > 0 && (
            <div className="mt-4 p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span>Custom discount preview:</span>
                <span className="font-medium">
                  -{formatCurrency(calculateCustomDiscount(pricing.subtotal))}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Pricing Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(pricing.subtotal)}</span>
            </div>
            
            {customerTier && calculateTierDiscount(pricing.subtotal) > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>{customerTier} Tier Discount:</span>
                <span>-{formatCurrency(calculateTierDiscount(pricing.subtotal))}</span>
              </div>
            )}
            
            {calculateBulkDiscount(pricing.subtotal) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Bulk Discount:</span>
                <span>-{formatCurrency(calculateBulkDiscount(pricing.subtotal))}</span>
              </div>
            )}
            
            {selectedDiscount && (
              <div className="flex justify-between text-slate-600">
                <span>{selectedDiscount.name}:</span>
                <span>-{formatCurrency(calculateSelectedDiscountAmount(pricing.subtotal))}</span>
              </div>
            )}
            
            {manualDiscountAmount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Custom Discount:</span>
                <span>-{formatCurrency(manualDiscountAmount)}</span>
              </div>
            )}
            
            {pricing.discount_amount > 0 && (
              <div className="flex justify-between font-medium text-green-600 border-t pt-2">
                <span>Total Discount:</span>
                <span>-{formatCurrency(pricing.discount_amount)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span>Tax ({(TAX_RATE * 100).toFixed(0)}%):</span>
              <span>{formatCurrency(pricing.tax_amount)}</span>
            </div>
            
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Net Amount:</span>
              <span>{formatCurrency(pricing.total_amount)}</span>
            </div>
            
            {pricing.deposit_total > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Security Deposit:</span>
                <span>{formatCurrency(pricing.deposit_total)}</span>
              </div>
            )}
            
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total Due:</span>
              <span>{formatCurrency(pricing.payment_due)}</span>
            </div>
          </div>
          
          {(selectedDiscount || manualDiscountAmount > 0) && (
            <div className="mt-4">
              <Button variant="outline" onClick={clearDiscounts} className="w-full">
                Clear All Discounts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Savings Summary */}
      {savings > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                You're saving {formatCurrency(savings)}!
              </div>
              <div className="text-sm text-green-700 mt-1">
                That's {((savings / pricing.subtotal) * 100).toFixed(1)}% off the original price
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}