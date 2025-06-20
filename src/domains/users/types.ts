import { z } from 'zod';
import { UserSchemas } from '../../schemas/validation-schemas';

export interface User {
  id: string;
  name: string;
  email: string;
  default_currency: string;
  created_at: Date;
  updated_at: Date;
}

export type CreateUserDTO = z.infer<typeof UserSchemas.create>;
export type UpdateUserDTO = z.infer<typeof UserSchemas.update>; 