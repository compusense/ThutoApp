
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';

const trackRecordSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  startYear: z.number(),
  startTerm: z.enum(['Term 1', 'Term 2', 'Term 3']),
});

type TrackRecordInput = z.infer<typeof trackRecordSchema>;

export interface StudentTrackRecord {
  studentId: string;
  studentName: string;
  results: Record<string, number | null>; // Keyed by "YYYY Term X"
  average: number | null;
}

export interface TrackRecordData {
    periods: string[];
    records: StudentTrackRecord[];
}


export async function getStudentTrackRecord(values: TrackRecordInput): Promise<{ success: boolean; message: string; data: TrackRecordData | null; }> {
    const validatedFields = trackRecordSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input', data: null };
    }

    const { schoolId, classId, startYear, startTerm } = validatedFields.data;
    const db = admin.firestore();

    try {
        // 1. Get current students in the class
        const studentsSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').get();
        const studentIds = studentsSnap.docs.map(doc => doc.id);
        if (studentIds.length === 0) {
            return { success: true, message: "No students in this class.", data: { periods: [], records: [] } };
        }
        
        // Fetch student details one-by-one to avoid 'in' query limit
        const studentMap = new Map<string, string>();
        for (const studentId of studentIds) {
            const studentDoc = await db.collection('schools').doc(schoolId).collection('students').doc(studentId).get();
            if (studentDoc.exists) {
                const data = studentDoc.data()!;
                studentMap.set(studentId, `${data.firstName} ${data.surname}`);
            }
        }

        // 2. Determine all relevant periods (e.g., "2023 Term 1", "2023 Term 2", ...)
        const periods = getTrackingPeriods(startYear, startTerm);

        // 3. Fetch all "End of Term" marks for all relevant students
        const allMarks: { studentId: string; academicYear: string; term: string; score: number; total: number; }[] = [];
        
        // This is a series of queries, which can be slow for many students. In a real-world scenario with large datasets,
        // this data might be pre-aggregated or structured differently.
        for (const studentId of studentIds) {
            const marksSnap = await db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
                .where('assessment', 'in', ['End of Term 1', 'End of Term 2', 'End of Term 3'])
                .get();
            marksSnap.forEach(doc => {
                allMarks.push({ studentId, ...doc.data() } as any);
            });
        }
        
        // 4. Process data for each student
        const studentRecords = studentIds.map(studentId => {
            const record: StudentTrackRecord = {
                studentId,
                studentName: studentMap.get(studentId) || 'Unknown Student',
                results: {},
                average: null,
            };

            let totalPercentage = 0;
            let resultCount = 0;

            periods.forEach(period => {
                const [year, term] = period.split(' ');
                const termName = `Term ${term.substring(1)}`;
                
                const relevantMarks = allMarks.filter(m => m.studentId === studentId && m.academicYear === year && m.term === termName);

                if (relevantMarks.length === 0) {
                    record.results[period] = null;
                } else {
                    const totalScore = relevantMarks.reduce((acc, m) => acc + m.score, 0);
                    const totalMax = relevantMarks.reduce((acc, m) => acc + m.total, 0);
                    const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                    record.results[period] = percentage;
                    totalPercentage += percentage;
                    resultCount++;
                }
            });

            record.average = resultCount > 0 ? totalPercentage / resultCount : null;
            return record;
        });

        // Sort by average descending
        studentRecords.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

        return { success: true, message: 'Report generated', data: { periods, records: studentRecords } };

    } catch (error: any) {
        console.error("Error generating tracking report: ", error);
        return { success: false, message: error.message, data: null };
    }
}

function getTrackingPeriods(startYear: number, startTerm: 'Term 1' | 'Term 2' | 'Term 3'): string[] {
    const periods: string[] = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11

    let currentTermNum;
    if (currentMonth < 4) currentTermNum = 1; // Jan-Apr -> Term 1
    else if (currentMonth < 8) currentTermNum = 2; // May-Aug -> Term 2
    else currentTermNum = 3; // Sep-Dec -> Term 3

    const startTermNum = parseInt(startTerm.split(' ')[1]);

    for (let year = startYear; year <= currentYear; year++) {
        const start = (year === startYear) ? startTermNum : 1;
        const end = (year === currentYear) ? currentTermNum : 3;

        for (let term = start; term <= end; term++) {
            periods.push(`${year} T${term}`);
        }
    }
    return periods;
}
