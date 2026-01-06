/**
 * Listing Service - Unit Tests (Prisma 7 Pattern)
 * 
 * Tests business logic layer using jest-mock-extended for Prisma mocking.
 * 
 * The key is to mock BEFORE importing the modules that use prisma.
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../src/generated/prisma/client';

// Create mock before importing modules
const prismaMock = mockDeep<PrismaClient>();

// Mock the lib/prisma module BEFORE importing service
jest.mock('../../src/lib/prisma', () => ({
    prisma: prismaMock,
}));

// Now import the service (it will get the mocked prisma)
import {
    ListingService,
    ListingNotFoundError,
    ListingAccessDeniedError,
    InvalidCropError,
    CancellationNotAllowedError,
    QuantityExceedsOriginalError,
} from '../../src/services/listing-service';
import { ListingStatus, ListingEntryMode, CreateListingInput, CancellationReason } from '../../src/types/listing';

// ============================================================================
// Test Suite
// ============================================================================

describe('ListingService', () => {
    let service: ListingService;

    beforeEach(() => {
        mockReset(prismaMock);
        service = new ListingService();
    });

    // --------------------------------------------------------------------------
    // createListing
    // --------------------------------------------------------------------------
    describe('createListing', () => {
        const validInput: CreateListingInput = {
            farmerId: 1,
            cropId: 10,
            quantityKg: 50,
            unit: 'kg',
            entryMode: ListingEntryMode.MANUAL,
            qualityGrade: 'A',
        };

        it('should create a listing when crop exists', async () => {
            // Arrange
            const mockCrop = { id: 10, name: 'Tomato', basePrice: 30, category: 'Vegetables', unit: 'kg', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
            const mockCreatedListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                quantityKg: 50 as any,
                unit: 'kg',
                displayQty: null,
                qualityGrade: 'A',
                aiGrade: null,
                aiConfidence: null,
                photoUrl: null,
                photoThumbnail: null,
                entryMode: 'MANUAL' as any,
                voiceText: null,
                voiceLanguage: null,
                estimatedPrice: null,
                pricePerKg: null,
                status: 'DRAFT' as any,
                harvestDate: null,
                expiresAt: null,
                matchedAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };

            prismaMock.crop.findUnique.mockResolvedValue(mockCrop as any);
            prismaMock.listing.create.mockResolvedValue(mockCreatedListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockCreatedListing,
                pricePerKg: 30 as any,
                estimatedPrice: 1500 as any,
                expiresAt: new Date(),
                crop: mockCrop,
            } as any);

            // Act
            const result = await service.createListing(validInput);

            // Assert
            expect(prismaMock.crop.findUnique).toHaveBeenCalledWith({ where: { id: 10 } });
            expect(prismaMock.listing.create).toHaveBeenCalled();
            expect(result.id).toBe(1);
        });

        it('should throw InvalidCropError when crop does not exist', async () => {
            // Arrange
            prismaMock.crop.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(service.createListing(validInput)).rejects.toThrow(InvalidCropError);
        });
    });

    // --------------------------------------------------------------------------
    // getListingById
    // --------------------------------------------------------------------------
    describe('getListingById', () => {
        it('should return listing when farmer owns it', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                quantityKg: 50 as any,
                unit: 'kg',
                status: 'ACTIVE' as any,
                entryMode: 'MANUAL' as any,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                crop: { name: 'Tomato', category: 'Vegetables' },
            };

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingById(1, 1);

            // Assert
            expect(result.id).toBe(1);
            expect(result.cropName).toBe('Tomato');
        });

        it('should throw ListingNotFoundError when listing does not exist', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(service.getListingById(999, 1)).rejects.toThrow(ListingNotFoundError);
        });

        it('should throw ListingAccessDeniedError when farmer does not own listing', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 2, // Different farmer
                deletedAt: null,
                crop: { name: 'Tomato', category: 'Vegetables' },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act & Assert
            await expect(service.getListingById(1, 1)).rejects.toThrow(ListingAccessDeniedError);
        });
    });

    // --------------------------------------------------------------------------
    // cancelListing - Story 3.9 Tests
    // --------------------------------------------------------------------------
    describe('cancelListing', () => {
        const createMockListing = (overrides = {}) => ({
            id: 1,
            farmerId: 1,
            status: 'ACTIVE' as any,
            deletedAt: null,
            crop: { name: 'Tomato', category: 'Vegetables' },
            createdAt: new Date(),
            updatedAt: new Date(),
            quantityKg: 50 as any,
            unit: 'kg',
            entryMode: 'MANUAL' as any,
            ...overrides,
        });

        it('should cancel listing when in cancellable status', async () => {
            // Arrange
            const mockListing = createMockListing();

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockListing,
                status: 'CANCELLED' as any,
                deletedAt: new Date(),
            } as any);

            // Act
            const result = await service.cancelListing(1, 1);

            // Assert
            expect(prismaMock.listing.update).toHaveBeenCalled();
            expect(result.status).toBe(ListingStatus.CANCELLED);
        });

        it('Story 3.9 AC9: should store cancellation reason', async () => {
            // Arrange
            const mockListing = createMockListing();

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockListing,
                status: 'CANCELLED' as any,
                cancellationReason: 'SOLD_ELSEWHERE',
                cancelledAt: new Date(),
                deletedAt: new Date(),
            } as any);

            // Act
            const result = await service.cancelListing(1, 1, { reason: CancellationReason.SOLD_ELSEWHERE });

            // Assert
            expect(prismaMock.listing.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cancellationReason: CancellationReason.SOLD_ELSEWHERE,
                    }),
                })
            );
        });

        it('Story 3.9 AC8: should reject cancellation of IN_TRANSIT listings', async () => {
            // Arrange
            const mockListing = createMockListing({ status: 'IN_TRANSIT' });

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act & Assert
            await expect(service.cancelListing(1, 1)).rejects.toThrow(CancellationNotAllowedError);
        });

        it('Story 3.9 AC8: should reject cancellation of DELIVERED listings', async () => {
            // Arrange
            const mockListing = createMockListing({ status: 'DELIVERED' });

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act & Assert
            await expect(service.cancelListing(1, 1)).rejects.toThrow(CancellationNotAllowedError);
        });

        it('Story 3.9: should allow cancellation of MATCHED listings', async () => {
            // Arrange - per user feedback, allow until IN_TRANSIT
            const mockListing = createMockListing({ status: 'MATCHED' });

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockListing,
                status: 'CANCELLED' as any,
                deletedAt: new Date(),
            } as any);

            // Act
            const result = await service.cancelListing(1, 1);

            // Assert
            expect(result.status).toBe(ListingStatus.CANCELLED);
        });
    });

    // --------------------------------------------------------------------------
    // updateListing - Story 3.9 Tests
    // --------------------------------------------------------------------------
    describe('updateListingWithResult', () => {
        const createMockListing = (overrides = {}) => ({
            id: 1,
            farmerId: 1,
            status: 'ACTIVE' as any,
            deletedAt: null,
            crop: { name: 'Tomato', category: 'Vegetables' },
            createdAt: new Date(),
            updatedAt: new Date(),
            quantityKg: 100 as any,
            unit: 'kg',
            entryMode: 'MANUAL' as any,
            pricePerKg: 30 as any,
            estimatedPrice: 3000 as any,
            ...overrides,
        });

        it('Story 3.9 AC2: should allow update of ACTIVE listing', async () => {
            // Arrange
            const mockListing = createMockListing({ status: 'ACTIVE' });
            const updatedListing = { ...mockListing, quantityKg: 80 as any };

            // First call returns original, second call (after update) returns updated
            prismaMock.listing.findUnique
                .mockResolvedValueOnce(mockListing as any)
                .mockResolvedValueOnce(updatedListing as any);
            prismaMock.listing.update.mockResolvedValue(updatedListing as any);

            // Act
            const result = await service.updateListingWithResult(1, 1, { quantityKg: 80 });

            // Assert
            expect(result.listing.quantityKg).toBe(80);
        });

        it('Story 3.9 AC3: should reject quantity > original', async () => {
            // Arrange
            const mockListing = createMockListing({ quantityKg: 50 as any });

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act & Assert
            await expect(service.updateListingWithResult(1, 1, { quantityKg: 100 }))
                .rejects.toThrow(QuantityExceedsOriginalError);
        });

        it('Story 3.9: should return priceChanged flag when quantity changes', async () => {
            // Arrange
            const mockListing = createMockListing();

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockListing,
                quantityKg: 80 as any,
                estimatedPrice: 2400 as any,
            } as any);

            // Act
            const result = await service.updateListingWithResult(1, 1, { quantityKg: 80 });

            // Assert
            expect(result.priceChanged).toBe(true);
            expect(result.newEstimatedPrice).toBe(2400);
        });

        it('Story 3.9: should not flag priceChanged when quantity unchanged', async () => {
            // Arrange
            const mockListing = createMockListing();

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue(mockListing as any);

            // Act - only updating qualityGrade, not quantity
            const result = await service.updateListingWithResult(1, 1, { qualityGrade: 'B' });

            // Assert
            expect(result.priceChanged).toBe(false);
        });
    });

    // --------------------------------------------------------------------------
    // Story 4.2: getListingDetails - Buyer Detail View Tests
    // --------------------------------------------------------------------------
    describe('getListingDetails', () => {
        const createMockListingWithPhotos = (overrides = {}) => ({
            id: 1,
            farmerId: 1,
            cropId: 10,
            quantityKg: 50 as any,
            unit: 'kg',
            status: 'ACTIVE' as any,
            entryMode: 'MANUAL' as any,
            qualityGrade: 'A',
            aiGrade: 'A',
            aiConfidence: 0.95 as any,
            pricePerKg: 36 as any,
            estimatedPrice: 1800 as any,
            photoUrl: 'https://s3.example.com/photo1.jpg',
            harvestDate: new Date('2026-01-03'),
            deletedAt: null,
            createdAt: new Date('2026-01-03T10:00:00Z'),
            updatedAt: new Date('2026-01-03T12:00:00Z'),
            crop: {
                name: 'Tomato',
                category: 'Vegetables',
                basePrice: 30 as any,
            },
            photos: [
                {
                    id: 1,
                    photoUrl: 'https://s3.example.com/farmer-photo.jpg',
                    thumbnailUrl: 'https://s3.example.com/farmer-thumb.jpg',
                    isPrimary: true,
                    validationStatus: 'VALID',
                    qualityScore: 0.85 as any,
                },
                {
                    id: 2,
                    photoUrl: 'https://s3.example.com/agent-photo.jpg',
                    thumbnailUrl: null,
                    isPrimary: false,
                    validationStatus: 'VALID',
                    qualityScore: 0.90 as any,
                },
            ],
            ...overrides,
        });

        it('Story 4.2 AC1: should return photos with validation status', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.photos).toHaveLength(2);
            expect(result.photos[0].isPrimary).toBe(true);
            expect(result.photos[0].validationStatus).toBe('VALID');
            expect(result.primaryPhotoUrl).toBe('https://s3.example.com/farmer-photo.jpg');
        });

        it('Story 4.2 AC2: should return quality grade with AI confidence', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.qualityGrade).toBe('A');
            expect(result.aiConfidence).toBe(0.95);
        });

        it('Story 4.2 AC3: should calculate shelf life from harvest date', async () => {
            // Arrange - harvest 2 days ago, grade A (7 day shelf life)
            const mockListing = createMockListingWithPhotos({
                harvestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                qualityGrade: 'A',
            });
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.shelfLifeDays).toBe(5); // 7 - 2 = 5 days remaining
            expect(result.shelfLifeDisplay).toMatch(/\d+-\d+ days/);
        });

        it('Story 4.2 AC4: should return farmer zone (anonymized)', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert - zone should be present but not expose farmer identity
            expect(result.farmerZone).toBeDefined();
            expect(typeof result.farmerZone).toBe('string');
        });

        it('Story 4.2 AC5: should return AISP price breakdown', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.priceBreakdown).toBeDefined();
            expect(result.priceBreakdown.basePrice).toBe(30);
            expect(result.priceBreakdown.qualityAdjustment).toBeGreaterThan(0); // Grade A = +10%
            expect(result.priceBreakdown.logisticsCost).toBeGreaterThan(0);
            expect(result.priceBreakdown.platformFee).toBeGreaterThan(0);
            expect(result.priceBreakdown.finalPrice).toBeGreaterThan(result.priceBreakdown.basePrice);
        });

        it('Story 4.2 AC6: should return quantity with stock status AVAILABLE', async () => {
            // Arrange - 50kg available
            const mockListing = createMockListingWithPhotos({ quantityKg: 50 as any });
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.quantityKg).toBe(50);
            expect(result.stockStatus).toBe('AVAILABLE');
        });

        it('Story 4.2 AC6: should return LOW_STOCK when quantity < 10kg', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos({ quantityKg: 5 as any });
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.stockStatus).toBe('LOW_STOCK');
        });

        it('Story 4.2 AC7: should return delivery options (Today/Tomorrow)', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.deliveryOptions).toHaveLength(2);
            expect(result.deliveryOptions.map(d => d.label)).toContain('Today');
            expect(result.deliveryOptions.map(d => d.label)).toContain('Tomorrow');
            expect(result.deliveryOptions[1].isAvailable).toBe(true); // Tomorrow always available
        });

        it('Story 4.2 AC9: should return Digital Twin preview with verification status', async () => {
            // Arrange - has photos and AI grade = VERIFIED
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.digitalTwin).toBeDefined();
            expect(result.digitalTwin.verificationStatus).toBe('VERIFIED');
            expect(result.digitalTwin.harvestTimestamp).toBeDefined();
            expect(result.digitalTwin.aiGradingDetails).toBeDefined();
            expect(result.digitalTwin.aiGradingDetails?.grade).toBe('A');
            expect(result.digitalTwin.aiGradingDetails?.confidence).toBe(0.95);
        });

        it('Story 4.2 AC9: should return PENDING verification when photos but no AI grade', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos({ aiGrade: null });
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.digitalTwin.verificationStatus).toBe('PENDING');
        });

        it('should throw ListingNotFoundError when listing not ACTIVE', async () => {
            // Arrange - findFirst returns null for non-ACTIVE listings
            prismaMock.listing.findFirst.mockResolvedValue(null);

            // Act & Assert
            await expect(service.getListingDetails(999)).rejects.toThrow(ListingNotFoundError);
        });

        it('should return crop type and category', async () => {
            // Arrange
            const mockListing = createMockListingWithPhotos();
            prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);

            // Act
            const result = await service.getListingDetails(1);

            // Assert
            expect(result.cropType).toBe('Tomato');
            expect(result.cropCategory).toBe('Vegetables');
        });
    });
});

