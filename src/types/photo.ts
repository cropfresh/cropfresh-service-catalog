/**
 * Photo Domain Types - Story 3.2
 * 
 * SITUATION: Photo upload and validation requires typed inputs/outputs
 * TASK: Define domain types for photo operations across layers
 * ACTION: Create interfaces matching Prisma schema + service contracts
 * RESULT: Type-safe photo operations from gRPC to database
 * 
 * @module PhotoTypes
 */

// ============================================================================
// Enums (mirror Prisma enums for service layer)
// ============================================================================

export enum PhotoValidationStatus {
    PENDING = 'PENDING',
    VALID = 'VALID',
    INVALID = 'INVALID',
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new photo record (after upload confirmed)
 */
export interface CreatePhotoInput {
    listingId: number;
    photoUrl: string;
    thumbnailUrl?: string;
    s3Key: string;
    originalFilename?: string;
    contentType?: string;
    fileSizeBytes?: number;
    originalSizeBytes?: number;
    width?: number;
    height?: number;
    latitude?: number;
    longitude?: number;
    deviceModel?: string;
    isPrimary?: boolean;
}

/**
 * Input for updating photo validation status
 */
export interface UpdatePhotoValidationInput {
    qualityScore?: number;
    validationStatus: PhotoValidationStatus;
    validationMessage?: string;
}

/**
 * Request for presigned URL generation
 */
export interface PresignedUrlRequest {
    listingId: number;
    fileName: string;
    contentType: string;
}

/**
 * Response from presigned URL generation
 */
export interface PresignedUrlResponse {
    photoId: number;
    presignedUrl: string;
    s3Key: string;
    expiresIn: number; // seconds
}

/**
 * Metadata sent when confirming upload
 */
export interface ConfirmUploadInput {
    photoId: number;
    listingId: number;
    fileSizeBytes?: number;
    originalSizeBytes?: number;
    width?: number;
    height?: number;
    latitude?: number;
    longitude?: number;
    deviceModel?: string;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Photo response for API/gRPC
 */
export interface PhotoResponse {
    id: number;
    listingId: number;
    photoUrl: string;
    thumbnailUrl: string | null;
    originalFilename: string | null;
    contentType: string;
    fileSizeBytes: number | null;
    width: number | null;
    height: number | null;
    qualityScore: number | null;
    validationStatus: string;
    validationMessage: string | null;
    isPrimary: boolean;
    createdAt: string;
}

/**
 * Validation result from AI service
 */
export interface PhotoValidationResult {
    isValid: boolean;
    qualityScore: number; // 0.00 - 1.00
    issues: PhotoQualityIssue[];
}

/**
 * Individual quality issue
 */
export interface PhotoQualityIssue {
    type: PhotoIssueType;
    message: string;
    suggestion: string;
}

export enum PhotoIssueType {
    TOO_DARK = 'TOO_DARK',
    TOO_BRIGHT = 'TOO_BRIGHT',
    BLURRY = 'BLURRY',
    NO_PRODUCE = 'NO_PRODUCE',
    LOW_RESOLUTION = 'LOW_RESOLUTION',
}

// ============================================================================
// Query Filters
// ============================================================================

export interface ListPhotosFilter {
    listingId: number;
    validationStatus?: PhotoValidationStatus;
}
