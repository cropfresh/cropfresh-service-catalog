/**
 * Inventory Handler - gRPC Service Handler for Buyer Inventory Browse
 * 
 * SITUATION: Buyers need to browse available produce inventory via mobile app
 * TASK: Handle GetAvailableInventory gRPC request with filters and sorting
 * ACTION: Parse request, call repository, transform to proto response
 * RESULT: Paginated inventory items for buyer display
 * 
 * Story 4.1: Browse Produce Inventory with Filters
 * ACs: 4.1.1 (display), 4.1.2 (filters), 4.1.3 (sort)
 * 
 * @module InventoryHandler
 */

import { ServerUnaryCall, sendUnaryData, status } from '@grpc/grpc-js';
import { Logger } from 'pino';
import { listingRepository } from '../../repositories/listing-repository';
import {
    BuyerInventoryFilter,
    SortOption,
    BuyerInventoryItem
} from '../../types/listing';

// ============================================================================
// Types - Map proto messages (these will be generated from protos)
// ============================================================================

/**
 * GetAvailableInventoryRequest - Proto request message
 * Matches frontend FilterPreferences.toQueryParams()
 */
export interface GetAvailableInventoryRequest {
    cropTypes?: string[];
    grades?: string[];
    quantityMin?: number;
    quantityMax?: number;
    deliveryDate?: string; // ISO date string
    sort?: string; // price_asc, price_desc, quality_desc, freshness, quantity_desc
    cursor?: string;
    limit?: number;
}

/**
 * InventoryItemProto - Proto response item
 */
export interface InventoryItemProto {
    id: string;
    cropType: string;
    photoUrl?: string;
    quantityKg: number;
    grade: string;
    pricePerKg: number;
    deliveryDate?: string; // ISO date string
    createdAt: string; // ISO date string
    isNew?: boolean;
}

/**
 * GetAvailableInventoryResponse - Proto response message
 */
export interface GetAvailableInventoryResponse {
    items: InventoryItemProto[];
    total: number;
    nextCursor?: string;
    hasMore: boolean;
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create inventory handler with logger injection
 * 
 * @param logger - Pino logger instance
 * @returns gRPC handler function
 */
export const createInventoryHandler = (logger: Logger) => ({
    /**
     * GetAvailableInventory - Fetch paginated inventory with filters
     * 
     * SITUATION: Buyer mobile app requests filtered inventory list
     * TASK: Query repository with filters and return paginated results  
     * ACTION: Parse request, call findActiveForBuyers, map to proto response
     * RESULT: Paginated inventory items matching buyer criteria
     */
    GetAvailableInventory: async (
        call: ServerUnaryCall<GetAvailableInventoryRequest, GetAvailableInventoryResponse>,
        callback: sendUnaryData<GetAvailableInventoryResponse>
    ): Promise<void> => {
        const requestId = call.metadata.get('x-request-id')?.[0] || 'unknown';
        const childLogger = logger.child({ requestId, handler: 'GetAvailableInventory' });

        try {
            childLogger.info({ request: call.request }, 'Processing inventory request');

            // Parse and validate request
            const filter = parseRequest(call.request);

            // Call repository
            const result = await listingRepository.findActiveForBuyers(filter);

            // Map to proto response
            const response: GetAvailableInventoryResponse = {
                items: result.items.map(mapToProto),
                total: result.total,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
            };

            childLogger.info({
                itemCount: response.items.length,
                total: response.total,
                hasMore: response.hasMore
            }, 'Inventory request successful');

            callback(null, response);
        } catch (error) {
            childLogger.error({ error }, 'Inventory request failed');

            callback({
                code: status.INTERNAL,
                message: 'Failed to fetch inventory',
            }, null);
        }
    },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse gRPC request to repository filter
 */
function parseRequest(request: GetAvailableInventoryRequest): BuyerInventoryFilter {
    return {
        cropTypes: request.cropTypes?.length ? request.cropTypes : undefined,
        grades: request.grades?.length ? request.grades : undefined,
        quantityMin: request.quantityMin,
        quantityMax: request.quantityMax,
        deliveryDate: request.deliveryDate ? new Date(request.deliveryDate) : undefined,
        sort: parseSortOption(request.sort),
        cursor: request.cursor,
        limit: request.limit || 20,
    };
}

/**
 * Parse sort string to SortOption enum
 */
function parseSortOption(sort?: string): SortOption {
    switch (sort) {
        case 'price_asc':
            return SortOption.PRICE_ASC;
        case 'price_desc':
            return SortOption.PRICE_DESC;
        case 'quality_desc':
            return SortOption.QUALITY_DESC;
        case 'quantity_desc':
            return SortOption.QUANTITY_DESC;
        case 'freshness':
        default:
            return SortOption.FRESHNESS;
    }
}

/**
 * Map domain item to proto message
 */
function mapToProto(item: BuyerInventoryItem): InventoryItemProto {
    return {
        id: item.id.toString(),
        cropType: item.cropType,
        photoUrl: item.photoUrl,
        quantityKg: item.quantityKg,
        grade: item.grade,
        pricePerKg: item.pricePerKg,
        deliveryDate: item.deliveryDate?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        isNew: false, // Client will compute based on timestamp
    };
}
