/**
 * Simple logger utility
 * Color-coded output for different log levels
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelColors: Record<LogLevel, string> = {
  debug: colors.gray,
  info: colors.cyan,
  warn: colors.yellow,
  error: colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const color = levelColors[level];
  const label = levelLabels[level];
  const timestamp = formatTimestamp();
  
  const prefix = `${colors.gray}${timestamp}${colors.reset} ${color}${label}${colors.reset} ${colors.magenta}[${context}]${colors.reset}`;
  
  if (data !== undefined) {
    console.log(`${prefix} ${message}`);
    console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) => log('debug', context, message, data),
  info: (context: string, message: string, data?: unknown) => log('info', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('warn', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('error', context, message, data),
  
  /**
   * Log HTTP request
   */
  http: (method: string, path: string, statusCode: number, duration: number, extra?: Record<string, unknown>) => {
    const color = statusCode >= 500 ? colors.red 
                : statusCode >= 400 ? colors.yellow 
                : statusCode >= 300 ? colors.cyan 
                : colors.green;
    
    const timestamp = formatTimestamp();
    const statusStr = `${color}${statusCode}${colors.reset}`;
    const methodStr = `${colors.bright}${method.padEnd(6)}${colors.reset}`;
    const durationStr = `${colors.gray}${duration}ms${colors.reset}`;
    
    let line = `${colors.gray}${timestamp}${colors.reset} ${methodStr} ${path} ${statusStr} ${durationStr}`;
    
    if (extra) {
      line += ` ${colors.dim}${JSON.stringify(extra)}${colors.reset}`;
    }
    
    console.log(line);
  },
  
  /**
   * Log MCP JSON-RPC request
   */
  mcp: (method: string, id: string | number | null, duration: number, isError: boolean = false) => {
    const timestamp = formatTimestamp();
    const color = isError ? colors.red : colors.green;
    const status = isError ? 'ERR' : 'OK ';
    const idStr = id !== null ? `#${id}` : 'notification';
    
    console.log(
      `${colors.gray}${timestamp}${colors.reset} ` +
      `${colors.blue}MCP${colors.reset}    ` +
      `${colors.bright}${method.padEnd(20)}${colors.reset} ` +
      `${color}${status}${colors.reset} ` +
      `${colors.gray}${idStr} ${duration}ms${colors.reset}`
    );
  },
};

