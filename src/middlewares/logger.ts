import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../domains/users/repository';

export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (body) {
    const duration = Date.now() - start;
    console.log('\n=== REQUEST LOG ===');
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.log(`Status: ${res.statusCode} - Duration: ${duration}ms`);
    
    if (Object.keys(req.body).length > 0) {
      console.log('\nRequest Body:', JSON.stringify(req.body, null, 2));
    }
    if (Object.keys(req.query).length > 0) {
      console.log('\nQuery Parameters:', JSON.stringify(req.query, null, 2));
    }
    if (Object.keys(req.params).length > 0) {
      console.log('\nRoute Parameters:', JSON.stringify(req.params, null, 2));
    }

    try {
      if (typeof body === 'string') {
        const responseBody = JSON.parse(body);
        console.log('\nResponse Body:', JSON.stringify(responseBody, null, 2));
      } else {
        console.log('\nResponse Body:', body);
      }
    } catch (e) {
      console.log('\nResponse Body:', body);
    }

    console.log('=== END REQUEST LOG ===\n');
    return originalSend.call(this, body);
  };

  next();
} 