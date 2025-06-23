import { z } from 'zod';
import { UserSchemas, AccountSchemas, PaymentMethodSchemas, CategorySchemas, TransactionSchemas } from '../../schemas/validation-schemas';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color?: string;
  icon?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id?: string;
  category_name?: string;
  payment_method_id?: string;
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  transaction_date: Date;
  description?: string;
  tags?: string[];
  payee?: string;
  reference_number?: string;
  recurring_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionFilters {
  account_id?: string;
  category_id?: string;
  type?: 'income' | 'expense' | 'transfer';
  start_date?: Date;
  end_date?: Date;
  min_amount?: number;
  max_amount?: number;
  payment_method_id?: string;
  tags?: string[];
  search?: string;
}

export type CreateTransactionDTO = {
  account_id: string;
  category_id?: string | null;
  category_name?: string | null;
  payment_method_id?: string | null;
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  transaction_date: Date;
  description?: string | null;
  tags?: string[] | null;
  payee?: string | null;
  reference_number?: string | null;
  recurring_id?: string | null;
};

export type UpdateTransactionDTO = {
  category_id?: string;
  category_name?: string;
  payment_method_id?: string;
  name?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  transaction_date?: Date;
  description?: string;
  tags?: string[];
  payee?: string;
  reference_number?: string;
  recurring_id?: string;
};

export type CreateCategoryDTO = z.infer<typeof CategorySchemas.create>;
export type UpdateCategoryDTO = z.infer<typeof CategorySchemas.update>;
export type CreateTransactionSchemaDTO = z.infer<typeof TransactionSchemas.create>;
export type UpdateTransactionSchemaDTO = z.infer<typeof TransactionSchemas.update>; 