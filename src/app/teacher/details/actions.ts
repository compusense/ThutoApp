
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { revalidatePath } from 'next/cache';

const updateProfilePictureSchema = z.object({
  uid: z.string(),
  fileContent: z.string(), // Base64 encoded file content
  fileType: z.string(),
});

export async function updateProfilePicture(values: z.infer<typeof updateProfilePictureSchema>, idToken: string) {
    const validatedFields = updateProfilePictureSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data provided.' };
    }

    try {
        // Verify user token
        const decodedToken = await getAuth().verifyIdToken(idToken);
        if (decodedToken.uid !== values.uid) {
            return { success: false, message: 'Permission denied.' };
        }

        const { uid, fileType, fileContent } = validatedFields.data;
        
        const bucket = getStorage().bucket();
        // Use a consistent filename to overwrite the old picture
        const filePath = `profile-pictures/${uid}/profile.jpg`;
        const file = bucket.file(filePath);

        const buffer = Buffer.from(fileContent, 'base64');
        
        await file.save(buffer, {
            metadata: {
                contentType: fileType,
            },
        });
        
        // Make the file public so the browser can display it
        await file.makePublic();

        // The public URL has a consistent format. Add a timestamp query param to bust browser caches.
        const publicUrl = `${file.publicUrl()}?t=${new Date().getTime()}`;
        
        // Update Firebase Auth and Firestore
        await getAuth().updateUser(uid, { photoURL: publicUrl });
        await admin.firestore().collection('users').doc(uid).update({ photoURL: publicUrl });

        revalidatePath('/teacher/details');
        return { success: true, message: "Profile picture updated.", data: { newPhotoURL: publicUrl } };

    } catch (e: any) {
        console.error('[SERVER ACTION ERROR] updateProfilePicture:', e);
        return { success: false, message: e.message || "An unknown error occurred." };
    }
}
