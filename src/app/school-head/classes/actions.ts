
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

const createClassSchema = z.object({
  schoolId: z.string().min(1),
  gradeLevel: z.string().min(1, 'Grade Level is required'),
  stream: z.string().max(5, 'Stream is too long').optional(),
  academicYear: z.string().min(4, 'Academic Year is required'),
});

type CreateClassInput = z.infer<typeof createClassSchema>;

export async function createClass(values: CreateClassInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = createClassSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }

  try {
    const { schoolId, gradeLevel, stream, academicYear } = validatedFields.data;
    const firestore = admin.firestore();
    
    const streamUpper = stream?.toUpperCase() || '';
    const className = stream ? `${gradeLevel} ${streamUpper}`.trim() : gradeLevel;
    
    const classData = {
      name: className,
      gradeLevel,
      stream: streamUpper,
      schoolId,
      academicYear,
    };
    
    const classesRef = firestore.collection('schools').doc(schoolId).collection('classes');

    // Generate a predictable document ID
    const docId = `${gradeLevel}-${streamUpper}-${academicYear}`.replace(/\s+/g, '-').toLowerCase();
    const newClassRef = classesRef.doc(docId);

    const existingDoc = await newClassRef.get();
    if (existingDoc.exists) {
        return { success: false, message: `Class "${className}" for ${academicYear} already exists.` };
    }

    await newClassRef.set(classData);
    
    revalidatePath('/school-head/classes');
    return { success: true, message: 'Class created successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during class creation process:', error);
    return { success: false, message: 'An unexpected error occurred while creating the class.' };
  }
}

const assignTeacherSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  teacherId: z.string(),
});

type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;

export async function assignTeacherToClass(values: AssignTeacherInput): Promise<{ success: boolean; message: string }> {
  const validatedFields = assignTeacherSchema.safeParse(values);

  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.' };
  }
  
  try {
    const { schoolId, classId, teacherId } = validatedFields.data;
    const firestore = admin.firestore();

    const classRef = firestore.collection('schools').doc(schoolId).collection('classes').doc(classId);

    if (teacherId === 'unassign') {
      await classRef.update({ teacherId: null });
       revalidatePath('/school-head/classes');
      return { success: true, message: 'Teacher unassigned successfully.' };
    }


    await classRef.update({ teacherId });
    
    revalidatePath('/school-head/classes');
    return { success: true, message: 'Teacher assigned successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION] ❌ Error during teacher assignment:', error);
    return { success: false, message: 'An unexpected error occurred while assigning the teacher.' };
  }
}
