import { registerUserTool } from './gitlab/register-user.js';
import { updateUserCredentialsTool } from './gitlab/update-user-credentials.js';
import { getUserInfoTool } from './gitlab/get-user-info.js';
import { unregisterUserTool } from './gitlab/unregister-user.js';
import { listProjectsTool } from './gitlab/list-projects.js';
import { listMergeRequestsTool } from './gitlab/list-merge-requests.js';
import { getMrDetailsTool } from './gitlab/get-mr-details.js';
import { getPipelineStatusTool } from './gitlab/get-pipeline-status.js';
import { retryPipelineTool } from './gitlab/retry-pipeline.js';
import { listIssuesTool } from './gitlab/list-issues.js';
import { createIssueTool } from './gitlab/create-issue.js';
import { reviewPatchTool } from './code-review/review-patch.js';
import { suggestTestsTool } from './code-review/suggest-tests.js';
import { config } from '../../config.js';
import { AGENT_NAMES } from '../../const.js';

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
 * - list_merge_requests: List merge requests (my MRs, MRs to review, project MRs)
 * - get_mr_details: Get detailed information about a merge request
 * - get_pipeline_status: Get CI/CD pipeline status for a project
 * - retry_pipeline: Retry a failed pipeline
 * - list_issues: List issues for a project
 * - create_issue: Create a new issue in a project
 */
const gitlabTools = [
  // User management
  registerUserTool,
  updateUserCredentialsTool,
  getUserInfoTool,
  unregisterUserTool,
  
  // GitLab operations
  listProjectsTool,
  listMergeRequestsTool,
  getMrDetailsTool,
  getPipelineStatusTool,
  retryPipelineTool,
  listIssuesTool,
  createIssueTool,
];

const codeReviewTools = [
  reviewPatchTool,
  suggestTestsTool,
];

export const tools = config.agentName === AGENT_NAMES.CODE_REVIEW ? 
  [...codeReviewTools] : [...gitlabTools]


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
