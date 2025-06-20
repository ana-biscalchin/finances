import { AccountRepository } from './repository';
import { PaymentMethodRepository } from './payment-method-repository';
import { Account, PaymentMethod, CreateAccountDTO, UpdateAccountDTO } from './types';

export class AccountService {
    private repository: AccountRepository;
    private paymentMethodRepository: PaymentMethodRepository;

    constructor() {
        this.repository = new AccountRepository();
        this.paymentMethodRepository = new PaymentMethodRepository();
    }

    async createAccount(accountData: CreateAccountDTO): Promise<Account> {
        for (const paymentMethodId of accountData.payment_method_ids) {
            const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
            if (!paymentMethod) {
                throw new Error(`Payment method with ID ${paymentMethodId} not found`);
            }
        }
        
        return this.repository.create(accountData);
    }

    async getAllAccounts(): Promise<Account[]> {
        return this.repository.findAll();
    }

    async getAccountById(id: string): Promise<Account | null> {
        return this.repository.findById(id);
    }

    async getAccountsByUserId(userId: string): Promise<Account[] | null> {
        return this.repository.findByUserId(userId);
    }

    async updateAccount(id: string, accountData: UpdateAccountDTO): Promise<Account | null> {
        return this.repository.update(id, accountData);
    }

    async deleteAccount(id: string): Promise<boolean> {
        return this.repository.delete(id);
    }

    async createPaymentMethod(name: string): Promise<PaymentMethod> {
        const existingMethod = await this.paymentMethodRepository.findByName(name);
        if (existingMethod) {
            throw new Error('Payment method already exists');
        }
        return this.paymentMethodRepository.create(name);
    }

    async getPaymentMethodById(id: string): Promise<PaymentMethod | null> {
        return this.paymentMethodRepository.findById(id);
    }

    async getAllPaymentMethods(): Promise<PaymentMethod[]> {
        return this.paymentMethodRepository.findAll();
    }

    async updatePaymentMethod(id: string, name: string): Promise<PaymentMethod | null> {
        const existingMethod = await this.paymentMethodRepository.findByName(name);
        if (existingMethod && existingMethod.id !== id) {
            throw new Error('Payment method name already exists');
        }
        return this.paymentMethodRepository.update(id, name);
    }

    async deletePaymentMethod(id: string): Promise<boolean> {
        return this.paymentMethodRepository.delete(id);
    }

    async associatePaymentMethodWithAccount(accountId: string, paymentMethodId: string): Promise<void> {
        const account = await this.repository.findById(accountId);
        if (!account) {
            throw new Error('Account not found');
        }

        const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
        if (!paymentMethod) {
            throw new Error('Payment method not found');
        }

        await this.paymentMethodRepository.associateWithAccount(accountId, paymentMethodId);
    }

    async disassociatePaymentMethodFromAccount(accountId: string, paymentMethodId: string): Promise<boolean> {
        return this.paymentMethodRepository.disassociateFromAccount(accountId, paymentMethodId);
    }

    async getPaymentMethodsByAccountId(accountId: string): Promise<PaymentMethod[]> {
        const account = await this.repository.findById(accountId);
        if (!account) {
            throw new Error('Account not found');
        }
        return this.paymentMethodRepository.getPaymentMethodsByAccountId(accountId);
    }

    async getAccountsByPaymentMethodId(paymentMethodId: string): Promise<Account[]> {
        const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
        if (!paymentMethod) {
            throw new Error('Payment method not found');
        }
        return this.paymentMethodRepository.getAccountsByPaymentMethodId(paymentMethodId);
    }
}