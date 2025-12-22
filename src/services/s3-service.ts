/**
 * S3 Service - Object Storage Integration
 * 
 * SITUATION: Photos need presigned upload URLs and storage management
 * TASK: Provide S3-compatible object storage operations
 * ACTION: Wrap AWS SDK with typed methods for photo operations
 * RESULT: Clean S3 access for photo upload workflow
 * 
 * @module S3Service
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface S3Config {
    bucket: string;
    region: string;
    endpoint?: string; // For MinIO/LocalStack
    accessKeyId: string;
    secretAccessKey: string;
}

const getS3Config = (): S3Config => ({
    bucket: process.env.S3_BUCKET || 'cropfresh-photos',
    region: process.env.S3_REGION || 'ap-south-1',
    endpoint: process.env.S3_ENDPOINT, // undefined for real S3
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
});

// ============================================================================
// S3 Service Class
// ============================================================================

export class S3Service {
    private client: S3Client;
    private bucket: string;

    constructor() {
        const config = getS3Config();
        this.bucket = config.bucket;

        this.client = new S3Client({
            region: config.region,
            ...(config.endpoint && {
                endpoint: config.endpoint,
                forcePathStyle: true, // Required for MinIO
            }),
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }

    /**
     * Generate presigned URL for direct client upload
     * 
     * @param s3Key - Object key in bucket
     * @param contentType - MIME type
     * @param expiresIn - URL validity in seconds (default 15 min)
     * @returns Presigned upload URL
     */
    async getPresignedUploadUrl(
        s3Key: string,
        contentType: string,
        expiresIn: number = 900
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn });

        logger.debug({ s3Key, expiresIn }, 'Generated presigned upload URL');
        return url;
    }

    /**
     * Get public URL for an object
     * 
     * @param s3Key - Object key
     * @returns Public URL
     */
    getPublicUrl(s3Key: string): string {
        const config = getS3Config();
        if (config.endpoint) {
            // MinIO/LocalStack
            return `${config.endpoint}/${this.bucket}/${s3Key}`;
        }
        // Real S3
        return `https://${this.bucket}.s3.${config.region}.amazonaws.com/${s3Key}`;
    }

    /**
     * Delete an object from S3
     * 
     * @param s3Key - Object key to delete
     */
    async deleteObject(s3Key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
        });

        await this.client.send(command);
        logger.debug({ s3Key }, 'Deleted object from S3');
    }

    /**
     * Generate S3 key for listing photo
     * 
     * Pattern: listings/{listingId}/{photoId}.jpg
     */
    generatePhotoKey(listingId: number, photoId: number, extension: string = 'jpg'): string {
        return `listings/${listingId}/${photoId}.${extension}`;
    }

    /**
     * Generate S3 key for thumbnail
     */
    generateThumbnailKey(listingId: number, photoId: number): string {
        return `listings/${listingId}/${photoId}_thumb.jpg`;
    }
}

// Export singleton
export const s3Service = new S3Service();
