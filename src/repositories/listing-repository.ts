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
    CancellationReason,
    CreateListingInput,
    UpdateListingInput,
    UpdateListingStatusInput,
    ListListingsFilter,
    // Story 4.1: Buyer inventory browse types
    SortOption,
    BuyerInventoryFilter,
    BuyerInventoryItem,
    BuyerInventoryResponse,
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
     * Story 4.2: Find listing by ID for buyer detail view (AC1-9)
     * 
     * SITUATION: Buyer taps produce card in inventory browse
     * TASK: Return full listing data with photos and crop details
     * ACTION: Query listing with photos relation, validate ACTIVE status
     * RESULT: Complete listing data for detail screen or null if not found/active
     * 
     * @param id - Listing ID
     * @returns Listing with crop and photos, or null if not active
     */
    async findByIdForBuyer(id: number): Promise<(Listing & {
        crop: { name: string; category: string; basePrice: any };
        photos: {
            id: number;
            photoUrl: string;
            thumbnailUrl: string | null;
            isPrimary: boolean;
            validationStatus: string;
            qualityScore: any;
        }[];
    }) | null> {
        return prisma.listing.findFirst({
            where: {
                id,
                status: ListingStatus.ACTIVE,
                deletedAt: null,
            },
            include: {
                crop: {
                    select: {
                        name: true,
                        category: true,
                        basePrice: true,
                    },
                },
                photos: {
                    select: {
                        id: true,
                        photoUrl: true,
                        thumbnailUrl: true,
                        isPrimary: true,
                        validationStatus: true,
                        qualityScore: true,
                    },
                    orderBy: { isPrimary: 'desc' },
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
     * Story 3.9 AC9: Cancel listing with reason for analytics
     * 
     * SITUATION: Farmer cancels listing with reason selection
     * TASK: Store cancellation reason and timestamp
     * ACTION: Update listing with CANCELLED status, reason, and timestamp
     * RESULT: Cancelled listing with analytics data
     * 
     * @param id - Listing ID
     * @param reason - Cancellation reason enum value
     * @returns Updated Listing with CANCELLED status and reason
     */
    async cancelWithReason(id: number, reason: CancellationReason): Promise<Listing> {
        const now = new Date();
        return prisma.listing.update({
            where: { id },
            data: {
                status: ListingStatus.CANCELLED,
                cancellationReason: reason,
                cancelledAt: now,
                deletedAt: now,
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

    // ========================================================================
    // Story 4.1: Buyer Inventory Browse (AC-4.1.1, 4.1.2, 4.1.3)
    // ========================================================================

    /**
     * Find active listings for buyer browse with filters and sorting
     * 
     * SITUATION: Buyers browse available produce inventory on mobile app
     * TASK: Query active listings with filters (crop, grade, quantity, date) and sorting
     * ACTION: Build dynamic Prisma query with cursor-based pagination
     * RESULT: Paginated inventory items for buyer display
     * 
     * @param filter - BuyerInventoryFilter with crop types, grades, quantity range, sort
     * @returns Paginated BuyerInventoryResponse
     */
    async findActiveForBuyers(filter: BuyerInventoryFilter): Promise<BuyerInventoryResponse> {
        const {
            cropTypes,
            grades,
            quantityMin,
            quantityMax,
            deliveryDate,
            sort = SortOption.FRESHNESS,
            cursor,
            limit = 20
        } = filter;

        // Build where clause
        const where: Prisma.ListingWhereInput = {
            status: ListingStatus.ACTIVE,
            deletedAt: null,
            pricePerKg: { not: null }, // Must have price
        };

        // Crop type filter (multi-select)
        if (cropTypes && cropTypes.length > 0) {
            where.crop = { name: { in: cropTypes } };
        }

        // Grade filter (A, B, C)
        if (grades && grades.length > 0) {
            where.qualityGrade = { in: grades };
        }

        // Quantity range
        if (quantityMin !== undefined || quantityMax !== undefined) {
            where.quantityKg = {};
            if (quantityMin !== undefined) {
                where.quantityKg.gte = quantityMin;
            }
            if (quantityMax !== undefined) {
                where.quantityKg.lte = quantityMax;
            }
        }

        // Delivery date filter (future implementation - requires delivery schedule)
        // For now, we filter by harvest date as proxy
        if (deliveryDate) {
            where.harvestDate = { gte: deliveryDate };
        }

        // Build order by based on sort option
        const orderBy = this.buildSortOrder(sort);

        // Execute query with inline include for proper type inference
        const listingsPromise = cursor
            ? prisma.listing.findMany({
                where,
                include: { crop: { select: { name: true, category: true } } },
                orderBy,
                take: limit + 1,
                cursor: { id: parseInt(cursor) },
                skip: 1,
            })
            : prisma.listing.findMany({
                where,
                include: { crop: { select: { name: true, category: true } } },
                orderBy,
                take: limit + 1,
            });

        const [listings, total] = await Promise.all([
            listingsPromise,
            prisma.listing.count({ where }),
        ]);

        // Check if there are more items
        const hasMore = listings.length > limit;
        const items = hasMore ? listings.slice(0, limit) : listings;

        // Map to response format
        const mappedItems: BuyerInventoryItem[] = items.map((listing) => ({
            id: listing.id,
            cropType: listing.crop.name,
            photoUrl: listing.photoUrl ?? undefined,
            quantityKg: Number(listing.quantityKg),
            grade: listing.qualityGrade ?? 'B',
            pricePerKg: Number(listing.pricePerKg ?? 0),
            deliveryDate: listing.harvestDate
                ? new Date(listing.harvestDate.getTime() + 2 * 24 * 60 * 60 * 1000) // +2 days from harvest
                : undefined,
            createdAt: listing.createdAt,
        }));

        // Next cursor is the last item's ID
        const nextCursor = hasMore && items.length > 0
            ? items[items.length - 1].id.toString()
            : undefined;

        return {
            items: mappedItems,
            total,
            nextCursor,
            hasMore,
        };
    }

    /**
     * Build Prisma orderBy clause from SortOption
     */
    private buildSortOrder(sort: SortOption): Prisma.ListingOrderByWithRelationInput[] {
        switch (sort) {
            case SortOption.PRICE_ASC:
                return [{ pricePerKg: 'asc' }, { createdAt: 'desc' }];
            case SortOption.PRICE_DESC:
                return [{ pricePerKg: 'desc' }, { createdAt: 'desc' }];
            case SortOption.QUALITY_DESC:
                return [{ qualityGrade: 'asc' }, { createdAt: 'desc' }]; // A < B < C alphabetically
            case SortOption.QUANTITY_DESC:
                return [{ quantityKg: 'desc' }, { createdAt: 'desc' }];
            case SortOption.FRESHNESS:
            default:
                return [{ createdAt: 'desc' }];
        }
    }
}

// Export singleton instance
export const listingRepository = new ListingRepository();
