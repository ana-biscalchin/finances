import { User, CreateUserDTO, UpdateUserDTO } from './types';
import { UserRepository } from './repository';

export class UserService {
  private repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  async createUser(userData: CreateUserDTO): Promise<User> {
    // Check if user with email already exists
    const existingUser = await this.repository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate currency
    if (!this.isValidCurrency(userData.default_currency)) {
      throw new Error('Invalid currency code');
    }

    return this.repository.create(userData);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async updateUser(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // If email is being updated, check if it's already taken
    if (userData.email && userData.email !== user.email) {
      const existingUser = await this.repository.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    // Validate currency if being updated
    if (userData.default_currency && !this.isValidCurrency(userData.default_currency)) {
      throw new Error('Invalid currency code');
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

  private isValidCurrency(currency: string): boolean {
    // This is a simple validation. In a real application, you might want to
    // check against a list of valid currency codes or use a currency validation library
    return /^[A-Z]{3}$/.test(currency);
  }
} 