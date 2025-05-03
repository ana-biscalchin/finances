import { Request, Response, NextFunction } from 'express';
import { CreateUserDTO, UpdateUserDTO } from '../../domains/users/types';

const isValidCurrency = (currency: string): boolean => {
  return /^[A-Z]{3}$/.test(currency);
};

export const validateCreateUser = (req: Request, res: Response, next: NextFunction) => {
  const userData: CreateUserDTO = req.body;

  if (!userData.name || !userData.email || !userData.default_currency) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!isValidCurrency(userData.default_currency)) {
    return res.status(400).json({ message: 'Invalid currency code' });
  }

  next();
};

export const validateUpdateUser = (req: Request, res: Response, next: NextFunction) => {
  const userData: UpdateUserDTO = req.body;

  if (userData.default_currency && !isValidCurrency(userData.default_currency)) {
    return res.status(400).json({ message: 'Invalid currency code' });
  }

  next();
}; 