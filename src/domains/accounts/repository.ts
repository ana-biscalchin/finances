import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Account, CreateAccountDTO, UpdateAccountDTO } from './types';

export class AccountRepository {
    async create(accountData: CreateAccountDTO): Promise<Account> {
        const id = uuidv4();
        const now = new Date();

        await pool.execute(
            'INSERT INTO accounts (id, user_id, institution_name, initial_balance, currency, account_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, accountData.user_id, accountData.institution_name, accountData.initial_balance, accountData.currency, accountData.account_type, now, now]
        );
        
        for (const paymentMethodId of accountData.payment_method_ids) {
            await pool.execute(
                'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
                [id, paymentMethodId]
            );
        }
        
        const account = await this.findById(id);
        if (!account) {
            throw new Error('Failed to create account');
        }
        
        return account;
    }

    async findAll(): Promise<Account[]> {
        const [rows] = await pool.execute('SELECT * FROM accounts');
        return rows as Account[];
    }

    async findById(id: string): Promise<Account | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM accounts WHERE id = ?',
            [id]
        );
        
        const accounts = rows as Account[];
        return accounts[0] || null;
    }

    async findByUserId(userId: string): Promise<Account[] | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM accounts WHERE user_id = ?',
            [userId]
        );

        return rows as Account[];
    }

    async update(id: string, accountData: UpdateAccountDTO): Promise<Account | null> {
        const now = new Date();
        const updates: string[] = [];
        const values: any[] = [];

        if (accountData.institution_name) {
            updates.push('institution_name = ?');
            values.push(accountData.institution_name);
        }
        if (accountData.initial_balance) {
            updates.push('initial_balance = ?');
            values.push(accountData.initial_balance);
        }
        if (accountData.currency) {
            updates.push('currency = ?');
            values.push(accountData.currency);
        }
        if (accountData.account_type) {
            updates.push('account_type = ?');
            values.push(accountData.account_type);
        }

        if (updates.length === 0) {
            return this.findById(id);
        }

        updates.push('updated_at = ?');
        values.push(now);
        values.push(id);

        await pool.execute(
            `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM accounts WHERE id = ?',
            [id]
        );
        return (result as any).affectedRows > 0;
    }
}