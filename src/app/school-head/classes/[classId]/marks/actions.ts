'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { formatTeacherName } from '@/lib/utils';


// This schema represents a single mark entry for one student in one subject.
const TermMarkSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  studentId: z.string(),
  subjectId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string().min(1, 'Assessment name is required'),
  score: z.coerce.number().min(0, 'Score cannot be negative'),
  total: z.coerce.number().min(1, 'Total must be greater than 0'),
  lastModifiedBy: z.string(), // UID of the user who last modified it
});

// The main schema for saving marks for a class for a specific assessment.
const saveMarksSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
  // Totals are now a record keyed by subjectId
  totals: z.record(z.coerce.number().min(0)),
  // Marks are a record keyed by studentId, then subjectId
  marks: z.record(z.record(z.object({
    score: z.union([z.coerce.number().min(0), z.string().length(0), z.string().length(0).optional()]).optional()
  }))),
  modifiedBy: z.string(), // UID of user making the change
}).superRefine((data, ctx) => {
    // Check if for any submitted mark, the corresponding total is missing or not a positive number
    for (const studentId in data.marks) {
        for (const subjectId in data.marks[studentId]) {
            const entry = data.marks[studentId][subjectId];
            if (typeof entry.score === 'number' && entry.score >= 0) {
                if (data.totals[subjectId] === undefined || data.totals[subjectId] <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `A valid total is required for subject ID ${subjectId} before entering marks.`,
                        path: ['totals', subjectId],
                    });
                    // Stop validation on first error
                    return;
                }
            }
        }
    }
});

// -------- HELPER FUNCTIONS FOR SNAPSHOT --------
function getGrade(percentage: number): string {
    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 30) return 'D';
    return 'E';
}

function calculateSummary(reportData: any[], subjects: any[]): any {
    const createEmptySummaryBlock = () => ({
        grades: { 
            A: { count: 0, percentage: 0 }, 
            B: { count: 0, percentage: 0 }, 
            C: { count: 0, percentage: 0 }, 
            D: { count: 0, percentage: 0 }, 
            E: { count: 0, percentage: 0 } 
        },
        passRate: 0,
        qualityPassRate: 0,
        failRate: 0
    });

    const summary: any = {
        bySubject: {},
        overall: createEmptySummaryBlock(),
        gender: {
            boys: { ...createEmptySummaryBlock(), roll: 0 },
            girls: { ...createEmptySummaryBlock(), roll: 0 },
        }
    };
    subjects.forEach(s => summary.bySubject[s.id] = createEmptySummaryBlock());

    // ONLY include students who have at least one mark recorded
    const studentsWithResults = reportData.filter(item => !item.hasNoMarks);
    const totalStudentsWithResults = studentsWithResults.length;

    if (totalStudentsWithResults === 0) return summary;

    studentsWithResults.forEach(item => {
        const studentGender = item.student?.gender;

        subjects.forEach(subject => {
            const grade = item.subjectMarks[subject.id]?.grade;
            // Only count if the student actually has a grade for THIS subject
            if (grade && summary.bySubject[subject.id]) {
                summary.bySubject[subject.id].grades[grade].count++;
            }
        });
        
        const overallGrade = item.overall.grade;
        if (overallGrade) {
            summary.overall.grades[overallGrade].count++;
            if (studentGender === 'Male') {
                summary.gender.boys.roll++;
                summary.gender.boys.grades[overallGrade].count++;
            } else if (studentGender === 'Female') {
                summary.gender.girls.roll++;
                summary.gender.girls.grades[overallGrade].count++;
            }
        }
    });

    const processPercentages = (summaryBlock: any, explicitRoll?: number) => {
        // Roll is determined by the number of students who SAT for the exam
        const roll = explicitRoll !== undefined && explicitRoll > 0 
            ? explicitRoll 
            : Object.values<{count: number}>(summaryBlock.grades).reduce((acc, val) => acc + val.count, 0);
        
        if (roll === 0) return;
        
        const g = summaryBlock.grades;
        ['A', 'B', 'C', 'D', 'E'].forEach(grade => {
            g[grade].percentage = (g[grade].count / roll) * 100;
        });
        summaryBlock.passRate = ((g.A.count + g.B.count + g.C.count) / roll) * 100;
        summaryBlock.qualityPassRate = ((g.A.count + g.B.count) / roll) * 100;
        summaryBlock.failRate = ((g.D.count + g.E.count) / roll) * 100;
    };
    
    processPercentages(summary.overall, totalStudentsWithResults);
    processPercentages(summary.gender.boys, summary.gender.boys.roll);
    processPercentages(summary.gender.girls, summary.gender.girls.roll);

    subjects.forEach(s => {
        processPercentages(summary.bySubject[s.id]);
    });

    return summary;
}
// -------- END HELPER FUNCTIONS --------


export async function saveTermMarks(values: z.infer<typeof saveMarksSchema>) {
  const validatedFields = saveMarksSchema.safeParse(values);
  if (!validatedFields.success) {
    console.error('[saveTermMarks] ❌ Invalid input:', validatedFields.error.flatten().fieldErrors);
    return { success: false, message: 'A valid, positive total is required for each subject before marks can be saved.' };
  }

  const { schoolId, classId, academicYear, term, assessment, totals, marks, modifiedBy } = validatedFields.data;
  const db = admin.firestore();
  
  try {
    const batch = db.batch();
    const serverTimestamp = firestore.FieldValue.serverTimestamp();
    let writeOperations = 0;

    const classRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId);
    const classDoc = await classRef.get();
    const currentTeacherId = classDoc.data()?.teacherId || null;

    const assessmentTotalsId = `${academicYear}-${term.replace(/\s+/g, '-')}-${assessment.replace(/\s+/g, '-')}`;
    const assessmentTotalsRef = classRef.collection('assessmentTotals').doc(assessmentTotalsId);

    const totalsData: Record<string, number> = {};
    for (const subjectId in totals) {
        if (typeof totals[subjectId] === 'number') {
            totalsData[subjectId] = totals[subjectId];
        }
    }

    const totalsUpdateData: {
        totals: Record<string, number>,
        teacherIdAtTimeOfSave?: string | null,
        lastModified: firestore.FieldValue
    } = {
        totals: totalsData,
        teacherIdAtTimeOfSave: currentTeacherId,
        lastModified: serverTimestamp,
    };
    
    batch.set(assessmentTotalsRef, totalsUpdateData, { merge: true });

    // Sync all existing marks for this class/assessment with the current totals
    const allExistingMarksSnap = await db.collectionGroup('marks')
        .where('schoolId', '==', schoolId)
        .where('classId', '==', classId)
        .where('academicYear', '==', academicYear)
        .where('term', '==', term)
        .where('assessment', '==', assessment)
        .get();
    
    allExistingMarksSnap.forEach(doc => {
        const mark = doc.data();
        const correctTotal = totals[mark.subjectId];
        if (typeof correctTotal === 'number' && correctTotal > 0 && mark.total !== correctTotal) {
            batch.update(doc.ref, { total: correctTotal, lastModified: serverTimestamp, lastModifiedBy: modifiedBy });
            writeOperations++;
        }
    });

    // Save/Update the specifically changed marks
    for (const studentId in marks) {
      for (const subjectId in marks[studentId]) {
        const entry = marks[studentId][subjectId];
        const subjectTotal = totals[subjectId];

        if (typeof entry.score === 'number' && entry.score >= 0 && typeof subjectTotal === 'number' && subjectTotal > 0) {
            
            const markData: any = { schoolId, classId, studentId, subjectId, academicYear, term, assessment, score: entry.score, total: subjectTotal, lastModified: serverTimestamp, lastModifiedBy: modifiedBy, };

            const existingMark = allExistingMarksSnap.docs.find(d => 
                d.data().studentId === studentId && d.data().subjectId === subjectId
            );

            if (!existingMark) {
                const newMarkRef = db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks').doc();
                batch.set(newMarkRef, markData);
                writeOperations++;
            } else {
                batch.update(existingMark.ref, { score: markData.score, total: markData.total, lastModified: markData.lastModified, lastModifiedBy: markData.lastModifiedBy });
                writeOperations++;
            }
        }
      }
    }
    
    await batch.commit();

    // --- Create/Update Results Snapshot ---
    const studentsSnap = await classRef.collection('students').get();
    const studentIds = studentsSnap.docs.map(d => d.id);

    if (studentIds.length === 0) {
        return { success: true, message: 'Marks saved.', data: { totals: totalsData } };
    }
    
    const studentDetailsPromises = studentIds.map(id => db.collection('schools').doc(schoolId).collection('students').doc(id).get());
    const studentDetailDocs = await Promise.all(studentDetailsPromises);
    const studentDetails = studentDetailDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const subjectsSnap = await classRef.collection('subjects').where('academicYear', '==', academicYear).get();
    const subjectIds = subjectsSnap.docs.map(d => d.data().subjectId);
    
    let subjects: any[] = [];
    if (subjectIds.length > 0) {
        const masterSubjectsSnap = await db.collection('subjects').where(firestore.FieldPath.documentId(), 'in', subjectIds).get();
        subjects = masterSubjectsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.name.localeCompare(b.name));
    }

    // Refresh marks for the snapshot (after batch updates)
    const refreshedMarksSnap = await db.collectionGroup('marks')
        .where('schoolId', '==', schoolId)
        .where('classId', '==', classId)
        .where('academicYear', '==', academicYear)
        .where('term', '==', term)
        .where('assessment', '==', assessment)
        .get();
    
    const allMarksForSnapshot = refreshedMarksSnap.docs.map(d => d.data());

    const reportData = studentDetails.map(student => {
         const studentMarks: Record<string, any> = {};
         let grandTotalScore = 0, grandTotalMax = 0;
         let hasAnyMarks = false;

         subjects.forEach(subject => {
             const mark = allMarksForSnapshot.find(m => m.studentId === student.id && m.subjectId === subject.id);
             
             // Recalculate using current totals
             const subjectTotal = totals[subject.id];
             
             if (mark && typeof subjectTotal === 'number' && subjectTotal > 0) {
                 hasAnyMarks = true;
                 const percentage = (mark.score / subjectTotal) * 100;
                 
                 grandTotalScore += mark.score;
                 grandTotalMax += subjectTotal;
                 
                 studentMarks[subject.id] = { 
                     totalScore: mark.score, 
                     totalMax: subjectTotal, 
                     percentage, 
                     grade: getGrade(percentage) 
                 };
             } else {
                 // For missing marks, we set totalMax to 0 to signal "Not Sat" to the client
                 studentMarks[subject.id] = { totalScore: 0, totalMax: 0, percentage: 0, grade: null };
             }
         });

         const overallPercentage = grandTotalMax > 0 ? (grandTotalScore / grandTotalMax) * 100 : 0;
         const overallGrade = hasAnyMarks ? getGrade(overallPercentage) : null;

         return { 
             student: {id: student.id, fullName: `${student.firstName} ${student.surname}`, gender: student.gender}, 
             subjectMarks: studentMarks, 
             overall: { totalScore: grandTotalScore, totalMax: grandTotalMax, percentage: overallPercentage, grade: overallGrade },
             hasNoMarks: !hasAnyMarks
         };
    });

    reportData.sort((a,b) => {
        if (a.hasNoMarks && !b.hasNoMarks) return 1;
        if (!a.hasNoMarks && b.hasNoMarks) return -1;
        return b.overall.percentage - a.overall.percentage;
    });

    const summaryData = calculateSummary(reportData, subjects);

    let teacherName = 'N/A';
    if(currentTeacherId) {
        const teacherDoc = await db.collection('users').doc(currentTeacherId).get();
        if(teacherDoc.exists) teacherName = formatTeacherName(teacherDoc.data() as UserProfile);
    }

    const snapshotData = {
        schoolId, classId, academicYear, term, assessment,
        createdAt: new Date().toISOString(),
        createdBy: modifiedBy,
        className: classDoc.data()?.name,
        teacherName,
        studentReports: reportData,
        summaryData,
        subjects,
        teacherIdAtTimeOfSave: currentTeacherId,
    };

    const snapshotId = `${academicYear}-${term.replace(/\s+/g, '-')}-${assessment.replace(/\s+/g, '-')}`;
    const snapshotRef = classRef.collection('resultsSnapshots').doc(snapshotId);
    await snapshotRef.set(snapshotData);

    revalidatePath(`/school-head/classes/${classId}/marks`);
    return { success: true, message: 'Marks saved and snapshot generated.', data: { totals: totalsData } };

  } catch (error) {
    console.error('[SAVE MARKS] Error:', error);
    return { success: false, message: 'Failed to save marks.' };
  }
}

const getActivitySchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

export async function getMarkSheetActivity(values: z.infer<typeof getActivitySchema>) {
    const validatedFields = getActivitySchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input.', data: null };
    }
    const { schoolId, classId, academicYear, term, assessment } = validatedFields.data;
    const db = admin.firestore();

    try {
        const marksQuery = db.collectionGroup('marks')
            .where('schoolId', '==', schoolId)
            .where('classId', '==', classId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment)
            .orderBy('lastModified', 'desc')
            .limit(1);
        
        const snapshot = await marksQuery.get();
        if (snapshot.empty) {
            return { success: true, message: 'No activity found.', data: null };
        }

        const latestMark = snapshot.docs[0].data();
        let editorName = 'Unknown User';
        if (latestMark.lastModifiedBy) {
            const userDoc = await db.collection('users').doc(latestMark.lastModifiedBy).get();
            if (userDoc.exists) {
                editorName = userDoc.data()?.displayName || 'Unknown User';
            }
        }
        
        return {
            success: true,
            data: {
                lastModifiedBy: editorName,
                lastModifiedAt: (latestMark.lastModified as firestore.Timestamp).toDate().toISOString(),
            }
        };

    } catch (e: any) {
        console.error('[getMarkSheetActivity] Error:', e);
        return { success: false, message: e.message, data: null };
    }
}
