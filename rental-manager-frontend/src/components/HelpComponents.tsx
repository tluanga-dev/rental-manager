// Tooltips, help text, and guidance components
import React, { ReactNode } from 'react';
import { 
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  LightBulbIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Tooltip component with multiple positioning options
export const Tooltip = ({
  children,
  content,
  position = 'top',
  trigger = 'hover',
  className = '',
  disabled = false
}: {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  className?: string;
  disabled?: boolean;
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [shouldShow, setShouldShow] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    if (disabled) return;
    clearTimeout(timeoutRef.current);
    setShouldShow(true);
    timeoutRef.current = setTimeout(() => setIsVisible(true), 100);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
    timeoutRef.current = setTimeout(() => setShouldShow(false), 150);
  };

  const toggleTooltip = () => {
    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
  };

  const triggerProps = trigger === 'hover' ? {
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip
  } : trigger === 'click' ? {
    onClick: toggleTooltip
  } : {
    onFocus: showTooltip,
    onBlur: hideTooltip
  };

  return (
    <div className={`relative inline-block ${className}`} {...triggerProps}>
      {children}
      {shouldShow && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded shadow-lg transition-opacity duration-150 pointer-events-none ${
            positionClasses[position]
          } ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ minWidth: '120px', maxWidth: '240px' }}
        >
          {content}
          <div 
            className={`absolute border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  );
};

// Help icon with tooltip
export const HelpIcon = ({
  tooltip,
  size = 'sm',
  className = ''
}: {
  tooltip: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <Tooltip content={tooltip} position="top">
      <QuestionMarkCircleIcon 
        className={`${sizeClasses[size]} text-gray-400 hover:text-gray-600 cursor-help transition-colors ${className}`}
      />
    </Tooltip>
  );
};

// Info callout component
export const InfoCallout = ({
  title,
  children,
  type = 'info',
  dismissible = false,
  onDismiss,
  className = ''
}: {
  title?: string;
  children: ReactNode;
  type?: 'info' | 'tip' | 'warning' | 'success';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) => {
  const typeConfig = {
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-400',
      icon: InformationCircleIcon
    },
    tip: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-400',
      icon: LightBulbIcon
    },
    warning: {
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-400',
      icon: ExclamationTriangleIcon
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-400',
      icon: InformationCircleIcon
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-md border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.textColor} mb-1`}>
              {title}
            </h3>
          )}
          <div className={`text-sm ${config.textColor}`}>
            {children}
          </div>
        </div>
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={`inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 ${config.textColor}`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Step-by-step guide component
export const StepGuide = ({
  steps,
  currentStep = 0,
  orientation = 'vertical',
  className = ''
}: {
  steps: Array<{
    title: string;
    description: string;
    icon?: ReactNode;
  }>;
  currentStep?: number;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}) => {
  const isVertical = orientation === 'vertical';

  return (
    <div className={`${isVertical ? 'space-y-4' : 'flex space-x-8'} ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        return (
          <div 
            key={index}
            className={`flex ${isVertical ? 'items-start' : 'flex-col items-center'} ${
              isVertical ? '' : 'flex-1'
            }`}
          >
            {/* Step Indicator */}
            <div className={`flex-shrink-0 ${isVertical ? 'mr-4' : 'mb-2'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.icon || (index + 1)}
              </div>
            </div>

            {/* Step Content */}
            <div className={`${isVertical ? 'flex-1' : 'text-center'}`}>
              <h3
                className={`text-sm font-medium ${
                  isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {step.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{step.description}</p>
            </div>

            {/* Connector Line (Vertical Only) */}
            {isVertical && index < steps.length - 1 && (
              <div className="absolute left-4 mt-8 h-4 w-0.5 bg-gray-200"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Contextual help panel
export const HelpPanel = ({
  title,
  children,
  isOpen,
  onClose,
  className = ''
}: {
  title: string;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed right-4 top-4 bottom-4 w-80 bg-white shadow-xl border border-gray-200 rounded-lg z-40 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <div className="p-4 overflow-y-auto h-full">
        {children}
      </div>
    </div>
  );
};

// Field help text component
export const FieldHelp = ({
  children,
  type = 'info',
  className = ''
}: {
  children: ReactNode;
  type?: 'info' | 'warning' | 'error';
  className?: string;
}) => {
  const typeClasses = {
    info: 'text-gray-500',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  return (
    <p className={`text-xs mt-1 ${typeClasses[type]} ${className}`}>
      {children}
    </p>
  );
};

// Interactive tutorial component
export const Tutorial = ({
  steps,
  isActive,
  onComplete,
  onSkip,
  className = ''
}: {
  steps: Array<{
    target: string; // CSS selector
    title: string;
    content: ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
  }>;
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  className?: string;
}) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [targetElement, setTargetElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isActive && steps[currentStep]) {
      const element = document.querySelector(steps[currentStep].target) as HTMLElement;
      setTargetElement(element);
    }
  }, [isActive, currentStep, steps]);

  if (!isActive || !targetElement) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Tutorial Popup */}
      <div className={`fixed z-50 bg-white rounded-lg shadow-xl max-w-sm p-6 ${className}`}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">
              {currentStepData.title}
            </h3>
            <span className="text-sm text-gray-500">
              {currentStep + 1} of {steps.length}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {currentStepData.content}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
          
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip Tutorial
          </button>
        </div>
      </div>
    </>
  );
};

// Hook for managing help state
export const useHelp = () => {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const [helpContent, setHelpContent] = React.useState<ReactNode>(null);
  const [helpTitle, setHelpTitle] = React.useState('');

  const showHelp = (title: string, content: ReactNode) => {
    setHelpTitle(title);
    setHelpContent(content);
    setIsHelpOpen(true);
  };

  const hideHelp = () => {
    setIsHelpOpen(false);
    setHelpContent(null);
    setHelpTitle('');
  };

  return {
    isHelpOpen,
    helpContent,
    helpTitle,
    showHelp,
    hideHelp
  };
};