/**
 * Prisma Client Singleton Mock - Prisma 7 Pattern
 * 
 * Uses jest-mock-extended for deep mocking as recommended by Prisma docs.
 * Reference: https://www.prisma.io/docs/guides/testing/unit-testing
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Re-export a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Reset mock between tests
beforeEach(() => {
    mockReset(prismaMock);
});

// Export as default for module mocking
export default prismaMock;
