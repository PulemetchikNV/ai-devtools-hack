import { chatConfigService } from '../../services/chat-config.service.js';
import { GetUserInfoInputSchema, getUserInfoJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

export const getUserInfoTool = {
  name: 'get_user_info',
  description: 
    'Check if a user is registered and get their registration info. ' +
    'Returns registration status, GitLab URL, and timestamps. ' +
    'Use this to check if user needs to register before calling other tools.',
  inputSchema: getUserInfoJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = GetUserInfoInputSchema.safeParse(args);
    
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
    
    const { chat_id } = parseResult.data;
    
    logger.debug('GetUserInfo', `Getting info for user ${chat_id}`);
    
    try {
      // Get user config (without credentials)
      const config = await chatConfigService.get(chat_id);
      
      if (!config) {
        logger.debug('GetUserInfo', `User ${chat_id} not registered`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              registered: false,
              chat_id,
              message: 'User not registered. Use register_user tool to register with GitLab credentials.',
            }),
          }],
        };
      }
      
      logger.debug('GetUserInfo', `User ${chat_id} is registered`);
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            registered: true,
            chat_id: config.chatId,
            gitlab_url: config.gitlabUrl,
            watched_repos: config.watchedRepos,
            created_at: config.createdAt.toISOString(),
            updated_at: config.updatedAt.toISOString(),
          }),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('GetUserInfo', `Failed to get info for user ${chat_id}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INTERNAL_ERROR',
            message: `Failed to get user info: ${errorMessage}`,
          }),
        }],
        isError: true,
      };
    }
  },
};

