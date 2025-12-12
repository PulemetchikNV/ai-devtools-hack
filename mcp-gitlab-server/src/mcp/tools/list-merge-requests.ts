import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { ListMergeRequestsInputSchema, listMergeRequestsJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

/**
 * MCP Tool: list_merge_requests
 * 
 * Lists merge requests from GitLab.
 * Can filter by project, state (opened/merged/closed), and scope (created_by_me/assigned_to_me).
 * 
 * Use cases:
 * - "What are my open merge requests?"
 * - "Show MRs assigned to me for review"
 * - "List all open MRs in project X"
 */
export const listMergeRequestsTool = {
  name: 'list_merge_requests',
  description:
    'List GitLab merge requests. Can show MRs created by user, assigned to user for review, or all MRs in a project. ' +
    'Useful for tracking code reviews and your own pending MRs.',
  inputSchema: listMergeRequestsJsonSchema,

  async handler(args: unknown) {
    const parseResult = ListMergeRequestsInputSchema.safeParse(args);

    if (!parseResult.success) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: `Invalid input: ${parseResult.error.message}`,
          }, null, 2),
        }],
        isError: true,
      };
    }

    const { chat_id, project_path, state, scope, per_page } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('ListMergeRequests', `User ${chat_id} not registered`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'USER_NOT_REGISTERED',
              message: `User with chat_id ${chat_id} is not registered. Please register first using register_user tool.`,
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Fetch merge requests
      const mergeRequests = await gitlabService.listMergeRequests(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        {
          projectPath: project_path,
          state,
          scope,
          perPage: per_page,
        }
      );

      const response = {
        total: mergeRequests.length,
        gitlab_url: userConfig.gitlabUrl,
        filters: {
          project_path: project_path || 'all projects',
          state,
          scope,
        },
        merge_requests: mergeRequests.map(mr => ({
          id: mr.id,
          iid: mr.iid,
          title: mr.title,
          state: mr.state,
          author: mr.author,
          assignees: mr.assignees,
          reviewers: mr.reviewers,
          source_branch: mr.sourceBranch,
          target_branch: mr.targetBranch,
          url: mr.url,
          created_at: mr.createdAt,
          project: mr.projectPath,
        })),
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('ListMergeRequests', `Failed to fetch merge requests: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error fetching merge requests: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

