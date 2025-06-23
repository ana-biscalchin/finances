jest.unmock('../../../config/database');

import { UserService } from '../../../domains/users/service';
import { AccountService } from '../../../domains/accounts/service';
import { TransactionService } from '../../../domains/transactions/service';
import database from '../../../config/database';

describe('Cascade Delete Integration Tests', () => {
  let userService: UserService;
  let accountService: AccountService;
  let transactionService: TransactionService;

  beforeAll(async () => {
    userService = new UserService();
    accountService = new AccountService();
    transactionService = new TransactionService();
  });

  beforeEach(async () => {
    await database.execute('DELETE FROM transactions');
    await database.execute('DELETE FROM account_payment_methods');
    await database.execute('DELETE FROM accounts');
    await database.execute('DELETE FROM categories');
    await database.execute('DELETE FROM users');
    await database.execute('DELETE FROM payment_methods');
  });

  it('should cascade delete all related data when user is deleted', async () => {
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      default_currency: 'USD'
    });

    const paymentMethod = await accountService.createPaymentMethod('Credit Card');

    const account = await accountService.createAccount({
      user_id: user.id,
      institution_name: 'Test Bank',
      initial_balance: 1000,
      currency: 'USD',
      account_type: 'checking',
      payment_method_ids: [paymentMethod.id]
    });

    const category = await transactionService.createCategory({
      user_id: user.id,
      name: 'Food',
      type: 'expense'
    });

    const transaction = await transactionService.createTransaction({
      account_id: account.id,
      payment_method_id: paymentMethod.id,
      category_id: category.id,
      name: 'Lunch',
      amount: 25.50,
      type: 'expense',
      transaction_date: new Date(),
      description: null,
      payee: null,
      reference_number: null,
      tags: null
    });

    await userService.deleteUser(user.id);

    const deletedUser = await userService.getUserById(user.id);
    const deletedAccount = await accountService.getAccountById(account.id);
    const deletedCategory = await transactionService.getCategoryById(category.id);
    const deletedTransaction = await transactionService.getTransactionById(transaction.id);

    expect(deletedUser).toBeNull();
    expect(deletedAccount).toBeNull();
    expect(deletedCategory).toBeNull();
    expect(deletedTransaction).toBeNull();
  });

  it('should cascade delete transactions when account is deleted', async () => {
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      default_currency: 'USD'
    });

    const paymentMethod = await accountService.createPaymentMethod('Credit Card');

    const account = await accountService.createAccount({
      user_id: user.id,
      institution_name: 'Test Bank',
      initial_balance: 1000,
      currency: 'USD',
      account_type: 'checking',
      payment_method_ids: [paymentMethod.id]
    });

    const category = await transactionService.createCategory({
      user_id: user.id,
      name: 'Food',
      type: 'expense'
    });

    const transaction = await transactionService.createTransaction({
      account_id: account.id,
      payment_method_id: paymentMethod.id,
      category_id: category.id,
      name: 'Lunch',
      amount: 25.50,
      type: 'expense',
      transaction_date: new Date(),
      description: null,
      payee: null,
      reference_number: null,
      tags: null
    });

    await accountService.deleteAccount(account.id);

    const deletedAccount = await accountService.getAccountById(account.id);
    const deletedTransaction = await transactionService.getTransactionById(transaction.id);

    expect(deletedAccount).toBeNull();
    expect(deletedTransaction).toBeNull();
  });

  it('should set payment_method_id to null when payment method is deleted', async () => {
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      default_currency: 'USD'
    });

    const paymentMethod = await accountService.createPaymentMethod('Credit Card');

    const account = await accountService.createAccount({
      user_id: user.id,
      institution_name: 'Test Bank',
      initial_balance: 1000,
      currency: 'USD',
      account_type: 'checking',
      payment_method_ids: [paymentMethod.id]
    });

    const category = await transactionService.createCategory({
      user_id: user.id,
      name: 'Food',
      type: 'expense'
    });

    const transaction = await transactionService.createTransaction({
      account_id: account.id,
      payment_method_id: paymentMethod.id,
      category_id: category.id,
      name: 'Lunch',
      amount: 25.50,
      type: 'expense',
      transaction_date: new Date(),
      description: null,
      payee: null,
      reference_number: null,
      tags: null
    });

    await accountService.deletePaymentMethod(paymentMethod.id);

    const updatedTransaction = await transactionService.getTransactionById(transaction.id);
    expect(updatedTransaction).not.toBeNull();
    expect(updatedTransaction!.payment_method_id).toBeNull();
  });

  it('should set category_id to null when category is deleted', async () => {
    const user = await userService.createUser({
      name: 'Test User',
      email: 'test@example.com',
      default_currency: 'USD'
    });

    const paymentMethod = await accountService.createPaymentMethod('Credit Card');

    const account = await accountService.createAccount({
      user_id: user.id,
      institution_name: 'Test Bank',
      initial_balance: 1000,
      currency: 'USD',
      account_type: 'checking',
      payment_method_ids: [paymentMethod.id]
    });

    const category = await transactionService.createCategory({
      user_id: user.id,
      name: 'Food',
      type: 'expense'
    });

    const transaction = await transactionService.createTransaction({
      account_id: account.id,
      payment_method_id: paymentMethod.id,
      category_id: category.id,
      name: 'Lunch',
      amount: 25.50,
      type: 'expense',
      transaction_date: new Date(),
      description: null,
      payee: null,
      reference_number: null,
      tags: null
    });

    await transactionService.deleteCategory(category.id);

    const updatedTransaction = await transactionService.getTransactionById(transaction.id);
    expect(updatedTransaction).not.toBeNull();
    expect(updatedTransaction!.category_id).toBeNull();
  });
}); 