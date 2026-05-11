
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';
import { revalidatePath } from 'next/cache';

// -------- Get Student's Mark History --------
const getHistorySchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
});

export interface AssessmentRecord {
    academicYear: string;
    term: string;
    assessment: string;
    className: string;
}

export async function getStudentMarksHistory(values: z.infer<typeof getHistorySchema>): Promise<{ success: boolean; message: string; data: AssessmentRecord[] | null; }> {
  const validatedFields = getHistorySchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.', data: null };
  }
  const { schoolId, studentId } = validatedFields.data;
  const db = admin.firestore();

  try {
    const marksQuery = db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks');
    const marksSnap = await marksQuery.get();

    if (marksSnap.empty) {
        return { success: true, message: "No marks found for this student.", data: [] };
    }

    const classCache = new Map<string, string>();
    const uniqueAssessments = new Map<string, AssessmentRecord>();

    for (const doc of marksSnap.docs) {
        const mark = doc.data();
        const { academicYear, term, assessment, classId } = mark;
        const key = `${academicYear}-${term}-${assessment}-${classId}`;

        if (!uniqueAssessments.has(key)) {
            let className = classCache.get(classId);
            if (!className) {
                const classSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).get();
                className = classSnap.exists ? classSnap.data()?.name : 'Unknown/Deleted Class';
                classCache.set(classId, className);
            }
            
            uniqueAssessments.set(key, {
                academicYear,
                term,
                assessment,
                className,
            });
        }
    }
    
    const records = Array.from(uniqueAssessments.values()).sort((a, b) => 
        b.academicYear.localeCompare(a.academicYear) || a.term.localeCompare(b.term)
    );

    return { success: true, message: "History fetched.", data: records };
  } catch (error: any) {
    console.error("Error fetching student marks history:", error);
    return { success: false, message: error.message, data: null };
  }
}


// -------- Delete Marks for a Specific Assessment --------
const deleteMarksSchema = z.object({
  schoolId: z.string(),
  studentId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

export async function deleteStudentAssessmentMarks(values: z.infer<typeof deleteMarksSchema>): Promise<{ success: boolean; message: string; }> {
    const validatedFields = deleteMarksSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input.' };
    }

    const { schoolId, studentId, academicYear, term, assessment } = validatedFields.data;
    const db = admin.firestore();

    try {
        const marksQuery = db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment);
        
        const snapshot = await marksQuery.get();
        if (snapshot.empty) {
            return { success: false, message: "No marks found for the specified assessment to delete." };
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        revalidatePath(`/school-head/students/${studentId}/marks`);
        return { success: true, message: `Successfully deleted marks for ${assessment}.` };

    } catch (error: any) {
        console.error("Error deleting student marks:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}
