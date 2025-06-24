import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

export function dbLogger(req: Request, res: Response, next: NextFunction) {
  const executeWithLogging = async function (sql: string, params: any[]) {
    const start = Date.now();
    console.log('\n=== DATABASE QUERY LOG ===');
    console.log(`[${new Date().toISOString()}] SQL Query: ${sql}`);
    console.log('Parameters:', params);
   
    try {
      const result = await pool.query(sql, params);
      const duration = Date.now() - start;
      console.log(`Query Duration: ${duration}ms`);
      console.log('Result Rows:', JSON.stringify(result.rows, null, 2));
      console.log('=== END DATABASE QUERY LOG ===\n');
      return result;
    } catch (error) {
      console.error('Query Error:', error);
      console.log('=== END DATABASE QUERY LOG ===\n');
      throw error;
    }
  };

  next();
} 