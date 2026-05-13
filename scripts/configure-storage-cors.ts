
import * as admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

async function configureCors() {
  console.log('Initializing Firebase Admin...');
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: 'thutodatabase.firebasestorage.app'
    });
  }

  try {
    const bucket = admin.storage().bucket();
    console.log(`Setting CORS configuration for bucket: ${bucket.name}...`);

    await bucket.setCorsConfiguration([
      {
        origin: ['*'], // Allowing all for development, can be restricted later
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600
      }
    ]);

    console.log('\n✅ Success! CORS configuration updated successfully.');
    console.log('It may take a few minutes for the changes to propagate.');

  } catch (error) {
    console.error('\n❌ Error setting CORS configuration:', error);
    process.exit(1);
  }

  process.exit(0);
}

configureCors();
