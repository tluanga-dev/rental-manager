'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Plus, 
  Minus, 
  Package, 
  Calendar as CalendarIcon,
  ShoppingCart,
  X,
  AlertCircle,
  Clock,
  MapPin,
  Edit2,
  Check
} from 'lucide-react';
import { RentableItemDropdown } from '@/components/items/RentableItemDropdown';
import { PriceInput } from '@/components/ui/price-input';
import { Badge } from '@/components/ui/badge';
import type { RentableItem } from '@/types/rentable-item';
import type { CartItem, TransactionType } from '@/types/transactions';

interface RentableItemSelectorProps {
  cartItems: CartItem[];
  transactionType: TransactionType;
  locationId?: string;
  onCartUpdate: (cartItems: CartItem[]) => void;
  isLoading?: boolean;
}

interface CartItemWithDetails extends CartItem {
  item_name: string;
  sku: string;
  category_name?: string;
  brand_name?: string;
  available_quantity: number;
}

export function RentableItemSelector({
  cartItems,
  transactionType,
  locationId,
  onCartUpdate,
  isLoading,
}: RentableItemSelectorProps) {
  const [selectedItem, setSelectedItem] = useState<RentableItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [rentalDays, setRentalDays] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [cartItemsWithDetails, setCartItemsWithDetails] = useState<CartItemWithDetails[]>([]);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState<number | undefined>(undefined);

  const isRental = transactionType === 'RENTAL';

  // Auto-calculate end date when start date or rental days change
  useEffect(() => {
    if (startDate && rentalDays > 0) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + rentalDays - 1);
      setEndDate(end);
    }
  }, [startDate, rentalDays]);

  // Update cart items with details when cartItems change
  useEffect(() => {
    // For now, we'll create mock details. In a real implementation,
    // this would fetch the item details from the API or store them in cart
    const itemsWithDetails: CartItemWithDetails[] = cartItems.map(item => ({
      ...item,
      item_name: `Item ${item.sku_id?.slice(-4) || 'Unknown'}`, // Mock name from SKU
      sku: item.sku_id || 'UNKNOWN',
      category_name: 'Category',
      brand_name: 'Brand',
      available_quantity: 10, // Mock availability
    }));
    setCartItemsWithDetails(itemsWithDetails);
  }, [cartItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN');
  };

  const isInCart = (itemId: string) => {
    return cartItems.some(item => item.sku_id === itemId);
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cartItems.find(item => item.sku_id === itemId);
    return cartItem?.quantity || 0;
  };

  const handleItemSelect = (itemId: string | null, item: RentableItem | null) => {
    setSelectedItemId(itemId);
    setSelectedItem(item);
    
    // Reset form when item changes
    if (item) {
      setQuantity(1);
      if (isRental) {
        setRentalDays(item.rental_pricing.min_rental_days || 1);
      }
    }
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;

    // Check availability
    if (quantity > selectedItem.availability.total_available) {
      alert(`Insufficient availability. Only ${selectedItem.availability.total_available} units available.`);
      return;
    }

    // Check rental days constraints
    if (isRental) {
      const minDays = selectedItem.rental_pricing.min_rental_days;
      const maxDays = selectedItem.rental_pricing.max_rental_days;
      
      if (rentalDays < minDays) {
        alert(`Minimum rental period is ${minDays} days.`);
        return;
      }
      
      if (maxDays && rentalDays > maxDays) {
        alert(`Maximum rental period is ${maxDays} days.`);
        return;
      }
    }

    const basePrice = selectedItem.rental_pricing.base_price || 0;
    const effectivePrice = customPrice !== undefined ? customPrice : basePrice;

    const cartItem: CartItem = {
      sku_id: selectedItem.id,
      quantity,
      unit_price: effectivePrice,
      original_price: basePrice,
      custom_price: customPrice,
      rental_days: isRental ? rentalDays : undefined,
      rental_start_date: isRental && startDate ? startDate.toISOString() : undefined,
      rental_end_date: isRental && endDate ? endDate.toISOString() : undefined,
      deposit_per_unit: 0, // Could be calculated from item details
      discount_percentage: 0,
    };

    const existingIndex = cartItems.findIndex(item => item.sku_id === selectedItem.id);
    let updatedCart: CartItem[];

    if (existingIndex >= 0) {
      // Update existing item
      updatedCart = [...cartItems];
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + quantity,
      };
    } else {
      // Add new item
      updatedCart = [...cartItems, cartItem];
    }

    onCartUpdate(updatedCart);
    resetForm();
  };

  const handleRemoveFromCart = (itemId: string) => {
    const updatedCart = cartItems.filter(item => item.sku_id !== itemId);
    onCartUpdate(updatedCart);
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }

    const updatedCart = cartItems.map(item =>
      item.sku_id === itemId ? { ...item, quantity: newQuantity } : item
    );
    onCartUpdate(updatedCart);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setSelectedItemId(null);
    setQuantity(1);
    setRentalDays(1);
    setStartDate(new Date());
    setEndDate(undefined);
    setIsEditingPrice(false);
    setCustomPrice(undefined);
  };

  const calculateLineTotal = (item: CartItem) => {
    const baseAmount = item.quantity * item.unit_price * (item.rental_days || 1);
    const discountAmount = baseAmount * (item.discount_percentage / 100);
    return baseAmount - discountAmount;
  };

  const calculateCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const getTotalCartQuantity = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const canAddToCart = () => {
    return selectedItem && quantity > 0 && (!isRental || (startDate && rentalDays > 0));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Select Rentable Items</h2>
        <p className="text-muted-foreground">
          Choose items and quantities for your {transactionType.toLowerCase()}
        </p>
      </div>

      {/* Item Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Add Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rentable Item Dropdown */}
          <div className="space-y-2">
            <Label>Search and Select Item</Label>
            <RentableItemDropdown
              value={selectedItemId}
              onChange={handleItemSelect}
              placeholder="Search for available rentable items..."
              locationId={locationId}
              showAvailability={true}
              showPricing={true}
              showLocation={true}
              showCategory={true}
              showBrand={true}
              disabled={isLoading}
              helperText={selectedItem ? `${selectedItem.availability.total_available} units available` : undefined}
            />
          </div>

          {/* Item Configuration */}
          {selectedItem && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium">{selectedItem.item_name}</h4>
                  <p className="text-sm text-muted-foreground">SKU: {selectedItem.sku}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {selectedItem.category && (
                      <span>{selectedItem.category.name}</span>
                    )}
                    {selectedItem.brand && (
                      <span>• {selectedItem.brand.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {selectedItem.rental_pricing.base_price && (
                    <div className="font-medium">
                      {formatCurrency(selectedItem.rental_pricing.base_price)}
                      {isRental && `/${selectedItem.rental_pricing.rental_period || 'day'}`}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Min {selectedItem.rental_pricing.min_rental_days} days
                  </div>
                </div>
              </div>

              {/* Availability Info */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Package className="h-4 w-4" />
                  <span>{selectedItem.availability.total_available} available</span>
                </div>
                {selectedItem.availability.locations.length > 0 && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedItem.availability.locations[0].location_name}</span>
                    {selectedItem.availability.locations.length > 1 && (
                      <span>+{selectedItem.availability.locations.length - 1} more</span>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity and Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max={selectedItem.availability.total_available}
                      value={quantity}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(selectedItem.availability.total_available, parseInt(e.target.value) || 1));
                        setQuantity(val);
                      }}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.min(selectedItem.availability.total_available, quantity + 1))}
                      disabled={quantity >= selectedItem.availability.total_available}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {quantity > selectedItem.availability.total_available && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Only {selectedItem.availability.total_available} available
                    </p>
                  )}
                </div>

                {isRental && (
                  <div className="space-y-2">
                    <Label htmlFor="rental_days">Rental Days</Label>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="rental_days"
                        type="number"
                        min={selectedItem.rental_pricing.min_rental_days}
                        max={selectedItem.rental_pricing.max_rental_days || undefined}
                        value={rentalDays}
                        onChange={(e) => {
                          const val = Math.max(
                            selectedItem.rental_pricing.min_rental_days,
                            Math.min(
                              selectedItem.rental_pricing.max_rental_days || 365,
                              parseInt(e.target.value) || 1
                            )
                          );
                          setRentalDays(val);
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min: {selectedItem.rental_pricing.min_rental_days} days
                      {selectedItem.rental_pricing.max_rental_days && 
                        `, Max: ${selectedItem.rental_pricing.max_rental_days} days`
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Date Selection for Rentals */}
              {isRental && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {startDate ? formatDate(startDate) : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <div className="p-2 bg-white border rounded-md">
                      {endDate ? formatDate(endDate) : 'Auto-calculated'}
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Summary */}
              <Card className="bg-white">
                <CardContent className="p-4">
                  <h5 className="font-medium mb-2">Pricing Summary</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Unit Price:</span>
                        <div className="flex items-center gap-2">
                          {!isEditingPrice ? (
                            <>
                              <span className={customPrice !== undefined ? 'line-through text-muted-foreground' : ''}>
                                {selectedItem.rental_pricing.base_price !== null 
                                  ? formatCurrency(selectedItem.rental_pricing.base_price)
                                  : 'Not set'}
                                {selectedItem.rental_pricing.base_price !== null && isRental && `/${selectedItem.rental_pricing.rental_period || 'day'}`}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsEditingPrice(true)}
                                title="Edit price"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <PriceInput
                                value={customPrice ?? selectedItem.rental_pricing.base_price ?? 0}
                                onChange={setCustomPrice}
                                className="w-24 h-7 text-sm"
                                min={0}
                                placeholder="0.00"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsEditingPrice(false)}
                                title="Confirm price"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {customPrice !== undefined && customPrice !== selectedItem.rental_pricing.base_price && (
                        <div className="flex justify-between items-center">
                          <span>Custom Price:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">
                              {formatCurrency(customPrice)}
                              {isRental && `/${selectedItem.rental_pricing.rental_period || 'day'}`}
                            </span>
                            {selectedItem.rental_pricing.base_price !== null && selectedItem.rental_pricing.base_price > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {((customPrice - selectedItem.rental_pricing.base_price) / selectedItem.rental_pricing.base_price * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Quantity:</span>
                        <span>{quantity}</span>
                      </div>
                      {isRental && (
                        <div className="flex justify-between">
                          <span>Days:</span>
                          <span>{rentalDays}</span>
                        </div>
                      )}
                      <div className="border-t pt-1 flex justify-between font-medium">
                        <span>Line Total:</span>
                        <span>
                          {formatCurrency(quantity * (customPrice ?? selectedItem.rental_pricing.base_price ?? 0) * (isRental ? rentalDays : 1))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Add to Cart Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddToCart} 
                  disabled={!canAddToCart() || isLoading}
                  className="min-w-32"
                >
                  {isLoading ? 'Adding...' : `Add to Cart${isInCart(selectedItem.id) ? ' (Update)' : ''}`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>Cart ({getTotalCartQuantity()} items)</span>
          </CardTitle>
          {cartItems.length > 0 && (
            <div className="text-lg font-semibold">
              Total: {formatCurrency(calculateCartTotal())}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {cartItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Your cart is empty</p>
              <p className="text-sm">Search and add rentable items to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartItemsWithDetails.map((item) => (
                    <TableRow key={item.sku_id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-sm text-muted-foreground">
                            SKU: {item.sku}
                          </div>
                          {item.rental_start_date && item.rental_end_date && (
                            <div className="text-xs text-muted-foreground">
                              {formatDate(new Date(item.rental_start_date))} - {formatDate(new Date(item.rental_end_date))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div>
                              {formatCurrency(item.unit_price)}
                              {isRental && item.rental_days && `/day`}
                            </div>
                            {item.custom_price !== undefined && item.custom_price !== item.original_price && (
                              <Badge variant="secondary" className="text-xs">
                                Custom
                              </Badge>
                            )}
                          </div>
                          {item.rental_days && (
                            <div className="text-xs text-muted-foreground">
                              {item.rental_days} days
                            </div>
                          )}
                          {item.original_price && item.custom_price !== undefined && item.custom_price !== item.original_price && (
                            <div className="text-xs text-muted-foreground">
                              Original: {formatCurrency(item.original_price)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.sku_id!, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.sku_id!, item.quantity + 1)}
                            disabled={item.quantity >= item.available_quantity}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(calculateLineTotal(item))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFromCart(item.sku_id!)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}