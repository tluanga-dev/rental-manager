// Responsive design components for better mobile experience
import React, { ReactNode } from 'react';
import { 
  Bars3Icon, 
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon 
} from '@heroicons/react/24/outline';

// Responsive grid component
export const ResponsiveGrid = ({
  children,
  cols = 1,
  mdCols = 2,
  lgCols = 4,
  gap = 6,
  className = ''
}: {
  children: ReactNode;
  cols?: number;
  mdCols?: number;
  lgCols?: number;
  gap?: number;
  className?: string;
}) => {
  const gridClass = `grid grid-cols-${cols} md:grid-cols-${mdCols} lg:grid-cols-${lgCols} gap-${gap}`;
  
  return (
    <div className={`${gridClass} ${className}`}>
      {children}
    </div>
  );
};

// Mobile-first table component
export const ResponsiveTable = ({
  headers,
  data,
  renderRow,
  renderMobileCard,
  className = ''
}: {
  headers: string[];
  data: any[];
  renderRow: (item: any, index: number) => ReactNode;
  renderMobileCard?: (item: any, index: number) => ReactNode;
  className?: string;
}) => {
  return (
    <div className={className}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.map((item, index) => (
          <div key={index}>
            {renderMobileCard ? renderMobileCard(item, index) : (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <pre className="text-xs text-gray-600">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No data available</p>
        </div>
      )}
    </div>
  );
};

// Mobile-optimized card component
export const MobileCard = ({
  children,
  title,
  subtitle,
  actions,
  className = ''
}: {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {(title || subtitle) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

// Responsive stack component (horizontal on large screens, vertical on mobile)
export const ResponsiveStack = ({
  children,
  direction = 'horizontal',
  spacing = 4,
  className = ''
}: {
  children: ReactNode;
  direction?: 'horizontal' | 'vertical';
  spacing?: number;
  className?: string;
}) => {
  const stackClass = direction === 'horizontal' 
    ? `flex flex-col lg:flex-row lg:space-x-${spacing} space-y-${spacing} lg:space-y-0`
    : `flex flex-col space-y-${spacing}`;

  return (
    <div className={`${stackClass} ${className}`}>
      {children}
    </div>
  );
};

// Mobile drawer/sidebar component
export const MobileDrawer = ({
  isOpen,
  onClose,
  children,
  title,
  position = 'right'
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  position?: 'left' | 'right';
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const slideClass = position === 'right' 
    ? 'translate-x-0' 
    : '-translate-x-0';
  
  const initialClass = position === 'right' 
    ? 'translate-x-full' 
    : '-translate-x-full';

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 ${position}-0 w-full max-w-sm bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isOpen ? slideClass : initialClass}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {title && <h2 className="text-lg font-medium text-gray-900">{title}</h2>}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// Collapsible mobile section
export const MobileCollapsible = ({
  title,
  children,
  defaultOpen = false,
  className = ''
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={`lg:hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50"
      >
        <span className="font-medium text-gray-900">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg">
          {children}
        </div>
      )}
    </div>
  );
};

// Responsive action buttons
export const ResponsiveActionButtons = ({
  primaryAction,
  secondaryActions = [],
  className = ''
}: {
  primaryAction: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  className?: string;
}) => {
  const [showMore, setShowMore] = React.useState(false);

  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      {/* Primary Action - Always Visible */}
      <button
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled || primaryAction.loading}
        className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {primaryAction.loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Loading...
          </div>
        ) : (
          primaryAction.label
        )}
      </button>

      {/* Secondary Actions */}
      {secondaryActions.length > 0 && (
        <>
          {/* Desktop: Show all actions */}
          <div className="hidden sm:flex gap-3">
            {secondaryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Mobile: Collapsible secondary actions */}
          <div className="sm:hidden">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <span>More Actions</span>
              {showMore ? (
                <ChevronUpIcon className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 ml-2" />
              )}
            </button>
            
            {showMore && (
              <div className="mt-2 space-y-2">
                {secondaryActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.onClick();
                      setShowMore(false);
                    }}
                    disabled={action.disabled}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-left"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Responsive content container
export const ResponsiveContainer = ({
  children,
  maxWidth = '7xl',
  padding = 'default',
  className = ''
}: {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | '6xl' | '7xl';
  padding?: 'none' | 'sm' | 'default' | 'lg';
  className?: string;
}) => {
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4',
    default: 'px-4 py-6 sm:px-6 lg:px-8',
    lg: 'px-6 py-8 sm:px-8 lg:px-12'
  };

  return (
    <div className={`max-w-${maxWidth} mx-auto ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};

// Hook for responsive breakpoints
export const useResponsive = () => {
  const [breakpoint, setBreakpoint] = React.useState<'sm' | 'md' | 'lg' | 'xl'>('sm');

  React.useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= 1280) setBreakpoint('xl');
      else if (width >= 1024) setBreakpoint('lg');
      else if (width >= 768) setBreakpoint('md');
      else setBreakpoint('sm');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl',
    isXl: breakpoint === 'xl'
  };
};