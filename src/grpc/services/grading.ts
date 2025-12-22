/**
 * Grading gRPC Handlers - Story 3.3
 * 
 * SITUATION: Gateway calls catalog-service for AI grading and DPLE pricing
 * TASK: Implement gRPC service handlers for grading operations
 * ACTION: Parse gRPC requests, call GradingService methods, format responses
 * RESULT: Type-safe internal API for AI grading and pricing operations
 * 
 * @module GradingGrpcHandlers
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { gradingService, GradingError, ListingNotGradableError } from '../../services/grading-service';
import { QualityGrade } from '../../types/grading';
import type { Logger } from 'pino';

// ============================================================================
// Request/Response Types (from proto)
// ============================================================================

interface GradeListingRequest {
    listingId: number;
    farmerId: number;
    forceRegrade: boolean;
}

interface QualityIndicatorProto {
    type: string;
    score: number;
    label: string;
}

interface GradingResultProto {
    grade: string;
    confidence: number;
    indicators: QualityIndicatorProto[];
    explanation: string;
}

interface PriceBreakdownProto {
    marketRatePerKg: number;
    gradeAdjustment: string;
    gradeMultiplier: number;
    finalPricePerKg: number;
    totalEarnings: number;
    quantityKg: number;
    currency: string;
    paymentTerms: string;
}

interface GradeListingResponse {
    grading: GradingResultProto;
    pricing: PriceBreakdownProto;
}

interface ConfirmListingRequest {
    listingId: number;
    farmerId: number;
    grading: GradingResultProto;
    pricing: PriceBreakdownProto;
}

interface RejectListingRequest {
    listingId: number;
    farmerId: number;
    reason: string; // RETAKE_PHOTO, CANCEL, LIST_ANYWAY
}

interface StatusResponse {
    success: boolean;
    message: string;
    nextStep?: string;
}

// ============================================================================
// Handler Factory
// ============================================================================

export function gradingGrpcHandlers(logger: Logger) {
    return {
        /**
         * GradeAndPrice - Get AI grading results and DPLE price for a listing
         * 
         * Calls AI service for quality grading, then calculates DPLE price.
         */
        GradeAndPrice: async (
            call: ServerUnaryCall<GradeListingRequest, GradeListingResponse>,
            callback: sendUnaryData<GradeListingResponse>
        ) => {
            try {
                const { listingId, farmerId } = call.request;
                logger.info({ listingId, farmerId }, 'GradeAndPrice called');

                const result = await gradingService.gradeAndPrice(listingId, farmerId);

                const response: GradeListingResponse = {
                    grading: {
                        grade: result.grading.grade,
                        confidence: result.grading.confidence,
                        indicators: result.grading.indicators.map(ind => ({
                            type: ind.type,
                            score: ind.score,
                            label: ind.label,
                        })),
                        explanation: result.grading.explanation,
                    },
                    pricing: {
                        marketRatePerKg: result.pricing.marketRatePerKg,
                        gradeAdjustment: result.pricing.gradeAdjustment,
                        gradeMultiplier: result.pricing.gradeMultiplier,
                        finalPricePerKg: result.pricing.finalPricePerKg,
                        totalEarnings: result.pricing.totalEarnings,
                        quantityKg: result.pricing.quantityKg,
                        currency: result.pricing.currency,
                        paymentTerms: result.pricing.paymentTerms,
                    },
                };

                callback(null, response);
            } catch (error) {
                logger.error({ error }, 'GradeAndPrice failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * ConfirmListing - Farmer accepts the grading result and price
         * 
         * Transitions listing from PENDING_GRADING to ACTIVE status.
         */
        ConfirmListing: async (
            call: ServerUnaryCall<ConfirmListingRequest, StatusResponse>,
            callback: sendUnaryData<StatusResponse>
        ) => {
            try {
                const { listingId, farmerId, grading, pricing } = call.request;
                logger.info({ listingId, farmerId }, 'ConfirmListing called');

                await gradingService.confirmListing(
                    listingId,
                    farmerId,
                    {
                        grade: grading.grade as QualityGrade,
                        confidence: grading.confidence,
                        indicators: grading.indicators.map(ind => ({
                            type: ind.type as any,
                            score: ind.score,
                            label: ind.label,
                        })),
                        explanation: grading.explanation,
                    },
                    {
                        marketRatePerKg: pricing.marketRatePerKg,
                        gradeAdjustment: pricing.gradeAdjustment,
                        gradeMultiplier: pricing.gradeMultiplier,
                        finalPricePerKg: pricing.finalPricePerKg,
                        totalEarnings: pricing.totalEarnings,
                        quantityKg: pricing.quantityKg,
                        currency: pricing.currency,
                        paymentTerms: pricing.paymentTerms,
                    }
                );

                callback(null, {
                    success: true,
                    message: 'Listing confirmed and activated',
                    nextStep: 'drop_point',
                });
            } catch (error) {
                logger.error({ error }, 'ConfirmListing failed');
                callback(toGrpcError(error), null);
            }
        },

        /**
         * RejectListing - Farmer rejects the grading (retake, cancel, list anyway)
         */
        RejectListing: async (
            call: ServerUnaryCall<RejectListingRequest, StatusResponse>,
            callback: sendUnaryData<StatusResponse>
        ) => {
            try {
                const { listingId, farmerId, reason } = call.request;
                logger.info({ listingId, farmerId, reason }, 'RejectListing called');

                const result = await gradingService.rejectListing(
                    listingId,
                    farmerId,
                    reason as 'RETAKE_PHOTO' | 'CANCEL' | 'LIST_ANYWAY'
                );

                callback(null, {
                    success: true,
                    message: `Listing ${result.status.toLowerCase()}`,
                    nextStep: result.nextStep,
                });
            } catch (error) {
                logger.error({ error }, 'RejectListing failed');
                callback(toGrpcError(error), null);
            }
        },
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function toGrpcError(error: any): any {
    const grpc = require('@grpc/grpc-js');

    if (error instanceof GradingError || error?.name === 'GradingError') {
        return { code: grpc.status.INVALID_ARGUMENT, message: error.message };
    }
    if (error instanceof ListingNotGradableError || error?.name === 'ListingNotGradableError') {
        return { code: grpc.status.FAILED_PRECONDITION, message: error.message };
    }
    if (error?.name === 'ListingNotFoundError') {
        return { code: grpc.status.NOT_FOUND, message: error.message };
    }
    if (error?.name === 'ListingAccessDeniedError') {
        return { code: grpc.status.PERMISSION_DENIED, message: error.message };
    }

    return { code: grpc.status.INTERNAL, message: 'Internal server error' };
}
