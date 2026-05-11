
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';
import { generateNoteFromObjectives } from '@/ai/flows/generate-note-from-objectives';
import { generateQuizFromNote as generateQuizFlow } from '@/ai/flows/generate-quiz-from-note';

const createNoteSchema = z.object({
  title: z.string(),
  content: z.string(),
  createdBy: z.string(),
  classId: z.string(),
  schoolId: z.string(),
  subjectId: z.string(),
});

export async function createNoteFromTopic(values: z.infer<typeof createNoteSchema>, idToken: string): Promise<{ success: boolean; message: string; noteId?: string; }> {
  console.log('[ACTION LOG] createNoteFromTopic called with:', values);
  const validatedFields = createNoteSchema.safeParse(values);
  if (!validatedFields.success) {
    console.error('[ACTION ERROR] Invalid data for createNoteFromTopic:', validatedFields.error);
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
    console.log('[ACTION LOG] Saving new note to Firestore:', newNote);

    const docRef = await admin.firestore().collection('notes').add(newNote);
    console.log(`[ACTION LOG] Note created with ID: ${docRef.id}`);
    
    revalidatePath('/teacher/notes');
    
    return { success: true, message: 'Note created successfully.', noteId: docRef.id };
  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] createNoteFromTopic:', error);
    return { success: false, message: error.message || 'An unknown error occurred.' };
  }
}

const updateNoteSchema = z.object({
    noteId: z.string(),
    title: z.string().min(1, "Title cannot be empty."),
    content: z.string(),
});

export async function updateNote(values: z.infer<typeof updateNoteSchema>, idToken: string): Promise<{ success: boolean; message: string; }> {
    const validatedFields = updateNoteSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid note data.' };
    }

    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { noteId, title, content } = validatedFields.data;

        const noteRef = admin.firestore().collection('notes').doc(noteId);
        const noteDoc = await noteRef.get();

        if (!noteDoc.exists) {
            return { success: false, message: "Note not found." };
        }

        if (noteDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: "You do not have permission to edit this note." };
        }

        await noteRef.update({ title, content, lastEdited: new Date().toISOString() });

        revalidatePath(`/teacher/notes/${noteId}`);
        revalidatePath('/teacher/notes');

        return { success: true, message: "Note updated." };

    } catch (error: any) {
        console.error('[SERVER ACTION ERROR] updateNote:', error);
        return { success: false, message: error.message || 'An unknown error occurred.' };
    }
}

export async function deleteNote(noteId: string, idToken: string): Promise<{ success: boolean; message: string }> {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }
    
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const noteRef = admin.firestore().collection('notes').doc(noteId);
        const noteDoc = await noteRef.get();

        if (!noteDoc.exists) return { success: false, message: "Note not found." };
        if (noteDoc.data()?.createdBy !== decodedToken.uid) return { success: false, message: "Permission denied." };
        
        await noteRef.delete();

        revalidatePath('/teacher/notes');
        return { success: true, message: 'Note deleted.' };
    } catch(e: any) {
        console.error('[SERVER ACTION ERROR] deleteNote:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}

const GenerateNoteInputSchema = z.object({
  topic: z.string().describe("The main topic of the lesson note, e.g., 'Fractions'."),
  objectives: z.string().describe("A list of learning objectives, likely in markdown bullet points, that the lesson note should cover."),
});


export async function generateAINote(values: z.infer<typeof GenerateNoteInputSchema>): Promise<{ success: boolean; message: string; noteContent?: string; }> {
    try {
        const result = await generateNoteFromObjectives(values);
        return { success: true, message: 'Note generated successfully.', noteContent: result.noteContent };
    } catch (error: any) {
        console.error('[SERVER ACTION ERROR] generateAINote:', error);
        if (typeof error.message === 'string' && (error.message.includes('503') || error.message.toLowerCase().includes('unavailable') || error.message.toLowerCase().includes('overloaded'))) {
            return { success: false, message: 'The AI service is temporarily overloaded. Please try again in a few moments.' };
        }
        return { success: false, message: error.message || 'Failed to generate AI note.' };
    }
}


const generateQuizSchema = z.object({
    noteId: z.string(),
    title: z.string(),
    content: z.string(),
});

export async function generateAndSaveQuiz(values: z.infer<typeof generateQuizSchema>, idToken: string): Promise<{ success: boolean; message: string; quizId?: string }> {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { noteId, title, content } = values;

        // Security check
        const noteRef = admin.firestore().collection('notes').doc(noteId);
        const noteDoc = await noteRef.get();
        if (!noteDoc.exists || noteDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: 'Permission denied.' };
        }

        const quizData = await generateQuizFlow({ title, content });

        const quizDoc = {
            ...quizData,
            noteId,
            createdBy: decodedToken.uid,
            createdAt: new Date().toISOString(),
        };

        const quizRef = await noteRef.collection('quizzes').add(quizDoc);

        return { success: true, message: 'Quiz generated successfully!', quizId: quizRef.id };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] generateAndSaveQuiz:', e);
        return { success: false, message: e.message || 'An unknown error occurred while generating the quiz.' };
    }
}

const quizQuestionSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  type: z.enum(['multiple-choice', 'true-false']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, "A correct answer must be selected"),
});

const updateQuizSchema = z.object({
  noteId: z.string(),
  quizId: z.string(),
  title: z.string().min(1, "Title cannot be empty"),
  questions: z.array(quizQuestionSchema).min(1, "Quiz must have at least one question."),
});

export async function updateQuiz(values: z.infer<typeof updateQuizSchema>, idToken: string): Promise<{ success: boolean; message: string }> {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  const validatedFields = updateQuizSchema.safeParse(values);
  if (!validatedFields.success) {
    console.error('Update quiz validation error:', validatedFields.error.flatten().fieldErrors);
    return { success: false, message: 'Invalid quiz data.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { noteId, quizId, title, questions } = validatedFields.data;

    const quizRef = admin.firestore().collection('notes').doc(noteId).collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists || quizDoc.data()?.createdBy !== decodedToken.uid) {
      return { success: false, message: "Permission denied." };
    }

    await quizRef.update({ title, questions, lastEdited: new Date().toISOString() });

    revalidatePath(`/teacher/notes/${noteId}/quizzes/${quizId}`);
    return { success: true, message: 'Quiz updated successfully.' };

  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] updateQuiz:', error);
    return { success: false, message: error.message || 'Failed to update quiz.' };
  }
}

export async function deleteQuiz(noteId: string, quizId: string, idToken: string): Promise<{ success: boolean; message: string }> {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const quizRef = admin.firestore().collection('notes').doc(noteId).collection('quizzes').doc(quizId);
    const quizDoc = await quizRef.get();

    if (!quizDoc.exists || quizDoc.data()?.createdBy !== decodedToken.uid) {
      return { success: false, message: "Permission denied." };
    }

    await quizRef.delete();
    
    revalidatePath(`/teacher/notes/${noteId}`);
    return { success: true, message: 'Quiz deleted successfully.' };
  } catch (error: any) {
    console.error('[SERVER ACTION ERROR] deleteQuiz:', error);
    return { success: false, message: e.message || 'An unknown error occurred.' };
  }
}

const assignQuizSchema = z.object({
    noteId: z.string(),
    quizId: z.string(),
    classId: z.string(),
});

export async function assignQuizToClass(values: z.infer<typeof assignQuizSchema>, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { noteId, quizId, classId } = values;

        const noteRef = admin.firestore().collection('notes').doc(noteId);
        const noteDoc = await noteRef.get();
        if (!noteDoc.exists || noteDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: "Permission denied for this note." };
        }
        
        if (noteDoc.data()?.classId !== classId) {
             return { success: false, message: "This note does not belong to the target class." };
        }

        const assignment = {
            type: 'quiz',
            noteId,
            quizId,
            classId,
            assignedBy: decodedToken.uid,
            assignedAt: new Date().toISOString(),
        };

        await admin.firestore().collection('assignments').add(assignment);
        
        return { success: true, message: "Quiz assigned." };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] assignQuizToClass:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}

const assignNoteSchema = z.object({
  noteId: z.string(),
  classId: z.string(),
});

export async function assignNoteToClass(values: z.infer<typeof assignNoteSchema>, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { noteId, classId } = values;

        const noteRef = admin.firestore().collection('notes').doc(noteId);
        const noteDoc = await noteRef.get();
        if (!noteDoc.exists || noteDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: "Permission denied for this note." };
        }
        
        if (noteDoc.data()?.classId !== classId) {
             return { success: false, message: "This note does not belong to the target class." };
        }

        const assignment = {
            type: 'note',
            noteId,
            classId,
            assignedBy: decodedToken.uid,
            assignedAt: new Date().toISOString(),
        };

        await admin.firestore().collection('assignments').add(assignment);
        
        return { success: true, message: "Note assigned." };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] assignNoteToClass:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}

export async function getAssignmentsForClass(classId: string, idToken: string) {
  if (!idToken) {
    return { success: false, message: 'Authentication required.', data: null };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);

    const q = admin.firestore().collection('assignments').where('classId', '==', classId).where('assignedBy', '==', decodedToken.uid);
    const snap = await q.get();

    if (snap.empty) {
      return { success: true, message: 'No assignments found', data: [] };
    }

    const assignments = await Promise.all(snap.docs.map(async (doc) => {
      const data = doc.data();
      let title = "Untitled";

      if (data.type === 'note') {
        const noteDoc = await admin.firestore().collection('notes').doc(data.noteId).get();
        if (noteDoc.exists) title = noteDoc.data()?.title;
      } else if (data.type === 'quiz') {
        const quizDoc = await admin.firestore().collection('notes').doc(data.noteId).collection('quizzes').doc(data.quizId).get();
        if (quizDoc.exists) title = `${quizDoc.data()?.title} Quiz`;
      }
      return { id: doc.id, ...data, title };
    }));

    return { success: true, message: "Assignments fetched", data: assignments };
  } catch (e: any) {
    console.error("[SERVER ACTION ERROR] getAssignmentsForClass:", e);
    return { success: false, message: e.message || 'An unknown error occurred.', data: null };
  }
}

export async function deleteAssignment(assignmentId: string, idToken: string) {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const assignmentRef = admin.firestore().collection('assignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists || assignmentDoc.data()?.assignedBy !== decodedToken.uid) {
      return { success: false, message: 'Permission denied.' };
    }

    await assignmentRef.delete();
    return { success: true, message: 'Assignment taken down.' };
  } catch (e: any) {
    console.error("[SERVER ACTION ERROR] deleteAssignment:", e);
    return { success: false, message: e.message || 'An unknown error occurred.' };
  }
}

const logAccessSchema = z.object({
    materialId: z.string(),
    materialType: z.enum(['note', 'quiz']),
});

export async function logMaterialAccess(values: z.infer<typeof logAccessSchema>, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid, schoolId, classId, name } = decodedToken;
        const { materialId, materialType } = values;

        // Use a consistent ID to prevent creating multiple log entries for the same student/material view in a short time.
        // This is a simple form of debouncing on the server. We'll make it unique per day.
        const today = new Date().toISOString().split('T')[0];
        const logId = `${uid}-${materialId}-${today}`;

        const logRef = admin.firestore().collection('accessLogs').doc(logId);

        await logRef.set({
            studentId: uid,
            studentName: name,
            schoolId,
            classId,
            materialId,
            materialType,
            accessedAt: new Date().toISOString(),
        }, { merge: true }); // Use set with merge to create or update the daily log

        return { success: true, message: 'Access logged.' };
    } catch(e: any) {
        console.error('[SERVER ACTION ERROR] logMaterialAccess:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}


export async function getNoteAccessLogs(noteId: string, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.', data: null };
    }
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const noteDoc = await admin.firestore().collection('notes').doc(noteId).get();

        if(!noteDoc.exists || noteDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: 'Permission denied.', data: null };
        }
        
        const logsSnap = await admin.firestore().collection('accessLogs')
            .where('materialId', '==', noteId)
            .where('materialType', '==', 'note')
            .get();

        if (logsSnap.empty) {
            return { success: true, message: 'No logs found.', data: [] };
        }
        
        const logs = logsSnap.docs.map(doc => doc.data());
        // Sort in code instead of in the query to avoid needing an index
        logs.sort((a,b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());

        return { success: true, message: 'Logs fetched.', data: logs };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] getNoteAccessLogs:', e);
        return { success: false, message: e.message || 'An unknown error occurred.', data: null };
    }
}


const quizAttemptSchema = z.object({
  quizId: z.string(),
  noteId: z.string(),
  score: z.number(),
  totalQuestions: z.number(),
  percentage: z.number(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  answers: z.array(z.object({
    question: z.string(),
    selectedAnswer: z.string(),
    correctAnswer: z.string(),
    isCorrect: z.boolean(),
  })),
});

export async function saveQuizAttempt(values: z.infer<typeof quizAttemptSchema>, idToken: string) {
    const validatedFields = quizAttemptSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data.' };
    }
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const { uid, schoolId, classId, name } = decodedToken;

        const attemptData = {
            ...validatedFields.data,
            studentId: uid,
            studentName: name,
            schoolId,
            classId,
        };

        const attemptRef = admin.firestore().collection('notes').doc(validatedFields.data.noteId).collection('quizzes').doc(validatedFields.data.quizId).collection('quizAttempts').doc();
        await attemptRef.set(attemptData);

        return { success: true, message: 'Quiz attempt saved.' };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] saveQuizAttempt:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}

export async function getQuizAttempts(noteId: string, quizId: string, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.', data: null };
    }
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);

        const quizRef = admin.firestore().collection('notes').doc(noteId).collection('quizzes').doc(quizId);
        const quizDoc = await quizRef.get();

        if (!quizDoc.exists || quizDoc.data()?.createdBy !== decodedToken.uid) {
            return { success: false, message: 'Permission denied.', data: null };
        }

        const attemptsSnap = await quizRef.collection('quizAttempts').orderBy('completedAt', 'desc').get();

        if (attemptsSnap.empty) {
            return { success: true, message: 'No attempts found.', data: [] };
        }

        // Process to get only the latest attempt for each student
        const latestAttempts = new Map<string, any>();
        attemptsSnap.docs.forEach(doc => {
            const attempt = { id: doc.id, ...doc.data() };
            if (!latestAttempts.has(attempt.studentId)) {
                latestAttempts.set(attempt.studentId, attempt);
            }
        });
        
        const data = Array.from(latestAttempts.values());

        return { success: true, message: 'Attempts fetched.', data };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] getQuizAttempts:', e);
        return { success: false, message: e.message || 'An unknown error occurred.', data: null };
    }
}
