import { validateWithZod } from './zod-validator';
import { UserSchemas } from '../../schemas/validation-schemas';

export const validateCreateUser = validateWithZod(UserSchemas.create);
export const validateUpdateUser = validateWithZod(UserSchemas.update); 