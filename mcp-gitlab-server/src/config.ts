import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  API_KEY: z.string().min(16, 'API_KEY must be at least 16 characters'),
  
  // Optional: Default GitLab credentials for testing
  DEFAULT_GITLAB_URL: z.string().optional(),
  DEFAULT_GITLAB_TOKEN: z.string().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return {
    port: result.data.PORT,
    nodeEnv: result.data.NODE_ENV,
    databaseUrl: result.data.DATABASE_URL,
    encryptionKey: result.data.ENCRYPTION_KEY,
    apiKey: result.data.API_KEY,
    isDev: result.data.NODE_ENV === 'development',
    isProd: result.data.NODE_ENV === 'production',
    
    // Optional defaults for testing
    defaultGitlabUrl: result.data.DEFAULT_GITLAB_URL,
    defaultGitlabToken: result.data.DEFAULT_GITLAB_TOKEN,
  };
}

export const config = loadConfig();
export type Config = ReturnType<typeof loadConfig>;

