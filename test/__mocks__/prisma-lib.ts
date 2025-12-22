/**
 * Prisma lib/prisma mock
 * 
 * This mocks the actual lib/prisma module to return the singleton mock.
 */

import { prismaMock } from './singleton';

export const prisma = prismaMock;
