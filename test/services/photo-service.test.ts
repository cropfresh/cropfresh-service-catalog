/**
 * Photo Service - Unit Tests (Prisma 7 Pattern)
 * 
 * Tests business logic layer using jest-mock-extended for Prisma mocking.
 * 
 * Story 3.2: Produce Photo Capture and Upload
 */

import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../src/generated/prisma/client';

// Create mock before importing modules
const prismaMock = mockDeep<PrismaClient>();

// Mock the lib/prisma module BEFORE importing service
jest.mock('../../src/lib/prisma', () => ({
    prisma: prismaMock,
}));

// Mock S3 service
const mockS3Service = {
    getPresignedUploadUrl: jest.fn(),
    getPublicUrl: jest.fn(),
    deleteObject: jest.fn(),
    generatePhotoKey: jest.fn(),
    generateThumbnailKey: jest.fn(),
};

jest.mock('../../src/services/s3-service', () => ({
    s3Service: mockS3Service,
    S3Service: jest.fn().mockImplementation(() => mockS3Service),
}));

// Now import the service (it will get the mocked dependencies)
import { PhotoService, PhotoNotFoundError, ListingNotFoundError, ListingAccessDeniedError } from '../../src/services/photo-service';
import { PhotoValidationStatus, PhotoIssueType } from '../../src/types/photo';

// ============================================================================
// Test Suite
// ============================================================================

describe('PhotoService', () => {
    let service: PhotoService;

    beforeEach(() => {
        mockReset(prismaMock);
        jest.clearAllMocks();
        service = new PhotoService();
    });

    // --------------------------------------------------------------------------
    // generatePresignedUrl
    // --------------------------------------------------------------------------
    describe('generatePresignedUrl', () => {
        const validRequest = {
            listingId: 1,
            fileName: 'test.jpg',
            contentType: 'image/jpeg',
        };

        it('should generate presigned URL when listing exists and belongs to farmer', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 1,
                status: 'DRAFT',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockPhoto = {
                id: 100,
                listingId: 1,
                photoUrl: '',
                s3Key: 'pending/1/12345.jpg',
                validationStatus: 'PENDING',
                createdAt: new Date(),
            };

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listingPhoto.create.mockResolvedValue(mockPhoto as any);
            mockS3Service.getPresignedUploadUrl.mockResolvedValue('https://s3.presigned.url');

            // Act
            const result = await service.generatePresignedUrl(1, validRequest);

            // Assert
            expect(prismaMock.listing.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                })
            );
            expect(prismaMock.listingPhoto.create).toHaveBeenCalled();
            expect(mockS3Service.getPresignedUploadUrl).toHaveBeenCalled();
            expect(result.photoId).toBe(100);
            expect(result.presignedUrl).toBe('https://s3.presigned.url');
            expect(result.expiresIn).toBe(900);
        });

        it('should throw ListingNotFoundError when listing does not exist', async () => {
            // Arrange
            prismaMock.listing.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(service.generatePresignedUrl(1, validRequest))
                .rejects.toThrow(ListingNotFoundError);
        });

        it('should throw ListingAccessDeniedError when farmer does not own listing', async () => {
            // Arrange
            const mockListing = {
                id: 1,
                farmerId: 2, // Different farmer
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

            // Act & Assert
            await expect(service.generatePresignedUrl(1, validRequest))
                .rejects.toThrow(ListingAccessDeniedError);
        });
    });

    // --------------------------------------------------------------------------
    // confirmUpload
    // --------------------------------------------------------------------------
    describe('confirmUpload', () => {
        const validInput = {
            photoId: 100,
            listingId: 1,
            fileSizeBytes: 1024000,
            width: 1920,
            height: 1080,
        };

        it('should confirm upload and update photo metadata', async () => {
            // Arrange
            const mockPhoto = {
                id: 100,
                listingId: 1,
                s3Key: 'pending/1/100.jpg',
                validationStatus: 'PENDING',
                createdAt: new Date(),
            };

            const mockListing = {
                id: 1,
                farmerId: 1,
            };

            prismaMock.listingPhoto.findUnique.mockResolvedValue(mockPhoto as any);
            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listingPhoto.update.mockResolvedValue({
                ...mockPhoto,
                fileSizeBytes: 1024000,
                width: 1920,
                height: 1080,
            } as any);
            prismaMock.listingPhoto.findMany.mockResolvedValue([mockPhoto as any]);
            prismaMock.listingPhoto.updateMany.mockResolvedValue({ count: 0 });

            mockS3Service.generatePhotoKey.mockReturnValue('listings/1/100.jpg');
            mockS3Service.getPublicUrl.mockReturnValue('https://s3.bucket.url/listings/1/100.jpg');

            // Act
            const result = await service.confirmUpload(1, validInput);

            // Assert
            expect(prismaMock.listingPhoto.update).toHaveBeenCalled();
            expect(result.id).toBe(100);
        });

        it('should throw PhotoNotFoundError when photo does not exist', async () => {
            // Arrange
            prismaMock.listingPhoto.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(service.confirmUpload(1, validInput))
                .rejects.toThrow(PhotoNotFoundError);
        });
    });

    // --------------------------------------------------------------------------
    // updateValidation
    // --------------------------------------------------------------------------
    describe('updateValidation', () => {
        const validResult = {
            isValid: true,
            qualityScore: 0.85,
            issues: [],
        };

        it('should update photo with validation results', async () => {
            // Arrange
            const mockPhoto = {
                id: 100,
                listingId: 1,
                validationStatus: 'PENDING',
                createdAt: new Date(),
            };

            prismaMock.listingPhoto.update.mockResolvedValue({
                ...mockPhoto,
                qualityScore: 0.85,
                validationStatus: 'VALID',
            } as any);

            // Act
            const result = await service.updateValidation(100, validResult);

            // Assert
            expect(prismaMock.listingPhoto.update).toHaveBeenCalledWith({
                where: { id: 100 },
                data: expect.objectContaining({
                    qualityScore: 0.85,
                    validationStatus: PhotoValidationStatus.VALID,
                }),
            });
        });

        it('should mark photo as INVALID when validation fails', async () => {
            // Arrange
            const invalidResult = {
                isValid: false,
                qualityScore: 0.35,
                issues: [
                    { type: PhotoIssueType.BLURRY, message: 'Photo is blurry', suggestion: 'Hold steady' },
                ],
            };

            prismaMock.listingPhoto.update.mockResolvedValue({
                id: 100,
                validationStatus: 'INVALID',
                qualityScore: 0.35,
                validationMessage: 'Photo is blurry',
                createdAt: new Date(),
            } as any);

            // Act
            const result = await service.updateValidation(100, invalidResult);

            // Assert
            expect(prismaMock.listingPhoto.update).toHaveBeenCalledWith({
                where: { id: 100 },
                data: expect.objectContaining({
                    validationStatus: PhotoValidationStatus.INVALID,
                    validationMessage: 'Photo is blurry',
                }),
            });
        });
    });

    // --------------------------------------------------------------------------
    // deletePhoto
    // --------------------------------------------------------------------------
    describe('deletePhoto', () => {
        it('should delete photo from S3 and database', async () => {
            // Arrange
            const mockListing = { id: 1, farmerId: 1 };
            const mockPhoto = {
                id: 100,
                listingId: 1,
                s3Key: 'listings/1/100.jpg',
                createdAt: new Date(),
            };

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listingPhoto.findUnique.mockResolvedValue(mockPhoto as any);
            prismaMock.listingPhoto.delete.mockResolvedValue(mockPhoto as any);
            mockS3Service.deleteObject.mockResolvedValue(undefined);

            // Act
            await service.deletePhoto(1, 100, 1);

            // Assert
            expect(mockS3Service.deleteObject).toHaveBeenCalledWith('listings/1/100.jpg');
            expect(prismaMock.listingPhoto.delete).toHaveBeenCalledWith({
                where: { id: 100 },
            });
        });

        it('should still delete from database if S3 delete fails', async () => {
            // Arrange
            const mockListing = { id: 1, farmerId: 1 };
            const mockPhoto = {
                id: 100,
                listingId: 1,
                s3Key: 'listings/1/100.jpg',
            };

            prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);
            prismaMock.listingPhoto.findUnique.mockResolvedValue(mockPhoto as any);
            prismaMock.listingPhoto.delete.mockResolvedValue(mockPhoto as any);
            mockS3Service.deleteObject.mockRejectedValue(new Error('S3 error'));

            // Act - should not throw
            await service.deletePhoto(1, 100, 1);

            // Assert
            expect(prismaMock.listingPhoto.delete).toHaveBeenCalled();
        });
    });
});
