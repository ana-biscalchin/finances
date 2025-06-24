import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from './types';

export class TransactionRepository {
  async create(transactionData: CreateTransactionDTO): Promise<Transaction> {
    const id = uuidv4();
    const now = new Date();
    
    const tags = transactionData.tags ? JSON.stringify(transactionData.tags) : null;
    
    await pool.query(
      `INSERT INTO transactions (
        id, account_id, payment_method_id, category_id, name, description, 
        amount, transaction_type, payee, transaction_date, reference_number, 
        tags, recurring_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, 
        transactionData.account_id, 
        transactionData.payment_method_id || null, 
        transactionData.category_id || null, 
        transactionData.name, 
        transactionData.description || null,
        transactionData.amount, 
        transactionData.type, 
        transactionData.payee || null,
        transactionData.transaction_date, 
        transactionData.reference_number || null,
        tags, 
        transactionData.recurring_id || null, 
        now, 
        now
      ]
    );

    const transaction = await this.findById(id);
    if (!transaction) {
      throw new Error('Failed to create transaction');
    }
    return transaction;
  }

  async findAll(): Promise<Transaction[]> {
    const result = await pool.query('SELECT * FROM transactions ORDER BY transaction_date DESC');
    return result.rows as Transaction[];
  }

  async findById(id: string): Promise<Transaction | null> {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [id]
    );

    const transactions = result.rows as Transaction[];
    return transactions[0] || null;
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE account_id = $1 ORDER BY transaction_date DESC',
      [accountId]
    );

    return result.rows as Transaction[];
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return result.rows as Transaction[];
  }

  async findWithFilters(filters: TransactionFilters): Promise<Transaction[]> {
    let query = `
      SELECT t.* FROM transactions t
      INNER JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramCount = 1;

    if (filters.account_id) {
      query += ` AND t.account_id = $${paramCount++}`;
      values.push(filters.account_id);
    }

    if (filters.category_id) {
      query += ` AND t.category_id = $${paramCount++}`;
      values.push(filters.category_id);
    }

    if (filters.payment_method_id) {
      query += ` AND t.payment_method_id = $${paramCount++}`;
      values.push(filters.payment_method_id);
    }

    if (filters.type) {
      query += ` AND t.type = $${paramCount++}`;
      values.push(filters.type);
    }

    if (filters.start_date) {
      query += ` AND t.transaction_date >= $${paramCount++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND t.transaction_date <= $${paramCount++}`;
      values.push(filters.end_date);
    }

    if (filters.min_amount) {
      query += ` AND t.amount >= $${paramCount++}`;
      values.push(filters.min_amount);
    }

    if (filters.max_amount) {
      query += ` AND t.amount <= $${paramCount++}`;
      values.push(filters.max_amount);
    }

    if (filters.search) {
      query += ` AND (t.name ILIKE $${paramCount++} OR t.description ILIKE $${paramCount++} OR t.payee ILIKE $${paramCount++})`;
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.transaction_date DESC';

    const result = await pool.query(query, values);
    return result.rows as Transaction[];
  }

  async findByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE account_id = $1 AND transaction_date BETWEEN $2 AND $3 ORDER BY transaction_date DESC',
      [accountId, startDate, endDate]
    );

    return result.rows as Transaction[];
  }

  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 AND t.transaction_date BETWEEN $2 AND $3
       ORDER BY t.transaction_date DESC`,
      [userId, startDate, endDate]
    );

    return result.rows as Transaction[];
  }

  async findByCurrentMonth(accountId: string): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE) 
       AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    return result.rows as Transaction[];
  }

  async findByCurrentMonthForUser(userId: string): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 
       AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE) 
       AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return result.rows as Transaction[];
  }

  async findByCurrentYear(accountId: string): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    return result.rows as Transaction[];
  }

  async findByCurrentYearForUser(userId: string): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 
       AND EXTRACT(YEAR FROM t.transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return result.rows as Transaction[];
  }

  async findByLastNDays(accountId: string, days: number): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND transaction_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    return result.rows as Transaction[];
  }

  async findByLastNDaysForUser(userId: string, days: number): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 
       AND t.transaction_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return result.rows as Transaction[];
  }

  async findByMonthAndYear(accountId: string, month: number, year: number): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND EXTRACT(YEAR FROM transaction_date) = $2 
       AND EXTRACT(MONTH FROM transaction_date) = $3
       ORDER BY transaction_date DESC`,
      [accountId, year, month]
    );

    return result.rows as Transaction[];
  }

  async findByMonthAndYearForUser(userId: string, month: number, year: number): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 
       AND EXTRACT(YEAR FROM t.transaction_date) = $2 
       AND EXTRACT(MONTH FROM t.transaction_date) = $3
       ORDER BY t.transaction_date DESC`,
      [userId, year, month]
    );

    return result.rows as Transaction[];
  }

  async findByWeek(accountId: string, startOfWeek: Date, endOfWeek: Date): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE account_id = $1 
       AND transaction_date BETWEEN $2 AND $3
       ORDER BY transaction_date DESC`,
      [accountId, startOfWeek, endOfWeek]
    );

    return result.rows as Transaction[];
  }

  async findByWeekForUser(userId: string, startOfWeek: Date, endOfWeek: Date): Promise<Transaction[]> {
    const result = await pool.query(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = $1 
       AND t.transaction_date BETWEEN $2 AND $3
       ORDER BY t.transaction_date DESC`,
      [userId, startOfWeek, endOfWeek]
    );

    return result.rows as Transaction[];
  }

  async update(id: string, transactionData: UpdateTransactionDTO): Promise<Transaction | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (transactionData.payment_method_id !== undefined) {
      updates.push(`payment_method_id = $${paramCount++}`);
      values.push(transactionData.payment_method_id);
    }
    if (transactionData.category_id !== undefined) {
      updates.push(`category_id = $${paramCount++}`);
      values.push(transactionData.category_id);
    }
    if (transactionData.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(transactionData.name);
    }
    if (transactionData.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(transactionData.description);
    }
    if (transactionData.amount) {
      updates.push(`amount = $${paramCount++}`);
      values.push(transactionData.amount);
    }
    if (transactionData.type) {
      updates.push(`type = $${paramCount++}`);
      values.push(transactionData.type);
    }
    if (transactionData.payee !== undefined) {
      updates.push(`payee = $${paramCount++}`);
      values.push(transactionData.payee);
    }
    if (transactionData.transaction_date) {
      updates.push(`transaction_date = $${paramCount++}`);
      values.push(transactionData.transaction_date);
    }
    if (transactionData.reference_number !== undefined) {
      updates.push(`reference_number = $${paramCount++}`);
      values.push(transactionData.reference_number);
    }
    if (transactionData.tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(transactionData.tags ? JSON.stringify(transactionData.tags) : null);
    }
    if (transactionData.recurring_id !== undefined) {
      updates.push(`recurring_id = $${paramCount++}`);
      values.push(transactionData.recurring_id);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(now);
    values.push(id);

    await pool.query(
      `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1',
      [id]
    );

    return (result.rowCount || 0) > 0;
  }

  async deleteByAccountId(accountId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM transactions WHERE account_id = $1',
      [accountId]
    );

    return (result.rowCount || 0) > 0;
  }

  async getBalanceByAccountId(accountId: string): Promise<number> {
    const result = await pool.query(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id
       WHERE a.id = $1
       GROUP BY a.id, a.initial_balance`,
      [accountId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Account not found');
    }
    
    return row.initial_balance + row.total_income - row.total_expense;
  }

  async getBalanceDetailsByAccountId(accountId: string): Promise<{
    initial_balance: number;
    total_income: number;
    total_expense: number;
    current_balance: number;
  }> {
    const result = await pool.query(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id
       WHERE a.id = $1
       GROUP BY a.id, a.initial_balance`,
      [accountId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Account not found');
    }
    
    const currentBalance = row.initial_balance + row.total_income - row.total_expense;
    
    return {
      initial_balance: row.initial_balance,
      total_income: row.total_income,
      total_expense: row.total_expense,
      current_balance: currentBalance
    };
  }

  async getBalanceByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await pool.query(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id AND t.transaction_date BETWEEN $2 AND $3
       WHERE a.id = $1
       GROUP BY a.id, a.initial_balance`,
      [accountId, startDate, endDate]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Account not found');
    }
    
    return row.initial_balance + row.total_income - row.total_expense;
  }

  async getTransactionsByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE account_id = $1 AND transaction_date BETWEEN $2 AND $3 ORDER BY transaction_date DESC',
      [accountId, startDate, endDate]
    );

    return result.rows as Transaction[];
  }
} 