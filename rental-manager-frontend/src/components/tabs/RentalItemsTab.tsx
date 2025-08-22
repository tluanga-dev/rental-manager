'use client';

import React, { useState, useMemo } from 'react';
import { AlertTriangle as ExclamationTriangleIcon, HelpCircle as HelpCircleIcon, Search as SearchIcon } from 'lucide-react';
import ReturnItemsTable from '../ReturnItemsTable';
import HelpDialog from '../dialogs/HelpDialog';
import { ReturnItemState, ReturnAction } from '../../types/rental-return';

interface RentalItemsTabProps {
  returnItems: ReturnItemState[];
  onUpdateItem: (lineId: string, updates: Partial<ReturnItemState>) => void;
  onToggleAll: (selected: boolean) => void;
  onSetActionForAll: (action: ReturnAction) => void;
  selectedCount: number;
  totalCount: number;
  isProcessing: boolean;
  hasOverdueItems: boolean;
}

export default function RentalItemsTab({
  returnItems,
  onUpdateItem,
  onToggleAll,
  onSetActionForAll,
  selectedCount,
  totalCount,
  isProcessing,
  hasOverdueItems
}: RentalItemsTabProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return returnItems;
    }
    return returnItems.filter(item =>
      item.item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [returnItems, searchTerm]);

  // Recalculate counts based on filtered items
  const filteredSelectedCount = filteredItems.filter(item => item.selected).length;
  const filteredTotalCount = filteredItems.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Return Items</h1>
              <p className="mt-1 text-gray-600">
                Select and configure items for return processing
              </p>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Show instructions"
            >
              <HelpCircleIcon className="w-5 h-5" />
            </button>
          </div>
          
          {hasOverdueItems && (
            <div className="flex items-center bg-red-50 text-red-800 px-4 py-2 rounded-lg border border-red-200">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">Overdue Items Present</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Box */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search items by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Return Status Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="text-xs font-medium text-red-600">Late Items</div>
          <div className="text-xl font-bold text-red-900">
            {filteredItems.filter(item => 
              item.item.current_rental_status === 'RENTAL_LATE' || 
              item.item.current_rental_status === 'RENTAL_LATE_PARTIAL_RETURN'
            ).length}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-xs font-medium text-green-600">On Time</div>
          <div className="text-xl font-bold text-green-900">
            {filteredItems.filter(item => 
              item.item.current_rental_status === 'RENTAL_INPROGRESS' || 
              item.item.current_rental_status === 'RENTAL_EXTENDED'
            ).length}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-xs font-medium text-blue-600">Returned</div>
          <div className="text-xl font-bold text-blue-900">
            {filteredItems.filter(item => 
              item.item.current_rental_status === 'RENTAL_COMPLETED'
            ).length}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <div className="text-xs font-medium text-yellow-600">Partial Return</div>
          <div className="text-xl font-bold text-yellow-900">
            {filteredItems.filter(item => 
              item.item.current_rental_status === 'RENTAL_PARTIAL_RETURN' || 
              item.item.current_rental_status === 'RENTAL_LATE_PARTIAL_RETURN'
            ).length}
          </div>
        </div>
      </div>


      {/* Return Items Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <ReturnItemsTable
          returnItems={filteredItems}
          onUpdateItem={onUpdateItem}
          onToggleAll={onToggleAll}
          onSetActionForAll={onSetActionForAll}
          selectedCount={filteredSelectedCount}
          totalCount={filteredTotalCount}
          isProcessing={isProcessing}
        />
      </div>

      {/* Bottom Summary */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Items Ready for Processing</h4>
              <p className="text-sm text-blue-700">
                {selectedCount} of {totalCount} items selected
                {searchTerm && (
                  <span className="text-gray-600"> • Showing {filteredTotalCount} filtered results</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600">Total Return Quantity</div>
              <div className="text-lg font-bold text-blue-900">
                {returnItems
                  .filter(item => item.selected)
                  .reduce((sum, item) => sum + item.return_quantity, 0)
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="📋 Instructions"
      >
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• Select items you want to process for return</li>
          <li>• Choose appropriate return action for each item</li>
          <li>• Enter return quantities and status notes</li>
          <li>• For damaged items, specify damage details and penalties</li>
        </ul>
      </HelpDialog>
    </div>
  );
}