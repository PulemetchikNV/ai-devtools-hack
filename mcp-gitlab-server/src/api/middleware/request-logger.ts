import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

/**
 * HTTP request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log request body for POST/PUT/PATCH (but not for MCP - handled separately)
  if (!req.path.startsWith('/mcp') && ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    logger.debug('HTTP', `Request body for ${req.method} ${req.path}`, sanitizeBody(req.body));
  }
  
  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Skip MCP requests - they have their own logging
    if (req.path.startsWith('/mcp')) {
      return;
    }
    
    logger.http(req.method, req.path, res.statusCode, duration);
  });
  
  next();
}

/**
 * Sanitize request body for logging (hide sensitive data)
 */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  
  // Hide sensitive fields
  const sensitiveFields = ['access_token', 'token', 'password', 'secret', 'api_key'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

