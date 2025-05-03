import { UserService } from '../../../domains/users/service';
import { UserRepository } from '../../../domains/users/repository';
import { User, CreateUserDTO, UpdateUserDTO } from '../../../domains/users/types';

jest.mock('../../../domains/users/repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  const mockUser: User = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    default_currency: 'USD',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepository = new UserRepository() as jest.Mocked<UserRepository>;
    service = new UserService();
    (service as any).repository = mockRepository;
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData: CreateUserDTO = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'USD',
      };

      mockRepository.findByEmail.mockResolvedValueOnce(null);
      mockRepository.create.mockResolvedValueOnce(mockUser);

      const result = await service.createUser(userData);

      expect(mockRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(mockUser);
    });

    it('should throw error when email already exists', async () => {
      const userData: CreateUserDTO = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'USD',
      };

      mockRepository.findByEmail.mockResolvedValueOnce(mockUser);

      await expect(service.createUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockUser);

      const result = await service.getUserById('123');

      expect(mockRepository.findById).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      const result = await service.getUserById('123');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      mockRepository.findByEmail.mockResolvedValueOnce(mockUser);

      const result = await service.getUserByEmail('test@example.com');

      expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockRepository.findByEmail.mockResolvedValueOnce(null);

      const result = await service.getUserByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData: UpdateUserDTO = {
        name: 'Updated User',
        default_currency: 'EUR',
      };

      mockRepository.findById.mockResolvedValueOnce(mockUser);
      mockRepository.update.mockResolvedValueOnce({
        ...mockUser,
        ...updateData,
      });

      const result = await service.updateUser('123', updateData);

      expect(mockRepository.findById).toHaveBeenCalledWith('123');
      expect(mockRepository.update).toHaveBeenCalledWith('123', updateData);
      expect(result).toEqual({
        ...mockUser,
        ...updateData,
      });
    });

    it('should throw error when user not found', async () => {
      const updateData: UpdateUserDTO = {
        name: 'Updated User',
      };

      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.updateUser('123', updateData)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error when email already exists', async () => {
      const updateData: UpdateUserDTO = {
        email: 'existing@example.com',
      };

      mockRepository.findById.mockResolvedValueOnce(mockUser);
      mockRepository.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        id: '456',
      });

      await expect(service.updateUser('123', updateData)).rejects.toThrow(
        'Email already in use'
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockUser);
      mockRepository.delete.mockResolvedValueOnce(true);

      const result = await service.deleteUser('123');

      expect(mockRepository.findById).toHaveBeenCalledWith('123');
      expect(mockRepository.delete).toHaveBeenCalledWith('123');
      expect(result).toBe(true);
    });

    it('should throw error when user not found', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteUser('123')).rejects.toThrow('User not found');
    });
  });
}); 