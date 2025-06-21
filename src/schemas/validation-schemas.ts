import { z } from 'zod';

export const UserSchemas = {
  create: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters')
      .trim(),
    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email must be less than 255 characters')
      .toLowerCase()
      .trim(),
    default_currency: z.string()
      .regex(/^[A-Z]{3}$/, 'Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)')
      .max(3, 'Currency code must be exactly 3 characters')
  }),

  update: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(255, 'Name must be less than 255 characters')
      .trim()
      .optional(),
    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email must be less than 255 characters')
      .toLowerCase()
      .trim()
      .optional(),
    default_currency: z.string()
      .regex(/^[A-Z]{3}$/, 'Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)')
      .max(3, 'Currency code must be exactly 3 characters')
      .optional()
  })
};

export const AccountSchemas = {
  create: z.object({
    user_id: z.string().min(1, 'User ID is required'),
    institution_name: z.string().min(1, 'Institution name is required'),
    initial_balance: z.number({ invalid_type_error: 'Initial balance must be a number' }),
    currency: z.string()
      .regex(/^[A-Z]{3}$/, 'Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)')
      .max(3, 'Currency code must be exactly 3 characters'),
    account_type: z.enum([
      'checking',
      'savings',
      'investment',
      'credit_card',
      'payment_app',
      'cash',
      'other'
    ], {
      errorMap: () => ({ message: 'Invalid account type' })
    }),
    payment_method_ids: z.array(z.string()).min(1, 'At least one payment method is required')
  }),

  update: z.object({
    institution_name: z.string().min(1, 'Institution name is required').optional(),
    initial_balance: z.number({ invalid_type_error: 'Initial balance must be a number' }).optional(),
    currency: z.string()
      .regex(/^[A-Z]{3}$/, 'Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)')
      .max(3, 'Currency code must be exactly 3 characters')
      .optional(),
    account_type: z.enum([
      'checking',
      'savings',
      'investment',
      'credit_card',
      'payment_app',
      'cash',
      'other'
    ], {
      errorMap: () => ({ message: 'Invalid account type' })
    }).optional(),
    payment_method_ids: z.array(z.string()).min(1, 'At least one payment method is required').optional()
  })
};

export const PaymentMethodSchemas = {
  create: z.object({
    name: z.string().min(1, 'Payment method name is required').max(255, 'Name too long')
  }),

  update: z.object({
    name: z.string().min(1, 'Payment method name is required').max(255, 'Name too long')
  })
};

export const AccountPaymentMethodSchemas = {
  create: z.object({
    payment_method_id: z.string().min(1, 'Payment method ID is required')
  })
};

export const CategorySchemas = {
  create: z.object({
    user_id: z.string().min(1, 'User ID is required'),
    name: z.string()
      .min(1, 'Category name is required')
      .max(255, 'Category name must be less than 255 characters')
      .trim(),
    type: z.enum(['income', 'expense'], {
      errorMap: () => ({ message: 'Category type must be either income or expense' })
    }),
    color: z.string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)')
      .optional(),
    icon: z.string()
      .max(50, 'Icon name must be less than 50 characters')
      .trim()
      .optional()
  }),

  update: z.object({
    name: z.string()
      .min(1, 'Category name is required')
      .max(255, 'Category name must be less than 255 characters')
      .trim()
      .optional(),
    type: z.enum(['income', 'expense'], {
      errorMap: () => ({ message: 'Category type must be either income or expense' })
    }).optional(),
    color: z.string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)')
      .optional(),
    icon: z.string()
      .max(50, 'Icon name must be less than 50 characters')
      .trim()
      .optional()
  })
}; 