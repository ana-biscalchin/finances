import { Router } from 'express';
import { AccountService } from '../domains/accounts/service';
import { TransactionService } from '../domains/transactions/service';
import { CreateAccountDTO, UpdateAccountDTO } from '../domains/accounts/types';
import { validateCreateAccount, validateUpdateAccount } from '../middlewares/validators/account-validator';
import { validateCreatePaymentMethod, validateUpdatePaymentMethod, validateAssociatePaymentMethod } from '../middlewares/validators/payment-method-validator';

export default function createAccountsRouter(): Router {
  const router = Router();
  const accountService = new AccountService();
  const transactionService = new TransactionService();

  /**
   * @swagger
   * tags:
   *   name: Accounts
   *   description: Bank account operations
   */

  /**
   * @swagger
   * /accounts/payment-methods:
   *   get:
   *     summary: List all available payment methods
   *     tags: [Accounts]
   *     responses:
   *       200:
   *         description: List of payment methods
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PaymentMethod'
   */
  router.get('/payment-methods', async (req, res, next) => {
    try {
      const paymentMethods = await accountService.getAllPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/payment-methods:
   *   post:
   *     summary: Create a new payment method
   *     tags: [Accounts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: Payment method name
   *                 minLength: 1
   *                 maxLength: 255
   *             example:
   *               name: "Credit Card"
   *     responses:
   *       201:
   *         description: Payment method created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentMethod'
   *       400:
   *         description: Invalid input data
   *       409:
   *         description: Payment method already exists
   */
  router.post('/payment-methods', validateCreatePaymentMethod, async (req, res, next) => {
    try {
      const paymentMethod = await accountService.createPaymentMethod(req.body.name);
      res.status(201).json(paymentMethod);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/payment-methods/{id}:
   *   put:
   *     summary: Update an existing payment method
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Payment method ID to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 description: Payment method name
   *                 minLength: 1
   *                 maxLength: 255
   *             example:
   *               name: "Updated Credit Card"
   *     responses:
   *       200:
   *         description: Payment method updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentMethod'
   *       400:
   *         description: Invalid input data
   *       404:
   *         description: Payment method not found
   *       409:
   *         description: Payment method name already exists
   */
  router.put('/payment-methods/:id', validateUpdatePaymentMethod, async (req, res, next) => {
    try {
      const paymentMethod = await accountService.updatePaymentMethod(req.params.id, req.body.name);
      if (!paymentMethod) {
        res.status(404).json({ message: 'Payment method not found' });
        return;
      }
      res.json(paymentMethod);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/payment-methods/{id}:
   *   delete:
   *     summary: Delete a payment method
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Payment method ID to delete
   *     responses:
   *       204:
   *         description: Payment method deleted successfully
   *       404:
   *         description: Payment method not found
   */
  router.delete('/payment-methods/:id', async (req, res, next) => {
    try {
      const success = await accountService.deletePaymentMethod(req.params.id);
      if (!success) {
        res.status(404).json({ message: 'Payment method not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/{accountId}/payment-methods:
   *   post:
   *     summary: Associate a payment method with an account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - payment_method_id
   *             properties:
   *               payment_method_id:
   *                 type: string
   *                 description: Payment method ID to associate
   *                 minLength: 1
   *             example:
   *               payment_method_id: "payment123"
   *     responses:
   *       201:
   *         description: Payment method associated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Payment method associated successfully"
   *       400:
   *         description: Invalid input data
   *       404:
   *         description: Account or payment method not found
   *       409:
   *         description: Payment method already associated with this account
   */
  router.post('/:accountId/payment-methods', validateAssociatePaymentMethod, async (req, res, next) => {
    try {
      await accountService.associatePaymentMethodWithAccount(req.params.accountId, req.body.payment_method_id);
      res.status(201).json({ message: 'Payment method associated successfully' });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/{accountId}/payment-methods:
   *   get:
   *     summary: Get payment methods associated with an account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID
   *     responses:
   *       200:
   *         description: List of associated payment methods
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PaymentMethod'
   *       404:
   *         description: Account not found
   */
  router.get('/:accountId/payment-methods', async (req, res, next) => {
    try {
      const paymentMethods = await accountService.getPaymentMethodsByAccountId(req.params.accountId);
      res.json(paymentMethods);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/{accountId}/payment-methods/{paymentMethodId}:
   *   delete:
   *     summary: Disassociate a payment method from an account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID
   *       - in: path
   *         name: paymentMethodId
   *         schema:
   *           type: string
   *         required: true
   *         description: Payment method ID to disassociate
   *     responses:
   *       204:
   *         description: Payment method disassociated successfully
   *       404:
   *         description: Association not found
   */
  router.delete('/:accountId/payment-methods/:paymentMethodId', async (req, res, next) => {
    try {
      const success = await accountService.disassociatePaymentMethodFromAccount(req.params.accountId, req.params.paymentMethodId);
      if (!success) {
        res.status(404).json({ message: 'Association not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts:
   *   post:
   *     summary: Create a new account
   *     tags: [Accounts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - institution_name
   *               - account_type
   *               - initial_balance
   *               - currency
   *               - payment_method_ids
   *             properties:
   *               user_id:
   *                 type: string
   *                 description: User ID
   *               institution_name:
   *                 type: string
   *                 description: Institution name
   *               account_type:
   *                 type: string
   *                 enum: [checking, savings, investment, credit_card, payment_app, cash, other]
   *                 description: Account type
   *               initial_balance:
   *                 type: number
   *                 description: Initial balance
   *               currency:
   *                 type: string
   *                 description: Currency code (e.g., BRL, USD)
   *               payment_method_ids:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of payment method IDs
   *             example:
   *               user_id: "456e7890-e89b-12d3-a456-426614174001"
   *               institution_name: "Main Bank"
   *               account_type: "checking"
   *               initial_balance: 1000.00
   *               currency: "BRL"
   *               payment_method_ids: ["a1b2c3d4-e5f6-7890-1234-567890abcdef"]
   *     responses:
   *       201:
   *         description: Account created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Account'
   *       400:
   *         description: Invalid input data
   *       404:
   *         description: User not found
   */
  router.post('/', validateCreateAccount, async (req, res, next) => {
    try {
      const accountData: CreateAccountDTO = req.body;
      const account = await accountService.createAccount(accountData);
      res.status(201).json(account);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts:
   *   get:
   *     summary: List all accounts for a user
   *     tags: [Accounts]
   *     parameters:
   *       - in: query
   *         name: user_id
   *         schema:
   *           type: string
   *         required: true
   *         description: User ID
   *     responses:
   *       200:
   *         description: List of user accounts
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Account'
   *       400:
   *         description: User ID not provided
   */
  router.get('/', async (req, res, next) => {
    try {
      const { user_id } = req.query;
      if (!user_id || typeof user_id !== 'string') {
        res.status(400).json({ message: 'user_id is required' });
        return;
      }
      const accounts = await accountService.getAccountsByUserId(user_id as string);
      res.json(accounts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /accounts/{id}:
   *   get:
   *     summary: Get account by ID
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID
   *     responses:
   *       200:
   *         description: Account details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Account'
   *       404:
   *         description: Account not found
   */
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

  /**
   * @swagger
   * /accounts/{id}:
   *   put:
   *     summary: Update an existing account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               institution_name:
   *                 type: string
   *                 description: Institution name
   *               initial_balance:
   *                 type: number
   *                 description: Initial balance
   *               currency:
   *                 type: string
   *                 description: Currency code (e.g., BRL, USD)
   *               account_type:
   *                 type: string
   *                 enum: [checking, savings, investment, credit_card, payment_app, cash, other]
   *                 description: Account type
   *               payment_method_ids:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of payment method IDs
   *     responses:
   *       200:
   *         description: Account updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Account'
   *       400:
   *         description: Invalid input data
   *       404:
   *         description: Account not found
   */
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

  /**
   * @swagger
   * /accounts/{id}:
   *   delete:
   *     summary: Delete an account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID to delete
   *     responses:
   *       204:
   *         description: Account deleted successfully
   *       404:
   *         description: Account not found
   */
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

  /**
   * @swagger
   * /accounts/{id}/balance:
   *   get:
   *     summary: Get current balance of an account
   *     tags: [Accounts]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Account ID
   *     responses:
   *       200:
   *         description: Account balance
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 balance:
   *                   type: number
   *                   description: Current account balance
   *       404:
   *         description: Account not found
   */
  router.get('/:id/balance', async (req, res, next) => {
    try {
      const balance = await transactionService.getAccountBalance(req.params.id);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
