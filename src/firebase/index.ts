'use client';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;

function initializeFirebase() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);
  return { app, auth, firestore, storage };
}

// export hooks, providers and other utils
export * from './provider';
export * from './auth/use-user';

// Initialize and export firebase instances
const firebaseInstances = initializeFirebase();
app = firebaseInstances.app;
auth = firebaseInstances.auth;
firestore = firebaseInstances.firestore;
storage = firebaseInstances.storage;

export { app, auth, firestore, storage, initializeFirebase };
