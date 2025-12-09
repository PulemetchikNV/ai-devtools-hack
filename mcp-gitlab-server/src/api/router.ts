import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chatConfigService } from '../services/chat-config.service.js';
import { gitlabService } from '../services/gitlab.service.js';
import { apiKeyAuth } from './middleware/auth.js';

const router = Router();

// Apply API key auth to all routes
router.use(apiKeyAuth);

// ═══════════════════════════════════════════════════════════════════════════
//  Validation schemas
// ═══════════════════════════════════════════════════════════════════════════

const CreateConfigSchema = z.object({
  gitlab_url: z.string().url('Invalid GitLab URL'),
  access_token: z.string().min(1, 'Access token is required'),
  watched_repos: z.array(z.string()).optional().default([]),
});

const UpdateWatchedReposSchema = z.object({
  watched_repos: z.array(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/chats/:chatId/config
//  Create or update chat configuration
// ═══════════════════════════════════════════════════════════════════════════

router.post('/chats/:chatId/config', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    // Validate input
    const parseResult = CreateConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.flatten(),
      });
      return;
    }
    
    const data = parseResult.data;
    
    // Validate GitLab credentials
    const isValid = await gitlabService.validateCredentials(
      data.gitlab_url,
      data.access_token
    );
    
    if (!isValid) {
      res.status(400).json({
        error: 'Invalid GitLab credentials',
        message: 'Could not authenticate with the provided URL and token',
      });
      return;
    }
    
    // Get user info for confirmation
    const user = await gitlabService.getCurrentUser(data.gitlab_url, data.access_token);
    
    // Save configuration
    const config = await chatConfigService.upsert(chatId, {
      gitlabUrl: data.gitlab_url,
      accessToken: data.access_token,
      watchedRepos: data.watched_repos,
    });
    
    res.json({
      success: true,
      message: 'Configuration saved successfully',
      data: {
        chat_id: config.chatId,
        gitlab_url: config.gitlabUrl,
        gitlab_user: user.username,
        watched_repos: config.watchedRepos,
        created_at: config.createdAt,
        updated_at: config.updatedAt,
      },
    });
    
  } catch (error) {
    console.error('Error creating config:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/chats/:chatId/config
//  Get chat configuration (without token)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/chats/:chatId/config', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const config = await chatConfigService.get(chatId);
    
    if (!config) {
      res.status(404).json({
        error: 'Not found',
        message: 'Configuration not found for this chat',
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        chat_id: config.chatId,
        gitlab_url: config.gitlabUrl,
        watched_repos: config.watchedRepos,
        created_at: config.createdAt,
        updated_at: config.updatedAt,
      },
    });
    
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/chats/:chatId/credentials
//  Get chat credentials (INTERNAL - for AI agent)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/chats/:chatId/credentials', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const config = await chatConfigService.getWithCredentials(chatId);
    
    if (!config) {
      res.status(404).json({
        error: 'Not found',
        message: 'Configuration not found for this chat',
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        gitlab_url: config.gitlabUrl,
        access_token: config.accessToken,
      },
    });
    
  } catch (error) {
    console.error('Error getting credentials:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PUT /api/chats/:chatId/repos
//  Update watched repositories
// ═══════════════════════════════════════════════════════════════════════════

router.put('/chats/:chatId/repos', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    // Check if config exists
    const exists = await chatConfigService.exists(chatId);
    if (!exists) {
      res.status(404).json({
        error: 'Not found',
        message: 'Configuration not found for this chat',
      });
      return;
    }
    
    // Validate input
    const parseResult = UpdateWatchedReposSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.flatten(),
      });
      return;
    }
    
    const config = await chatConfigService.updateWatchedRepos(
      chatId,
      parseResult.data.watched_repos
    );
    
    res.json({
      success: true,
      data: {
        chat_id: config!.chatId,
        watched_repos: config!.watchedRepos,
        updated_at: config!.updatedAt,
      },
    });
    
  } catch (error) {
    console.error('Error updating repos:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/chats/:chatId/config
//  Delete chat configuration
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/chats/:chatId/config', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    // Check if config exists
    const exists = await chatConfigService.exists(chatId);
    if (!exists) {
      res.status(404).json({
        error: 'Not found',
        message: 'Configuration not found for this chat',
      });
      return;
    }
    
    await chatConfigService.delete(chatId);
    
    res.json({
      success: true,
      message: 'Configuration deleted successfully',
    });
    
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as apiRouter };

