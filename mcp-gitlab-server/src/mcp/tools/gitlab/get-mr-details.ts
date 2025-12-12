import { gitlabService } from '../../../services/gitlab.service.js';
import { chatConfigService } from '../../../services/chat-config.service.js';
import { GetMrDetailsInputSchema, getMrDetailsJsonSchema } from './schemas.js';
import { logger } from '../../../utils/logger.js';

/**
 * MCP Tool: get_mr_details
 * 
 * Gets detailed information about a merge request.
 * Includes diff stats, approvals, discussions, conflicts status, etc.
 * 
 * Use cases:
 * - "Show me details of MR #123"
 * - "What's the diff stats for this MR?"
 * - "How many approvals does this MR need?"
 */
export const getMrDetailsTool = {
  name: 'get_mr_details',
  description:
    'Get detailed information about a merge request. ' +
    'Returns diff stats (additions, deletions, files changed), approvals status, discussions count, conflicts, and more. ' +
    'Set include_changes=true to also return MR diff payload (can be large).',
  inputSchema: getMrDetailsJsonSchema,

  async handler(args: unknown) {
    const parseResult = GetMrDetailsInputSchema.safeParse(args);

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

    const { chat_id, project_path, mr_iid, include_changes } = parseResult.data;

    try {
      // Get user credentials from database
      const userConfig = await chatConfigService.getWithCredentials(chat_id);

      if (!userConfig) {
        logger.warn('GetMrDetails', `User ${chat_id} not registered`);
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

      // Fetch MR details
      const mrDetails = await gitlabService.getMrDetails(
        userConfig.gitlabUrl,
        userConfig.accessToken,
        project_path,
        mr_iid,
        include_changes
      );

      // Format response with emojis
      const stateEmoji: Record<string, string> = {
        opened: '🟢',
        merged: '✅',
        closed: '🔴',
        locked: '🔒',
      };

      const response = {
        project_path,
        merge_request: {
          id: mrDetails.id,
          iid: mrDetails.iid,
          title: mrDetails.title,
          description: mrDetails.description || 'No description',
          state: mrDetails.state,
          state_display: `${stateEmoji[mrDetails.state] || '❓'} ${mrDetails.state.toUpperCase()}`,
          author: mrDetails.author,
          assignees: mrDetails.assignees,
          reviewers: mrDetails.reviewers,
          source_branch: mrDetails.sourceBranch,
          target_branch: mrDetails.targetBranch,
          url: mrDetails.url,
          created_at: mrDetails.createdAt,
          updated_at: mrDetails.updatedAt,
          merged_at: mrDetails.mergedAt,
          labels: mrDetails.labels,
          milestone: mrDetails.milestone,
          work_in_progress: mrDetails.workInProgress,
        },
        diff_stats: mrDetails.diffStats ? {
          additions: mrDetails.diffStats.additions,
          deletions: mrDetails.diffStats.deletions,
          total: mrDetails.diffStats.total,
          files_changed: mrDetails.diffStats.filesChanged,
          display: `+${mrDetails.diffStats.additions} -${mrDetails.diffStats.deletions} (${mrDetails.diffStats.filesChanged} files)`,
        } : null,
        approvals: mrDetails.approvals ? {
          approved: mrDetails.approvals.approved,
          approved_by: mrDetails.approvals.approvedBy,
          approvals_required: mrDetails.approvals.approvalsRequired,
          approvals_left: mrDetails.approvals.approvalsLeft,
          display: mrDetails.approvals.approved
            ? `✅ Approved by ${mrDetails.approvals.approvedBy.join(', ')}`
            : `⏳ ${mrDetails.approvals.approvalsLeft} of ${mrDetails.approvals.approvalsRequired} approvals needed`,
        } : null,
        discussions: mrDetails.discussions || 0,
        comments: mrDetails.comments || 0,
        conflicts: mrDetails.conflicts,
        mergeable: mrDetails.mergeable,
        conflicts_display: mrDetails.conflicts ? '⚠️ Has conflicts' : '✅ No conflicts',
        mergeable_display: mrDetails.mergeable ? '✅ Ready to merge' : '❌ Cannot merge',
        changes: include_changes ? mrDetails.changes || [] : undefined,
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('GetMrDetails', `Failed to get MR details: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'GITLAB_ERROR',
            message: `Error getting MR details: ${errorMessage}`,
          }, null, 2),
        }],
        isError: true,
      };
    }
  },
};

