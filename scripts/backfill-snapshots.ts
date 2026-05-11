
// scripts/backfill-snapshots.ts
import * as admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

// --- CONFIGURATION ---
const SCHOOL_NAME = "Inalegolo Primary School";
// Set to true to run the script and write to the database. 
// Defaults to false for a safe dry run.
const EXECUTE_WRITE = false; 

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

// --- HELPER FUNCTIONS (adapted from actions.ts) ---

function getGrade(percentage: number): string {
    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 30) return 'D';
    return 'E';
}

function calculateSummary(reportData: any[], subjects: any[], students: any[]): any {
    const totalStudentsWithResults = reportData.length;

    const createEmptySummaryBlock = () => ({
        grades: { A: { count: 0 }, B: { count: 0 }, C: { count: 0 }, D: { count: 0 }, E: { count: 0 } },
        passRate: 0,
        qualityPassRate: 0
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

    if (totalStudentsWithResults === 0) return summary;

    reportData.forEach(item => {
        const studentInfo = students.find(s => s.id === item.student.id);
        subjects.forEach(subject => {
            const grade = item.subjectMarks[subject.id]?.grade;
            if (grade && summary.bySubject[subject.id]) {
                summary.bySubject[subject.id].grades[grade].count++;
            }
        });
        
        const overallGrade = item.overall.grade;
        if (overallGrade) {
            summary.overall.grades[overallGrade].count++;
            if (studentInfo?.gender === 'Male') {
                summary.gender.boys.roll++;
                summary.gender.boys.grades[overallGrade].count++;
            } else if (studentInfo?.gender === 'Female') {
                summary.gender.girls.roll++;
                summary.gender.girls.grades[overallGrade].count++;
            }
        }
    });

    const processPercentages = (summaryBlock: any, roll: number) => {
        if (roll === 0) return;
        const gradeKeys: (keyof typeof summaryBlock.grades)[] = ['A', 'B', 'C', 'D', 'E'];
        gradeKeys.forEach(grade => {
            summaryBlock.grades[grade].percentage = (summaryBlock.grades[grade].count / roll) * 100;
        });
        summaryBlock.passRate = ((summaryBlock.grades.A.count + summaryBlock.grades.B.count + summaryBlock.grades.C.count) / roll) * 100;
        summaryBlock.qualityPassRate = ((summaryBlock.grades.A.count + summaryBlock.grades.B.count) / roll) * 100;
    };
    
    processPercentages(summary.overall, totalStudentsWithResults);
    processPercentages(summary.gender.boys, summary.gender.boys.roll);
    processPercentages(summary.gender.girls, summary.gender.girls.roll);

    subjects.forEach(s => {
        const subjectRoll = Object.values<{count: number}>(summary.bySubject[s.id].grades).reduce((acc, val) => acc + val.count, 0);
        processPercentages(summary.bySubject[s.id], subjectRoll);
    });

    return summary;
}


async function generateSnapshotForPeriod(schoolId: string, classId: string, academicYear: string, term: string, assessment: string) {
    console.log(` -> Generating snapshot for: ${classId} / ${academicYear} / ${term} / ${assessment}`);
    
    const classRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) { throw new Error(`Class ${classId} not found.`); }
    const classData = classSnap.data()!;

    let teacherName = 'N/A';
    if (classData.teacherId) {
        const teacherDoc = await db.collection('users').doc(classData.teacherId).get();
        if(teacherDoc.exists) teacherName = teacherDoc.data()?.displayName || 'Unknown Teacher';
    }

    const studentsSnap = await classRef.collection('students').get();
    const studentIds = studentsSnap.docs.map(d => d.id);
    if (studentIds.length === 0) {
        console.log(`    - No students found in class roll. Skipping snapshot.`);
        return;
    }
    const studentDetailsDocs = await Promise.all(studentIds.map(id => db.collection('schools').doc(schoolId).collection('students').doc(id).get()));
    const studentDetails = studentDetailsDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const subjectsSnap = await classRef.collection('subjects').where('academicYear', '==', academicYear).get();
    const subjectIds = subjectsSnap.docs.map(d => d.data().subjectId);
    let subjects: any[] = [];
    if (subjectIds.length > 0) {
        const masterSubjectsSnap = await db.collection('subjects').where(admin.firestore.FieldPath.documentId(), 'in', subjectIds).get();
        subjects = masterSubjectsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.name.localeCompare(b.name));
    }
    console.log(`    - Found ${subjects.length} subjects for this class/year.`);

    const allMarksForSnapshot: any[] = [];
    for (const studentId of studentIds) {
        const marksSnap = await db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
            .where('classId', '==', classId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment)
            .get();
        marksSnap.forEach(doc => allMarksForSnapshot.push({ studentId, ...doc.data() }));
    }
    console.log(`    - Fetched ${allMarksForSnapshot.length} mark documents.`);

    const reportData = studentDetails.map(student => {
         const studentMarks: Record<string, any> = {};
         let grandTotalScore = 0, grandTotalMax = 0;
         subjects.forEach(subject => {
             const marksForSubject = allMarksForSnapshot.filter(m => m.studentId === student.id && m.subjectId === subject.id);
             const totalScore = marksForSubject.reduce((acc, m) => acc + m.score, 0);
             const totalMax = marksForSubject.reduce((acc, m) => acc + m.total, 0);
             const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
             grandTotalScore += totalScore;
             grandTotalMax += totalMax;
             studentMarks[subject.id] = { totalScore, totalMax, percentage, grade: getGrade(percentage) };
         });
         const overallPercentage = grandTotalMax > 0 ? (grandTotalScore / grandTotalMax) * 100 : 0;
         return { student: {id: student.id, fullName: `${student.firstName} ${student.surname}`, gender: student.gender}, subjectMarks: studentMarks, overall: { totalScore: grandTotalScore, totalMax: grandTotalMax, percentage: overallPercentage, grade: getGrade(overallPercentage) } };
    });

    reportData.sort((a,b) => b.overall.percentage - a.overall.percentage);
    const summaryData = calculateSummary(reportData, subjects, studentDetails);

    const snapshotData = {
        schoolId, classId, academicYear, term, assessment,
        createdAt: new Date().toISOString(),
        createdBy: 'backfill-script',
        className: classData.name,
        teacherName,
        studentReports: reportData,
        summaryData,
        subjects,
        teacherIdAtTimeOfSave: classData.teacherId || null,
    };

    const snapshotId = `${academicYear}-${term.replace(/\s+/g, '-')}-${assessment.replace(/\s+/g, '-')}`;
    const snapshotRef = classRef.collection('resultsSnapshots').doc(snapshotId);

    if (EXECUTE_WRITE) {
        await snapshotRef.set(snapshotData);
        console.log(`    ✅ SUCCESS: Wrote snapshot to ${snapshotRef.path}`);
    } else {
        console.log(`    DRY RUN: Would write snapshot to ${snapshotRef.path}`);
    }
}

async function main() {
    console.log(`Starting backfill script. EXECUTE_WRITE is ${EXECUTE_WRITE ? 'ON' : 'OFF'}.`);
    
    const schoolsRef = db.collection('schools');
    const schoolQuery = schoolsRef.where('name', '==', SCHOOL_NAME).limit(1);
    const schoolSnap = await schoolQuery.get();

    if (schoolSnap.empty) {
        console.error(`❌ School "${SCHOOL_NAME}" not found.`);
        return;
    }
    const school = { id: schoolSnap.docs[0].id, ...schoolSnap.docs[0].data() };
    console.log(`Found school "${school.name}" (ID: ${school.id})`);

    const marksSnap = await db.collectionGroup('marks')
        .where('schoolId', '==', school.id)
        .where('assessment', 'in', ['End of Term 1', 'End of Term 2', 'End of Term 3'])
        .get();
        
    console.log(`Found ${marksSnap.size} total end-of-term mark documents for the school.`);

    const periodsToSnapshot = new Map<string, { classId: string; academicYear: string; term: string; assessment: string; }>();
    marksSnap.forEach(doc => {
        const mark = doc.data();
        if (mark.classId && mark.academicYear && mark.term && mark.assessment) {
            const key = `${mark.classId}-${mark.academicYear}-${mark.term}-${mark.assessment}`;
            if (!periodsToSnapshot.has(key)) {
                periodsToSnapshot.set(key, {
                    classId: mark.classId,
                    academicYear: mark.academicYear,
                    term: mark.term,
                    assessment: mark.assessment
                });
            }
        }
    });

    console.log(`Found ${periodsToSnapshot.size} unique assessment periods.`);

    let missingSnapshots = 0;
    for (const [key, period] of periodsToSnapshot.entries()) {
        try {
            const snapshotId = `${period.academicYear}-${period.term.replace(/\s+/g, '-')}-${period.assessment.replace(/\s+/g, '-')}`;
            const snapshotRef = db.collection('schools').doc(school.id).collection('classes').doc(period.classId).collection('resultsSnapshots').doc(snapshotId);
            
            const snapshotDoc = await snapshotRef.get();
            if (snapshotDoc.exists) {
                console.log(`- Snapshot for ${key} already exists. Skipping.`);
            } else {
                console.log(`- Snapshot for ${key} is MISSING.`);
                missingSnapshots++;
                await generateSnapshotForPeriod(school.id, period.classId, period.academicYear, period.term, period.assessment);
            }
        } catch(e: any) {
            console.error(`  - FAILED to process period ${key}: ${e.message}`);
        }
    }
    
    console.log(`\n--- Script Complete ---`);
    console.log(`Found ${missingSnapshots} periods missing a snapshot.`);
    if (!EXECUTE_WRITE && missingSnapshots > 0) {
        console.log("This was a dry run. To apply these changes, set EXECUTE_WRITE to true in the script.");
    } else if (EXECUTE_WRITE && missingSnapshots > 0) {
        console.log("Applied changes to the database.");
    } else {
        console.log("No missing snapshots found to generate or all snapshots exist.");
    }
}

main().catch(console.error);
