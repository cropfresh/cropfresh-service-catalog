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
import { ListingService, ListingNotFoundError, ListingAccessDeniedError, InvalidCropError } from '../../src/services/listing-service';
import { ListingStatus, ListingEntryMode, CreateListingInput } from '../../src/types/listing';

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
    // cancelListing
    // --------------------------------------------------------------------------
    describe('cancelListing', () => {
        it('should cancel listing when in cancellable status', async () => {
            // Arrange
            const mockListing = {
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
            };

            // Mock for findById call
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Mock for cancel call
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
    });
});
