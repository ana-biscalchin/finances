import { Request, Response, NextFunction } from 'express';
import { PaymentMethodSchemas, AccountPaymentMethodSchemas } from '../../schemas/validation-schemas';
import { validateWithZod } from '../../utils/validate-with-zod';

export const validateCreatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    validateWithZod(PaymentMethodSchemas.create, req.body, res, next, 'Invalid payment method data');
};

export const validateUpdatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    validateWithZod(PaymentMethodSchemas.update, req.body, res, next, 'Invalid payment method data');
};

export const validateAssociatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    validateWithZod(AccountPaymentMethodSchemas.create, req.body, res, next, 'Invalid association data');
};