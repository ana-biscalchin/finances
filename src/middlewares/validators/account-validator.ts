import { validateWithZod } from './zod-validator';
import { AccountSchemas } from '../../schemas/validation-schemas';

export const validateCreateAccount = validateWithZod(AccountSchemas.create);
export const validateUpdateAccount = validateWithZod(AccountSchemas.update); 