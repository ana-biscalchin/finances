import request from 'supertest';
import express, { Application } from 'express';
import { TransactionService } from '../../domains/transactions/service';
import { Category } from '../../domains/transactions/types';
import createCategoriesRouter from '../../routes/categories';
import { errorHandler } from '../../middlewares/errorHandler';

jest.mock('../../domains/transactions/service');

describe('Categories Routes', () => {
  let mockTransactionService: jest.Mocked<TransactionService>;
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionService = new TransactionService() as jest.Mocked<TransactionService>;
    (TransactionService as jest.MockedClass<typeof TransactionService>).mockImplementation(() => mockTransactionService);
    app = express();
    app.use(express.json());
    app.use('/categories', createCategoriesRouter());
    app.use(errorHandler);
  });

  describe('POST /categories', () => {
    const validCategoryData = {
      user_id: 'user123',
      name: 'Food',
      type: 'expense',
      color: '#FF5733',
      icon: 'utensils'
    };

    const mockCategory: Category = {
      id: 'category123',
      user_id: 'user123',
      name: 'Food',
      type: 'expense',
      color: '#FF5733',
      icon: 'utensils',
      created_at: new Date('2023-01-10T10:00:00Z'),
      updated_at: new Date('2023-01-10T10:00:00Z')
    };

    it('should create a category successfully', async () => {
      mockTransactionService.createCategory.mockResolvedValue(mockCategory);

      const response = await request(app)
        .post('/categories')
        .send(validCategoryData)
        .expect(201);

      expect(response.body).toEqual({
        ...mockCategory,
        created_at: mockCategory.created_at.toISOString(),
        updated_at: mockCategory.updated_at.toISOString()
      });
      expect(mockTransactionService.createCategory).toHaveBeenCalledWith(validCategoryData);
    });

    it('should return 400 when user_id is missing', async () => {
      const invalidData = {
        name: 'Food',
        type: 'expense'
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.user_id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      const invalidData = {
        user_id: 'user123',
        type: 'expense'
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.name).toBeDefined();
    });

    it('should return 400 when type is missing', async () => {
      const invalidData = {
        user_id: 'user123',
        name: 'Food'
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.type).toBeDefined();
    });

    it('should return 400 when type is invalid', async () => {
      const invalidData = {
        user_id: 'user123',
        name: 'Food',
        type: 'invalid_type'
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.type).toBeDefined();
    });

    it('should return 400 when color format is invalid', async () => {
      const invalidData = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        color: 'invalid_color'
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.color).toBeDefined();
    });

    it('should return 400 when icon is too long', async () => {
      const invalidData = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        icon: 'a'.repeat(51)
      };

      const response = await request(app)
        .post('/categories')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.icon).toBeDefined();
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockTransactionService.createCategory.mockRejectedValue(error);

      const response = await request(app)
        .post('/categories')
        .send(validCategoryData)
        .expect(500);

      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /categories', () => {
    const mockCategories: Category[] = [
      {
        id: 'category1',
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        color: '#FF5733',
        icon: 'utensils',
        created_at: new Date('2023-01-10T10:00:00Z'),
        updated_at: new Date('2023-01-10T10:00:00Z')
      },
      {
        id: 'category2',
        user_id: 'user123',
        name: 'Salary',
        type: 'income',
        color: '#00FF00',
        icon: 'money',
        created_at: new Date('2023-01-10T10:00:00Z'),
        updated_at: new Date('2023-01-10T10:00:00Z')
      }
    ];

    it('should return all categories for a user', async () => {
      mockTransactionService.getCategoriesByUserId.mockResolvedValue(mockCategories);

      const response = await request(app)
        .get('/categories')
        .query({ userId: 'user123' })
        .expect(200);

      expect(response.body).toEqual(mockCategories.map(category => ({
        ...category,
        created_at: category.created_at.toISOString(),
        updated_at: category.updated_at.toISOString()
      })));
      expect(mockTransactionService.getCategoriesByUserId).toHaveBeenCalledWith('user123');
    });

    it('should return categories filtered by type', async () => {
      const expenseCategories = mockCategories.filter(c => c.type === 'expense');
      mockTransactionService.getCategoriesByUserIdAndType.mockResolvedValue(expenseCategories);

      const response = await request(app)
        .get('/categories')
        .query({ userId: 'user123', type: 'expense' })
        .expect(200);

      expect(response.body).toEqual(expenseCategories.map(category => ({
        ...category,
        created_at: category.created_at.toISOString(),
        updated_at: category.updated_at.toISOString()
      })));
      expect(mockTransactionService.getCategoriesByUserIdAndType).toHaveBeenCalledWith('user123', 'expense');
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .get('/categories')
        .expect(400);

      expect(response.body.message).toBe('userId is required');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockTransactionService.getCategoriesByUserId.mockRejectedValue(error);

      const response = await request(app)
        .get('/categories')
        .query({ userId: 'user123' })
        .expect(500);

      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /categories/:id', () => {
    const mockCategory: Category = {
      id: 'category123',
      user_id: 'user123',
      name: 'Food',
      type: 'expense',
      color: '#FF5733',
      icon: 'utensils',
      created_at: new Date('2023-01-10T10:00:00Z'),
      updated_at: new Date('2023-01-10T10:00:00Z')
    };

    it('should return a category by ID', async () => {
      mockTransactionService.getCategoryById.mockResolvedValue(mockCategory);

      const response = await request(app)
        .get('/categories/category123')
        .expect(200);

      expect(response.body).toEqual({
        ...mockCategory,
        created_at: mockCategory.created_at.toISOString(),
        updated_at: mockCategory.updated_at.toISOString()
      });
      expect(mockTransactionService.getCategoryById).toHaveBeenCalledWith('category123');
    });

    it('should return 404 when category is not found', async () => {
      mockTransactionService.getCategoryById.mockResolvedValue(null);

      const response = await request(app)
        .get('/categories/nonexistent')
        .expect(404);

      expect(response.body.message).toBe('Category not found');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockTransactionService.getCategoryById.mockRejectedValue(error);

      const response = await request(app)
        .get('/categories/category123')
        .expect(500);

      expect(response.body.message).toBe('Database error');
    });
  });

  describe('PUT /categories/:id', () => {
    const updateData = {
      name: 'Updated Food',
      type: 'income',
      color: '#00FF00',
      icon: 'updated-icon'
    };

    const updatedCategory: Category = {
      id: 'category123',
      user_id: 'user123',
      name: 'Updated Food',
      type: 'income',
      color: '#00FF00',
      icon: 'updated-icon',
      created_at: new Date('2023-01-10T10:00:00Z'),
      updated_at: new Date('2023-01-10T11:00:00Z')
    };

    it('should update a category successfully', async () => {
      mockTransactionService.updateCategory.mockResolvedValue(updatedCategory);

      const response = await request(app)
        .put('/categories/category123')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        ...updatedCategory,
        created_at: updatedCategory.created_at.toISOString(),
        updated_at: updatedCategory.updated_at.toISOString()
      });
      expect(mockTransactionService.updateCategory).toHaveBeenCalledWith('category123', updateData);
    });

    it('should return 404 when category is not found', async () => {
      mockTransactionService.updateCategory.mockResolvedValue(null);

      const response = await request(app)
        .put('/categories/nonexistent')
        .send(updateData)
        .expect(404);

      expect(response.body.message).toBe('Category not found');
    });

    it('should return 400 when type is invalid', async () => {
      const invalidData = {
        type: 'invalid_type'
      };

      const response = await request(app)
        .put('/categories/category123')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.type).toBeDefined();
    });

    it('should return 400 when color format is invalid', async () => {
      const invalidData = {
        color: 'invalid_color'
      };

      const response = await request(app)
        .put('/categories/category123')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.color).toBeDefined();
    });

    it('should return 400 when icon is too long', async () => {
      const invalidData = {
        icon: 'a'.repeat(51)
      };

      const response = await request(app)
        .put('/categories/category123')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.icon).toBeDefined();
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockTransactionService.updateCategory.mockRejectedValue(error);

      const response = await request(app)
        .put('/categories/category123')
        .send(updateData)
        .expect(500);

      expect(response.body.message).toBe('Database error');
    });
  });

  describe('DELETE /categories/:id', () => {
    it('should delete a category successfully', async () => {
      mockTransactionService.deleteCategory.mockResolvedValue(true);

      await request(app)
        .delete('/categories/category123')
        .expect(204);

      expect(mockTransactionService.deleteCategory).toHaveBeenCalledWith('category123');
    });

    it('should return 404 when category is not found', async () => {
      mockTransactionService.deleteCategory.mockResolvedValue(false);

      const response = await request(app)
        .delete('/categories/nonexistent')
        .expect(404);

      expect(response.body.message).toBe('Category not found');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockTransactionService.deleteCategory.mockRejectedValue(error);

      const response = await request(app)
        .delete('/categories/category123')
        .expect(500);

      expect(response.body.message).toBe('Database error');
    });
  });
}); 