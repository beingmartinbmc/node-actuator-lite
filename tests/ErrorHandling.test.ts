import { ErrorHandler, UnauthorizedError } from '../src/utils/errorHandler';
import { InputValidator, ValidationError } from '../src/utils/validation';
import { CircuitBreaker, CircuitBreakerState } from '../src/utils/circuitBreaker';
import { Retry } from '../src/utils/retry';

describe('Error Handling and Resilience', () => {
  describe('ErrorHandler', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
        headers: {},
        get: jest.fn()
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should handle ValidationError correctly', () => {
      const error = new ValidationError('Invalid input', 'field');
      ErrorHandler.handleError(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ValidationError',
          message: 'Invalid input',
          statusCode: 400
        })
      );
    });

    test('should handle UnauthorizedError correctly', () => {
      const error = new UnauthorizedError();
      ErrorHandler.handleError(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UnauthorizedError',
          message: 'Unauthorized',
          statusCode: 401
        })
      );
    });



    test('should handle generic errors correctly', () => {
      const error = new Error('Something went wrong');
      ErrorHandler.handleError(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error',
          message: 'Internal Server Error',
          statusCode: 500
        })
      );
    });

    test('should generate request ID if not present', () => {
      const error = new Error('Test error');
      ErrorHandler.handleError(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/)
        })
      );
    });

    test('should use existing request ID if present', () => {
      mockReq.headers['x-request-id'] = 'existing-id';
      const error = new Error('Test error');
      ErrorHandler.handleError(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'existing-id'
        })
      );
    });
  });

  describe('InputValidator', () => {
    test('should validate required string', () => {
      expect(() => InputValidator.validateString('', 'test', { required: true }))
        .toThrow(ValidationError);
      
      expect(InputValidator.validateString('valid', 'test', { required: true }))
        .toBe('valid');
    });

    test('should validate string length constraints', () => {
      expect(() => InputValidator.validateString('ab', 'test', { minLength: 3 }))
        .toThrow(ValidationError);
      
      expect(() => InputValidator.validateString('abcdef', 'test', { maxLength: 3 }))
        .toThrow(ValidationError);
      
      expect(InputValidator.validateString('abc', 'test', { minLength: 3, maxLength: 3 }))
        .toBe('abc');
    });

    test('should validate string pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(() => InputValidator.validateString('invalid-email', 'email', { pattern: emailPattern }))
        .toThrow(ValidationError);
      
      expect(InputValidator.validateString('test@example.com', 'email', { pattern: emailPattern }))
        .toBe('test@example.com');
    });

    test('should validate allowed values', () => {
      const allowedValues = ['option1', 'option2', 'option3'];
      
      expect(() => InputValidator.validateString('invalid', 'option', { allowedValues }))
        .toThrow(ValidationError);
      
      expect(InputValidator.validateString('option1', 'option', { allowedValues }))
        .toBe('option1');
    });

    test('should validate numbers', () => {
      expect(() => InputValidator.validateNumber('not-a-number', 'test'))
        .toThrow(ValidationError);
      
      expect(InputValidator.validateNumber(42, 'test', { min: 0, max: 100 }))
        .toBe(42);
      
      expect(() => InputValidator.validateNumber(150, 'test', { max: 100 }))
        .toThrow(ValidationError);
    });

    test('should validate booleans', () => {
      expect(InputValidator.validateBoolean('true', 'test')).toBe(true);
      expect(InputValidator.validateBoolean('false', 'test')).toBe(false);
      expect(InputValidator.validateBoolean('1', 'test')).toBe(true);
      expect(InputValidator.validateBoolean('0', 'test')).toBe(false);
      
      expect(() => InputValidator.validateBoolean('invalid', 'test'))
        .toThrow(ValidationError);
    });

    test('should validate URLs', () => {
      expect(InputValidator.validateUrl('https://example.com')).toBe('https://example.com');
      expect(() => InputValidator.validateUrl('not-a-url')).toThrow(ValidationError);
    });

    test('should validate emails', () => {
      expect(InputValidator.validateEmail('test@example.com')).toBe('test@example.com');
      expect(() => InputValidator.validateEmail('not-an-email')).toThrow(ValidationError);
    });

    test('should sanitize HTML', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = InputValidator.sanitizeHtml(input);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000
      });
    });

    test('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    test('should execute successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    test('should open circuit after failure threshold', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      
      // Execute operations up to failure threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // Next execution should be blocked
      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow('Circuit breaker is OPEN - operation blocked');
    });

    test('should transition to HALF_OPEN after recovery timeout', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should transition to HALF_OPEN when attempting to execute
      // The circuit will transition to HALF_OPEN, then immediately back to OPEN due to failure
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
      
      // After the failure in HALF_OPEN state, it should go back to OPEN
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    test('should reset to CLOSED after successful operation in HALF_OPEN', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      const successfulOperation = jest.fn().mockResolvedValue('success');
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Execute successful operation
      const result = await circuitBreaker.execute(successfulOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Retry', () => {
    test('should execute successful operation without retries', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const retry = new Retry({ maxAttempts: 3 });
      
      const result = await retry.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry failed operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');
      
      const retry = new Retry({ maxAttempts: 3, delay: 10 });
      
      const result = await retry.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should fail after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
      const retry = new Retry({ maxAttempts: 2, delay: 10 });
      
      await expect(retry.execute(operation))
        .rejects.toThrow('ECONNRESET');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Validation failed'));
      const retry = new Retry({ maxAttempts: 3, delay: 10 });
      
      await expect(retry.execute(operation))
        .rejects.toThrow('Validation failed');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should use exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');
      
      const retry = new Retry({ 
        maxAttempts: 3, 
        delay: 100, 
        backoffMultiplier: 2 
      });
      
      const startTime = Date.now();
      await retry.execute(operation);
      const endTime = Date.now();
      
      // Should have waited at least 100ms + 200ms = 300ms
      // Use a more generous tolerance to account for timing variations
      expect(endTime - startTime).toBeGreaterThan(250);
      
      // Verify the operation was called the expected number of times
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should respect max delay', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');
      
      const retry = new Retry({ 
        maxAttempts: 3, 
        delay: 1000, 
        backoffMultiplier: 10,
        maxDelay: 2000
      });
      
      const startTime = Date.now();
      await retry.execute(operation);
      const endTime = Date.now();
      
      // Should not exceed max delay by too much
      // Use a more generous tolerance to account for timing variations
      expect(endTime - startTime).toBeLessThan(6000);
      
      // Verify the operation was called the expected number of times
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });


}); 