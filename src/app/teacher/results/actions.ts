
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '@/app/super-admin/schools/page';
import { Region } from '@/app/super-admin/regions/page';
import { format } from 'date-fns';
import { Class } from '@/app/school-head/classes/page';

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
  gender?: 'Male' | 'Female';
  [key: string]: any;
}

interface Subject {
  id: string;
  name: string;
  [key: string]: any;
}

interface ReportStudentData {
  student: { id: string; fullName: string, gender?: 'Male' | 'Female' };
  subjectMarks: Record<
    string,
    {
      totalScore: number;
      totalMax: number;
      percentage: number;
      grade: string;
    }
  >;
  overall: {
    totalScore: number;
    totalMax: number;
    percentage: number;
    grade: string;
  };
}

interface SummaryData {
    bySubject: Record<string, any>;
    overall: any;
    gender: any;
}

export interface TeacherClassReportData {
    classData: Class;
    teacher: UserProfile | null;
    students: Student[];
    subjects: Subject[];
    reportData: ReportStudentData[];
    summaryData: SummaryData;
}


export async function generateClassReport(values: ReportInput): Promise<{
  success: boolean;
  message: string;
  data: TeacherClassReportData | null;
}> {
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

        // Reconstruct the data to match the frontend component's expected format
        const reportData: TeacherClassReportData = {
            classData: {
                id: classId,
                name: snapshotData.className,
                schoolId: schoolId,
                gradeLevel: '', // Not essential for this view
                stream: '', // Not essential for this view
                academicYear: academicYear,
            },
            teacher: teacher,
            students: snapshotData.studentReports.map((r: any) => ({
                id: r.student.id,
                fullName: r.student.fullName,
                gender: r.student.gender
            })),
            subjects: snapshotData.subjects,
            reportData: snapshotData.studentReports.map((r: any) => ({
                student: r.student,
                subjectMarks: r.subjectMarks,
                overall: r.overall
            })),
            summaryData: snapshotData.summaryData
        };

        return { success: true, message: 'Report generated from snapshot.', data: reportData };

    } catch (error: any) {
        console.error("Error generating report from snapshot: ", error);
        return { success: false, message: error.message, data: null };
    }
}
