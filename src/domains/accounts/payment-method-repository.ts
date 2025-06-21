import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { PaymentMethod, AccountPaymentMethod } from './types';

export class PaymentMethodRepository {
    async create(name: string): Promise<PaymentMethod> {
        const id = uuidv4();

        await pool.execute(
            'INSERT INTO payment_methods (id, name) VALUES (?, ?)',
            [id, name]
        );
        
        const paymentMethod = await this.findById(id);
        if (!paymentMethod) {
            throw new Error('Failed to create payment method');
        }
        
        return paymentMethod;
    }

    async findById(id: string): Promise<PaymentMethod | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM payment_methods WHERE id = ?',
            [id]
        );
        
        const paymentMethods = rows as PaymentMethod[];
        return paymentMethods[0] || null;
    }

    async findByName(name: string): Promise<PaymentMethod | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM payment_methods WHERE name = ?',
            [name]
        );
        
        const paymentMethods = rows as PaymentMethod[];
        return paymentMethods[0] || null;
    }

    async findAll(): Promise<PaymentMethod[]> {
        const [rows] = await pool.execute('SELECT * FROM payment_methods ORDER BY name');
        return rows as PaymentMethod[];
    }

    async update(id: string, name: string): Promise<PaymentMethod | null> {
        await pool.execute(
            'UPDATE payment_methods SET name = ? WHERE id = ?',
            [name, id]
        );

        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const [result] = await pool.execute(
            'DELETE FROM payment_methods WHERE id = ?',
            [id]
        );
        return (result as any).affectedRows > 0;
    }
} 