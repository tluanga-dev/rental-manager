export enum ErrorType {
  // HTTP Status Code Based
  CONFLICT = 'CONFLICT',
  VALIDATION = 'VALIDATION',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_SERVER = 'INTERNAL_SERVER',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  
  // Business Logic Based
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_IN_USE = 'RESOURCE_IN_USE',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  BOOKING_CONFLICT = 'BOOKING_CONFLICT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // System/Client Based
  UNKNOWN = 'UNKNOWN',
  CLIENT_ERROR = 'CLIENT_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  details?: string;
  suggestions?: string[];
  actions?: ErrorAction[];
  technical?: {
    statusCode?: number;
    requestId?: string;
    timestamp?: string;
    endpoint?: string;
  };
}

export interface ErrorAction {
  label: string;
  action: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  data?: Record<string, any>;
}

export interface ConflictErrorData {
  conflictingResource: {
    id?: string;
    name: string;
    type?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  suggestedAlternatives?: string[];
  allowOverwrite?: boolean;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  detail?: string;
  data?: any;
  errors?: Record<string, string[]>;
}