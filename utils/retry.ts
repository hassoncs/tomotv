/**
 * Retry utility with exponential backoff
 * Automatically retries failed operations with increasing delays
 */

import {logger} from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: ['timeout', 'network', 'fetch', 'ECONNREFUSED', 'ETIMEDOUT']
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || String(error).toLowerCase();

  return retryableErrors.some((retryable) => errorMessage.includes(retryable.toLowerCase()));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, multiplier: number): number {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries fail
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3 }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = {...DEFAULT_OPTIONS, ...options};
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          service: 'RetryUtil',
          attempt,
          totalAttempts: opts.maxAttempts
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      const isRetryable = isRetryableError(error, opts.retryableErrors);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!isRetryable) {
        logger.warn('Error is not retryable, failing immediately', {
          service: 'RetryUtil',
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      if (isLastAttempt) {
        logger.error('All retry attempts exhausted', error, {
          service: 'RetryUtil',
          attempts: opts.maxAttempts
        });
        throw error;
      }

      const delay = calculateDelay(attempt, opts.initialDelayMs, opts.maxDelayMs, opts.backoffMultiplier);

      logger.warn('Operation failed, retrying with backoff', {
        service: 'RetryUtil',
        attempt,
        totalAttempts: opts.maxAttempts,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error)
      });

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
