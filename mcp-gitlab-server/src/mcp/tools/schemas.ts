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
