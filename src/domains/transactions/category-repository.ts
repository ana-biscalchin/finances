import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from './types';

export class CategoryRepository {
  async create(categoryData: CreateCategoryDTO): Promise<Category> {
    const id = uuidv4();
    const now = new Date();
    
    await pool.execute(
      `INSERT INTO categories (id, user_id, name, type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, categoryData.user_id, categoryData.name, categoryData.type, now, now]
    );

    const category = await this.findById(id);
    if (!category) {
      throw new Error('Failed to create category');
    }
    return category;
  }

  async findAll(): Promise<Category[]> {
    const [rows] = await pool.execute('SELECT * FROM categories');
    return rows as Category[];
  }

  async findById(id: string): Promise<Category | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    const categories = rows as Category[];
    return categories[0] || null;
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY name',
      [userId]
    );

    return rows as Category[];
  }

  async findByUserIdAndType(userId: string, type: string): Promise<Category[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE user_id = ? AND type = ? ORDER BY name',
      [userId, type]
    );

    return rows as Category[];
  }

  async findByNameAndUserId(name: string, userId: string): Promise<Category | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM categories WHERE name = ? AND user_id = ?',
      [name, userId]
    );

    const categories = rows as Category[];
    return categories[0] || null;
  }

  async update(id: string, categoryData: UpdateCategoryDTO): Promise<Category | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];

    if (categoryData.name) {
      updates.push('name = ?');
      values.push(categoryData.name);
    }
    if (categoryData.type) {
      updates.push('type = ?');
      values.push(categoryData.type);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await pool.execute(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );

    return (result as any).affectedRows > 0;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM categories WHERE user_id = ?',
      [userId]
    );

    return (result as any).affectedRows > 0;
  }
} 