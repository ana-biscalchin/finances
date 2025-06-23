import { Request, Response, NextFunction } from 'express';
import { validateCreateCategory, validateUpdateCategory } from '../../../middlewares/validators/category-validator';

describe('Category Validator Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe('validateCreateCategory', () => {
    it('should call next when all required fields are valid', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when all fields including optional ones are valid', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        color: '#FF5733',
        icon: 'utensils',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when user_id is missing', () => {
      mockRequest.body = {
        name: 'Food',
        type: 'expense',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          user_id: { _errors: ['Required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when name is missing', () => {
      mockRequest.body = {
        user_id: 'user123',
        type: 'expense',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          name: { _errors: ['Required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when type is missing', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          type: { _errors: ['Category type must be either income, expense, or transfer'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when type is invalid', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'invalid_type',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          type: { _errors: ['Category type must be either income, expense, or transfer'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when color format is invalid', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        color: 'invalid_color',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          color: { _errors: ['Color must be a valid hex color (e.g., #FF5733)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when icon is too long', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        icon: 'a'.repeat(51),
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          icon: { _errors: ['Icon name must be less than 50 characters'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next when color is valid hex format', () => {
      mockRequest.body = {
        user_id: 'user123',
        name: 'Food',
        type: 'expense',
        color: '#FF5733',
      };

      validateCreateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('validateUpdateCategory', () => {
    it('should call next when no fields are provided', () => {
      mockRequest.body = {};

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when all provided fields are valid', () => {
      mockRequest.body = {
        name: 'Updated Food',
        type: 'income',
        color: '#00FF00',
        icon: 'updated-icon',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when type is invalid', () => {
      mockRequest.body = {
        type: 'invalid_type',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          type: { _errors: ['Category type must be either income, expense, or transfer'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when color format is invalid', () => {
      mockRequest.body = {
        color: 'invalid_color',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          color: { _errors: ['Color must be a valid hex color (e.g., #FF5733)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when icon is too long', () => {
      mockRequest.body = {
        icon: 'a'.repeat(51),
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          icon: { _errors: ['Icon name must be less than 50 characters'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next when only name is provided and valid', () => {
      mockRequest.body = {
        name: 'New Category Name',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when only type is provided and valid', () => {
      mockRequest.body = {
        type: 'income',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when only color is provided and valid', () => {
      mockRequest.body = {
        color: '#0000FF',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when only icon is provided and valid', () => {
      mockRequest.body = {
        icon: 'new-icon',
      };

      validateUpdateCategory(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
}); 