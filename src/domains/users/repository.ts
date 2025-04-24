import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { User, CreateUserDTO, UpdateUserDTO } from './types';

export class UserRepository {
  async create(userData: CreateUserDTO): Promise<User> {
    const id = uuidv4();
    const now = new Date();
    
    await pool.execute(
      `INSERT INTO users (id, name, email, default_currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userData.name, userData.email, userData.default_currency, now, now]
    );

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    const users = rows as User[];
    return users[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const users = rows as User[];
    return users[0] || null;
  }

  async update(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.name) {
      updates.push('name = ?');
      values.push(userData.name);
    }
    if (userData.email) {
      updates.push('email = ?');
      values.push(userData.email);
    }
    if (userData.default_currency) {
      updates.push('default_currency = ?');
      values.push(userData.default_currency);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    return (result as any).affectedRows > 0;
  }
} 