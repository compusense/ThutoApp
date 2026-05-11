'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from 'firebase-admin';

const getClassDetailsSchema = z.object({
  classId: z.string(),
});

export interface Assignment {
    id: string;
    type: 'note' | 'quiz';
    noteId: string;
    quizId?: string;
    title: string;
    href?: string; // Add href for direct navigation
}

export async function getStudentClassDetails(values: z.infer<typeof getClassDetailsSchema>, idToken: string) {
  const validatedFields = getClassDetailsSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input.', data: null };
  }
  
  const { classId } = validatedFields.data;
  console.log(`[ACTION LOG] getStudentClassDetails called for classId: ${classId}`);


  if (!idToken) {
    return { success: false, message: 'Authentication required.', data: null };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, schoolId } = decodedToken;
    console.log(`[ACTION LOG] Decoded token for uid: ${uid}, schoolId: ${schoolId}`);


    // Use the uid from the token to find the student's document ID
    const studentQuery = await admin.firestore().collection('schools').doc(schoolId).collection('students').where('uid', '==', uid).limit(1).get();

    if (studentQuery.empty) {
        console.error(`[ACTION ERROR] Student record not found in school '${schoolId}' for uid '${uid}'.`);
        throw new Error("Student record not found in the school's registry.");
    }
    const studentId = studentQuery.docs[0].id;
    console.log(`[ACTION LOG] Found student document ID: ${studentId}`);

    
    // Security Check: Verify student is enrolled in the class they are requesting.
    const enrollmentRef = admin.firestore().collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').doc(studentId);
    const enrollmentSnap = await enrollmentRef.get();
    if (!enrollmentSnap.exists) {
        console.error(`[ACTION ERROR] Permission Denied: Student ${studentId} is not enrolled in class ${classId}.`);
        throw new Error("Permission denied: You are not enrolled in this class.");
    }
    
    const db = admin.firestore();

    // Fetch Subjects with chunking to handle 'in' limit (30)
    const currentYear = new Date().getFullYear().toString();
    const subjectsQuery = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects').where('academicYear', '==', currentYear);
    const subjectsSnap = await subjectsQuery.get();
    const subjectIds = subjectsSnap.docs.map(d => d.data().subjectId);
    
    let subjects: any[] = [];
    if (subjectIds.length > 0) {
        const subjectChunks = [];
        for (let i = 0; i < subjectIds.length; i += 30) {
            subjectChunks.push(subjectIds.slice(i, i + 30));
        }

        for (const chunk of subjectChunks) {
            const masterSubjectsQuery = db.collection('subjects').where(firestore.FieldPath.documentId(), 'in', chunk);
            const masterSnap = await masterSubjectsQuery.get();
            subjects.push(...masterSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        subjects.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    }
    console.log(`[ACTION LOG] Found ${subjects.length} subjects for the class.`);


    // Fetch Classmates' public profiles with chunking
    const classmatesSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').get();
    const classmateStudentIds = classmatesSnap.docs.map(d => d.id);

    let classmates: any[] = [];
    if (classmateStudentIds.length > 0) {
      const studentChunks = [];
      for (let i = 0; i < classmateStudentIds.length; i += 30) {
          studentChunks.push(classmateStudentIds.slice(i, i + 30));
      }

      for (const chunk of studentChunks) {
          const schoolStudentsSnap = await db.collection('schools').doc(schoolId).collection('students')
            .where(firestore.FieldPath.documentId(), 'in', chunk)
            .get();

          classmates.push(...schoolStudentsSnap.docs
            .map(doc => {
              const data = doc.data();
              if (!data.firstName || !data.surname) return null; // Safety
              return {
                id: doc.id, // Always unique
                fullName: `${data.firstName.trim()} ${data.surname.trim()}`,
                uid: data.uid || doc.id, // Fallback if uid missing
              };
            })
            .filter(Boolean));
      }
      classmates = classmates
        .filter((student: any) => student.uid !== uid) // Exclude current user
        .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
    }
     console.log(`[ACTION LOG] Found ${classmates.length} classmates.`);


    // Fetch Assignments
    console.log(`[ACTION LOG] Querying assignments at: /schools/${schoolId}/classes/${classId}/assignments`);
    const assignmentsQuery = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('assignments');
    const assignmentsSnap = await assignmentsQuery.get();
    console.log(`[ACTION LOG] Found ${assignmentsSnap.size} assignment documents.`);

    const assignments: Assignment[] = [];
    for (const doc of assignmentsSnap.docs) {
        const assignmentData = doc.data();
        console.log(`[ACTION LOG] Processing assignment ${doc.id}, noteId: ${assignmentData.noteId}`);
        const noteDoc = await db.collection('notes').doc(assignmentData.noteId).get();
        if (noteDoc.exists) {
            assignments.push({
                id: doc.id,
                type: assignmentData.type,
                noteId: assignmentData.noteId,
                quizId: assignmentData.quizId,
                title: noteDoc.data()?.title || 'Untitled',
                href: assignmentData.type === 'quiz' && assignmentData.quizId
                    ? `/student/notes/${assignmentData.noteId}/quizzes/${assignmentData.quizId}`
                    : `/student/notes/${assignmentData.noteId}`
            });
        } else {
             console.warn(`[ACTION WARN] Note document ${assignmentData.noteId} not found for assignment ${doc.id}`);
        }
    }
    assignments.sort((a, b) => a.title.localeCompare(b.title));
     console.log(`[ACTION LOG] Processed ${assignments.length} valid assignments.`);


    return {
      success: true,
      message: 'Data fetched successfully.',
      data: {
        subjects,
        classmates,
        assignments,
      },
    };

  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] getStudentClassDetails:', error);
    return { success: false, message: error.message || 'An unknown error occurred.', data: null };
  }
}