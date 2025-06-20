import { Request, Response, NextFunction } from 'express';
import { validateCreatePaymentMethod, validateUpdatePaymentMethod, validateAssociatePaymentMethod } from '../../../middlewares/validators/payment-method-validator';

describe('Payment Method Validators', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('validateCreatePaymentMethod', () => {
    it('should call next() for valid payment method data', () => {
      mockRequest.body = {
        name: 'Credit Card',
      };

      validateCreatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for missing name', () => {
      mockRequest.body = {};

      validateCreatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for empty name', () => {
      mockRequest.body = {
        name: '',
      };

      validateCreatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for name too long', () => {
      mockRequest.body = {
        name: 'a'.repeat(256),
      };

      validateCreatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid data type', () => {
      mockRequest.body = {
        name: 123,
      };

      validateCreatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateUpdatePaymentMethod', () => {
    it('should call next() for valid payment method data', () => {
      mockRequest.body = {
        name: 'Updated Credit Card',
      };

      validateUpdatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for missing name', () => {
      mockRequest.body = {};

      validateUpdatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for empty name', () => {
      mockRequest.body = {
        name: '',
      };

      validateUpdatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for name too long', () => {
      mockRequest.body = {
        name: 'a'.repeat(256),
      };

      validateUpdatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid payment method data' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateAssociatePaymentMethod', () => {
    it('should call next() for valid association data', () => {
      mockRequest.body = {
        account_id: 'account123',
        payment_method_id: 'payment123',
      };

      validateAssociatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for missing payment_method_id', () => {
      mockRequest.body = {};

      validateAssociatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid association data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for empty payment_method_id', () => {
      mockRequest.body = {
        payment_method_id: '',
      };

      validateAssociatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid association data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid payment_method_id type', () => {
      mockRequest.body = {
        payment_method_id: 123,
      };

      validateAssociatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid association data' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for additional invalid fields', () => {
      mockRequest.body = {
        payment_method_id: 'payment123',
        invalid_field: 'should_not_be_here',
      };

      validateAssociatePaymentMethod(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid association data' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
}); 