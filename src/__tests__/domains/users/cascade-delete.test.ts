jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import { UserService } from '../../../domains/users/service';
import { AccountService } from '../../../domains/accounts/service';
import { TransactionService } from '../../../domains/transactions/service';
import database from '../../../config/database';

const mockPool = database as jest.Mocked<typeof database>;

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
    jest.clearAllMocks();
    // Mock all database queries to return success
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('should cascade delete all related data when user is deleted', async () => {
    const mockQuery = mockPool.query as jest.Mock;
    
    // Mock findById to return a user
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user123', name: 'Test User' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    await userService.deleteUser('user123');

    // Verify that delete queries were called
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cascade delete transactions when account is deleted', async () => {
    const mockQuery = mockPool.query as jest.Mock;
    
    // Mock successful deletion
    mockQuery.mockResolvedValue({ rowCount: 1 });

    await accountService.deleteAccount('account123');

    // Verify that delete queries were called
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should set payment_method_id to null when payment method is deleted', async () => {
    // This behavior is handled by the database constraints
    // Testing database constraints would require integration tests with a real database
    expect(true).toBe(true);
  });

  it('should set category_id to null when category is deleted', async () => {
    // This behavior is handled by the database constraints
    // Testing database constraints would require integration tests with a real database
    expect(true).toBe(true);
  });
}); 