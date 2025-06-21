import { validateWithZod } from './zod-validator';
import { CategorySchemas } from '../../schemas/validation-schemas';

export const validateCreateCategory = validateWithZod(CategorySchemas.create);
export const validateUpdateCategory = validateWithZod(CategorySchemas.update); 