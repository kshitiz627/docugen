/**
 * Error handling utilities for DocuGen
 * Provides custom error classes and error sanitization
 */

export class DocGenError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'DocGenError';
  }
}

export class ValidationError extends DocGenError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', false, details);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends DocGenError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHORIZATION_ERROR', false, details);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends DocGenError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', true, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends DocGenError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', true, details);
    this.name = 'NetworkError';
  }
}

export function sanitizeErrorMessage(error: any): string {
  // Never expose sensitive information in error messages
  const errorString = String(error);
  
  // Remove potential secrets
  let sanitized = errorString
    .replace(/Bearer [A-Za-z0-9\-._~+\/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/key=["']?[^"'\s]+["']?/gi, 'key=[REDACTED]')
    .replace(/token=["']?[^"'\s]+["']?/gi, 'token=[REDACTED]')
    .replace(/password=["']?[^"'\s]+["']?/gi, 'password=[REDACTED]')
    .replace(/secret=["']?[^"'\s]+["']?/gi, 'secret=[REDACTED]')
    .replace(/\/\/[^:]+:[^@]+@/g, '//[REDACTED]@'); // URL credentials
  
  // Remove file paths that might contain usernames
  sanitized = sanitized.replace(/\/(?:home|Users)\/[^\/\s]+/g, '/[USER_PATH]');
  
  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // If the error message is too long, truncate it
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...';
  }
  
  return sanitized;
}

export function classifyError(error: any): { code: string; retryable: boolean; message: string } {
  const message = sanitizeErrorMessage(error);
  
  // Check for specific error patterns
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return { code: 'NETWORK_ERROR', retryable: true, message };
  }
  
  if (error.code === 401 || message.includes('401')) {
    return { code: 'AUTHORIZATION_ERROR', retryable: false, message };
  }
  
  if (error.code === 403 || message.includes('403')) {
    return { code: 'PERMISSION_ERROR', retryable: false, message };
  }
  
  if (error.code === 429 || message.includes('429') || message.includes('quota')) {
    return { code: 'RATE_LIMIT_ERROR', retryable: true, message };
  }
  
  if (error.code === 404 || message.includes('404')) {
    return { code: 'NOT_FOUND_ERROR', retryable: false, message };
  }
  
  if (error.code >= 500 || message.includes('500') || message.includes('502') || message.includes('503')) {
    return { code: 'SERVER_ERROR', retryable: true, message };
  }
  
  return { code: 'UNKNOWN_ERROR', retryable: false, message };
}