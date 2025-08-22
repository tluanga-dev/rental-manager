'use client';

// Animation and transition components for improved UX
import React, { ReactNode } from 'react';

// Fade in animation component
export const FadeIn = ({ 
  children, 
  duration = 300,
  delay = 0,
  className = '' 
}: { 
  children: ReactNode;
  duration?: number;
  delay?: number;
  className?: string;
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-opacity duration-${duration} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Slide in from direction animation
export const SlideIn = ({ 
  children, 
  direction = 'up',
  duration = 300,
  delay = 0,
  className = '' 
}: { 
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  className?: string;
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const directionClasses = {
    up: isVisible ? 'translate-y-0' : 'translate-y-4',
    down: isVisible ? 'translate-y-0' : '-translate-y-4',
    left: isVisible ? 'translate-x-0' : 'translate-x-4',
    right: isVisible ? 'translate-x-0' : '-translate-x-4'
  };

  return (
    <div
      className={`transition-all duration-${duration} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${directionClasses[direction]} ${className}`}
    >
      {children}
    </div>
  );
};

// Scale animation component
export const ScaleIn = ({ 
  children, 
  duration = 200,
  delay = 0,
  className = '' 
}: { 
  children: ReactNode;
  duration?: number;
  delay?: number;
  className?: string;
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-${duration} ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Staggered animation for lists
export const StaggeredList = ({ 
  children, 
  staggerDelay = 50,
  className = '' 
}: { 
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

// Animated card container
export const AnimatedCard = ({ 
  children, 
  className = '',
  hover = true,
  onClick
}: { 
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      className={`
        transition-all duration-200 ease-in-out
        ${hover ? 'hover:shadow-lg hover:-translate-y-1' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// Animated button with loading states
export const AnimatedButton = ({ 
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  onClick,
  className = '',
  type = 'button'
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit';
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
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
        ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'}
        ${className}
      `}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Progress bar animation
export const AnimatedProgressBar = ({ 
  progress, 
  showPercentage = true,
  color = 'blue',
  className = '' 
}: {
  progress: number;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  className?: string;
}) => {
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600'
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-sm font-medium text-gray-700">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ease-out ${colorClasses[color]}`}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
};

// Animated status badge
export const AnimatedStatusBadge = ({ 
  status, 
  pulse = false,
  className = '' 
}: {
  status: string;
  pulse?: boolean;
  className?: string;
}) => {
  const statusConfig: Record<string, { color: string; icon?: string }> = {
    'RENTAL_INPROGRESS': { color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'RENTAL_COMPLETED': { color: 'bg-green-100 text-green-800 border-green-200' },
    'RENTAL_LATE': { color: 'bg-red-100 text-red-800 border-red-200' },
    'RENTAL_EXTENDED': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'RENTAL_PARTIAL_RETURN': { color: 'bg-orange-100 text-orange-800 border-orange-200' }
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800 border-gray-200' };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
        transition-all duration-200 ease-in-out
        ${config.color}
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {status.replace('RENTAL_', '').replace('_', ' ').toLowerCase()}
    </span>
  );
};

// Collapsible section with animation
export const AnimatedCollapsible = ({ 
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
    <div className={`border border-gray-200 rounded-lg ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-150"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-4 pb-3 border-t border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
};

// Page transition wrapper
export const PageTransition = ({ children }: { children: ReactNode }) => {
  return (
    <FadeIn duration={200} className="min-h-screen">
      {children}
    </FadeIn>
  );
};

// Success checkmark animation
export const AnimatedCheckmark = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} text-green-500`}>
      <svg
        className="animate-pulse"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
          className="animate-[draw_0.5s_ease-in-out_forwards]"
        />
      </svg>
    </div>
  );
};