/**
 * Jest Test Setup - Prisma 7 Pattern
 * 
 * Sets up global mocks and test environment.
 */

import path from 'path';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://cropfresh:557925@localhost:5432/cropfresh_catalog?schema=public';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock the lib/prisma module - use absolute path from project root
jest.mock('../src/lib/prisma', () => {
    const { mockDeep } = require('jest-mock-extended');
    return {
        prisma: mockDeep(),
    };
});

// Mock logger
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis(),
    },
}));
