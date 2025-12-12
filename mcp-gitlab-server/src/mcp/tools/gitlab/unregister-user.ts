import { chatConfigService } from '../../../services/chat-config.service.js';
import { UnregisterUserInputSchema, unregisterUserJsonSchema } from './schemas.js';
import { logger } from '../../../utils/logger.js';

export const unregisterUserTool = {
  name: 'unregister_user',
  description: 
    'Remove a user registration and delete their stored GitLab credentials. ' +
    'This action cannot be undone. User will need to register again to use GitLab tools.',
  inputSchema: unregisterUserJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = UnregisterUserInputSchema.safeParse(args);
    
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
    
    logger.debug('UnregisterUser', `Unregistering user ${chat_id}`);
    
    try {
      // Check if user exists
      const exists = await chatConfigService.exists(chat_id);
      
      if (!exists) {
        logger.warn('UnregisterUser', `User ${chat_id} not found`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'USER_NOT_REGISTERED',
              message: 'User not registered.',
            }),
          }],
          isError: true,
        };
      }
      
      // Delete user
      await chatConfigService.delete(chat_id);
      
      logger.info('UnregisterUser', `User ${chat_id} unregistered successfully`);
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: 'User unregistered successfully. All credentials have been deleted.',
            chat_id,
          }),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('UnregisterUser', `Failed to unregister user ${chat_id}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INTERNAL_ERROR',
            message: `Failed to unregister user: ${errorMessage}`,
          }),
        }],
        isError: true,
      };
    }
  },
};

