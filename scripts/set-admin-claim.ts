
import * as admin from 'firebase-admin';

// You need to download this file from your Firebase project settings
// and place it at the root of your project.
// Go to Project settings > Service accounts > Generate new private key
import serviceAccount from '../service-account.json';

async function setAdminClaim() {
  const args = process.argv.slice(2);
  const uid = args[0];

  if (!uid) {
    console.error('Error: Please provide a UID as the first argument.');
    process.exit(1);
  }

  console.log(`Setting custom claim for UID: ${uid}...`);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }

  try {
    // Set the custom claim 'role' to 'super-admin'
    await admin.auth().setCustomUserClaims(uid, { role: 'super-admin' });

    // Also update the user's role in Firestore to keep data consistent
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.set({
        role: 'super-admin'
    }, { merge: true });


    console.log(`\n✅ Success! User ${uid} has been granted 'super-admin' role.`);
    console.log("You can now log in with the user's credentials.");

  } catch (error) {
    console.error('\n❌ Error setting custom claim:', error);
    process.exit(1);
  }

  process.exit(0);
}

setAdminClaim();
