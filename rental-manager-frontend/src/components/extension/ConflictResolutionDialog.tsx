'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, Check, Info } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface BookingConflict {
  item_id: string;
  item_name: string;
  conflicting_bookings: number;
  earliest_conflict_date: string;
  conflicting_customer: string;
  max_extendable_date: string;
  requested_quantity: number;
  available_quantity: number;
}

interface PartialSolution {
  type: 'PARTIAL_EXTENSION' | 'ALTERNATIVE_DATE' | 'CUSTOM';
  description: string;
  items: string[];
  end_date: string;
  charges: number;
}

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: Record<string, BookingConflict>;
  requestedDate: string;
  rental: any;
  onResolve: (solution: PartialSolution) => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  onClose,
  conflicts,
  requestedDate,
  rental,
  onResolve
}) => {
  const [selectedSolution, setSelectedSolution] = useState<string>('');
  const [alternativeSolutions, setAlternativeSolutions] = useState<PartialSolution[]>([]);

  useEffect(() => {
    if (isOpen && conflicts) {
      generateAlternativeSolutions();
    }
  }, [isOpen, conflicts, requestedDate]);

  const generateAlternativeSolutions = () => {
    const solutions: PartialSolution[] = [];
    
    if (!rental?.items) return;

    // Solution 1: Extend non-conflicted items to requested date
    const nonConflictedItems = rental.items.filter((item: any) => 
      !conflicts[item.item_id]
    );
    
    if (nonConflictedItems.length > 0) {
      const charges = nonConflictedItems.reduce((total: number, item: any) => {
        const days = Math.ceil((new Date(requestedDate).getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24));
        return total + (item.unit_price * item.quantity * days);
      }, 0);

      solutions.push({
        type: 'PARTIAL_EXTENSION',
        description: `Extend ${nonConflictedItems.length} available items to ${format(new Date(requestedDate), 'MMM dd, yyyy')}`,
        items: nonConflictedItems.map((item: any) => item.line_id),
        end_date: requestedDate,
        charges
      });
    }
    
    // Solution 2: Find common available date for all items
    const maxAvailableDate = findCommonAvailableDate();
    if (maxAvailableDate && maxAvailableDate !== requestedDate) {
      const charges = rental.items.reduce((total: number, item: any) => {
        const days = Math.ceil((new Date(maxAvailableDate).getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24));
        return total + (item.unit_price * item.quantity * Math.max(0, days));
      }, 0);

      solutions.push({
        type: 'ALTERNATIVE_DATE',
        description: `Extend all items to ${format(new Date(maxAvailableDate), 'MMM dd, yyyy')} (no conflicts)`,
        items: rental.items.map((item: any) => item.line_id),
        end_date: maxAvailableDate,
        charges
      });
    }

    setAlternativeSolutions(solutions);
  };

  const findCommonAvailableDate = (): string => {
    // Find the earliest conflict date across all conflicted items
    const conflictDates = Object.values(conflicts).map(conflict => 
      new Date(conflict.max_extendable_date || conflict.earliest_conflict_date)
    );
    
    if (conflictDates.length === 0) return requestedDate;
    
    // Get the minimum date (earliest conflict)
    const earliestConflict = new Date(Math.min(...conflictDates.map(d => d.getTime())));
    
    // Suggest one day before the earliest conflict
    return format(addDays(earliestConflict, -1), 'yyyy-MM-dd');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handleApplySolution = () => {
    const solution = alternativeSolutions.find(s => s.type === selectedSolution);
    if (solution) {
      onResolve(solution);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Booking Conflicts Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Conflict Summary */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Conflicted Items ({Object.keys(conflicts).length})
            </h3>
            <div className="space-y-3">
              {Object.values(conflicts).map((conflict, index) => (
                <div key={conflict.item_id} className="bg-white p-3 rounded border border-red-100">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{conflict.item_name}</h4>
                      <div className="text-sm text-gray-600 mt-1 space-y-1">
                        <div>Requested: {conflict.requested_quantity} items until {format(new Date(requestedDate), 'MMM dd, yyyy')}</div>
                        <div>Available: {conflict.available_quantity} items</div>
                        <div>Conflict from: {format(new Date(conflict.earliest_conflict_date), 'MMM dd, yyyy')}</div>
                        <div>Conflicting customer: {conflict.conflicting_customer}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {conflict.conflicting_bookings} bookings
                      </span>
                    </div>
                  </div>
                  {conflict.max_extendable_date && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                      <div className="flex items-center gap-1 text-amber-700">
                        <Info className="w-3 h-3" />
                        <span className="font-medium">Max extension date:</span>
                        <span>{format(new Date(conflict.max_extendable_date), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Resolution Options */}
          {alternativeSolutions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Available Solutions
              </h3>
              
              {alternativeSolutions.map((solution, index) => (
                <label key={index} className="block cursor-pointer">
                  <div className={`border rounded-lg p-4 transition-all ${
                    selectedSolution === solution.type 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="solution"
                      value={solution.type}
                      checked={selectedSolution === solution.type}
                      onChange={(e) => setSelectedSolution(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-900">{solution.description}</h4>
                        <div className="text-xs text-gray-600 mt-2 space-y-1">
                          <div>Items affected: {solution.items.length}</div>
                          <div>New end date: {format(new Date(solution.end_date), 'EEEE, MMMM dd, yyyy')}</div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-green-600">{formatCurrency(solution.charges)}</div>
                        <div className="text-xs text-gray-500">Extension charges</div>
                      </div>
                    </div>
                    {selectedSolution === solution.type && (
                      <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                        <div className="flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>This solution will be applied when you continue</span>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              ))}
              
              {/* Custom Solution Option */}
              <div className="border-t pt-4">
                <label className="block cursor-pointer">
                  <div className={`border rounded-lg p-4 transition-all ${
                    selectedSolution === 'CUSTOM' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="solution"
                      value="CUSTOM"
                      checked={selectedSolution === 'CUSTOM'}
                      onChange={(e) => setSelectedSolution(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Set custom dates per item
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Choose individual extension dates for each item to work around conflicts
                        </p>
                      </div>
                      {selectedSolution === 'CUSTOM' && (
                        <Button
                          size="sm"
                          onClick={() => onResolve({
                            type: 'CUSTOM',
                            description: 'Custom dates per item',
                            items: [],
                            end_date: '',
                            charges: 0
                          })}
                          className="ml-4"
                        >
                          Customize Dates
                        </Button>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Resolution Tips:</p>
                <ul className="text-xs space-y-1">
                  <li>• Partial extensions allow you to extend available items immediately</li>
                  <li>• Alternative dates ensure all items can be extended together</li>
                  <li>• Custom dates give you maximum flexibility per item</li>
                  <li>• Contact customers with conflicting bookings if needed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApplySolution}
            disabled={!selectedSolution || selectedSolution === 'CUSTOM'}
            className="bg-green-600 hover:bg-green-700"
          >
            Apply Solution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};