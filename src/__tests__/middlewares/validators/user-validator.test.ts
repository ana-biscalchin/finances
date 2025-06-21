import { Request, Response, NextFunction } from 'express';
import { validateCreateUser, validateUpdateUser } from '../../../middlewares/validators/user-validator';

describe('User Validator Middleware', () => {
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

  describe('validateCreateUser', () => {
    it('should call next when all fields are valid', () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'USD',
      };

      validateCreateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
      };

      validateCreateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          default_currency: { _errors: ['Required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when currency code is invalid', () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        default_currency: 'US',
      };

      validateCreateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          default_currency: { _errors: ['Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('validateUpdateUser', () => {
    it('should call next when no currency is provided', () => {
      mockRequest.body = {
        name: 'Test User',
      };

      validateUpdateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when currency is valid', () => {
      mockRequest.body = {
        default_currency: 'USD',
      };

      validateUpdateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when currency code is invalid', () => {
      mockRequest.body = {
        default_currency: 'US',
      };

      validateUpdateUser(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          default_currency: { _errors: ['Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
}); 