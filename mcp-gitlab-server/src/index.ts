import express from 'express';
import { mcpRouter } from './mcp/router.js';
import { apiRouter } from './api/router.js';
import { requestLogger } from './api/middleware/request-logger.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const app = express();

// Middleware
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════
//  REST API for Telegram bot (chat configs management)
// ═══════════════════════════════════════════════════════════════════════════
app.use('/api', apiRouter);

// ═══════════════════════════════════════════════════════════════════════════
//  MCP Server endpoints (for AI Agent / Cloud.ru Agent System)
// ═══════════════════════════════════════════════════════════════════════════
app.use('/mcp', mcpRouter);

// ═══════════════════════════════════════════════════════════════════════════
//  Start server
// ═══════════════════════════════════════════════════════════════════════════
app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         MCP GitLab Server v1.0.0                              ║
╠═══════════════════════════════════════════════════════════════╣
║  REST API:  http://localhost:${config.port}/api                       ║
║  MCP:       http://localhost:${config.port}/mcp                       ║
║  Health:    http://localhost:${config.port}/health                    ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  
  logger.info('Server', `Started on port ${config.port}`);
  logger.info('Server', `Environment: ${config.nodeEnv}`);
});

