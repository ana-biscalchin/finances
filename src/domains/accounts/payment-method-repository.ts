import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import { PaymentMethod, AccountPaymentMethod } from './types';

export class PaymentMethodRepository {
    async create(name: string): Promise<PaymentMethod> {
        const id = uuidv4();

        await pool.query(
            'INSERT INTO payment_methods (id, name) VALUES ($1, $2)',
            [id, name]
        );
        
        const paymentMethod = await this.findById(id);
        if (!paymentMethod) {
            throw new Error('Failed to create payment method');
        }
        
        return paymentMethod;
    }

    async findById(id: string): Promise<PaymentMethod | null> {
        const result = await pool.query(
            'SELECT * FROM payment_methods WHERE id = $1',
            [id]
        );
        
        const paymentMethods = result.rows as PaymentMethod[];
        return paymentMethods[0] || null;
    }

    async findByName(name: string): Promise<PaymentMethod | null> {
        const result = await pool.query(
            'SELECT * FROM payment_methods WHERE name = $1',
            [name]
        );
        
        const paymentMethods = result.rows as PaymentMethod[];
        return paymentMethods[0] || null;
    }

    async findAll(): Promise<PaymentMethod[]> {
        const result = await pool.query('SELECT * FROM payment_methods ORDER BY name');
        return result.rows as PaymentMethod[];
    }

    async update(id: string, name: string): Promise<PaymentMethod | null> {
        await pool.query(
            'UPDATE payment_methods SET name = $1 WHERE id = $2',
            [name, id]
        );

        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = await pool.query(
            'DELETE FROM payment_methods WHERE id = $1',
            [id]
        );
        return (result.rowCount || 0) > 0;
    }
} 