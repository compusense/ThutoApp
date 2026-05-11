
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { markAnswerSheet } from '@/ai/flows/mark-answer-sheet-flow';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';

const processBatchSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  subjectId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
  markingKey: z.array(z.object({
    questionNumber: z.number(),
    correctAnswer: z.string(),
  })),
  images: z.array(z.string()), // Base64 strings (data URIs)
});

/**
 * Checks if a user is authorized to enter marks for a class.
 * Authorized if: User is the class teacher OR User is an assigned invigilator for this period.
 */
async function checkMarkingPermission(db: firestore.Firestore, uid: string, schoolId: string, classId: string, year: string, term: string) {
    const classRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId);
    const classDoc = await classRef.get();
    
    if (!classDoc.exists) return false;
    const classData = classDoc.data();

    // Check if primary teacher
    if (classData?.teacherId === uid) return true;

    // Check if authorized invigilator
    const invigQuery = await db.collection('schools').doc(schoolId).collection('invigilations')
        .where('teacherId', '==', uid)
        .where('classId', '==', classId)
        .where('academicYear', '==', year)
        .where('term', '==', term)
        .get();
    
    return !invigQuery.empty;
}

export async function processMarkingBatch(values: z.infer<typeof processBatchSchema>, idToken: string) {
  const validated = processBatchSchema.safeParse(values);
  if (!validated.success) {
    return { success: false, message: 'Invalid batch data.' };
  }

  if (!idToken) return { success: false, message: 'Authentication required.' };

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid } = decodedToken;
    const db = admin.firestore();

    const { images, markingKey, academicYear, term, classId, schoolId, ...sessionData } = validated.data;

    // Security Check
    const isAuthorized = await checkMarkingPermission(db, uid, schoolId, classId, academicYear, term);
    if (!isAuthorized) {
        return { success: false, message: 'You do not have permission to mark for this class/period.' };
    }

    // 1. Create a Marking Session
    const sessionRef = await db.collection('markingSessions').add({
      ...sessionData,
      schoolId,
      classId,
      academicYear,
      term,
      markingKey,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    });

    // 2. Process each image with AI
    const results = [];
    for (const image of images) {
      try {
        const markingResult = await markAnswerSheet({
          photoDataUri: image,
          markingKey,
        });
        results.push({
          ...markingResult,
          status: 'success' as const,
        });
      } catch (error: any) {
        console.error('Error marking individual sheet:', error);
        results.push({
          status: 'error' as const,
          message: error.message || 'Failed to mark this sheet.',
        });
      }
    }

    return { 
      success: true, 
      message: `Processed ${results.length} sheets.`, 
      data: results,
      sessionId: sessionRef.id
    };

  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] processMarkingBatch:', error);
    return { success: false, message: error.message || 'Batch processing failed.' };
  }
}

const saveMarksBatchSchema = z.object({
    schoolId: z.string(),
    classId: z.string(),
    subjectId: z.string(),
    academicYear: z.string(),
    term: z.string(),
    assessment: z.string(),
    results: z.array(z.object({
        studentId: z.string(),
        score: z.number(),
        total: z.number(),
    })),
});

export async function saveScannedMarksToRegistry(values: z.infer<typeof saveMarksBatchSchema>, idToken: string) {
    if (!idToken) return { success: false, message: 'Authentication required.' };

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid } = decodedToken;
        const db = admin.firestore();

        // Security Check
        const isAuthorized = await checkMarkingPermission(db, uid, values.schoolId, values.classId, values.academicYear, values.term);
        if (!isAuthorized) {
            return { success: false, message: 'You do not have permission to save marks for this class/period.' };
        }

        const batch = db.batch();
        const serverTimestamp = firestore.FieldValue.serverTimestamp();

        for (const res of values.results) {
            const markData = {
                schoolId: values.schoolId,
                classId: values.classId,
                studentId: res.studentId,
                subjectId: values.subjectId,
                academicYear: values.academicYear,
                term: values.term,
                assessment: values.assessment,
                score: res.score,
                total: res.total,
                lastModified: serverTimestamp,
                lastModifiedBy: uid,
            };

            const marksQuery = db.collection('schools').doc(values.schoolId).collection('students').doc(res.studentId).collection('marks')
                .where('academicYear', '==', values.academicYear)
                .where('term', '==', values.term)
                .where('assessment', '==', values.assessment)
                .where('subjectId', '==', values.subjectId)
                .limit(1);

            const snapshot = await marksQuery.get();

            if (snapshot.empty) {
                const newMarkRef = db.collection('schools').doc(values.schoolId).collection('students').doc(res.studentId).collection('marks').doc();
                batch.set(newMarkRef, markData);
            } else {
                batch.update(snapshot.docs[0].ref, { 
                    score: markData.score, 
                    total: markData.total, 
                    lastModified: markData.lastModified, 
                    lastModifiedBy: markData.lastModifiedBy 
                });
            }
        }

        await batch.commit();
        revalidatePath(`/teacher/my-classes/${values.classId}/marks`);
        return { success: true, message: 'Marks saved successfully to registry.' };

    } catch (e: any) {
        console.error('Error saving scanned marks:', e);
        return { success: false, message: e.message || 'Failed to save marks.' };
    }
}
