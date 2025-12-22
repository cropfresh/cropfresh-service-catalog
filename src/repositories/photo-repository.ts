/**
 * Photo Repository - Data Access Layer
 * 
 * SITUATION: Photos need CRUD operations with Prisma
 * TASK: Encapsulate all photo database queries
 * ACTION: Repository pattern with typed methods, never expose raw Prisma
 * RESULT: Clean data access for photo service layer
 * 
 * @module PhotoRepository
 */

import { prisma } from '../lib/prisma';
import type { ListingPhoto, Prisma } from '../generated/prisma/client';
import {
    CreatePhotoInput,
    UpdatePhotoValidationInput,
    ListPhotosFilter,
    PhotoValidationStatus,
} from '../types/photo';

// ============================================================================
// Repository Class
// ============================================================================

export class PhotoRepository {

    /**
     * Create a new photo record (after presigned URL generated)
     * 
     * @param input - Photo creation input with URLs and metadata
     * @returns Created ListingPhoto record
     */
    async create(input: CreatePhotoInput): Promise<ListingPhoto> {
        return prisma.listingPhoto.create({
            data: {
                listingId: input.listingId,
                photoUrl: input.photoUrl,
                thumbnailUrl: input.thumbnailUrl,
                s3Key: input.s3Key,
                originalFilename: input.originalFilename,
                contentType: input.contentType ?? 'image/jpeg',
                fileSizeBytes: input.fileSizeBytes,
                originalSizeBytes: input.originalSizeBytes,
                width: input.width,
                height: input.height,
                latitude: input.latitude,
                longitude: input.longitude,
                deviceModel: input.deviceModel,
                isPrimary: input.isPrimary ?? false,
                validationStatus: PhotoValidationStatus.PENDING,
            },
        });
    }

    /**
     * Find photo by ID
     * 
     * @param id - Photo ID
     * @returns Photo or null
     */
    async findById(id: number): Promise<ListingPhoto | null> {
        return prisma.listingPhoto.findUnique({
            where: { id },
        });
    }

    /**
     * Find photos by listing ID
     * 
     * @param filter - Filter with listingId and optional status
     * @returns Array of photos
     */
    async findByListingId(filter: ListPhotosFilter): Promise<ListingPhoto[]> {
        const where: Prisma.ListingPhotoWhereInput = {
            listingId: filter.listingId,
            ...(filter.validationStatus && { validationStatus: filter.validationStatus }),
        };

        return prisma.listingPhoto.findMany({
            where,
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'desc' },
            ],
        });
    }

    /**
     * Update photo with confirmed upload metadata
     * 
     * @param id - Photo ID
     * @param metadata - Upload metadata (size, dimensions, location)
     * @returns Updated photo
     */
    async updateMetadata(
        id: number,
        metadata: Partial<CreatePhotoInput>
    ): Promise<ListingPhoto> {
        return prisma.listingPhoto.update({
            where: { id },
            data: {
                ...(metadata.fileSizeBytes !== undefined && { fileSizeBytes: metadata.fileSizeBytes }),
                ...(metadata.originalSizeBytes !== undefined && { originalSizeBytes: metadata.originalSizeBytes }),
                ...(metadata.width !== undefined && { width: metadata.width }),
                ...(metadata.height !== undefined && { height: metadata.height }),
                ...(metadata.latitude !== undefined && { latitude: metadata.latitude }),
                ...(metadata.longitude !== undefined && { longitude: metadata.longitude }),
                ...(metadata.deviceModel && { deviceModel: metadata.deviceModel }),
            },
        });
    }

    /**
     * Update photo validation status after AI check
     * 
     * @param id - Photo ID
     * @param input - Validation result
     * @returns Updated photo
     */
    async updateValidation(
        id: number,
        input: UpdatePhotoValidationInput
    ): Promise<ListingPhoto> {
        return prisma.listingPhoto.update({
            where: { id },
            data: {
                qualityScore: input.qualityScore,
                validationStatus: input.validationStatus,
                validationMessage: input.validationMessage,
            },
        });
    }

    /**
     * Set photo as primary for listing
     * 
     * @param id - Photo ID to make primary
     * @param listingId - Listing ID to update
     */
    async setPrimary(id: number, listingId: number): Promise<void> {
        // First, unset any existing primary
        await prisma.listingPhoto.updateMany({
            where: { listingId, isPrimary: true },
            data: { isPrimary: false },
        });

        // Set new primary
        await prisma.listingPhoto.update({
            where: { id },
            data: { isPrimary: true },
        });
    }

    /**
     * Delete photo
     * 
     * @param id - Photo ID
     * @returns Deleted photo
     */
    async delete(id: number): Promise<ListingPhoto> {
        return prisma.listingPhoto.delete({
            where: { id },
        });
    }

    /**
     * Check if photo belongs to listing
     * 
     * @param photoId - Photo ID
     * @param listingId - Expected listing ID
     * @returns true if photo belongs to listing
     */
    async belongsToListing(photoId: number, listingId: number): Promise<boolean> {
        const count = await prisma.listingPhoto.count({
            where: { id: photoId, listingId },
        });
        return count > 0;
    }

    /**
     * Get primary photo for listing
     * 
     * @param listingId - Listing ID
     * @returns Primary photo or null
     */
    async getPrimaryPhoto(listingId: number): Promise<ListingPhoto | null> {
        return prisma.listingPhoto.findFirst({
            where: { listingId, isPrimary: true },
        });
    }
}

// Export singleton instance
export const photoRepository = new PhotoRepository();
