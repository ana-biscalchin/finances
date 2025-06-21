import { TransactionRepository } from './transaction-repository';
import { CategoryRepository } from './category-repository';
import { AccountRepository } from '../accounts/repository';
import { PaymentMethodRepository } from '../accounts/payment-method-repository';
import { 
  Transaction, 
  Category, 
  CreateTransactionDTO, 
  UpdateTransactionDTO, 
  CreateCategoryDTO, 
  UpdateCategoryDTO,
  TransactionFilters 
} from './types';

export class TransactionService {
  private transactionRepository: TransactionRepository;
  private categoryRepository: CategoryRepository;
  private accountRepository: AccountRepository;
  private paymentMethodRepository: PaymentMethodRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.categoryRepository = new CategoryRepository();
    this.accountRepository = new AccountRepository();
    this.paymentMethodRepository = new PaymentMethodRepository();
  }

  async createTransaction(transactionData: CreateTransactionDTO): Promise<Transaction> {
    await this.validateTransactionData(transactionData);
    
    if (transactionData.category_id) {
      const category = await this.categoryRepository.findById(transactionData.category_id);
      if (!category) {
        throw new Error('Category not found');
      }
    } else if (transactionData.category_name) {
      const account = await this.accountRepository.findById(transactionData.account_id);
      if (!account) {
        throw new Error('Account not found');
      }

      const existingCategory = await this.categoryRepository.findByNameAndUserId(
        transactionData.category_name,
        account.user_id
      );

      if (existingCategory) {
        transactionData.category_id = existingCategory.id;
      } else {
        const newCategory = await this.categoryRepository.create({
          user_id: account.user_id,
          name: transactionData.category_name,
          type: transactionData.type
        });
        transactionData.category_id = newCategory.id;
      }
    }
    
    return this.transactionRepository.create(transactionData);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return this.transactionRepository.findAll();
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findById(id);
  }

  async getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.findByAccountId(accountId);
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.findByUserId(userId);
  }

  async getTransactionsWithFilters(filters: TransactionFilters): Promise<Transaction[]> {
    return this.transactionRepository.findWithFilters(filters);
  }

  async updateTransaction(id: string, transactionData: UpdateTransactionDTO): Promise<Transaction | null> {
    const existingTransaction = await this.transactionRepository.findById(id);
    if (!existingTransaction) {
      throw new Error('Transaction not found');
    }

    if (transactionData.category_id) {
      await this.validateCategory(transactionData.category_id);
    } else if (transactionData.category_name) {
      const account = await this.accountRepository.findById(existingTransaction.account_id);
      if (!account) {
        throw new Error('Account not found');
      }

      const existingCategory = await this.categoryRepository.findByNameAndUserId(
        transactionData.category_name,
        account.user_id
      );

      if (existingCategory) {
        transactionData.category_id = existingCategory.id;
      } else {
        const transactionType = transactionData.type || existingTransaction.type;
        const newCategory = await this.categoryRepository.create({
          user_id: account.user_id,
          name: transactionData.category_name,
          type: transactionType
        });
        transactionData.category_id = newCategory.id;
      }
    }

    if (transactionData.payment_method_id) {
      await this.validatePaymentMethod(transactionData.payment_method_id);
    }

    return this.transactionRepository.update(id, transactionData);
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const transaction = await this.transactionRepository.findById(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return this.transactionRepository.delete(id);
  }

  async getAccountBalance(accountId: string): Promise<number> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.getBalanceByAccountId(accountId);
  }

  async getAccountBalanceDetails(accountId: string): Promise<{
    initial_balance: number;
    total_income: number;
    total_expense: number;
    current_balance: number;
  }> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.getBalanceDetailsByAccountId(accountId);
  }

  async getBalanceByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<number> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    return this.transactionRepository.getBalanceByDateRange(accountId, startDate, endDate);
  }

  async getTransactionsByDateRange(accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    return this.transactionRepository.findByDateRange(accountId, startDate, endDate);
  }

  async getTransactionsByCurrentMonth(accountId: string): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.findByCurrentMonth(accountId);
  }

  async getTransactionsByCurrentMonthForUser(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.findByCurrentMonthForUser(userId);
  }

  async getTransactionsByCurrentYear(accountId: string): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.findByCurrentYear(accountId);
  }

  async getTransactionsByCurrentYearForUser(userId: string): Promise<Transaction[]> {
    return this.transactionRepository.findByCurrentYearForUser(userId);
  }

  async getTransactionsByLastNDays(accountId: string, days: number): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (days <= 0) {
      throw new Error('Days must be greater than 0');
    }

    return this.transactionRepository.findByLastNDays(accountId, days);
  }

  async getTransactionsByLastNDaysForUser(userId: string, days: number): Promise<Transaction[]> {
    if (days <= 0) {
      throw new Error('Days must be greater than 0');
    }

    return this.transactionRepository.findByLastNDaysForUser(userId, days);
  }

  async getTransactionsByMonthAndYear(accountId: string, month: number, year: number): Promise<Transaction[]> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }

    if (year < 1900 || year > 2100) {
      throw new Error('Year must be between 1900 and 2100');
    }

    return this.transactionRepository.findByMonthAndYear(accountId, month, year);
  }

  async getTransactionsByMonthAndYearForUser(userId: string, month: number, year: number): Promise<Transaction[]> {
    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }

    if (year < 1900 || year > 2100) {
      throw new Error('Year must be between 1900 and 2100');
    }

    return this.transactionRepository.findByMonthAndYearForUser(userId, month, year);
  }

  private async validateTransactionData(transactionData: CreateTransactionDTO): Promise<void> {
    const account = await this.accountRepository.findById(transactionData.account_id);
    if (!account) {
      throw new Error('Account not found');
    }

    if (transactionData.category_id) {
      await this.validateCategory(transactionData.category_id);
    }

    if (transactionData.category_name) {
      if (!transactionData.category_name.trim()) {
        throw new Error('Category name cannot be empty');
      }
      if (transactionData.category_name.length > 255) {
        throw new Error('Category name is too long');
      }
    }

    if (transactionData.payment_method_id) {
      await this.validatePaymentMethod(transactionData.payment_method_id);
    }

    if (transactionData.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!transactionData.name || transactionData.name.trim().length === 0) {
      throw new Error('Transaction name is required');
    }

    if (transactionData.transaction_date > new Date()) {
      throw new Error('Transaction date cannot be in the future');
    }

    if (transactionData.tags && !Array.isArray(transactionData.tags)) {
      throw new Error('Tags must be an array');
    }
  }

  private async validateCategory(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }
  }

  private async validatePaymentMethod(paymentMethodId: string): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }
  }

  async createCategory(categoryData: CreateCategoryDTO): Promise<Category> {
    const existingCategory = await this.categoryRepository.findByNameAndUserId(
      categoryData.name, 
      categoryData.user_id
    );
    
    if (existingCategory) {
      throw new Error('Category with this name already exists for this user');
    }

    return this.categoryRepository.create(categoryData);
  }

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categoryRepository.findById(id);
  }

  async getCategoriesByUserId(userId: string): Promise<Category[]> {
    return this.categoryRepository.findByUserId(userId);
  }

  async getCategoriesByUserIdAndType(userId: string, type: string): Promise<Category[]> {
    return this.categoryRepository.findByUserIdAndType(userId, type);
  }

  async updateCategory(id: string, categoryData: UpdateCategoryDTO): Promise<Category | null> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    if (categoryData.name) {
      const existingCategory = await this.categoryRepository.findByNameAndUserId(
        categoryData.name, 
        category.user_id
      );
      
      if (existingCategory && existingCategory.id !== id) {
        throw new Error('Category with this name already exists for this user');
      }
    }

    return this.categoryRepository.update(id, categoryData);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    return this.categoryRepository.delete(id);
  }
} 