'use client';
import { createContext, useContext } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import FirebaseErrorListener from '@/components/FirebaseErrorListener';

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  firestore: null,
  storage: null,
});

export const FirebaseProvider = ({
  children,
  app,
  auth,
  firestore,
  storage,
}: {
  children: React.ReactNode;
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}) => {
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore, storage }}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);
export const useFirebaseApp = () => useContext(FirebaseContext)?.app;
export const useFirestore = () => useContext(FirebaseContext)?.firestore;
export const useAuth = () => useContext(FirebaseContext)?.auth;
export const useStorage = () => useContext(FirebaseContext)?.storage;
