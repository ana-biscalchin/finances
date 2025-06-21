import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Account, CreateAccountDTO, UpdateAccountDTO, PaymentMethod } from './types';
import { RowDataPacket } from 'mysql2';

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
        const [accounts] = await pool.query<RowDataPacket[]>('SELECT * FROM accounts');

        if (accounts.length === 0) {
            return [];
        }

        const accountIds = accounts.map(a => a.id);
        
        const [paymentMethodRows] = await pool.query<RowDataPacket[]>(
            `SELECT pm.*, apm.account_id
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id IN (?)`,
            [accountIds]
        );

        const paymentMethodsByAccountId = paymentMethodRows.reduce((acc, row) => {
            const accountId = row.account_id;
            if (!acc[accountId]) {
                acc[accountId] = [];
            }
            delete row.account_id;
            acc[accountId].push(row as PaymentMethod);
            return acc;
        }, {} as Record<string, PaymentMethod[]>);

        for (const account of accounts) {
            account.payment_methods = paymentMethodsByAccountId[account.id] || [];
        }

        return accounts as Account[];
    }

    async findById(id: string): Promise<Account | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM accounts WHERE id = ?',
            [id]
        );
        
        const accounts = rows as Account[];
        
        if (accounts.length === 0) {
            return null;
        }

        const account = accounts[0];

        const [paymentMethodRows] = await pool.execute(
            `SELECT pm.*
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id = ?`,
            [id]
        );

        account.payment_methods = paymentMethodRows as PaymentMethod[];

        return account;
    }

    async findByUserId(userId: string): Promise<Account[]> {
        const [accounts] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM accounts WHERE user_id = ?',
            [userId]
        );

        if (accounts.length === 0) {
            return [];
        }

        const accountIds = accounts.map(a => a.id);
        
        const [paymentMethodRows] = await pool.query<RowDataPacket[]>(
            `SELECT pm.*, apm.account_id
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id IN (?)`,
            [accountIds]
        );

        const paymentMethodsByAccountId = paymentMethodRows.reduce((acc, row) => {
            const accountId = row.account_id;
            if (!acc[accountId]) {
                acc[accountId] = [];
            }
            delete row.account_id;
            acc[accountId].push(row as PaymentMethod);
            return acc;
        }, {} as Record<string, PaymentMethod[]>);

        for (const account of accounts) {
            account.payment_methods = paymentMethodsByAccountId[account.id] || [];
        }

        return accounts as Account[];
    }

    async update(id: string, accountData: UpdateAccountDTO): Promise<Account | null> {
        const conn = await pool.getConnection();
        
        try {
            await conn.beginTransaction();
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

            let somethingChanged = updates.length > 0;

            if (accountData.payment_method_ids) {
                somethingChanged = true;
                await conn.execute('DELETE FROM account_payment_methods WHERE account_id = ?', [id]);
                for (const paymentMethodId of accountData.payment_method_ids) {
                    await conn.execute(
                        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
                        [id, paymentMethodId]
                    );
                }
            }

            if (somethingChanged) {
                updates.push('updated_at = ?');
                values.push(now);
                
                const setClause = updates.join(', ');
                if (updates.length > 1) { // More than just updated_at
                    await conn.execute(
                        `UPDATE accounts SET ${setClause} WHERE id = ?`,
                        [...values, id]
                    );
                } else {
                    await conn.execute(`UPDATE accounts SET updated_at = ? WHERE id = ?`, [now, id]);
                }
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

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