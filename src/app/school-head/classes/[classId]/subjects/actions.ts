
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const addSubjectsSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  subjectIds: z.array(z.string()),
  academicYear: z.string(),
});

export async function addSubjectsToClass(values: z.infer<typeof addSubjectsSchema>) {
  const validatedFields = addSubjectsSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, classId, subjectIds, academicYear } = validatedFields.data;
  const db = admin.firestore();
  const classSubjectsRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects');

  try {
    const batch = db.batch();
    subjectIds.forEach(subjectId => {
      const docRef = classSubjectsRef.doc(); // Auto-generate ID
      batch.set(docRef, { subjectId, academicYear });
    });
    await batch.commit();
    revalidatePath(`/school-head/classes/${classId}/subjects`);
    return { success: true, message: 'Subjects added successfully.' };
  } catch (error) {
    console.error('Error adding subjects to class:', error);
    return { success: false, message: 'Failed to add subjects.' };
  }
}

const removeSubjectSchema = z.object({
    schoolId: z.string(),
    classId: z.string(),
    assignmentId: z.string(),
});

export async function removeSubjectFromClass(values: z.infer<typeof removeSubjectSchema>) {
    const validatedFields = removeSubjectSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }

    const { schoolId, classId, assignmentId } = validatedFields.data;
    const db = admin.firestore();
    
    try {
        await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects').doc(assignmentId).delete();
        revalidatePath(`/school-head/classes/${classId}/subjects`);
        return { success: true, message: 'Subject removed from class.' };
    } catch (error) {
        console.error('Error removing subject from class:', error);
        return { success: false, message: 'Failed to remove subject.' };
    }
}
