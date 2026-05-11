
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  regionId: z.string().min(1, 'Region is required'),
  subRegionId: z.string().optional(),
  regNo: z.string().min(1, 'Registration number is required'),
  group: z.string().optional(),
  category: z.string().optional(),
  schoolType: z.enum([
    "Primary School",
    "Junior Secondary School",
    "Senior Secondary School",
  ], { required_error: 'School type is required' }),
});

type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export async function createSchool(values: CreateSchoolInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createSchoolSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { name, regionId, subRegionId, regNo, group, category, schoolType } = validatedFields.data;
    const firestore = admin.firestore();

    const schoolData: {
      name: string;
      regionId: string;
      subRegionId?: string;
      regNo: string;
      group?: string;
      category?: string;
      schoolType: string;
    } = {
      name,
      regionId,
      regNo,
      schoolType,
    };

    if (subRegionId) {
      schoolData.subRegionId = subRegionId;
    }
    if (group) {
      schoolData.group = group;
    }
    if (category) {
      schoolData.category = category;
    }

    await firestore.collection('schools').add(schoolData);
    
    revalidatePath('/super-admin/schools');
    return { success: true, message: 'School created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during school creation process:', error);
    return { success: false, message: 'An unexpected error occurred while creating the school.' };
  }
}

const updateSchoolSchema = z.object({
  schoolId: z.string(),
  schoolHeadId: z.string().min(1, "Please select a school head."),
});

type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

export async function updateSchool(values: UpdateSchoolInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = updateSchoolSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { schoolId, schoolHeadId } = validatedFields.data;
    const firestore = admin.firestore();

    await firestore.collection('schools').doc(schoolId).update({ schoolHeadId });
    
    revalidatePath('/super-admin/schools');
    return { success: true, message: 'School head assigned successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during school update process:', error);
    return { success: false, message: 'An unexpected error occurred while assigning the school head.' };
  }
}
