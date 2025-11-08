/**
 * Structured logging utility for TomoTV
 * Provides consistent logging with levels, timestamps, and context
 *
 * Usage:
 *   logger.info('User logged in', { userId: '123' })
 *   logger.error('Failed to fetch', error, { context: 'API' })
 *   logger.debug('Processing', { step: 1 })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = __DEV__;
    // In production, only log warnings and errors
    this.minLevel = this.isDevelopment ? 'debug' : 'warn';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    return currentLevelIndex >= minLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);

    let formattedMessage = `[${timestamp}] ${levelUpper} ${message}`;

    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context)}`;
    }

    return formattedMessage;
  }

  private log(level: LogLevel, message: string, error?: Error | any, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        if (error) {
          console.error(error);
        }
        break;
    }

    // TODO: Send to crash reporting service (e.g., Sentry) when available
    // if (level === 'error' && error) {
    //   Sentry.captureException(error, { contexts: { custom: context } });
    // }
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, undefined, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, undefined, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, undefined, context);
  }

  /**
   * Log error messages with optional error object
   */
  error(message: string, error?: Error | any, context?: LogContext): void {
    this.log('error', message, error, context);
  }
}

// Export singleton instance
export const logger = new Logger();
