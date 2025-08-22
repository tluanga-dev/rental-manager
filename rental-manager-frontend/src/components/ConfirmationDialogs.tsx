'use client';

// Confirmation dialog components for critical actions
import React, { ReactNode } from 'react';
import { 
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  X as XMarkIcon,
  Info as InformationCircleIcon
} from 'lucide-react';
import { AnimatedButton, ScaleIn, FadeIn } from './AnimationComponents';

// Dialog types for different confirmation scenarios
export type DialogType = 'warning' | 'danger' | 'info' | 'success';

interface BaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: DialogType;
  className?: string;
}

// Base modal overlay component
const ModalOverlay = ({ 
  isOpen, 
  onClose, 
  children 
}: { 
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <FadeIn>
          <div 
            className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
            onClick={onClose}
          />
        </FadeIn>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        
        <ScaleIn className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {children}
        </ScaleIn>
      </div>
    </div>
  );
};

// Main confirmation dialog component
export const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  details,
  className = ''
}: BaseDialogProps & {
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  details?: ReactNode;
}) => {
  const typeConfig = {
    warning: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-yellow-400',
      iconBg: 'bg-yellow-100',
      confirmVariant: 'primary' as const
    },
    danger: {
      icon: ExclamationTriangleIcon,
      iconColor: 'text-red-400',
      iconBg: 'bg-red-100',
      confirmVariant: 'danger' as const
    },
    info: {
      icon: InformationCircleIcon,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-100',
      confirmVariant: 'primary' as const
    },
    success: {
      icon: CheckCircleIcon,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-100',
      confirmVariant: 'success' as const
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className={className}>
        <div className="flex items-center">
          <div className={`flex-shrink-0 w-10 h-10 mx-auto rounded-full ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
        </div>
        
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {title}
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">{message}</p>
            {details && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md text-left">
                {details}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
          <AnimatedButton
            variant={config.confirmVariant}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            className="w-full sm:col-start-2"
          >
            {confirmText}
          </AnimatedButton>
          
          <AnimatedButton
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="mt-3 w-full sm:mt-0 sm:col-start-1"
          >
            {cancelText}
          </AnimatedButton>
        </div>
      </div>
    </ModalOverlay>
  );
};

// Return processing confirmation dialog
export const ReturnConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  error = null,
  selectedItems = [],
  financialImpact
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
  selectedItems?: Array<{ item_name: string; return_quantity: number }>;
  financialImpact?: {
    rental_subtotal: number;
    late_fees: number;
    damage_penalties: number;
    total_amount: number;
    deposit_amount: number;
    balance_amount: number;
    charges_applied: boolean;
  };
}) => {
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      type={error ? "danger" : "warning"}
      title={error ? "Return Processing Failed" : "Process Return"}
      message={error ? error : "Are you sure you want to process this return? This action cannot be undone."}
      confirmText={loading ? "Processing..." : error ? "Retry" : "Process Return"}
      cancelText="Cancel"
      details={
        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error Processing Return
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>Please check your connection and try again. If the problem persists, contact support.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Items to Return:</h4>
            <ul className="space-y-1">
              {selectedItems.map((item, index) => (
                <li key={index} className="text-sm text-gray-600 flex justify-between">
                  <span>{item.item_name}</span>
                  <span>Qty: {item.return_quantity}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {financialImpact && (
            <div className="border-t pt-3">
              <h4 className="font-medium text-gray-900 mb-2">Financial Impact:</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Rental Subtotal:</span>
                  <span>₹{financialImpact.rental_subtotal.toFixed(2)}</span>
                </div>
                
                {financialImpact.late_fees > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Late Fees:</span>
                    <span>+₹{financialImpact.late_fees.toFixed(2)}</span>
                  </div>
                )}
                
                {financialImpact.damage_penalties > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Damage Penalties:</span>
                    <span>+₹{financialImpact.damage_penalties.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total Amount:</span>
                  <span>₹{financialImpact.total_amount.toFixed(2)}</span>
                </div>
                
                {financialImpact.deposit_amount > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Less: Deposit Paid:</span>
                    <span>-₹{financialImpact.deposit_amount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className={`flex justify-between font-bold text-lg border-t pt-2 ${
                  financialImpact.balance_amount >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  <span>{financialImpact.balance_amount >= 0 ? 'Amount to be Paid:' : 'Refund Amount:'}</span>
                  <span>₹{Math.abs(financialImpact.balance_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
};

// Delete confirmation dialog
export const DeleteConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  loading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  loading?: boolean;
}) => {
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      type="danger"
      title="Delete Item"
      message={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      details={
        <div className="text-sm text-gray-600 bg-red-50 p-3 rounded-md">
          <p className="font-medium text-red-800 mb-1">Warning:</p>
          <p>This will permanently remove this item and all associated data.</p>
        </div>
      }
    />
  );
};

// Bulk action confirmation dialog
export const BulkActionConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  itemCount,
  loading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: string;
  itemCount: number;
  loading?: boolean;
}) => {
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      type="warning"
      title={`Bulk ${action}`}
      message={`Are you sure you want to ${action.toLowerCase()} ${itemCount} item${itemCount === 1 ? '' : 's'}?`}
      confirmText={`${action} ${itemCount} Item${itemCount === 1 ? '' : 's'}`}
      cancelText="Cancel"
    />
  );
};

// Navigation confirmation dialog (for unsaved changes)
export const NavigationConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      type="warning"
      title="Unsaved Changes"
      message="You have unsaved changes that will be lost if you leave this page."
      confirmText="Leave Page"
      cancelText="Stay Here"
      details={
        <p className="text-sm text-gray-600">
          Make sure to save your work before navigating away from this page.
        </p>
      }
    />
  );
};

// Custom hook for managing confirmation dialogs
export const useConfirmation = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<{
    title: string;
    message: string;
    type?: DialogType;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    details?: ReactNode;
  } | null>(null);

  const showConfirmation = (newConfig: NonNullable<typeof config>) => {
    setConfig(newConfig);
    setIsOpen(true);
  };

  const hideConfirmation = () => {
    setIsOpen(false);
    setConfig(null);
  };

  const handleConfirm = () => {
    if (config) {
      config.onConfirm();
    }
    hideConfirmation();
  };

  const ConfirmationDialogComponent = () => {
    if (!config) return null;

    return (
      <ConfirmationDialog
        isOpen={isOpen}
        onClose={hideConfirmation}
        onConfirm={handleConfirm}
        title={config.title}
        message={config.message}
        type={config.type}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        details={config.details}
      />
    );
  };

  return {
    showConfirmation,
    hideConfirmation,
    ConfirmationDialogComponent
  };
};

// Quick confirmation utility function
export const quickConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  type: DialogType = 'warning'
): Promise<boolean> => {
  return new Promise((resolve) => {
    const handleConfirm = () => {
      onConfirm();
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      resolve(false);
      cleanup();
    };

    const cleanup = () => {
      const modal = document.getElementById('quick-confirm-modal');
      if (modal) {
        document.body.removeChild(modal);
      }
    };

    // Create temporary modal
    const modalContainer = document.createElement('div');
    modalContainer.id = 'quick-confirm-modal';
    document.body.appendChild(modalContainer);

    // Note: This would need React.render in actual implementation
    // This is a conceptual example
  });
};