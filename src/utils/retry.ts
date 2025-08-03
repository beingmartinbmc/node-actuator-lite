import logger from './logger';

export interface RetryOptions {
  maxAttempts: number;
  delay: number; // Initial delay in ms
  backoffMultiplier: number; // Multiplier for exponential backoff
  maxDelay: number; // Maximum delay in ms
  retryCondition?: (error: Error) => boolean; // Function to determine if error should be retried
}

export class Retry {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 1000,
      backoffMultiplier: options.backoffMultiplier || 2,
      maxDelay: options.maxDelay || 10000,
      retryCondition: options.retryCondition || this.defaultRetryCondition
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let currentDelay = this.options.delay;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        if (attempt === this.options.maxAttempts || !this.options.retryCondition!(lastError)) {
          throw lastError;
        }

        logger.warn({ 
          attempt, 
          maxAttempts: this.options.maxAttempts, 
          error: lastError.message 
        }, `Operation failed, retrying in ${currentDelay}ms`);

        // Wait before retry
        await this.sleep(currentDelay);
        
        // Calculate next delay with exponential backoff
        currentDelay = Math.min(
          currentDelay * this.options.backoffMultiplier,
          this.options.maxDelay
        );
      }
    }

    throw lastError!;
  }

  private defaultRetryCondition(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN'
    ];

    return retryableErrors.some(code => error.message.includes(code));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Convenience function for simple retry operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const retry = new Retry(options);
  return retry.execute(operation);
} 