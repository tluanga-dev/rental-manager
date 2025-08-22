// Accessibility and keyboard navigation components
import React, { ReactNode } from 'react';

// Keyboard shortcut hook
export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
      
      // Build shortcut string
      const modifiers = [];
      if (ctrlKey || metaKey) modifiers.push('mod');
      if (shiftKey) modifiers.push('shift');
      if (altKey) modifiers.push('alt');
      
      const shortcutKey = [...modifiers, key.toLowerCase()].join('+');
      
      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Focus trap component
export const FocusTrap = ({
  children,
  enabled = true,
  className = ''
}: {
  children: ReactNode;
  enabled?: boolean;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [enabled]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

// Screen reader only text
export const ScreenReaderOnly = ({ children }: { children: ReactNode }) => (
  <span className="sr-only">{children}</span>
);

// Skip link component
export const SkipLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
  >
    {children}
  </a>
);

// Accessible button component
export const AccessibleButton = ({
  children,
  onClick,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

// Accessible form field component
export const AccessibleField = ({
  id,
  label,
  children, 
  error,
  help,
  required = false,
  className = ''
}: {
  id: string;
  label: string;
  children: ReactNode;
  error?: string;
  help?: string;
  required?: boolean;
  className?: string;
}) => {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : 'false',
        required
      })}
      
      {help && (
        <p id={helpId} className="text-xs text-gray-500">
          {help}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// Keyboard shortcut display component
export const KeyboardShortcut = ({ 
  keys, 
  description,
  className = '' 
}: { 
  keys: string[];
  description: string;
  className?: string;
}) => (
  <div className={`flex items-center justify-between py-2 ${className}`}>
    <span className="text-sm text-gray-700">{description}</span>
    <div className="flex space-x-1">
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="inline-flex items-center justify-center px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded"
        >
          {key}
        </kbd>
      ))}
    </div>
  </div>
);

// Keyboard shortcuts help panel
export const KeyboardShortcutsPanel = ({
  shortcuts,
  isOpen,
  onClose,
  className = ''
}: {
  shortcuts: Array<{
    keys: string[];
    description: string;
    category?: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}) => {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <FocusTrap enabled={isOpen}>
        <div className={`bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 ${className}`}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close shortcuts panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6 max-h-96 overflow-y-auto">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-medium text-gray-900 mb-3 uppercase tracking-wide">
                  {category}
                </h3>
                <div className="space-y-1">
                  {categoryShortcuts.map((shortcut, index) => (
                    <KeyboardShortcut
                      key={index}
                      keys={shortcut.keys}
                      description={shortcut.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <p className="text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">?</kbd> to show/hide this panel
            </p>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

// Accessible data table component
export const AccessibleTable = ({
  caption,
  headers,
  data,
  renderCell,
  className = ''
}: {
  caption: string;
  headers: Array<{
    key: string;
    label: string;
    sortable?: boolean;
  }>;
  data: any[];
  renderCell: (item: any, key: string, index: number) => ReactNode;
  className?: string;
}) => {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200" role="table">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header.sortable ? (
                  <button
                    onClick={() => handleSort(header.key)}
                    className="group inline-flex items-center space-x-1 hover:text-gray-700"
                    aria-label={`Sort by ${header.label}`}
                  >
                    <span>{header.label}</span>
                    <span className="flex flex-col">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </button>
                ) : (
                  header.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {headers.map((header) => (
                <td
                  key={header.key}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                >
                  {renderCell(item, header.key, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Live region for announcing dynamic content changes
export const LiveRegion = ({
  children,
  politeness = 'polite',
  className = ''
}: {
  children: ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  className?: string;
}) => (
  <div
    aria-live={politeness}
    aria-atomic="true"
    className={`sr-only ${className}`}
  >
    {children}
  </div>
);

// Progress indicator with accessibility
export const AccessibleProgress = ({
  value,
  max = 100,
  label,
  className = ''
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
        <span className="text-sm text-gray-500">
          {percentage}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${percentage}% complete`}
        className="w-full bg-gray-200 rounded-full h-2"
      >
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};