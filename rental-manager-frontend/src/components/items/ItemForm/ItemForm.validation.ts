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
  initial_stock_quantity: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, 'Initial stock quantity cannot be negative').optional()
  ),
  
  // Inventory fields
  serial_number_required: z.boolean().default(false),
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
  serial_number_required: z.boolean().optional(),
  reorder_point: z.number().min(0, 'Reorder point cannot be negative').optional(),
  is_rentable: z.boolean().optional(),
  is_salable: z.boolean().optional(),
});

export type UpdateItemFormData = z.infer<typeof updateItemFormSchema>;