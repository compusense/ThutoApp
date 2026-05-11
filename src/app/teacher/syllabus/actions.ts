
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';

const createNoteSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdBy: z.string(),
  classId: z.string(),
  schoolId: z.string(),
  subjectId: z.string(),
});

export async function createNoteFromTopic(values: z.infer<typeof createNoteSchema>, idToken: string): Promise<{ success: boolean; message: string; noteId?: string; }> {
  const validatedFields = createNoteSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid note data.' };
  }

  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }
  
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    if (decodedToken.uid !== values.createdBy) {
        return { success: false, message: 'Permission denied.' };
    }

    const newNote = {
      ...validatedFields.data,
      createdAt: new Date().toISOString(),
    };

    const docRef = await admin.firestore().collection('notes').add(newNote);
    
    // We don't revalidate here as it's a new page.
    
    return { success: true, message: 'Note created successfully.', noteId: docRef.id };
  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] createNoteFromTopic:', error);
    return { success: false, message: error.message || 'An unknown error occurred.' };
  }
}

