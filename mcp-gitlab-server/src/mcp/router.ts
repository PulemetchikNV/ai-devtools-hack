import { Router, Request, Response } from 'express';
import { processRequest, processBatch } from './server.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * MCP JSON-RPC endpoint
 * 
 * Accepts JSON-RPC 2.0 requests and returns JSON-RPC 2.0 responses.
 * Supports both single requests and batch requests.
 * 
 * @example Single request:
 * POST /mcp
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "tools/list"
 * }
 * 
 * @example Batch request:
 * POST /mcp
 * [
 *   { "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...} },
 *   { "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
 * ]
 */
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const body = req.body;
  
  // Validate that we have a body
  if (!body) {
    logger.warn('MCP', 'Received empty body');
    res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error: empty body',
      },
    });
    return;
  }
  
  try {
    // Handle batch requests
    if (Array.isArray(body)) {
      if (body.length === 0) {
        logger.warn('MCP', 'Received empty batch');
        res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32600,
            message: 'Invalid Request: empty batch',
          },
        });
        return;
      }
      
      logger.debug('MCP', `Processing batch of ${body.length} requests`);
      const responses = await processBatch(body);
      
      // Log each request in batch
      body.forEach((req: { method?: string; id?: string | number }, i: number) => {
        const resp = responses[i] as { error?: unknown } | undefined;
        const isError = resp && 'error' in resp;
        logger.mcp(req.method || 'unknown', req.id ?? null, Date.now() - startTime, isError);
      });
      
      // If all requests were notifications, return empty (per JSON-RPC spec)
      if (responses.length === 0) {
        res.status(204).send();
        return;
      }
      
      res.json(responses);
      return;
    }
    
    // Handle single request
    const method = body.method || 'unknown';
    const id = body.id ?? null;
    
    logger.debug('MCP', `Processing request: ${method}`, {
      id,
      params: sanitizeMcpParams(body.params),
    });
    
    const response = await processRequest(body);
    const duration = Date.now() - startTime;
    const isError = response !== null && 'error' in response;
    
    logger.mcp(method, id, duration, isError);
    
    if (isError) {
      logger.debug('MCP', `Error response for ${method}`, (response as { error: unknown }).error);
    }
    
    // Notification - no response
    if (response === null) {
      res.status(204).send();
      return;
    }
    
    res.json(response);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('MCP', 'Request failed with exception', error);
    logger.mcp(body.method || 'unknown', body.id ?? null, duration, true);
    
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
});

/**
 * Sanitize MCP params for logging (hide sensitive data)
 */
function sanitizeMcpParams(params: unknown): unknown {
  if (!params || typeof params !== 'object') return params;
  
  const sanitized = { ...params as Record<string, unknown> };
  const sensitiveFields = ['access_token', 'token', 'password', 'secret'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  // Handle nested arguments
  if ('arguments' in sanitized && typeof sanitized.arguments === 'object') {
    sanitized.arguments = sanitizeMcpParams(sanitized.arguments);
  }
  
  return sanitized;
}

/**
 * MCP Server info endpoint
 * Returns basic information about the MCP server
 */
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'gitlab-mcp-server',
    version: '1.0.0',
    protocol: 'MCP',
    protocolVersion: '2024-11-05',
    transport: 'HTTP',
    endpoints: {
      jsonrpc: 'POST /mcp',
      info: 'GET /mcp/info',
    },
  });
});

export { router as mcpRouter };

