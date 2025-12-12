import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { RegisterUserInputSchema, registerUserJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

export const registerUserTool = {
  name: 'register_user',
  description: 
    'Register a new user by saving their GitLab credentials. ' +
    'The user must provide their Telegram chat_id, GitLab URL, and access token. ' +
    'This tool validates the credentials before saving. ' +
    'If user already exists, returns an error - use update_user_credentials instead.',
  inputSchema: registerUserJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = RegisterUserInputSchema.safeParse(args);
    
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
    
    const { chat_id, gitlab_url, access_token } = parseResult.data;
    
    logger.debug('RegisterUser', `Registering user ${chat_id} for ${gitlab_url}`);
    
    try {
      // Check if user already exists
      const existingUser = await chatConfigService.exists(chat_id);
      
      if (existingUser) {
        logger.warn('RegisterUser', `User ${chat_id} already exists`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'USER_ALREADY_EXISTS',
              message: 'User already registered. Use update_user_credentials tool to update credentials.',
            }),
          }],
          isError: true,
        };
      }
      
      // Validate GitLab credentials
      const isValid = await gitlabService.validateCredentials(gitlab_url, access_token);
      
      if (!isValid) {
        logger.warn('RegisterUser', `Invalid credentials for ${gitlab_url}`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'INVALID_CREDENTIALS',
              message: 'Could not authenticate with GitLab. Please check your URL and access token.',
            }),
          }],
          isError: true,
        };
      }
      
      // Get GitLab user info
      const gitlabUser = await gitlabService.getCurrentUser(gitlab_url, access_token);
      
      // Save to database
      await chatConfigService.upsert(chat_id, {
        gitlabUrl: gitlab_url,
        accessToken: access_token,
      });
      
      logger.info('RegisterUser', `User ${chat_id} registered successfully as ${gitlabUser.username}`);
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: 'User registered successfully',
            data: {
              chat_id,
              gitlab_url,
              gitlab_username: gitlabUser.username,
              gitlab_name: gitlabUser.name,
            },
          }),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('RegisterUser', `Failed to register user ${chat_id}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INTERNAL_ERROR',
            message: `Failed to register user: ${errorMessage}`,
          }),
        }],
        isError: true,
      };
    }
  },
};

