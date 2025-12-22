/**
 * Listing Repository - Unit Tests (Prisma 7 Pattern)
 * 
 * Tests data access layer using jest-mock-extended.
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../src/generated/prisma/client';

// Create mock before importing modules
const prismaMock = mockDeep<PrismaClient>();

// Mock the lib/prisma module BEFORE importing repository
jest.mock('../../src/lib/prisma', () => ({
    prisma: prismaMock,
}));

// Now import the repository
import { ListingRepository } from '../../src/repositories/listing-repository';
import { ListingStatus, ListingEntryMode, CreateListingInput } from '../../src/types/listing';

// ============================================================================
// Test Suite
// ============================================================================

describe('ListingRepository', () => {
    let repository: ListingRepository;

    beforeEach(() => {
        mockReset(prismaMock);
        repository = new ListingRepository();
    });

    // --------------------------------------------------------------------------
    // create
    // --------------------------------------------------------------------------
    describe('create', () => {
        it('should create a listing with correct data', async () => {
            // Arrange
            const input: CreateListingInput = {
                farmerId: 1,
                cropId: 10,
                quantityKg: 50,
                unit: 'kg',
                entryMode: ListingEntryMode.VOICE,
                voiceText: 'Tomato 50 kilo',
                voiceLanguage: 'kn',
            };

            const expectedListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                quantityKg: 50 as any,
                unit: 'kg',
                entryMode: 'VOICE' as any,
                voiceText: 'Tomato 50 kilo',
                voiceLanguage: 'kn',
                status: 'DRAFT' as any,
                createdAt: new Date(),
            };

            prismaMock.listing.create.mockResolvedValue(expectedListing as any);

            // Act
            const result = await repository.create(input);

            // Assert
            expect(prismaMock.listing.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    farmerId: 1,
                    cropId: 10,
                    quantityKg: 50,
                    entryMode: ListingEntryMode.VOICE,
                    status: ListingStatus.DRAFT,
                }),
            });
            expect(result.id).toBe(1);
        });
    });

    // --------------------------------------------------------------------------
    // findById
    // --------------------------------------------------------------------------
    describe('findById', () => {
        it('should return listing with crop details', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                cropId: 10,
                crop: { name: 'Tomato', category: 'Vegetables' },
            };
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act
            const result = await repository.findById(1);

            // Assert
            expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: expect.objectContaining({
                    crop: expect.any(Object),
                }),
            });
            expect(result?.crop.name).toBe('Tomato');
        });

        it('should return null when listing not found', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(null);

            // Act
            const result = await repository.findById(999);

            // Assert
            expect(result).toBeNull();
        });
    });

    // --------------------------------------------------------------------------
    // findByFarmerId
    // --------------------------------------------------------------------------
    describe('findByFarmerId', () => {
        it('should return paginated listings with total count', async () => {
            // Arrange
            const mockListings = [
                { id: 1, farmerId: 1, cropId: 10 },
                { id: 2, farmerId: 1, cropId: 11 },
            ];
            prismaMock.listing.findMany.mockResolvedValue(mockListings as any);
            prismaMock.listing.count.mockResolvedValue(2);

            // Act
            const result = await repository.findByFarmerId({
                farmerId: 1,
                page: 1,
                pageSize: 10,
            });

            // Assert
            expect(result.listings.length).toBe(2);
            expect(result.total).toBe(2);
        });

        it('should filter by status when provided', async () => {
            // Arrange
            prismaMock.listing.findMany.mockResolvedValue([]);
            prismaMock.listing.count.mockResolvedValue(0);

            // Act
            await repository.findByFarmerId({
                farmerId: 1,
                status: ListingStatus.ACTIVE,
                page: 1,
                pageSize: 10,
            });

            // Assert
            expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        farmerId: 1,
                        status: ListingStatus.ACTIVE,
                    }),
                })
            );
        });
    });

    // --------------------------------------------------------------------------
    // cancel
    // --------------------------------------------------------------------------
    describe('cancel', () => {
        it('should soft delete listing', async () => {
            // Arrange
            const mockCancelled = {
                id: 1,
                status: 'CANCELLED' as any,
                deletedAt: new Date(),
            };
            prismaMock.listing.update.mockResolvedValue(mockCancelled as any);

            // Act
            const result = await repository.cancel(1);

            // Assert
            expect(prismaMock.listing.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    status: ListingStatus.CANCELLED,
                    deletedAt: expect.any(Date),
                },
            });
            expect(result.status).toBe('CANCELLED');
        });
    });
});
