import { PaymentMethodRepository } from '../../../domains/accounts/payment-method-repository';
import pool from '../../../config/database';

jest.mock('../../../config/database');

const mockPool = pool as jest.Mocked<typeof pool>;

describe('PaymentMethodRepository', () => {
  let repository: PaymentMethodRepository;
  const mockPaymentMethod = {
    id: '123',
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
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[mockPaymentMethod]]);

      const result = await repository.create('Credit Card');

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO payment_methods (id, name) VALUES (?, ?)',
        [expect.any(String), 'Credit Card']
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
    it('should return payment method when found by id', async () => {
      const mockExecute = mockPool.execute as jest.Mock;
      mockExecute.mockResolvedValueOnce([[mockPaymentMethod]]);

      const result = await repository.findById('123');

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE id = ?',
        ['123']
      );
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found by id', async () => {
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
}); 