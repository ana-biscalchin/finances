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
    
    mockAccountRepository.prototype.findById.mockReset();
    mockAccountRepository.prototype.update.mockReset();
    mockPaymentMethodRepository.prototype.findById.mockReset();
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

    it('should validate payment methods when updating', async () => {
      const updateData: UpdateAccountDTO = { 
        payment_method_ids: ['payment123', 'payment456'] 
      };
      const updatedAccount = { ...mockAccount, payment_methods: [mockPaymentMethod] };
      
      mockPaymentMethodRepository.prototype.findById
        .mockResolvedValueOnce(mockPaymentMethod)
        .mockResolvedValueOnce({ ...mockPaymentMethod, id: 'payment456' });
      mockAccountRepository.prototype.update.mockResolvedValueOnce(updatedAccount);

      const result = await service.updateAccount('account123', updateData);

      expect(mockPaymentMethodRepository.prototype.findById).toHaveBeenCalledWith('payment123');
      expect(mockPaymentMethodRepository.prototype.findById).toHaveBeenCalledWith('payment456');
      expect(mockAccountRepository.prototype.update).toHaveBeenCalledWith('account123', updateData);
      expect(result).toEqual(updatedAccount);
    });

    it('should throw error when payment method not found during update', async () => {
      const updateData: UpdateAccountDTO = { 
        payment_method_ids: ['invalid-payment'] 
      };
      
      mockPaymentMethodRepository.prototype.findById.mockResolvedValueOnce(null);

      await expect(service.updateAccount('account123', updateData)).rejects.toThrow(
        'Payment method with ID invalid-payment not found'
      );
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

  describe('associatePaymentMethodWithAccount', () => {
    it('should associate payment method with account successfully', async () => {
      const accountWithPaymentMethods = { 
        ...mockAccount, 
        payment_methods: [mockPaymentMethod] 
      };
      
      mockAccountRepository.prototype.findById
        .mockResolvedValueOnce(accountWithPaymentMethods)
        .mockResolvedValueOnce(accountWithPaymentMethods);
      mockPaymentMethodRepository.prototype.findById.mockResolvedValueOnce(mockPaymentMethod);
      mockAccountRepository.prototype.update.mockResolvedValueOnce(accountWithPaymentMethods);

      await service.associatePaymentMethodWithAccount('account123', 'payment456');

      expect(mockAccountRepository.prototype.findById).toHaveBeenCalledWith('account123');
      expect(mockPaymentMethodRepository.prototype.findById).toHaveBeenCalledWith('payment456');
      expect(mockAccountRepository.prototype.update).toHaveBeenCalledWith('account123', {
        payment_method_ids: ['payment123', 'payment456']
      });
    });

    it('should throw error when account not found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValue(null);

      await expect(service.associatePaymentMethodWithAccount('account123', 'payment456')).rejects.toThrow(
        'Account not found'
      );
    });

    it('should throw error when payment method not found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValue(mockAccount);
      mockPaymentMethodRepository.prototype.findById.mockResolvedValue(null);

      await expect(service.associatePaymentMethodWithAccount('account123', 'payment456')).rejects.toThrow(
        'Payment method not found'
      );
    });
  });

  describe('getPaymentMethodsByAccountId', () => {
    it('should return payment methods for account', async () => {
      const accountWithPaymentMethods = { 
        ...mockAccount, 
        payment_methods: [mockPaymentMethod] 
      };
      
      mockAccountRepository.prototype.findById.mockResolvedValueOnce(accountWithPaymentMethods);

      const result = await service.getPaymentMethodsByAccountId('account123');

      expect(mockAccountRepository.prototype.findById).toHaveBeenCalledWith('account123');
      expect(result).toEqual([mockPaymentMethod]);
    });

    it('should throw error when account not found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValue(null);

      await expect(service.getPaymentMethodsByAccountId('account123')).rejects.toThrow(
        'Account not found'
      );
    });

    it('should return empty array when account has no payment methods', async () => {
      const accountWithoutPaymentMethods = { 
        ...mockAccount, 
        payment_methods: [] 
      };
      
      mockAccountRepository.prototype.findById.mockResolvedValue(accountWithoutPaymentMethods);

      const result = await service.getPaymentMethodsByAccountId('account123');

      expect(result).toEqual([]);
    });
  });

  describe('disassociatePaymentMethodFromAccount', () => {
    it('should disassociate payment method from account successfully', async () => {
      const accountWithPaymentMethods = { 
        ...mockAccount, 
        payment_methods: [mockPaymentMethod, { ...mockPaymentMethod, id: 'payment456' }] 
      };
      
      mockAccountRepository.prototype.findById
        .mockResolvedValueOnce(accountWithPaymentMethods)
        .mockResolvedValueOnce(accountWithPaymentMethods);
      mockAccountRepository.prototype.update.mockResolvedValueOnce(accountWithPaymentMethods);

      const result = await service.disassociatePaymentMethodFromAccount('account123', 'payment456');

      expect(mockAccountRepository.prototype.findById).toHaveBeenCalledWith('account123');
      expect(mockAccountRepository.prototype.update).toHaveBeenCalledWith('account123', {
        payment_method_ids: ['payment123']
      });
      expect(result).toBe(true);
    });

    it('should return false when account not found', async () => {
      mockAccountRepository.prototype.findById.mockResolvedValue(null);

      const result = await service.disassociatePaymentMethodFromAccount('account123', 'payment456');

      expect(result).toBe(false);
    });

    it('should return false when payment method not associated with account', async () => {
      const accountWithPaymentMethods = { 
        ...mockAccount, 
        payment_methods: [mockPaymentMethod] 
      };
      
      mockAccountRepository.prototype.findById.mockResolvedValue(accountWithPaymentMethods);

      const result = await service.disassociatePaymentMethodFromAccount('account123', 'payment456');

      expect(result).toBe(false);
    });
  });
}); 