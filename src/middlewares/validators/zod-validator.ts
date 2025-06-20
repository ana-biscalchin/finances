import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateWithZod(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errorMessage = result.error.errors[0]?.message || 'Validation failed';
      return res.status(400).json({ message: errorMessage });
    }
    
    req.body = result.data;
    next();
  };
} 