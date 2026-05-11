'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { getAuth } from 'firebase-admin/auth';

const reviewSchema = z.object({
  gameId: z.string(),
  status: z.enum(['approved', 'rejected']),
  reviewComment: z.string().optional(),
});

export async function reviewGame(values: z.infer<typeof reviewSchema>, idToken: string) {
  if (!idToken) {
    return { success: false, message: 'Authentication required.' };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, role } = decodedToken;

    if (role !== 'super-admin') {
        return { success: false, message: 'Permission denied. Only Super Admins can review games.' };
    }

    const db = admin.firestore();
    
    await db.collection('games').doc(values.gameId).update({
      status: values.status,
      reviewComment: values.reviewComment || '',
      reviewedBy: uid,
      reviewedByName: decodedToken.name || 'Administrator',
      reviewedAt: new Date().toISOString(),
    });

    revalidatePath('/super-admin/games/review');
    revalidatePath('/student/games'); // Refresh student view if something was approved
    
    return { 
      success: true, 
      message: `Game ${values.status === 'approved' ? 'approved' : 'rejected'} successfully.` 
    };

  } catch (error: any) {
    console.error('[GAME REVIEW ACTION ERROR]:', error);
    return { success: false, message: error.message || 'Failed to update game status.' };
  }
}
