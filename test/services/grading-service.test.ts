/**
 * Grading Service - Unit Tests (Story 3.3)
 * 
 * Tests DPLE pricing algorithm and grading business logic.
 * Uses jest-mock-extended for Prisma mocking.
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../src/generated/prisma/client';

// Create mock before importing modules
const prismaMock = mockDeep<PrismaClient>();

// Mock the lib/prisma module BEFORE importing service
jest.mock('../../src/lib/prisma', () => ({
    prisma: prismaMock,
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis(),
    },
}));

// Now import the service (it will get the mocked prisma)
import {
    GradingService,
    GradingError,
    ListingNotGradableError
} from '../../src/services/grading-service';
import { QualityGrade } from '../../src/types/grading';
import { ListingStatus } from '../../src/types/listing';

// ============================================================================
// Test Suite
// ============================================================================

describe('GradingService', () => {
    let service: GradingService;

    beforeEach(() => {
        mockReset(prismaMock);
        service = new GradingService();
    });

    // --------------------------------------------------------------------------
    // gradeAndPrice
    // --------------------------------------------------------------------------
    describe('gradeAndPrice', () => {
        const mockListing = {
            id: 1,
            farmerId: 1,
            cropId: 10,
            quantityKg: 50 as any,
            unit: 'kg',
            status: 'PENDING_PHOTO',
            photoUrl: 'https://s3.example.com/photo.jpg',
            pricePerKg: 30 as any,
            crop: { name: 'Tomato', category: 'Vegetables' },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
        };

        it('should return grading result with Grade A and price breakdown', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'PENDING_GRADING' } as any);

            // Act
            const result = await service.gradeAndPrice(1, 1);

            // Assert
            expect(result.grading.grade).toBe(QualityGrade.A);
            expect(result.grading.confidence).toBeGreaterThan(0.9);
            expect(result.grading.indicators).toHaveLength(4);
            expect(result.pricing.gradeAdjustment).toBe('+20%');
            expect(result.pricing.gradeMultiplier).toBe(1.2);
        });

        it('should calculate correct DPLE price with +20% for Grade A', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'PENDING_GRADING' } as any);

            // Act
            const result = await service.gradeAndPrice(1, 1);

            // Assert - base rate 30, +20% = 36
            expect(result.pricing.finalPricePerKg).toBe(36);
            expect(result.pricing.totalEarnings).toBe(1800); // 36 * 50kg
            expect(result.pricing.currency).toBe('INR');
            expect(result.pricing.paymentTerms).toBe('T+0 on delivery');
        });

        it('should throw GradingError when listing not found', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(service.gradeAndPrice(999, 1)).rejects.toThrow(GradingError);
        });

        it('should throw GradingError when farmer does not own listing', async () => {
            // Arrange
            const otherFarmerListing = { ...mockListing, farmerId: 999 };
            prismaMock.listing.findUnique.mockResolvedValue(otherFarmerListing as any);

            // Act & Assert
            await expect(service.gradeAndPrice(1, 1)).rejects.toThrow(GradingError);
        });

        it('should throw GradingError when listing has no photo', async () => {
            // Arrange
            const noPhotoListing = { ...mockListing, photoUrl: null };
            prismaMock.listing.findUnique.mockResolvedValue(noPhotoListing as any);

            // Act & Assert
            await expect(service.gradeAndPrice(1, 1)).rejects.toThrow('no photo');
        });

        it('should throw ListingNotGradableError when listing in ACTIVE status', async () => {
            // Arrange
            const activeListing = { ...mockListing, status: 'ACTIVE' };
            prismaMock.listing.findUnique.mockResolvedValue(activeListing as any);

            // Act & Assert
            await expect(service.gradeAndPrice(1, 1)).rejects.toThrow(ListingNotGradableError);
        });
    });

    // --------------------------------------------------------------------------
    // calculateDPLEPrice
    // --------------------------------------------------------------------------
    describe('calculateDPLEPrice', () => {
        it('should apply +20% multiplier for Grade A', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue({ pricePerKg: 100 } as any);

            // Act
            const result = await service.calculateDPLEPrice({
                listingId: 1,
                cropType: 'tomato',
                quantityKg: 10,
                grade: QualityGrade.A,
            });

            // Assert
            expect(result.gradeAdjustment).toBe('+20%');
            expect(result.gradeMultiplier).toBe(1.2);
            expect(result.finalPricePerKg).toBe(120);
            expect(result.totalEarnings).toBe(1200);
        });

        it('should apply baseline (no adjustment) for Grade B', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue({ pricePerKg: 100 } as any);

            // Act
            const result = await service.calculateDPLEPrice({
                listingId: 1,
                cropType: 'tomato',
                quantityKg: 10,
                grade: QualityGrade.B,
            });

            // Assert
            expect(result.gradeAdjustment).toBe('Baseline');
            expect(result.gradeMultiplier).toBe(1.0);
            expect(result.finalPricePerKg).toBe(100);
        });

        it('should apply -15% multiplier for Grade C', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue({ pricePerKg: 100 } as any);

            // Act
            const result = await service.calculateDPLEPrice({
                listingId: 1,
                cropType: 'tomato',
                quantityKg: 10,
                grade: QualityGrade.C,
            });

            // Assert
            expect(result.gradeAdjustment).toBe('-15%');
            expect(result.gradeMultiplier).toBe(0.85);
            expect(result.finalPricePerKg).toBe(85);
            expect(result.totalEarnings).toBe(850);
        });

        it('should use default market rate when listing has no pricePerKg', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue({ pricePerKg: null } as any);

            // Act
            const result = await service.calculateDPLEPrice({
                listingId: 1,
                cropType: 'tomato',
                quantityKg: 10,
                grade: QualityGrade.A,
            });

            // Assert - tomato default is 30, +20% = 36
            expect(result.marketRatePerKg).toBe(30);
            expect(result.finalPricePerKg).toBe(36);
        });
    });

    // --------------------------------------------------------------------------
    // confirmListing
    // --------------------------------------------------------------------------
    describe('confirmListing', () => {
        const mockListing = {
            id: 1,
            farmerId: 1,
            status: 'PENDING_GRADING',
            crop: { name: 'Tomato', category: 'Vegetables' },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const gradingResult = {
            grade: QualityGrade.A,
            confidence: 0.95,
            indicators: [],
            explanation: 'Excellent quality',
        };

        const priceBreakdown = {
            marketRatePerKg: 30,
            gradeAdjustment: '+20%',
            gradeMultiplier: 1.2,
            finalPricePerKg: 36,
            totalEarnings: 1800,
            quantityKg: 50,
            currency: 'INR',
            paymentTerms: 'T+0 on delivery',
        };

        it('should activate listing and persist grading data', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'ACTIVE' } as any);

            // Act
            await service.confirmListing(1, 1, gradingResult, priceBreakdown);

            // Assert
            expect(prismaMock.listing.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: ListingStatus.ACTIVE,
                    aiGrade: 'A',
                    aiConfidence: 0.95,
                    pricePerKg: 36,
                    estimatedPrice: 1800,
                }),
            });
        });

        it('should throw GradingError when listing not in PENDING_GRADING', async () => {
            // Arrange
            const draftListing = { ...mockListing, status: 'DRAFT' };
            prismaMock.listing.findUnique.mockResolvedValue(draftListing as any);

            // Act & Assert
            await expect(service.confirmListing(1, 1, gradingResult, priceBreakdown))
                .rejects.toThrow('cannot be confirmed');
        });
    });

    // --------------------------------------------------------------------------
    // rejectListing
    // --------------------------------------------------------------------------
    describe('rejectListing', () => {
        const mockListing = {
            id: 1,
            farmerId: 1,
            status: 'PENDING_GRADING',
            crop: { name: 'Tomato', category: 'Vegetables' },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should reset to PENDING_PHOTO for retake', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'PENDING_PHOTO' } as any);

            // Act
            const result = await service.rejectListing(1, 1, 'RETAKE_PHOTO');

            // Assert
            expect(result.status).toBe('DRAFT');
            expect(result.nextStep).toBe('photo_capture');
        });

        it('should cancel listing for CANCEL reason', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'CANCELLED' } as any);

            // Act
            const result = await service.rejectListing(1, 1, 'CANCEL');

            // Assert
            expect(result.status).toBe('CANCELLED');
            expect(result.nextStep).toBe('home');
        });

        it('should activate listing for LIST_ANYWAY reason', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({ ...mockListing, status: 'ACTIVE' } as any);

            // Act
            const result = await service.rejectListing(1, 1, 'LIST_ANYWAY');

            // Assert
            expect(result.status).toBe('ACTIVE');
            expect(result.nextStep).toBe('drop_point');
        });
    });
});
