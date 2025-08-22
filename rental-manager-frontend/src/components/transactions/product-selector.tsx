'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, 
  Plus, 
  Minus, 
  Package, 
  CheckCircle, 
  AlertTriangle,
  Calendar as CalendarIcon,
  ShoppingCart,
  Eye,
  X
} from 'lucide-react';
import { SKU, ItemMaster, Brand, Category } from '@/types/api';
import { CartItem, AvailabilityCheck, TransactionType } from '@/types/transactions';
import { StockLevel } from '@/types/inventory';

interface ProductSelectorProps {
  skus: SKU[];
  itemMasters: ItemMaster[];
  brands: Brand[];
  categories: Category[];
  stockLevels: StockLevel[];
  cartItems: CartItem[];
  transactionType: TransactionType;
  locationId: string;
  onCartUpdate: (cartItems: CartItem[]) => void;
  onAvailabilityCheck: (check: AvailabilityCheck) => Promise<AvailabilityCheck>;
  isLoading?: boolean;
}

export function ProductSelector({
  skus,
  itemMasters,
  brands,
  categories,
  stockLevels,
  cartItems,
  transactionType,
  locationId,
  onCartUpdate,
  onAvailabilityCheck,
  isLoading,
}: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [rentalDays, setRentalDays] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [addProductDialog, setAddProductDialog] = useState(false);
  const [availabilityChecks, setAvailabilityChecks] = useState<Record<string, AvailabilityCheck>>({});

  const isRental = transactionType === 'RENTAL';

  // Auto-calculate end date when start date or rental days change
  useEffect(() => {
    if (startDate && rentalDays > 0) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + rentalDays - 1);
      setEndDate(end);
    }
  }, [startDate, rentalDays]);

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

  const getSKUDetails = (skuId: string) => {
    const sku = skus.find(s => s.id === skuId);
    if (!sku) return null;

    const itemMaster = itemMasters.find(i => i.id === sku.item_master_id);
    const brand = itemMaster ? brands.find(b => b.id === itemMaster.brand_id) : null;
    const category = itemMaster ? categories.find(c => c.id === itemMaster.category_id) : null;

    return {
      sku,
      itemMaster,
      brand,
      category,
    };
  };

  const getStockLevel = (skuId: string) => {
    return stockLevels.find(sl => sl.sku_id === skuId && sl.location_id === locationId);
  };

  const isInCart = (skuId: string) => {
    return cartItems.some(item => item.sku_id === skuId);
  };

  const getCartQuantity = (skuId: string) => {
    const cartItem = cartItems.find(item => item.sku_id === skuId);
    return cartItem?.quantity || 0;
  };

  const filteredSKUs = skus.filter(sku => {
    if (!searchTerm) return true;
    
    const details = getSKUDetails(sku.id);
    if (!details) return false;

    const searchLower = searchTerm.toLowerCase();
    return (
      sku.sku_code.toLowerCase().includes(searchLower) ||
      details.itemMaster?.name.toLowerCase().includes(searchLower) ||
      details.brand?.name.toLowerCase().includes(searchLower) ||
      details.category?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleAddToCart = async () => {
    if (!selectedSKU) return;

    // Perform availability check for rentals
    if (isRental && startDate && endDate) {
      const availabilityCheck: AvailabilityCheck = {
        sku_id: selectedSKU.id,
        location_id: locationId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        quantity_requested: quantity,
        quantity_available: 0,
        is_available: false,
      };

      const result = await onAvailabilityCheck(availabilityCheck);
      setAvailabilityChecks(prev => ({ ...prev, [selectedSKU.id]: result }));

      if (!result.is_available) {
        alert(`Insufficient availability. Only ${result.quantity_available} units available for the selected dates.`);
        return;
      }
    }

    const cartItem: CartItem = {
      sku_id: selectedSKU.id,
      quantity,
      unit_price: isRental ? selectedSKU.rental_price : selectedSKU.sale_price,
      rental_days: isRental ? rentalDays : undefined,
      rental_start_date: isRental && startDate ? startDate.toISOString() : undefined,
      rental_end_date: isRental && endDate ? endDate.toISOString() : undefined,
      deposit_per_unit: selectedSKU.deposit_amount,
      discount_percentage: 0,
    };

    const existingIndex = cartItems.findIndex(item => item.sku_id === selectedSKU.id);
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
    setAddProductDialog(false);
    resetForm();
  };

  const handleRemoveFromCart = (skuId: string) => {
    const updatedCart = cartItems.filter(item => item.sku_id !== skuId);
    onCartUpdate(updatedCart);
  };

  const handleUpdateQuantity = (skuId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(skuId);
      return;
    }

    const updatedCart = cartItems.map(item =>
      item.sku_id === skuId ? { ...item, quantity: newQuantity } : item
    );
    onCartUpdate(updatedCart);
  };

  const resetForm = () => {
    setSelectedSKU(null);
    setQuantity(1);
    setRentalDays(1);
    setStartDate(new Date());
    setEndDate(undefined);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Product Selection</h2>
          <p className="text-muted-foreground">
            Add products to your {transactionType.toLowerCase()}
          </p>
        </div>
        <Dialog open={addProductDialog} onOpenChange={setAddProductDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by SKU, name, brand, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Product List */}
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSKUs.map((sku) => {
                      const details = getSKUDetails(sku.id);
                      const stockLevel = getStockLevel(sku.id);
                      const inCart = isInCart(sku.id);
                      const cartQty = getCartQuantity(sku.id);

                      if (!details) return null;

                      return (
                        <TableRow 
                          key={sku.id}
                          className={selectedSKU?.id === sku.id ? 'bg-slate-50' : ''}
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{sku.sku_code}</div>
                              <div className="text-sm text-muted-foreground">
                                {details.itemMaster?.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {details.brand?.name} • {details.category?.name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {isRental ? (
                                <div className="font-medium">
                                  {formatCurrency(sku.rental_price)}/day
                                </div>
                              ) : (
                                <div className="font-medium">
                                  {formatCurrency(sku.sale_price)}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Deposit: {formatCurrency(sku.deposit_amount)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                {stockLevel ? (
                                  <>
                                    <span className="font-medium">
                                      {stockLevel.available_units}
                                    </span>
                                    <span className="text-muted-foreground">available</span>
                                    {stockLevel.available_units > 0 ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-red-500" />
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">No stock data</span>
                                )}
                              </div>
                              {inCart && (
                                <Badge variant="secondary" className="text-xs">
                                  {cartQty} in cart
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSKU(sku)}
                              disabled={!stockLevel || stockLevel.available_units === 0}
                            >
                              {selectedSKU?.id === sku.id ? 'Selected' : 'Select'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Product Configuration */}
              {selectedSKU && (
                <Card>
                  <CardHeader>
                    <CardTitle>Configure Product</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 text-center"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuantity(quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isRental && (
                        <div className="space-y-2">
                          <Label htmlFor="rental_days">Rental Days</Label>
                          <Input
                            id="rental_days"
                            type="number"
                            min="1"
                            value={rentalDays}
                            onChange={(e) => setRentalDays(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        </div>
                      )}
                    </div>

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
                          <div className="p-2 bg-gray-50 rounded border">
                            {endDate ? formatDate(endDate) : 'Auto-calculated'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pricing Summary */}
                    <Card className="bg-gray-50">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">Pricing Summary</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Unit Price:</span>
                            <span>
                              {formatCurrency(isRental ? selectedSKU.rental_price : selectedSKU.sale_price)}
                              {isRental && '/day'}
                            </span>
                          </div>
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
                          <div className="flex justify-between">
                            <span>Deposit (per unit):</span>
                            <span>{formatCurrency(selectedSKU.deposit_amount)}</span>
                          </div>
                          <div className="border-t pt-1 flex justify-between font-medium">
                            <span>Line Total:</span>
                            <span>
                              {formatCurrency(quantity * (isRental ? selectedSKU.rental_price : selectedSKU.sale_price) * (isRental ? rentalDays : 1))}
                            </span>
                          </div>
                          <div className="flex justify-between text-orange-600">
                            <span>Total Deposit:</span>
                            <span>{formatCurrency(quantity * selectedSKU.deposit_amount)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setAddProductDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddToCart} disabled={isLoading}>
                        {isLoading ? 'Adding...' : 'Add to Cart'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              <p className="text-sm">Add products to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => {
                const details = getSKUDetails(item.sku_id);
                if (!details) return null;

                return (
                  <Card key={item.sku_id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{details.sku.sku_code}</div>
                        <div className="text-sm text-muted-foreground">
                          {details.itemMaster?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {details.brand?.name}
                        </div>
                        
                        <div className="mt-2 text-sm">
                          <div className="flex items-center space-x-4">
                            <span>
                              {formatCurrency(item.unit_price)}
                              {isRental && '/day'}
                            </span>
                            <span>Qty: {item.quantity}</span>
                            {item.rental_days && (
                              <span>Days: {item.rental_days}</span>
                            )}
                          </div>
                          
                          {item.rental_start_date && item.rental_end_date && (
                            <div className="text-muted-foreground mt-1">
                              {formatDate(new Date(item.rental_start_date))} - {formatDate(new Date(item.rental_end_date))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(calculateLineTotal(item))}
                          </div>
                          <div className="text-sm text-orange-600">
                            +{formatCurrency(item.deposit_per_unit * item.quantity)} deposit
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.sku_id, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.sku_id, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFromCart(item.sku_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}