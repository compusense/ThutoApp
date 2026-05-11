
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';

// -------- Schemas and Types --------

const subjectPerformanceSchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
  subjectId: z.string(),
});

type SubjectPerformanceInput = z.infer<typeof subjectPerformanceSchema>;

interface GradeCounts {
  A: number; B: number; C: number; D: number; E: number;
}

interface ClassPerformance {
  classId: string;
  className: string;
  roll: number;
  abPassPercentage: number;
  abcPassPercentage: number;
  gradeCounts: GradeCounts;
}

export interface SubjectPerformanceReport {
  schoolName: string;
  subjectName: string;
  academicYear: string;
  term: string;
  assessment: string;
  classPerformances: ClassPerformance[];
  totals: {
    roll: number;
    abPassPercentage: number;
    abcPassPercentage: number;
    gradeCounts: GradeCounts;
  };
}

// -------- Main Server Action: Single Subject --------

export async function getSubjectPerformance(values: SubjectPerformanceInput) {
    const validatedFields = subjectPerformanceSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input', data: null };
    }
    const { schoolId, academicYear, term, assessment, subjectId } = validatedFields.data;
    const db = admin.firestore();

    try {
        const schoolSnap = await db.collection('schools').doc(schoolId).get();
        if (!schoolSnap.exists) throw new Error('School not found');
        const schoolName = schoolSnap.data()?.name || 'Unknown School';

        const subjectSnap = await db.collection('subjects').doc(subjectId).get();
        if (!subjectSnap.exists) throw new Error('Subject not found');
        const subjectName = subjectSnap.data()?.name || 'Unknown Subject';
        
        const snapshotsQuery = db.collectionGroup('resultsSnapshots')
            .where('schoolId', '==', schoolId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment);
            
        const snapshotsSnap = await snapshotsQuery.get();

        const emptyReport: SubjectPerformanceReport = {
            schoolName, subjectName, academicYear, term, assessment, classPerformances: [],
            totals: { roll: 0, abPassPercentage: 0, abcPassPercentage: 0, gradeCounts: { A: 0, B: 0, C: 0, D: 0, E: 0 } }
        };

        if (snapshotsSnap.empty) {
            return { success: true, data: emptyReport };
        }
        
        const classPerformances: ClassPerformance[] = snapshotsSnap.docs.map(doc => {
            const data = doc.data();
            const subjectSummary = data.summaryData?.bySubject?.[subjectId];
            
            if (!subjectSummary) return null;

            const counts = {
                A: subjectSummary.grades.A?.count ?? 0,
                B: subjectSummary.grades.B?.count ?? 0,
                C: subjectSummary.grades.C?.count ?? 0,
                D: subjectSummary.grades.D?.count ?? 0,
                E: subjectSummary.grades.E?.count ?? 0,
            };

            const roll = Object.values(counts).reduce((acc, val) => acc + val, 0);
            if (roll === 0) return null;

            return {
                classId: data.classId,
                className: data.className,
                roll: roll,
                abPassPercentage: subjectSummary.qualityPassRate ?? 0,
                abcPassPercentage: subjectSummary.passRate ?? 0,
                gradeCounts: counts,
            };
        }).filter((p): p is ClassPerformance => p !== null).sort((a,b) => a.className.localeCompare(b.className));
        
        const totals = calculateTotals(classPerformances);

        return { success: true, data: { schoolName, subjectName, academicYear, term, assessment, classPerformances, totals } };

    } catch (error: any) {
        console.error("Error generating subject performance report: ", error);
        if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: "A database index is required for this query. Please check your server logs for a 'FAILED_PRECONDITION' error. The error message will contain a URL to create the required index in the Firebase Console.", data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}


// -------- New Server Action: All Subjects --------
const allSubjectsReportSchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

export interface AllSubjectsReportData {
    subjectName: string;
    passRate: number; // ABC pass rate
}

export async function generateAllSubjectsReport(values: z.infer<typeof allSubjectsReportSchema>) {
    const { schoolId, academicYear, term, assessment } = allSubjectsReportSchema.parse(values);
    const db = admin.firestore();

    try {
        const snapshotsQuery = db.collectionGroup('resultsSnapshots')
            .where('schoolId', '==', schoolId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment);
        
        const snapshotsSnap = await snapshotsQuery.get();

        if (snapshotsSnap.empty) {
            return { success: true, data: [] };
        }
        
        const subjectAggregates: Record<string, { passCount: number, totalStudents: number, name: string }> = {};

        snapshotsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.summaryData?.bySubject) return;

            for (const subjectId in data.summaryData.bySubject) {
                const subjectSummary = data.summaryData.bySubject[subjectId];
                const subjectName = data.subjects?.find((s: any) => s.id === subjectId)?.name || 'Unknown';
                
                if (!subjectAggregates[subjectId]) {
                    subjectAggregates[subjectId] = { passCount: 0, totalStudents: 0, name: subjectName };
                }
                
                const counts = {
                    A: subjectSummary.grades.A?.count ?? 0,
                    B: subjectSummary.grades.B?.count ?? 0,
                    C: subjectSummary.grades.C?.count ?? 0,
                    D: subjectSummary.grades.D?.count ?? 0,
                    E: subjectSummary.grades.E?.count ?? 0,
                };

                const totalInClassForSubject = Object.values(counts).reduce((acc, val) => acc + val, 0);
                const passingInClassForSubject = counts.A + counts.B + counts.C;

                subjectAggregates[subjectId].totalStudents += totalInClassForSubject;
                subjectAggregates[subjectId].passCount += passingInClassForSubject;
            }
        });
        
        const reportData: AllSubjectsReportData[] = Object.entries(subjectAggregates)
            .map(([_, agg]) => ({
                subjectName: agg.name,
                passRate: agg.totalStudents > 0 ? parseFloat(((agg.passCount / agg.totalStudents) * 100).toFixed(1)) : 0,
            }))
            .filter(r => r.passRate > 0)
            .sort((a,b) => b.passRate - a.passRate);


        return { success: true, data: reportData };

    } catch (error: any) {
        console.error("Error generating all subjects report: ", error);
        if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: "A database index is required for this query. Please check your server logs for a 'FAILED_PRECONDITION' error. The error message will contain a URL to create the required index in the Firebase Console.", data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}


// -------- Helper Functions --------

function calculateTotals(performances: ClassPerformance[]) {
    const totals = {
        roll: 0,
        abPassPercentage: 0,
        abcPassPercentage: 0,
        gradeCounts: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    };
    
    let totalWeightedAbSum = 0;
    let totalWeightedAbcSum = 0;

    performances.forEach(p => {
        totals.roll += p.roll;
        totalWeightedAbSum += p.abPassPercentage * p.roll;
        totalWeightedAbcSum += p.abcPassPercentage * p.roll;
        totals.gradeCounts.A += p.gradeCounts.A;
        totals.gradeCounts.B += p.gradeCounts.B;
        totals.gradeCounts.C += p.gradeCounts.C;
        totals.gradeCounts.D += p.gradeCounts.D;
        totals.gradeCounts.E += p.gradeCounts.E;
    });

    if (totals.roll > 0) {
        totals.abPassPercentage = totalWeightedAbSum / totals.roll;
        totals.abcPassPercentage = totalWeightedAbcSum / totals.roll;
    }

    return totals;
}
