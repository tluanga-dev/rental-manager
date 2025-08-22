// Design system components with consistent typography, spacing, and styling
import React, { ReactNode } from 'react';

// Typography components with consistent styling
export const Typography = {
  H1: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h1 className={`text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl ${className}`}>
      {children}
    </h1>
  ),

  H2: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h2 className={`text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl ${className}`}>
      {children}
    </h2>
  ),

  H3: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h3 className={`text-xl font-semibold text-gray-900 sm:text-2xl ${className}`}>
      {children}
    </h3>
  ),

  H4: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h4 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h4>
  ),

  H5: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h5 className={`text-base font-semibold text-gray-900 ${className}`}>
      {children}
    </h5>
  ),

  H6: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <h6 className={`text-sm font-semibold text-gray-900 ${className}`}>
      {children}
    </h6>
  ),

  Body: ({ children, size = 'base', className = '' }: { 
    children: ReactNode; 
    size?: 'sm' | 'base' | 'lg';
    className?: string;
  }) => {
    const sizeClasses = {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg'
    };
    return (
      <p className={`${sizeClasses[size]} text-gray-700 leading-relaxed ${className}`}>
        {children}
      </p>
    );
  },

  Caption: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <p className={`text-xs text-gray-500 ${className}`}>
      {children}
    </p>
  ),

  Label: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <span className={`text-sm font-medium text-gray-700 ${className}`}>
      {children}
    </span>
  ),

  Code: ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <code className={`font-mono text-sm bg-gray-100 px-1 py-0.5 rounded ${className}`}>
      {children}
    </code>
  )
};

// Spacing utilities component
export const Spacing = {
  Section: ({ children, size = 'md', className = '' }: { 
    children: ReactNode; 
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
  }) => {
    const sizeClasses = {
      sm: 'py-8',
      md: 'py-12',
      lg: 'py-16',
      xl: 'py-24'
    };
    return (
      <section className={`${sizeClasses[size]} ${className}`}>
        {children}
      </section>
    );
  },

  Stack: ({ children, space = 4, className = '' }: { 
    children: ReactNode; 
    space?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
    className?: string;
  }) => (
    <div className={`space-y-${space} ${className}`}>
      {children}
    </div>
  ),

  Inline: ({ children, space = 4, className = '' }: { 
    children: ReactNode; 
    space?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
    className?: string;
  }) => (
    <div className={`flex items-center space-x-${space} ${className}`}>
      {children}
    </div>
  )
};

// Enhanced card component with consistent styling
export const Card = ({
  children,
  padding = 'md',
  shadow = 'sm',
  border = true,
  hover = false,
  className = ''
}: {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  border?: boolean;
  hover?: boolean;
  className?: string;
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-lg',
    xl: 'shadow-xl'
  };

  return (
    <div className={`
      bg-white rounded-lg
      ${paddingClasses[padding]}
      ${shadowClasses[shadow]}
      ${border ? 'border border-gray-200' : ''}
      ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

// Enhanced button component with consistent styling
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onClick,
  className = '',
  type = 'button'
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 disabled:border-gray-300 disabled:text-gray-300',
    ghost: 'text-blue-600 hover:bg-blue-50 focus:ring-blue-500 disabled:text-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
  };

  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'}
        ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

// Enhanced input component
export const Input = ({
  type = 'text',
  size = 'md',
  disabled = false,
  error = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}: {
  type?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  const baseClasses = 'border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const stateClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-400">{leftIcon}</span>
        </div>
      )}
      <input
        type={type}
        disabled={disabled}
        className={`
          ${baseClasses}
          ${sizeClasses[size]}
          ${stateClasses}
          ${leftIcon ? 'pl-10' : ''}
          ${rightIcon ? 'pr-10' : ''}
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      />
      {rightIcon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-400">{rightIcon}</span>
        </div>
      )}
    </div>
  );
};

// Status badge component
export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = ''
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full';

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-indigo-100 text-indigo-800'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-sm'
  };

  const dotColors = {
    default: 'bg-gray-400',
    primary: 'bg-blue-400',
    success: 'bg-green-400',
    warning: 'bg-yellow-400',
    danger: 'bg-red-400',
    info: 'bg-indigo-400'
  };

  return (
    <span className={`
      ${baseClasses}
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      ${className}
    `}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
};

// Alert component
export const Alert = ({
  children,
  variant = 'info',
  title,
  dismissible = false,
  onDismiss,
  className = ''
}: {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) => {
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    danger: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className={`
      border rounded-lg p-4
      ${variantClasses[variant]}
      ${className}
    `}>
      <div className="flex items-start">
        <div className="flex-1">
          {title && (
            <Typography.H5 className="mb-1 text-current">
              {title}
            </Typography.H5>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-current hover:opacity-75 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Divider component
export const Divider = ({
  orientation = 'horizontal',
  spacing = 'md',
  className = ''
}: {
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const spacingClasses = {
    horizontal: {
      sm: 'my-2',
      md: 'my-4',
      lg: 'my-8'
    },
    vertical: {
      sm: 'mx-2',
      md: 'mx-4',
      lg: 'mx-8'
    }
  };

  const orientationClasses = {
    horizontal: 'border-t border-gray-200 w-full',
    vertical: 'border-l border-gray-200 h-full'
  };

  return (
    <div className={`
      ${orientationClasses[orientation]}
      ${spacingClasses[orientation][spacing]}
      ${className}
    `} />
  );
};

// Layout components
export const Layout = {
  Container: ({ children, size = 'default', className = '' }: {
    children: ReactNode;
    size?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
    className?: string;
  }) => {
    const sizeClasses = {
      sm: 'max-w-3xl',
      default: 'max-w-7xl',
      lg: 'max-w-screen-xl',
      xl: 'max-w-screen-2xl',
      full: 'max-w-none'
    };

    return (
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${sizeClasses[size]} ${className}`}>
        {children}
      </div>
    );
  },

  Grid: ({ children, cols = 1, gap = 6, className = '' }: {
    children: ReactNode;
    cols?: 1 | 2 | 3 | 4 | 6 | 12;
    gap?: 2 | 4 | 6 | 8;
    className?: string;
  }) => (
    <div className={`grid grid-cols-${cols} gap-${gap} ${className}`}>
      {children}
    </div>
  ),

  Flex: ({ children, direction = 'row', justify = 'start', align = 'start', wrap = false, gap = 0, className = '' }: {
    children: ReactNode;
    direction?: 'row' | 'col';
    justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
    align?: 'start' | 'end' | 'center' | 'stretch';
    wrap?: boolean;
    gap?: 0 | 2 | 4 | 6 | 8;
    className?: string;
  }) => (
    <div className={`
      flex flex-${direction}
      justify-${justify}
      items-${align}
      ${wrap ? 'flex-wrap' : ''}
      ${gap > 0 ? `gap-${gap}` : ''}
      ${className}
    `}>
      {children}
    </div>
  )
};