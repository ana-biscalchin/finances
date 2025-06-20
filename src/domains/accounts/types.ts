import { z } from 'zod';
import { AccountSchemas } from '../../schemas/validation-schemas';

export interface Account {
  id: string;
  user_id: string;
  institution_name: string;
  initial_balance: number;
  currency: string;
  account_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  name: string;
}

export interface AccountPaymentMethod {
  account_id: string;
  payment_method_id: string;
}

export type CreateAccountDTO = z.infer<typeof AccountSchemas.create>;
export type UpdateAccountDTO = z.infer<typeof AccountSchemas.update>;

export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  INVESTMENT = 'investment',
  CREDIT_CARD = 'credit_card',
  PAYMENT_APP = 'payment_app',
  CASH = 'cash',
  OTHER = 'other'
}