import { UserRepository } from '../../../domains/users/repository';
import pool from '../../../config/database';
import { User, CreateUserDTO, UpdateUserDTO } from '../../../domains/users/types';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('UserRepository', () => {
  let repository: UserRepository;
  const mockUser: User = {
    id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    default_currency: 'BRL',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    repository = new UserRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const userData: CreateUserDTO = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'BRL',
      };

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.create(userData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.any(Array)
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user creation fails', async () => {
      const userData: CreateUserDTO = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'BRL',
      };

      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });

      await expect(repository.create(userData)).rejects.toThrow('Failed to create user');
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [mockUser];
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const result = await repository.findAll();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when no users exist', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.findById('user123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['user123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findById('user123');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.findByEmail('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateData: UpdateUserDTO = { name: 'Updated User' };
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.update('user123', updateData);

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should return user when no updates provided', async () => {
      const updateData: UpdateUserDTO = {};
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.update('user123', updateData);

      expect(result).toEqual(mockUser);
    });

    it('should update multiple fields successfully', async () => {
      const updateData: UpdateUserDTO = { 
        name: 'Updated User', 
        email: 'updated@example.com',
        default_currency: 'USD'
      };
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [mockUser] });

      const result = await repository.update('user123', updateData);

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.delete('user123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        ['user123']
      );
      expect(result).toBe(true);
    });

    it('should return false when user not found for deletion', async () => {
      const mockQuery = mockPool.query as jest.Mock;
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.delete('user123');

      expect(result).toBe(false);
    });
  });
}); 