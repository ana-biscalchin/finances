import { AccountService } from '../../../domains/accounts/service';
import { AccountRepository } from '../../../domains/accounts/repository';
import { PaymentMethodRepository } from '../../../domains/accounts/payment-method-repository';
import { CreateAccountDTO, UpdateAccountDTO, Account, PaymentMethod } from '../../../domains/accounts/types';

jest.mock('../../../domains/accounts/repository');
jest.mock('../../../domains/accounts/payment-method-repository');

const mockAccountRepository = AccountRepository as jest.MockedClass<typeof AccountRepository>;
const mockPaymentMethodRepository = PaymentMethodRepository as jest.MockedClass<typeof PaymentMethodRepository>;

describe('AccountService', () => {
  let service: AccountService;
  const mockAccount: Account = {
    id: 'account123',
    user_id: 'user123',
    institution_name: 'Test Bank',
    initial_balance: '1000.00',
    currency: 'BRL',
    account_type: 'checking',
    created_at: new Date(),
    updated_at: new Date(),
  };
  const mockPaymentMethod: PaymentMethod = {
    id: 'payment123',
    name: 'Credit Card',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    service = new AccountService();
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create account successfully', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'BRL',
        account_type: 'checking',
        payment_method_ids: ['payment123'],
      };
      mockPaymentMethodRepository.prototype.findById.mockResolvedValueOnce(mockPaymentMethod);
      mockAccountRepository.prototype.create.mockResolvedValueOnce(mockAccount);

      const result = await service.createAccount(accountData);

      expect(mockPaymentMethodRepository.prototype.findById).toHaveBeenCalledWith('payment123');
      expect(mockAccountRepository.prototype.create).toHaveBeenCalledWith(accountData);
      expect(result).toEqual(mockAccount);
    });

    it('should throw error when payment method not found', async () => {
      const accountData: CreateAccountDTO = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'BRL',
        account_type: 'checking',
        payment_method_ids: ['invalid-payment'],
      };
      mockPaymentMethodRepository.prototype.findById.mockResolvedValueOnce(null);

      await expect(service.createAccount(accountData)).rejects.toThrow(
        'Payment method with ID invalid-payment not found'
      );
    });
  });

  describe('getAllAccounts', () => {
    it('should return all accounts', async () => {
      const mockAccounts = [mockAccount];
      mockAccountRepository.prototype.findAll.mockResolvedValueOnce(mockAccounts);

      const result = await service.getAllAccounts();

      expect(mockAccountRepository.prototype.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAccountById', () => {
    it('should return account when found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValueOnce(mockAccount);

      const result = await service.getAccountById('account123');

      expect(mockAccountRepository.prototype.findById).toHaveBeenCalledWith('account123');
      expect(result).toEqual(mockAccount);
    });

    it('should return null when account not found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValueOnce(null);

      const result = await service.getAccountById('account123');

      expect(result).toBeNull();
    });
  });

  describe('getAccountsByUserId', () => {
    it('should return accounts for user', async () => {
      const mockAccounts = [mockAccount];
      mockAccountRepository.prototype.findByUserId.mockResolvedValueOnce(mockAccounts);

      const result = await service.getAccountsByUserId('user123');

      expect(mockAccountRepository.prototype.findByUserId).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      const updateData: UpdateAccountDTO = { institution_name: 'Updated Bank' };
      const updatedAccount = { ...mockAccount, institution_name: 'Updated Bank' };
      mockAccountRepository.prototype.update.mockResolvedValueOnce(updatedAccount);

      const result = await service.updateAccount('account123', updateData);

      expect(mockAccountRepository.prototype.update).toHaveBeenCalledWith('account123', updateData);
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockAccountRepository.prototype.delete.mockResolvedValueOnce(true);

      const result = await service.deleteAccount('account123');

      expect(mockAccountRepository.prototype.delete).toHaveBeenCalledWith('account123');
      expect(result).toBe(true);
    });

    it('should return false when account not found for deletion', async () => {
      mockAccountRepository.prototype.delete.mockResolvedValueOnce(false);

      const result = await service.deleteAccount('account123');

      expect(result).toBe(false);
    });
  });

  describe('createPaymentMethod', () => {
    it('should create payment method successfully', async () => {
      mockPaymentMethodRepository.prototype.findByName.mockResolvedValueOnce(null);
      mockPaymentMethodRepository.prototype.create.mockResolvedValueOnce(mockPaymentMethod);

      const result = await service.createPaymentMethod('Credit Card');

      expect(mockPaymentMethodRepository.prototype.findByName).toHaveBeenCalledWith('Credit Card');
      expect(mockPaymentMethodRepository.prototype.create).toHaveBeenCalledWith('Credit Card');
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should throw error when payment method name already exists', async () => {
      mockPaymentMethodRepository.prototype.findByName.mockResolvedValueOnce(mockPaymentMethod);

      await expect(service.createPaymentMethod('Credit Card')).rejects.toThrow(
        'Payment method already exists'
      );
    });
  });

  describe('getAllPaymentMethods', () => {
    it('should return all payment methods', async () => {
      const mockPaymentMethods = [mockPaymentMethod];
      mockPaymentMethodRepository.prototype.findAll.mockResolvedValueOnce(mockPaymentMethods);

      const result = await service.getAllPaymentMethods();

      expect(mockPaymentMethodRepository.prototype.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockPaymentMethods);
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method successfully', async () => {
      const updatedPaymentMethod = { ...mockPaymentMethod, name: 'Updated Card' };
      mockPaymentMethodRepository.prototype.findByName.mockResolvedValueOnce(null);
      mockPaymentMethodRepository.prototype.update.mockResolvedValueOnce(updatedPaymentMethod);

      const result = await service.updatePaymentMethod('payment123', 'Updated Card');

      expect(mockPaymentMethodRepository.prototype.findByName).toHaveBeenCalledWith('Updated Card');
      expect(mockPaymentMethodRepository.prototype.update).toHaveBeenCalledWith('payment123', 'Updated Card');
      expect(result).toEqual(updatedPaymentMethod);
    });

    it('should throw error when payment method name already exists for different ID', async () => {
      const existingPaymentMethod = { ...mockPaymentMethod, id: 'different-id' };
      mockPaymentMethodRepository.prototype.findByName.mockResolvedValueOnce(existingPaymentMethod);

      await expect(service.updatePaymentMethod('payment123', 'Credit Card')).rejects.toThrow(
        'Payment method name already exists'
      );
    });

    it('should allow updating with same name for same ID', async () => {
      const updatedPaymentMethod = { ...mockPaymentMethod, name: 'Credit Card' };
      mockPaymentMethodRepository.prototype.findByName.mockResolvedValueOnce(mockPaymentMethod);
      mockPaymentMethodRepository.prototype.update.mockResolvedValueOnce(updatedPaymentMethod);

      const result = await service.updatePaymentMethod('payment123', 'Credit Card');

      expect(result).toEqual(updatedPaymentMethod);
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      mockPaymentMethodRepository.prototype.delete.mockResolvedValueOnce(true);

      const result = await service.deletePaymentMethod('payment123');

      expect(mockPaymentMethodRepository.prototype.delete).toHaveBeenCalledWith('payment123');
      expect(result).toBe(true);
    });

    it('should return false when payment method not found for deletion', async () => {
      mockPaymentMethodRepository.prototype.delete.mockResolvedValueOnce(false);

      const result = await service.deletePaymentMethod('payment123');

      expect(result).toBe(false);
    });
  });
}); 