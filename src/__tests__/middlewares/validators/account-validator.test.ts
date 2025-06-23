import { Request, Response, NextFunction } from 'express';
import { validateCreateAccount, validateUpdateAccount } from '../../../middlewares/validators/account-validator';

describe('Account Validator Middleware', () => {
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

  describe('validateCreateAccount', () => {
    it('should call next when all fields are valid', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'checking',
        payment_method_ids: ['payment123'],
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'checking',
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          payment_method_ids: { _errors: ['Required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when currency code is invalid', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'US',
        account_type: 'checking',
        payment_method_ids: ['payment123'],
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          currency: { _errors: ['Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when account type is invalid', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'invalid_type',
        payment_method_ids: ['payment123'],
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          account_type: { _errors: ['Invalid account type'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when initial balance is not a number', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 'not_a_number',
        currency: 'USD',
        account_type: 'checking',
        payment_method_ids: ['payment123'],
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          initial_balance: { _errors: ['Initial balance must be a number'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when payment method ids array is empty', () => {
      mockRequest.body = {
        user_id: 'user123',
        institution_name: 'Test Bank',
        initial_balance: 1000,
        currency: 'USD',
        account_type: 'checking',
        payment_method_ids: [],
      };

      validateCreateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          payment_method_ids: { _errors: ['At least one payment method is required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('validateUpdateAccount', () => {
    it('should call next when no fields are provided', () => {
      mockRequest.body = {};

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when all provided fields are valid', () => {
      mockRequest.body = {
        institution_name: 'Updated Bank',
        initial_balance: 2000,
        currency: 'EUR',
        account_type: 'savings',
        payment_method_ids: ['payment123', 'payment456'],
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 when currency code is invalid', () => {
      mockRequest.body = {
        currency: 'US',
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          currency: { _errors: ['Currency code must be exactly 3 uppercase letters (e.g., BRL, USD)'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when account type is invalid', () => {
      mockRequest.body = {
        account_type: 'invalid_type',
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          account_type: { _errors: ['Invalid account type'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when initial balance is not a number', () => {
      mockRequest.body = {
        initial_balance: 'not_a_number',
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          initial_balance: { _errors: ['Initial balance must be a number'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when payment method ids array is empty', () => {
      mockRequest.body = {
        payment_method_ids: [],
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: {
          payment_method_ids: { _errors: ['At least one payment method is required'] },
          _errors: []
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next when institution name is provided and valid', () => {
      mockRequest.body = {
        institution_name: 'New Bank Name',
      };

      validateUpdateAccount(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
}); 