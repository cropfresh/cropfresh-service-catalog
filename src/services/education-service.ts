/**
 * Education Service - Business Logic Layer
 * Story 3.11: Educational Content on Quality Best Practices
 * 
 * Handles business logic for educational content, including:
 * - Content retrieval with personalization
 * - Recommendation engine based on farmer profile and ratings
 * - View tracking and bookmark management
 */

import {
    EducationRepository,
    educationRepository,
    ContentListFilter,
    ContentListResult,
    ContentDto,
    ContentRecommendation,
} from '../repositories/education-repository';
import { ContentCategory, QualityIssue } from '../generated/prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface GetContentListInput {
    farmerId: number;
    category?: string;
    cropType?: string;
    page?: number;
    limit?: number;
}

export interface GetContentListResult {
    content: ContentDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
    recommendations: ContentRecommendation[];
    unseenCount: number;
}

export interface GetContentDetailsInput {
    contentId: string;
    farmerId: number;
}

export interface GetContentDetailsResult {
    content: ContentDto;
    relatedContent: ContentDto[];
}

export interface TrackViewInput {
    contentId: string;
    farmerId: number;
    progressPercent: number;
}

export interface ToggleBookmarkInput {
    contentId: string;
    farmerId: number;
    bookmarked: boolean;
}

export interface GetHistoryInput {
    farmerId: number;
    type: 'viewed' | 'bookmarked';
    page?: number;
    limit?: number;
}

export interface FarmerProfile {
    cropTypes: string[];
    qualityIssues: QualityIssue[];
    averageRating?: number;
}

// ============================================================================
// Custom Errors
// ============================================================================

export class ContentNotFoundError extends Error {
    constructor(contentId: string) {
        super(`Educational content with ID ${contentId} not found`);
        this.name = 'ContentNotFoundError';
    }
}

export class InvalidCategoryError extends Error {
    constructor(category: string) {
        super(`Invalid content category: ${category}`);
        this.name = 'InvalidCategoryError';
    }
}

// ============================================================================
// Service Class
// ============================================================================

class EducationService {
    constructor(private repository: EducationRepository = educationRepository) { }

    /**
     * Get educational content list with recommendations
     * AC1: Access Educational Content Section
     * AC2: Content Library Display
     * AC6: Personalized Recommendations
     */
    async getContentList(input: GetContentListInput): Promise<GetContentListResult> {
        const { farmerId, category, cropType, page = 1, limit = 10 } = input;

        // Validate category if provided
        let validCategory: ContentCategory | undefined;
        if (category) {
            validCategory = this.parseCategory(category);
        }

        // Build filter
        const filter: ContentListFilter = {
            farmerId,
            category: validCategory,
            cropType,
            page,
            limit,
        };

        // Get content list
        const result = await this.repository.getContentList(filter);

        // Get farmer profile for recommendations (mock for now - TODO: cross-service call)
        const farmerProfile = await this.getFarmerProfile(farmerId);

        // Get recommendations based on profile
        const recommendations = await this.repository.getRecommendations(
            farmerId,
            farmerProfile.cropTypes,
            farmerProfile.qualityIssues,
            5
        );

        // Get unseen count for badge
        const unseenCount = await this.repository.getUnseenCount(farmerId);

        return {
            ...result,
            recommendations,
            unseenCount,
        };
    }

    /**
     * Get single content details with related content
     * AC3: Video Playback Experience
     * AC4: Article & Infographic Display
     */
    async getContentDetails(input: GetContentDetailsInput): Promise<GetContentDetailsResult> {
        const { contentId, farmerId } = input;

        const content = await this.repository.getContentById(contentId, farmerId);
        if (!content) {
            throw new ContentNotFoundError(contentId);
        }

        const relatedContent = await this.repository.getRelatedContent(contentId, farmerId, 5);

        return {
            content,
            relatedContent,
        };
    }

    /**
     * Track content view progress
     * AC3: Video resume functionality
     * AC7: Progress tracking
     */
    async trackView(input: TrackViewInput): Promise<{ success: boolean }> {
        const { contentId, farmerId, progressPercent } = input;

        // Validate content exists
        const content = await this.repository.getContentById(contentId, farmerId);
        if (!content) {
            throw new ContentNotFoundError(contentId);
        }

        // Clamp progress to 0-100
        const clampedProgress = Math.max(0, Math.min(100, progressPercent));

        await this.repository.trackView(contentId, farmerId, clampedProgress);

        return { success: true };
    }

    /**
     * Toggle content bookmark
     * AC7: Content Bookmarking & History
     * AC9: Offline Support (bookmarked content can be downloaded)
     */
    async toggleBookmark(input: ToggleBookmarkInput): Promise<{ success: boolean; bookmarked: boolean }> {
        const { contentId, farmerId, bookmarked } = input;

        // Validate content exists
        const content = await this.repository.getContentById(contentId, farmerId);
        if (!content) {
            throw new ContentNotFoundError(contentId);
        }

        const finalBookmarkStatus = await this.repository.toggleBookmark(contentId, farmerId, bookmarked);

        return {
            success: true,
            bookmarked: finalBookmarkStatus,
        };
    }

    /**
     * Get farmer's content history
     * AC7: Content Bookmarking & History
     */
    async getHistory(input: GetHistoryInput): Promise<ContentListResult> {
        const { farmerId, type, page = 1, limit = 10 } = input;

        return this.repository.getFarmerHistory(farmerId, type, page, limit);
    }

    /**
     * Get unseen content count for badge display
     * AC10: Badge count on Learn tab
     */
    async getUnseenCount(farmerId: number): Promise<number> {
        return this.repository.getUnseenCount(farmerId);
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Parse and validate category string
     */
    private parseCategory(category: string): ContentCategory {
        const upperCategory = category.toUpperCase() as ContentCategory;
        const validCategories: ContentCategory[] = [
            'HARVEST',
            'STORAGE',
            'PHOTOGRAPHY',
            'HANDLING',
            'PACKAGING',
            'GENERAL',
        ];

        if (!validCategories.includes(upperCategory)) {
            throw new InvalidCategoryError(category);
        }

        return upperCategory;
    }

    /**
     * Get farmer profile for recommendations
     * TODO: Replace with cross-service call to Auth/Profile service
     */
    private async getFarmerProfile(farmerId: number): Promise<FarmerProfile> {
        // Mock implementation - in production, call Auth or Catalog service
        // to get farmer's registered crops and Order service for quality issues
        return {
            cropTypes: ['TOMATO', 'ONION'], // Would come from farmer profile
            qualityIssues: [], // Would come from Order service ratings
            averageRating: 4.5, // Would come from Order service
        };
    }
}

export const educationService = new EducationService();
export { EducationService };
