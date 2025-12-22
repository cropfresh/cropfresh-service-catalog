/**
 * Grading & Pricing Domain Types - Story 3.3
 * 
 * SITUATION: AI grading provides quality assessment, DPLE pricing calculates fair price
 * TASK: Define shared types for grading results and price breakdown
 * ACTION: Create discriminated unions and enums for type safety
 * RESULT: Reusable types across REST, gRPC, and service layers
 */

// ============================================================================
// Quality Grade Enum
// ============================================================================

export enum QualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
}

// ============================================================================
// Quality Indicator Types
// ============================================================================

export enum QualityIndicatorType {
  FRESHNESS = 'freshness',
  COLOR_VIBRANCY = 'color_vibrancy',
  SIZE_CONSISTENCY = 'size_consistency',
  SURFACE_QUALITY = 'surface_quality',
  RIPENESS = 'ripeness',
}

export interface QualityIndicator {
  type: QualityIndicatorType;
  score: number; // 0.0 - 1.0
  label: string; // "Excellent", "Good", "Fair"
}

// ============================================================================
// Grading Result
// ============================================================================

export interface GradingResult {
  grade: QualityGrade;
  confidence: number; // 0.0 - 1.0
  indicators: QualityIndicator[];
  explanation: string;
}

// ============================================================================
// Price Breakdown (DPLE)
// ============================================================================

export interface PriceBreakdown {
  marketRatePerKg: number;
  gradeAdjustment: string; // "+20%", "Baseline", "-15%"
  gradeMultiplier: number;
  finalPricePerKg: number;
  totalEarnings: number;
  quantityKg: number;
  currency: string;
  paymentTerms: string;
}

// ============================================================================
// Rejection Reason
// ============================================================================

export enum RejectionReason {
  RETAKE_PHOTO = 'RETAKE_PHOTO',
  CANCEL = 'CANCEL',
  LIST_ANYWAY = 'LIST_ANYWAY',
}

// ============================================================================
// Input DTOs
// ============================================================================

export interface GradeListingInput {
  listingId: number;
  farmerId: number;
}

export interface CalculatePriceInput {
  listingId: number;
  cropType: string;
  quantityKg: number;
  grade: QualityGrade;
  region?: string;
}

export interface ConfirmListingInput {
  listingId: number;
  farmerId: number;
  priceAccepted: boolean;
}

export interface RejectListingInput {
  listingId: number;
  farmerId: number;
  reason: RejectionReason;
}

// ============================================================================
// Combined Result for Frontend
// ============================================================================

export interface GradingAndPriceResult {
  grading: GradingResult;
  pricing: PriceBreakdown;
}
