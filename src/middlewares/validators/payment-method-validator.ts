import { Request, Response, NextFunction } from 'express';
import { PaymentMethodSchemas, AccountPaymentMethodSchemas } from '../../schemas/validation-schemas';

export const validateCreatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    try {
        PaymentMethodSchemas.create.parse(req.body);
        next();
    } catch {
        res.status(400).json({ error: 'Invalid payment method data' });
    }
};

export const validateUpdatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    try {
        PaymentMethodSchemas.update.parse(req.body);
        next();
    } catch {
        res.status(400).json({ error: 'Invalid payment method data' });
    }
};

export const validateAssociatePaymentMethod = (req: Request, res: Response, next: NextFunction) => {
    try {
        AccountPaymentMethodSchemas.create.parse(req.body);
        next();
    } catch {
        res.status(400).json({ error: 'Invalid association data' });
    }
};