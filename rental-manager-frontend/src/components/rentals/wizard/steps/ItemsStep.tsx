'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Package, Search, Edit2, Trash2, ShoppingCart, CalendarIcon, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { WizardData } from '../RentalCreationWizard';
import { rentableItemsApi } from '@/services/api/rentable-items';
import { itemsApi } from '@/services/api/items';
import { inventoryUnitsApi } from '@/services/api/inventory';
import { RentalRateEditor } from '@/components/rentals/RentalRateEditor';
import type { RentableItem, RentableInventoryUnit } from '@/types/rentable-items';

interface ItemsStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

// Extended item interface for the wizard
interface ItemForWizard {
  id: string; // This is the item_id from the API
  inventory_unit_id?: string; // The specific inventory unit ID
  name: string;
  sku: string;
  description?: string;
  category: string;
  daily_rate: number;
  min_rental_days: number;
  max_rental_days: number;
  standard_period_days: number;
  available_quantity: number;
  is_rentable: boolean;
  is_saleable: boolean;
  rental_rate_per_period: number;
  rental_period: string;
  security_deposit: number;
  serial_number_required?: boolean;
  location_availability: Array<{
    location_id: string;
    location_name: string;
    available_quantity: number;
  }>;
}

interface RentalItem {
  id: string;
  item_id: string;
  item?: ItemForWizard;
  quantity: number;
  rental_rate: number;
  rental_periods: number;
  period_type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  rental_start_date: Date;
  rental_end_date: Date;
  discount_value?: number;
  notes?: string;
  serial_numbers?: string[];
}

export function ItemsStep({ data, onUpdate, onNext, onBack }: ItemsStepProps) {
  const router = useRouter();
  const [items, setItems] = useState<RentalItem[]>(
    (data.items || []).map(item => ({
      ...item,
      rental_periods: (item as any).rental_periods || 1,
      period_type: (item as any).period_type || 'DAILY',
      rental_start_date: (item as any).rental_start_date || new Date(),
      rental_end_date: (item as any).rental_end_date || addDays(new Date(), 1)
    }))
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [availableItems, setAvailableItems] = useState<ItemForWizard[]>([]);
  const [filteredItems, setFilteredItems] = useState<ItemForWizard[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RentalItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform RentableItem from API to our wizard format
  const transformItemForWizard = (item: RentableItem): ItemForWizard => {
    return {
      id: item.id,
      name: item.item_name,
      sku: item.sku,
      description: item.description || `${item.brand?.name || ''} ${item.item_name}`.trim(),
      category: item.category?.name || 'Uncategorized',
      daily_rate: item.rental_rate_per_period || 0,
      min_rental_days: item.min_rental_days || 1,
      max_rental_days: item.max_rental_days || 365,
      standard_period_days: parseInt(item.rental_period || '1'),
      available_quantity: item.total_available_quantity || 0,
      is_rentable: item.is_rentable !== false, // All items from rentable API are rentable
      is_saleable: item.is_saleable || false,
      rental_rate_per_period: item.rental_rate_per_period || 0,
      rental_period: item.rental_period || '1',
      security_deposit: item.security_deposit || 0,
      serial_number_required: (item as any).serial_number_required || false,
      location_availability: item.location_availability || [],
    };
  };

  // Transform RentableInventoryUnit directly from the new API to wizard format
  const transformInventoryUnitForWizard = (unit: RentableInventoryUnit, index: number): ItemForWizard => {
    return {
      id: unit.item_id, // Use the actual item_id from the API response
      inventory_unit_id: unit.inventory_unit_id, // Store the specific inventory unit ID
      name: unit.item_name,
      sku: unit.serial_number || `${unit.item_name.replace(/\s+/g, '-').toLowerCase()}-${index}`,
      description: unit.description || '',
      category: 'Equipment', // Default category since not provided
      daily_rate: parseFloat(unit.rental_rate_per_period || '0'),
      min_rental_days: 1,
      max_rental_days: 365,
      standard_period_days: parseInt(unit.rental_period || '1'),
      available_quantity: parseFloat(unit.quantity_available || '0'),
      is_rentable: true,
      is_saleable: false,
      rental_rate_per_period: parseFloat(unit.rental_rate_per_period || '0'),
      rental_period: unit.rental_period || '1',
      security_deposit: parseFloat(unit.security_deposit || '0'),
      serial_number_required: (unit as any).serial_number_required || false,
      location_availability: [{
        location_id: unit.location_id,
        location_name: unit.location_name || 'Unknown',
        available_quantity: parseFloat(unit.quantity_available || '0')
      }],
    };
  };

  // Load available items from API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use the new rentable items endpoint with proper filters
        const response = await rentableItemsApi.getRentableItems({
          limit: 100,
          skip: 0,
          location_id: data.location_id || undefined,
          search_name: searchTerm || undefined, // Include search term in API call
        });
        console.log('API Response:', response);
        if (response && Array.isArray(response)) {
          const transformedItems = response.map(transformItemForWizard);
          setAvailableItems(transformedItems);
          setFilteredItems(transformedItems);
        } else {
          // Fallback: Use the old inventory unit endpoint if the new one fails
          console.warn('New rentable items API failed, falling back to inventory units');
          const rawUnits = await rentableItemsApi.getRentableInventoryUnits({
            limit: 100,
            skip: 0,
            location_id: data.location_id || undefined,
          });

          if (rawUnits && Array.isArray(rawUnits)) {
            const transformedItems = rawUnits.map((unit, index) => transformInventoryUnitForWizard(unit, index));
            // Apply search filter locally for fallback
            const searchFiltered = searchTerm
              ? (transformedItems || []).filter(item =>
                (item?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item?.category || '').toLowerCase().includes(searchTerm.toLowerCase())
              )
              : (transformedItems || []);

            setAvailableItems(transformedItems);
            setFilteredItems(searchFiltered);
          } else {
            throw new Error('Failed to load items from both APIs');
          }
        }
      } catch (err) {
        console.error('Error fetching rentable items:', err);
        setError(err instanceof Error ? err.message : 'Failed to load items');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce API calls when searching
    const timeoutId = setTimeout(fetchItems, searchTerm ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [data.location_id, searchTerm]); // Re-fetch when location or search term changes

  // Remove the local filtering effect since we're now doing server-side search
  // useEffect(() => {
  //   const filtered = availableItems.filter(item =>
  //     item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     item.category.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
  //   setFilteredItems(filtered);
  // }, [searchTerm, availableItems]);

  useEffect(() => {
    onUpdate({ items });
  }, [items, onUpdate]);

  const handleAddItem = (itemData: {
    item_id: string;
    quantity: number;
    rental_rate: number;
    rental_periods: number;
    period_type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    rental_start_date: Date;
    rental_end_date: Date;
    discount_value?: number;
    notes?: string;
    serial_numbers?: string[];
  }) => {
    const selectedItem = availableItems.find(item => item.id === itemData.item_id);
    if (!selectedItem) return;

    const newItem: RentalItem = {
      id: Date.now().toString(),
      item_id: itemData.item_id,
      item: selectedItem,
      quantity: itemData.quantity,
      rental_rate: itemData.rental_rate,
      rental_periods: itemData.rental_periods,
      period_type: itemData.period_type,
      rental_start_date: itemData.rental_start_date,
      rental_end_date: itemData.rental_end_date,
      discount_value: itemData.discount_value,
      notes: itemData.notes,
      serial_numbers: itemData.serial_numbers,
    };

    setItems(prev => [...prev, newItem]);
    setIsAddDialogOpen(false);
  };

  const handleUpdateItem = (updatedItem: RentalItem) => {
    setItems(prev => prev.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    ));
    setEditingItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => (prev || []).filter(item => item?.id !== itemId));
  };

  const getTotalAmount = () => {
    return items.reduce((total, item) => {
      const itemTotal = item.quantity * item.rental_rate * item.rental_periods;
      const discount = item.discount_value || 0;
      return total + itemTotal - discount;
    }, 0);
  };

  const handleItemClick = (itemSku: string) => {
    // Navigate to item details page using SKU in a new tab to not interrupt the rental wizard flow
    window.open(`/products/items/sku/${itemSku}`, '_blank');
  };

  const handleNext = () => {
    if (items.length > 0) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Item Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Rental Items</h3>
        <AddItemDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onAddItem={handleAddItem}
          availableItems={filteredItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>

      {/* Items List */}
      {items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Selected Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-center">Rental Dates</TableHead>
                  <TableHead className="text-center">Period</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <button
                            onClick={() => handleItemClick(item.item?.sku || '')}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
                            title="View item details"
                          >
                            {item.item?.name}
                          </button>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </div>
                        <div className="text-sm text-gray-500">{item.item?.category}</div>
                        {item.notes && (
                          <div className="text-xs text-gray-400 mt-1">{item.notes}</div>
                        )}
                        {item.serial_numbers && item.serial_numbers.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Serial Numbers: {item.serial_numbers.join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs">
                        <div>{format(item.rental_start_date, 'MMM dd')}</div>
                        <div className="text-gray-500">to</div>
                        <div>{format(item.rental_end_date, 'MMM dd')}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {item.rental_periods} {item.period_type.toLowerCase()}{item.rental_periods !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">₹{item.rental_rate}</TableCell>
                    <TableCell className="text-right">
                      {item.discount_value ? `₹${item.discount_value}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{(item.quantity * item.rental_rate * item.rental_periods - (item.discount_value || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <div className="text-lg font-semibold">
                  Total: ₹{getTotalAmount().toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  {items.length} item{items.length !== 1 ? 's' : ''} selected
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No items selected</h3>
            <p className="text-gray-600 mb-4">Add items to your rental to continue</p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add First Item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Item Dialog */}
      {editingItem && (
        <EditItemDialog
          item={editingItem}
          onSave={handleUpdateItem}
          onClose={() => setEditingItem(null)}
          locationId={data.location_id}
        />
      )}

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          Back to Rental Details
        </Button>
        <Button
          onClick={handleNext}
          disabled={items.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continue to Delivery
        </Button>
      </div>
    </div>
  );
}

// Add Item Dialog Component with Two-Screen Flow
function AddItemDialog({
  isOpen,
  onOpenChange,
  onAddItem,
  availableItems,
  searchTerm,
  onSearchChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: any) => void;
  availableItems: ItemForWizard[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  // Two-screen state management
  const [currentScreen, setCurrentScreen] = useState<'browse' | 'configure'>('browse');
  const [selectedItem, setSelectedItem] = useState<ItemForWizard | null>(null);

  // Configuration form state
  const [quantity, setQuantity] = useState(1);
  const [rentalRate, setRentalRate] = useState(0);
  const [rentalPeriods, setRentalPeriods] = useState<number | ''>(1);
  const [periodType, setPeriodType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [rentalDays, setRentalDays] = useState(1);
  const [rentalStartDate, setRentalStartDate] = useState<Date>(new Date());
  const [rentalEndDate, setRentalEndDate] = useState<Date>(addDays(new Date(), 1));
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Dynamic rental rate state
  const [customRentalRate, setCustomRentalRate] = useState<number | null>(null);
  const [saveRateToMaster, setSaveRateToMaster] = useState(true);
  const [isUpdatingItemMaster, setIsUpdatingItemMaster] = useState(false);
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  
  // Rate editor state
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateUpdateError, setRateUpdateError] = useState<string | null>(null);

  // Helper function to detect missing rental rates
  const hasValidRentalRate = (item: ItemForWizard): boolean => {
    return item.daily_rate > 0 && item.rental_rate_per_period > 0;
  };

  // Form validation logic
  const isFormValid = useMemo(() => {
    if (!selectedItem) return false;
    
    const hasValidRate = hasValidRentalRate(selectedItem) || (customRentalRate && customRentalRate > 0);
    const hasValidPeriods = typeof rentalPeriods === 'number' && rentalPeriods > 0;
    const hasValidSerialNumbers = !selectedItem?.serial_number_required || 
      (serialNumbers || []).filter(sn => sn?.trim() !== '').length === quantity;
    
    return hasValidRate && hasValidPeriods && hasValidSerialNumbers;
  }, [selectedItem, customRentalRate, rentalPeriods, serialNumbers, quantity, hasValidRentalRate]);

  // Filter state for Screen 1
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered and paginated items
  const filteredItems = (availableItems || []).filter(item => {
    const matchesSearch = (item?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item?.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item?.sku || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !categoryFilter || categoryFilter === "all" || (item?.category || 'Uncategorized') === categoryFilter;
    const matchesLocation = !locationFilter || locationFilter === "all" ||
      item?.location_availability?.some(loc => loc.location_id === locationFilter);
    const matchesAvailability = availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && item?.available_quantity > 0) ||
      (availabilityFilter === 'low' && item?.available_quantity > 0 && item?.available_quantity <= 5);

    return matchesSearch && matchesCategory && matchesLocation && matchesAvailability;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Get unique categories and locations for filters
  const categories = [...new Set(availableItems.map(item => item.category || 'Uncategorized'))];
  
  // Properly deduplicate locations by ID
  const locationMap = new Map();
  availableItems.forEach(item => {
    item.location_availability?.forEach(loc => {
      if (!locationMap.has(loc.location_id)) {
        locationMap.set(loc.location_id, { id: loc.location_id, name: loc.location_name });
      }
    });
  });
  const locations = Array.from(locationMap.values());

  // Calculate end date based on start date, periods, and rental days
  const calculateEndDate = (startDate: Date, periods: number, rentalDaysPerPeriod: number) => {
    const totalDays = periods * rentalDaysPerPeriod;
    return addDays(startDate, totalDays);
  };

  // Auto-calculate end date when dependencies change
  useEffect(() => {
    if (typeof rentalPeriods === 'number' && rentalPeriods > 0 && rentalDays > 0) {
      const newEndDate = calculateEndDate(rentalStartDate, rentalPeriods, rentalDays);
      setRentalEndDate(newEndDate);
    }
  }, [rentalStartDate, rentalPeriods, rentalDays]);

  const handleItemSelect = (item: ItemForWizard) => {
    setSelectedItem(item);
    setRentalRate(item.daily_rate);
    setRentalDays(item.standard_period_days);
    setRentalEndDate(addDays(rentalStartDate, item.standard_period_days));
    // Reset serial numbers for new item
    if (item.serial_number_required) {
      setSerialNumbers(Array(quantity).fill(''));
    } else {
      setSerialNumbers([]);
    }
    setCurrentScreen('configure');
  };

  const handleBackToBrowse = () => {
    setCurrentScreen('browse');
    // Reset form when going back
    setSelectedItem(null);
    setQuantity(1);
    setRentalRate(0);
    setRentalPeriods(1);
    setDiscountValue(0);
    setNotes('');
    setSerialNumbers([]);
    // Reset dynamic rental rate state
    setCustomRentalRate(null);
    setSaveRateToMaster(true);
    setIsUpdatingItemMaster(false);
    // Reset rate editor state
    setIsEditingRate(false);
    setRateUpdateError(null);
  };

  // Handle rental rate changes from RentalRateEditor
  const handleRateChange = useCallback((newRate: number) => {
    setRentalRate(newRate);
    setCustomRentalRate(newRate);
    setRateUpdateError(null);
  }, []);

  // Handle master data rate update
  const handleMasterDataRateUpdate = useCallback(async (itemId: string, newRate: number) => {
    if (!selectedItem) return;
    
    setIsUpdatingItemMaster(true);
    setRateUpdateError(null);
    
    try {
      await itemsApi.updateRentalRate(itemId, newRate);
      
      // Update the selected item's rate data
      selectedItem.daily_rate = newRate;
      selectedItem.rental_rate_per_period = newRate;
      
      console.log(`✅ Updated rental rate for item ${itemId} to ₹${newRate}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update master data';
      setRateUpdateError(errorMessage);
      console.error('Failed to update rental rate in master data:', error);
      throw error; // Re-throw to let RentalRateEditor handle it
    } finally {
      setIsUpdatingItemMaster(false);
    }
  }, [selectedItem]);

  const handleSubmit = async () => {
    if (!selectedItem || !isFormValid) return;

    try {
      // Update item master if needed
      if (!hasValidRentalRate(selectedItem) && customRentalRate && saveRateToMaster) {
        setIsUpdatingItemMaster(true);
        try {
          await itemsApi.updateRentalRate(selectedItem.id, customRentalRate);
          console.log(`✅ Updated rental rate for item ${selectedItem.id} to ₹${customRentalRate}`);
          
          // Also update inventory units if location is available
          if (data.location_id) {
            try {
              const batchResult = await inventoryUnitsApi.batchUpdateRentalRate(
                selectedItem.id, 
                data.location_id, 
                customRentalRate
              );
              console.log(`✅ Updated rental rate for ${batchResult.updated_count || 0} inventory units`);
            } catch (inventoryError) {
              console.warn('⚠️ Failed to update inventory unit rates:', inventoryError);
              // Continue with rental creation even if inventory update fails
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to update item master:', error);
          // Continue with rental creation even if master update fails
        } finally {
          setIsUpdatingItemMaster(false);
        }
      }

      // Create rental item with effective rate
      const effectiveRate = hasValidRentalRate(selectedItem) ? selectedItem.daily_rate : customRentalRate!;
      
      // Validate serial numbers if required
      if (selectedItem.serial_number_required) {
        const validSerialNumbers = (serialNumbers || []).filter(sn => sn?.trim() !== '');
        if (validSerialNumbers.length !== quantity) {
          alert(`Please enter ${quantity} serial number${quantity !== 1 ? 's' : ''} for this item.`);
          return;
        }
        // Check for duplicates
        const uniqueSerialNumbers = new Set(validSerialNumbers);
        if (uniqueSerialNumbers.size !== validSerialNumbers.length) {
          alert('Serial numbers must be unique.');
          return;
        }
      }

      onAddItem({
        item_id: selectedItem.id,
        quantity,
        rental_rate: effectiveRate,
        rental_periods: rentalPeriods,
        period_type: periodType,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate,
        discount_value: discountValue || undefined,
        notes: notes || undefined,
        serial_numbers: selectedItem?.serial_number_required ? (serialNumbers || []).filter(sn => sn?.trim() !== '') : undefined,
      });

      // Reset everything
      handleBackToBrowse();
      setCurrentScreen('browse');
    } catch (error) {
      console.error('Failed to add rental item:', error);
      // Show error message to user
    }
  };

  const resetFilters = () => {
    setCategoryFilter('');
    setLocationFilter('');
    setAvailabilityFilter('all');
    onSearchChange('');
    setCurrentPage(1);
  };

  const handleItemDetailClick = (itemSku: string) => {
    // Navigate to item details page using SKU in a new tab to not interrupt the rental wizard flow
    window.open(`/products/items/sku/${itemSku}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {currentScreen === 'configure' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToBrowse}
                className="mr-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            {currentScreen === 'browse' ? 'Select Rental Item' : `Configure: ${selectedItem?.name}`}
          </DialogTitle>
        </DialogHeader>

        {/* Screen 1: Browse & Select Items */}
        {currentScreen === 'browse' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search and Filters - Fixed at top */}
            <div className="flex-shrink-0 mb-4">
              <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="search">Search Items</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="search"
                      placeholder="Search by name, SKU, or category..."
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select value={locationFilter || "all"} onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locations.map(location => (
                          <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        <SelectItem value="available">Available Only</SelectItem>
                        <SelectItem value="low">Low Stock (≤5)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button variant="outline" onClick={resetFilters}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Summary - Fixed */}
            <div className="flex-shrink-0 flex justify-between items-center px-2 mb-3">
              <p className="text-sm text-gray-600">
                Showing {paginatedItems.length} of {filteredItems.length} items
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Items Table - Takes all remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg">
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>Item Details</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Rate/Period</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="text-center">Locations</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <button
                                onClick={() => handleItemDetailClick(item.sku || '')}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
                                title="View item details"
                              >
                                {item.name || 'Unnamed Item'}
                              </button>
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </div>
                            <div className="text-sm text-gray-500">{item.description}</div>
                            {item.security_deposit > 0 && (
                              <div className="text-xs text-orange-600 mt-1">
                                Security Deposit: ₹{item.security_deposit}
                              </div>
                            )}
                            {item.serial_number_required && (
                              <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                                Serial numbers required
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category || 'Uncategorized'}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sku || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold">₹{item.daily_rate}</div>
                          <div className="text-xs text-gray-500">
                            per {item.standard_period_days} day{item.standard_period_days !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={item.available_quantity > 5 ? "default" : item.available_quantity > 0 ? "secondary" : "destructive"}
                          >
                            {item.available_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            {item.location_availability.map((location) => (
                              <div key={location.location_id} className="text-xs">
                                <Badge variant="outline" className="text-xs">
                                  {location.location_name}: {location.available_quantity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleItemSelect(item)}
                            disabled={item.available_quantity === 0}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Fill remaining space if not enough items */}
                    {paginatedItems.length < itemsPerPage && (
                      Array.from({ length: itemsPerPage - paginatedItems.length }, (_, index) => (
                        <TableRow key={`empty-${index}`} className="pointer-events-none">
                          <TableCell colSpan={7} className="h-16 text-center text-gray-400">
                            {index === 0 && paginatedItems.length === 0 ? 'No items found' : ''}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Screen 2: Configure Selected Item */}
        {currentScreen === 'configure' && selectedItem && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column - Configuration Form */}
            <div className="space-y-4 overflow-y-auto max-h-[85vh] pr-2">
              <div className="space-y-4">
                {/* Selected Item Display */}
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-3">
                    <h4 className="font-medium text-green-900 mb-2">Selected Item</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Name:</span>
                        <span className="font-semibold text-green-900">{selectedItem.name || 'Unnamed Item'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">SKU:</span>
                        <span className="font-semibold text-green-900">{selectedItem.sku || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700">Category:</span>
                        <span className="font-semibold text-green-900">{selectedItem.category || 'Uncategorized'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Configuration Form */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max={selectedItem.available_quantity}
                        value={quantity}
                        onChange={(e) => {
                          const newQuantity = parseInt(e.target.value) || 1;
                          setQuantity(newQuantity);
                          // Adjust serial numbers array if item requires serial numbers
                          if (selectedItem.serial_number_required) {
                            const newSerialNumbers = [...serialNumbers];
                            if (newQuantity > serialNumbers.length) {
                              // Add empty strings for new items
                              for (let i = serialNumbers.length; i < newQuantity; i++) {
                                newSerialNumbers.push('');
                              }
                            } else if (newQuantity < serialNumbers.length) {
                              // Remove excess serial numbers
                              newSerialNumbers.splice(newQuantity);
                            }
                            setSerialNumbers(newSerialNumbers);
                          }
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rental_periods">Number of Periods</Label>
                      <Input
                        id="rental_periods"
                        type="number"
                        min="1"
                        value={rentalPeriods}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setRentalPeriods('');
                          } else {
                            const numValue = parseInt(value);
                            setRentalPeriods(isNaN(numValue) ? '' : numValue);
                          }
                        }}
                        placeholder="Enter periods"
                        className={`mt-1 ${typeof rentalPeriods !== 'number' || rentalPeriods <= 0 ? 'border-red-500' : ''}`}
                      />
                      {(typeof rentalPeriods !== 'number' || rentalPeriods <= 0) && (
                        <p className="text-red-500 text-xs mt-1">Required</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="rental_start_date">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal mt-1',
                            !rentalStartDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {rentalStartDate ? format(rentalStartDate, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <PastelCalendar
                          value={rentalStartDate}
                          onChange={(date) => date && setRentalStartDate(date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="discount">Discount (Optional)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes for this item"
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {/* Rental Rate Configuration - NEW SECTION */}
                  <div className="space-y-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <Label className="text-sm font-medium text-amber-900">
                        {hasValidRentalRate(selectedItem) ? 'Rental Rate (Configured)' : 'Rental Rate (Not Configured)'}
                      </Label>
                    </div>
                    
                    {!hasValidRentalRate(selectedItem) ? (
                      // Rate Input for Unconfigured Items
                      <div className="space-y-2">
                        <div className="text-xs text-amber-700 mb-2">
                          This item doesn't have a rental rate configured. Please enter the rate:
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={customRentalRate || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setCustomRentalRate(value);
                                setRentalRate(value); // Update display rate
                              }}
                              placeholder="Enter rate per period"
                              className="text-lg font-semibold"
                              required
                            />
                          </div>
                          <div className="text-sm text-amber-700">
                            ₹ per {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="save-to-master"
                            checked={saveRateToMaster}
                            onCheckedChange={(checked) => setSaveRateToMaster(checked === true)}
                          />
                          <Label htmlFor="save-to-master" className="text-xs text-amber-700">
                            Save this rate to the item master data for future use
                          </Label>
                        </div>
                      </div>
                    ) : (
                      // Display for Items with Configured Rates
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-700">Current Rate:</span>
                        <span className="font-semibold text-amber-900">
                          ₹{rentalRate} per {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Serial Numbers Section */}
                  {selectedItem.serial_number_required && (
                    <div>
                      <Label htmlFor="serial_numbers">Serial Numbers (Required)</Label>
                      <div className="mt-1 space-y-2">
                        {Array.from({ length: quantity }, (_, index) => (
                          <Input
                            key={index}
                            type="text"
                            placeholder={`Serial number ${index + 1}`}
                            value={serialNumbers[index] || ''}
                            onChange={(e) => {
                              const newSerialNumbers = [...serialNumbers];
                              newSerialNumbers[index] = e.target.value;
                              setSerialNumbers(newSerialNumbers);
                            }}
                            className="w-full"
                            required
                          />
                        ))}
                        <p className="text-xs text-gray-600">
                          This item requires serial numbers. Please enter {quantity} unique serial number{quantity !== 1 ? 's' : ''}.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Middle Column - Item Information & Rental Period */}
            <div className="space-y-4 overflow-y-auto max-h-[85vh] px-2 border-x border-gray-200">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Item Details</h3>

                {/* Item Information Card */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-3">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Item Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-700">Base Rate:</span>
                        <div className="flex-1 ml-4">
                          <RentalRateEditor
                            currentRate={rentalRate}
                            itemId={selectedItem.id}
                            periodText="period"
                            currency="₹"
                            editable={true}
                            showChangeButton={true}
                            saveToMaster={true}
                            onRateChange={handleRateChange}
                            onMasterDataUpdate={handleMasterDataRateUpdate}
                            loading={isUpdatingItemMaster}
                            minRate={0.01}
                            maxRate={99999}
                            showErrors={true}
                            className="text-right"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Period Duration:</span>
                        <span className="font-semibold text-blue-900">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Available Stock:</span>
                        <span className="font-semibold text-blue-900">{selectedItem.available_quantity} units</span>
                      </div>
                      {selectedItem.security_deposit > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">Security Deposit:</span>
                          <span className="font-semibold text-orange-600">₹{selectedItem.security_deposit}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Rental Period Card */}
                <Card className="border-gray-200 bg-gray-50">
                  <CardContent className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Rental Period</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">Start Date:</span>
                        <span className="font-semibold text-gray-900">{format(rentalStartDate, 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">End Date:</span>
                        <span className="font-semibold text-gray-900">{format(rentalEndDate, 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">Total Duration:</span>
                        <span className="font-semibold text-gray-900">
                          {typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays} {((typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays) === 1) ? 'day' : 'days'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Location Availability Card */}
                {selectedItem.location_availability && selectedItem.location_availability.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-3">
                      <h4 className="text-sm font-medium text-amber-900 mb-2">Location Availability</h4>
                      <div className="space-y-2">
                        {selectedItem.location_availability.map((location) => (
                          <div key={location.location_id} className="flex justify-between">
                            <span className="text-sm text-amber-700">{location.location_name}:</span>
                            <span className="font-semibold text-amber-900">{location.available_quantity} units</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Column - Cost Breakdown */}
            <div className="space-y-4 overflow-y-auto max-h-[85vh] pl-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Cost Analysis</h3>

                {/* Cost Breakdown Card */}
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-3">
                    <h4 className="text-sm font-medium text-green-900 mb-2">Cost Breakdown</h4>
                    <div className="space-y-3">
                      {/* Base Rate Details */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-700">
                            Base Rate per Period:
                            {!hasValidRentalRate(selectedItem) && customRentalRate && (
                              <span className="ml-1 text-xs text-amber-600">(Custom)</span>
                            )}
                          </span>
                          <span className="font-semibold text-green-900">₹{rentalRate}</span>
                        </div>
                        <div className="text-xs text-green-600 pl-1">
                          (₹{rentalRate} per {rentalDays} {rentalDays === 1 ? 'day' : 'days'})
                        </div>
                      </div>

                      {/* Quantity Details */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-700">Quantity:</span>
                        <span className="font-semibold text-green-900">{quantity} {quantity === 1 ? 'unit' : 'units'}</span>
                      </div>

                      {/* Rental Periods Details */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-700">Rental Periods:</span>
                          <span className="font-semibold text-green-900">
                            {typeof rentalPeriods === 'number' ? rentalPeriods : 1} {typeof rentalPeriods === 'number' && rentalPeriods === 1 ? 'period' : 'periods'}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 pl-1">
                          (Total: {typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays} {((typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays) === 1) ? 'day' : 'days'})
                        </div>
                      </div>

                      <Separator className="my-2" />

                      {/* Subtotal Calculation */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-700">Subtotal Calculation:</span>
                          <span className="font-semibold text-green-900">
                            ₹{typeof rentalPeriods === 'number' ? (rentalRate * rentalPeriods * quantity).toFixed(2) : (rentalRate * quantity).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 pl-1">
                          (₹{rentalRate} × {typeof rentalPeriods === 'number' ? rentalPeriods : 1} × {quantity})
                        </div>
                      </div>

                      {/* Security Deposit */}
                      {selectedItem.security_deposit > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-700">Security Deposit:</span>
                            <span className="font-semibold text-orange-900">₹{(selectedItem.security_deposit * quantity).toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-orange-600 pl-1">
                            (₹{selectedItem.security_deposit} per unit × {quantity} {quantity === 1 ? 'unit' : 'units'})
                          </div>
                        </div>
                      )}

                      {/* Discount Details */}
                      {discountValue > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-red-700">Discount Applied:</span>
                            <span className="font-semibold text-red-600">-₹{discountValue.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-red-600 pl-1">
                            (Manual discount adjustment)
                          </div>
                        </div>
                      )}

                      <Separator className="my-2" />

                      {/* Rental Total */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-medium text-green-900">Rental Total:</span>
                          <span className="text-lg font-bold text-green-900">
                            ₹{typeof rentalPeriods === 'number' ?
                              (rentalRate * rentalPeriods * quantity - discountValue).toFixed(2) :
                              (rentalRate * quantity - discountValue).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 pl-1">
                          (Amount to be charged for rental period)
                        </div>
                      </div>

                      {/* Grand Total including security deposit */}
                      {selectedItem.security_deposit > 0 && (
                        <div className="bg-green-100 p-2 rounded border border-green-300">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-green-900">Total Amount Due:</span>
                            <span className="text-lg font-bold text-green-900">
                              ₹{typeof rentalPeriods === 'number' ?
                                (rentalRate * rentalPeriods * quantity - discountValue + (selectedItem.security_deposit * quantity)).toFixed(2) :
                                (rentalRate * quantity - discountValue + (selectedItem.security_deposit * quantity)).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            (Rental + Security Deposit)
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={handleBackToBrowse} className="flex-1">
                    Back to Items
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!isFormValid || isUpdatingItemMaster}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex-1"
                  >
                    {isUpdatingItemMaster ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Rate...
                      </>
                    ) : (
                      'Add Item'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Edit Item Dialog Component
function EditItemDialog({
  item,
  onSave,
  onClose,
  locationId,
}: {
  item: RentalItem;
  onSave: (item: RentalItem) => void;
  onClose: () => void;
  locationId?: string;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [rentalRate, setRentalRate] = useState(item.rental_rate);
  const [rentalPeriods, setRentalPeriods] = useState<number | ''>(item.rental_periods);
  const [periodType, setPeriodType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>(item.period_type);
  const [rentalDays, setRentalDays] = useState(
    Math.ceil((item.rental_end_date.getTime() - item.rental_start_date.getTime()) / (1000 * 60 * 60 * 24))
  );
  const [rentalStartDate, setRentalStartDate] = useState<Date>(item.rental_start_date);
  const [rentalEndDate, setRentalEndDate] = useState<Date>(item.rental_end_date);
  const [discountValue, setDiscountValue] = useState(item.discount_value || 0);
  const [notes, setNotes] = useState(item.notes || '');

  // Calculate end date based on start date, periods, and rental days from item master
  const calculateEndDate = (startDate: Date, periods: number, rentalDaysPerPeriod: number) => {
    const totalDays = periods * rentalDaysPerPeriod;
    return addDays(startDate, totalDays);
  };

  // Auto-calculate end date when start date, periods, or rental days change
  useEffect(() => {
    if (typeof rentalPeriods === 'number' && rentalPeriods > 0 && rentalDays > 0) {
      const newEndDate = calculateEndDate(rentalStartDate, rentalPeriods, rentalDays);
      setRentalEndDate(newEndDate);
    }
  }, [rentalStartDate, rentalPeriods, rentalDays]);

  // Auto-calculate end date when start date or rental days change
  useEffect(() => {
    if (rentalStartDate && rentalDays > 0) {
      const newEndDate = addDays(rentalStartDate, rentalDays);
      setRentalEndDate(newEndDate);
    }
  }, [rentalStartDate, rentalDays]);

  const handleSave = () => {
    if (typeof rentalPeriods === 'number' && rentalPeriods > 0) {
      onSave({
        ...item,
        quantity,
        rental_rate: rentalRate,
        rental_periods: rentalPeriods,
        period_type: periodType,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate,
        discount_value: discountValue || undefined,
        notes: notes || undefined,
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item: {item.item?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">Daily Rental Rate:</span>
                  <div className="flex-1 ml-4">
                    <RentalRateEditor
                      currentRate={rentalRate}
                      itemId={item.item?.id}
                      periodText={`${rentalDays} ${rentalDays === 1 ? 'day' : 'days'}`}
                      currency="₹"
                      editable={true}
                      showChangeButton={true}
                      saveToMaster={true}
                      onRateChange={(newRate) => setRentalRate(newRate)}
                      onMasterDataUpdate={async (itemId: string, newRate: number) => {
                        if (item.item) {
                          try {
                            await itemsApi.updateRentalRate(itemId, newRate);
                            item.item.daily_rate = newRate;
                            item.item.rental_rate_per_period = newRate;
                            
                            // Also update inventory units if location is available
                            if (locationId) {
                              try {
                                const batchResult = await inventoryUnitsApi.batchUpdateRentalRate(
                                  itemId, 
                                  locationId, 
                                  newRate
                                );
                                console.log(`✅ Updated rental rate for ${batchResult.updated_count || 0} inventory units in edit dialog`);
                              } catch (inventoryError) {
                                console.warn('⚠️ Failed to update inventory unit rates in edit dialog:', inventoryError);
                                // Continue even if inventory update fails
                              }
                            }
                          } catch (error) {
                            console.error('Failed to update rate in edit dialog:', error);
                            throw error;
                          }
                        }
                      }}
                      loading={false}
                      minRate={0.01}
                      maxRate={99999}
                      showErrors={true}
                      className="text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="rental_periods">Number of Periods</Label>
              <Input
                id="rental_periods"
                type="number"
                min="1"
                value={rentalPeriods}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setRentalPeriods('');
                  } else {
                    const numValue = parseInt(value);
                    setRentalPeriods(isNaN(numValue) ? '' : numValue);
                  }
                }}
                placeholder="Enter number of periods"
                className={`${typeof rentalPeriods !== 'number' || rentalPeriods <= 0 ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              {(typeof rentalPeriods !== 'number' || rentalPeriods <= 0) && (
                <p className="text-red-500 text-sm mt-1">Please enter a valid number of periods (greater than 0)</p>
              )}
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="text-slate-700 border-slate-300">
                    One Rental Period is {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Rental Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rental_start_date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal mt-2',
                      !rentalStartDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rentalStartDate ? (
                      format(rentalStartDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <PastelCalendar
                    value={rentalStartDate}
                    onChange={(date) => date && setRentalStartDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="rental_end_date">End Date (Computed)</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {format(rentalEndDate, 'PPP')}
                  </span>
                  <Badge variant="outline" className="text-gray-600 border-gray-300">
                    Auto-calculated
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Duration Display */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">Rental Duration:</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-slate-700 border-slate-300">
                  {typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays} {((typeof rentalPeriods === 'number' ? rentalPeriods * rentalDays : rentalDays) === 1) ? 'day' : 'days'}
                </Badge>
                <span className="text-sm text-slate-600">
                  (Total: ₹{typeof rentalPeriods === 'number' ? (rentalRate * rentalPeriods * rentalDays * quantity).toFixed(2) : (rentalRate * rentalDays * quantity).toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="discount">Discount</Label>
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this item"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={typeof rentalPeriods !== 'number' || rentalPeriods <= 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
