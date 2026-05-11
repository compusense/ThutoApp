'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';
import { getStorage } from 'firebase-admin/storage';

// Schema for a single row in the structured timetable
const scheduleItemSchema = z.object({
  id: z.string(),
  date: z.date(),
  session1_time: z.string().optional(),
  session1_subjectId: z.string().optional(),
  session1_subjectId2: z.string().optional(),
  session1_subject1_comments: z.string().optional(),
  session1_subject2_comments: z.string().optional(),
  session2_time: z.string().optional(),
  session2_subjectId: z.string().optional(),
  session2_subjectId2: z.string().optional(),
  session2_subject1_comments: z.string().optional(),
  session2_subject2_comments: z.string().optional(),
}).superRefine((data, ctx) => {
    // A row is valid if at least one subject is selected for the day.
    if (!data.session1_subjectId && !data.session1_subjectId2 && !data.session2_subjectId && !data.session2_subjectId2) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each row must have at least one subject.",
            path: ['session1_subjectId'],
        });
        return;
    }
    // If a subject is selected, its time must be provided.
    if ((data.session1_subjectId || data.session1_subjectId2) && !data.session1_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time is required for Session 1.", path: ['session1_time'] });
    }
    if ((data.session2_subjectId || data.session2_subjectId2) && !data.session2_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time is required for Session 2.", path: ['session2_time'] });
    }
});

// Schema for creating a structured timetable
const structuredTimetableSchema = z.object({
  academicYear: z.string(),
  term: z.string(),
  schoolLevel: z.string(),
  schedule: z.array(scheduleItemSchema).min(1, 'Timetable must have at least one entry.'),
});

// Schema for creating a file-based timetable
const fileTimetableSchema = z.object({
    academicYear: z.string(),
    term: z.string(),
    schoolLevel: z.string(),
    filePath: z.string(), // Use internal storage path
    fileName: z.string(),
});

// New schema for server-side upload. No longer sends file content.
const serverUploadExamMaterialSchema = z.object({
  academicYear: z.string(),
  term: z.string(),
  schoolLevel: z.string(),
  gradeLevel: z.string(),
  fileName: z.string(),
  filePath: z.string(), // We now pass the storage path
});


const verifyToken = async (idToken: string) => {
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        throw new Error("Authentication required.");
    }
}

async function createTimetableNotification(timetableId: string, subRegionId: string, title: string) {
    const db = admin.firestore();
    const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
    
    if (schoolsSnap.empty) return;

    const batch = db.batch();
    const notification = {
        type: 'timetable' as const,
        referenceId: timetableId,
        subRegionId,
        publishedAt: new Date().toISOString(),
        isRead: false,
        title,
    };

    schoolsSnap.docs.forEach(schoolDoc => {
        const notificationRef = schoolDoc.ref.collection('notifications').doc();
        batch.set(notificationRef, notification);
    });

    await batch.commit();
}


export async function createStructuredTimetable(values: z.infer<typeof structuredTimetableSchema>, idToken: string) {
    const validatedFields = structuredTimetableSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: "Invalid data provided." };
    }
    
    try {
        const decodedToken = await verifyToken(idToken);
        if (decodedToken.role !== 'sub-region-admin' || !decodedToken.subRegionId) {
            return { success: false, message: 'Permission denied.' };
        }
        
        const { academicYear, term, schoolLevel, schedule } = validatedFields.data;
        
        const newTimetable = {
            subRegionId: decodedToken.subRegionId,
            academicYear,
            term,
            schoolLevel,
            status: 'published' as const,
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            type: 'structured' as const,
            schedule: schedule.map(item => ({
                ...item,
                date: item.date.toISOString(),
                // Ensure optional fields are not present if they are 'none'
                session1_subjectId2: item.session1_subjectId2 === 'none' ? undefined : item.session1_subjectId2,
                session2_subjectId2: item.session2_subjectId2 === 'none' ? undefined : item.session2_subjectId2,
            })),
        };

        const timetableRef = await admin.firestore().collection('examTimetables').add(newTimetable);
        const title = `${term} Timetable (${schoolLevel}) - ${academicYear}`;
        await createTimetableNotification(timetableRef.id, decodedToken.subRegionId, title);

        revalidatePath('/sub-region-admin/exam-management');
        return { success: true, message: "Timetable published successfully." };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] createStructuredTimetable:', e);
        return { success: false, message: e.message || "An unknown error occurred." };
    }
}


export async function createFileTimetable(values: z.infer<typeof fileTimetableSchema>, idToken: string) {
     const validatedFields = fileTimetableSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: "Invalid data provided." };
    }
    
    try {
        const decodedToken = await verifyToken(idToken);
        if (decodedToken.role !== 'sub-region-admin' || !decodedToken.subRegionId) {
            return { success: false, message: 'Permission denied.' };
        }
        
        const { academicYear, term, schoolLevel, filePath, fileName } = validatedFields.data;
        
        const newTimetable = {
            subRegionId: decodedToken.subRegionId,
            academicYear,
            term,
            schoolLevel,
            status: 'published' as const,
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            type: 'file' as const,
            fileUrl: filePath, // We store the internal path here
            fileName,
        };

        const timetableRef = await admin.firestore().collection('examTimetables').add(newTimetable);
        const title = `${term} Timetable (${schoolLevel}) - ${academicYear}`;
        await createTimetableNotification(timetableRef.id, decodedToken.subRegionId, title);

        revalidatePath('/sub-region-admin/exam-management');
        return { success: true, message: "Timetable published successfully." };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] createFileTimetable:', e);
        return { success: false, message: e.message || "An unknown error occurred." };
    }
}


export async function uploadExamMaterial(values: z.infer<typeof serverUploadExamMaterialSchema>, idToken: string) {
    const validatedFields = serverUploadExamMaterialSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: "Invalid data provided." };
    }
    
    try {
        const decodedToken = await verifyToken(idToken);
        const uid = decodedToken.uid;
        const subRegionId = decodedToken.subRegionId;

        if (decodedToken.role !== 'sub-region-admin' || !subRegionId) {
            return { success: false, message: 'Permission denied.' };
        }
        
        const { academicYear, term, schoolLevel, gradeLevel, fileName, filePath } = validatedFields.data;
        
        const newMaterial = {
            subRegionId,
            academicYear,
            term,
            schoolLevel,
            gradeLevel,
            fileUrl: filePath, // Use the path from the client
            fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: uid,
        };

        const materialRef = await admin.firestore().collection('examMaterials').add(newMaterial);
        
        const db = admin.firestore();
        const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
        if (schoolsSnap.empty) return { success: true, message: "Exam published, but no schools to notify." };

        const batch = db.batch();
        const title = `${gradeLevel} ${term} Exam Paper`;

        schoolsSnap.docs.forEach(schoolDoc => {
            const notificationRef = schoolDoc.ref.collection('notifications').doc();
            batch.set(notificationRef, {
                type: 'material',
                referenceId: materialRef.id,
                subRegionId,
                publishedAt: new Date().toISOString(),
                isRead: false,
                title,
            });
        });

        await batch.commit();

        revalidatePath('/sub-region-admin/exam-management');
        return { success: true, message: `Successfully uploaded ${fileName}` };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] uploadExamMaterial:', e);
        return { success: false, message: e.message || "An unknown error occurred." };
    }
}

export async function deleteTimetable(timetableId: string, idToken: string) {
    if (!idToken) {
        return { success: false, message: 'Authentication required.' };
    }
    try {
        const decodedToken = await verifyToken(idToken);
        const { uid, subRegionId } = decodedToken;
        
        const db = admin.firestore();
        const timetableRef = db.collection('examTimetables').doc(timetableId);
        const timetableDoc = await timetableRef.get();

        if (!timetableDoc.exists) {
            return { success: false, message: 'Timetable not found.' };
        }
        
        // Security check: ensure the user deleting it created it by checking the subRegionId.
        if (timetableDoc.data()?.subRegionId !== subRegionId) {
            return { success: false, message: 'Permission denied.' };
        }

        const batch = db.batch();
        
        // 1. Delete the main timetable document
        batch.delete(timetableRef);

        // 2. Find and delete all notifications related to this timetable
        const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
        for (const schoolDoc of schoolsSnap.docs) {
            const notificationsQuery = schoolDoc.ref.collection('notifications').where('referenceId', '==', timetableId);
            const notificationsSnap = await notificationsQuery.get();
            notificationsSnap.forEach(notificationDoc => {
                batch.delete(notificationDoc.ref);
            });
        }
        
        await batch.commit();

        revalidatePath('/sub-region-admin/exam-management');
        return { success: true, message: 'Timetable and all related notifications have been deleted.' };
    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] deleteTimetable:', e);
        return { success: false, message: e.message || "An unknown error occurred." };
    }
}