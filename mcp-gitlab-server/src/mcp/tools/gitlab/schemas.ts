import { z } from 'zod';

/**
 * Zod schemas for MCP tool inputs
 * Used for runtime validation
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Register User
// ═══════════════════════════════════════════════════════════════════════════

export const RegisterUserInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the user'),
  gitlab_url: z.string().url().describe('GitLab instance URL (e.g., https://gitlab.com)'),
  access_token: z.string().min(1).describe('GitLab personal access token'),
});

export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;

export const registerUserJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the user',
    },
    gitlab_url: {
      type: 'string',
      description: 'GitLab instance URL (e.g., https://gitlab.com or https://gitlab.company.com)',
    },
    access_token: {
      type: 'string',
      description: 'GitLab personal access token (PAT) with read_api scope',
    },
  },
  required: ['chat_id', 'gitlab_url', 'access_token'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Update User Credentials
// ═══════════════════════════════════════════════════════════════════════════

export const UpdateUserCredentialsInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the user'),
  gitlab_url: z.string().url().optional().describe('New GitLab instance URL'),
  access_token: z.string().min(1).optional().describe('New GitLab personal access token'),
});

export type UpdateUserCredentialsInput = z.infer<typeof UpdateUserCredentialsInputSchema>;

export const updateUserCredentialsJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the user',
    },
    gitlab_url: {
      type: 'string',
      description: 'New GitLab instance URL (optional)',
    },
    access_token: {
      type: 'string',
      description: 'New GitLab personal access token (optional)',
    },
  },
  required: ['chat_id'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Get User Info
// ═══════════════════════════════════════════════════════════════════════════

export const GetUserInfoInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the user'),
});

export type GetUserInfoInput = z.infer<typeof GetUserInfoInputSchema>;

export const getUserInfoJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the user',
    },
  },
  required: ['chat_id'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Unregister User
// ═══════════════════════════════════════════════════════════════════════════

export const UnregisterUserInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the user'),
});

export type UnregisterUserInput = z.infer<typeof UnregisterUserInputSchema>;

export const unregisterUserJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the user',
    },
  },
  required: ['chat_id'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  List Projects
// ═══════════════════════════════════════════════════════════════════════════

export const ListProjectsInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  search: z.string().optional().describe('Search query to filter projects by name'),
  membership: z.boolean().default(true).describe('Only return projects user is a member of'),
  per_page: z.number().min(1).max(100).default(20).describe('Number of results (max 100)'),
  all: z.boolean().default(false).describe('Fetch all projects'),
});

export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

export const listProjectsJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user. User must be registered first using register_user tool.',
    },
    search: {
      type: 'string',
      description: 'Optional search query to filter projects by name',
    },
    membership: {
      type: 'boolean',
      default: true,
      description: 'If true, only return projects the user is a member of',
    },
    per_page: {
      type: 'number',
      default: 20,
      minimum: 1,
      maximum: 100,
      description: 'Number of results per page (max 100)',
    },
    all: {
      type: 'boolean',
      default: false,
      description: 'If true, fetch ALL projects (may be slow). If false, return only first page.',
    },
  },
  required: ['chat_id'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  List Merge Requests
// ═══════════════════════════════════════════════════════════════════════════

export const ListMergeRequestsInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().optional().describe('Project path (e.g., group/project). If not specified, returns user MRs based on scope'),
  state: z.enum(['opened', 'merged', 'closed', 'all']).default('opened').describe('Filter by MR state'),
  scope: z.enum(['created_by_me', 'assigned_to_me', 'all']).default('created_by_me').describe('Filter by scope. "all" only works when project_path is specified'),
  per_page: z.number().min(1).max(100).default(20).describe('Number of results (max 100)'),
});

export type ListMergeRequestsInput = z.infer<typeof ListMergeRequestsInputSchema>;

export const listMergeRequestsJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project). If not specified, returns MRs across all accessible projects',
    },
    state: {
      type: 'string',
      enum: ['opened', 'merged', 'closed', 'all'],
      default: 'opened',
      description: 'Filter by MR state',
    },
    scope: {
      type: 'string',
      enum: ['created_by_me', 'assigned_to_me'],
      default: 'created_by_me',
      description: 'Filter by scope: created_by_me (MRs I created), assigned_to_me (MRs assigned to me for review). Note: "all" is only valid when project_path is specified.',
    },
    per_page: {
      type: 'number',
      default: 20,
      minimum: 1,
      maximum: 100,
      description: 'Number of results (max 100)',
    },
  },
  required: ['chat_id'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Get Pipeline Status
// ═══════════════════════════════════════════════════════════════════════════

export const GetPipelineStatusInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().min(1).describe('Project path (e.g., group/project)'),
  branch: z.string().optional().describe('Branch name. If not specified, uses default branch'),
});

export type GetPipelineStatusInput = z.infer<typeof GetPipelineStatusInputSchema>;

export const getPipelineStatusJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project)',
    },
    branch: {
      type: 'string',
      description: 'Branch name. If not specified, uses the project default branch (usually main or master)',
    },
  },
  required: ['chat_id', 'project_path'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  List Issues
// ═══════════════════════════════════════════════════════════════════════════

export const ListIssuesInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().min(1).describe('Project path (e.g., group/project)'),
  state: z.enum(['opened', 'closed', 'all']).default('opened').describe('Filter by issue state'),
  assignee: z.string().optional().describe('Filter by assignee username'),
  labels: z.array(z.string()).optional().describe('Filter by labels'),
  search: z.string().optional().describe('Search in title and description'),
  per_page: z.number().min(1).max(100).default(20).describe('Number of results (max 100)'),
});

export type ListIssuesInput = z.infer<typeof ListIssuesInputSchema>;

export const listIssuesJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project)',
    },
    state: {
      type: 'string',
      enum: ['opened', 'closed', 'all'],
      default: 'opened',
      description: 'Filter by issue state',
    },
    assignee: {
      type: 'string',
      description: 'Filter by assignee username',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description: 'Filter by labels (e.g., ["bug", "high-priority"])',
    },
    search: {
      type: 'string',
      description: 'Search query to filter issues by title or description',
    },
    per_page: {
      type: 'number',
      default: 20,
      minimum: 1,
      maximum: 100,
      description: 'Number of results (max 100)',
    },
  },
  required: ['chat_id', 'project_path'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Create Issue
// ═══════════════════════════════════════════════════════════════════════════

export const CreateIssueInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().min(1).describe('Project path (e.g., group/project)'),
  title: z.string().min(1).describe('Issue title'),
  description: z.string().optional().describe('Issue description (supports Markdown)'),
  labels: z.array(z.string()).optional().describe('Labels to add (e.g., ["bug", "high-priority"])'),
  assignee: z.string().optional().describe('Username to assign the issue to'),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

export const createIssueJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project)',
    },
    title: {
      type: 'string',
      description: 'Issue title',
    },
    description: {
      type: 'string',
      description: 'Issue description (supports Markdown)',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description: 'Labels to add (e.g., ["bug", "high-priority"])',
    },
    assignee: {
      type: 'string',
      description: 'Username to assign the issue to',
    },
  },
  required: ['chat_id', 'project_path', 'title'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Retry Pipeline
// ═══════════════════════════════════════════════════════════════════════════

export const RetryPipelineInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().min(1).describe('Project path (e.g., group/project)'),
  pipeline_id: z.number().optional().describe('Pipeline ID to retry. If not specified, retries the latest pipeline'),
});

export type RetryPipelineInput = z.infer<typeof RetryPipelineInputSchema>;

export const retryPipelineJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project)',
    },
    pipeline_id: {
      type: 'number',
      description: 'Pipeline ID to retry. If not specified, retries the latest pipeline',
    },
  },
  required: ['chat_id', 'project_path'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Get MR Details
// ═══════════════════════════════════════════════════════════════════════════

export const GetMrDetailsInputSchema = z.object({
  chat_id: z.string().min(1).describe('Telegram chat ID of the registered user'),
  project_path: z.string().min(1).describe('Project path (e.g., group/project)'),
  mr_iid: z.number().min(1).describe('Merge Request IID (internal ID, shown in MR URL)'),
  include_changes: z.boolean().default(false).describe('Include MR changes diff payload (may be large). Useful for code review pipelines.'),
});

export type GetMrDetailsInput = z.infer<typeof GetMrDetailsInputSchema>;

export const getMrDetailsJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Telegram chat ID of the registered user',
    },
    project_path: {
      type: 'string',
      description: 'Project path (e.g., group/project)',
    },
    mr_iid: {
      type: 'number',
      description: 'Merge Request IID (internal ID, shown in MR URL like #123)',
    },
    include_changes: {
      type: 'boolean',
      default: false,
      description: 'If true, includes MR changes (diffs) in the response. Might be large.',
    },
  },
  required: ['chat_id', 'project_path', 'mr_iid'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Review Patch (code review MCP)
// ═══════════════════════════════════════════════════════════════════════════

const ReviewChangeSchema = z.object({
  old_path: z.string(),
  new_path: z.string(),
  diff: z.string(),
  new_file: z.boolean().optional(),
  renamed_file: z.boolean().optional(),
  deleted_file: z.boolean().optional(),
});

export const ReviewPatchInputSchema = z.object({
  chat_id: z.string().min(1).optional().describe('Optional chat ID for auditing'),
  project_path: z.string().min(1).optional().describe('Project path for context'),
  mr_iid: z.number().min(1).optional().describe('MR IID for context'),
  patch: z.string().optional().describe('Unified diff string. Provide if changes array is not supplied.'),
  changes: z.array(ReviewChangeSchema).optional().describe('GitLab changes array (old_path, new_path, diff, flags)'),
  max_findings: z.number().min(1).max(200).default(50).describe('Max findings to return'),
  focus_paths: z.array(z.string()).optional().describe('Only consider these paths'),
  exclude_paths: z.array(z.string()).optional().describe('Skip these paths'),
});

export type ReviewPatchInput = z.infer<typeof ReviewPatchInputSchema>;

export const reviewPatchJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Optional chat ID for auditing',
    },
    project_path: {
      type: 'string',
      description: 'Project path for context',
    },
    mr_iid: {
      type: 'number',
      description: 'MR IID for context',
    },
    patch: {
      type: 'string',
      description: 'Unified diff string. Provide if changes array is not supplied.',
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          old_path: { type: 'string' },
          new_path: { type: 'string' },
          diff: { type: 'string' },
          new_file: { type: 'boolean' },
          renamed_file: { type: 'boolean' },
          deleted_file: { type: 'boolean' },
        },
        required: ['old_path', 'new_path', 'diff'],
      },
      description: 'GitLab changes array (old_path, new_path, diff, flags)',
    },
    max_findings: {
      type: 'number',
      minimum: 1,
      maximum: 200,
      default: 50,
      description: 'Max findings to return',
    },
    focus_paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only consider these paths',
    },
    exclude_paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skip these paths',
    },
  },
  required: [],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  Suggest Tests (code review MCP)
// ═══════════════════════════════════════════════════════════════════════════

export const SuggestTestsInputSchema = z.object({
  chat_id: z.string().min(1).optional().describe('Optional chat ID for auditing'),
  project_path: z.string().min(1).optional().describe('Project path for context'),
  mr_iid: z.number().min(1).optional().describe('MR IID for context'),
  patch: z.string().optional().describe('Unified diff string. Provide if changes array is not supplied.'),
  changes: z.array(ReviewChangeSchema).optional().describe('GitLab changes array (old_path, new_path, diff, flags)'),
  max_items: z.number().min(1).max(100).default(20).describe('Max test suggestions to return'),
  focus_paths: z.array(z.string()).optional().describe('Only consider these paths'),
  exclude_paths: z.array(z.string()).optional().describe('Skip these paths'),
});

export type SuggestTestsInput = z.infer<typeof SuggestTestsInputSchema>;

export const suggestTestsJsonSchema = {
  type: 'object',
  properties: {
    chat_id: {
      type: 'string',
      description: 'Optional chat ID for auditing',
    },
    project_path: {
      type: 'string',
      description: 'Project path for context',
    },
    mr_iid: {
      type: 'number',
      description: 'MR IID for context',
    },
    patch: {
      type: 'string',
      description: 'Unified diff string. Provide if changes array is not supplied.',
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          old_path: { type: 'string' },
          new_path: { type: 'string' },
          diff: { type: 'string' },
          new_file: { type: 'boolean' },
          renamed_file: { type: 'boolean' },
          deleted_file: { type: 'boolean' },
        },
        required: ['old_path', 'new_path', 'diff'],
      },
      description: 'GitLab changes array (old_path, new_path, diff, flags)',
    },
    max_items: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Max test suggestions to return',
    },
    focus_paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Only consider these paths',
    },
    exclude_paths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skip these paths',
    },
  },
  required: [],
} as const;
