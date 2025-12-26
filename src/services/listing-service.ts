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
    CancellationReason,
    CreateListingInput,
    UpdateListingInput,
    CancelListingInput,
    ListingDto,
    ListingListDto,
    ListListingsFilter,
    UpdateListingResult,
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

/**
 * Story 3.9: AC8 - Cannot cancel within 2 hours of drop-off
 */
export class CancellationNotAllowedError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'CancellationNotAllowedError';
    }
}

/**
 * Story 3.9: AC3 - Cannot increase quantity beyond original
 */
export class QuantityExceedsOriginalError extends Error {
    constructor(original: number, attempted: number) {
        super(`Cannot increase quantity from ${original}kg to ${attempted}kg`);
        this.name = 'QuantityExceedsOriginalError';
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
     * Update listing details - Story 3.9: Now allowed in ACTIVE status too
     * 
     * SITUATION: Farmer wants to update listing before match
     * TASK: Validate quantity <= original, recalculate price if changed
     * ACTION: Check status, validate input, update DB, return result with price flag
     * RESULT: Updated listing with priceChanged indicator
     */
    async updateListingWithResult(
        id: number,
        farmerId: number,
        input: UpdateListingInput
    ): Promise<UpdateListingResult> {
        const listing = await this.repository.findById(id);

        if (!listing || listing.deletedAt) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Story 3.9: Allow ACTIVE status updates (AC2)
        const allowedStatuses = [
            ListingStatus.DRAFT,
            ListingStatus.PENDING_PHOTO,
            ListingStatus.ACTIVE,
        ];
        if (!allowedStatuses.includes(listing.status as ListingStatus)) {
            throw new InvalidStatusTransitionError(
                listing.status as ListingStatus,
                listing.status as ListingStatus
            );
        }

        // Story 3.9 AC3: Validate quantity <= original
        const originalQty = Number(listing.quantityKg);
        if (input.quantityKg !== undefined && input.quantityKg > originalQty) {
            throw new QuantityExceedsOriginalError(originalQty, input.quantityKg);
        }

        // Track if quantity changed for price recalculation
        const oldEstimatedPrice = listing.estimatedPrice ? Number(listing.estimatedPrice) : 0;
        let newEstimatedPrice = oldEstimatedPrice;
        let priceChanged = false;

        // Recalculate estimated price if quantity changed
        if (input.quantityKg !== undefined && input.quantityKg !== originalQty) {
            const pricePerKg = listing.pricePerKg ? Number(listing.pricePerKg) : 0;
            newEstimatedPrice = pricePerKg * input.quantityKg;
            priceChanged = true;
        }

        // Update the listing
        const updateData = {
            ...input,
            estimatedPrice: priceChanged ? newEstimatedPrice : undefined,
        };
        await this.repository.update(id, updateData);
        const withCrop = await this.repository.findById(id);

        logger.info({ listingId: id, priceChanged }, 'Listing updated (Story 3.9)');

        return {
            listing: this.toDto(withCrop!),
            priceChanged,
            newEstimatedPrice: priceChanged ? newEstimatedPrice : undefined,
            message: priceChanged
                ? `Listing updated. New estimated earnings: ₹${newEstimatedPrice.toFixed(0)}`
                : 'Listing updated successfully',
        };
    }

    /**
     * Update listing details (legacy method for backward compatibility)
     */
    async updateListing(id: number, farmerId: number, input: UpdateListingInput): Promise<ListingDto> {
        const result = await this.updateListingWithResult(id, farmerId, input);
        return result.listing;
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
     * Cancel a listing - Story 3.9: Enhanced with reason tracking
     * 
     * SITUATION: Farmer wants to cancel listing before pickup
     * TASK: Validate cancellation allowed, store reason for analytics
     * ACTION: Check status (allow until IN_TRANSIT), update status to CANCELLED
     * RESULT: Cancelled listing with reason stored
     */
    async cancelListing(
        id: number,
        farmerId: number,
        input?: CancelListingInput
    ): Promise<ListingDto> {
        const listing = await this.repository.findById(id);

        if (!listing) {
            throw new ListingNotFoundError(id);
        }

        if (listing.farmerId !== farmerId) {
            throw new ListingAccessDeniedError();
        }

        // Story 3.9 AC8: Cannot cancel after IN_TRANSIT (existing rule)
        const nonCancellableStatuses = [
            ListingStatus.IN_TRANSIT,
            ListingStatus.DELIVERED,
            ListingStatus.COMPLETED,
        ];
        if (nonCancellableStatuses.includes(listing.status as ListingStatus)) {
            throw new CancellationNotAllowedError(
                `Cannot cancel: listing is already ${listing.status.toLowerCase()}`
            );
        }

        // Cancel with reason (Story 3.9 AC9)
        const reason = input?.reason ?? CancellationReason.OTHER;
        const cancelled = await this.repository.cancelWithReason(id, reason);

        logger.info({ listingId: id, reason }, 'Listing cancelled (Story 3.9)');

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
     * Extended for Story 3.9 with cancellation fields and edit/cancel flags
     */
    private toDto(listing: any): ListingDto {
        const status = listing.status as ListingStatus;

        // Story 3.9 AC1: Compute editable/cancellable flags
        const editableStatuses = [ListingStatus.DRAFT, ListingStatus.PENDING_PHOTO, ListingStatus.ACTIVE];
        const cancellableStatuses = [
            ListingStatus.DRAFT,
            ListingStatus.PENDING_PHOTO,
            ListingStatus.PENDING_GRADING,
            ListingStatus.ACTIVE,
            ListingStatus.MATCHED,
        ];

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
            status,
            estimatedPrice: listing.estimatedPrice ? Number(listing.estimatedPrice) : undefined,
            pricePerKg: listing.pricePerKg ? Number(listing.pricePerKg) : undefined,
            harvestDate: listing.harvestDate ?? undefined,
            // Story 3.9: Cancellation tracking
            cancelledAt: listing.cancelledAt ?? undefined,
            cancellationReason: listing.cancellationReason ?? undefined,
            // Story 3.9 AC1: Computed flags for UI
            canEdit: editableStatuses.includes(status),
            canCancel: cancellableStatuses.includes(status),
            createdAt: listing.createdAt,
            updatedAt: listing.updatedAt,
        };
    }
}

// Export singleton instance
export const listingService = new ListingService();
