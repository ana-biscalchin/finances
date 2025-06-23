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
    type: z.enum(['income', 'expense', 'transfer'], {
      errorMap: () => ({ message: 'Category type must be either income, expense, or transfer' })
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
    type: z.enum(['income', 'expense', 'transfer'], {
      errorMap: () => ({ message: 'Category type must be either income, expense, or transfer' })
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

export const TransactionSchemas = {
  create: z.object({
    account_id: z.string().min(1, 'Account ID is required'),
    category_id: z.string().min(1, 'Category ID is required').optional(),
    category_name: z.string().min(1, 'Category name is required').optional(),
    payment_method_id: z.string().min(1, 'Payment method ID is required').optional(),
    name: z.string()
      .min(1, 'Transaction name is required')
      .max(255, 'Transaction name must be less than 255 characters')
      .trim(),
    amount: z.number({ invalid_type_error: 'Amount must be a number' }),
    type: z.enum(['income', 'expense', 'transfer'], {
      errorMap: () => ({ message: 'Transaction type must be either income, expense, or transfer' })
    }),
    transaction_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Transaction date must be in YYYY-MM-DD format')
      .transform((val) => new Date(val)),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    tags: z.array(z.string()).optional(),
    payee: z.string().max(255, 'Payee must be less than 255 characters').optional(),
    reference_number: z.string().max(255, 'Reference number must be less than 255 characters').optional(),
    recurring_id: z.string().min(1, 'Recurring ID is required').optional()
  }),

  update: z.object({
    category_id: z.string().min(1, 'Category ID is required').optional(),
    category_name: z.string().min(1, 'Category name is required').optional(),
    payment_method_id: z.string().min(1, 'Payment method ID is required').optional(),
    name: z.string()
      .min(1, 'Transaction name is required')
      .max(255, 'Transaction name must be less than 255 characters')
      .trim()
      .optional(),
    amount: z.number({ invalid_type_error: 'Amount must be a number' }).optional(),
    type: z.enum(['income', 'expense', 'transfer'], {
      errorMap: () => ({ message: 'Transaction type must be either income, expense, or transfer' })
    }).optional(),
    transaction_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Transaction date must be in YYYY-MM-DD format')
      .transform((val) => new Date(val))
      .optional(),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    tags: z.array(z.string()).optional(),
    payee: z.string().max(255, 'Payee must be less than 255 characters').optional(),
    reference_number: z.string().max(255, 'Reference number must be less than 255 characters').optional(),
    recurring_id: z.string().min(1, 'Recurring ID is required').optional()
  })
}; 