/**
 * Prisma Mock - for generated types
 */

// Mock Prisma types
export interface Listing {
    id: number;
    farmerId: number;
    cropId: number;
    quantityKg: number;
    unit: string;
    displayQty: number | null;
    qualityGrade: string | null;
    aiGrade: string | null;
    aiConfidence: number | null;
    photoUrl: string | null;
    photoThumbnail: string | null;
    entryMode: string;
    voiceText: string | null;
    voiceLanguage: string | null;
    estimatedPrice: number | null;
    pricePerKg: number | null;
    status: string;
    harvestDate: Date | null;
    expiresAt: Date | null;
    matchedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export namespace Prisma {
    export interface ListingWhereInput {
        farmerId?: number;
        status?: string;
        cropId?: number;
        deletedAt?: null;
    }
}
