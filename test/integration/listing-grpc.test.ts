/**
 * Listing gRPC Integration Tests (Prisma 7 Pattern)
 * 
 * Tests gRPC handlers with mocked Prisma client.
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../src/generated/prisma/client';

// Create mock before importing modules
const prismaMock = mockDeep<PrismaClient>();

// Mock the lib/prisma module BEFORE importing handlers
jest.mock('../../src/lib/prisma', () => ({
    prisma: prismaMock,
}));

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
};

// Now import the handlers
import { listingGrpcHandlers } from '../../src/grpc/services/listing';
import { ListingStatus, ListingEntryMode } from '../../src/types/listing';

// ============================================================================
// Test Suite
// ============================================================================

describe('Listing gRPC Integration Tests', () => {
    let handlers: ReturnType<typeof listingGrpcHandlers>;

    beforeEach(() => {
        mockReset(prismaMock);
        jest.clearAllMocks();
        handlers = listingGrpcHandlers(mockLogger as any);
    });

    // --------------------------------------------------------------------------
    // CreateListing
    // --------------------------------------------------------------------------
    describe('CreateListing', () => {
        it('should create listing and return response', async () => {
            // Arrange
            const mockCrop = { id: 10, name: 'Tomato', basePrice: 30, category: 'Vegetables', unit: 'kg', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
            const mockCreatedListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                quantityKg: 50 as any,
                unit: 'kg',
                status: 'DRAFT' as any,
                entryMode: 'VOICE' as any,
                createdAt: new Date(),
                updatedAt: new Date(),
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

            const mockCall = {
                request: {
                    farmerId: 1,
                    cropId: 10,
                    quantityKg: 50,
                    unit: 'kg',
                    entryMode: 'VOICE',
                    voiceText: 'Tomato fifty kilo',
                    voiceLanguage: 'kn',
                    qualityGrade: 'A',
                    displayQty: 0,
                    harvestDate: '',
                },
            };

            const mockCallback = jest.fn();

            // Act
            await handlers.CreateListing(mockCall as any, mockCallback);

            // Assert
            expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
                id: 1,
                farmerId: 1,
                cropId: 10,
                cropName: 'Tomato',
            }));
        });

        it('should return error when crop not found', async () => {
            // Arrange
            prismaMock.crop.findUnique.mockResolvedValue(null);

            const mockCall = {
                request: {
                    farmerId: 1,
                    cropId: 999, // Non-existent
                    quantityKg: 50,
                    unit: 'kg',
                    entryMode: 'MANUAL',
                    voiceText: '',
                    voiceLanguage: '',
                    qualityGrade: '',
                    displayQty: 0,
                    harvestDate: '',
                },
            };

            const mockCallback = jest.fn();

            // Act
            await handlers.CreateListing(mockCall as any, mockCallback);

            // Assert
            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({ code: 3 }), // INVALID_ARGUMENT
                null
            );
        });
    });

    // --------------------------------------------------------------------------
    // GetListing
    // --------------------------------------------------------------------------
    describe('GetListing', () => {
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

            const mockCall = {
                request: { id: 1, farmerId: 1 },
            };
            const mockCallback = jest.fn();

            // Act
            await handlers.GetListing(mockCall as any, mockCallback);

            // Assert
            expect(mockCallback).toHaveBeenCalledWith(null, expect.objectContaining({
                id: 1,
                cropName: 'Tomato',
                status: 'ACTIVE',
            }));
        });

        it('should return NOT_FOUND when listing does not exist', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(null);

            const mockCall = {
                request: { id: 999, farmerId: 1 },
            };
            const mockCallback = jest.fn();

            // Act
            await handlers.GetListing(mockCall as any, mockCallback);

            // Assert
            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({ code: 5 }), // NOT_FOUND
                null
            );
        });
    });

    // --------------------------------------------------------------------------
    // CancelListing
    // --------------------------------------------------------------------------
    describe('CancelListing', () => {
        it('should cancel listing and return success', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                status: 'ACTIVE' as any,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                quantityKg: 50 as any,
                unit: 'kg',
                entryMode: 'MANUAL' as any,
                crop: { name: 'Tomato', category: 'Vegetables' },
            };

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listing.update.mockResolvedValue({
                ...mockListing,
                status: 'CANCELLED' as any,
                deletedAt: new Date(),
            } as any);

            const mockCall = {
                request: { id: 1, farmerId: 1 },
            };
            const mockCallback = jest.fn();

            // Act
            await handlers.CancelListing(mockCall as any, mockCallback);

            // Assert
            expect(mockCallback).toHaveBeenCalledWith(null, {
                success: true,
                message: 'Listing cancelled successfully',
            });
        });
    });
});
