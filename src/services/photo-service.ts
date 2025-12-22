/**
 * Photo Service - Business Logic Layer
 * 
 * SITUATION: farmers upload photos of produce for AI quality grading
 * TASK: Orchestrate photo upload workflow with presigned URLs and validation
 * ACTION: Coordinate S3, database, and AI service calls
 * RESULT: Complete photo upload and validation flow
 * 
 * @module PhotoService
 */

import { photoRepository, PhotoRepository } from '../repositories/photo-repository';
import { listingRepository } from '../repositories/listing-repository';
import { s3Service, S3Service } from './s3-service';
import { logger } from '../utils/logger';
import {
    CreatePhotoInput,
    PresignedUrlRequest,
    PresignedUrlResponse,
    ConfirmUploadInput,
    PhotoResponse,
    PhotoValidationStatus,
    UpdatePhotoValidationInput,
    PhotoValidationResult,
    ListPhotosFilter,
} from '../types/photo';

// ============================================================================
// Custom Errors
// ============================================================================

export class PhotoNotFoundError extends Error {
    constructor(id: number) {
        super(`Photo with ID ${id} not found`);
        this.name = 'PhotoNotFoundError';
    }
}

export class PhotoAccessDeniedError extends Error {
    constructor() {
        super('You do not have permission to access this photo');
        this.name = 'PhotoAccessDeniedError';
    }
}

export class ListingNotFoundError extends Error {
    constructor(id: number) {
        super(`Listing with ID ${id} not found`);
        this.name = 'ListingNotFoundError';
    }
}

export class ListingAccessDeniedError extends Error {
    constructor() {
        super('You do not have permission to access this listing');
        this.name = 'ListingAccessDeniedError';
    }
}

// ============================================================================
// Service Class
// ============================================================================

export class PhotoService {
    constructor(
        private repository: PhotoRepository = photoRepository,
        private s3: S3Service = s3Service
    ) { }

    /**
     * Generate presigned URL for photo upload
     * 
     * Creates a pending photo record and returns presigned URL for direct upload
     * 
     * @param farmerId - Farmer making request
     * @param request - Presigned URL request
     * @returns Presigned URL response with photo ID
     */
    async generatePresignedUrl(
        farmerId: number,
        request: PresignedUrlRequest
    ): Promise<PresignedUrlResponse> {
        // Validate listing exists and belongs to farmer
        const listing = await listingRepository.findById(request.listingId);
        if (!listing) {
            throw new ListingNotFoundError(request.listingId);
        }
        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Create pending photo record
        const extension = this.getExtension(request.contentType);
        const tempS3Key = `pending/${request.listingId}/${Date.now()}.${extension}`;

        const photo = await this.repository.create({
            listingId: request.listingId,
            photoUrl: '', // Will be updated after upload
            s3Key: tempS3Key,
            originalFilename: request.fileName,
            contentType: request.contentType,
        });

        // Generate presigned URL
        const presignedUrl = await this.s3.getPresignedUploadUrl(
            tempS3Key,
            request.contentType,
            900 // 15 minutes
        );

        logger.info(
            { photoId: photo.id, listingId: request.listingId },
            'Generated presigned upload URL'
        );

        return {
            photoId: photo.id,
            presignedUrl,
            s3Key: tempS3Key,
            expiresIn: 900,
        };
    }

    /**
     * Confirm photo upload after client uploads to S3
     * 
     * Updates photo record with metadata and final URL
     * 
     * @param farmerId - Farmer making request
     * @param input - Confirmation data with metadata
     * @returns Updated photo response
     */
    async confirmUpload(
        farmerId: number,
        input: ConfirmUploadInput
    ): Promise<PhotoResponse> {
        // Validate photo exists
        const photo = await this.repository.findById(input.photoId);
        if (!photo) {
            throw new PhotoNotFoundError(input.photoId);
        }

        // Validate listing ownership
        const listing = await listingRepository.findById(input.listingId);
        if (!listing || listing.farmerId !== farmerId) {
            throw new PhotoAccessDeniedError();
        }

        // Move from pending to final location
        const finalS3Key = this.s3.generatePhotoKey(input.listingId, input.photoId);
        const photoUrl = this.s3.getPublicUrl(finalS3Key);

        // Update photo with metadata
        await this.repository.updateMetadata(input.photoId, {
            fileSizeBytes: input.fileSizeBytes,
            originalSizeBytes: input.originalSizeBytes,
            width: input.width,
            height: input.height,
            latitude: input.latitude,
            longitude: input.longitude,
            deviceModel: input.deviceModel,
        });

        // Check if this is the first photo - make it primary
        const existingPhotos = await this.repository.findByListingId({
            listingId: input.listingId,
        });
        const isPrimary = existingPhotos.length === 1;

        if (isPrimary) {
            await this.repository.setPrimary(input.photoId, input.listingId);
        }

        const updatedPhoto = await this.repository.findById(input.photoId);

        logger.info(
            { photoId: input.photoId, listingId: input.listingId },
            'Photo upload confirmed'
        );

        return this.toResponse(updatedPhoto!);
    }

    /**
     * Update photo with validation results from AI service
     * 
     * @param photoId - Photo ID
     * @param result - Validation result from AI
     * @returns Updated photo
     */
    async updateValidation(
        photoId: number,
        result: PhotoValidationResult
    ): Promise<PhotoResponse> {
        const input: UpdatePhotoValidationInput = {
            qualityScore: result.qualityScore,
            validationStatus: result.isValid
                ? PhotoValidationStatus.VALID
                : PhotoValidationStatus.INVALID,
            validationMessage: result.issues.length > 0
                ? result.issues.map(i => i.message).join('; ')
                : undefined,
        };

        const photo = await this.repository.updateValidation(photoId, input);

        logger.info(
            { photoId, isValid: result.isValid, qualityScore: result.qualityScore },
            'Photo validation updated'
        );

        return this.toResponse(photo);
    }

    /**
     * Get all photos for a listing
     * 
     * @param farmerId - Farmer making request
     * @param listingId - Listing ID
     * @returns Array of photos
     */
    async getPhotosForListing(
        farmerId: number,
        listingId: number
    ): Promise<PhotoResponse[]> {
        // Validate listing ownership
        const listing = await listingRepository.findById(listingId);
        if (!listing) {
            throw new ListingNotFoundError(listingId);
        }
        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        const photos = await this.repository.findByListingId({ listingId });
        return photos.map(p => this.toResponse(p));
    }

    /**
     * Delete a photo
     * 
     * @param farmerId - Farmer making request
     * @param photoId - Photo ID to delete
     * @param listingId - Listing ID for validation
     */
    async deletePhoto(
        farmerId: number,
        photoId: number,
        listingId: number
    ): Promise<void> {
        // Validate ownership
        const listing = await listingRepository.findById(listingId);
        if (!listing || listing.farmerId !== farmerId) {
            throw new PhotoAccessDeniedError();
        }

        const photo = await this.repository.findById(photoId);
        if (!photo || photo.listingId !== listingId) {
            throw new PhotoNotFoundError(photoId);
        }

        // Delete from S3
        try {
            await this.s3.deleteObject(photo.s3Key);
        } catch (error) {
            logger.warn({ photoId, s3Key: photo.s3Key, error }, 'Failed to delete from S3');
        }

        // Delete from database
        await this.repository.delete(photoId);

        logger.info({ photoId, listingId }, 'Photo deleted');
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    private getExtension(contentType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
        };
        return map[contentType] || 'jpg';
    }

    private toResponse(photo: any): PhotoResponse {
        return {
            id: photo.id,
            listingId: photo.listingId,
            photoUrl: photo.photoUrl,
            thumbnailUrl: photo.thumbnailUrl,
            originalFilename: photo.originalFilename,
            contentType: photo.contentType,
            fileSizeBytes: photo.fileSizeBytes,
            width: photo.width,
            height: photo.height,
            qualityScore: photo.qualityScore ? Number(photo.qualityScore) : null,
            validationStatus: photo.validationStatus,
            validationMessage: photo.validationMessage,
            isPrimary: photo.isPrimary,
            createdAt: photo.createdAt.toISOString(),
        };
    }
}

// Export singleton
export const photoService = new PhotoService();
