import { UserRepository } from '../../../domains/users/repository';
import { User, CreateUserDTO, UpdateUserDTO } from '../../../domains/users/types';
import pool from '../../../config/database';

jest.mock('../../../config/database', () => ({
  execute: jest.fn(),
}));

describe('UserRepository', () => {
  let repository: UserRepository;
  const mockUser: User = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    default_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    repository = new UserRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData: CreateUserDTO = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'USD',
      };

      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.create(userData);

      expect(pool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.findById('123');

      expect(pool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        ['123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([[]]);

      const result = await repository.findById('123');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.findByEmail('test@example.com');

      expect(pool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([[]]);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user with all fields', async () => {
      const updateData: UpdateUserDTO = {
        name: 'Updated User',
        email: 'updated@example.com',
        default_currency: 'EUR',
      };

      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.update('123', updateData);

      expect(pool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockUser);
    });

    it('should update user with partial fields', async () => {
      const updateData: UpdateUserDTO = {
        name: 'Updated User',
      };

      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.update('123', updateData);

      expect(pool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockUser);
    });

    it('should return user when no fields to update', async () => {
      const updateData: UpdateUserDTO = {};
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.update('123', updateData);

      expect(pool.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    it('should update email successfully', async () => {
      const updateData: UpdateUserDTO = {
        email: 'new@example.com',
      };

      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockUser]]);

      const result = await repository.update('123', updateData);

      expect(pool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockUser);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await repository.delete('123');

      expect(pool.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await repository.delete('123');

      expect(result).toBe(false);
    });
  });
}); 