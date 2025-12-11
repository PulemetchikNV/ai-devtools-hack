import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { ListProjectsInputSchema, listProjectsJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

export const listProjectsTool = {
  name: 'list_projects',
  description: 
    'List GitLab projects for a registered user. ' +
    'User must be registered first using register_user tool. ' +
    'Returns project names, URLs, descriptions, visibility, and statistics.',
  inputSchema: listProjectsJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = ListProjectsInputSchema.safeParse(args);
    
    if (!parseResult.success) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INVALID_INPUT',
            message: `Invalid input: ${parseResult.error.message}`,
          }),
        }],
        isError: true,
      };
    }
    
    const { chat_id, search, membership, per_page, all } = parseResult.data;
    
    logger.debug('ListProjects', `Listing projects for user ${chat_id}`);
    
    try {
      // Get user credentials from database
      const config = await chatConfigService.getWithCredentials(chat_id);
      
      if (!config) {
        logger.warn('ListProjects', `User ${chat_id} not registered`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'USER_NOT_REGISTERED',
              message: `User with chat_id ${chat_id} is not registered. Please register first using register_user tool with gitlab_url and access_token.`,
            }),
          }],
          isError: true,
        };
      }
      
      const { gitlabUrl, accessToken } = config;
      
      logger.debug('ListProjects', `Fetching projects from ${gitlabUrl} for user ${chat_id}`);
      
      // Fetch projects from GitLab
      const projects = await gitlabService.listProjects(
        gitlabUrl,
        accessToken,
        {
          search: search || undefined,
          membership,
          perPage: per_page,
          all,
        }
      );
      
      // Format response
      const response = {
        success: true,
        total: projects.length,
        chat_id,
        gitlab_url: gitlabUrl,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          full_path: p.fullPath,
          url: p.url,
          description: p.description || 'No description',
          default_branch: p.defaultBranch,
          visibility: p.visibility,
          last_activity: p.lastActivity,
          stars: p.stars,
          forks: p.forks,
        })),
      };
      
      logger.info('ListProjects', `Found ${projects.length} projects for user ${chat_id}`);
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('ListProjects', `Failed to fetch projects for user ${chat_id}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'GITLAB_ERROR',
            message: `Error fetching projects from GitLab: ${errorMessage}`,
          }),
        }],
        isError: true,
      };
    }
  },
};
