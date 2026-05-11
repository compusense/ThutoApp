
// scripts/fix-student-claims.ts
import * as admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    return admin;
  } catch (error: any) {
    console.error('--- ❌ CRITICAL: FIREBASE ADMIN INITIALIZATION FAILED ---');
    console.error('Error:', error.message);
    throw new Error(`Server Configuration Error: Could not initialize Firebase Admin SDK. Message: ${error.message}`);
  }
}

const adminInstance = initializeFirebaseAdmin();
const auth = adminInstance.auth();
const db = adminInstance.firestore();

async function fixStudentClaims() {
  console.log('Starting script to fix student custom claims...');
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
    
    if (usersSnapshot.empty) {
      console.log('No student users found in Firestore. Exiting.');
      return;
    }
    
    const studentUsers = usersSnapshot.docs.map(doc => doc.data());
    console.log(`Found ${studentUsers.length} student users in Firestore.`);

    for (const user of studentUsers) {
      if (!user.uid || !user.schoolId) {
        console.warn(`Skipping user with email ${user.email} due to missing uid or schoolId.`);
        skippedCount++;
        continue;
      }
      
      try {
        // Find the student's record in the school subcollection
        const studentDocs = await db.collectionGroup('students').where('uid', '==', user.uid).limit(1).get();

        if (studentDocs.empty) {
          console.warn(`Could not find school registry document for user ${user.email} (UID: ${user.uid}). Skipping.`);
          skippedCount++;
          continue;
        }

        const studentData = studentDocs.docs[0].data();
        const classId = studentData.classId; // This is the restored, correct classId

        const authUser = await auth.getUser(user.uid);
        const currentClaims = authUser.customClaims || {};

        if (classId && currentClaims.classId !== classId) {
          // If there is a classId in Firestore and it's different from the claim
          const classDoc = await db.collection('schools').doc(user.schoolId).collection('classes').doc(classId).get();
          if (classDoc.exists) {
            const className = classDoc.data()?.name;
            const newClaims = {
              ...currentClaims,
              classId: classId,
              className: className
            };
            
            await auth.setCustomUserClaims(user.uid, newClaims);
            console.log(`✅ Updated claims for ${user.email}: Set class to ${className}`);
            updatedCount++;
          }
        } else if (!classId && currentClaims.classId) {
          // If there is no classId in Firestore but one exists in the claim (needs to be removed)
          const { classId, className, ...restClaims } = currentClaims;
          await auth.setCustomUserClaims(user.uid, restClaims);
          console.log(`✅ Updated claims for ${user.email}: Removed stale class assignment.`);
          updatedCount++;
        } else {
          // No change needed
          skippedCount++;
        }
      } catch (e: any) {
        errorCount++;
        console.error(`❌ Failed to process user ${user.email}:`, e.message);
      }
    }

    console.log('\n--- Script Complete ---');
    console.log(`✅ Updated ${updatedCount} students`);
    console.log(`⚪ Skipped ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("\nStudents need to log out and log back in for changes to take effect.");

  } catch (error: any) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

fixStudentClaims();
