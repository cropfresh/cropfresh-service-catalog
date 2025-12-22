/**
 * Listing Repository - Data Access Layer
 * 
 * SITUATION: Farmers create crop listings via mobile app
 * TASK: Provide data access methods for listing CRUD operations
 * ACTION: Encapsulate Prisma queries, never expose raw Prisma client
 * RESULT: Type-safe data access with clean separation from business logic
 * 
 * @module ListingRepository
 */

import { prisma } from '../lib/prisma';
import type { Listing, Prisma } from '../generated/prisma/client';
import {
    ListingStatus,
    ListingEntryMode,
    CreateListingInput,
    UpdateListingInput,
    UpdateListingStatusInput,
    ListListingsFilter,
} from '../types/listing';

// ============================================================================
// Repository Class
// ============================================================================

export class ListingRepository {

    /**
     * Create a new listing
     * 
     * @param input - CreateListingInput with farmer, crop, quantity
     * @returns Created Listing record
     */
    async create(input: CreateListingInput): Promise<Listing> {
        return prisma.listing.create({
            data: {
                farmerId: input.farmerId,
                cropId: input.cropId,
                quantityKg: input.quantityKg,
                unit: input.unit ?? 'kg',
                displayQty: input.displayQty,
                qualityGrade: input.qualityGrade,
                entryMode: input.entryMode,
                voiceText: input.voiceText,
                voiceLanguage: input.voiceLanguage,
                harvestDate: input.harvestDate,
                status: ListingStatus.DRAFT,
            },
        });
    }

    /**
     * Find listing by ID with crop details
     * 
     * @param id - Listing ID
     * @returns Listing with crop relation or null
     */
    async findById(id: number): Promise<Listing & { crop: { name: string; category: string } } | null> {
        return prisma.listing.findUnique({
            where: { id },
            include: {
                crop: {
                    select: {
                        name: true,
                        category: true,
                    },
                },
            },
        });
    }

    /**
     * Find listings by farmer ID with pagination
     * 
     * @param filter - Filter options including farmerId, status, pagination
     * @returns Paginated listings with total count
     */
    async findByFarmerId(filter: ListListingsFilter): Promise<{ listings: Listing[]; total: number }> {
        const { farmerId, status, cropId, page = 1, pageSize = 20 } = filter;

        const where: Prisma.ListingWhereInput = {
            farmerId,
            deletedAt: null,
            ...(status && { status }),
            ...(cropId && { cropId }),
        };

        const [listings, total] = await Promise.all([
            prisma.listing.findMany({
                where,
                include: {
                    crop: {
                        select: { name: true, category: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.listing.count({ where }),
        ]);

        return { listings, total };
    }

    /**
     * Update listing details (quantity, quality, dates)
     * 
     * @param id - Listing ID
     * @param input - Fields to update
     * @returns Updated Listing
     */
    async update(id: number, input: UpdateListingInput): Promise<Listing> {
        return prisma.listing.update({
            where: { id },
            data: {
                ...(input.quantityKg !== undefined && { quantityKg: input.quantityKg }),
                ...(input.unit && { unit: input.unit }),
                ...(input.qualityGrade && { qualityGrade: input.qualityGrade }),
                ...(input.harvestDate && { harvestDate: input.harvestDate }),
                ...(input.photoUrl && { photoUrl: input.photoUrl }),
                ...(input.photoThumbnail && { photoThumbnail: input.photoThumbnail }),
            },
        });
    }

    /**
     * Update listing status with optional AI grading data
     * 
     * @param id - Listing ID
     * @param input - Status and optional grading fields
     * @returns Updated Listing
     */
    async updateStatus(id: number, input: UpdateListingStatusInput): Promise<Listing> {
        const now = new Date();

        return prisma.listing.update({
            where: { id },
            data: {
                status: input.status,
                ...(input.aiGrade && { aiGrade: input.aiGrade }),
                ...(input.aiConfidence !== undefined && { aiConfidence: input.aiConfidence }),
                ...(input.estimatedPrice !== undefined && { estimatedPrice: input.estimatedPrice }),
                ...(input.pricePerKg !== undefined && { pricePerKg: input.pricePerKg }),
                ...(input.status === ListingStatus.MATCHED && { matchedAt: now }),
                ...(input.status === ListingStatus.COMPLETED && { completedAt: now }),
            },
        });
    }

    /**
     * Soft delete (cancel) a listing
     * 
     * @param id - Listing ID
     * @returns Updated Listing with CANCELLED status
     */
    async cancel(id: number): Promise<Listing> {
        return prisma.listing.update({
            where: { id },
            data: {
                status: ListingStatus.CANCELLED,
                deletedAt: new Date(),
            },
        });
    }

    /**
     * Check if listing belongs to farmer
     * 
     * @param id - Listing ID
     * @param farmerId - Farmer ID to verify
     * @returns true if farmer owns listing
     */
    async belongsToFarmer(id: number, farmerId: number): Promise<boolean> {
        const count = await prisma.listing.count({
            where: { id, farmerId, deletedAt: null },
        });
        return count > 0;
    }
}

// Export singleton instance
export const listingRepository = new ListingRepository();
