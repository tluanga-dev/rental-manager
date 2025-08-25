import { z } from 'zod';
import type { ItemType, ItemStatus } from '@/types/item';

// Item type enum validation
const itemTypeEnum = z.enum(['RENTAL', 'SALE', 'BOTH'] as const);
const itemStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED'] as const);

// Base item validation schema - Updated for Item Master API
export const itemFormSchema = z.object({
  item_name: z.string()
    .min(1, 'Item name is required')
    .max(200, 'Item name must be 200 characters or less'),
  item_status: itemStatusEnum.default('ACTIVE'),
  category_id: z.string().optional(),
  brand_id: z.string().optional(),
  unit_of_measurement_id: z.string().optional(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  specifications: z.string()
    .max(2000, 'Specifications must be 2000 characters or less')
    .optional(),
  model_number: z.string()
    .max(100, 'Model number must be 100 characters or less')
    .optional(),
    
  // Pricing fields
  rental_rate_per_period: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Rental rate cannot be negative').optional()
  ),
  rental_period: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 1;
      const num = parseInt(String(val));
      return isNaN(num) ? 1 : Math.max(1, num); // Ensure positive integer, minimum 1
    },
    z.number().int().min(1, 'Rental period must be at least 1 day')
  ),
  sale_price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Sale price cannot be negative').optional()
  ),
  purchase_price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Purchase price cannot be negative').optional()
  ),
  initial_stock_quantity: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, 'Initial stock quantity cannot be negative').optional()
  ),
  security_deposit: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Security deposit cannot be negative').optional()
  ),
  
  // Inventory fields
  serial_number_required: z.boolean().default(false),
  warranty_period_days: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      const num = parseInt(String(val));
      return isNaN(num) ? 0 : Math.max(0, num); // Ensure positive integer
    },
    z.number().int().min(0, 'Warranty period must be a positive integer')
  ),
  reorder_point: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Reorder point cannot be negative').optional()
  ),
  
  // Item availability flags
  is_rentable: z.boolean().default(true),
  is_salable: z.boolean().default(false),
}).refine((data) => {
  // Validate rental period is required for rentable items
  if (data.is_rentable) {
    return data.rental_period !== undefined && data.rental_period !== '';
  }
  return true;
}, {
  message: 'Rental period is required when item is available for rental',
  path: ['rental_period'],
});
// Sale price validation removed - sale price is now optional and can be 0 for saleable items
// This allows free items, promotional items, and dynamic pricing

export type ItemFormData = z.infer<typeof itemFormSchema>;

// Update schema (all fields optional except ID)
export const updateItemFormSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  item_code: z.string().optional(),
  item_name: z.string().optional(),
  item_type: itemTypeEnum.optional(),
  item_status: itemStatusEnum.optional(),
  category_id: z.string().optional(),
  brand_id: z.string().optional(),
  unit_of_measurement_id: z.string().optional(),
  description: z.string().optional(),
  specifications: z.string().optional(),
  model_number: z.string().optional(),
  purchase_price: z.number().optional(),
  rental_price_per_day: z.number().optional(),
  rental_price_per_week: z.number().optional(),
  rental_price_per_month: z.number().optional(),
  sale_price: z.number().optional(),
  security_deposit: z.number().optional(),
  minimum_rental_days: z.string().optional(),
  maximum_rental_days: z.string().optional(),
  serial_number_required: z.boolean().optional(),
  warranty_period_days: z.string().optional(),
  reorder_point: z.number().min(0, 'Reorder point cannot be negative').optional(),
  is_rentable: z.boolean().optional(),
  is_salable: z.boolean().optional(),
});

export type UpdateItemFormData = z.infer<typeof updateItemFormSchema>;