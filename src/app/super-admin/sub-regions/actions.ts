
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const createSubRegionSchema = z.object({
  name: z.string().min(1, 'Sub-region name is required'),
  regionId: z.string().min(1, 'Region is required'),
});

type CreateSubRegionInput = z.infer<typeof createSubRegionSchema>;

export async function createSubRegion(values: CreateSubRegionInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createSubRegionSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { name, regionId } = validatedFields.data;
    const firestore = admin.firestore();

    await firestore.collection('subRegions').add({ name, regionId });
    
    revalidatePath('/super-admin/sub-regions');
    return { success: true, message: 'Sub-region created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during sub-region creation process:', error);
    return { success: false, message: 'An unexpected error occurred while creating the sub-region.' };
  }
}
