
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  subjectCode: z.string().optional(),
  schoolLevel: z.enum([
    "Primary School",
    "Junior Secondary School",
    "Senior Secondary School",
  ], { required_error: 'School level is required' }),
});

type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export async function createSubject(values: CreateSubjectInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createSubjectSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { name, subjectCode, schoolLevel } = validatedFields.data;
    const firestore = admin.firestore();

    const existingSubjectQuery = await firestore.collection('subjects')
      .where('name', '==', name)
      .where('schoolLevel', '==', schoolLevel)
      .get();
      
    if (!existingSubjectQuery.empty) {
      return { success: false, message: `The subject "${name}" already exists for ${schoolLevel}.` };
    }

    const subjectData: { name: string; schoolLevel: string; subjectCode?: string } = {
      name,
      schoolLevel,
    };

    if (subjectCode) {
      subjectData.subjectCode = subjectCode;
    }

    await firestore.collection('subjects').add(subjectData);

    revalidatePath('/super-admin/subjects');
    return { success: true, message: 'Subject created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during subject creation process:', error);
    return { success: false, message: 'An unexpected error occurred while creating the subject.' };
  }
}
