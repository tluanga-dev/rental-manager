/**
 * Sale Transition Types
 * 
 * Type definitions for the sale transition feature
 */

// Enums matching backend
export enum TransitionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
  ROLLED_BACK = 'ROLLED_BACK'
}

export enum ConflictType {
  ACTIVE_RENTAL = 'ACTIVE_RENTAL',
  LATE_RENTAL = 'LATE_RENTAL',
  FUTURE_BOOKING = 'FUTURE_BOOKING',
  PENDING_BOOKING = 'PENDING_BOOKING',
  INVENTORY_ISSUE = 'INVENTORY_ISSUE',
  MAINTENANCE_SCHEDULED = 'MAINTENANCE_SCHEDULED'
}

export enum ConflictSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ResolutionAction {
  WAIT_FOR_RETURN = 'WAIT_FOR_RETURN',
  CANCEL_BOOKING = 'CANCEL_BOOKING',
  TRANSFER_TO_ALTERNATIVE = 'TRANSFER_TO_ALTERNATIVE',
  OFFER_COMPENSATION = 'OFFER_COMPENSATION',
  POSTPONE_SALE = 'POSTPONE_SALE',
  FORCE_SALE = 'FORCE_SALE'
}

// Interfaces
export interface SaleEligibilityResponse {
  eligible: boolean;
  item_id: string;
  item_name: string;
  current_status: string;
  conflicts: ConflictSummary | null;
  requires_approval: boolean;
  approval_reasons: ApprovalReason[] | null;
  revenue_impact: number | null;
  affected_customers: CustomerInfo[] | null;
  recommendation: string;
  warnings: string[];
}

export interface ConflictSummary {
  total_conflicts: number;
  by_type: Record<ConflictType, number>;
  by_severity: Record<ConflictSeverity, number>;
  total_revenue_impact: number;
  affected_customers: number;
  critical_conflicts: ConflictDetail[];
}

export interface ConflictDetail {
  id: string;
  conflict_type: ConflictType;
  entity_type: string;
  entity_id: string;
  severity: ConflictSeverity;
  description: string;
  customer_id: string | null;
  customer_name: string | null;
  financial_impact: number | null;
  detected_at: string;
  resolved: boolean;
  resolution_action: ResolutionAction | null;
  resolution_notes: string | null;
}

export interface ApprovalReason {
  type: string;
  description: string;
  threshold: number | null;
  actual_value: number | null;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface SaleTransitionInitiateRequest {
  sale_price: number;
  effective_date: string | null;
  force_transition: boolean;
  skip_notifications: boolean;
  notes: string | null;
}

export interface SaleTransitionResponse {
  transition_id: string;
  status: TransitionStatus;
  approval_request_id: string | null;
  conflicts_found: number;
  affected_customers: number;
  message: string;
  next_steps: string[] | null;
  completion_time: string | null;
}

export interface TransitionConfirmationRequest {
  confirmed: boolean;
  resolution_strategy: ResolutionAction;
  resolution_overrides: Record<string, ResolutionAction>;
  notification_message: string | null;
}

export interface TransitionStatusResponse {
  transition_id: string;
  item_id: string;
  item_name: string;
  status: TransitionStatus;
  progress_percentage: number;
  current_step: string;
  conflicts_resolved: number;
  conflicts_pending: number;
  notifications_sent: number;
  customer_responses: number;
  estimated_completion: string | null;
  can_rollback: boolean;
  rollback_deadline: string | null;
}

export interface TransitionResult {
  success: boolean;
  transition_id: string;
  status: TransitionStatus;
  message: string;
  conflicts_resolved: number;
  customers_notified: number;
  completion_time: string | null;
  errors: string[] | null;
}

export interface RollbackResult {
  success: boolean;
  rollback_id: string;
  items_restored: number;
  bookings_restored: number;
  notifications_sent: number;
  message: string;
  errors: string[] | null;
}

export interface AffectedBooking {
  booking_id: string;
  booking_reference: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  pickup_date: string;
  return_date: string;
  item_quantity: number;
  booking_value: number;
  status: string;
  resolution_action: string | null;
  compensation_offered: number | null;
  alternative_offered: string | null;
}

export interface SaleTransitionListItem {
  id: string;
  item_id: string;
  item_name: string;
  requested_by: string;
  requested_by_name: string;
  request_date: string;
  sale_price: number;
  effective_date: string | null;
  status: TransitionStatus;
  approval_required: boolean;
  approved_by: string | null;
  approved_by_name: string | null;
  approval_date: string | null;
  conflicts_count: number;
  revenue_impact: number | null;
  completed_at: string | null;
}

export interface TransitionMetrics {
  total_transitions: number;
  pending_transitions: number;
  awaiting_approval: number;
  completed_today: number;
  failed_today: number;
  total_revenue_protected: number;
  conflicts_resolved_today: number;
  average_resolution_time: number;
  rollback_count: number;
}