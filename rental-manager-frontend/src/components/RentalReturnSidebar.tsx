'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft as ArrowLeftIcon,
  Package as PackageIcon,
  IndianRupee as RupeeIcon,
  FileText as FileTextIcon,
  Menu as MenuIcon,
  X as XIcon,
  Printer as PrinterIcon
} from 'lucide-react';

type TabType = 'items' | 'financial' | 'notes';

interface RentalReturnSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  rentalId: string;
  transactionNumber?: string;
  canProcessReturn: boolean;
  isProcessing: boolean;
  selectedItemsCount: number;
  onProcessReturn: () => void;
  onPrintReturn?: () => void;
}

export default function RentalReturnSidebar({ 
  activeTab, 
  onTabChange, 
  rentalId,
  transactionNumber,
  canProcessReturn,
  isProcessing,
  selectedItemsCount,
  onProcessReturn,
  onPrintReturn
}: RentalReturnSidebarProps) {
  const router = useRouter();

  const tabs = [
    {
      id: 'items' as TabType,
      label: 'Rental Items',
      icon: PackageIcon,
      description: 'Manage return items and quantities'
    },
    {
      id: 'financial' as TabType, 
      label: 'Financial',
      icon: RupeeIcon,
      description: 'View financial impact and refunds'
    },
    {
      id: 'notes' as TabType,
      label: 'Return Notes', 
      icon: FileTextIcon,
      description: 'Add notes and process return'
    }
  ];

  const handleBackClick = () => {
    router.push('/rentals/active');
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-full flex flex-col shadow-sm">
      {/* Header with Back Button */}
      <div className="p-6 border-b border-gray-200">
        <button
          onClick={handleBackClick}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4 group"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Active Rentals</span>
        </button>
        
        {/* Menu Header */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MenuIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Return Processing</h2>
            {transactionNumber && (
              <p className="text-sm text-gray-500">{transactionNumber}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex-1 p-4 space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full text-left p-4 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Icon className={`w-5 h-5 mt-0.5 ${
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${
                    isActive ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {tab.label}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {tab.description}
                  </p>
                </div>
              </div>
              
              {isActive && (
                <div className="mt-2 h-1 bg-blue-500 rounded-full opacity-50"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit, Print, and Cancel Buttons */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="space-y-3">
          <button
            onClick={onProcessReturn}
            disabled={!canProcessReturn || isProcessing}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
              canProcessReturn && !isProcessing
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:ring-4 focus:ring-green-300'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              `Submit Return${selectedItemsCount > 0 ? ` (${selectedItemsCount})` : ''}`
            )}
          </button>

          {onPrintReturn && (
            <button
              onClick={onPrintReturn}
              disabled={isProcessing}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center ${
                isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 focus:ring-4 focus:ring-blue-300'
              }`}
            >
              <PrinterIcon className="w-4 h-4 mr-2" />
              Print Return Receipt
            </button>
          )}
          
          <button
            onClick={() => router.push(`/rentals/${rentalId}`)}
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-4 focus:ring-red-300'
            }`}
          >
            <XIcon className="w-4 h-4 mr-2" />
            Cancel
          </button>
        </div>
        
        {/* Helper Text */}
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>💡 Complete all sections before submitting</p>
          <p>📝 Review items and financial impact</p>
        </div>
      </div>
    </div>
  );
}

export type { TabType };