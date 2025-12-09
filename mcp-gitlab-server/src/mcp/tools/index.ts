import { listProjectsTool } from './list-projects.js';

/**
 * Registry of all available MCP tools
 */
export const tools = [
  listProjectsTool,
  // Add more tools here as needed:
  // getProjectTool,
  // listMergeRequestsTool,
  // getPipelineStatusTool,
  // etc.
];

/**
 * Get tool by name
 */
export function getTool(name: string) {
  return tools.find(t => t.name === name);
}

/**
 * Get list of all tool definitions (for tools/list response)
 */
export function getToolDefinitions() {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

