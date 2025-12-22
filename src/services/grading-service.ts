/**
 * Grading Service - AI Grading & DPLE Pricing Business Logic
 * 
 * SITUATION: Farmers need AI quality assessment and fair pricing for produce
 * TASK: Calculate quality grade and DPLE (Dynamic Price Liquidity Engine) price
 * ACTION: Call AI service for grading, compute price with grade multipliers
 * RESULT: Farmers see transparent pricing based on quality grade
 * 
 * @module GradingService
 */

import { listingRepository } from '../repositories/listing-repository';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import {
    QualityGrade,
    QualityIndicator,
    QualityIndicatorType,
    GradingResult,
    PriceBreakdown,
    CalculatePriceInput,
    GradingAndPriceResult,
} from '../types/grading';
import { ListingStatus } from '../types/listing';

// ============================================================================
// Constants
// ============================================================================

/** Grade multipliers for DPLE pricing */
const GRADE_MULTIPLIERS: Record<QualityGrade, number> = {
    [QualityGrade.A]: 1.20, // +20%
    [QualityGrade.B]: 1.00, // Baseline
    [QualityGrade.C]: 0.85, // -15%
};

/** Grade adjustment labels */
const GRADE_ADJUSTMENTS: Record<QualityGrade, string> = {
    [QualityGrade.A]: '+20%',
    [QualityGrade.B]: 'Baseline',
    [QualityGrade.C]: '-15%',
};

/** Grade explanations */
const GRADE_EXPLANATIONS: Record<QualityGrade, string> = {
    [QualityGrade.A]: 'Excellent color, uniform size, no defects',
    [QualityGrade.B]: 'Good quality, minor size variation',
    [QualityGrade.C]: 'Fair quality, some blemishes detected',
};

// ============================================================================
// Custom Errors
// ============================================================================

export class GradingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GradingError';
    }
}

export class ListingNotGradableError extends Error {
    constructor(listingId: number, status: string) {
        super(`Listing ${listingId} cannot be graded in status ${status}`);
        this.name = 'ListingNotGradableError';
    }
}

// ============================================================================
// Service Class
// ============================================================================

export class GradingService {
    /**
     * Grade a listing's produce photo and calculate price
     * 
     * Calls AI service for image analysis, then computes DPLE price.
     * In Phase 1, uses mock grading; Phase 2 will call actual AI service.
     */
    async gradeAndPrice(
        listingId: number,
        farmerId: number
    ): Promise<GradingAndPriceResult> {
        // 1. Fetch listing with crop data
        const listing = await listingRepository.findById(listingId);
        if (!listing) {
            throw new GradingError(`Listing ${listingId} not found`);
        }

        if (listing.farmerId !== farmerId) {
            throw new GradingError('Access denied to this listing');
        }

        // 2. Validate listing has photo and is in correct status
        if (!listing.photoUrl) {
            throw new GradingError('Listing has no photo to grade');
        }

        const gradableStatuses = [
            ListingStatus.PENDING_PHOTO,
            ListingStatus.PENDING_GRADING,
            ListingStatus.DRAFT,
        ];
        if (!gradableStatuses.includes(listing.status as ListingStatus)) {
            throw new ListingNotGradableError(listingId, listing.status);
        }

        // 3. Call AI grading (mock for now, real AI in Phase 2)
        const gradingResult = await this.callAIGrading(
            listing.photoUrl,
            listing.crop?.name ?? 'produce'
        );

        // 4. Calculate DPLE price
        const priceBreakdown = await this.calculateDPLEPrice({
            listingId,
            cropType: listing.crop?.name ?? 'produce',
            quantityKg: Number(listing.quantityKg),
            grade: gradingResult.grade,
            region: listing.crop?.category, // Use category as region proxy
        });

        // 5. Update listing status to PENDING_GRADING if was PENDING_PHOTO
        if (listing.status === ListingStatus.PENDING_PHOTO) {
            await listingRepository.updateStatus(listingId, {
                status: ListingStatus.PENDING_GRADING,
            });
        }

        logger.info(
            { listingId, grade: gradingResult.grade, price: priceBreakdown.finalPricePerKg },
            'Listing graded and priced'
        );

        return { grading: gradingResult, pricing: priceBreakdown };
    }

    /**
     * Call AI service for image quality grading
     * 
     * TODO: Replace with actual gRPC call to AI service in Phase 2
     */
    private async callAIGrading(
        photoUrl: string,
        produceType: string
    ): Promise<GradingResult> {
        // Mock AI response - Phase 2 will call actual AI service
        // Simulate ~2 second processing time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Return Grade A for demo
        const grade = QualityGrade.A;
        const confidence = 0.95;

        const indicators: QualityIndicator[] = [
            {
                type: QualityIndicatorType.FRESHNESS,
                score: 0.92,
                label: 'Excellent',
            },
            {
                type: QualityIndicatorType.COLOR_VIBRANCY,
                score: 0.94,
                label: 'Vibrant',
            },
            {
                type: QualityIndicatorType.SIZE_CONSISTENCY,
                score: 0.88,
                label: 'Uniform',
            },
            {
                type: QualityIndicatorType.SURFACE_QUALITY,
                score: 0.95,
                label: 'No defects',
            },
        ];

        logger.debug({ photoUrl, produceType, grade }, 'AI grading complete (mock)');

        return {
            grade,
            confidence,
            indicators,
            explanation: GRADE_EXPLANATIONS[grade],
        };
    }

    /**
     * Calculate DPLE (Dynamic Price Liquidity Engine) price
     * 
     * Uses market rate, grade adjustment, and demand signals.
     */
    async calculateDPLEPrice(input: CalculatePriceInput): Promise<PriceBreakdown> {
        // 1. Get base market rate from crop data
        const listing = await listingRepository.findById(input.listingId);
        const baseRate = listing?.pricePerKg
            ? Number(listing.pricePerKg)
            : await this.getMarketRate(input.cropType, input.region);

        // 2. Apply grade multiplier
        const multiplier = GRADE_MULTIPLIERS[input.grade];
        const gradeAdjustment = GRADE_ADJUSTMENTS[input.grade];

        // 3. Calculate final price (in real system, would also factor demand)
        const demandFactor = 1.0; // TODO: Fetch from demand signals
        const finalPricePerKg = baseRate * multiplier * demandFactor;
        const totalEarnings = finalPricePerKg * input.quantityKg;

        logger.debug(
            { listingId: input.listingId, baseRate, multiplier, finalPricePerKg },
            'DPLE price calculated'
        );

        return {
            marketRatePerKg: baseRate,
            gradeAdjustment,
            gradeMultiplier: multiplier,
            finalPricePerKg: Math.round(finalPricePerKg * 100) / 100,
            totalEarnings: Math.round(totalEarnings * 100) / 100,
            quantityKg: input.quantityKg,
            currency: 'INR',
            paymentTerms: 'T+0 on delivery',
        };
    }

    /**
     * Get market rate for a crop type
     * 
     * In production, this would call mandi API or cached rates.
     */
    private async getMarketRate(cropType: string, region?: string): Promise<number> {
        // Mock market rates (Phase 2: integrate with mandi API)
        const rates: Record<string, number> = {
            'tomato': 30,
            'potato': 25,
            'onion': 35,
            'carrot': 40,
            'cabbage': 20,
            'cauliflower': 45,
            'mango': 60,
            'banana': 35,
        };

        const normalizedType = cropType.toLowerCase();
        return rates[normalizedType] ?? 30; // Default to ₹30/kg
    }

    /**
     * Confirm a listing after farmer accepts the price
     * 
     * Transitions from PENDING_GRADING to ACTIVE status.
     */
    async confirmListing(
        listingId: number,
        farmerId: number,
        gradingResult: GradingResult,
        priceBreakdown: PriceBreakdown
    ): Promise<void> {
        const listing = await listingRepository.findById(listingId);

        if (!listing) {
            throw new GradingError(`Listing ${listingId} not found`);
        }

        if (listing.farmerId !== farmerId) {
            throw new GradingError('Access denied to this listing');
        }

        // Validate status transition
        if (listing.status !== ListingStatus.PENDING_GRADING) {
            throw new GradingError(
                `Listing cannot be confirmed in status ${listing.status}`
            );
        }

        // Update listing with grading data and activate
        await prisma.listing.update({
            where: { id: listingId },
            data: {
                status: ListingStatus.ACTIVE,
                aiGrade: gradingResult.grade,
                aiConfidence: gradingResult.confidence,
                pricePerKg: priceBreakdown.finalPricePerKg,
                estimatedPrice: priceBreakdown.totalEarnings,
            },
        });

        logger.info(
            { listingId, grade: gradingResult.grade, status: 'ACTIVE' },
            'Listing confirmed and activated'
        );
    }

    /**
     * Reject a listing with reason
     * 
     * Handles: retake photo, cancel, or list anyway.
     */
    async rejectListing(
        listingId: number,
        farmerId: number,
        reason: 'RETAKE_PHOTO' | 'CANCEL' | 'LIST_ANYWAY'
    ): Promise<{ status: string; nextStep: string }> {
        const listing = await listingRepository.findById(listingId);

        if (!listing) {
            throw new GradingError(`Listing ${listingId} not found`);
        }

        if (listing.farmerId !== farmerId) {
            throw new GradingError('Access denied to this listing');
        }

        switch (reason) {
            case 'RETAKE_PHOTO':
                // Reset to PENDING_PHOTO for retake
                await listingRepository.updateStatus(listingId, {
                    status: ListingStatus.PENDING_PHOTO,
                });
                logger.info({ listingId }, 'Listing reset for photo retake');
                return { status: 'DRAFT', nextStep: 'photo_capture' };

            case 'CANCEL':
                // Cancel the listing
                await listingRepository.cancel(listingId);
                logger.info({ listingId }, 'Listing cancelled by farmer');
                return { status: 'CANCELLED', nextStep: 'home' };

            case 'LIST_ANYWAY':
                // Activate with current grade
                await listingRepository.updateStatus(listingId, {
                    status: ListingStatus.ACTIVE,
                });
                logger.info({ listingId }, 'Listing activated despite rejection');
                return { status: 'ACTIVE', nextStep: 'drop_point' };

            default:
                throw new GradingError(`Invalid rejection reason: ${reason}`);
        }
    }
}

// Export singleton instance
export const gradingService = new GradingService();
