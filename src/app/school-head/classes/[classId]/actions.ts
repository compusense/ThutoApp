
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';

const addStudentsSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  studentIds: z.array(z.string()), // These are the student document IDs from the schools/{schoolId}/students collection
});

export async function addStudentsToClass(values: z.infer<typeof addStudentsSchema>) {
  const validatedFields = addStudentsSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, classId, studentIds } = validatedFields.data;
  const db = admin.firestore();
  
  try {
    const batch = db.batch();
    
    const classRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId);
    const classDoc = await classRef.get();
    if (!classDoc.exists) {
        throw new Error("Class being assigned to does not exist.");
    }
    const className = classDoc.data()?.name;

    for (const studentId of studentIds) {
      const studentSchoolRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId);
      const studentDoc = await studentSchoolRef.get();
      const studentUid = studentDoc.data()?.uid;
      
      // 1. Add student to the class's "students" subcollection.
      const enrollmentRef = classRef.collection('students').doc(studentId);
      batch.set(enrollmentRef, { studentId });
      
      // 2. Update the student's main record with the classId
      batch.set(studentSchoolRef, { classId: classId }, { merge: true });

      // 3. If a user account exists, update its classId and className for their own view
      if (studentUid) {
        const studentUserRef = db.collection('users').doc(studentUid);
        batch.set(studentUserRef, { 
            classId: classId,
            className: className,
        }, { merge: true });
      }
    }

    await batch.commit();

    revalidatePath(`/school-head/classes/${classId}`);
    revalidatePath('/school-head/students');
    return { success: true, message: 'Students added successfully.' };
  } catch (error) {
    console.error('Error adding students to class:', error);
    return { success: false, message: 'Failed to add students.' };
  }
}

const removeStudentSchema = z.object({
    schoolId: z.string(),
    classId: z.string(),
    studentId: z.string(), // This is the student document ID
});

export async function removeStudentFromClass(values: z.infer<typeof removeStudentSchema>) {
    const validatedFields = removeStudentSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input' };
    }

    const { schoolId, classId, studentId } = validatedFields.data;
    const db = admin.firestore();
    
    try {
        const batch = db.batch();
        
        const studentSchoolRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId);
        const studentDoc = await studentSchoolRef.get();
        const studentUid = studentDoc.data()?.uid;

        // 1. Remove student from the class subcollection
        const enrollmentRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').doc(studentId);
        batch.delete(enrollmentRef);

        // 2. Remove the classId from the student's main record
        batch.update(studentSchoolRef, { classId: firestore.FieldValue.delete() });

        // 3. If a user account exists, clear its class details
        if (studentUid) {
            const studentUserRef = db.collection('users').doc(studentUid);
            batch.set(studentUserRef, { 
                classId: firestore.FieldValue.delete(),
                className: firestore.FieldValue.delete(),
            }, { merge: true });
        }
        
        await batch.commit();
        
        revalidatePath(`/school-head/classes/${classId}`);
        revalidatePath('/school-head/students');
        return { success: true, message: 'Student removed from class.' };
    } catch (error) {
        console.error('Error removing student from class:', error);
        return { success: false, message: 'Failed to remove student.' };
    }
}
