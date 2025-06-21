import { Request, Response, NextFunction } from 'express';
import { validateWithZod } from './zod-validator';
import { PaymentMethodSchemas, AccountPaymentMethodSchemas } from '../../schemas/validation-schemas';

export const validateCreatePaymentMethod = validateWithZod(PaymentMethodSchemas.create);
export const validateUpdatePaymentMethod = validateWithZod(PaymentMethodSchemas.update);
export const validateAssociatePaymentMethod = validateWithZod(AccountPaymentMethodSchemas.create);