'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '@/app/super-admin/schools/page';
import { Region } from '@/app/super-admin/regions/page';
import { format } from 'date-fns';

const reportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

type ReportInput = z.infer<typeof reportSchema>;

interface Student {
  id: string;
  fullName: string;
  [key: string]: any;
}

interface Subject {
  id: string;
  name: string;
  [key: string]: any;
}

interface GradeInfo {
    count: number;
    percentage: number;
}
interface GradeSummary {
    grades: {
        A: GradeInfo;
        B: GradeInfo;
        C: GradeInfo;
        D: GradeInfo;
        E: GradeInfo;
    };
    qualityPassRate: number; // AB
    passRate: number; // ABC
    failRate: number; // DE
}

interface SummaryData {
    bySubject: Record<string, GradeSummary>;
    overall: GradeSummary;
}


export async function generateClassReport(values: ReportInput) {
    const validatedFields = reportSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input', data: null };
    }
    const { schoolId, classId, academicYear, term, assessment } = validatedFields.data;
    const db = admin.firestore();

    try {
        const snapshotId = `${academicYear}-${term.replace(/\s+/g, '-')}-${assessment.replace(/\s+/g, '-')}`;
        const snapshotRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('resultsSnapshots').doc(snapshotId);
        
        const snapshotDoc = await snapshotRef.get();
        if (!snapshotDoc.exists) {
            return { success: false, message: 'No results snapshot found for the selected period. Please save the marks for this assessment first.', data: null };
        }

        const snapshotData = snapshotDoc.data()!;

        // Fetch auxiliary live data like teacher profile
        let teacher: UserProfile | null = null;
        if (snapshotData.teacherIdAtTimeOfSave) { // The snapshot should have this
            const teacherSnap = await db.collection('users').doc(snapshotData.teacherIdAtTimeOfSave).get();
            if(teacherSnap.exists) teacher = teacherSnap.data() as UserProfile;
        }
        
        const summaryData = calculateSummary(snapshotData.studentReports || [], snapshotData.subjects || []);

        return { success: true, data: { ...snapshotData, teacher, summaryData } };

    } catch (error: any) {
        console.error("Error generating report: ", error);
        return { success: false, message: error.message, data: null };
    }
}

function getGrade(percentage: number): string {
    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 30) return 'D';
    return 'E';
}

function createEmptyGradeSummary(): GradeSummary {
    return {
        grades: {
            A: { count: 0, percentage: 0 },
            B: { count: 0, percentage: 0 },
            C: { count: 0, percentage: 0 },
            D: { count: 0, percentage: 0 },
            E: { count: 0, percentage: 0 },
        },
        qualityPassRate: 0,
        passRate: 0,
        failRate: 0,
    };
}


function calculateSummary(reportData: any[], subjects: Subject[]): SummaryData {
    // Only include students who have results
    const studentsWithResults = reportData.filter(item => !item.hasNoMarks);
    const totalStudents = studentsWithResults.length;

    const summary: SummaryData = {
        bySubject: {},
        overall: createEmptyGradeSummary()
    };
     // Ensure all subjects have an entry in the summary
    subjects.forEach(subject => {
        summary.bySubject[subject.id] = createEmptyGradeSummary();
    });

    if (totalStudents === 0) {
        return summary;
    }

    // Tally grade counts
    studentsWithResults.forEach(item => {
        // Subject grades
        subjects.forEach(subject => {
            const grade = item.subjectMarks?.[subject.id]?.grade;
            if (grade && summary.bySubject[subject.id]) {
                summary.bySubject[subject.id].grades[grade as keyof GradeSummary['grades']].count++;
            }
        });
        // Overall grades
        const overallGrade = item.overall?.grade;
        if (overallGrade) {
            summary.overall.grades[overallGrade as keyof GradeSummary['grades']].count++;
        }
    });

    const gradeKeys: (keyof GradeSummary['grades'])[] = ['A', 'B', 'C', 'D', 'E'];

    // Finalize subject summaries
    subjects.forEach(subject => {
        const subjectSummary = summary.bySubject[subject.id];
        if (!subjectSummary) return;
        
        // Subject Roll is only those who SAT for this specific exam
        const subjectRoll = Object.values(subjectSummary.grades).reduce((acc, val) => acc + val.count, 0);
        if (subjectRoll === 0) return;

        let qualityPassCount = 0;
        let passCount = 0;
        let failCount = 0;
        
        gradeKeys.forEach(grade => {
            const gradeInfo = subjectSummary.grades[grade];
            gradeInfo.percentage = (gradeInfo.count / subjectRoll) * 100;
            if (grade === 'A' || grade === 'B') {
                qualityPassCount += gradeInfo.count;
            }
            if (grade === 'A' || grade === 'B' || grade === 'C') {
                passCount += gradeInfo.count;
            } else {
                failCount += gradeInfo.count;
            }
        });
        
        subjectSummary.qualityPassRate = (qualityPassCount / subjectRoll) * 100;
        subjectSummary.passRate = (passCount / subjectRoll) * 100;
        subjectSummary.failRate = (failCount / subjectRoll) * 100;
    });

    // Finalize overall summary
    let overallQualityPassCount = 0;
    let overallPassCount = 0;
    let overallFailCount = 0;
    gradeKeys.forEach(grade => {
        const gradeInfo = summary.overall.grades[grade];
        gradeInfo.percentage = (gradeInfo.count / totalStudents) * 100;
        if (grade === 'A' || grade === 'B') {
            overallQualityPassCount += gradeInfo.count;
        }
        if (grade === 'A' || grade === 'B' || grade === 'C') {
            overallPassCount += gradeInfo.count;
        } else {
            overallFailCount += gradeInfo.count;
        }
    });

    summary.overall.qualityPassRate = (overallQualityPassCount / totalStudents) * 100;
    summary.overall.passRate = (overallPassCount / totalStudents) * 100;
    summary.overall.failRate = (overallFailCount / totalStudents) * 100;

    return summary;
}
