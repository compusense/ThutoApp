
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';

const promotionSchema = z.object({
  schoolId: z.string(),
  fromClassId: z.string(),
  fromYear: z.string(),
  toYear: z.string(),
  fromClassName: z.string(),
  nextGradeLevel: z.string().nullable(),
  studentPromotions: z.array(z.object({
    studentId: z.string(),
    destination: z.string(),
  })),
});

async function provisionSubjectsForClass(
  db: firestore.Firestore,
  batch: firestore.WriteBatch,
  schoolId: string,
  classId: string,
  fromClassId: string,
  fromYear: string,
  toYear: string
) {
  const subjectsRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects');

  // This check is important to only provision subjects ONCE if multiple promotions target the same new class.
  const existingSubjectsSnap = await subjectsRef.where('academicYear', '==', toYear).limit(1).get();
  if (!existingSubjectsSnap.empty) {
    console.log(`[PROMOTION] Subjects for class ${classId} for year ${toYear} already exist. Skipping provisioning.`);
    return 0; // Return 0 operations added
  }

  const fromSubjectsSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(fromClassId).collection('subjects').where('academicYear', '==', fromYear).get();

  let opsAdded = 0;
  if (!fromSubjectsSnap.empty) {
    console.log(`[PROMOTION] Copying ${fromSubjectsSnap.size} subjects from old class ${fromClassId} to new class ${classId}`);
    fromSubjectsSnap.forEach(doc => {
      const newSubjectRef = subjectsRef.doc();
      batch.set(newSubjectRef, { subjectId: doc.data().subjectId, academicYear: toYear });
      opsAdded++;
    });
  } else {
    console.warn(`[PROMOTION] No subjects found for old class ${fromClassId} for year ${fromYear}. Falling back to master list.`);
    const schoolDoc = await db.collection('schools').doc(schoolId).get();
    const schoolLevel = schoolDoc.data()?.schoolType;
    if (schoolLevel) {
      const masterSubjectsSnap = await db.collection('subjects').where('schoolLevel', '==', schoolLevel).get();
      masterSubjectsSnap.forEach(doc => {
        const newSubjectRef = subjectsRef.doc();
        batch.set(newSubjectRef, { subjectId: doc.id, academicYear: toYear });
        opsAdded++;
      });
    }
  }
  return opsAdded;
}


export async function promoteStudents(values: z.infer<typeof promotionSchema>) {
  const validated = promotionSchema.safeParse(values);
  if (!validated.success) {
    console.error('[PROMOTION] Validation failed:', validated.error.flatten());
    return { success: false, message: 'Invalid input' };
  }

  const { schoolId, fromClassId, fromYear, toYear, fromClassName, nextGradeLevel, studentPromotions } = validated.data;
  const db = admin.firestore();
  const classesRef = db.collection('schools').doc(schoolId).collection('classes');

  console.log(`[PROMOTION] Starting promotion for class "${fromClassName}" (${fromClassId}) from ${fromYear} to ${toYear}.`);

  try {
    const batches: firestore.WriteBatch[] = [db.batch()];
    let currentBatch = batches[0];
    let operationCount = 0;
    const MAX_OPS_PER_BATCH = 490; // Stay safely under the 500 limit

    const commitAndResetBatch = async () => {
      console.log(`[PROMOTION] Batch limit reached. Committing batch with ${operationCount} operations...`);
      await currentBatch.commit();
      currentBatch = db.batch();
      batches.push(currentBatch);
      operationCount = 0;
      console.log(`[PROMOTION] Starting new batch...`);
    };

    const classCache = new Map<string, { id: string, name: string }>();
    const destinationClassIds = new Set<string>();

    for (const [index, promotion] of studentPromotions.entries()) {
      // Each student update is ~3 operations. Check if we need to commit.
      if (operationCount > MAX_OPS_PER_BATCH - 5) {
        await commitAndResetBatch();
      }

      const { studentId, destination } = promotion;
      
      const studentSchoolRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId);
      const studentDoc = await studentSchoolRef.get();
      if (!studentDoc.exists) {
        console.warn(`[PROMOTION] Student ${studentId} not found, skipping.`);
        continue;
      }
      const studentUid = studentDoc.data()?.uid;
      
      let targetClassId: string;
      let targetClassName: string;

      if (destination === 'graduate') {
        console.log(`[PROMOTION LOG] Staging graduation for student ${studentId}.`);
        const psleRef = db.collection('psleClasses').doc(toYear).collection('students').doc(studentId);
        currentBatch.set(psleRef, { studentId });
        currentBatch.update(studentSchoolRef, { classId: firestore.FieldValue.delete(), status: 'Graduated' });
        operationCount += 2;
        if (studentUid) {
          currentBatch.update(db.collection('users').doc(studentUid), { classId: null, className: null, status: 'Graduated' });
          operationCount++;
        }
        continue;
      }

      if (destination === 'promote') {
        if (!nextGradeLevel) {
          console.error('[PROMOTION] CRITICAL: Cannot promote without a nextGradeLevel. Skipping student.');
          continue;
        }
        
        const stream = fromClassName.replace(/(Standard|Form) \d+/, '').trim() || '';
        targetClassName = `${nextGradeLevel} ${stream}`.trim();
        const newClassDocId = `${nextGradeLevel}-${stream}-${toYear}`.replace(/\s+/g, '-').toLowerCase();

        if (classCache.has(newClassDocId)) {
          targetClassId = classCache.get(newClassDocId)!.id;
        } else {
            const existingClassSnap = await classesRef.doc(newClassDocId).get();
            if (existingClassSnap.exists) {
                targetClassId = existingClassSnap.id;
                classCache.set(newClassDocId, { id: targetClassId, name: existingClassSnap.data()!.name });
            } else {
                targetClassId = newClassDocId;
                console.log(`[PROMOTION LOG] Staging new class document "${targetClassName}" with ID: ${targetClassId}`);
                currentBatch.set(classesRef.doc(targetClassId), {
                    name: targetClassName,
                    gradeLevel: nextGradeLevel,
                    stream: stream,
                    schoolId,
                    academicYear: toYear,
                    promotionHistory: firestore.FieldValue.arrayUnion({ fromClassId: fromClassId, fromYear: fromYear, toYear: toYear })
                });
                operationCount++;
                classCache.set(newClassDocId, { id: targetClassId, name: targetClassName });
            }
        }
      } else { // Handles 'repeat'
        targetClassId = destination;
        const classToRepeatDoc = await classesRef.doc(targetClassId).get();
        targetClassName = classToRepeatDoc.data()?.name || fromClassName;
      }

      destinationClassIds.add(targetClassId);
      
      console.log(`[PROMOTION LOG] Student ${studentId}: Staging update /schools/.../students/${studentId} to classId: ${targetClassId}`);
      currentBatch.update(studentSchoolRef, { classId: targetClassId });
      operationCount++;
      
      if (studentUid) {
        console.log(`[PROMOTION LOG] Student ${studentId}: Staging update /users/${studentUid} to classId: ${targetClassId}`);
        currentBatch.update(db.collection('users').doc(studentUid), { classId: targetClassId, className: targetClassName });
        operationCount++;
      }

      const newClassRollRef = classesRef.doc(targetClassId).collection('students').doc(studentId);
      console.log(`[PROMOTION LOG] Student ${studentId}: Staging set for new enrollment in ${targetClassName}`);
      currentBatch.set(newClassRollRef, { studentId });
      operationCount++;
    }

    // Provision subjects for the newly created classes
    console.log('[PROMOTION LOG] Provisioning subjects for new classes...');
    for (const classId of destinationClassIds) {
      // Check if there is enough space in the current batch for subject provisioning
      const estimatedSubjectOps = 15; // A safe estimate
      if (operationCount + estimatedSubjectOps > MAX_OPS_PER_BATCH) {
        await commitAndResetBatch();
      }
      operationCount += await provisionSubjectsForClass(db, currentBatch, schoolId, classId, fromClassId, fromYear, toYear);
    }

    // Commit any remaining operations in the last batch
    console.log(`[PROMOTION] Committing final batch with ${operationCount} operations.`);
    await currentBatch.commit();
    console.log('[PROMOTION] All batches committed successfully.');

    // Post-commit verification for the first student
    if (studentPromotions.length > 0) {
        const firstStudentId = studentPromotions[0].studentId;
        console.log(`[PROMOTION VERIFICATION] Checking update for student: ${firstStudentId}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for replication
        const studentAfterCommit = await db.collection('schools').doc(schoolId).collection('students').doc(firstStudentId).get();
        if (studentAfterCommit.exists) {
            console.log(`[PROMOTION VERIFICATION] SUCCESS: Student ${firstStudentId} new classId is '${studentAfterCommit.data()?.classId}'.`);
        } else {
            console.warn(`[PROMOTION VERIFICATION] FAILED: Student doc ${firstStudentId} not found after commit.`);
        }
    }
    
    revalidatePath('/school-head/promotions');
    revalidatePath('/school-head/classes');
    revalidatePath('/school-head/students');

    return { success: true, message: 'Students promoted successfully.' };
  } catch (error: any) {
    console.error('[PROMOTION] Final Catch Block:', error);
    return { success: false, message: error.message || 'An unexpected error occurred during promotion.' };
  }
}
