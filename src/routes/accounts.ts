import { Router } from 'express';
import { AccountService } from '../domains/accounts/service';
import { CreateAccountDTO, UpdateAccountDTO } from '../domains/accounts/types';
import { validateCreateAccount, validateUpdateAccount } from '../middlewares/validators/account-validator';
import { validateAssociatePaymentMethod } from '../middlewares/validators/payment-method-validator';

export default function createAccountsRouter(accountService: AccountService = new AccountService()) {
  const router = Router();

  // Payment method routes (read-only) 
  router.get('/payment-methods', async (req, res, next) => {
    try {
      const paymentMethods = await accountService.getAllPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      next(error);
    }
  });

  router.get('/payment-methods/:id', async (req, res, next) => {
    try {
      const paymentMethod = await accountService.getPaymentMethodById(req.params.id);
      if (!paymentMethod) {
        res.status(404).json({ message: 'Payment method not found' });
        return;
      }
      res.json(paymentMethod);
    } catch (error) {
      next(error);
    }
  });

  // Account routes
  router.post('/', validateCreateAccount, async (req, res, next) => {
    try {
      const accountData: CreateAccountDTO = req.body;
      const account = await accountService.createAccount(accountData);
      res.status(201).json(account);
    } catch (error) {
      next(error);
    }
  });

  // Get all accounts
  router.get('/', async (req, res, next) => {
    try {
      const accounts = await accountService.getAllAccounts();
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const account = await accountService.getAccountById(req.params.id);
      if (!account) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }
      res.json(account);
    } catch (error) {
      next(error);
    }
  });

  router.get('/user/:userId', async (req, res, next) => {
    try {
      const accounts = await accountService.getAccountsByUserId(req.params.userId);
      if (!accounts) {
        res.status(404).json({ message: 'No accounts found for this user' });
        return;
      }
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', validateUpdateAccount, async (req, res, next) => {
    try {
      const accountData: UpdateAccountDTO = req.body;
      const account = await accountService.updateAccount(req.params.id, accountData);
      if (!account) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }
      res.json(account);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const success = await accountService.deleteAccount(req.params.id);
      if (!success) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Account-Payment Method association routes
  router.post('/:accountId/payment-methods', validateAssociatePaymentMethod, async (req, res, next) => {
    try {
      const { payment_method_id } = req.body;
      await accountService.associatePaymentMethodWithAccount(req.params.accountId, payment_method_id);
      res.status(201).json({ message: 'Payment method associated successfully' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:accountId/payment-methods', async (req, res, next) => {
    try {
      const paymentMethods = await accountService.getPaymentMethodsByAccountId(req.params.accountId);
      res.json(paymentMethods);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:accountId/payment-methods/:paymentMethodId', async (req, res, next) => {
    try {
      const success = await accountService.disassociatePaymentMethodFromAccount(
        req.params.accountId, 
        req.params.paymentMethodId
      );
      if (!success) {
        res.status(404).json({ message: 'Association not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/payment-methods/:paymentMethodId/accounts', async (req, res, next) => {
    try {
      const accounts = await accountService.getAccountsByPaymentMethodId(req.params.paymentMethodId);
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
