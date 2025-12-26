/**
 * Education Service Tests - Story 3.11
 * 
 * Unit tests for EducationService business logic.
 */

import {
    EducationService,
    ContentNotFoundError,
    InvalidCategoryError,
} from '../../src/services/education-service';
import { ContentCategory, QualityIssue } from '../../src/generated/prisma';

// Mock repository
const mockRepository = {
    getContentList: jest.fn(),
    getContentById: jest.fn(),
    getRelatedContent: jest.fn(),
    getRecommendations: jest.fn(),
    trackView: jest.fn(),
    toggleBookmark: jest.fn(),
    getFarmerHistory: jest.fn(),
    getUnseenCount: jest.fn(),
};

describe('EducationService', () => {
    let service: EducationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new EducationService(mockRepository as any);
    });

    describe('getContentList', () => {
        const mockContentList = {
            content: [
                {
                    id: 'uuid-1',
                    type: 'VIDEO',
                    title: 'Test Video',
                    thumbnailUrl: 'https://example.com/thumb.jpg',
                    contentUrl: 'https://youtube.com/watch?v=123',
                    durationSeconds: 180,
                    language: 'en',
                    cropTypes: ['TOMATO'],
                    categories: ['HARVEST'],
                    qualityIssues: [],
                    isFeatured: true,
                    createdAt: new Date(),
                    isNew: true,
                    isBookmarked: false,
                    viewProgress: 0,
                },
            ],
            pagination: {
                page: 1,
                limit: 10,
                total: 1,
                hasMore: false,
            },
        };

        const mockRecommendations = [
            {
                section: 'Because you grow Tomatoes',
                reason: 'Based on your crop profile',
                content: [],
            },
        ];

        it('should return content list with recommendations (AC1, AC2, AC6)', async () => {
            mockRepository.getContentList.mockResolvedValue(mockContentList);
            mockRepository.getRecommendations.mockResolvedValue(mockRecommendations);
            mockRepository.getUnseenCount.mockResolvedValue(5);

            const result = await service.getContentList({
                farmerId: 1,
                page: 1,
                limit: 10,
            });

            expect(result.content).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(result.recommendations).toHaveLength(1);
            expect(result.unseenCount).toBe(5);
            expect(mockRepository.getContentList).toHaveBeenCalledWith({
                farmerId: 1,
                category: undefined,
                cropType: undefined,
                page: 1,
                limit: 10,
            });
        });

        it('should filter by category when provided', async () => {
            mockRepository.getContentList.mockResolvedValue(mockContentList);
            mockRepository.getRecommendations.mockResolvedValue([]);
            mockRepository.getUnseenCount.mockResolvedValue(0);

            await service.getContentList({
                farmerId: 1,
                category: 'HARVEST',
            });

            expect(mockRepository.getContentList).toHaveBeenCalledWith(
                expect.objectContaining({
                    category: 'HARVEST',
                })
            );
        });

        it('should throw InvalidCategoryError for unknown category', async () => {
            await expect(
                service.getContentList({
                    farmerId: 1,
                    category: 'INVALID_CATEGORY',
                })
            ).rejects.toThrow(InvalidCategoryError);
        });

        it('should use default pagination values', async () => {
            mockRepository.getContentList.mockResolvedValue(mockContentList);
            mockRepository.getRecommendations.mockResolvedValue([]);
            mockRepository.getUnseenCount.mockResolvedValue(0);

            await service.getContentList({ farmerId: 1 });

            expect(mockRepository.getContentList).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 1,
                    limit: 10,
                })
            );
        });
    });

    describe('getContentDetails', () => {
        const mockContent = {
            id: 'uuid-1',
            type: 'ARTICLE',
            title: 'Test Article',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            contentUrl: '## Article Content',
            readTimeMinutes: 5,
            language: 'en',
            cropTypes: ['ONION'],
            categories: ['STORAGE'],
            qualityIssues: [],
            isFeatured: false,
            createdAt: new Date(),
            isNew: false,
            isBookmarked: true,
            viewProgress: 50,
        };

        const mockRelated = [
            { ...mockContent, id: 'uuid-2', title: 'Related Content' },
        ];

        it('should return content with related items (AC3, AC4)', async () => {
            mockRepository.getContentById.mockResolvedValue(mockContent);
            mockRepository.getRelatedContent.mockResolvedValue(mockRelated);

            const result = await service.getContentDetails({
                contentId: 'uuid-1',
                farmerId: 1,
            });

            expect(result.content.id).toBe('uuid-1');
            expect(result.relatedContent).toHaveLength(1);
            expect(mockRepository.getContentById).toHaveBeenCalledWith('uuid-1', 1);
        });

        it('should throw ContentNotFoundError for non-existent content', async () => {
            mockRepository.getContentById.mockResolvedValue(null);

            await expect(
                service.getContentDetails({
                    contentId: 'non-existent',
                    farmerId: 1,
                })
            ).rejects.toThrow(ContentNotFoundError);
        });
    });

    describe('trackView', () => {
        it('should track view progress (AC3, AC7)', async () => {
            mockRepository.getContentById.mockResolvedValue({ id: 'uuid-1' });
            mockRepository.trackView.mockResolvedValue(undefined);

            const result = await service.trackView({
                contentId: 'uuid-1',
                farmerId: 1,
                progressPercent: 75,
            });

            expect(result.success).toBe(true);
            expect(mockRepository.trackView).toHaveBeenCalledWith('uuid-1', 1, 75);
        });

        it('should clamp progress to 0-100 range', async () => {
            mockRepository.getContentById.mockResolvedValue({ id: 'uuid-1' });
            mockRepository.trackView.mockResolvedValue(undefined);

            await service.trackView({
                contentId: 'uuid-1',
                farmerId: 1,
                progressPercent: 150, // Over 100
            });

            expect(mockRepository.trackView).toHaveBeenCalledWith('uuid-1', 1, 100);
        });

        it('should throw error for non-existent content', async () => {
            mockRepository.getContentById.mockResolvedValue(null);

            await expect(
                service.trackView({
                    contentId: 'non-existent',
                    farmerId: 1,
                    progressPercent: 50,
                })
            ).rejects.toThrow(ContentNotFoundError);
        });
    });

    describe('toggleBookmark', () => {
        it('should add bookmark (AC7)', async () => {
            mockRepository.getContentById.mockResolvedValue({ id: 'uuid-1' });
            mockRepository.toggleBookmark.mockResolvedValue(true);

            const result = await service.toggleBookmark({
                contentId: 'uuid-1',
                farmerId: 1,
                bookmarked: true,
            });

            expect(result.success).toBe(true);
            expect(result.bookmarked).toBe(true);
            expect(mockRepository.toggleBookmark).toHaveBeenCalledWith('uuid-1', 1, true);
        });

        it('should remove bookmark', async () => {
            mockRepository.getContentById.mockResolvedValue({ id: 'uuid-1' });
            mockRepository.toggleBookmark.mockResolvedValue(false);

            const result = await service.toggleBookmark({
                contentId: 'uuid-1',
                farmerId: 1,
                bookmarked: false,
            });

            expect(result.success).toBe(true);
            expect(result.bookmarked).toBe(false);
        });

        it('should throw error for non-existent content', async () => {
            mockRepository.getContentById.mockResolvedValue(null);

            await expect(
                service.toggleBookmark({
                    contentId: 'non-existent',
                    farmerId: 1,
                    bookmarked: true,
                })
            ).rejects.toThrow(ContentNotFoundError);
        });
    });

    describe('getHistory', () => {
        const mockHistory = {
            content: [],
            pagination: { page: 1, limit: 10, total: 0, hasMore: false },
        };

        it('should return viewed history (AC7)', async () => {
            mockRepository.getFarmerHistory.mockResolvedValue(mockHistory);

            await service.getHistory({
                farmerId: 1,
                type: 'viewed',
            });

            expect(mockRepository.getFarmerHistory).toHaveBeenCalledWith(1, 'viewed', 1, 10);
        });

        it('should return bookmarked history', async () => {
            mockRepository.getFarmerHistory.mockResolvedValue(mockHistory);

            await service.getHistory({
                farmerId: 1,
                type: 'bookmarked',
                page: 2,
                limit: 20,
            });

            expect(mockRepository.getFarmerHistory).toHaveBeenCalledWith(1, 'bookmarked', 2, 20);
        });
    });

    describe('getUnseenCount', () => {
        it('should return unseen content count (AC10)', async () => {
            mockRepository.getUnseenCount.mockResolvedValue(8);

            const count = await service.getUnseenCount(1);

            expect(count).toBe(8);
            expect(mockRepository.getUnseenCount).toHaveBeenCalledWith(1);
        });
    });
});
