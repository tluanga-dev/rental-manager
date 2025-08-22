'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText as FileTextIcon,
  CheckCircle as CheckCircleIcon,
  AlertCircle as AlertCircleIcon,
  Clock as ClockIcon
} from 'lucide-react';
import { AnimatedButton } from '../AnimationComponents';
import { FinancialImpact } from '../../types/rental-return';

interface ReturnNotesTabProps {
  returnNotes: string;
  onReturnNotesChange: (notes: string) => void;
  onProcessReturn: () => void;
  canProcessReturn: boolean;
  isProcessing: boolean;
  selectedItemsCount: number;
  financialPreview: FinancialImpact | null;
  rentalId: string;
}

export default function ReturnNotesTab({
  returnNotes,
  onReturnNotesChange,
  onProcessReturn,
  canProcessReturn,
  isProcessing,
  selectedItemsCount,
  financialPreview,
  rentalId
}: ReturnNotesTabProps) {
  const router = useRouter();

  const getProcessingStatus = () => {
    if (selectedItemsCount === 0) {
      return {
        icon: AlertCircleIcon,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: 'No items selected for return'
      };
    }
    
    if (canProcessReturn) {
      return {
        icon: CheckCircleIcon,
        color: 'text-green-600', 
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        message: 'Ready to process return'
      };
    }
    
    return {
      icon: ClockIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50', 
      borderColor: 'border-blue-200',
      message: 'Review items and financial impact'
    };
  };

  const status = getProcessingStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Return Notes & Processing</h1>
            <p className="mt-1 text-gray-600">
              Add notes and complete the return process
            </p>
          </div>
          
          <div className={`flex items-center px-4 py-2 rounded-lg border ${status.bgColor} ${status.borderColor}`}>
            <StatusIcon className={`w-5 h-5 mr-2 ${status.color}`} />
            <span className={`font-medium ${status.color}`}>{status.message}</span>
          </div>
        </div>
      </div>

      {/* Processing Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-sm font-medium text-blue-600">Items Selected</div>
          <div className="text-2xl font-bold text-blue-900">{selectedItemsCount}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm font-medium text-green-600">Refund Amount</div>
          <div className="text-2xl font-bold text-green-900">
            ${financialPreview?.total_refund.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-sm font-medium text-purple-600">Status</div>
          <div className="text-lg font-bold text-purple-900">
            {canProcessReturn ? 'Ready' : 'Pending'}
          </div>
        </div>
      </div>

      {/* Return Notes Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FileTextIcon className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Return Notes</h3>
        </div>
        
        <textarea
          value={returnNotes}
          onChange={(e) => onReturnNotesChange(e.target.value)}
          placeholder="Add any notes about this return process..."
          className="w-full h-32 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          disabled={isProcessing}
        />
        
        <div className="mt-3 text-sm text-gray-500">
          <p>💡 Include any relevant details about:</p>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Item condition and quality assessment</li>
            <li>• Customer interaction and feedback</li>
            <li>• Any special circumstances or exceptions</li>
            <li>• Damage details and penalty justification</li>
          </ul>
        </div>

        {/* Note: Submit and Cancel buttons are now located in the sidebar footer */}
      </div>

      {/* Processing Checklist */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pre-Processing Checklist</h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              selectedItemsCount > 0 ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {selectedItemsCount > 0 && <CheckCircleIcon className="w-3 h-3 text-white" />}
            </div>
            <span className={`${selectedItemsCount > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
              Items selected for return ({selectedItemsCount} selected)
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              financialPreview ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {financialPreview && <CheckCircleIcon className="w-3 h-3 text-white" />}
            </div>
            <span className={`${financialPreview ? 'text-gray-900' : 'text-gray-500'}`}>
              Financial impact calculated
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              returnNotes.trim().length > 0 ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {returnNotes.trim().length > 0 && <CheckCircleIcon className="w-3 h-3 text-white" />}
            </div>
            <span className={`${returnNotes.trim().length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
              Return notes added (optional)
            </span>
          </div>
        </div>
      </div>

      {/* Processing Instructions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ready to Process?</h3>
            <p className="text-sm text-gray-600 mt-1">
              Use the Submit and Cancel buttons in the sidebar to complete the return process
            </p>
          </div>
          
          <div className="flex items-center text-blue-600">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-sm font-medium">Check sidebar</span>
          </div>
        </div>
      </div>

      {/* Important Information */}
      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• This action cannot be undone once completed</li>
          <li>• Refund will be processed to the original payment method</li>
          <li>• Inventory levels will be updated automatically</li>
          <li>• Customer will be notified of the return completion</li>
        </ul>
      </div>
    </div>
  );
}