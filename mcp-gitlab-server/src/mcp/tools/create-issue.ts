import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { CreateIssueInputSchema, createIssueJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

/**
 * MCP Tool: create_issue
 * 
 * Creates a new issue in a GitLab project.
 * 
 * Use cases:
 * - "Create a bug report in project X"
 * - "Add a task: implement dark mode"
 * - "Create an issue and assign to john"
 */
export const createIssueTool = {
  name: 'create_issue',
  description:
    'Create a new issue in a GitLab project. ' +
    'You can specify title, description (Markdown supported), labels, and assignee. ' +
    'Returns the created issue details including URL.',
  inputSchema: createIssueJsonSchema,

  async handler(args: unknown) {
    const parseResult = CreateIssueInputSchema.safeParse(args);

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

    const { chat_id, project_path, title, description, labels, assignee } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('CreateIssue', `User ${chat_id} not registered`);
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

      // Create issue
      const issue = await gitlabService.createIssue(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        {
          projectPath: project_path,
          title,
          description,
          labels,
          assigneeUsername: assignee,
        }
      );

      const response = {
        success: true,
        message: `Issue #${issue.iid} created successfully`,
        issue: {
          id: issue.id,
          iid: issue.iid,
          title: issue.title,
          description: issue.description,
          state: issue.state,
          author: issue.author,
          assignees: issue.assignees,
          labels: issue.labels,
          url: issue.url,
          created_at: issue.createdAt,
        },
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('CreateIssue', `Failed to create issue: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error creating issue: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

