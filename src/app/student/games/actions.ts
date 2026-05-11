'use server';

import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { Game, GameActivity } from '@/lib/types';

export async function fetchApprovedGames(idToken: string) {
  if (!idToken) return { success: false, message: 'Auth required' };

  try {
    await getAuth().verifyIdToken(idToken);
    const db = admin.firestore();
    
    const gamesSnap = await db.collection('games')
      .where('status', '==', 'approved')
      .get();

    const games = gamesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Game[];

    return { success: true, data: games };
  } catch (error: any) {
    console.error('[GAMES ACTION] fetchApprovedGames:', error);
    return { success: false, message: error.message };
  }
}

export async function fetchStudentActivity(idToken: string) {
    if (!idToken) return { success: false, message: 'Auth required' };

    try {
        const decoded = await getAuth().verifyIdToken(idToken);
        const db = admin.firestore();

        const activitySnap = await db.collection('gameActivity')
            .where('studentId', '==', decoded.uid)
            .get();

        const activities = activitySnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as GameActivity[];

        // Group by gameId to find high scores
        const highScores: Record<string, number> = {};
        activities.forEach(act => {
            if (!highScores[act.gameId] || act.score > highScores[act.gameId]) {
                highScores[act.gameId] = act.score;
            }
        });

        return { success: true, data: highScores };
    } catch (error: any) {
        console.error('[GAMES ACTION] fetchStudentActivity:', error);
        return { success: false, message: error.message };
    }
}

export async function fetchTugOfWarLeaderboard(idToken: string) {
  if (!idToken) return { success: false, message: 'Auth required' };

  try {
    await getAuth().verifyIdToken(idToken);
    const db = admin.firestore();
    
    // Fetch top 5 students by score. We only return public-facing data for privacy.
    const snapshot = await db.collection('users')
      .where('role', '==', 'student')
      .orderBy('tugOfWarScore', 'desc')
      .limit(5)
      .get();

    const leaderboard = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data.displayName || 'Anonymous Student',
        tugOfWarScore: data.tugOfWarScore || 0,
        className: data.className || 'Explorer'
      };
    });

    return { success: true, data: leaderboard };
  } catch (error: any) {
    console.error('[GAMES ACTION] fetchTugOfWarLeaderboard:', error);
    return { success: false, message: error.message };
  }
}
