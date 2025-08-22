'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Search, 
  Eye, 
  Calculator, 
  FileText, 
  CheckCircle,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Hash,
  Clock,
  IndianRupee,
  Minus,
  Plus
} from 'lucide-react';
import { ReturnWizardData, ReturnType, OutstandingRental, ReturnSummary } from '@/types/returns';
import { rentalsApi } from '@/services/api/rentals';

interface ReturnWizardProps {
  onComplete: (data: ReturnWizardData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  rentalId?: string; // Optional rental ID to skip search step
}

type WizardStep = 'search' | 'selection' | 'inspection' | 'calculation' | 'review' | 'complete';

const steps: Array<{ id: WizardStep; title: string; icon: any; description: string }> = [
  { 
    id: 'search', 
    title: 'Find Rental', 
    icon: Search, 
    description: 'Locate the rental transaction' 
  },
  { 
    id: 'selection', 
    title: 'Select Items', 
    icon: Package, 
    description: 'Choose items to return' 
  },
  { 
    id: 'inspection', 
    title: 'Inspection', 
    icon: Eye, 
    description: 'Assess item condition' 
  },
  { 
    id: 'calculation', 
    title: 'Calculate Fees', 
    icon: Calculator, 
    description: 'Compute charges and refunds' 
  },
  { 
    id: 'review', 
    title: 'Review', 
    icon: FileText, 
    description: 'Confirm return details' 
  },
  { 
    id: 'complete', 
    title: 'Complete', 
    icon: CheckCircle, 
    description: 'Process return' 
  },
];

export function ReturnWizard({
  onComplete,
  onCancel,
  isLoading,
  rentalId,
}: ReturnWizardProps) {
  // Skip search step if rental ID is provided
  const [currentStep, setCurrentStep] = useState<WizardStep>(rentalId ? 'selection' : 'search');
  const [wizardData, setWizardData] = useState<ReturnWizardData>({
    rental_transaction_id: rentalId || '',
    return_type: 'PARTIAL',
    selected_items: [],
    inspection_data: {},
    fee_calculations: [],
    customer_acknowledgment: false,
  });

  const [selectedRental, setSelectedRental] = useState<any>(null);
  const [outstandingItems, setOutstandingItems] = useState<OutstandingRental[]>([]);
  const [loadingRental, setLoadingRental] = useState(!!rentalId);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Fetch rental data if rental ID is provided
  useEffect(() => {
    if (rentalId) {
      fetchRentalData(rentalId);
    }
  }, [rentalId]);

  const fetchRentalData = async (id: string) => {
    try {
      setLoadingRental(true);
      console.log('Fetching rental data for ID:', id);
      
      // Fetch complete rental details with items
      const rental = await rentalsApi.getRentalById(id);
      console.log('Fetched rental data:', rental);
      
      setSelectedRental(rental);
      
      // Transform rental items to outstanding items format
      const outstandingItems: OutstandingRental[] = rental.items?.map((item: any, index: number) => {
        const daysOverdue = rental.days_overdue || 0;
        const dailyRate = item.unit_price || item.line_total / (item.quantity || 1) || 0;
        
        return {
          transaction_id: rental.id,
          transaction_line_id: item.id || `line_${index}`,
          sku_id: item.item_id || item.sku_id || `sku_${index}`,
          sku_code: item.sku || item.sku_code || `SKU-${String(index + 1).padStart(3, '0')}`,
          item_name: item.item_name || item.name || item.description || `Item ${index + 1}`,
          quantity_rented: item.quantity || 1,
          quantity_returned: item.quantity_returned || 0,
          quantity_outstanding: (item.quantity || 1) - (item.quantity_returned || 0),
          rental_start_date: rental.rental_start_date || rental.rental_period?.start_date || rental.transaction_date,
          rental_end_date: rental.rental_end_date || rental.rental_period?.end_date || rental.transaction_date,
          days_overdue: daysOverdue,
          daily_rate: dailyRate,
          deposit_per_unit: item.deposit_per_unit || 2000,
          customer_id: rental.customer_id || rental.customer?.id,
          customer_name: rental.customer_name || rental.customer?.name,
          location_id: rental.location_id || rental.location?.id,
          estimated_late_fee: daysOverdue > 0 ? daysOverdue * dailyRate * 1.5 : 0,
        };
      }) || [];
      
      console.log('Processed outstanding items:', outstandingItems);
      setOutstandingItems(outstandingItems);
      
    } catch (error) {
      console.error('Error fetching rental data:', error);
      // Show error state or fallback
      setSelectedRental({
        id: id,
        transaction_number: 'Loading...',
        customer_name: 'Loading...',
        items: []
      });
    } finally {
      setLoadingRental(false);
    }
  };

  // Filter steps based on whether we have a rental ID
  const availableSteps = rentalId ? steps.filter(step => step.id !== 'search') : steps;
  const currentStepIndex = availableSteps.findIndex(step => step.id === currentStep);
  const progress = ((currentStepIndex + 1) / availableSteps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'search':
        return !!selectedRental;
      case 'selection':
        return wizardData.selected_items.length > 0;
      case 'inspection':
        return Object.keys(wizardData.inspection_data).length === wizardData.selected_items.length;
      case 'calculation':
        return wizardData.fee_calculations.length === wizardData.selected_items.length;
      case 'review':
        return wizardData.customer_acknowledgment;
      case 'complete':
        return false;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < availableSteps.length) {
      setCurrentStep(availableSteps[nextIndex].id);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(availableSteps[prevIndex].id);
    }
  };

  const handleStepClick = (stepId: WizardStep) => {
    const stepIndex = availableSteps.findIndex(step => step.id === stepId);
    // Only allow going back or to current step
    if (stepIndex <= currentStepIndex) {
      setCurrentStep(stepId);
    }
  };

  const updateWizardData = (updates: Partial<ReturnWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const updateSelectedItems = (selectedIds: Set<string>, quantities: Record<string, number>) => {
    const selectedItems = Array.from(selectedIds).map(skuId => {
      const item = outstandingItems.find(i => i.sku_id === skuId);
      if (!item) return null;
      
      return {
        transaction_line_id: item.transaction_line_id,
        sku_id: item.sku_id,
        quantity_to_return: quantities[skuId] || 1,
        return_date: new Date().toISOString(),
        condition_after: 'B' as const,
        defects: [],
      };
    }).filter(Boolean);
    
    updateWizardData({ selected_items: selectedItems });
  };

  const calculateReturnSummary = (): ReturnSummary => {
    const totalItemsReturned = wizardData.selected_items.reduce((sum, item) => sum + item.quantity_to_return, 0);
    const totalItemsOutstanding = outstandingItems.reduce((sum, item) => sum + item.quantity_outstanding, 0) - totalItemsReturned;
    
    const totalLateFees = wizardData.fee_calculations.reduce((sum, calc) => sum + calc.late_fee_amount, 0);
    const totalDamageCosts = wizardData.fee_calculations.reduce((sum, calc) => sum + calc.damage_cost, 0);
    const totalCleaningCosts = wizardData.fee_calculations.reduce((sum, calc) => sum + calc.cleaning_cost, 0);
    const totalDepositRefund = wizardData.fee_calculations.reduce((sum, calc) => sum + calc.deposit_refund, 0);
    
    const totalDepositHeld = outstandingItems.reduce((sum, item) => 
      sum + (item.deposit_per_unit * item.quantity_outstanding), 0
    );
    
    const netAmountDue = totalLateFees + totalDamageCosts + totalCleaningCosts - totalDepositRefund;

    return {
      total_items_returned: totalItemsReturned,
      total_items_outstanding: totalItemsOutstanding,
      total_late_fees: totalLateFees,
      total_damage_costs: totalDamageCosts,
      total_cleaning_costs: totalCleaningCosts,
      total_deposit_held: totalDepositHeld,
      total_deposit_refund: totalDepositRefund,
      net_amount_due: netAmountDue,
    };
  };

  const handleComplete = () => {
    onComplete(wizardData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getReturnTypeDisplay = (type: ReturnType) => {
    const displays = {
      PARTIAL: { title: 'Partial Return', color: 'bg-slate-100 text-slate-800' },
      FULL: { title: 'Full Return', color: 'bg-green-100 text-green-800' },
      EARLY: { title: 'Early Return', color: 'bg-purple-100 text-purple-800' },
      DAMAGED: { title: 'Damaged Return', color: 'bg-red-100 text-red-800' },
      LOST: { title: 'Lost Item', color: 'bg-gray-100 text-gray-800' },
    };
    return displays[type];
  };

  const returnDisplay = getReturnTypeDisplay(wizardData.return_type);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Badge className={returnDisplay.color}>
                  {returnDisplay.title}
                </Badge>
                <div>
                  <h1 className="text-2xl font-bold">Return Processing Wizard</h1>
                  <p className="text-muted-foreground">
                    Process rental returns with inspection and fee calculation
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Rental Information (when rental ID is provided) */}
        {rentalId && selectedRental && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Rental Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Customer Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Customer Details
                  </div>
                  <div className="space-y-2">
                    <div className="font-semibold text-lg">{selectedRental.customer_name || selectedRental.customer?.name}</div>
                    {(selectedRental.customer_email || selectedRental.customer?.email) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {selectedRental.customer_email || selectedRental.customer?.email}
                      </div>
                    )}
                    {(selectedRental.customer_phone || selectedRental.customer?.phone) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {selectedRental.customer_phone || selectedRental.customer?.phone}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Transaction Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    Transaction Info
                  </div>
                  <div className="space-y-2">
                    <div className="font-semibold">#{selectedRental.transaction_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(selectedRental.transaction_date)}
                    </div>
                    <Badge variant={selectedRental.is_overdue ? 'destructive' : 'secondary'}>
                      {selectedRental.rental_status || selectedRental.status}
                    </Badge>
                  </div>
                </div>
                
                {/* Rental Period */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Rental Period
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <div className="font-medium">Start: {formatDate(selectedRental.rental_start_date || selectedRental.rental_period?.start_date)}</div>
                      <div className="font-medium">End: {formatDate(selectedRental.rental_end_date || selectedRental.rental_period?.end_date)}</div>
                    </div>
                    {selectedRental.is_overdue && (
                      <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        {selectedRental.days_overdue} days overdue
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Financial & Location */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <IndianRupee className="h-4 w-4" />
                    Financial & Location
                  </div>
                  <div className="space-y-2">
                    <div className="font-semibold text-lg">{formatCurrency(selectedRental.total_amount)}</div>
                    {selectedRental.deposit_amount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Deposit: {formatCurrency(selectedRental.deposit_amount)}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3 w-3" />
                      {selectedRental.location_name || selectedRental.location?.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedRental.items_count || selectedRental.items?.length || 0} items rented
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {availableSteps.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Step indicators */}
              <div className="flex justify-between">
                {availableSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = step.id === currentStep;
                  const isCompleted = index < currentStepIndex;
                  const isAccessible = index <= currentStepIndex;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex flex-col items-center space-y-2 cursor-pointer ${
                        isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                      }`}
                      onClick={() => isAccessible && handleStepClick(step.id)}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isActive
                            ? 'bg-slate-500 border-slate-500 text-white'
                            : isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${
                          isActive ? 'text-slate-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Content */}
          <div className="lg:col-span-2">
            <Card className="min-h-[600px]">
              <CardHeader>
                <CardTitle>
                  {availableSteps.find(s => s.id === currentStep)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRental && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading rental information...</p>
                    </div>
                  </div>
                )}
                
                {!loadingRental && currentStep === 'search' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Search for the rental transaction to process returns.
                    </p>
                    
                    {/* Rental Search Component would go here */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Find Rental Transaction</h3>
                      <p className="text-muted-foreground mb-4">
                        Search by transaction number, customer name, or phone
                      </p>
                      <Button variant="outline" onClick={() => {
                        // Mock selection
                        setSelectedRental({ id: '123', customer: 'John Doe', items: 3 });
                        setOutstandingItems([
                          {
                            transaction_id: '123',
                            transaction_line_id: '1',
                            sku_id: 'SKU001',
                            sku_code: 'CAM-001',
                            item_name: 'Professional Camera',
                            quantity_rented: 2,
                            quantity_returned: 0,
                            quantity_outstanding: 2,
                            rental_start_date: '2024-01-01',
                            rental_end_date: '2024-01-05',
                            days_overdue: 3,
                            daily_rate: 500,
                            deposit_per_unit: 2000,
                            customer_id: '1',
                            customer_name: 'John Doe',
                            location_id: '1',
                            estimated_late_fee: 2250, // 3 days * 500 * 1.5
                          }
                        ]);
                      }}>
                        Search Rentals
                      </Button>
                    </div>

                    {selectedRental && (
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Transaction #{selectedRental.id}</h4>
                              <p className="text-sm text-muted-foreground">
                                Customer: {selectedRental.customer}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {selectedRental.items} items rented
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!loadingRental && currentStep === 'selection' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Select Items to Return</h3>
                        <p className="text-muted-foreground">
                          Choose which items are being returned and specify quantities.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Select all items
                            const allIds = new Set(outstandingItems.map(item => item.sku_id));
                            setSelectedItemIds(allIds);
                            const quantities: Record<string, number> = {};
                            outstandingItems.forEach(item => {
                              quantities[item.sku_id] = item.quantity_outstanding;
                            });
                            setItemQuantities(quantities);
                            updateSelectedItems(allIds, quantities);
                          }}
                        >
                          Select All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Clear all selections
                            setSelectedItemIds(new Set());
                            setItemQuantities({});
                            updateWizardData({ selected_items: [] });
                          }}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    
                    {outstandingItems.length === 0 ? (
                      <Card className="p-8">
                        <div className="text-center">
                          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Available</h3>
                          <p className="text-gray-500">
                            No outstanding items found for this rental transaction.
                          </p>
                        </div>
                      </Card>
                    ) : (
                      <Card>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={selectedItemIds.size === outstandingItems.length && outstandingItems.length > 0}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      const allIds = new Set(outstandingItems.map(item => item.sku_id));
                                      setSelectedItemIds(allIds);
                                      const quantities: Record<string, number> = {};
                                      outstandingItems.forEach(item => {
                                        quantities[item.sku_id] = item.quantity_outstanding;
                                      });
                                      setItemQuantities(quantities);
                                      updateSelectedItems(allIds, quantities);
                                    } else {
                                      setSelectedItemIds(new Set());
                                      setItemQuantities({});
                                      updateWizardData({ selected_items: [] });
                                    }
                                  }}
                                />
                              </TableHead>
                              <TableHead>Item Details</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>Rented Qty</TableHead>
                              <TableHead>Outstanding</TableHead>
                              <TableHead>Return Qty</TableHead>
                              <TableHead>Daily Rate</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Late Fee</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {outstandingItems.map((item) => {
                              const isSelected = selectedItemIds.has(item.sku_id);
                              const returnQty = itemQuantities[item.sku_id] || 0;
                              
                              return (
                                <TableRow key={item.sku_id} className={isSelected ? 'bg-blue-50' : ''}>
                                  <TableCell>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedItemIds);
                                        const newQuantities = { ...itemQuantities };
                                        
                                        if (checked) {
                                          newSelected.add(item.sku_id);
                                          newQuantities[item.sku_id] = item.quantity_outstanding;
                                        } else {
                                          newSelected.delete(item.sku_id);
                                          delete newQuantities[item.sku_id];
                                        }
                                        
                                        setSelectedItemIds(newSelected);
                                        setItemQuantities(newQuantities);
                                        updateSelectedItems(newSelected, newQuantities);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{item.item_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {item.sku_code}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                      {item.sku_code}
                                    </code>
                                  </TableCell>
                                  <TableCell>{item.quantity_rented}</TableCell>
                                  <TableCell>
                                    <span className="font-medium">{item.quantity_outstanding}</span>
                                  </TableCell>
                                  <TableCell>
                                    {isSelected ? (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newQty = Math.max(1, returnQty - 1);
                                            const newQuantities = { ...itemQuantities, [item.sku_id]: newQty };
                                            setItemQuantities(newQuantities);
                                            updateSelectedItems(selectedItemIds, newQuantities);
                                          }}
                                          disabled={returnQty <= 1}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          value={returnQty}
                                          onChange={(e) => {
                                            const newQty = Math.min(item.quantity_outstanding, Math.max(1, parseInt(e.target.value) || 1));
                                            const newQuantities = { ...itemQuantities, [item.sku_id]: newQty };
                                            setItemQuantities(newQuantities);
                                            updateSelectedItems(selectedItemIds, newQuantities);
                                          }}
                                          className="w-16 text-center"
                                          min="1"
                                          max={item.quantity_outstanding}
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newQty = Math.min(item.quantity_outstanding, returnQty + 1);
                                            const newQuantities = { ...itemQuantities, [item.sku_id]: newQty };
                                            setItemQuantities(newQuantities);
                                            updateSelectedItems(selectedItemIds, newQuantities);
                                          }}
                                          disabled={returnQty >= item.quantity_outstanding}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{formatCurrency(item.daily_rate)}</TableCell>
                                  <TableCell>
                                    {item.days_overdue > 0 ? (
                                      <div className="flex items-center gap-2">
                                        <Badge variant="destructive">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          {item.days_overdue}d overdue
                                        </Badge>
                                      </div>
                                    ) : (
                                      <Badge variant="secondary">On time</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {item.days_overdue > 0 ? (
                                      <span className="text-red-600 font-medium">
                                        {formatCurrency(item.estimated_late_fee)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Card>
                    )}
                    
                    {/* Selection Summary */}
                    {selectedItemIds.size > 0 && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                              <span className="font-medium text-blue-900">
                                {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected for return
                              </span>
                            </div>
                            <div className="text-sm text-blue-700">
                              Total quantity: {Object.values(itemQuantities).reduce((sum, qty) => sum + qty, 0)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!loadingRental && currentStep === 'inspection' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Inspect each returned item and document its condition.
                    </p>
                    
                    {/* Inspection Component would go here */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Item Inspection</h3>
                      <p className="text-muted-foreground mb-4">
                        Document condition and any defects
                      </p>
                      <Button variant="outline" onClick={() => {
                        // Mock inspection data
                        updateWizardData({
                          inspection_data: {
                            '1': {
                              id: '1',
                              return_line_id: '1',
                              inspector_id: 'staff1',
                              inspection_date: new Date().toISOString(),
                              pre_rental_photos: [],
                              post_rental_photos: [],
                              comparison_notes: 'Minor wear on corners',
                              overall_condition: 'B',
                              functional_check_passed: true,
                              cosmetic_check_passed: true,
                              accessories_complete: true,
                              packaging_condition: 'GOOD',
                              recommended_action: 'MINOR_CLEANING',
                              customer_acknowledgment: true,
                              dispute_raised: false,
                            }
                          }
                        });
                      }}>
                        Start Inspection
                      </Button>
                    </div>
                  </div>
                )}

                {!loadingRental && currentStep === 'calculation' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Calculate late fees, damage costs, and deposit refunds.
                    </p>
                    
                    {/* Fee Calculation Component would go here */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Fee Calculation</h3>
                      <p className="text-muted-foreground mb-4">
                        Compute all charges and refunds
                      </p>
                      <Button variant="outline" onClick={() => {
                        // Mock calculation
                        updateWizardData({
                          fee_calculations: [{
                            line_id: '1',
                            sku_id: 'SKU001',
                            quantity_returned: 2,
                            days_overdue: 3,
                            daily_rate: 500,
                            late_fee_rate: 750, // 150% of daily rate
                            late_fee_amount: 2250, // 3 days * 750 * 1 unit
                            damage_cost: 0,
                            cleaning_cost: 200,
                            deposit_per_unit: 2000,
                            deposit_refund: 3800, // 4000 - 200 cleaning
                            net_refund: 1550, // 3800 - 2250 late fee
                          }]
                        });
                      }}>
                        Calculate Fees
                      </Button>
                    </div>
                  </div>
                )}

                {!loadingRental && currentStep === 'review' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Review all return details and get customer acknowledgment.
                    </p>
                    
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Return Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const summary = calculateReturnSummary();
                            return (
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Items Returned:</span>
                                  <span>{summary.total_items_returned}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Items Still Outstanding:</span>
                                  <span>{summary.total_items_outstanding}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                  <span>Late Fees:</span>
                                  <span>{formatCurrency(summary.total_late_fees)}</span>
                                </div>
                                <div className="flex justify-between text-orange-600">
                                  <span>Cleaning Costs:</span>
                                  <span>{formatCurrency(summary.total_cleaning_costs)}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                  <span>Deposit Refund:</span>
                                  <span>{formatCurrency(summary.total_deposit_refund)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold">
                                  <span>Net Amount:</span>
                                  <span className={summary.net_amount_due > 0 ? 'text-red-600' : 'text-green-600'}>
                                    {summary.net_amount_due > 0 ? 'Due: ' : 'Refund: '}
                                    {formatCurrency(Math.abs(summary.net_amount_due))}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="customer_ack"
                          checked={wizardData.customer_acknowledgment}
                          onChange={(e) => updateWizardData({ customer_acknowledgment: e.target.checked })}
                          className="rounded"
                        />
                        <label htmlFor="customer_ack" className="text-sm">
                          Customer acknowledges and agrees to the return details
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {!loadingRental && currentStep === 'complete' && (
                  <div className="text-center space-y-4">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                    <h3 className="text-xl font-semibold">Return Processed Successfully!</h3>
                    <p className="text-muted-foreground">
                      The return has been completed and all fees have been calculated.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            {/* Selected Items */}
            {wizardData.selected_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Items ({wizardData.selected_items.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {wizardData.selected_items.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">SKU: {item.sku_id}</div>
                      <div className="text-muted-foreground">
                        Qty: {item.quantity_to_return}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Return Summary */}
            {wizardData.fee_calculations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const summary = calculateReturnSummary();
                    return (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Late Fees:</span>
                          <span className="text-red-600">{formatCurrency(summary.total_late_fees)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cleaning:</span>
                          <span className="text-orange-600">{formatCurrency(summary.total_cleaning_costs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Damage:</span>
                          <span className="text-red-600">{formatCurrency(summary.total_damage_costs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deposit Refund:</span>
                          <span className="text-green-600">{formatCurrency(summary.total_deposit_refund)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-semibold">
                          <span>Net Amount:</span>
                          <span className={summary.net_amount_due > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(Math.abs(summary.net_amount_due))}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Navigation */}
        {currentStep !== 'complete' && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStepIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentStep === 'review' ? (
                  <Button
                    onClick={handleComplete}
                    disabled={!canProceed() || isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Complete Return'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}