import { UserRepository } from '../../../domains/users/repository';
import { User, CreateUserDTO } from '../../../domains/users/types';
import mockPool from '../../__mocks__/database';

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

      mockPool.execute.mockResolvedValueOnce([[], []]);
      mockPool.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await repository.create(userData);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockPool.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await repository.findById('123');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        ['123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await repository.findById('123');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      mockPool.execute.mockResolvedValueOnce([[mockUser], []]);

      const result = await repository.findByEmail('test@example.com');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      mockPool.execute.mockResolvedValueOnce([[], []]);
      mockPool.execute.mockResolvedValueOnce([[{ ...mockUser, ...updateData }], []]);

      const result = await repository.update('123', updateData);

      expect(mockPool.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ ...mockUser, ...updateData });
    });
  });

  describe('delete', () => {
    it('should delete user and return true', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const result = await repository.delete('123');

      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await repository.delete('123');

      expect(result).toBe(false);
    });
  });
}); 