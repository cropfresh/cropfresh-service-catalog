/**
 * Listing Domain Types - Story 3.1
 * 
 * Shared TypeScript interfaces for listing operations across
 * REST controllers, gRPC handlers, and services.
 */

// ============================================================================
// Enums - Match Prisma schema exactly
// ============================================================================

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PENDING_PHOTO = 'PENDING_PHOTO',
  PENDING_GRADING = 'PENDING_GRADING',
  ACTIVE = 'ACTIVE',
  MATCHED = 'MATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ListingEntryMode {
  MANUAL = 'MANUAL',
  VOICE = 'VOICE',
  PHOTO = 'PHOTO',
}

/**
 * CancellationReason - Why farmer cancelled the listing (AC7)
 * Used for analytics and future optimization
 */
export enum CancellationReason {
  SOLD_ELSEWHERE = 'SOLD_ELSEWHERE',
  QUALITY_CHANGED = 'QUALITY_CHANGED',
  CHANGED_MIND = 'CHANGED_MIND',
  OTHER = 'OTHER',
}

// ============================================================================
// Input DTOs - For creating/updating listings
// ============================================================================

/**
 * CreateListingInput - Input for creating a new listing
 * 
 * @property farmerId - From JWT auth context
 * @property cropId - Selected crop ID
 * @property quantityKg - Quantity in kilograms
 * @property entryMode - How farmer created the listing
 */
export interface CreateListingInput {
  farmerId: number;
  cropId: number;
  quantityKg: number;
  unit?: string;
  displayQty?: number;
  qualityGrade?: string;
  entryMode: ListingEntryMode;
  voiceText?: string;
  voiceLanguage?: string;
  harvestDate?: Date;
}

/**
 * UpdateListingInput - Allowed updates to a listing (AC2-6)
 * Extended for Story 3.9 to support ACTIVE status updates
 */
export interface UpdateListingInput {
  quantityKg?: number;
  unit?: string;
  qualityGrade?: string;
  harvestDate?: Date;
  photoUrl?: string;
  photoThumbnail?: string;
  dropoffWindowId?: number; // Story 3.9: AC5 - Change drop-off time
}

/**
 * CancelListingInput - Input for cancelling a listing (AC7-9)
 * 
 * @property reason - Why the farmer cancelled (for analytics)
 */
export interface CancelListingInput {
  reason: CancellationReason;
}

/**
 * UpdateListingStatusInput - Status transition input
 */
export interface UpdateListingStatusInput {
  status: ListingStatus;
  aiGrade?: string;
  aiConfidence?: number;
  estimatedPrice?: number;
  pricePerKg?: number;
}

// ============================================================================
// Output DTOs - For API responses
// ============================================================================

/**
 * ListingDto - Listing data for API responses
 * Extended for Story 3.9 with cancellation tracking fields
 */
export interface ListingDto {
  id: number;
  farmerId: number;
  cropId: number;
  cropName: string;
  cropEmoji?: string;
  quantityKg: number;
  originalQuantityKg?: number; // Story 3.9: AC3 - Track original for validation
  unit: string;
  displayQty?: number;
  qualityGrade?: string;
  aiGrade?: string;
  photoUrl?: string;
  photoThumbnail?: string;
  entryMode: ListingEntryMode;
  status: ListingStatus;
  estimatedPrice?: number;
  pricePerKg?: number;
  harvestDate?: Date;
  dropoffWindowId?: number; // Story 3.9: AC5
  dropoffTime?: Date; // Story 3.9: AC8 - For 2-hour restriction check
  cancelledAt?: Date; // Story 3.9: AC9
  cancellationReason?: CancellationReason; // Story 3.9: AC9
  createdAt: Date;
  updatedAt: Date;
  // Computed flags for UI (AC1)
  canEdit?: boolean;
  canCancel?: boolean;
}

/**
 * UpdateListingResult - Extended response for update operations (AC6)
 */
export interface UpdateListingResult {
  listing: ListingDto;
  priceChanged: boolean;
  newEstimatedPrice?: number;
  message: string;
}

/**
 * ListingListDto - Paginated list response
 */
export interface ListingListDto {
  listings: ListingDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface ListListingsFilter {
  farmerId: number;
  status?: ListingStatus;
  cropId?: number;
  page?: number;
  pageSize?: number;
}
