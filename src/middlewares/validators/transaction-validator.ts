import { TransactionSchemas } from '../../schemas/validation-schemas';
import { validateWithZod } from './zod-validator';

export const validateCreateTransaction = validateWithZod(TransactionSchemas.create);
export const validateUpdateTransaction = validateWithZod(TransactionSchemas.update); 