import { z } from 'zod';

/**
 * Zod schemas for MCP tool inputs
 * Used for runtime validation
 */

export const ListProjectsInputSchema = z.object({
  gitlab_url: z.string().url().optional().describe('GitLab instance URL (e.g., https://gitlab.com). Uses default if not provided.'),
  access_token: z.string().min(1).optional().describe('GitLab personal access token. Uses default if not provided.'),
  search: z.string().optional().describe('Search query to filter projects by name'),
  membership: z.boolean().default(true).describe('Only return projects user is a member of'),
  per_page: z.number().min(1).max(100).default(20).describe('Number of results (max 100)'),
  all: z.boolean().default(false).describe('Fetch all projects'),
});

export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

/**
 * JSON Schema definitions for MCP tool registration
 * These are used by the MCP protocol for tool discovery
 */

export const listProjectsJsonSchema = {
  type: 'object',
  properties: {
    gitlab_url: {
      type: 'string',
      description: 'GitLab instance URL (e.g., https://gitlab.com). Optional - uses default from env if not provided.',
    },
    access_token: {
      type: 'string',
      description: 'GitLab personal access token (PAT) with read_api scope. Optional - uses default from env if not provided.',
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
  required: [],  // No required fields - uses defaults from env
} as const;

