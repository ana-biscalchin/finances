import { AccountRepository } from '../../../domains/accounts/repository';
import pool from '../../../config/database';
import { Account, CreateAccountDTO, UpdateAccountDTO } from '../../../domains/accounts/types';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
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

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockAccount] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.create(accountData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO accounts'),
        expect.any(Array)
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO account_payment_methods'),
        expect.any(Array)
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

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

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
        .mockResolvedValueOnce({ rows: mockAccounts })
        .mockResolvedValueOnce({ rows: mockPaymentMethods });

      const result = await repository.findAll();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM accounts');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT pm.*, apm.account_id'),
        expect.any(Array)
      );
      expect(result).toEqual([{ ...mockAccount, payment_methods: [{ id: 'payment123', name: 'Credit Card' }] }]);
    });

    it('should return empty array when no accounts exist', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rows: [mockAccount] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById('account123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM accounts WHERE id = $1',
        ['account123']
      );
      expect(result).toEqual({ ...mockAccount, payment_methods: [] });
    });

    it('should return null when account not found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

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
        .mockResolvedValueOnce({ rows: mockAccounts })
        .mockResolvedValueOnce({ rows: mockPaymentMethods });

      const result = await repository.findByUserId('user123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM accounts WHERE user_id = $1',
        ['user123']
      );
      expect(result).toEqual([{ ...mockAccount, payment_methods: [{ id: 'payment123', name: 'Credit Card' }] }]);
    });

    it('should return empty array when no accounts for user', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByUserId('user123');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update account successfully', async () => {
      const updateData: UpdateAccountDTO = { institution_name: 'Updated Bank' };
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockQuery = mockPool.query as jest.Mock;
      const mockConnect = mockPool.connect as jest.Mock;
      
      mockConnect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [mockAccount] });

      const result = await repository.update('account123', updateData);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toEqual(mockAccount);
    });

    it('should update payment methods when provided', async () => {
      const updateData: UpdateAccountDTO = { 
        payment_method_ids: ['payment123', 'payment456'] 
      };
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockQuery = mockPool.query as jest.Mock;
      const mockConnect = mockPool.connect as jest.Mock;
      
      mockConnect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [mockAccount] });

      await repository.update('account123', updateData);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM account_payment_methods WHERE account_id = $1',
        ['account123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES ($1, $2)',
        ['account123', 'payment123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO account_payment_methods (account_id, payment_method_id) VALUES ($1, $2)',
        ['account123', 'payment456']
      );
    });

    it('should rollback transaction on error', async () => {
      const updateData: UpdateAccountDTO = { institution_name: 'Updated Bank' };
      const mockClient = {
        query: jest.fn().mockRejectedValue(new Error('Database error')),
        release: jest.fn(),
      };

      const mockConnect = mockPool.connect as jest.Mock;
      mockConnect.mockResolvedValue(mockClient);

      await expect(repository.update('account123', updateData)).rejects.toThrow('Database error');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete account successfully', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.delete('account123');

      expect(result).toBe(true);
    });

    it('should return false if no account deleted', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.delete('account123');

      expect(result).toBe(false);
    });
  });
}); 