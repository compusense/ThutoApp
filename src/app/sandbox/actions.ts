'use server';

/**
 * @fileOverview Server actions for the Game Sandbox.
 * 
 * Note: Firestore mutations have been moved to the client side 
 * to support optimistic updates and specialized error handling.
 */

import { z } from 'zod';
import { admin } from '@/firebase/admin';

// This file is now primarily for shared types or non-mutation server logic if needed.
// Mutation functions (submitGameForReview, recordGameActivity) are now client-side.
export {};
