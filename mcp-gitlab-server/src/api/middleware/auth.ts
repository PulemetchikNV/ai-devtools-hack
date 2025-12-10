import { Request, Response, NextFunction } from 'express';
import { config } from '../../config.js';

/**
 * API Key authentication middleware
 * Expects the API key in the X-API-Key header
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header',
    });
    return;
  }
  
  if (apiKey !== config.apiKey) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }
  
  next();
}

/**
 * Optional API key auth - allows unauthenticated access but marks the request
 */
export function optionalApiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey === config.apiKey) {
    (req as Request & { isAuthenticated: boolean }).isAuthenticated = true;
  } else {
    (req as Request & { isAuthenticated: boolean }).isAuthenticated = false;
  }
  
  next();
}

