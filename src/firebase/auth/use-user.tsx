
'use client';

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, onSnapshot } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, firestore } from "@/firebase";
import { errorEmitter } from "../error-emitter";
import { FirestorePermissionError } from "../errors";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  customClaims?: { [key: string]: any };
  lastSignInTime?: string; // Added for last login info
  [key: string]: any;
}

export const useUser = () => {
  const [authUser, authLoading, authError] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (authError) {
      console.error('[useUser] Firebase auth error:', authError);
      setUserProfile(null);
      setLoading(false);
      return;
    }
    if (!authUser) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const unsubProfile = onSnapshot(doc(firestore, "users", authUser.uid), async (docSnap) => {
        try {
            // It's important to get a fresh token to ensure claims are up-to-date
            const idTokenResult = await authUser.getIdTokenResult(true);
            const claims = idTokenResult.claims;
            
            let profileData: UserProfile;

            if (docSnap.exists()) {
                profileData = docSnap.data() as UserProfile;
            } else {
                // This case is unlikely if users are created properly, but as a fallback:
                profileData = {
                    uid: authUser.uid,
                    email: authUser.email,
                    displayName: authUser.displayName,
                    photoURL: authUser.photoURL,
                    role: claims.role || 'teacher', // default role
                };
            }
            
            // Combine Firestore data with auth claims.
            // Also include schoolId and subRegionId from claims directly on the user object for easier access.
            setUserProfile({ 
                ...profileData,
                uid: authUser.uid, // Ensure uid from auth is used
                customClaims: claims,
                role: claims.role,
                schoolId: claims.schoolId,
                subRegionId: claims.subRegionId,
            });

        } catch (error) {
            console.error("[useUser] Error getting user token/claims:", error);
            setUserProfile(null);
        } finally {
            setLoading(false);
        }

    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${authUser.uid}`,
            operation: 'get',
        }));
        setUserProfile(null);
        setLoading(false);
    });

    return () => unsubProfile();

  }, [authUser, authLoading, authError]);

  return { user: userProfile, loading };
};
