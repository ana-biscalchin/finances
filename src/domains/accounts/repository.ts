import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { Account, CreateAccountDTO, UpdateAccountDTO, PaymentMethod } from './types';

export class AccountRepository {
    async create(accountData: CreateAccountDTO): Promise<Account> {
        const id = uuidv4();
        const now = new Date();

        await pool.query(
            'INSERT INTO accounts (id, user_id, institution_name, initial_balance, currency, account_type, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, accountData.user_id, accountData.institution_name, accountData.initial_balance, accountData.currency, accountData.account_type, now, now]
        );
        
        for (const paymentMethodId of accountData.payment_method_ids) {
            await pool.query(
                'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES ($1, $2)',
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
        const result = await pool.query('SELECT * FROM accounts');
        const accounts = result.rows;

        if (accounts.length === 0) {
            return [];
        }

        const accountIds = accounts.map(a => a.id);
        
        const paymentMethodResult = await pool.query(
            `SELECT pm.*, apm.account_id
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id = ANY($1)`,
            [accountIds]
        );

        const paymentMethodsByAccountId = paymentMethodResult.rows.reduce((acc, row) => {
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
        const result = await pool.query(
            'SELECT * FROM accounts WHERE id = $1',
            [id]
        );
        
        const accounts = result.rows;
        
        if (accounts.length === 0) {
            return null;
        }

        const account = accounts[0];

        const paymentMethodResult = await pool.query(
            `SELECT pm.*
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id = $1`,
            [id]
        );

        account.payment_methods = paymentMethodResult.rows as PaymentMethod[];

        return account;
    }

    async findByUserId(userId: string): Promise<Account[]> {
        const result = await pool.query(
            'SELECT * FROM accounts WHERE user_id = $1',
            [userId]
        );
        const accounts = result.rows;

        if (accounts.length === 0) {
            return [];
        }

        const accountIds = accounts.map(a => a.id);
        
        const paymentMethodResult = await pool.query(
            `SELECT pm.*, apm.account_id
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id = ANY($1)`,
            [accountIds]
        );

        const paymentMethodsByAccountId = paymentMethodResult.rows.reduce((acc, row) => {
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
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            const now = new Date();
            const updates: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (accountData.institution_name) {
                updates.push(`institution_name = $${paramCount++}`);
                values.push(accountData.institution_name);
            }
            if (accountData.initial_balance) {
                updates.push(`initial_balance = $${paramCount++}`);
                values.push(accountData.initial_balance);
            }
            if (accountData.currency) {
                updates.push(`currency = $${paramCount++}`);
                values.push(accountData.currency);
            }
            if (accountData.account_type) {
                updates.push(`account_type = $${paramCount++}`);
                values.push(accountData.account_type);
            }

            let somethingChanged = updates.length > 0;

            if (accountData.payment_method_ids) {
                somethingChanged = true;
                await client.query('DELETE FROM account_payment_methods WHERE account_id = $1', [id]);
                for (const paymentMethodId of accountData.payment_method_ids) {
                    await client.query(
                        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES ($1, $2)',
                        [id, paymentMethodId]
                    );
                }
            }

            if (somethingChanged) {
                updates.push(`updated_at = $${paramCount++}`);
                values.push(now);
                
                const setClause = updates.join(', ');
                if (updates.length > 1) { // More than just updated_at
                    await client.query(
                        `UPDATE accounts SET ${setClause} WHERE id = $${paramCount}`,
                        [...values, id]
                    );
                } else {
                    await client.query(`UPDATE accounts SET updated_at = $1 WHERE id = $2`, [now, id]);
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = await pool.query(
            'DELETE FROM accounts WHERE id = $1',
            [id]
        );
        return (result.rowCount || 0) > 0;
    }
}