import { gitlabService } from '../../services/gitlab.service.js';
import { chatConfigService } from '../../services/chat-config.service.js';
import { UpdateUserCredentialsInputSchema, updateUserCredentialsJsonSchema } from './schemas.js';
import { logger } from '../../utils/logger.js';

export const updateUserCredentialsTool = {
  name: 'update_user_credentials',
  description: 
    'Update GitLab credentials for an existing registered user. ' +
    'You can update gitlab_url, access_token, or both. ' +
    'User must be registered first using register_user tool.',
  inputSchema: updateUserCredentialsJsonSchema,
  
  async handler(args: unknown) {
    // Validate input
    const parseResult = UpdateUserCredentialsInputSchema.safeParse(args);
    
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
    
    // Check if at least one field to update is provided
    if (!gitlab_url && !access_token) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INVALID_INPUT',
            message: 'At least one of gitlab_url or access_token must be provided.',
          }),
        }],
        isError: true,
      };
    }
    
    logger.debug('UpdateUserCredentials', `Updating credentials for user ${chat_id}`);
    
    try {
      // Check if user exists
      const existingConfig = await chatConfigService.getWithCredentials(chat_id);
      
      if (!existingConfig) {
        logger.warn('UpdateUserCredentials', `User ${chat_id} not found`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'USER_NOT_REGISTERED',
              message: 'User not registered. Use register_user tool first.',
            }),
          }],
          isError: true,
        };
      }
      
      // Prepare updated values
      const newGitlabUrl = gitlab_url || existingConfig.gitlabUrl;
      const newAccessToken = access_token || existingConfig.accessToken;
      
      // Validate new credentials
      const isValid = await gitlabService.validateCredentials(newGitlabUrl, newAccessToken);
      
      if (!isValid) {
        logger.warn('UpdateUserCredentials', `Invalid new credentials for ${newGitlabUrl}`);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'INVALID_CREDENTIALS',
              message: 'Could not authenticate with GitLab using the new credentials. Please check your URL and access token.',
            }),
          }],
          isError: true,
        };
      }
      
      // Update in database
      await chatConfigService.upsert(chat_id, {
        gitlabUrl: newGitlabUrl,
        accessToken: newAccessToken,
      });
      
      logger.info('UpdateUserCredentials', `Credentials updated for user ${chat_id}`);
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: 'Credentials updated successfully',
            data: {
              chat_id,
              gitlab_url: newGitlabUrl,
              updated_fields: {
                gitlab_url: !!gitlab_url,
                access_token: !!access_token,
              },
            },
          }),
        }],
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('UpdateUserCredentials', `Failed to update credentials for user ${chat_id}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'INTERNAL_ERROR',
            message: `Failed to update credentials: ${errorMessage}`,
          }),
        }],
        isError: true,
      };
    }
  },
};

