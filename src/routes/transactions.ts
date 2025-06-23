import { Router } from 'express';
import { TransactionService } from '../domains/transactions/service';
import { CreateTransactionDTO, UpdateTransactionDTO, TransactionFilters } from '../domains/transactions/types';
import { validateCreateTransaction, validateUpdateTransaction } from '../middlewares/validators/transaction-validator';

export default function createTransactionsRouter(): Router {
  const router = Router();
  const transactionService = new TransactionService();

  /**
   * @swagger
   * tags:
   *   name: Transactions
   *   description: Operações relacionadas a transações financeiras
   */

  /**
   * @swagger
   * /transactions:
   *   post:
   *     summary: Cria uma nova transação
   *     tags: [Transactions]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - account_id
   *               - name
   *               - amount
   *               - type
   *               - transaction_date
   *             properties:
   *               account_id:
   *                 type: string
   *                 description: ID da conta
   *               category_id:
   *                 type: string
   *                 description: ID da categoria (opcional)
   *               category_name:
   *                 type: string
   *                 description: Nome da categoria (criada automaticamente se não existir)
   *               payment_method_id:
   *                 type: string
   *                 description: ID do método de pagamento (opcional)
   *               name:
   *                 type: string
   *                 description: Nome/descrição da transação
   *               amount:
   *                 type: number
   *                 description: Valor da transação
   *               type:
   *                 type: string
   *                 enum: [income, expense, transfer]
   *                 description: Tipo da transação
   *               transaction_date:
   *                 type: string
   *                 format: date
   *                 description: Data da transação
   *               description:
   *                 type: string
   *                 description: Descrição adicional (opcional)
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Tags da transação (opcional)
   *             example:
   *               account_id: "abc123-def456-ghi789"
   *               category_name: "Alimentação"
   *               payment_method_id: "payment123"
   *               name: "Compra no Supermercado"
   *               amount: 150.50
   *               type: "expense"
   *               transaction_date: "2023-01-15"
   *               description: "Compras da semana"
   *               tags: ["alimentação", "supermercado"]
   *     responses:
   *       201:
   *         description: Transação criada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Transaction'
   *       400:
   *         description: Dados de entrada inválidos
   *       404:
   *         description: Conta não encontrada
   */
  router.post('/', validateCreateTransaction, async (req, res, next) => {
    try {
      const transactionData: CreateTransactionDTO = req.body;
      const transaction = await transactionService.createTransaction(transactionData);
      res.status(201).json(transaction);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions:
   *   get:
   *     summary: Lista transações com filtros opcionais
   *     tags: [Transactions]
   *     parameters:
   *       - in: query
   *         name: account_id
   *         schema:
   *           type: string
   *         description: Filtrar por ID da conta
   *       - in: query
   *         name: category_id
   *         schema:
   *           type: string
   *         description: Filtrar por ID da categoria
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [income, expense, transfer]
   *         description: Filtrar por tipo de transação
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Data inicial para filtro
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Data final para filtro
   *       - in: query
   *         name: min_amount
   *         schema:
   *           type: number
   *         description: Valor mínimo para filtro
   *       - in: query
   *         name: max_amount
   *         schema:
   *           type: number
   *         description: Valor máximo para filtro
   *       - in: query
   *         name: payment_method_id
   *         schema:
   *           type: string
   *         description: Filtrar por método de pagamento
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Buscar por nome ou descrição
   *     responses:
   *       200:
   *         description: Lista de transações
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Transaction'
   */
  router.get('/', async (req, res, next) => {
    try {
      const filters: TransactionFilters = {
        account_id: req.query.account_id as string,
        category_id: req.query.category_id as string,
        payment_method_id: req.query.payment_method_id as string,
        type: req.query.type as 'income' | 'expense' | 'transfer',
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        min_amount: req.query.min_amount ? Number(req.query.min_amount) : undefined,
        max_amount: req.query.max_amount ? Number(req.query.max_amount) : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string
      };

      const transactions = await transactionService.getTransactionsWithFilters(filters);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/{id}:
   *   get:
   *     summary: Busca uma transação pelo ID
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da transação
   *     responses:
   *       200:
   *         description: Detalhes da transação
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Transaction'
   *       404:
   *         description: Transação não encontrada
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const transaction = await transactionService.getTransactionById(req.params.id);
      if (!transaction) {
        res.status(404).json({ message: 'Transaction not found' });
        return;
      }
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/{id}:
   *   put:
   *     summary: Atualiza uma transação existente
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da transação a ser atualizada
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               category_id:
   *                 type: string
   *               category_name:
   *                 type: string
   *               payment_method_id:
   *                 type: string
   *               name:
   *                 type: string
   *               amount:
   *                 type: number
   *               type:
   *                 type: string
   *                 enum: [income, expense, transfer]
   *               transaction_date:
   *                 type: string
   *                 format: date
   *               description:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Transação atualizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Transaction'
   *       400:
   *         description: Dados de entrada inválidos
   *       404:
   *         description: Transação não encontrada
   */
  router.put('/:id', validateUpdateTransaction, async (req, res, next) => {
    try {
      const transactionData: UpdateTransactionDTO = req.body;
      const transaction = await transactionService.updateTransaction(req.params.id, transactionData);
      if (!transaction) {
        res.status(404).json({ message: 'Transaction not found' });
        return;
      }
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/{id}:
   *   delete:
   *     summary: Remove uma transação
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da transação a ser removida
   *     responses:
   *       204:
   *         description: Transação removida com sucesso
   *       404:
   *         description: Transação não encontrada
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const success = await transactionService.deleteTransaction(req.params.id);
      if (!success) {
        res.status(404).json({ message: 'Transaction not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/account/{accountId}:
   *   get:
   *     summary: Lista transações de uma conta específica
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da conta
   *     responses:
   *       200:
   *         description: Lista de transações da conta
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Transaction'
   *       404:
   *         description: Conta não encontrada
   */
  router.get('/account/:accountId', async (req, res, next) => {
    try {
      const transactions = await transactionService.getTransactionsByAccountId(req.params.accountId);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/user/{userId}:
   *   get:
   *     summary: Lista transações de um usuário específico
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: userId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID do usuário
   *     responses:
   *       200:
   *         description: Lista de transações do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Transaction'
   */
  router.get('/user/:userId', async (req, res, next) => {
    try {
      const transactions = await transactionService.getTransactionsByUserId(req.params.userId);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/account/{accountId}/balance:
   *   get:
   *     summary: Obtém o saldo atual de uma conta
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da conta
   *     responses:
   *       200:
   *         description: Saldo da conta
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 balance:
   *                   type: number
   *                   description: Saldo atual da conta
   *       404:
   *         description: Conta não encontrada
   */
  router.get('/account/:accountId/balance', async (req, res, next) => {
    try {
      const balance = await transactionService.getAccountBalance(req.params.accountId);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/account/{accountId}/balance-details:
   *   get:
   *     summary: Obtém detalhes do saldo de uma conta
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da conta
   *     responses:
   *       200:
   *         description: Detalhes do saldo da conta
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 initial_balance:
   *                   type: number
   *                   description: Saldo inicial da conta
   *                 total_income:
   *                   type: number
   *                   description: Total de receitas
   *                 total_expense:
   *                   type: number
   *                   description: Total de despesas
   *                 current_balance:
   *                   type: number
   *                   description: Saldo atual
   *       404:
   *         description: Conta não encontrada
   */
  router.get('/account/:accountId/balance-details', async (req, res, next) => {
    try {
      const balanceDetails = await transactionService.getAccountBalanceDetails(req.params.accountId);
      res.json(balanceDetails);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/account/{accountId}/current-month:
   *   get:
   *     summary: Lista transações do mês atual de uma conta
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: accountId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID da conta
   *     responses:
   *       200:
   *         description: Transações do mês atual
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Transaction'
   *       404:
   *         description: Conta não encontrada
   */
  router.get('/account/:accountId/current-month', async (req, res, next) => {
    try {
      const transactions = await transactionService.getTransactionsByCurrentMonth(req.params.accountId);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /transactions/user/{userId}/current-month:
   *   get:
   *     summary: Lista transações do mês atual de um usuário
   *     tags: [Transactions]
   *     parameters:
   *       - in: path
   *         name: userId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID do usuário
   *     responses:
   *       200:
   *         description: Transações do mês atual do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Transaction'
   */
  router.get('/user/:userId/current-month', async (req, res, next) => {
    try {
      const transactions = await transactionService.getTransactionsByCurrentMonthForUser(req.params.userId);
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  return router;
} 