import { gitlabService } from '../../../services/gitlab.service.js';
import { chatConfigService } from '../../../services/chat-config.service.js';
import { ListIssuesInputSchema, listIssuesJsonSchema } from '../schemas.js';
import { logger } from '../../../utils/logger.js';

/**
 * MCP Tool: list_issues
 * 
 * Lists issues from a GitLab project.
 * Can filter by state, assignee, labels, and search query.
 * 
 * Use cases:
 * - "Show open issues in project X"
 * - "What issues are assigned to me?"
 * - "Find bugs with high-priority label"
 */
export const listIssuesTool = {
  name: 'list_issues',
  description:
    'List issues from a GitLab project. Can filter by state (opened/closed), assignee, labels, and search query. ' +
    'Useful for tracking tasks, bugs, and feature requests.',
  inputSchema: listIssuesJsonSchema,

  async handler(args: unknown) {
    const parseResult = ListIssuesInputSchema.safeParse(args);

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

    const { chat_id, project_path, state, assignee, labels, search, per_page } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('ListIssues', `User ${chat_id} not registered`);
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

      // Fetch issues
      const issues = await gitlabService.listIssues(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        {
          projectPath: project_path,
          state,
          assignee,
          labels,
          search,
          perPage: per_page,
        }
      );

      const response = {
        total: issues.length,
        project_path,
        filters: {
          state,
          assignee: assignee || 'all',
          labels: labels || [],
          search: search || null,
        },
        issues: issues.map(issue => ({
          id: issue.id,
          iid: issue.iid,
          title: issue.title,
          state: issue.state,
          author: issue.author,
          assignees: issue.assignees,
          labels: issue.labels,
          url: issue.url,
          created_at: issue.createdAt,
          updated_at: issue.updatedAt,
          closed_at: issue.closedAt,
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
      logger.error('ListIssues', `Failed to fetch issues: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error fetching issues: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

