/**
 * Education Repository - Data Access Layer
 * Story 3.11: Educational Content on Quality Best Practices
 * 
 * Handles database operations for educational content, views, and bookmarks.
 */

import { prisma } from '../lib/prisma';
import { ContentType, ContentCategory, QualityIssue } from '../generated/prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface ContentListFilter {
    farmerId: number;
    category?: ContentCategory;
    cropType?: string;
    page: number;
    limit: number;
    bookmarkedOnly?: boolean;
    viewedOnly?: boolean;
}

export interface ContentDto {
    id: string;
    type: ContentType;
    title: string;
    titleRegional: Record<string, string> | null;
    description: string | null;
    thumbnailUrl: string;
    contentUrl: string;
    durationSeconds: number | null;
    readTimeMinutes: number | null;
    language: string;
    cropTypes: string[];
    categories: ContentCategory[];
    qualityIssues: QualityIssue[];
    isFeatured: boolean;
    createdAt: Date;
    // Farmer-specific fields (computed)
    isNew: boolean;
    isBookmarked: boolean;
    viewProgress: number;
}

export interface ContentListResult {
    content: ContentDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

export interface ContentRecommendation {
    section: string;
    reason: string;
    content: ContentDto[];
}

// ============================================================================
// Repository Class
// ============================================================================

class EducationRepository {
    /**
     * Get paginated list of educational content with farmer-specific data
     */
    async getContentList(filter: ContentListFilter): Promise<ContentListResult> {
        const { farmerId, category, cropType, page, limit, bookmarkedOnly, viewedOnly } = filter;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            isActive: true,
        };

        if (category) {
            where.categories = { has: category };
        }

        if (cropType) {
            where.cropTypes = { has: cropType };
        }

        // For bookmarked only, join with bookmarks
        if (bookmarkedOnly) {
            where.bookmarks = {
                some: { farmerId },
            };
        }

        // For viewed only, join with views
        if (viewedOnly) {
            where.views = {
                some: { farmerId },
            };
        }

        // Get total count
        const total = await prisma.educationalContent.count({ where });

        // Get content with farmer's view and bookmark status
        const content = await prisma.educationalContent.findMany({
            where,
            include: {
                views: {
                    where: { farmerId },
                    take: 1,
                },
                bookmarks: {
                    where: { farmerId },
                    take: 1,
                },
            },
            orderBy: [
                { isFeatured: 'desc' },
                { createdAt: 'desc' },
            ],
            skip,
            take: limit,
        });

        // Transform to DTO
        const contentDtos = content.map((c) => this.toContentDto(c, farmerId));

        return {
            content: contentDtos,
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + content.length < total,
            },
        };
    }

    /**
     * Get single content by ID with farmer-specific data
     */
    async getContentById(contentId: string, farmerId: number): Promise<ContentDto | null> {
        const content = await prisma.educationalContent.findUnique({
            where: { id: contentId, isActive: true },
            include: {
                views: {
                    where: { farmerId },
                    take: 1,
                },
                bookmarks: {
                    where: { farmerId },
                    take: 1,
                },
            },
        });

        if (!content) return null;

        return this.toContentDto(content, farmerId);
    }

    /**
     * Get related content based on categories and crop types
     */
    async getRelatedContent(contentId: string, farmerId: number, limit: number = 5): Promise<ContentDto[]> {
        const original = await prisma.educationalContent.findUnique({
            where: { id: contentId },
            select: { categories: true, cropTypes: true },
        });

        if (!original) return [];

        const related = await prisma.educationalContent.findMany({
            where: {
                id: { not: contentId },
                isActive: true,
                OR: [
                    { categories: { hasSome: original.categories } },
                    { cropTypes: { hasSome: original.cropTypes } },
                ],
            },
            include: {
                views: { where: { farmerId }, take: 1 },
                bookmarks: { where: { farmerId }, take: 1 },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return related.map((c) => this.toContentDto(c, farmerId));
    }

    /**
     * Get personalized recommendations for a farmer
     */
    async getRecommendations(
        farmerId: number,
        cropTypes: string[],
        qualityIssues: QualityIssue[],
        limit: number = 5
    ): Promise<ContentRecommendation[]> {
        const recommendations: ContentRecommendation[] = [];

        // Crop-based recommendations
        if (cropTypes.length > 0) {
            const cropContent = await prisma.educationalContent.findMany({
                where: {
                    isActive: true,
                    cropTypes: { hasSome: cropTypes },
                    views: { none: { farmerId } }, // Not yet viewed
                },
                include: {
                    views: { where: { farmerId }, take: 1 },
                    bookmarks: { where: { farmerId }, take: 1 },
                },
                take: limit,
                orderBy: { isFeatured: 'desc' },
            });

            if (cropContent.length > 0) {
                recommendations.push({
                    section: `Because you grow ${cropTypes[0]}`,
                    reason: 'Based on your crop profile',
                    content: cropContent.map((c) => this.toContentDto(c, farmerId)),
                });
            }
        }

        // Quality issue-based recommendations
        if (qualityIssues.length > 0) {
            const issueContent = await prisma.educationalContent.findMany({
                where: {
                    isActive: true,
                    qualityIssues: { hasSome: qualityIssues },
                },
                include: {
                    views: { where: { farmerId }, take: 1 },
                    bookmarks: { where: { farmerId }, take: 1 },
                },
                take: limit,
                orderBy: { isFeatured: 'desc' },
            });

            if (issueContent.length > 0) {
                recommendations.push({
                    section: 'Improve Your Score',
                    reason: 'Based on your recent quality feedback',
                    content: issueContent.map((c) => this.toContentDto(c, farmerId)),
                });
            }
        }

        // Featured content
        const featured = await prisma.educationalContent.findMany({
            where: {
                isActive: true,
                isFeatured: true,
                views: { none: { farmerId } },
            },
            include: {
                views: { where: { farmerId }, take: 1 },
                bookmarks: { where: { farmerId }, take: 1 },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        if (featured.length > 0) {
            recommendations.push({
                section: 'Featured Tips',
                reason: 'Popular content from CropFresh',
                content: featured.map((c) => this.toContentDto(c, farmerId)),
            });
        }

        return recommendations;
    }

    /**
     * Track or update content view progress
     */
    async trackView(contentId: string, farmerId: number, progressPercent: number): Promise<void> {
        const isCompleted = progressPercent >= 90;

        await prisma.contentView.upsert({
            where: {
                contentId_farmerId: { contentId, farmerId },
            },
            update: {
                progressPercent,
                isCompleted,
                updatedAt: new Date(),
            },
            create: {
                contentId,
                farmerId,
                progressPercent,
                isCompleted,
            },
        });
    }

    /**
     * Toggle bookmark status
     */
    async toggleBookmark(contentId: string, farmerId: number, bookmarked: boolean): Promise<boolean> {
        if (bookmarked) {
            // Add bookmark
            await prisma.contentBookmark.upsert({
                where: {
                    contentId_farmerId: { contentId, farmerId },
                },
                update: {}, // No update needed, just ensure exists
                create: {
                    contentId,
                    farmerId,
                },
            });
            return true;
        } else {
            // Remove bookmark
            await prisma.contentBookmark.deleteMany({
                where: { contentId, farmerId },
            });
            return false;
        }
    }

    /**
     * Get farmer's content history (viewed or bookmarked)
     */
    async getFarmerHistory(
        farmerId: number,
        type: 'viewed' | 'bookmarked',
        page: number,
        limit: number
    ): Promise<ContentListResult> {
        const skip = (page - 1) * limit;

        if (type === 'viewed') {
            const total = await prisma.contentView.count({ where: { farmerId } });
            const views = await prisma.contentView.findMany({
                where: { farmerId },
                include: {
                    content: {
                        include: {
                            views: { where: { farmerId }, take: 1 },
                            bookmarks: { where: { farmerId }, take: 1 },
                        },
                    },
                },
                orderBy: { viewedAt: 'desc' },
                skip,
                take: limit,
            });

            return {
                content: views.map((v) => this.toContentDto(v.content, farmerId)),
                pagination: {
                    page,
                    limit,
                    total,
                    hasMore: skip + views.length < total,
                },
            };
        } else {
            const total = await prisma.contentBookmark.count({ where: { farmerId } });
            const bookmarks = await prisma.contentBookmark.findMany({
                where: { farmerId },
                include: {
                    content: {
                        include: {
                            views: { where: { farmerId }, take: 1 },
                            bookmarks: { where: { farmerId }, take: 1 },
                        },
                    },
                },
                orderBy: { bookmarkedAt: 'desc' },
                skip,
                take: limit,
            });

            return {
                content: bookmarks.map((b) => this.toContentDto(b.content, farmerId)),
                pagination: {
                    page,
                    limit,
                    total,
                    hasMore: skip + bookmarks.length < total,
                },
            };
        }
    }

    /**
     * Get unseen content count for farmer
     */
    async getUnseenCount(farmerId: number): Promise<number> {
        const viewedIds = await prisma.contentView.findMany({
            where: { farmerId },
            select: { contentId: true },
        });

        const count = await prisma.educationalContent.count({
            where: {
                isActive: true,
                id: { notIn: viewedIds.map((v) => v.contentId) },
            },
        });

        return count;
    }

    /**
     * Convert database entity to DTO with farmer-specific computed fields
     */
    private toContentDto(content: any, farmerId: number): ContentDto {
        const view = content.views?.[0];
        const bookmark = content.bookmarks?.[0];

        // Content is "new" if not viewed and created in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isNew = !view && content.createdAt > sevenDaysAgo;

        return {
            id: content.id,
            type: content.type,
            title: content.title,
            titleRegional: content.titleRegional as Record<string, string> | null,
            description: content.description,
            thumbnailUrl: content.thumbnailUrl,
            contentUrl: content.contentUrl,
            durationSeconds: content.durationSeconds,
            readTimeMinutes: content.readTimeMinutes,
            language: content.language,
            cropTypes: content.cropTypes,
            categories: content.categories,
            qualityIssues: content.qualityIssues,
            isFeatured: content.isFeatured,
            createdAt: content.createdAt,
            isNew,
            isBookmarked: !!bookmark,
            viewProgress: view?.progressPercent ?? 0,
        };
    }
}

export const educationRepository = new EducationRepository();
export { EducationRepository };
