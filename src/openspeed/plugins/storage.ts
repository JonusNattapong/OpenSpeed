import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Context } from '../context.js';

export interface StorageConfig {
  provider: 's3' | 'r2';
  accessKeyId: string;
  secretAccessKey: string;
  region?: string; // For S3
  accountId?: string; // For R2
  bucket: string;
  endpoint?: string; // For R2
}

export function storagePlugin(config: StorageConfig) {
  const s3Config: any = {
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    region: config.region || 'auto',
  };

  if (config.provider === 'r2') {
    s3Config.endpoint = config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;
  }

  const s3Client = new S3Client(s3Config);

  return async (ctx: Context, next: () => Promise<any>) => {
    ctx.storage = {
      upload: async (key: string, body: Buffer | Uint8Array | string, contentType?: string) => {
        try {
          const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
          });

          const result = await s3Client.send(command);
          return { success: true, etag: result.ETag };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      download: async (key: string) => {
        try {
          const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
          });

          const result = await s3Client.send(command);
          const body = await result.Body?.transformToByteArray();
          return { success: true, body, contentType: result.ContentType };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      delete: async (key: string) => {
        try {
          const command = new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: key,
          });

          await s3Client.send(command);
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      getSignedUrl: async (key: string, expiresIn: number = 3600) => {
        // Note: For signed URLs, you'd need @aws-sdk/s3-request-presigner
        // This is a simplified implementation
        return { success: false, error: 'Signed URLs not implemented in this version' };
      },
    };
    await next();
  };
}