import { z } from 'zod';

export const UserSchemas = {
  create: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    default_currency: z.string().regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters')
  }),

  update: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    email: z.string().email('Invalid email').optional(),
    default_currency: z.string().regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters').optional()
  })
};

export const AccountSchemas = {
  create: z.object({
    user_id: z.string().min(1, 'User ID is required'),
    institution_name: z.string().min(1, 'Institution name is required'),
    initial_balance: z.number({ invalid_type_error: 'Initial balance must be a number' }),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters'),
    account_type: z.enum(['checking', 'savings', 'investment', 'credit_card', 'payment_app', 'cash', 'other'], {
      errorMap: () => ({ message: 'Invalid account type' })
    }),
    payment_method_ids: z.array(z.string()).min(1, 'At least one payment method is required')
  }),

  update: z.object({
    institution_name: z.string().min(1, 'Institution name is required').optional(),
    initial_balance: z.number({ invalid_type_error: 'Initial balance must be a number' }).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters').optional(),
    account_type: z.enum(['checking', 'savings', 'investment', 'credit_card', 'payment_app', 'cash', 'other'], {
      errorMap: () => ({ message: 'Invalid account type' })
    }).optional()
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
    account_id: z.string().min(1, 'Account ID is required'),
    payment_method_id: z.string().min(1, 'Payment method ID is required')
  })
}; 