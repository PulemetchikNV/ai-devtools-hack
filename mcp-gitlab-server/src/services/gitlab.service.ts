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
  all?: boolean;
}

export interface ListMergeRequestsOptions {
  projectPath?: string;
  state?: 'opened' | 'merged' | 'closed' | 'all';
  scope?: 'created_by_me' | 'assigned_to_me' | 'all';
  perPage?: number;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  author: string;
  assignees: string[];
  reviewers: string[];
  sourceBranch: string;
  targetBranch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  projectPath: string;
}

export interface GitLabMergeRequestDetails extends GitLabMergeRequest {
  diffStats?: {
    additions: number;
    deletions: number;
    total: number;
    filesChanged: number;
  };
  approvals?: {
    approved: boolean;
    approvedBy: string[];
    approvalsRequired: number;
    approvalsLeft: number;
  };
  discussions?: number;
  comments?: number;
  conflicts?: boolean;
  mergeable?: boolean;
  workInProgress?: boolean;
  labels: string[];
  milestone?: string | null;
}

export interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  duration: number | null;
  stages: GitLabPipelineStage[];
}

export interface GitLabPipelineStage {
  name: string;
  status: string;
}

export interface ListIssuesOptions {
  projectPath: string;
  state?: 'opened' | 'closed' | 'all';
  assignee?: string;
  labels?: string[];
  search?: string;
  perPage?: number;
}

export interface CreateIssueInput {
  projectPath: string;
  title: string;
  description?: string;
  labels?: string[];
  assigneeUsername?: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: string;
  author: string;
  assignees: string[];
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  projectPath: string;
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

  /**
   * List merge requests
   * Can filter by project, state, and scope (created_by_me, assigned_to_me)
   */
  async listMergeRequests(
    gitlabUrl: string,
    accessToken: string,
    options: ListMergeRequestsOptions = {}
  ): Promise<GitLabMergeRequest[]> {
    logger.debug('GitLab', `Listing merge requests from ${gitlabUrl}`, {
      projectPath: options.projectPath,
      state: options.state,
      scope: options.scope,
    });

    const client = this.createClient(gitlabUrl, accessToken);

    let mergeRequests;

    // Map 'all' state to undefined (gitbeaker doesn't accept 'all')
    const stateFilter = options.state === 'all' ? undefined : (options.state || 'opened');

    if (options.projectPath) {
      // Get MRs for a specific project
      mergeRequests = await client.MergeRequests.all({
        projectId: options.projectPath,
        state: stateFilter,
        perPage: Math.min(options.perPage ?? 20, 100),
        pagination: 'offset',
        page: 1,
        showExpanded: false,
      });
    } else {
      // Get MRs across all projects (user's MRs)
      // When no project specified, default to 'created_by_me' to avoid returning random public MRs
      // 'all' scope without project returns ALL public MRs from entire GitLab instance
      const effectiveScope = options.scope === 'all' ? 'created_by_me' : (options.scope || 'created_by_me');
      
      mergeRequests = await client.MergeRequests.all({
        state: stateFilter,
        scope: effectiveScope,
        perPage: Math.min(options.perPage ?? 20, 100),
        pagination: 'offset',
        page: 1,
        showExpanded: false,
      });
    }

    logger.info('GitLab', `Found ${mergeRequests.length} merge requests from ${gitlabUrl}`);

    return mergeRequests.map((mr: any) => ({
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      description: mr.description || null,
      state: mr.state,
      author: mr.author?.username || mr.author?.name || 'unknown',
      assignees: (mr.assignees || []).map((a: any) => a.username || a.name),
      reviewers: (mr.reviewers || []).map((r: any) => r.username || r.name),
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      url: mr.web_url,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      mergedAt: mr.merged_at || null,
      projectPath: mr.references?.full || mr.source_project_id?.toString() || '',
    }));
  }

  /**
   * Get detailed information about a merge request
   * Includes diff stats, approvals, discussions, etc.
   */
  async getMrDetails(
    gitlabUrl: string,
    accessToken: string,
    projectPath: string,
    mrIid: number
  ): Promise<GitLabMergeRequestDetails> {
    logger.debug('GitLab', `Getting MR details for ${projectPath}!${mrIid}`);

    const client = this.createClient(gitlabUrl, accessToken);

    // Get MR details
    const mr = await client.MergeRequests.show(projectPath, mrIid);

    // Get diff stats using direct HTTP request
    let diffStats;
    try {
      const encodedProjectPath = encodeURIComponent(projectPath);
      const changesUrl = `${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${mrIid}/changes`;
      
      const changesResponse = await fetch(changesUrl, {
        headers: {
          'PRIVATE-TOKEN': accessToken,
        },
      });

      if (changesResponse.ok) {
        const changesData = await changesResponse.json() as any;
        const stats = (changesData.changes || []).reduce(
          (acc: any, change: any) => {
            const diff = change.diff || '';
            const additions = (diff.match(/^\+/gm) || []).length;
            const deletions = (diff.match(/^-/gm) || []).length;
            return {
              additions: acc.additions + additions,
              deletions: acc.deletions + deletions,
              filesChanged: acc.filesChanged + 1,
            };
          },
          { additions: 0, deletions: 0, filesChanged: 0 }
        );

        diffStats = {
          additions: stats.additions,
          deletions: stats.deletions,
          total: stats.additions + stats.deletions,
          filesChanged: stats.filesChanged,
        };
      }
    } catch (error) {
      logger.warn('GitLab', `Failed to get diff stats: ${error}`);
    }

    // Get approvals info using direct HTTP request
    let approvals;
    try {
      const encodedProjectPath = encodeURIComponent(projectPath);
      const approvalsUrl = `${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${mrIid}/approvals`;
      
      const approvalsResponse = await fetch(approvalsUrl, {
        headers: {
          'PRIVATE-TOKEN': accessToken,
        },
      });

      if (approvalsResponse.ok) {
        const approvalData = await approvalsResponse.json() as any;
        approvals = {
          approved: approvalData.approved || false,
          approvedBy: (approvalData.approved_by || []).map((a: any) => a.user?.username || a.user?.name || 'unknown'),
          approvalsRequired: approvalData.approvals_required || 0,
          approvalsLeft: Math.max(0, (approvalData.approvals_required || 0) - (approvalData.approved_by?.length || 0)),
        };
      } else {
        // Fallback to basic info from MR
        approvals = {
          approved: (mr as any).approved || false,
          approvedBy: [],
          approvalsRequired: 0,
          approvalsLeft: 0,
        };
      }
    } catch (error) {
      logger.warn('GitLab', `Failed to get approvals: ${error}`);
      approvals = {
        approved: (mr as any).approved || false,
        approvedBy: [],
        approvalsRequired: 0,
        approvalsLeft: 0,
      };
    }

    logger.info('GitLab', `Retrieved MR details for ${projectPath}!${mrIid}`);

    return {
      id: mr.id,
      iid: mr.iid,
      title: mr.title,
      description: mr.description || null,
      state: mr.state,
      author: (mr as any).author?.username || (mr as any).author?.name || 'unknown',
      assignees: ((mr as any).assignees || []).map((a: any) => a.username || a.name),
      reviewers: ((mr as any).reviewers || []).map((r: any) => r.username || r.name),
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      url: mr.web_url,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      mergedAt: mr.merged_at || null,
      projectPath: projectPath,
      diffStats,
      approvals,
      discussions: (mr as any).user_notes_count || 0,
      comments: (mr as any).user_notes_count || 0,
      conflicts: (mr as any).has_conflicts || false,
      mergeable: (mr as any).mergeable || false,
      workInProgress: (mr as any).work_in_progress || false,
      labels: (mr as any).labels || [],
      milestone: (mr as any).milestone?.title || null,
    };
  }

  /**
   * Get pipeline status for a project
   * Returns the latest pipeline for the specified branch (or default branch)
   */
  async getPipelineStatus(
    gitlabUrl: string,
    accessToken: string,
    projectPath: string,
    branch?: string
  ): Promise<GitLabPipeline | null> {
    logger.debug('GitLab', `Getting pipeline status for ${projectPath}`, { branch });

    const client = this.createClient(gitlabUrl, accessToken);

    // Get project info to get default branch if not specified
    const project = await client.Projects.show(projectPath);
    const targetBranch = branch || project.default_branch;

    if (!targetBranch) {
      logger.warn('GitLab', `No branch specified and project has no default branch`);
      return null;
    }

    // Get latest pipelines for the branch
    const pipelines = await client.Pipelines.all(projectPath, {
      ref: targetBranch,
      perPage: 1,
      pagination: 'offset',
      page: 1,
    });

    if (pipelines.length === 0) {
      logger.info('GitLab', `No pipelines found for ${projectPath}:${targetBranch}`);
      return null;
    }

    const latestPipeline = pipelines[0];

    // Get pipeline jobs to determine stages
    let stages: GitLabPipelineStage[] = [];
    try {
      const jobs = await client.Jobs.all(projectPath, {
        pipelineId: latestPipeline.id,
        perPage: 100,
      });

      // Group jobs by stage and determine stage status
      const stageMap = new Map<string, string[]>();
      for (const job of jobs) {
        const stageName = job.stage || 'unknown';
        if (!stageMap.has(stageName)) {
          stageMap.set(stageName, []);
        }
        stageMap.get(stageName)!.push(job.status || 'unknown');
      }

      // Determine overall status for each stage
      stages = Array.from(stageMap.entries()).map(([name, statuses]) => {
        let status = 'success';
        if (statuses.includes('failed')) status = 'failed';
        else if (statuses.includes('running')) status = 'running';
        else if (statuses.includes('pending')) status = 'pending';
        else if (statuses.includes('canceled')) status = 'canceled';
        else if (statuses.every(s => s === 'skipped')) status = 'skipped';

        return { name, status };
      });
    } catch (error) {
      logger.warn('GitLab', `Failed to get pipeline jobs: ${error}`);
    }

    logger.info('GitLab', `Pipeline ${latestPipeline.id} status: ${latestPipeline.status}`);

    return {
      id: latestPipeline.id,
      status: latestPipeline.status || 'unknown',
      ref: latestPipeline.ref || targetBranch,
      sha: latestPipeline.sha || '',
      url: latestPipeline.web_url || '',
      createdAt: latestPipeline.created_at || '',
      updatedAt: latestPipeline.updated_at || '',
      finishedAt: (latestPipeline.finished_at as string) || null,
      duration: (latestPipeline.duration as number) || null,
      stages,
    };
  }

  /**
   * List issues for a project
   */
  async listIssues(
    gitlabUrl: string,
    accessToken: string,
    options: ListIssuesOptions
  ): Promise<GitLabIssue[]> {
    logger.debug('GitLab', `Listing issues for ${options.projectPath}`, {
      state: options.state,
      assignee: options.assignee,
      labels: options.labels,
      search: options.search,
    });

    const client = this.createClient(gitlabUrl, accessToken);

    // Build options object
    const issueOptions: any = {
      projectId: options.projectPath,
      state: options.state || 'opened',
      perPage: Math.min(options.perPage ?? 20, 100),
      pagination: 'offset',
      page: 1,
    };
    
    if (options.assignee) {
      issueOptions.assigneeUsername = options.assignee;
    }
    if (options.labels && options.labels.length > 0) {
      issueOptions.labels = options.labels;
    }
    if (options.search) {
      issueOptions.search = options.search;
    }

    const issues = await client.Issues.all(issueOptions);

    logger.info('GitLab', `Found ${issues.length} issues for ${options.projectPath}`);

    return issues.map((issue: any) => ({
      id: issue.id,
      iid: issue.iid,
      title: issue.title,
      description: issue.description || null,
      state: issue.state,
      author: issue.author?.username || issue.author?.name || 'unknown',
      assignees: (issue.assignees || []).map((a: any) => a.username || a.name),
      labels: issue.labels || [],
      url: issue.web_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at || null,
      projectPath: options.projectPath,
    }));
  }

  /**
   * Create a new issue in a project
   */
  async createIssue(
    gitlabUrl: string,
    accessToken: string,
    input: CreateIssueInput
  ): Promise<GitLabIssue> {
    logger.debug('GitLab', `Creating issue in ${input.projectPath}`, {
      title: input.title,
      labels: input.labels,
      assignee: input.assigneeUsername,
    });

    const client = this.createClient(gitlabUrl, accessToken);

    // Build create options - only include non-empty values
    const createOptions: Record<string, any> = {
      title: input.title,
    };
    
    if (input.description) {
      createOptions.description = input.description;
    }
    
    if (input.labels && input.labels.length > 0) {
      createOptions.labels = input.labels.join(',');
    }

    logger.debug('GitLab', `Create issue request`, {
      projectPath: input.projectPath,
      options: createOptions,
    });

    let issue;
    try {
      // Encode project path for URL
      const encodedProjectPath = encodeURIComponent(input.projectPath);
      
      // Use direct fetch API call since gitbeaker Issues.create has issues
      const response = await fetch(`${gitlabUrl}/api/v4/projects/${encodedProjectPath}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': accessToken,
        },
        body: JSON.stringify(createOptions),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GitLab', `Failed to create issue - API response`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      issue = await response.json() as any;
    } catch (error: any) {
      // Log detailed error from GitLab
      logger.error('GitLab', `Failed to create issue - detailed error`, {
        message: error.message,
        cause: error.cause,
      });
      throw error;
    }

    // If assignee username is provided, we need to assign after creation
    if (input.assigneeUsername && issue.iid) {
      try {
        // Find user by username
        const users = await client.Users.all({ username: input.assigneeUsername });
        if (users.length > 0) {
          await client.Issues.edit(input.projectPath, issue.iid, {
            assigneeIds: [users[0].id],
          });
        }
      } catch (assignError) {
        logger.warn('GitLab', `Failed to assign issue to ${input.assigneeUsername}: ${assignError}`);
      }
    }

    logger.info('GitLab', `Created issue #${issue.iid} in ${input.projectPath}`);

    return {
      id: issue.id,
      iid: issue.iid,
      title: issue.title,
      description: issue.description || null,
      state: issue.state || 'opened',
      author: issue.author?.username || 'unknown',
      assignees: (issue.assignees || []).map((a: any) => a.username || a.name),
      labels: issue.labels || [],
      url: issue.web_url || '',
      createdAt: issue.created_at || '',
      updatedAt: issue.updated_at || '',
      closedAt: issue.closed_at || null,
      projectPath: input.projectPath,
    };
  }

  /**
   * Retry a failed or canceled pipeline
   */
  async retryPipeline(
    gitlabUrl: string,
    accessToken: string,
    projectPath: string,
    pipelineId?: number
  ): Promise<GitLabPipeline> {
    logger.debug('GitLab', `Retrying pipeline for ${projectPath}`, { pipelineId });

    const client = this.createClient(gitlabUrl, accessToken);

    // If no pipeline ID provided, get the latest pipeline
    let targetPipelineId = pipelineId;
    if (!targetPipelineId) {
      const pipelines = await client.Pipelines.all(projectPath, {
        perPage: 1,
        pagination: 'offset',
        page: 1,
      });

      if (pipelines.length === 0) {
        throw new Error(`No pipelines found for ${projectPath}`);
      }

      targetPipelineId = pipelines[0].id;
    }

    // Use direct HTTP request to retry pipeline
    const encodedProjectPath = encodeURIComponent(projectPath);
    const retryUrl = `${gitlabUrl}/api/v4/projects/${encodedProjectPath}/pipelines/${targetPipelineId}/retry`;

    logger.debug('GitLab', `Retry URL: ${retryUrl}`);

    const response = await fetch(retryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': accessToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GitLab', `Failed to retry pipeline - API response`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const pipeline = await response.json() as any;

    logger.info('GitLab', `Retried pipeline ${targetPipelineId} in ${projectPath}`, {
      newPipelineId: pipeline.id,
      status: pipeline.status,
    });

    return {
      id: pipeline.id,
      status: pipeline.status || 'pending',
      ref: pipeline.ref || '',
      sha: pipeline.sha || '',
      url: pipeline.web_url || '',
      createdAt: pipeline.created_at || '',
      updatedAt: pipeline.updated_at || '',
      finishedAt: pipeline.finished_at || null,
      duration: pipeline.duration || null,
      stages: [],
    };
  }
}

// Singleton instance
export const gitlabService = new GitLabService();

