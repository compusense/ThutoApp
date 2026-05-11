
import * as admin from 'firebase-admin';
import serviceAccount from '../../service-account.json';

// This function ensures that we only initialize the Firebase Admin SDK once.
// In serverless environments like Next.js, modules can be re-evaluated,
// and trying to initialize the app on every evaluation will cause errors.
function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    const typedServiceAccount = serviceAccount as admin.ServiceAccount;
    
    admin.initializeApp({
      credential: admin.credential.cert(typedServiceAccount),
      storageBucket: 'thutodatabase.firebasestorage.app'
    });

    console.log('[Firebase Admin] ✅ SDK initialized successfully.');
    return admin;

  } catch (error: any) {
    console.error('--- ❌ CRITICAL: FIREBASE ADMIN INITIALIZATION FAILED ---');
    console.error('Error:', error.message);
    // This will be caught by the server action and reported to the user.
    throw new Error(`Server Configuration Error: Could not initialize Firebase Admin SDK. Message: ${error.message}`);
  }
}

// Export the singleton instance.
// All server actions should import this `admin` object.
const adminInstance = getFirebaseAdmin();

export { adminInstance as admin };
