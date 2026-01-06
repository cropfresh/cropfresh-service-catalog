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

// ============================================================================
// Story 4.1: Buyer Inventory Browse Types
// ============================================================================

/**
 * SortOption - Available sorting options for buyer inventory browse
 */
export enum SortOption {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  QUALITY_DESC = 'quality_desc',
  FRESHNESS = 'freshness',
  QUANTITY_DESC = 'quantity_desc',
}

/**
 * BuyerInventoryFilter - Filter and sort options for inventory browse (AC-4.1.2, AC-4.1.3)
 * 
 * @property cropTypes - Filter by crop names (multi-select)
 * @property grades - Filter by quality grades (A, B, C)
 * @property quantityMin - Minimum quantity in kg
 * @property quantityMax - Maximum quantity in kg
 * @property deliveryDate - Filter by delivery date
 * @property sort - Sort option
 * @property cursor - Cursor for pagination
 * @property limit - Page size (default 20)
 */
export interface BuyerInventoryFilter {
  cropTypes?: string[];
  grades?: string[];
  quantityMin?: number;
  quantityMax?: number;
  deliveryDate?: Date;
  sort?: SortOption;
  cursor?: string;
  limit?: number;
}

/**
 * BuyerInventoryItem - Listing data for buyer inventory response (AC-4.1.1)
 */
export interface BuyerInventoryItem {
  id: number;
  cropType: string;
  photoUrl?: string;
  quantityKg: number;
  grade: string;
  pricePerKg: number;
  deliveryDate?: Date;
  createdAt: Date;
  farmerZone?: string;
}

/**
 * BuyerInventoryResponse - Paginated inventory response
 */
export interface BuyerInventoryResponse {
  items: BuyerInventoryItem[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================================================
// Story 4.2: Detailed Produce Information & Digital Twin Preview Types
// ============================================================================

/**
 * ListingPhotoDto - Photo data for listing details (AC1)
 * 
 * Maps to ListingPhoto Prisma model
 */
export interface ListingPhotoDto {
  id: number;
  photoUrl: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  validationStatus: 'PENDING' | 'VALID' | 'INVALID';
  qualityScore?: number;
}

/**
 * DigitalTwinDto - Digital Twin preview data (AC9)
 * 
 * Contains harvest timestamp, verification status, AI grading details
 */
export interface DigitalTwinDto {
  harvestTimestamp?: Date;
  verificationStatus: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED';
  freshnessScore?: number;      // 0.0 - 1.0
  defectCount?: number;         // Number of detected defects
  aiGradingDetails?: {
    grade: string;              // A, B, C
    confidence: number;         // 0.0 - 1.0
    gradedAt?: Date;
  };
}

/**
 * PriceBreakdownDto - AISP price breakdown (AC5)
 * 
 * Shows how price is calculated
 */
export interface PriceBreakdownDto {
  basePrice: number;            // Crop base price per kg
  qualityAdjustment: number;    // +/- based on grade
  logisticsCost: number;        // Delivery/logistics fee
  platformFee: number;          // CropFresh platform fee
  finalPrice: number;           // Final price per kg
}

/**
 * DeliveryOptionDto - Available delivery options (AC7)
 */
export interface DeliveryOptionDto {
  date: Date;
  label: string;                // "Today", "Tomorrow", etc.
  isAvailable: boolean;
}

/**
 * ListingDetailsDto - Full listing details for buyer view (AC1-9)
 * 
 * SITUATION: Buyer taps on produce card in inventory browse
 * TASK: Return comprehensive listing data for detail screen
 * ACTION: Aggregate listing, photos, pricing, Digital Twin data
 * RESULT: Complete data for all AC1-9 requirements
 */
export interface ListingDetailsDto {
  // Core listing info
  id: number;
  cropType: string;
  cropCategory: string;
  
  // Photos (AC1)
  photos: ListingPhotoDto[];
  primaryPhotoUrl?: string;
  
  // Quality (AC2)
  qualityGrade: string;
  aiConfidence: number;         // 0.0 - 1.0 (display as %)
  
  // Shelf life (AC3)
  shelfLifeDays: number;
  shelfLifeDisplay: string;     // "5-7 days"
  
  // Location (AC4 - privacy-preserved)
  farmerZone: string;           // e.g., "Kolar region"
  
  // Pricing (AC5)
  pricePerKg: number;
  priceBreakdown: PriceBreakdownDto;
  
  // Quantity (AC6)
  quantityKg: number;
  stockStatus: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  
  // Delivery (AC7)
  deliveryOptions: DeliveryOptionDto[];
  
  // Digital Twin (AC9)
  digitalTwin: DigitalTwinDto;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
