import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Transaction, CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from './types';

export class TransactionRepository {
  async create(transactionData: CreateTransactionDTO): Promise<Transaction> {
    const id = uuidv4();
    const now = new Date();
    
    const tags = transactionData.tags ? JSON.stringify(transactionData.tags) : null;
    
    await pool.execute(
      `INSERT INTO transactions (
        id, account_id, payment_method_id, category_id, name, description, 
        amount, transaction_type, payee, transaction_date, reference_number, 
        tags, recurring_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const [rows] = await pool.execute('SELECT * FROM transactions ORDER BY transaction_date DESC');
    return rows as Transaction[];
  }

  async findById(id: string): Promise<Transaction | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );

    const transactions = rows as Transaction[];
    return transactions[0] || null;
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE account_id = ? ORDER BY transaction_date DESC',
      [accountId]
    );

    return rows as Transaction[];
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ?
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return rows as Transaction[];
  }

  async findWithFilters(filters: TransactionFilters): Promise<Transaction[]> {
    let query = `
      SELECT t.* FROM transactions t
      INNER JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (filters.account_id) {
      query += ' AND t.account_id = ?';
      values.push(filters.account_id);
    }

    if (filters.category_id) {
      query += ' AND t.category_id = ?';
      values.push(filters.category_id);
    }

    if (filters.payment_method_id) {
      query += ' AND t.payment_method_id = ?';
      values.push(filters.payment_method_id);
    }

    if (filters.type) {
      query += ' AND t.type = ?';
      values.push(filters.type);
    }

    if (filters.start_date) {
      query += ' AND t.transaction_date >= ?';
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND t.transaction_date <= ?';
      values.push(filters.end_date);
    }

    if (filters.min_amount) {
      query += ' AND t.amount >= ?';
      values.push(filters.min_amount);
    }

    if (filters.max_amount) {
      query += ' AND t.amount <= ?';
      values.push(filters.max_amount);
    }

    if (filters.search) {
      query += ' AND (t.name LIKE ? OR t.description LIKE ? OR t.payee LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.transaction_date DESC';

    const [rows] = await pool.execute(query, values);
    return rows as Transaction[];
  }

  async findByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE account_id = ? AND transaction_date BETWEEN ? AND ? ORDER BY transaction_date DESC',
      [accountId, startDate, endDate]
    );

    return rows as Transaction[];
  }

  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? AND t.transaction_date BETWEEN ? AND ?
       ORDER BY t.transaction_date DESC`,
      [userId, startDate, endDate]
    );

    return rows as Transaction[];
  }

  async findByCurrentMonth(accountId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions 
       WHERE account_id = ? 
       AND YEAR(transaction_date) = YEAR(CURDATE()) 
       AND MONTH(transaction_date) = MONTH(CURDATE())
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    return rows as Transaction[];
  }

  async findByCurrentMonthForUser(userId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? 
       AND YEAR(t.transaction_date) = YEAR(CURDATE()) 
       AND MONTH(t.transaction_date) = MONTH(CURDATE())
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return rows as Transaction[];
  }

  async findByCurrentYear(accountId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions 
       WHERE account_id = ? 
       AND YEAR(transaction_date) = YEAR(CURDATE())
       ORDER BY transaction_date DESC`,
      [accountId]
    );

    return rows as Transaction[];
  }

  async findByCurrentYearForUser(userId: string): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? 
       AND YEAR(t.transaction_date) = YEAR(CURDATE())
       ORDER BY t.transaction_date DESC`,
      [userId]
    );

    return rows as Transaction[];
  }

  async findByLastNDays(accountId: string, days: number): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions 
       WHERE account_id = ? 
       AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY transaction_date DESC`,
      [accountId, days]
    );

    return rows as Transaction[];
  }

  async findByLastNDaysForUser(userId: string, days: number): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? 
       AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY t.transaction_date DESC`,
      [userId, days]
    );

    return rows as Transaction[];
  }

  async findByMonthAndYear(accountId: string, month: number, year: number): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions 
       WHERE account_id = ? 
       AND YEAR(transaction_date) = ? 
       AND MONTH(transaction_date) = ?
       ORDER BY transaction_date DESC`,
      [accountId, year, month]
    );

    return rows as Transaction[];
  }

  async findByMonthAndYearForUser(userId: string, month: number, year: number): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? 
       AND YEAR(t.transaction_date) = ? 
       AND MONTH(t.transaction_date) = ?
       ORDER BY t.transaction_date DESC`,
      [userId, year, month]
    );

    return rows as Transaction[];
  }

  async findByWeek(accountId: string, startOfWeek: Date, endOfWeek: Date): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM transactions 
       WHERE account_id = ? 
       AND transaction_date BETWEEN ? AND ?
       ORDER BY transaction_date DESC`,
      [accountId, startOfWeek, endOfWeek]
    );

    return rows as Transaction[];
  }

  async findByWeekForUser(userId: string, startOfWeek: Date, endOfWeek: Date): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      `SELECT t.* FROM transactions t
       INNER JOIN accounts a ON t.account_id = a.id
       WHERE a.user_id = ? 
       AND t.transaction_date BETWEEN ? AND ?
       ORDER BY t.transaction_date DESC`,
      [userId, startOfWeek, endOfWeek]
    );

    return rows as Transaction[];
  }

  async update(id: string, transactionData: UpdateTransactionDTO): Promise<Transaction | null> {
    const now = new Date();
    const updates: string[] = [];
    const values: any[] = [];

    if (transactionData.payment_method_id !== undefined) {
      updates.push('payment_method_id = ?');
      values.push(transactionData.payment_method_id);
    }
    if (transactionData.category_id !== undefined) {
      updates.push('category_id = ?');
      values.push(transactionData.category_id);
    }
    if (transactionData.name) {
      updates.push('name = ?');
      values.push(transactionData.name);
    }
    if (transactionData.description !== undefined) {
      updates.push('description = ?');
      values.push(transactionData.description);
    }
    if (transactionData.amount) {
      updates.push('amount = ?');
      values.push(transactionData.amount);
    }
    if (transactionData.type) {
      updates.push('type = ?');
      values.push(transactionData.type);
    }
    if (transactionData.payee !== undefined) {
      updates.push('payee = ?');
      values.push(transactionData.payee);
    }
    if (transactionData.transaction_date) {
      updates.push('transaction_date = ?');
      values.push(transactionData.transaction_date);
    }
    if (transactionData.reference_number !== undefined) {
      updates.push('reference_number = ?');
      values.push(transactionData.reference_number);
    }
    if (transactionData.tags !== undefined) {
      updates.push('tags = ?');
      values.push(transactionData.tags ? JSON.stringify(transactionData.tags) : null);
    }
    if (transactionData.recurring_id !== undefined) {
      updates.push('recurring_id = ?');
      values.push(transactionData.recurring_id);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await pool.execute(
      `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM transactions WHERE id = ?',
      [id]
    );

    return (result as any).affectedRows > 0;
  }

  async deleteByAccountId(accountId: string): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM transactions WHERE account_id = ?',
      [accountId]
    );

    return (result as any).affectedRows > 0;
  }

  async getBalanceByAccountId(accountId: string): Promise<number> {
    const [rows] = await pool.execute(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id
       WHERE a.id = ?
       GROUP BY a.id, a.initial_balance`,
      [accountId]
    );

    const result = (rows as any)[0];
    if (!result) {
      throw new Error('Account not found');
    }
    
    return result.initial_balance + result.total_income - result.total_expense;
  }

  async getBalanceDetailsByAccountId(accountId: string): Promise<{
    initial_balance: number;
    total_income: number;
    total_expense: number;
    current_balance: number;
  }> {
    const [rows] = await pool.execute(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id
       WHERE a.id = ?
       GROUP BY a.id, a.initial_balance`,
      [accountId]
    );

    const result = (rows as any)[0];
    if (!result) {
      throw new Error('Account not found');
    }
    
    const currentBalance = result.initial_balance + result.total_income - result.total_expense;
    
    return {
      initial_balance: result.initial_balance,
      total_income: result.total_income,
      total_expense: result.total_expense,
      current_balance: currentBalance
    };
  }

  async getBalanceByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<number> {
    const [rows] = await pool.execute(
      `SELECT 
        a.initial_balance,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
       FROM accounts a
       LEFT JOIN transactions t ON a.id = t.account_id AND t.transaction_date BETWEEN ? AND ?
       WHERE a.id = ?
       GROUP BY a.id, a.initial_balance`,
      [startDate, endDate, accountId]
    );

    const result = (rows as any)[0];
    if (!result) {
      throw new Error('Account not found');
    }
    
    return result.initial_balance + result.total_income - result.total_expense;
  }

  async getTransactionsByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM transactions WHERE account_id = ? AND transaction_date BETWEEN ? AND ? ORDER BY transaction_date DESC',
      [accountId, startDate, endDate]
    );

    return rows as Transaction[];
  }
} 