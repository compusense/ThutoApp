'use server';

import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import JSZip from 'jszip';

/**
 * Server action to download all files for a game and return them as a base64 encoded ZIP.
 */
export async function downloadGameSource(gameId: string, idToken: string) {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, role } = decodedToken;
    const db = admin.firestore();

    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return { success: false, message: 'Game not found.' };
    }

    const gameData = gameDoc.data()!;
    // Only the owner or a super-admin can download the source
    if (gameData.developerId !== uid && role !== 'super-admin') {
      return { success: false, message: 'Permission denied.' };
    }

    const storagePath = gameData.storagePath as string;
    if (!storagePath) {
      return { success: false, message: 'Source files not found for this game.' };
    }

    // Determine the folder path (parent of index.html)
    const pathParts = storagePath.split('/');
    pathParts.pop();
    const folderPath = pathParts.join('/') + '/';

    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: folderPath });

    if (files.length === 0) {
      return { success: false, message: 'No source files found in storage.' };
    }

    const zip = new JSZip();
    
    // Download all files in the folder and add them to the ZIP
    const downloadPromises = files.map(async (file) => {
      const [content] = await file.download();
      // Remove the prefix folder path to make paths relative inside the ZIP
      const relativePath = file.name.replace(folderPath, '');
      if (relativePath) {
        zip.file(relativePath, content);
      }
    });

    await Promise.all(downloadPromises);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return {
      success: true,
      message: 'Source code zipped successfully.',
      data: zipBuffer.toString('base64'),
      fileName: `${gameData.title.replace(/\s+/g, '_')}_source.zip`
    };

  } catch (error: any) {
    console.error('[DEVELOPER ACTION ERROR] downloadGameSource:', error);
    return { success: false, message: error.message || 'Failed to download game source.' };
  }
}
