// Progress indicators and multi-step process components
import React, { ReactNode } from 'react';
import { CheckIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Step indicator component
export const StepIndicator = ({
  steps,
  currentStep = 0,
  orientation = 'horizontal',
  size = 'md',
  showLabels = true,
  className = ''
}: {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: ReactNode;
  }>;
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}) => {
  const isHorizontal = orientation === 'horizontal';
  
  const sizeConfig = {
    sm: {
      circle: 'w-6 h-6 text-xs',
      text: 'text-xs',
      spacing: isHorizontal ? 'space-x-2' : 'space-y-2'
    },
    md: {
      circle: 'w-8 h-8 text-sm',
      text: 'text-sm',
      spacing: isHorizontal ? 'space-x-4' : 'space-y-4'
    },
    lg: {
      circle: 'w-10 h-10 text-base',
      text: 'text-base',
      spacing: isHorizontal ? 'space-x-6' : 'space-y-6'
    }
  };

  const config = sizeConfig[size];

  return (
    <nav className={`${className}`} aria-label="Progress">
      <ol className={`
        flex ${isHorizontal ? 'items-center' : 'flex-col items-start'}
        ${config.spacing}
      `}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={step.id} className={`
              flex items-center
              ${isHorizontal ? '' : 'w-full'}
            `}>
              <div className={`
                flex items-center
                ${isHorizontal ? '' : 'w-full'}
              `}>
                {/* Step Circle */}
                <div className={`
                  ${config.circle}
                  rounded-full flex items-center justify-center font-medium transition-all duration-200
                  ${isCompleted 
                    ? 'bg-green-600 text-white' 
                    : isCurrent 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                    : 'bg-gray-200 text-gray-600'
                  }
                `}>
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Content */}
                {showLabels && (
                  <div className={`
                    ml-3 ${isHorizontal ? '' : 'flex-1'}
                  `}>
                    <p className={`
                      ${config.text} font-medium
                      ${isCurrent 
                        ? 'text-blue-600' 
                        : isCompleted 
                        ? 'text-green-600' 
                        : 'text-gray-500'
                      }
                    `}>
                      {step.title}
                    </p>
                    {step.description && (
                      <p className={`${config.text} text-gray-500 mt-0.5`}>
                        {step.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className={`
                  ${isHorizontal ? 'flex-1 ml-4' : 'ml-4 mt-2 mb-2'}
                `}>
                  {isHorizontal ? (
                    <div className={`
                      h-0.5 w-full
                      ${index + 1 <= currentStep ? 'bg-green-600' : 'bg-gray-200'}
                      transition-colors duration-200
                    `} />
                  ) : (
                    <div className={`
                      w-0.5 h-8
                      ${index + 1 <= currentStep ? 'bg-green-600' : 'bg-gray-200'}
                      transition-colors duration-200
                    `} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Progress bar with steps
export const ProgressBar = ({
  current,
  total,
  showSteps = false,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  className = ''
}: {
  current: number;
  total: number;
  showSteps?: boolean;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const percentage = Math.min(Math.max((current / total) * 100, 0), 100);
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600',
    purple: 'bg-purple-600'
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={`w-full ${className}`}>
      {(showSteps || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {showSteps && (
            <span className="text-sm font-medium text-gray-700">
              Step {current} of {total}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-500 ease-out ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Circular progress indicator
export const CircularProgress = ({
  percentage,
  size = 'md',
  color = 'blue',
  showPercentage = true,
  strokeWidth = 8,
  className = ''
}: {
  percentage: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  showPercentage?: boolean;
  strokeWidth?: number;
  className?: string;
}) => {
  const sizeConfig = {
    sm: { width: 40, height: 40, fontSize: 'text-xs' },
    md: { width: 60, height: 60, fontSize: 'text-sm' },
    lg: { width: 80, height: 80, fontSize: 'text-base' },
    xl: { width: 120, height: 120, fontSize: 'text-lg' }
  };

  const colorClasses = {
    blue: 'stroke-blue-600',
    green: 'stroke-green-600',
    red: 'stroke-red-600',
    yellow: 'stroke-yellow-600',
    purple: 'stroke-purple-600'
  };

  const config = sizeConfig[size];
  const radius = (config.width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={config.width}
        height={config.height}
        className="transform -rotate-90"
      >
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        <circle
          cx={config.width / 2}
          cy={config.height / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-500 ease-out ${colorClasses[color]}`}
        />
      </svg>
      {showPercentage && (
        <div className={`absolute inset-0 flex items-center justify-center ${config.fontSize} font-medium text-gray-700`}>
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

// Multi-step form wrapper
export const MultiStepForm = ({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  className = '',
  children
}: {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  className?: string;
  children: ReactNode;
}) => {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Progress Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        orientation="horizontal"
      />

      {/* Form Content */}
      <div className="min-h-96">
        {children}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={isFirstStep}
          className={`
            px-4 py-2 text-sm font-medium rounded-md border transition-colors
            ${isFirstStep
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          Previous
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {isLastStep ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};

// Loading progress with steps
export const LoadingProgress = ({
  steps,
  currentStep,
  message,
  className = ''
}: {
  steps: string[];
  currentStep: number;
  message?: string;
  className?: string;
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">
          Processing...
        </h3>
        {message && (
          <p className="text-sm text-gray-500 mt-1">
            {message}
          </p>
        )}
      </div>

      <ProgressBar
        current={currentStep + 1}
        total={steps.length}
        showSteps
        showPercentage
      />

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center space-x-3 text-sm ${
              index < currentStep
                ? 'text-green-600'
                : index === currentStep
                ? 'text-blue-600'
                : 'text-gray-400'
            }`}
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
              index < currentStep
                ? 'bg-green-600'
                : index === currentStep
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}>
              {index < currentStep ? (
                <CheckIcon className="w-3 h-3 text-white" />
              ) : index === currentStep ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              ) : (
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
              )}
            </div>
            <span className={index === currentStep ? 'font-medium' : ''}>
              {step}
            </span>
            {index === currentStep && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Breadcrumb navigation
export const Breadcrumb = ({
  items,
  separator = <ChevronRightIcon className="w-4 h-4" />,
  className = ''
}: {
  items: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    current?: boolean;
  }>;
  separator?: ReactNode;
  className?: string;
}) => {
  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.current || isLast;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span className="text-gray-400 mx-2">
                  {separator}
                </span>
              )}
              {item.href ? (
                <a
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'text-gray-900 cursor-default'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button
                  onClick={item.onClick}
                  className={`text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'text-gray-900 cursor-default'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className="text-sm font-medium text-gray-900"
                  aria-current="page"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};