
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
  session1_time: z.string(),
  session1_subjectId: z.string(),
  session1_comments: z.string().optional(),
  session2_time: z.string(),
  session2_subjectId: z.string(),
  session2_comments: z.string().optional(),
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
    fileUrl: z.string().url(),
    fileName: z.string(),
});

// New schema for server-side upload
const serverUploadExamMaterialSchema = z.object({
  academicYear: z.string(),
  term: z.string(),
  schoolLevel: z.string(),
  gradeLevel: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileContent: z.string(), // Base64 encoded file content
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
        
        const { academicYear, term, schoolLevel, fileUrl, fileName } = validatedFields.data;
        
        const newTimetable = {
            subRegionId: decodedToken.subRegionId,
            academicYear,
            term,
            schoolLevel,
            status: 'published' as const,
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            type: 'file' as const,
            fileUrl,
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
        
        const { academicYear, term, schoolLevel, gradeLevel, fileName, fileType, fileContent } = validatedFields.data;
        
        // --- Server-side Upload Logic ---
        const bucket = getStorage().bucket("thutodatabase.appspot.com");
        const filePath = `exam-materials/${subRegionId}/${academicYear}-${term}/${gradeLevel}-${fileName}`;
        const file = bucket.file(filePath);

        const buffer = Buffer.from(fileContent, 'base64');
        
        await file.save(buffer, {
            metadata: {
                contentType: fileType,
            },
        });
        
        const [downloadURL] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491' // A long time in the future
        });
        // --- End Server-side Upload Logic ---
        
        const newMaterial = {
            subRegionId,
            academicYear,
            term,
            schoolLevel,
            gradeLevel,
            fileUrl: downloadURL,
            fileName,
            fileType,
            fileSize: buffer.length,
            uploadedAt: new Date().toISOString(),
            uploadedBy: uid,
        };

        const materialRef = await admin.firestore().collection('examMaterials').add(newMaterial);
        
        // Notify schools. We create or update a single notification document per period.
        const db = admin.firestore();
        const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
        if (schoolsSnap.empty) return { success: true, message: "Exam published, but no schools to notify." };

        const batch = db.batch();
        const title = `${gradeLevel} ${term} Exam Paper`;

        schoolsSnap.docs.forEach(schoolDoc => {
            const notificationRef = schoolDoc.ref.collection('notifications').doc(); // Use auto-id
            batch.set(notificationRef, {
                type: 'material',
                referenceId: materialRef.id, // Can be used to group materials if needed
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
