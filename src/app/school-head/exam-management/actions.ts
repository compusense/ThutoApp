
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';
import { getStorage } from 'firebase-admin/storage';
import JSZip from 'jszip';

const verifyToken = async (idToken: string) => {
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        throw new Error("Authentication required.");
    }
}

const publishExamsSchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  schoolLevel: z.string(),
  gradeLevel: z.string(),
});

type PublishExamsInput = z.infer<typeof publishExamsSchema>;

export async function publishExamsToTeachers(values: PublishExamsInput, idToken: string) {
    const validatedFields = publishExamsSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data provided.' };
    }

    try {
        const decodedToken = await verifyToken(idToken);
        const uid = decodedToken.uid;
        
        if (decodedToken.role !== 'school-head' || values.schoolId !== decodedToken.schoolId) {
             return { success: false, message: 'Permission denied.' };
        }
        
        const { schoolId, academicYear, term, schoolLevel, gradeLevel } = validatedFields.data;

        // Use a consistent ID to prevent duplicate documents for the same period
        const docId = `${academicYear}-${term}-${gradeLevel}`.replace(/\s+/g, '-');
        
        const publishedExamRef = admin.firestore().collection('schools').doc(schoolId).collection('publishedExams').doc(docId);

        await publishedExamRef.set({
            schoolId,
            academicYear,
            term,
            schoolLevel,
            gradeLevel,
            publishedAt: new Date().toISOString(),
            publishedBy: uid,
        }, { merge: true });

        revalidatePath('/school-head/exam-management');
        revalidatePath('/teacher/past-exam-papers');
        return { success: true, message: 'Exams published successfully to teachers.' };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] publishExamsToTeachers:', e);
        return { success: false, message: e.message || 'An unknown error occurred.' };
    }
}

export async function downloadAndZipFiles(filePaths: string[]): Promise<{success: boolean, message: string, data?: string}> {
    if (!filePaths || filePaths.length === 0) {
        return { success: false, message: 'No file paths provided.' };
    }

    try {
        const bucket = getStorage().bucket(); // Use default bucket
        const zip = new JSZip();

        const downloadPromises = filePaths.map(async (filePath) => {
            try {
                const file = bucket.file(filePath);
                const [fileBuffer] = await file.download();
                const fileName = filePath.split('/').pop() || filePath;
                zip.file(fileName, fileBuffer);
            } catch (error: any) {
                console.error(`Failed to download file: ${filePath}`, error);
                // We can choose to either fail the whole zip or continue with the files that succeeded.
                // For now, let's throw to indicate a partial failure.
                throw new Error(`Could not download file: ${filePath.split('/').pop()}`);
            }
        });

        await Promise.all(downloadPromises);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        return {
            success: true,
            message: 'Files zipped successfully.',
            data: zipBuffer.toString('base64'),
        };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] downloadAndZipFiles:', e);
        return { success: false, message: e.message || 'Failed to create ZIP file.' };
    }
}
