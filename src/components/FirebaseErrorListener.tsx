'use client';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/firebase';

function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // If a permission error happens but there's no logged-in user,
      // it's almost certainly a race condition during logout.
      // We can safely ignore it and not show an error to the user.
      if (!auth.currentUser) {
        console.warn("Ignoring Firestore permission error during logout:", error.message);
        return;
      }
      
      // In a development environment, Next.js will catch this unhandled promise rejection
      // and display it in the error overlay, which is exactly what we want for debugging.
      // We don't use a toast here because the overlay is much more detailed.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.removeListener('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null; // This component does not render anything
}

export default FirebaseErrorListener;
