import { prisma } from '../db/client.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface CreateChatConfigInput {
  gitlabUrl: string;
  accessToken: string;
  watchedRepos?: string[];
}

export interface ChatConfigPublic {
  chatId: string;
  gitlabUrl: string;
  watchedRepos: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConfigWithCredentials extends ChatConfigPublic {
  accessToken: string;
}

export class ChatConfigService {
  /**
   * Create or update chat configuration
   */
  async upsert(chatId: string, input: CreateChatConfigInput): Promise<ChatConfigPublic> {
    logger.debug('ChatConfig', `Upserting config for chat ${chatId}`, {
      gitlabUrl: input.gitlabUrl,
      watchedRepos: input.watchedRepos,
    });
    
    // Encrypt the access token before storing
    const encryptedToken = encrypt(input.accessToken, config.encryptionKey);
    
    const result = await prisma.chatConfig.upsert({
      where: { chatId },
      create: {
        chatId,
        gitlabUrl: input.gitlabUrl,
        accessToken: encryptedToken,
        watchedRepos: input.watchedRepos ?? [],
      },
      update: {
        gitlabUrl: input.gitlabUrl,
        accessToken: encryptedToken,
        watchedRepos: input.watchedRepos ?? [],
      },
    });

    logger.info('ChatConfig', `Config saved for chat ${chatId}`);

    return {
      chatId: result.chatId,
      gitlabUrl: result.gitlabUrl,
      watchedRepos: result.watchedRepos,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Get chat configuration (without credentials)
   */
  async get(chatId: string): Promise<ChatConfigPublic | null> {
    logger.debug('ChatConfig', `Getting config for chat ${chatId}`);
    
    const result = await prisma.chatConfig.findUnique({
      where: { chatId },
    });

    if (!result) {
      logger.debug('ChatConfig', `Config not found for chat ${chatId}`);
      return null;
    }

    return {
      chatId: result.chatId,
      gitlabUrl: result.gitlabUrl,
      watchedRepos: result.watchedRepos,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Get chat configuration with decrypted credentials
   * USE WITH CAUTION - only for internal use
   */
  async getWithCredentials(chatId: string): Promise<ChatConfigWithCredentials | null> {
    logger.debug('ChatConfig', `Getting credentials for chat ${chatId}`);
    
    const result = await prisma.chatConfig.findUnique({
      where: { chatId },
    });

    if (!result) {
      logger.debug('ChatConfig', `Config not found for chat ${chatId}`);
      return null;
    }

    // Decrypt the access token
    const decryptedToken = decrypt(result.accessToken, config.encryptionKey);
    
    logger.debug('ChatConfig', `Credentials retrieved for chat ${chatId}`);

    return {
      chatId: result.chatId,
      gitlabUrl: result.gitlabUrl,
      accessToken: decryptedToken,
      watchedRepos: result.watchedRepos,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Delete chat configuration
   */
  async delete(chatId: string): Promise<void> {
    logger.info('ChatConfig', `Deleting config for chat ${chatId}`);
    await prisma.chatConfig.delete({
      where: { chatId },
    });
  }

  /**
   * Update watched repositories for a chat
   */
  async updateWatchedRepos(chatId: string, repos: string[]): Promise<ChatConfigPublic | null> {
    const result = await prisma.chatConfig.update({
      where: { chatId },
      data: { watchedRepos: repos },
    });

    return {
      chatId: result.chatId,
      gitlabUrl: result.gitlabUrl,
      watchedRepos: result.watchedRepos,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Check if chat configuration exists
   */
  async exists(chatId: string): Promise<boolean> {
    const count = await prisma.chatConfig.count({
      where: { chatId },
    });
    return count > 0;
  }
}

// Singleton instance
export const chatConfigService = new ChatConfigService();

