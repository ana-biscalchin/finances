import { AccountService } from '../../../domains/accounts/service';
import { AccountRepository } from '../../../domains/accounts/repository';
import { PaymentMethodRepository } from '../../../domains/accounts/payment-method-repository';
import { Account, PaymentMethod, CreateAccountDTO, UpdateAccountDTO } from '../../../domains/accounts/types';

jest.mock('../../../domains/accounts/repository', () => ({
  AccountRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('../../../domains/accounts/payment-method-repository', () => ({
  PaymentMethodRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    associateWithAccount: jest.fn(),
    disassociateFromAccount: jest.fn(),
    getPaymentMethodsByAccountId: jest.fn(),
    getAccountsByPaymentMethodId: jest.fn(),
  })),
}));

describe('AccountService', () => {
  let service: AccountService;
  let mockAccountRepository: jest.Mocked<AccountRepository>;
  let mockPaymentMethodRepository: jest.Mocked<PaymentMethodRepository>;

  const mockAccount: Account = {
    id: 'account123',
    user_id: 'user123',
    institution_name: 'Test Bank',
    initial_balance: 1000,
    currency: 'USD',
    account_type: 'checking',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPaymentMethod: PaymentMethod = {
    id: 'payment123',
    name: 'Credit Card',
  };

  beforeEach(() => {
    mockAccountRepository = new AccountRepository() as jest.Mocked<AccountRepository>;
    mockPaymentMethodRepository = new PaymentMethodRepository() as jest.Mocked<PaymentMethodRepository>;
    service = new AccountService();
    (service as any).repository = mockAccountRepository;
    (service as any).paymentMethodRepository = mockPaymentMethodRepository;
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create account with valid payment methods', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'checking',
        payment_method_ids: ['payment123', 'payment456'],
      };

      mockPaymentMethodRepository.findById
        .mockResolvedValueOnce(mockPaymentMethod)
        .mockResolvedValueOnce({ ...mockPaymentMethod, id: 'payment456' });
      mockAccountRepository.create.mockResolvedValueOnce(mockAccount);

      const result = await service.createAccount(accountData);

      expect(mockPaymentMethodRepository.findById).toHaveBeenCalledWith('payment123');
      expect(mockPaymentMethodRepository.findById).toHaveBeenCalledWith('payment456');
      expect(mockAccountRepository.create).toHaveBeenCalledWith(accountData);
      expect(result).toEqual(mockAccount);
    });

    it('should throw error when payment method not found', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'checking',
        payment_method_ids: ['invalid-payment'],
      };

      mockPaymentMethodRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createAccount(accountData)).rejects.toThrow(
        'Payment method with ID invalid-payment not found'
      );
    });
  });

  describe('createPaymentMethod', () => {
    it('should create payment method successfully', async () => {
      mockPaymentMethodRepository.findByName.mockResolvedValueOnce(null);
      mockPaymentMethodRepository.create.mockResolvedValueOnce(mockPaymentMethod);

      const result = await service.createPaymentMethod('Credit Card');

      expect(mockPaymentMethodRepository.findByName).toHaveBeenCalledWith('Credit Card');
      expect(mockPaymentMethodRepository.create).toHaveBeenCalledWith('Credit Card');
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should throw error when payment method name already exists', async () => {
      mockPaymentMethodRepository.findByName.mockResolvedValueOnce(mockPaymentMethod);

      await expect(service.createPaymentMethod('Credit Card')).rejects.toThrow(
        'Payment method already exists'
      );
    });
  });

  describe('getPaymentMethodById', () => {
    it('should return payment method when found', async () => {
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(mockPaymentMethod);

      const result = await service.getPaymentMethodById('payment123');

      expect(mockPaymentMethodRepository.findById).toHaveBeenCalledWith('payment123');
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found', async () => {
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(null);

      const result = await service.getPaymentMethodById('payment123');

      expect(result).toBeNull();
    });
  });

  describe('getAllPaymentMethods', () => {
    it('should return all payment methods', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      mockPaymentMethodRepository.findAll.mockResolvedValueOnce(mockPaymentMethods);

      const result = await service.getAllPaymentMethods();

      expect(mockPaymentMethodRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockPaymentMethods);
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method successfully', async () => {
      const updatedPaymentMethod = { ...mockPaymentMethod, name: 'Updated Card' };
      mockPaymentMethodRepository.findByName.mockResolvedValueOnce(null);
      mockPaymentMethodRepository.update.mockResolvedValueOnce(updatedPaymentMethod);

      const result = await service.updatePaymentMethod('payment123', 'Updated Card');

      expect(mockPaymentMethodRepository.findByName).toHaveBeenCalledWith('Updated Card');
      expect(mockPaymentMethodRepository.update).toHaveBeenCalledWith('payment123', 'Updated Card');
      expect(result).toEqual(updatedPaymentMethod);
    });

    it('should throw error when payment method name already exists for different ID', async () => {
      const existingPaymentMethod = { ...mockPaymentMethod, id: 'different-id' };
      mockPaymentMethodRepository.findByName.mockResolvedValueOnce(existingPaymentMethod);

      await expect(service.updatePaymentMethod('payment123', 'Credit Card')).rejects.toThrow(
        'Payment method name already exists'
      );
    });

    it('should allow updating with same name for same ID', async () => {
      const updatedPaymentMethod = { ...mockPaymentMethod, name: 'Credit Card' };
      mockPaymentMethodRepository.findByName.mockResolvedValueOnce(mockPaymentMethod);
      mockPaymentMethodRepository.update.mockResolvedValueOnce(updatedPaymentMethod);

      const result = await service.updatePaymentMethod('payment123', 'Credit Card');

      expect(result).toEqual(updatedPaymentMethod);
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      mockPaymentMethodRepository.delete.mockResolvedValueOnce(true);

      const result = await service.deletePaymentMethod('payment123');

      expect(mockPaymentMethodRepository.delete).toHaveBeenCalledWith('payment123');
      expect(result).toBe(true);
    });

    it('should return false when payment method not found for deletion', async () => {
      mockPaymentMethodRepository.delete.mockResolvedValueOnce(false);

      const result = await service.deletePaymentMethod('payment123');

      expect(result).toBe(false);
    });
  });

  describe('associatePaymentMethodWithAccount', () => {
    it('should associate payment method with account successfully', async () => {
      mockAccountRepository.findById.mockResolvedValueOnce(mockAccount);
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(mockPaymentMethod);
      mockPaymentMethodRepository.associateWithAccount.mockResolvedValueOnce();

      await service.associatePaymentMethodWithAccount('account123', 'payment123');

      expect(mockAccountRepository.findById).toHaveBeenCalledWith('account123');
      expect(mockPaymentMethodRepository.findById).toHaveBeenCalledWith('payment123');
      expect(mockPaymentMethodRepository.associateWithAccount).toHaveBeenCalledWith('account123', 'payment123');
    });

    it('should throw error when account not found', async () => {
      mockAccountRepository.findById.mockResolvedValueOnce(null);

      await expect(service.associatePaymentMethodWithAccount('account123', 'payment123')).rejects.toThrow(
        'Account not found'
      );
    });

    it('should throw error when payment method not found', async () => {
      mockAccountRepository.findById.mockResolvedValueOnce(mockAccount);
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(null);

      await expect(service.associatePaymentMethodWithAccount('account123', 'payment123')).rejects.toThrow(
        'Payment method not found'
      );
    });
  });

  describe('disassociatePaymentMethodFromAccount', () => {
    it('should disassociate payment method from account successfully', async () => {
      mockPaymentMethodRepository.disassociateFromAccount.mockResolvedValueOnce(true);

      const result = await service.disassociatePaymentMethodFromAccount('account123', 'payment123');

      expect(mockPaymentMethodRepository.disassociateFromAccount).toHaveBeenCalledWith('account123', 'payment123');
      expect(result).toBe(true);
    });

    it('should return false when association not found', async () => {
      mockPaymentMethodRepository.disassociateFromAccount.mockResolvedValueOnce(false);

      const result = await service.disassociatePaymentMethodFromAccount('account123', 'payment123');

      expect(result).toBe(false);
    });
  });

  describe('getPaymentMethodsByAccountId', () => {
    it('should return payment methods for account', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      mockAccountRepository.findById.mockResolvedValueOnce(mockAccount);
      mockPaymentMethodRepository.getPaymentMethodsByAccountId.mockResolvedValueOnce(mockPaymentMethods);

      const result = await service.getPaymentMethodsByAccountId('account123');

      expect(mockAccountRepository.findById).toHaveBeenCalledWith('account123');
      expect(mockPaymentMethodRepository.getPaymentMethodsByAccountId).toHaveBeenCalledWith('account123');
      expect(result).toEqual(mockPaymentMethods);
    });

    it('should throw error when account not found', async () => {
      mockAccountRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getPaymentMethodsByAccountId('account123')).rejects.toThrow(
        'Account not found'
      );
    });
  });

  describe('getAccountsByPaymentMethodId', () => {
    it('should return accounts for payment method', async () => {
      const mockAccounts = [mockAccount];
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(mockPaymentMethod);
      mockPaymentMethodRepository.getAccountsByPaymentMethodId.mockResolvedValueOnce(mockAccounts);

      const result = await service.getAccountsByPaymentMethodId('payment123');

      expect(mockPaymentMethodRepository.findById).toHaveBeenCalledWith('payment123');
      expect(mockPaymentMethodRepository.getAccountsByPaymentMethodId).toHaveBeenCalledWith('payment123');
      expect(result).toEqual(mockAccounts);
    });

    it('should throw error when payment method not found', async () => {
      mockPaymentMethodRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getAccountsByPaymentMethodId('payment123')).rejects.toThrow(
        'Payment method not found'
      );
    });
  });
}); 