/**
 * Education gRPC Handler
 * Story 3.11: Educational Content on Quality Best Practices
 * 
 * gRPC service handlers for educational content operations.
 * Follows patterns established in grading-handler.ts and listing-handler.ts.
 */

import { ServerUnaryCall, sendUnaryData, status } from '@grpc/grpc-js';
import {
    educationService,
    ContentNotFoundError,
    InvalidCategoryError,
} from '../../services/education-service';

// ============================================================================
// Request/Response Types (matching proto definitions)
// ============================================================================

interface GetEducationalContentRequest {
    farmerId: number;
    category?: string;
    cropType?: string;
    page: number;
    limit: number;
}

interface ContentItem {
    id: string;
    type: string;
    title: string;
    titleRegional: string; // JSON string
    description?: string;
    thumbnailUrl: string;
    contentUrl: string;
    durationSeconds?: number;
    readTimeMinutes?: number;
    language: string;
    cropTypes: string[];
    categories: string[];
    qualityIssues: string[];
    isFeatured: boolean;
    isNew: boolean;
    isBookmarked: boolean;
    viewProgress: number;
    createdAt: string;
}

interface Recommendation {
    section: string;
    reason: string;
    content: ContentItem[];
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

interface GetEducationalContentResponse {
    content: ContentItem[];
    pagination: Pagination;
    recommendations: Recommendation[];
    unseenCount: number;
}

interface GetContentDetailsRequest {
    contentId: string;
    farmerId: number;
}

interface GetContentDetailsResponse {
    content: ContentItem;
    relatedContent: ContentItem[];
}

interface TrackContentViewRequest {
    contentId: string;
    farmerId: number;
    progressPercent: number;
}

interface TrackContentViewResponse {
    success: boolean;
}

interface ToggleBookmarkRequest {
    contentId: string;
    farmerId: number;
    bookmarked: boolean;
}

interface ToggleBookmarkResponse {
    success: boolean;
    bookmarked: boolean;
}

interface GetFarmerContentHistoryRequest {
    farmerId: number;
    type: string; // 'viewed' | 'bookmarked'
    page: number;
    limit: number;
}

interface GetFarmerContentHistoryResponse {
    content: ContentItem[];
    pagination: Pagination;
}

// ============================================================================
// Helper Functions
// ============================================================================

function toContentItem(content: any): ContentItem {
    return {
        id: content.id,
        type: content.type,
        title: content.title,
        titleRegional: content.titleRegional ? JSON.stringify(content.titleRegional) : '{}',
        description: content.description || undefined,
        thumbnailUrl: content.thumbnailUrl,
        contentUrl: content.contentUrl,
        durationSeconds: content.durationSeconds || undefined,
        readTimeMinutes: content.readTimeMinutes || undefined,
        language: content.language,
        cropTypes: content.cropTypes,
        categories: content.categories,
        qualityIssues: content.qualityIssues,
        isFeatured: content.isFeatured,
        isNew: content.isNew,
        isBookmarked: content.isBookmarked,
        viewProgress: content.viewProgress,
        createdAt: content.createdAt.toISOString(),
    };
}

function toRecommendation(rec: any): Recommendation {
    return {
        section: rec.section,
        reason: rec.reason,
        content: rec.content.map(toContentItem),
    };
}

// ============================================================================
// gRPC Handlers
// ============================================================================

/**
 * GetEducationalContent - List educational content with filtering and recommendations
 * AC1: Access Educational Content Section
 * AC2: Content Library Display
 * AC6: Personalized Recommendations
 */
export async function getEducationalContent(
    call: ServerUnaryCall<GetEducationalContentRequest, GetEducationalContentResponse>,
    callback: sendUnaryData<GetEducationalContentResponse>
): Promise<void> {
    try {
        const { farmerId, category, cropType, page, limit } = call.request;

        if (!farmerId) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: 'farmerId is required',
            });
            return;
        }

        const result = await educationService.getContentList({
            farmerId,
            category: category || undefined,
            cropType: cropType || undefined,
            page: page || 1,
            limit: limit || 10,
        });

        callback(null, {
            content: result.content.map(toContentItem),
            pagination: result.pagination,
            recommendations: result.recommendations.map(toRecommendation),
            unseenCount: result.unseenCount,
        });
    } catch (error) {
        console.error('Error in getEducationalContent:', error);
        if (error instanceof InvalidCategoryError) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: error.message,
            });
        } else {
            callback({
                code: status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }
}

/**
 * GetContentDetails - Get single content with related items
 * AC3: Video Playback Experience
 * AC4: Article & Infographic Display
 */
export async function getContentDetails(
    call: ServerUnaryCall<GetContentDetailsRequest, GetContentDetailsResponse>,
    callback: sendUnaryData<GetContentDetailsResponse>
): Promise<void> {
    try {
        const { contentId, farmerId } = call.request;

        if (!contentId || !farmerId) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: 'contentId and farmerId are required',
            });
            return;
        }

        const result = await educationService.getContentDetails({ contentId, farmerId });

        callback(null, {
            content: toContentItem(result.content),
            relatedContent: result.relatedContent.map(toContentItem),
        });
    } catch (error) {
        console.error('Error in getContentDetails:', error);
        if (error instanceof ContentNotFoundError) {
            callback({
                code: status.NOT_FOUND,
                message: error.message,
            });
        } else {
            callback({
                code: status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }
}

/**
 * TrackContentView - Track view progress
 * AC3: Video resume functionality
 * AC7: Progress tracking
 */
export async function trackContentView(
    call: ServerUnaryCall<TrackContentViewRequest, TrackContentViewResponse>,
    callback: sendUnaryData<TrackContentViewResponse>
): Promise<void> {
    try {
        const { contentId, farmerId, progressPercent } = call.request;

        if (!contentId || !farmerId) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: 'contentId and farmerId are required',
            });
            return;
        }

        const result = await educationService.trackView({ contentId, farmerId, progressPercent });

        callback(null, { success: result.success });
    } catch (error) {
        console.error('Error in trackContentView:', error);
        if (error instanceof ContentNotFoundError) {
            callback({
                code: status.NOT_FOUND,
                message: error.message,
            });
        } else {
            callback({
                code: status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }
}

/**
 * ToggleBookmark - Add or remove bookmark
 * AC7: Content Bookmarking & History
 */
export async function toggleBookmark(
    call: ServerUnaryCall<ToggleBookmarkRequest, ToggleBookmarkResponse>,
    callback: sendUnaryData<ToggleBookmarkResponse>
): Promise<void> {
    try {
        const { contentId, farmerId, bookmarked } = call.request;

        if (!contentId || !farmerId) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: 'contentId and farmerId are required',
            });
            return;
        }

        const result = await educationService.toggleBookmark({ contentId, farmerId, bookmarked });

        callback(null, {
            success: result.success,
            bookmarked: result.bookmarked,
        });
    } catch (error) {
        console.error('Error in toggleBookmark:', error);
        if (error instanceof ContentNotFoundError) {
            callback({
                code: status.NOT_FOUND,
                message: error.message,
            });
        } else {
            callback({
                code: status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }
}

/**
 * GetFarmerContentHistory - Get viewed or bookmarked content
 * AC7: Content Bookmarking & History
 */
export async function getFarmerContentHistory(
    call: ServerUnaryCall<GetFarmerContentHistoryRequest, GetFarmerContentHistoryResponse>,
    callback: sendUnaryData<GetFarmerContentHistoryResponse>
): Promise<void> {
    try {
        const { farmerId, type, page, limit } = call.request;

        if (!farmerId) {
            callback({
                code: status.INVALID_ARGUMENT,
                message: 'farmerId is required',
            });
            return;
        }

        const historyType = type === 'bookmarked' ? 'bookmarked' : 'viewed';

        const result = await educationService.getHistory({
            farmerId,
            type: historyType,
            page: page || 1,
            limit: limit || 10,
        });

        callback(null, {
            content: result.content.map(toContentItem),
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Error in getFarmerContentHistory:', error);
        callback({
            code: status.INTERNAL,
            message: 'Internal server error',
        });
    }
}

// Export all handlers for registration
export const educationHandlers = {
    getEducationalContent,
    getContentDetails,
    trackContentView,
    toggleBookmark,
    getFarmerContentHistory,
};
