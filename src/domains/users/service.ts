import { User, CreateUserDTO, UpdateUserDTO } from './types';
import { UserRepository } from './repository';

export class UserService {
  private repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  async createUser(userData: CreateUserDTO): Promise<User> {
    const existingUser = await this.repository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return this.repository.create(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async updateUser(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (userData.email && userData.email !== user.email) {
      const existingUser = await this.repository.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    return this.repository.update(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    return this.repository.delete(id);
  }
} 