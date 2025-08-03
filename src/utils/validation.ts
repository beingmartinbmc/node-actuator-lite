export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InputValidator {
  /**
   * Validates and sanitizes a string input
   */
  static validateString(value: any, fieldName: string, options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: string[];
  } = {}): string {
    const { required = true, minLength, maxLength, pattern, allowedValues } = options;

    // Check if required
    if (required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }

    // If not required and value is empty, return empty string
    if (!required && (value === undefined || value === null || value === '')) {
      return '';
    }

    // Ensure it's a string
    const stringValue = String(value).trim();

    // Check minimum length
    if (minLength !== undefined && stringValue.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`, fieldName);
    }

    // Check maximum length
    if (maxLength !== undefined && stringValue.length > maxLength) {
      throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters long`, fieldName);
    }

    // Check pattern
    if (pattern && !pattern.test(stringValue)) {
      throw new ValidationError(`${fieldName} does not match required pattern`, fieldName);
    }

    // Check allowed values
    if (allowedValues && !allowedValues.includes(stringValue)) {
      throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`, fieldName);
    }

    return stringValue;
  }

  /**
   * Validates and sanitizes a number input
   */
  static validateNumber(value: any, fieldName: string, options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}): number {
    const { required = true, min, max, integer = false } = options;

    // Check if required
    if (required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }

    // If not required and value is empty, return 0
    if (!required && (value === undefined || value === null || value === '')) {
      return 0;
    }

    // Convert to number
    const numValue = Number(value);

    // Check if it's a valid number
    if (isNaN(numValue)) {
      throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
    }

    // Check if integer is required
    if (integer && !Number.isInteger(numValue)) {
      throw new ValidationError(`${fieldName} must be an integer`, fieldName);
    }

    // Check minimum value
    if (min !== undefined && numValue < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName);
    }

    // Check maximum value
    if (max !== undefined && numValue > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`, fieldName);
    }

    return numValue;
  }

  /**
   * Validates and sanitizes a boolean input
   */
  static validateBoolean(value: any, fieldName: string, options: {
    required?: boolean;
  } = {}): boolean {
    const { required = true } = options;

    // Check if required
    if (required && (value === undefined || value === null)) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }

    // If not required and value is empty, return false
    if (!required && (value === undefined || value === null)) {
      return false;
    }

    // Convert to boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      } else {
        throw new ValidationError(`${fieldName} must be a valid boolean value`, fieldName);
      }
    }

    return Boolean(value);
  }

  /**
   * Validates and sanitizes an object input
   */
  static validateObject(value: any, fieldName: string, options: {
    required?: boolean;
    schema?: Record<string, any>;
  } = {}): Record<string, any> {
    const { required = true, schema } = options;

    // Check if required
    if (required && (value === undefined || value === null)) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }

    // If not required and value is empty, return empty object
    if (!required && (value === undefined || value === null)) {
      return {};
    }

    // Ensure it's an object
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an object`, fieldName);
    }

    const objValue = { ...value };

    // Validate against schema if provided
    if (schema) {
      for (const [key, validationRule] of Object.entries(schema)) {
        if (objValue.hasOwnProperty(key)) {
          try {
            if (validationRule.type === 'string') {
              objValue[key] = this.validateString(objValue[key], `${fieldName}.${key}`, validationRule);
            } else if (validationRule.type === 'number') {
              objValue[key] = this.validateNumber(objValue[key], `${fieldName}.${key}`, validationRule);
            } else if (validationRule.type === 'boolean') {
              objValue[key] = this.validateBoolean(objValue[key], `${fieldName}.${key}`, validationRule);
            }
          } catch (error) {
            if (error instanceof ValidationError) {
              throw error;
            }
            throw new ValidationError(`Invalid ${key} in ${fieldName}`, `${fieldName}.${key}`);
          }
        } else if (validationRule.required) {
          throw new ValidationError(`${fieldName}.${key} is required`, `${fieldName}.${key}`);
        }
      }
    }

    return objValue;
  }

  /**
   * Sanitizes HTML content to prevent XSS
   */
  static sanitizeHtml(html: string): string {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validates URL format
   */
  static validateUrl(url: string, fieldName: string = 'url'): string {
    try {
      const urlValue = this.validateString(url, fieldName, { required: true });
      new URL(urlValue); // This will throw if invalid
      return urlValue;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`${fieldName} must be a valid URL`, fieldName);
    }
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string, fieldName: string = 'email'): string {
    const emailValue = this.validateString(email, fieldName, { required: true });
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailPattern.test(emailValue)) {
      throw new ValidationError(`${fieldName} must be a valid email address`, fieldName);
    }

    return emailValue;
  }
} 