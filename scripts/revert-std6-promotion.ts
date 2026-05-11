// scripts/revert-std6-class-change.ts
import * as admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

// --- CONFIGURATION ---
const SCHOOL_ID = '88LHIAfRFeBJGU7ad41v';
const WRONG_CLASS_ID = 'nnaDa65JyMBydIKTDC8t'; // The class students are currently in
const CORRECT_CLASS_ID = 'VBkprVyC9IO21v2j1oxl'; // The class they should be moved back to
const EXECUTE_WRITE = false; // SET TO TRUE TO ACTUALLY RUN THE SCRIPT

// --- INITIALIZATION ---
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return admin;
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    return admin;
  } catch (error: any) {
    console.error('--- ❌ CRITICAL: FIREBASE ADMIN INITIALIZATION FAILED ---');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

const db = initializeFirebaseAdmin().firestore();
const auth = initializeFirebaseAdmin().auth();

async function revertStudentClassAssignments() {
  console.log('--- Starting Student Class Reversion Script ---');
  if (!EXECUTE_WRITE) {
    console.log('*** DRY RUN MODE: No changes will be written to the database. ***');
  }

  try {
    const studentsRef = db.collection('schools').doc(SCHOOL_ID).collection('students');
    const studentsToMoveQuery = studentsRef.where('classId', '==', WRONG_CLASS_ID);
    
    const studentsSnapshot = await studentsToMoveQuery.get();
    
    if (studentsSnapshot.empty) {
      console.log('✅ No students found in the specified "wrong" class. Nothing to do.');
      return;
    }
    
    console.log(`🔍 Found ${studentsSnapshot.size} students in class ${WRONG_CLASS_ID} to move back to ${CORRECT_CLASS_ID}.`);

    const correctClassDoc = await db.collection('schools').doc(SCHOOL_ID).collection('classes').doc(CORRECT_CLASS_ID).get();
    if (!correctClassDoc.exists) {
        throw new Error(`Correct class with ID ${CORRECT_CLASS_ID} does not exist.`);
    }
    const correctClassName = correctClassDoc.data()?.name;

    const batch = db.batch();
    let updatedCount = 0;

    for (const studentDoc of studentsSnapshot.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      
      console.log(`- Processing student: ${studentData.firstName} ${studentData.surname} (ID: ${studentId})`);

      // 1. Update the student's main record to point to the correct class
      batch.update(studentDoc.ref, { classId: CORRECT_CLASS_ID });

      // 2. Remove enrollment from the wrong class's subcollection
      const wrongEnrollmentRef = db.collection('schools').doc(SCHOOL_ID).collection('classes').doc(WRONG_CLASS_ID).collection('students').doc(studentId);
      batch.delete(wrongEnrollmentRef);

      // 3. Add enrollment to the correct class's subcollection
      const correctEnrollmentRef = db.collection('schools').doc(SCHOOL_ID).collection('classes').doc(CORRECT_CLASS_ID).collection('students').doc(studentId);
      batch.set(correctEnrollmentRef, { studentId });

      // 4. If the student has a user account, update their claims
      if (studentData.uid) {
        console.log(`  - Found user account (UID: ${studentData.uid}). Staging claim and user doc update.`);
        const newClaims = {
          classId: CORRECT_CLASS_ID,
          className: correctClassName
        };
        
        if (EXECUTE_WRITE) {
            const userAuth = await auth.getUser(studentData.uid);
            await auth.setCustomUserClaims(studentData.uid, { ...userAuth.customClaims, ...newClaims });
        }
        
        // Also update the /users collection document
        const userProfileRef = db.collection('users').doc(studentData.uid);
        batch.update(userProfileRef, newClaims);
      }
      updatedCount++;
    }

    if (EXECUTE_WRITE) {
      await batch.commit();
      console.log(`\n✅ --- SCRIPT COMPLETE ---`);
      console.log(`Successfully moved ${updatedCount} students back to class "${correctClassName}".`);
      console.log('Students need to log out and log back in for changes to take effect.');
    } else {
      console.log(`\n✅ --- DRY RUN COMPLETE ---`);
      console.log(`Would have moved ${updatedCount} students.`);
      console.log('To apply these changes, set EXECUTE_WRITE to true at the top of the script.');
    }

  } catch (error: any) {
    console.error('\n--- ❌ SCRIPT FAILED ---');
    console.error(error);
    process.exit(1);
  }
}

revertStudentClassAssignments();
