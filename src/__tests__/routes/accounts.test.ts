import request from 'supertest';
import express, { Application } from 'express';
import { AccountService } from '../../domains/accounts/service';
import { Account, PaymentMethod } from '../../domains/accounts/types';
import createAccountsRouter from '../../routes/accounts';

jest.mock('../../domains/accounts/service', () => ({
  AccountService: jest.fn().mockImplementation(() => ({
    createAccount: jest.fn(),
    getAllAccounts: jest.fn(),
    getAccountById: jest.fn(),
    getAccountsByUserId: jest.fn(),
    updateAccount: jest.fn(),
    deleteAccount: jest.fn(),
    createPaymentMethod: jest.fn(),
    getPaymentMethodById: jest.fn(),
    getAllPaymentMethods: jest.fn(),
    updatePaymentMethod: jest.fn(),
    deletePaymentMethod: jest.fn(),
    associatePaymentMethodWithAccount: jest.fn(),
    disassociatePaymentMethodFromAccount: jest.fn(),
    getPaymentMethodsByAccountId: jest.fn(),
    getAccountsByPaymentMethodId: jest.fn(),
  })),
}));

describe('Accounts Routes - Payment Methods', () => {
  let mockAccountService: jest.Mocked<AccountService>;
  let app: Application;

  const mockPaymentMethod: PaymentMethod = {
    id: 'payment123',
    name: 'Credit Card',
  };

  const mockAccount: Account = {
    id: 'account123',
    user_id: 'user123',
    institution_name: 'Test Bank',
    initial_balance: 1000,
    currency: 'USD',
    account_type: 'checking',
    created_at: new Date('2025-06-20T02:30:36.478Z'),
    updated_at: new Date('2025-06-20T02:30:36.478Z'),
  };

  beforeEach(() => {
    mockAccountService = new AccountService() as jest.Mocked<AccountService>;
    app = express();
    app.use(express.json());
    app.use('/accounts', createAccountsRouter(mockAccountService));
    jest.clearAllMocks();
  });

  describe('GET /accounts/payment-methods', () => {
    it('should return all payment methods', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      mockAccountService.getAllPaymentMethods.mockResolvedValueOnce(mockPaymentMethods);

      const response = await request(app)
        .get('/accounts/payment-methods')
        .expect(200);

      expect(mockAccountService.getAllPaymentMethods).toHaveBeenCalled();
      expect(response.body).toEqual(mockPaymentMethods);
    });

    it('should handle service errors', async () => {
      mockAccountService.getAllPaymentMethods.mockRejectedValueOnce(new Error('Database error'));

      await request(app)
        .get('/accounts/payment-methods')
        .expect(500);
    });
  });

  describe('GET /accounts/payment-methods/:id', () => {
    it('should return payment method when found', async () => {
      mockAccountService.getPaymentMethodById.mockResolvedValueOnce(mockPaymentMethod);

      const response = await request(app)
        .get('/accounts/payment-methods/payment123')
        .expect(200);

      expect(mockAccountService.getPaymentMethodById).toHaveBeenCalledWith('payment123');
      expect(response.body).toEqual(mockPaymentMethod);
    });

    it('should return 404 when payment method not found', async () => {
      mockAccountService.getPaymentMethodById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/accounts/payment-methods/payment123')
        .expect(404);

      expect(response.body).toEqual({ message: 'Payment method not found' });
    });

    it('should handle service errors', async () => {
      mockAccountService.getPaymentMethodById.mockRejectedValueOnce(new Error('Database error'));

      await request(app)
        .get('/accounts/payment-methods/payment123')
        .expect(500);
    });
  });

  describe('POST /accounts/:accountId/payment-methods', () => {
    it('should associate payment method with account successfully', async () => {
      mockAccountService.associatePaymentMethodWithAccount.mockResolvedValueOnce();

      const response = await request(app)
        .post('/accounts/account123/payment-methods')
        .send({ payment_method_id: 'payment123' })
        .expect(201);

      expect(mockAccountService.associatePaymentMethodWithAccount).toHaveBeenCalledWith('account123', 'payment123');
      expect(response.body).toEqual({ message: 'Payment method associated successfully' });
    });

    it('should return 400 for invalid request body', async () => {
      await request(app)
        .post('/accounts/account123/payment-methods')
        .send({})
        .expect(400);
    });

    it('should handle service errors', async () => {
      mockAccountService.associatePaymentMethodWithAccount.mockRejectedValueOnce(new Error('Account not found'));

      await request(app)
        .post('/accounts/account123/payment-methods')
        .send({ payment_method_id: 'payment123' })
        .expect(500);
    });
  });

  describe('GET /accounts/:accountId/payment-methods', () => {
    it('should return payment methods for account', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      mockAccountService.getPaymentMethodsByAccountId.mockResolvedValueOnce(mockPaymentMethods);

      const response = await request(app)
        .get('/accounts/account123/payment-methods')
        .expect(200);

      expect(mockAccountService.getPaymentMethodsByAccountId).toHaveBeenCalledWith('account123');
      expect(response.body).toEqual(mockPaymentMethods);
    });

    it('should handle service errors', async () => {
      mockAccountService.getPaymentMethodsByAccountId.mockRejectedValueOnce(new Error('Account not found'));

      await request(app)
        .get('/accounts/account123/payment-methods')
        .expect(500);
    });
  });

  describe('DELETE /accounts/:accountId/payment-methods/:paymentMethodId', () => {
    it('should disassociate payment method from account successfully', async () => {
      mockAccountService.disassociatePaymentMethodFromAccount.mockResolvedValueOnce(true);

      await request(app)
        .delete('/accounts/account123/payment-methods/payment123')
        .expect(204);

      expect(mockAccountService.disassociatePaymentMethodFromAccount).toHaveBeenCalledWith('account123', 'payment123');
    });

    it('should return 404 when association not found', async () => {
      mockAccountService.disassociatePaymentMethodFromAccount.mockResolvedValueOnce(false);

      const response = await request(app)
        .delete('/accounts/account123/payment-methods/payment123')
        .expect(404);

      expect(response.body).toEqual({ message: 'Association not found' });
    });

    it('should handle service errors', async () => {
      mockAccountService.disassociatePaymentMethodFromAccount.mockRejectedValueOnce(new Error('Database error'));

      await request(app)
        .delete('/accounts/account123/payment-methods/payment123')
        .expect(500);
    });
  });

  describe('GET /accounts/payment-methods/:paymentMethodId/accounts', () => {
    it('should return accounts for payment method', async () => {
      const mockAccounts = [mockAccount];
      mockAccountService.getAccountsByPaymentMethodId.mockResolvedValueOnce(mockAccounts);

      const response = await request(app)
        .get('/accounts/payment-methods/payment123/accounts')
        .expect(200);

      expect(mockAccountService.getAccountsByPaymentMethodId).toHaveBeenCalledWith('payment123');
      expect(response.body).toEqual([
        {
          ...mockAccount,
          created_at: mockAccount.created_at.toISOString(),
          updated_at: mockAccount.updated_at.toISOString(),
        }
      ]);
    });

    it('should handle service errors', async () => {
      mockAccountService.getAccountsByPaymentMethodId.mockRejectedValueOnce(new Error('Payment method not found'));

      await request(app)
        .get('/accounts/payment-methods/payment123/accounts')
        .expect(500);
    });
  });
}); 