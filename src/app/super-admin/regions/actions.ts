
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';

const createRegionSchema = z.object({
  name: z.string().min(1, 'Region name is required'),
});

type CreateRegionInput = z.infer<typeof createRegionSchema>;

export async function createRegion(values: CreateRegionInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createRegionSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { name } = validatedFields.data;
    const firestore = admin.firestore();

    await firestore.collection('regions').add({ name });

    return { success: true, message: 'Region created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during region creation process:', error);
    return { success: false, message: 'An unexpected error occurred while creating the region.' };
  }
}
