jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: require('../../__mocks__/database').default,
}));

import { PaymentMethodRepository } from '../../../domains/accounts/payment-method-repository';
import { PaymentMethod } from '../../../domains/accounts/types';
import mockPool from '../../__mocks__/database';

describe('PaymentMethodRepository', () => {
  let repository: PaymentMethodRepository;
  const mockPaymentMethod: PaymentMethod = {
    id: '123',
    name: 'Credit Card',
  };

  beforeEach(() => {
    repository = new PaymentMethodRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a payment method successfully', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[mockPaymentMethod]]);

      const result = await repository.create('Credit Card');

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO payment_methods (id, name) VALUES (?, ?)',
        expect.arrayContaining([expect.any(String), 'Credit Card'])
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should throw error when creation fails', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]]);

      await expect(repository.create('Credit Card')).rejects.toThrow(
        'Failed to create payment method'
      );
    });
  });

  describe('findById', () => {
    it('should return payment method when found', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[mockPaymentMethod]]);

      const result = await repository.findById('123');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE id = ?',
        ['123']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await repository.findById('123');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return payment method when found by name', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[mockPaymentMethod]]);

      const result = await repository.findByName('Credit Card');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE name = ?',
        ['Credit Card']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found by name', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await repository.findByName('Non Existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all payment methods ordered by name', async () => {
      const mockPaymentMethods = [
        { id: '1', name: 'Cash' },
        { id: '2', name: 'Credit Card' },
        { id: '3', name: 'Debit Card' },
      ];
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([mockPaymentMethods]);

      const result = await repository.findAll();

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods ORDER BY name'
      );
      expect(result).toEqual(mockPaymentMethods);
    });
  });

  describe('update', () => {
    it('should update payment method successfully', async () => {
      const updatedPaymentMethod = { ...mockPaymentMethod, name: 'Updated Card' };
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[updatedPaymentMethod]]);

      const result = await repository.update('123', 'Updated Card');

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE payment_methods SET name = ? WHERE id = ?',
        ['Updated Card', '123']
      );
      expect(result).toEqual(updatedPaymentMethod);
    });

    it('should return null when payment method not found for update', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]]);

      const result = await repository.update('123', 'Updated Card');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete payment method successfully', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await repository.delete('123');

      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM payment_methods WHERE id = ?',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('should return false when payment method not found for deletion', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await repository.delete('123');

      expect(result).toBe(false);
    });
  });

  describe('associateWithAccount', () => {
    it('should associate payment method with account successfully', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      await repository.associateWithAccount('account123', 'payment123');

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
        ['account123', 'payment123']
      );
    });
  });

  describe('disassociateFromAccount', () => {
    it('should disassociate payment method from account successfully', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await repository.disassociateFromAccount('account123', 'payment123');

      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM account_payment_methods WHERE account_id = ? AND payment_method_id = ?',
        ['account123', 'payment123']
      );
      expect(result).toBe(true);
    });

    it('should return false when association not found', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await repository.disassociateFromAccount('account123', 'payment123');

      expect(result).toBe(false);
    });
  });

  describe('getPaymentMethodsByAccountId', () => {
    it('should return payment methods for account', async () => {
      const mockPaymentMethods = [
        { id: '1', name: 'Credit Card' },
        { id: '2', name: 'Debit Card' },
      ];
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([mockPaymentMethods]);

      const result = await repository.getPaymentMethodsByAccountId('account123');

      expect(mockExecute).toHaveBeenCalledWith(
        `SELECT pm.* 
             FROM payment_methods pm
             JOIN account_payment_methods apm ON pm.id = apm.payment_method_id
             WHERE apm.account_id = ?
             ORDER BY pm.name`,
        ['account123']
      );
      expect(result).toEqual(mockPaymentMethods);
    });

    it('should return empty array when account has no payment methods', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await repository.getPaymentMethodsByAccountId('account123');

      expect(result).toEqual([]);
    });
  });

  describe('getAccountsByPaymentMethodId', () => {
    it('should return accounts for payment method', async () => {
      const mockAccounts = [
        { id: '1', user_id: 'user1', institution_name: 'Bank A' },
        { id: '2', user_id: 'user2', institution_name: 'Bank B' },
      ];
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([mockAccounts]);

      const result = await repository.getAccountsByPaymentMethodId('payment123');

      expect(mockExecute).toHaveBeenCalledWith(
        `SELECT a.* 
             FROM accounts a
             JOIN account_payment_methods apm ON a.id = apm.account_id
             WHERE apm.payment_method_id = ?`,
        ['payment123']
      );
      expect(result).toEqual(mockAccounts);
    });

    it('should return empty array when payment method has no accounts', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await repository.getAccountsByPaymentMethodId('payment123');

      expect(result).toEqual([]);
    });
  });
}); 