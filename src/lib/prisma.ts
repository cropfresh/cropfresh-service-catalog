/**
 * Centralized PrismaClient singleton for Catalog Service
 * Uses the new Prisma 7 driver adapter pattern
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Create the PostgreSQL adapter with connection string
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Export singleton PrismaClient instance
export const prisma = new PrismaClient({ adapter });

// Re-export all types and enum values from generated client
export {
    PrismaClient,
    Prisma,
} from '../generated/prisma/client';

// Re-export types for Catalog service
export type {
    Crop,
    Inventory,
    Listing,
    ListingPhoto,
} from '../generated/prisma/client';

// Re-export enums as values (not type-only) so they can be used at runtime
export {
    ListingStatus,
    ListingEntryMode,
    CancellationReason,
    PhotoValidationStatus,
} from '../generated/prisma/client';



