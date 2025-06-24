import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { User, CreateUserDTO, UpdateUserDTO } from './types';

export class UserRepository {
  async create(userData: CreateUserDTO): Promise<User> {
    const id = uuidv4();
    const now = new Date();
    
    await pool.query(
      `INSERT INTO users (id, name, email, default_currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userData.name, userData.email, userData.default_currency, now, now]
    );

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    const result = await pool.query('SELECT * FROM users');
    return result.rows as User[];
  }

  async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    const users = result.rows as User[];
    return users[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const users = result.rows as User[];
    return users[0] || null;
  }

  async update(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userData.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(userData.name);
    }
    if (userData.email) {
      updates.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.default_currency) {
      updates.push(`default_currency = $${paramCount++}`);
      values.push(userData.default_currency);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(now);
    values.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    return (result.rowCount || 0) > 0;
  }
} 