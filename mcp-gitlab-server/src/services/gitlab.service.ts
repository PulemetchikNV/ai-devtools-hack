import { Gitlab } from '@gitbeaker/rest';
import { logger } from '../utils/logger.js';

export interface GitLabProject {
  id: number;
  name: string;
  fullPath: string;
  url: string;
  description: string | null;
  defaultBranch: string | null;
  visibility: string;
  lastActivity: string;
  stars: number;
  forks: number;
}

export interface ListProjectsOptions {
  search?: string;
  membership?: boolean;
  perPage?: number;
  all?: boolean;  // ← добавить
}

export class GitLabService {
  private createClient(gitlabUrl: string, accessToken: string) {
    return new Gitlab({
      host: gitlabUrl,
      token: accessToken,
    });
  }

  /**
   * Validates GitLab credentials by making a test API call
   */
  async validateCredentials(gitlabUrl: string, accessToken: string): Promise<boolean> {
    logger.debug('GitLab', `Validating credentials for ${gitlabUrl}`);
    try {
      const client = this.createClient(gitlabUrl, accessToken);
      // Try to get current user - will fail if credentials are invalid
      await client.Users.showCurrentUser();
      logger.info('GitLab', `Credentials valid for ${gitlabUrl}`);
      return true;
    } catch (error) {
      logger.warn('GitLab', `Invalid credentials for ${gitlabUrl}`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(gitlabUrl: string, accessToken: string) {
    const client = this.createClient(gitlabUrl, accessToken);
    return await client.Users.showCurrentUser();
  }

  /**
   * List projects accessible with the provided credentials
   */
  async listProjects(
    gitlabUrl: string,
    accessToken: string,
    options: ListProjectsOptions = {}
  ): Promise<GitLabProject[]> {
    logger.debug('GitLab', `Listing projects from ${gitlabUrl}`, {
      search: options.search,
      membership: options.membership,
      perPage: options.perPage,
      all: options.all,
    });
    
    const client = this.createClient(gitlabUrl, accessToken);
    
    let projects;
    
    if (options.all) {
      // Fetch all projects (may be slow for large instances)
      projects = await client.Projects.all({
        search: options.search || undefined,
        membership: options.membership ?? true,
        perPage: 100, // Max per page for efficiency
        pagination: 'offset',
        showExpanded: false,
      });
    } else {
      // Fetch only first page
      projects = await client.Projects.all({
        search: options.search || undefined,
        membership: options.membership ?? true,
        perPage: Math.min(options.perPage ?? 20, 100),
        pagination: 'offset',
        page: 1,
        showExpanded: false,
      });
    }

    logger.info('GitLab', `Found ${projects.length} projects from ${gitlabUrl}`);

    return projects.map((p) => ({
      id: p.id as number,
      name: p.name,
      fullPath: p.path_with_namespace ?? '',
      url: p.web_url ?? '',
      description: p.description ?? null,
      defaultBranch: p.default_branch ?? null,
      visibility: p.visibility ?? 'private',
      lastActivity: p.last_activity_at ?? '',
      stars: p.star_count ?? 0,
      forks: p.forks_count ?? 0,
    }));
  }

  /**
   * Get a specific project by ID or path
   */
  async getProject(gitlabUrl: string, accessToken: string, projectId: string | number) {
    const client = this.createClient(gitlabUrl, accessToken);
    const project = await client.Projects.show(projectId);
    
    return {
      id: project.id,
      name: project.name,
      fullPath: project.path_with_namespace,
      url: project.web_url,
      description: project.description,
      defaultBranch: project.default_branch,
      visibility: project.visibility,
      lastActivity: project.last_activity_at,
      stars: project.star_count,
      forks: project.forks_count,
      openIssuesCount: project.open_issues_count,
    };
  }
}

// Singleton instance
export const gitlabService = new GitLabService();

