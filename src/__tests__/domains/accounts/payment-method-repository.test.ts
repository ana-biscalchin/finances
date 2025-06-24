import { PaymentMethodRepository } from '../../../domains/accounts/payment-method-repository';
import pool from '../../../config/database';
import { PaymentMethod } from '../../../domains/accounts/types';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('PaymentMethodRepository', () => {
  let repository: PaymentMethodRepository;
  const mockPaymentMethod: PaymentMethod = {
    id: 'payment123',
    name: 'Credit Card',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    repository = new PaymentMethodRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create payment method successfully', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockPaymentMethod] });

      const result = await repository.create('Credit Card');

      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO payment_methods (id, name) VALUES ($1, $2)',
        [expect.any(String), 'Credit Card']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should throw error when payment method creation fails', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      await expect(repository.create('Credit Card')).rejects.toThrow('Failed to create payment method');
    });
  });

  describe('findById', () => {
    it('should return payment method when found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [mockPaymentMethod] });

      const result = await repository.findById('payment123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE id = $1',
        ['payment123']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById('payment123');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return payment method when found by name', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [mockPaymentMethod] });

      const result = await repository.findByName('Credit Card');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE name = $1',
        ['Credit Card']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found by name', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByName('Credit Card');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all payment methods', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: mockPaymentMethods });

      const result = await repository.findAll();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM payment_methods ORDER BY name');
      expect(result).toEqual(mockPaymentMethods);
    });

    it('should return empty array when no payment methods exist', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update payment method successfully', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockPaymentMethod] });

      const result = await repository.update('payment123', 'Updated Credit Card');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE payment_methods SET name = $1 WHERE id = $2',
        ['Updated Credit Card', 'payment123']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found for update', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repository.update('payment123', 'Updated Credit Card');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete payment method successfully', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.delete('payment123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM payment_methods WHERE id = $1',
        ['payment123']
      );
      expect(result).toBe(true);
    });

    it('should return false when payment method not found for deletion', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.delete('payment123');

      expect(result).toBe(false);
    });
  });
}); 