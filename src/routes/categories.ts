import { Router } from 'express';
import { TransactionService } from '../domains/transactions/service';
import { CreateCategoryDTO, UpdateCategoryDTO } from '../domains/transactions/types';
import { validateCreateCategory, validateUpdateCategory } from '../middlewares/validators/category-validator';

export default function createCategoriesRouter(): Router {
  const router = Router();
  const transactionService = new TransactionService();

  /**
   * @swagger
   * tags:
   *   name: Categories
   *   description: Transaction categories operations
   */

  /**
   * @swagger
   * /categories:
   *   post:
   *     summary: Create a new category
   *     tags: [Categories]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user_id
   *               - name
   *               - type
   *             properties:
   *               user_id:
   *                 type: string
   *                 description: User ID
   *               name:
   *                 type: string
   *                 description: Category name
   *               type:
   *                 type: string
   *                 enum: [income, expense, transfer]
   *                 description: Category type
   *               color:
   *                 type: string
   *                 description: Category color (hex format)
   *                 example: "#FF5733"
   *               icon:
   *                 type: string
   *                 description: Category icon name
   *                 example: "utensils"
   *             example:
   *               user_id: "456e7890-e89b-12d3-a456-426614174001"
   *               name: "Food"
   *               type: "expense"
   *               color: "#FF5733"
   *               icon: "utensils"
   *     responses:
   *       201:
   *         description: Category created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Category'
   *       400:
   *         description: Invalid input data
   *       409:
   *         description: Category with this name already exists for this user
   */
  router.post('/', validateCreateCategory, async (req, res, next) => {
    try {
      const categoryData: CreateCategoryDTO = req.body;
      const category = await transactionService.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /categories:
   *   get:
   *     summary: List all categories for a user
   *     tags: [Categories]
   *     parameters:
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *         required: true
   *         description: User ID
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [income, expense, transfer]
   *         description: Filter by category type
   *     responses:
   *       200:
   *         description: List of user categories
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Category'
   *       400:
   *         description: User ID not provided
   */
  router.get('/', async (req, res, next) => {
    try {
      const { userId, type } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({ message: 'userId is required' });
        return;
      }

      let categories;
      if (type && typeof type === 'string') {
        categories = await transactionService.getCategoriesByUserIdAndType(userId, type);
      } else {
        categories = await transactionService.getCategoriesByUserId(userId);
      }
      
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /categories/{id}:
   *   get:
   *     summary: Get category by ID
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID
   *     responses:
   *       200:
   *         description: Category details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Category'
   *       404:
   *         description: Category not found
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const category = await transactionService.getCategoryById(req.params.id);
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /categories/{id}:
   *   put:
   *     summary: Update an existing category
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID to update
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Category name
   *               type:
   *                 type: string
   *                 enum: [income, expense, transfer]
   *                 description: Category type
   *               color:
   *                 type: string
   *                 description: Category color (hex format)
   *               icon:
   *                 type: string
   *                 description: Category icon name
   *     responses:
   *       200:
   *         description: Category updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Category'
   *       400:
   *         description: Invalid input data
   *       404:
   *         description: Category not found
   *       409:
   *         description: Category with this name already exists for this user
   */
  router.put('/:id', validateUpdateCategory, async (req, res, next) => {
    try {
      const categoryData: UpdateCategoryDTO = req.body;
      const category = await transactionService.updateCategory(req.params.id, categoryData);
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /categories/{id}:
   *   delete:
   *     summary: Delete a category
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID to delete
   *     responses:
   *       204:
   *         description: Category deleted successfully
   *       404:
   *         description: Category not found
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const success = await transactionService.deleteCategory(req.params.id);
      if (!success) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
} 