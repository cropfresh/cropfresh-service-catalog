/**
 * Listing gRPC Handlers - Story 3.1
 * 
 * SITUATION: Gateway calls catalog-service via gRPC for listing operations
 * TASK: Implement gRPC service handlers that delegate to ListingService
 * ACTION: Parse gRPC requests, call service methods, format responses
 * RESULT: Type-safe internal API for listing operations
 * 
 * @module ListingGrpcHandlers
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { listingService } from '../../services/listing-service';
import { ListingEntryMode, ListingStatus } from '../../types/listing';
import type { Logger } from 'pino';

// ============================================================================
// Request/Response Types (from proto)
// ============================================================================

interface CreateListingRequest {
    farmerId: number;
    cropId: number;
    quantityKg: number;
    unit: string;
    entryMode: string;
    voiceText: string;
    voiceLanguage: string;
    qualityGrade: string;
    displayQty: number;
    harvestDate: string;
}

interface GetListingRequest {
    id: number;
    farmerId: number;
}

interface ListFarmerListingsRequest {
    farmerId: number;
    status: string;
    page: number;
    pageSize: number;
}

interface UpdateListingRequest {
    id: number;
    farmerId: number;
    quantityKg: number;
    unit: string;
    qualityGrade: string;
    photoUrl: string;
}

interface UpdateListingStatusRequest {
    id: number;
    farmerId: number;
    status: string;
    aiGrade: string;
    aiConfidence: number;
    estimatedPrice: number;
}

interface CancelListingRequest {
    id: number;
    farmerId: number;
    cancellationReason?: string; // Story 3.9: AC7-9
}

interface ListingResponse {
    id: number;
    farmerId: number;
    cropId: number;
    cropName: string;
    quantityKg: number;
    unit: string;
    qualityGrade: string;
    aiGrade: string;
    photoUrl: string;
    entryMode: string;
    status: string;
    estimatedPrice: number;
    pricePerKg: number;
    createdAt: string;
}

interface ListingsResponse {
    listings: ListingResponse[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

interface StatusResponse {
    success: boolean;
    message: string;
}

// ============================================================================
// Story 4.2: GetListingDetails RPC Types (AC1-9)
// ============================================================================

interface GetListingDetailsRequest {
    id: number;
}

interface ListingPhotoGrpc {
    id: number;
    photoUrl: string;
    thumbnailUrl: string;
    isPrimary: boolean;
    validationStatus: string;
    qualityScore: number;
}

interface PriceBreakdownGrpc {
    basePrice: number;
    qualityAdjustment: number;
    logisticsCost: number;
    platformFee: number;
    finalPrice: number;
}

interface DeliveryOptionGrpc {
    date: string;
    label: string;
    isAvailable: boolean;
}

interface DigitalTwinGrpc {
    harvestTimestamp: string;
    verificationStatus: string;
    freshnessScore: number;
    defectCount: number;
    aiGradingDetails: {
        grade: string;
        confidence: number;
        gradedAt: string;
    } | null;
}

interface GetListingDetailsResponse {
    id: number;
    cropType: string;
    cropCategory: string;
    photos: ListingPhotoGrpc[];
    primaryPhotoUrl: string;
    qualityGrade: string;
    aiConfidence: number;
    shelfLifeDays: number;
    shelfLifeDisplay: string;
    farmerZone: string;
    pricePerKg: number;
    priceBreakdown: PriceBreakdownGrpc;
    quantityKg: number;
    stockStatus: string;
    deliveryOptions: DeliveryOptionGrpc[];
    digitalTwin: DigitalTwinGrpc;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Handler Factory
// ============================================================================

export function listingGrpcHandlers(logger: Logger) {
    return {
        /**
         * CreateListing - Create a new crop listing
         */
        CreateListing: async (
            call: ServerUnaryCall<CreateListingRequest, ListingResponse>,
            callback: sendUnaryData<ListingResponse>
        ) => {
            try {
                const req = call.request;

                const listing = await listingService.createListing({
                    farmerId: req.farmerId,
                    cropId: req.cropId,
                    quantityKg: req.quantityKg,
                    unit: req.unit || 'kg',
                    displayQty: req.displayQty || undefined,
                    entryMode: (req.entryMode as ListingEntryMode) || ListingEntryMode.MANUAL,
                    voiceText: req.voiceText || undefined,
                    voiceLanguage: req.voiceLanguage || undefined,
                    qualityGrade: req.qualityGrade || undefined,
                    harvestDate: req.harvestDate ? new Date(req.harvestDate) : undefined,
                });

                callback(null, toGrpcListing(listing));
            } catch (error) {
                logger.error({ error }, 'CreateListing failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * GetListing - Get listing by ID with ownership check
         */
        GetListing: async (
            call: ServerUnaryCall<GetListingRequest, ListingResponse>,
            callback: sendUnaryData<ListingResponse>
        ) => {
            try {
                const { id, farmerId } = call.request;

                const listing = await listingService.getListingById(id, farmerId);
                callback(null, toGrpcListing(listing));
            } catch (error) {
                logger.error({ error }, 'GetListing failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * Story 4.2: GetListingDetails - Get detailed listing for buyer view (AC1-9)
         * 
         * SITUATION: Buyer taps produce card in inventory browse screen
         * TASK: Return comprehensive listing data for detail screen
         * ACTION: Call listingService.getListingDetails, transform to gRPC response
         * RESULT: Complete data for all AC1-9 requirements (public access)
         */
        GetListingDetails: async (
            call: ServerUnaryCall<GetListingDetailsRequest, GetListingDetailsResponse>,
            callback: sendUnaryData<GetListingDetailsResponse>
        ) => {
            try {
                const { id } = call.request;

                const details = await listingService.getListingDetails(id);
                callback(null, toGrpcListingDetails(details));
            } catch (error) {
                logger.error({ error }, 'GetListingDetails failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * ListFarmerListings - Get paginated listings for a farmer
         */
        ListFarmerListings: async (
            call: ServerUnaryCall<ListFarmerListingsRequest, ListingsResponse>,
            callback: sendUnaryData<ListingsResponse>
        ) => {
            try {
                const { farmerId, status, page, pageSize } = call.request;

                const result = await listingService.getListingsByFarmer({
                    farmerId,
                    status: status ? (status as ListingStatus) : undefined,
                    page: page || 1,
                    pageSize: pageSize || 20,
                });

                callback(null, {
                    listings: result.listings.map(toGrpcListing),
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    hasMore: result.hasMore,
                });
            } catch (error) {
                logger.error({ error }, 'ListFarmerListings failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * UpdateListing - Update listing details
         */
        UpdateListing: async (
            call: ServerUnaryCall<UpdateListingRequest, ListingResponse>,
            callback: sendUnaryData<ListingResponse>
        ) => {
            try {
                const { id, farmerId, ...input } = call.request;

                const listing = await listingService.updateListing(id, farmerId, {
                    quantityKg: input.quantityKg || undefined,
                    unit: input.unit || undefined,
                    qualityGrade: input.qualityGrade || undefined,
                    photoUrl: input.photoUrl || undefined,
                });

                callback(null, toGrpcListing(listing));
            } catch (error) {
                logger.error({ error }, 'UpdateListing failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * UpdateListingStatus - Transition listing to new status
         */
        UpdateListingStatus: async (
            call: ServerUnaryCall<UpdateListingStatusRequest, ListingResponse>,
            callback: sendUnaryData<ListingResponse>
        ) => {
            try {
                const { id, farmerId, status, aiGrade, aiConfidence, estimatedPrice } = call.request;

                const listing = await listingService.updateStatus(
                    id,
                    farmerId,
                    status as ListingStatus,
                    { aiGrade, aiConfidence, estimatedPrice }
                );

                callback(null, toGrpcListing(listing));
            } catch (error) {
                logger.error({ error }, 'UpdateListingStatus failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * CancelListing - Cancel/soft-delete a listing
         * Story 3.9: Now accepts cancellation reason for analytics
         */
        CancelListing: async (
            call: ServerUnaryCall<CancelListingRequest, StatusResponse>,
            callback: sendUnaryData<StatusResponse>
        ) => {
            try {
                const { id, farmerId, cancellationReason } = call.request;

                // Story 3.9: Pass reason to service if provided
                const input = cancellationReason
                    ? { reason: cancellationReason as any }
                    : undefined;

                await listingService.cancelListing(id, farmerId, input);

                callback(null, { success: true, message: 'Listing cancelled successfully' });
            } catch (error) {
                logger.error({ error }, 'CancelListing failed');
                callback(toGrpcError(error), null);
            }
        },
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function toGrpcListing(listing: any): ListingResponse {
    return {
        id: listing.id,
        farmerId: listing.farmerId,
        cropId: listing.cropId,
        cropName: listing.cropName || '',
        quantityKg: listing.quantityKg,
        unit: listing.unit,
        qualityGrade: listing.qualityGrade || '',
        aiGrade: listing.aiGrade || '',
        photoUrl: listing.photoUrl || '',
        entryMode: listing.entryMode,
        status: listing.status,
        estimatedPrice: listing.estimatedPrice || 0,
        pricePerKg: listing.pricePerKg || 0,
        createdAt: listing.createdAt.toISOString(),
    };
}

/**
 * Story 4.2: Transform ListingDetailsDto to gRPC response format
 */
function toGrpcListingDetails(details: any): GetListingDetailsResponse {
    return {
        id: details.id,
        cropType: details.cropType,
        cropCategory: details.cropCategory,
        photos: details.photos.map((p: any) => ({
            id: p.id,
            photoUrl: p.photoUrl,
            thumbnailUrl: p.thumbnailUrl || '',
            isPrimary: p.isPrimary,
            validationStatus: p.validationStatus,
            qualityScore: p.qualityScore || 0,
        })),
        primaryPhotoUrl: details.primaryPhotoUrl || '',
        qualityGrade: details.qualityGrade,
        aiConfidence: details.aiConfidence,
        shelfLifeDays: details.shelfLifeDays,
        shelfLifeDisplay: details.shelfLifeDisplay,
        farmerZone: details.farmerZone,
        pricePerKg: details.pricePerKg,
        priceBreakdown: details.priceBreakdown,
        quantityKg: details.quantityKg,
        stockStatus: details.stockStatus,
        deliveryOptions: details.deliveryOptions.map((d: any) => ({
            date: d.date.toISOString(),
            label: d.label,
            isAvailable: d.isAvailable,
        })),
        digitalTwin: {
            harvestTimestamp: details.digitalTwin.harvestTimestamp?.toISOString() || '',
            verificationStatus: details.digitalTwin.verificationStatus,
            freshnessScore: details.digitalTwin.freshnessScore || 0,
            defectCount: details.digitalTwin.defectCount || 0,
            aiGradingDetails: details.digitalTwin.aiGradingDetails ? {
                grade: details.digitalTwin.aiGradingDetails.grade,
                confidence: details.digitalTwin.aiGradingDetails.confidence,
                gradedAt: details.digitalTwin.aiGradingDetails.gradedAt?.toISOString() || '',
            } : null,
        },
        createdAt: details.createdAt.toISOString(),
        updatedAt: details.updatedAt.toISOString(),
    };
}

function toGrpcError(error: any): any {
    // Map custom errors to gRPC status codes
    const grpc = require('@grpc/grpc-js');

    if (error.name === 'ListingNotFoundError') {
        return { code: grpc.status.NOT_FOUND, message: error.message };
    }
    if (error.name === 'ListingAccessDeniedError') {
        return { code: grpc.status.PERMISSION_DENIED, message: error.message };
    }
    if (error.name === 'InvalidCropError') {
        return { code: grpc.status.INVALID_ARGUMENT, message: error.message };
    }
    if (error.name === 'InvalidStatusTransitionError') {
        return { code: grpc.status.FAILED_PRECONDITION, message: error.message };
    }
    // Story 3.9: New error types
    if (error.name === 'CancellationNotAllowedError') {
        return { code: grpc.status.FAILED_PRECONDITION, message: error.message };
    }
    if (error.name === 'QuantityExceedsOriginalError') {
        return { code: grpc.status.INVALID_ARGUMENT, message: error.message };
    }

    return { code: grpc.status.INTERNAL, message: 'Internal server error' };
}
