import { getToolDefinitions, getTool } from './tools/index.js';

/**
 * MCP Server implementation
 * Follows the Model Context Protocol specification
 * https://modelcontextprotocol.io/
 */

// Server info
const SERVER_INFO = {
  name: 'gitlab-mcp-server',
  version: '1.0.0',
};

// Server capabilities
const SERVER_CAPABILITIES = {
  tools: {},
  // We don't support resources and prompts yet
  // resources: {},
  // prompts: {},
};

/**
 * JSON-RPC 2.0 Error codes
 */
const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * Create a JSON-RPC 2.0 error response
 */
function createErrorResponse(id: string | number | null, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

/**
 * Create a JSON-RPC 2.0 success response
 */
function createSuccessResponse(id: string | number | null, result: unknown) {
  return {
    jsonrpc: '2.0' as const,
    id,
    result,
  };
}

/**
 * Handle MCP initialize request
 */
function handleInitialize(params: { protocolVersion: string; capabilities: unknown; clientInfo: unknown }) {
  return {
    protocolVersion: params.protocolVersion || '2024-11-05',
    capabilities: SERVER_CAPABILITIES,
    serverInfo: SERVER_INFO,
  };
}

/**
 * Handle tools/list request
 */
function handleToolsList() {
  return {
    tools: getToolDefinitions(),
  };
}

/**
 * Handle tools/call request
 */
async function handleToolsCall(params: { name: string; arguments?: Record<string, unknown> }) {
  const tool = getTool(params.name);
  
  if (!tool) {
    throw {
      code: ErrorCodes.METHOD_NOT_FOUND,
      message: `Tool not found: ${params.name}`,
    };
  }
  
  const result = await tool.handler(params.arguments || {});
  return result;
}

/**
 * Process a single JSON-RPC request
 */
export async function processRequest(request: {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: unknown;
}) {
  // Validate JSON-RPC version
  if (request.jsonrpc !== '2.0') {
    return createErrorResponse(
      request.id ?? null,
      ErrorCodes.INVALID_REQUEST,
      'Invalid JSON-RPC version'
    );
  }
  
  const { id, method, params } = request;
  
  try {
    let result: unknown;
    
    switch (method) {
      case 'initialize':
        result = handleInitialize(params as { protocolVersion: string; capabilities: unknown; clientInfo: unknown });
        break;
        
      case 'initialized':
        // Client acknowledgment - no response needed for notifications
        if (id === undefined) return null;
        result = {};
        break;
        
      case 'tools/list':
        result = handleToolsList();
        break;
        
      case 'tools/call':
        result = await handleToolsCall(params as { name: string; arguments?: Record<string, unknown> });
        break;
        
      case 'ping':
        result = {};
        break;
        
      default:
        return createErrorResponse(
          id ?? null,
          ErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${method}`
        );
    }
    
    // Notifications (no id) don't get a response
    if (id === undefined) return null;
    
    return createSuccessResponse(id, result);
    
  } catch (error) {
    const err = error as { code?: number; message?: string };
    return createErrorResponse(
      id ?? null,
      err.code || ErrorCodes.INTERNAL_ERROR,
      err.message || 'Internal error'
    );
  }
}

/**
 * Process a batch of JSON-RPC requests
 */
export async function processBatch(requests: unknown[]): Promise<unknown[]> {
  const responses = await Promise.all(
    requests.map(req => processRequest(req as Parameters<typeof processRequest>[0]))
  );
  
  // Filter out null responses (from notifications)
  return responses.filter(r => r !== null);
}

