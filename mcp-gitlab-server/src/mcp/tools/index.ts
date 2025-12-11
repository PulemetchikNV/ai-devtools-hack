import { registerUserTool } from './register-user.js';
import { updateUserCredentialsTool } from './update-user-credentials.js';
import { getUserInfoTool } from './get-user-info.js';
import { unregisterUserTool } from './unregister-user.js';
import { listProjectsTool } from './list-projects.js';

/**
 * Registry of all available MCP tools
 * 
 * User management tools:
 * - register_user: Register new user with GitLab credentials
 * - update_user_credentials: Update existing user's credentials
 * - get_user_info: Check if user is registered
 * - unregister_user: Remove user registration
 * 
 * GitLab tools (require registered user):
 * - list_projects: List GitLab projects for a registered user
 */
export const tools = [
  // User management
  registerUserTool,
  updateUserCredentialsTool,
  getUserInfoTool,
  unregisterUserTool,
  
  // GitLab operations
  listProjectsTool,
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
