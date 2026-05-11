'use client';
import { FirebaseProvider, initializeFirebase } from '@/firebase';

// this provider is needed to make sure firebase is initialized only once on the client
// and that it's a client component
export const FirebaseClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { app, auth, firestore, storage } = initializeFirebase();
  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore} storage={storage}>
      {children}
    </FirebaseProvider>
  );
};
