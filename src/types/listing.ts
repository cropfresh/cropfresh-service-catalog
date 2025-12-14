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
 * UpdateListingInput - Allowed updates to a listing
 */
export interface UpdateListingInput {
  quantityKg?: number;
  unit?: string;
  qualityGrade?: string;
  harvestDate?: Date;
  photoUrl?: string;
  photoThumbnail?: string;
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
 */
export interface ListingDto {
  id: number;
  farmerId: number;
  cropId: number;
  cropName: string;
  cropEmoji?: string;
  quantityKg: number;
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
  createdAt: Date;
  updatedAt: Date;
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
