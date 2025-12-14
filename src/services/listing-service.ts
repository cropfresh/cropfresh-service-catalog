/**
 * Listing Service - Business Logic Layer
 * 
 * SITUATION: Farmers create/manage crop listings via mobile app
 * TASK: Encapsulate business rules for listing operations
 * ACTION: Validate inputs, orchestrate repository calls, apply business rules
 * RESULT: Clean separation of concerns, testable business logic
 * 
 * @module ListingService
 */

import { listingRepository, ListingRepository } from '../repositories/listing-repository';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
    ListingStatus,
    ListingEntryMode,
    CreateListingInput,
    UpdateListingInput,
    ListingDto,
    ListingListDto,
    ListListingsFilter,
} from '../types/listing';

// ============================================================================
// Custom Errors
// ============================================================================

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

export class InvalidCropError extends Error {
    constructor(cropId: number) {
        super(`Crop with ID ${cropId} does not exist`);
        this.name = 'InvalidCropError';
    }
}

export class InvalidStatusTransitionError extends Error {
    constructor(from: ListingStatus, to: ListingStatus) {
        super(`Cannot transition listing from ${from} to ${to}`);
        this.name = 'InvalidStatusTransitionError';
    }
}

// ============================================================================
// Service Class
// ============================================================================

export class ListingService {
    constructor(private repository: ListingRepository = listingRepository) { }

    /**
     * Create a new listing for a farmer
     * 
     * Validates crop exists, creates as DRAFT status
     */
    async createListing(input: CreateListingInput): Promise<ListingDto> {
        // Validate crop exists
        const crop = await prisma.crop.findUnique({
            where: { id: input.cropId },
        });

        if (!crop) {
            throw new InvalidCropError(input.cropId);
        }

        // Calculate estimated price
        const pricePerKg = Number(crop.basePrice);
        const estimatedPrice = pricePerKg * input.quantityKg;

        // Create listing
        const listing = await this.repository.create(input);

        // Update with pricing
        const updated = await prisma.listing.update({
            where: { id: listing.id },
            data: {
                pricePerKg,
                estimatedPrice,
                // Set expiry to 7 days from now
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            include: { crop: true },
        });

        logger.info({ listingId: listing.id, farmerId: input.farmerId }, 'Listing created');

        return this.toDto(updated);
    }

    /**
     * Get listing by ID with ownership check
     */
    async getListingById(id: number, farmerId: number): Promise<ListingDto> {
        const listing = await this.repository.findById(id);

        if (!listing || listing.deletedAt) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        return this.toDto(listing);
    }

    /**
     * Get all listings for a farmer with pagination
     */
    async getListingsByFarmer(filter: ListListingsFilter): Promise<ListingListDto> {
        const { listings, total } = await this.repository.findByFarmerId(filter);
        const page = filter.page ?? 1;
        const pageSize = filter.pageSize ?? 20;

        return {
            listings: listings.map((l) => this.toDto(l)),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }

    /**
     * Update listing details (only allowed in DRAFT/PENDING_PHOTO status)
     */
    async updateListing(id: number, farmerId: number, input: UpdateListingInput): Promise<ListingDto> {
        const listing = await this.repository.findById(id);

        if (!listing || listing.deletedAt) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Only allow updates in early stages
        const allowedStatuses = [ListingStatus.DRAFT, ListingStatus.PENDING_PHOTO];
        if (!allowedStatuses.includes(listing.status as ListingStatus)) {
            throw new InvalidStatusTransitionError(
                listing.status as ListingStatus,
                listing.status as ListingStatus
            );
        }

        const updated = await this.repository.update(id, input);
        const withCrop = await this.repository.findById(id);

        logger.info({ listingId: id }, 'Listing updated');

        return this.toDto(withCrop!);
    }

    /**
     * Transition listing to a new status
     */
    async updateStatus(
        id: number,
        farmerId: number,
        newStatus: ListingStatus,
        gradingData?: { aiGrade?: string; aiConfidence?: number; estimatedPrice?: number }
    ): Promise<ListingDto> {
        const listing = await this.repository.findById(id);

        if (!listing) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Validate status transition
        if (!this.isValidTransition(listing.status as ListingStatus, newStatus)) {
            throw new InvalidStatusTransitionError(listing.status as ListingStatus, newStatus);
        }

        const updated = await this.repository.updateStatus(id, {
            status: newStatus,
            ...gradingData,
        });

        logger.info({ listingId: id, oldStatus: listing.status, newStatus }, 'Listing status updated');

        const withCrop = await this.repository.findById(id);
        return this.toDto(withCrop!);
    }

    /**
     * Cancel a listing (soft delete)
     */
    async cancelListing(id: number, farmerId: number): Promise<ListingDto> {
        const listing = await this.repository.findById(id);

        if (!listing) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Cannot cancel after IN_TRANSIT
        const nonCancellable = [ListingStatus.IN_TRANSIT, ListingStatus.DELIVERED, ListingStatus.COMPLETED];
        if (nonCancellable.includes(listing.status as ListingStatus)) {
            throw new InvalidStatusTransitionError(listing.status as ListingStatus, ListingStatus.CANCELLED);
        }

        const cancelled = await this.repository.cancel(id);

        logger.info({ listingId: id }, 'Listing cancelled');

        return this.toDto({ ...cancelled, crop: listing.crop });
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    /**
     * Check if status transition is valid
     */
    private isValidTransition(from: ListingStatus, to: ListingStatus): boolean {
        const transitions: Record<ListingStatus, ListingStatus[]> = {
            [ListingStatus.DRAFT]: [ListingStatus.PENDING_PHOTO, ListingStatus.ACTIVE, ListingStatus.CANCELLED],
            [ListingStatus.PENDING_PHOTO]: [ListingStatus.PENDING_GRADING, ListingStatus.CANCELLED],
            [ListingStatus.PENDING_GRADING]: [ListingStatus.ACTIVE, ListingStatus.CANCELLED],
            [ListingStatus.ACTIVE]: [ListingStatus.MATCHED, ListingStatus.EXPIRED, ListingStatus.CANCELLED],
            [ListingStatus.MATCHED]: [ListingStatus.IN_TRANSIT, ListingStatus.CANCELLED],
            [ListingStatus.IN_TRANSIT]: [ListingStatus.DELIVERED],
            [ListingStatus.DELIVERED]: [ListingStatus.COMPLETED],
            [ListingStatus.COMPLETED]: [],
            [ListingStatus.CANCELLED]: [],
            [ListingStatus.EXPIRED]: [],
        };

        return transitions[from]?.includes(to) ?? false;
    }

    /**
     * Convert database entity to DTO
     */
    private toDto(listing: any): ListingDto {
        return {
            id: listing.id,
            farmerId: listing.farmerId,
            cropId: listing.cropId,
            cropName: listing.crop?.name ?? 'Unknown',
            quantityKg: Number(listing.quantityKg),
            unit: listing.unit,
            displayQty: listing.displayQty ? Number(listing.displayQty) : undefined,
            qualityGrade: listing.qualityGrade ?? undefined,
            aiGrade: listing.aiGrade ?? undefined,
            photoUrl: listing.photoUrl ?? undefined,
            photoThumbnail: listing.photoThumbnail ?? undefined,
            entryMode: listing.entryMode as ListingEntryMode,
            status: listing.status as ListingStatus,
            estimatedPrice: listing.estimatedPrice ? Number(listing.estimatedPrice) : undefined,
            pricePerKg: listing.pricePerKg ? Number(listing.pricePerKg) : undefined,
            harvestDate: listing.harvestDate ?? undefined,
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
        };
    }
}

// Export singleton instance
export const listingService = new ListingService();
