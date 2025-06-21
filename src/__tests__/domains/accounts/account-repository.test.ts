import { AccountRepository } from '../../../domains/accounts/repository';
import pool from '../../../config/database';
import { Account, CreateAccountDTO, UpdateAccountDTO } from '../../../domains/accounts/types';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('AccountRepository', () => {
  let repository: AccountRepository;
  const mockAccount: Account = {
    id: 'account123',
    user_id: 'user123',
    institution_name: 'Test Bank',
    initial_balance: '1000.00',
    currency: 'BRL',
    account_type: 'checking',
    payment_methods: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    repository = new AccountRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create account successfully', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'BRL',
        account_type: 'checking',
        payment_method_ids: ['payment123'],
      };

      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[mockAccount]])
        .mockResolvedValueOnce([[]]);

      const result = await repository.create(accountData);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO accounts (id, user_id, institution_name, initial_balance, currency, account_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [expect.any(String), 'user123', 'Test Bank', 1000, 'BRL', 'checking', expect.any(Date), expect.any(Date)]
      );
      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
        [expect.any(String), 'payment123']
      );
      expect(result).toEqual(mockAccount);
    });

    it('should throw error when account creation fails', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'BRL',
        account_type: 'checking',
        payment_method_ids: [],
      };

      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[]]);

      await expect(repository.create(accountData)).rejects.toThrow('Failed to create account');
    });
  });

  describe('findAll', () => {
    it('should return all accounts with payment methods', async () => {
      const mockAccounts = [mockAccount];
      const mockPaymentMethods = [
        { id: 'payment123', name: 'Credit Card', account_id: 'account123' }
      ];

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce([mockAccounts])
        .mockResolvedValueOnce([mockPaymentMethods]);

      const result = await repository.findAll();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM accounts');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT pm.*, apm.account_id'),
        [['account123']]
      );
      expect(result).toEqual([{ ...mockAccount, payment_methods: [{ id: 'payment123', name: 'Credit Card' }] }]);
    });

    it('should return empty array when no accounts exist', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([[mockAccount]])
        .mockResolvedValueOnce([[]]);

      const result = await repository.findById('account123');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM accounts WHERE id = ?',
        ['account123']
      );
      expect(result).toEqual({ ...mockAccount, payment_methods: [] });
    });

    it('should return null when account not found', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await repository.findById('account123');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return accounts for user', async () => {
      const mockAccounts = [mockAccount];
      const mockPaymentMethods = [
        { id: 'payment123', name: 'Credit Card', account_id: 'account123' }
      ];

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce([mockAccounts])
        .mockResolvedValueOnce([mockPaymentMethods]);

      const result = await repository.findByUserId('user123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM accounts WHERE user_id = ?',
        ['user123']
      );
      expect(result).toEqual([{ ...mockAccount, payment_methods: [{ id: 'payment123', name: 'Credit Card' }] }]);
    });

    it('should return empty array when no accounts for user', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await repository.findByUserId('user123');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update account successfully', async () => {
      const updateData: UpdateAccountDTO = { institution_name: 'Updated Bank' };
      const mockConnection = {
        beginTransaction: jest.fn(),
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      mockPool.getConnection.mockResolvedValue(mockConnection as any);
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([[{ ...mockAccount, institution_name: 'Updated Bank' }]])
        .mockResolvedValueOnce([[]]);

      const result = await repository.update('account123', updateData);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE accounts SET institution_name = ?, updated_at = ? WHERE id = ?',
        ['Updated Bank', expect.any(Date), 'account123']
      );
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should update payment methods when provided', async () => {
      const updateData: UpdateAccountDTO = { 
        payment_method_ids: ['payment123', 'payment456'] 
      };
      const mockConnection = {
        beginTransaction: jest.fn(),
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      mockPool.getConnection.mockResolvedValue(mockConnection as any);
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([[mockAccount]])
        .mockResolvedValueOnce([[]]);

      await repository.update('account123', updateData);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'DELETE FROM account_payment_methods WHERE account_id = ?',
        ['account123']
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
        ['account123', 'payment123']
      );
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES (?, ?)',
        ['account123', 'payment456']
      );
    });

    it('should rollback transaction on error', async () => {
      const updateData: UpdateAccountDTO = { institution_name: 'Updated Bank' };
      const mockConnection = {
        beginTransaction: jest.fn(),
        execute: jest.fn().mockRejectedValue(new Error('Database error')),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      mockPool.getConnection.mockResolvedValue(mockConnection as any);

      await expect(repository.update('account123', updateData)).rejects.toThrow('Database error');
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete account successfully', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await repository.delete('account123');

      expect(mockExecute).toHaveBeenCalledWith(
        'DELETE FROM accounts WHERE id = ?',
        ['account123']
      );
      expect(result).toBe(true);
    });

    it('should return false when account not found for deletion', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await repository.delete('account123');

      expect(result).toBe(false);
    });
  });
}); 