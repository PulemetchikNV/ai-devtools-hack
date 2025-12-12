import { gitlabService } from '../../../services/gitlab.service.js';
import { chatConfigService } from '../../../services/chat-config.service.js';
import { GetPipelineStatusInputSchema, getPipelineStatusJsonSchema } from './schemas.js';
import { logger } from '../../../utils/logger.js';

/**
 * MCP Tool: get_pipeline_status
 * 
 * Gets the status of the latest pipeline for a project/branch.
 * Shows overall status and per-stage breakdown.
 * 
 * Use cases:
 * - "Did the build pass?"
 * - "What's the pipeline status for project X?"
 * - "Check if main branch is green"
 */
export const getPipelineStatusTool = {
  name: 'get_pipeline_status',
  description:
    'Get the status of the latest CI/CD pipeline for a GitLab project. ' +
    'Shows pipeline status (success/failed/running/pending), stages, and duration. ' +
    'If branch is not specified, uses the default branch.',
  inputSchema: getPipelineStatusJsonSchema,

  async handler(args: unknown) {
    const parseResult = GetPipelineStatusInputSchema.safeParse(args);

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

    const { chat_id, project_path, branch } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('GetPipelineStatus', `User ${chat_id} not registered`);
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

      // Fetch pipeline status
      const pipeline = await gitlabService.getPipelineStatus(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        project_path,
        branch
      );

      if (!pipeline) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'NO_PIPELINE',
              message: `No pipelines found for ${project_path}${branch ? `:${branch}` : ' (default branch)'}`,
              project_path,
              branch: branch || 'default',
            }, null, 2),
          }],
          isError: false, // Not an error, just no data
        };
      }

      // Format status with emoji for better readability
      const statusEmoji: Record<string, string> = {
        success: '✅',
        failed: '❌',
        running: '🔄',
        pending: '⏳',
        canceled: '🚫',
        skipped: '⏭️',
        manual: '👆',
      };

      const response = {
        project_path,
        branch: pipeline.ref,
        pipeline: {
          id: pipeline.id,
          status: pipeline.status,
          status_display: `${statusEmoji[pipeline.status] || '❓'} ${pipeline.status.toUpperCase()}`,
          url: pipeline.url,
          commit_sha: pipeline.sha.substring(0, 8),
          created_at: pipeline.createdAt,
          finished_at: pipeline.finishedAt,
          duration_seconds: pipeline.duration,
          duration_display: pipeline.duration 
            ? `${Math.floor(pipeline.duration / 60)}m ${pipeline.duration % 60}s`
            : null,
          stages: pipeline.stages.map(stage => ({
            name: stage.name,
            status: stage.status,
            status_display: `${statusEmoji[stage.status] || '❓'} ${stage.status}`,
          })),
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
      logger.error('GetPipelineStatus', `Failed to get pipeline status: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error getting pipeline status: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

