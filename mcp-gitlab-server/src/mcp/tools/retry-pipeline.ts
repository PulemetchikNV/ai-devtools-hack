import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { RetryPipelineInputSchema, retryPipelineJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

/**
 * MCP Tool: retry_pipeline
 * 
 * Retries a failed or canceled pipeline.
 * If no pipeline ID is specified, retries the latest pipeline.
 * 
 * Use cases:
 * - "Retry the failed build"
 * - "Restart the pipeline for project X"
 * - "Re-run CI/CD"
 */
export const retryPipelineTool = {
  name: 'retry_pipeline',
  description:
    'Retry a failed or canceled CI/CD pipeline. ' +
    'If no pipeline_id is specified, retries the latest pipeline for the project. ' +
    'Returns the new pipeline status.',
  inputSchema: retryPipelineJsonSchema,

  async handler(args: unknown) {
    const parseResult = RetryPipelineInputSchema.safeParse(args);

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

    const { chat_id, project_path, pipeline_id } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('RetryPipeline', `User ${chat_id} not registered`);
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

      // Retry pipeline
      const pipeline = await gitlabService.retryPipeline(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        project_path,
        pipeline_id
      );

      // Format status with emoji
      const statusEmoji: Record<string, string> = {
        success: '✅',
        failed: '❌',
        running: '🔄',
        pending: '⏳',
        canceled: '🚫',
        skipped: '⏭️',
        manual: '👆',
        created: '🆕',
      };

      const response = {
        success: true,
        message: `Pipeline #${pipeline.id} has been retried`,
        project_path,
        pipeline: {
          id: pipeline.id,
          status: pipeline.status,
          status_display: `${statusEmoji[pipeline.status] || '❓'} ${pipeline.status.toUpperCase()}`,
          url: pipeline.url,
          ref: pipeline.ref,
          commit_sha: pipeline.sha.substring(0, 8),
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
      logger.error('RetryPipeline', `Failed to retry pipeline: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error retrying pipeline: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

