import { gitlabService } from '../../services/gitlab.service.js';
import { ListProjectsInputSchema, listProjectsJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config.js';

export const listProjectsTool = {
  name: 'list_projects',
  description: 
    'List GitLab projects accessible with the provided credentials. ' +
    'Returns project names, URLs, descriptions, visibility, and statistics. ' +
    'Use this tool to discover available repositories in a GitLab instance.',
  inputSchema: listProjectsJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = ListProjectsInputSchema.safeParse(args);
    
    if (!parseResult.success) {
      return {
        content: [{
          type: 'text' as const,
          text: `Invalid input: ${parseResult.error.message}`,
        }],
        isError: true,
      };
    }
    
    const input = parseResult.data;
    
    // Use defaults from env if not provided
    const gitlabUrl = input.gitlab_url || config.defaultGitlabUrl;
    const accessToken = input.access_token || config.defaultGitlabToken;
    
    // Check if we have credentials
    if (!gitlabUrl || !accessToken) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: GitLab URL and access token are required. Either provide them as parameters or set DEFAULT_GITLAB_URL and DEFAULT_GITLAB_TOKEN in environment variables.',
        }],
        isError: true,
      };
    }
    
    try {
      // Fetch projects from GitLab
      const projects = await gitlabService.listProjects(
        gitlabUrl,
        accessToken,
        {
          search: input.search,
          membership: input.membership,
          perPage: input.per_page,
          all: input.all,
        }
      );
      
      // Format response
      const response = {
        total: projects.length,
        gitlab_instance: gitlabUrl,
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
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('GitLab', `Failed to fetch projects from ${gitlabUrl}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: `Error fetching projects from GitLab: ${errorMessage}`,
        }],
        isError: true,
      };
    }
  },
};

