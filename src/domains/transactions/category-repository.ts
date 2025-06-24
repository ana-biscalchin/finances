import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from './types';

export class CategoryRepository {
  async create(categoryData: CreateCategoryDTO): Promise<Category> {
    const id = uuidv4();
    const now = new Date();
    
    await pool.query(
      `INSERT INTO categories (id, user_id, name, type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, categoryData.user_id, categoryData.name, categoryData.type, now, now]
    );

    const category = await this.findById(id);
    if (!category) {
      throw new Error('Failed to create category');
    }
    return category;
  }

  async findAll(): Promise<Category[]> {
    const result = await pool.query('SELECT * FROM categories');
    return result.rows as Category[];
  }

  async findById(id: string): Promise<Category | null> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [id]
    );

    const categories = result.rows as Category[];
    return categories[0] || null;
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY name',
      [userId]
    );

    return result.rows as Category[];
  }

  async findByUserIdAndType(userId: string, type: string): Promise<Category[]> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE user_id = $1 AND type = $2 ORDER BY name',
      [userId, type]
    );

    return result.rows as Category[];
  }

  async findByNameAndUserId(name: string, userId: string): Promise<Category | null> {
    const result = await pool.query(
      'SELECT * FROM categories WHERE name = $1 AND user_id = $2',
      [name, userId]
    );

    const categories = result.rows as Category[];
    return categories[0] || null;
  }

  async update(id: string, categoryData: UpdateCategoryDTO): Promise<Category | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (categoryData.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(categoryData.name);
    }
    if (categoryData.type) {
      updates.push(`type = $${paramCount++}`);
      values.push(categoryData.type);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(now);
    values.push(id);

    await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1',
      [id]
    );

    return (result.rowCount || 0) > 0;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM categories WHERE user_id = $1',
      [userId]
    );

    return (result.rowCount || 0) > 0;
  }
} 