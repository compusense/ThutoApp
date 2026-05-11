
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const invigilationSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  teacherId: z.string(),
  academicYear: z.string(),
  term: z.string(),
});

export async function assignInvigilator(values: z.infer<typeof invigilationSchema>) {
  const validatedFields = invigilationSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, classId, teacherId, academicYear, term } = validatedFields.data;
  const db = admin.firestore();
  const invigilationRef = db.collection('schools').doc(schoolId).collection('invigilations');

  try {
    // Check for existing assignment for the same class and term
    const existingQuery = await invigilationRef
      .where('classId', '==', classId)
      .where('academicYear', '==', academicYear)
      .where('term', '==', term)
      .get();
      
    if (!existingQuery.empty) {
        return { success: false, message: 'An invigilator is already assigned to this class for this term.' };
    }

    await invigilationRef.add({ classId, teacherId, academicYear, term });
    
    revalidatePath('/school-head/invigilation');
    return { success: true, message: 'Invigilator assigned successfully.' };
  } catch (error) {
    console.error('Error assigning invigilator:', error);
    return { success: false, message: 'Failed to assign invigilator.' };
  }
}

const removeInvigilationSchema = z.object({
    schoolId: z.string(),
    invigilationId: z.string(),
});

export async function removeInvigilator(values: z.infer<typeof removeInvigilationSchema>) {
    const validatedFields = removeInvigilationSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }
    
    const { schoolId, invigilationId } = validatedFields.data;
    const db = admin.firestore();

    try {
        await db.collection('schools').doc(schoolId).collection('invigilations').doc(invigilationId).delete();
        revalidatePath('/school-head/invigilation');
        return { success: true, message: 'Assignment removed.' };
    } catch (error) {
        console.error('Error removing invigilator:', error);
        return { success: false, message: 'Failed to remove assignment.' };
    }
}
