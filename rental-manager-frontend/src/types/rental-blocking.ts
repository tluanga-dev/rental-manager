/**
 * TypeScript types for rental blocking functionality
 */

export type EntityType = 'ITEM' | 'INVENTORY_UNIT';

export interface RentalStatusRequest {
  is_rental_blocked: boolean;
  remarks: string;
}

export interface RentalStatusResponse {
  item_id?: string;
  item_name?: string;
  unit_id?: string;
  sku?: string;
  is_rental_blocked: boolean;
  rental_block_reason?: string;
  rental_blocked_at?: string;
  rental_blocked_by?: string;
  previous_status?: boolean;
  can_be_rented?: boolean;
  message: string;
}

export interface RentalBlockHistoryEntry {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  item_id: string;
  inventory_unit_id?: string;
  is_blocked: boolean;
  previous_status?: boolean;
  remarks: string;
  changed_by: string;
  changed_at: string;
  status_change_description: string;
  entity_display_name: string;
  changed_by_username?: string;
  changed_by_full_name?: string;
}

export interface RentalBlockHistoryListResponse {
  entries: RentalBlockHistoryEntry[];
  total: number;
  skip: number;
  limit: number;
}

export interface BlockedItemSummary {
  item_id: string;
  item_name: string;
  sku: string;
  rental_block_reason: string;
  rental_blocked_at: string;
  rental_blocked_by: string;
  blocked_by_username?: string;
}

export interface BlockedItemsListResponse {
  items: BlockedItemSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface RentalAvailabilityResponse {
  item_id: string;
  item_name: string;
  sku: string;
  is_rentable: boolean;
  is_item_blocked: boolean;
  block_reason?: string;
  total_units: number;
  available_units: number;
  blocked_units: number;
  can_be_rented: boolean;
  availability_message: string;
}

export interface BulkRentalStatusRequest {
  item_ids?: string[];
  unit_ids?: string[];
  is_rental_blocked: boolean;
  remarks: string;
}

export interface BulkRentalStatusResponse {
  successful_changes: RentalStatusResponse[];
  failed_changes: Array<{
    item_id?: string;
    unit_id?: string;
    error_message: string;
  }>;
  total_requested: number;
  total_successful: number;
  total_failed: number;
}

// Unit-specific types
export interface UnitRentalStatusResponse {
  unit_id: string;
  sku: string;
  item_id: string;
  item_name: string;
  is_rental_blocked: boolean;
  rental_block_reason?: string;
  rental_blocked_at?: string;
  rental_blocked_by?: string;
  previous_status?: boolean;
  can_be_rented: boolean;
  message: string;
}

export interface BlockedUnitSummary {
  unit_id: string;
  sku: string;
  item_id: string;
  item_name: string;
  location_id: string;
  location_name?: string;
  rental_block_reason: string;
  rental_blocked_at: string;
  rental_blocked_by: string;
  blocked_by_username?: string;
}

export interface BlockedUnitsListResponse {
  units: BlockedUnitSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface ItemUnitRentalStatusSummary {
  item_id: string;
  item_name: string;
  sku: string;
  is_item_blocked: boolean;
  item_block_reason?: string;
  total_units: number;
  available_units: number;
  blocked_units: number;
  rented_units: number;
  units: UnitRentalStatusResponse[];
}

export interface UnitAvailabilityResponse {
  unit_id: string;
  sku: string;
  item_id: string;
  item_name: string;
  is_unit_blocked: boolean;
  unit_block_reason?: string;
  is_item_blocked: boolean;
  item_block_reason?: string;
  unit_status: string;
  can_be_rented: boolean;
  availability_message: string;
}

// Dialog component props
export interface RentalStatusDialogProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentStatus: boolean;
  currentReason?: string;
  onStatusChange: (blocked: boolean, remarks: string) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
  isLoading?: boolean;
}

// Status change form data
export interface RentalStatusFormData {
  is_rental_blocked: boolean;
  remarks: string;
}

// Status indicator component props
export interface RentalStatusIndicatorProps {
  isBlocked: boolean;
  reason?: string;
  entityType: EntityType;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Toggle component props
export interface RentalStatusToggleProps {
  entityId: string;
  entityType: EntityType;
  entityName: string;
  currentStatus: boolean;
  currentReason?: string;
  onStatusChange: (blocked: boolean, remarks: string) => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}