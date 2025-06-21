import { z } from 'zod';
import { AccountSchemas } from '../../schemas/validation-schemas';

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       required:
 *         - id
 *         - user_id
 *         - institution_name
 *         - initial_balance
 *         - currency
 *         - account_type
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: string
 *           description: ID único da conta, gerado automaticamente (UUID)
 *         user_id:
 *           type: string
 *           description: ID do usuário proprietário da conta
 *         institution_name:
 *           type: string
 *           description: Nome da instituição bancária
 *         initial_balance:
 *           type: number
 *           format: decimal
 *           description: Saldo inicial da conta
 *         currency:
 *           type: string
 *           description: "Currency code (e.g., BRL, USD)"
 *         account_type:
 *           type: string
 *           description: Tipo da conta
 *           enum: [checking, savings, investment, credit_card, payment_app, cash, other]
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data e hora de criação da conta
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data e hora da última atualização da conta
 *         payment_methods:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaymentMethod'
 *           description: Métodos de pagamento associados à conta
 *       example:
 *         id: "123e4567-e89b-12d3-a456-426614174000"
 *         user_id: "456e7890-e89b-12d3-a456-426614174001"
 *         institution_name: "Banco do Brasil"
 *         initial_balance: 1000.00
 *         currency: "BRL"
 *         account_type: "checking"
 *         created_at: "2023-01-10T10:00:00Z"
 *         updated_at: "2023-01-10T10:00:00Z"
 *     PaymentMethod:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do método de pagamento
 *         name:
 *           type: string
 *           description: Nome do método de pagamento
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data e hora de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data e hora da última atualização
 *       example:
 *           id: "789e0123-e89b-12d3-a456-426614174002"
 *           name: "Cartão de Crédito"
 *           created_at: "2023-01-10T10:00:00Z"
 *           updated_at: "2023-01-10T10:00:00Z"
 */
export interface Account {
  id: string;
  user_id: string;
  institution_name: string;
  initial_balance: string;
  currency: string;
  account_type: 'checking' | 'savings' | 'investment' | 'credit_card' | 'payment_app' | 'cash' | 'other';
  created_at: Date;
  updated_at: Date;
  payment_methods?: PaymentMethod[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
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