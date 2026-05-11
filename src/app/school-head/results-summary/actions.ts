
'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';

// -------- Base Types & Schemas --------

interface GradeInfo {
  count: number;
  percentage: number;
}
interface GradeCounts {
  A: GradeInfo; B: GradeInfo; C: GradeInfo; D: GradeInfo; E: GradeInfo;
}
interface CombinedCounts {
  AB: number; ABC: number; DE: number;
}
interface GradePercentages {
  A: number; B: number; C: number; D: number; E: number; AB: number; ABC: number; DE: number;
}

interface BaseSummary {
  roll: number;
  gradeCounts: GradeCounts;
  combinedCounts: CombinedCounts;
  gradePercentages: GradePercentages;
}

interface SummaryWithGender extends BaseSummary {
  genderSummaries: {
    boys: BaseSummary;
    girls: BaseSummary;
  };
}

interface ClassSummary extends SummaryWithGender {
  classId: string;
  className: string;
}

export interface SchoolSummaryReport {
  schoolName: string;
  academicYear: string;
  term: string;
  assessment: string;
  classSummaries: ClassSummary[];
  totals: ClassSummary;
}

// -------- Helper Functions --------

function createEmptyBaseSummary(): BaseSummary {
    return {
        roll: 0,
        gradeCounts: { 
            A: { count: 0, percentage: 0 }, 
            B: { count: 0, percentage: 0 }, 
            C: { count: 0, percentage: 0 }, 
            D: { count: 0, percentage: 0 }, 
            E: { count: 0, percentage: 0 }, 
        },
        combinedCounts: { AB: 0, ABC: 0, DE: 0 },
        gradePercentages: { A: 0, B: 0, C: 0, D: 0, E: 0, AB: 0, ABC: 0, DE: 0 }
    };
}

function createEmptyClassSummary(classId: string, className: string): ClassSummary {
    return {
        ...createEmptyBaseSummary(),
        classId,
        className,
        genderSummaries: {
            boys: createEmptyBaseSummary(),
            girls: createEmptyBaseSummary(),
        }
    };
}

function calculatePercentages(summary: BaseSummary) {
    if (!summary || !summary.roll) return;
    const { roll, gradeCounts } = summary;
    if (!gradeCounts || roll === 0) return;

    const gradeKeys: (keyof GradeCounts)[] = ['A', 'B', 'C', 'D', 'E'];

    gradeKeys.forEach((key) => {
        if (gradeCounts[key]) {
            const percentage = (gradeCounts[key].count / roll) * 100;
            gradeCounts[key].percentage = percentage;
            summary.gradePercentages[key] = percentage;
        }
    });

    summary.combinedCounts.AB = (gradeCounts.A?.count || 0) + (gradeCounts.B?.count || 0);
    summary.combinedCounts.ABC = (gradeCounts.A?.count || 0) + (gradeCounts.B?.count || 0) + (gradeCounts.C?.count || 0);
    summary.combinedCounts.DE = (gradeCounts.D?.count || 0) + (gradeCounts.E?.count || 0);

    summary.gradePercentages.AB = (summary.combinedCounts.AB / roll) * 100;
    summary.gradePercentages.ABC = (summary.combinedCounts.ABC / roll) * 100;
    summary.gradePercentages.DE = (summary.combinedCounts.DE / roll) * 100;
}

function calculateClassTotals(summaries: ClassSummary[]): ClassSummary {
    const totalSummary = createEmptyClassSummary('TOTAL', 'TOTAL');
    const gradeKeys: (keyof GradeCounts)[] = ['A', 'B', 'C', 'D', 'E'];

    summaries.forEach(summary => {
        totalSummary.roll += summary?.roll || 0;
        
        gradeKeys.forEach(key => {
            totalSummary.gradeCounts[key].count += summary?.gradeCounts?.[key]?.count || 0;
        });

        const boysSummary = summary?.genderSummaries?.boys;
        if (boysSummary) {
            totalSummary.genderSummaries.boys.roll += boysSummary.roll || 0;
            gradeKeys.forEach(key => {
                 totalSummary.genderSummaries.boys.gradeCounts[key].count += boysSummary?.gradeCounts?.[key]?.count || 0;
            });
        }

        const girlsSummary = summary?.genderSummaries?.girls;
        if (girlsSummary) {
            totalSummary.genderSummaries.girls.roll += girlsSummary.roll || 0;
            gradeKeys.forEach(key => {
                totalSummary.genderSummaries.girls.gradeCounts[key].count += girlsSummary?.gradeCounts?.[key]?.count || 0;
            });
        }
    });

    calculatePercentages(totalSummary);
    calculatePercentages(totalSummary.genderSummaries.boys);
    calculatePercentages(totalSummary.genderSummaries.girls);
    return totalSummary;
}


// -------- Main Server Action --------
const schoolSummarySchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

export async function generateSchoolResultsSummary(values: z.infer<typeof schoolSummarySchema>) {
    const validatedFields = schoolSummarySchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input', data: null };
    }
    const { schoolId, academicYear, term, assessment } = validatedFields.data;
    const db = admin.firestore();

    try {
        const schoolSnap = await db.collection('schools').doc(schoolId).get();
        if (!schoolSnap.exists) throw new Error('School not found');
        const schoolName = schoolSnap.data()?.name || 'Unknown School';

        const snapshotsQuery = db.collectionGroup('resultsSnapshots')
            .where('schoolId', '==', schoolId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment);
        
        const snapshotsSnap = await snapshotsQuery.get();

        const emptyReport: SchoolSummaryReport = {
          schoolName,
          academicYear,
          term,
          assessment,
          classSummaries: [],
          totals: createEmptyClassSummary('TOTAL', 'TOTAL'),
        };

        if (snapshotsSnap.empty) {
            return { success: true, data: emptyReport };
        }
        
        const classSummariesMap = new Map<string, ClassSummary>();

        snapshotsSnap.forEach(doc => {
            const data = doc.data();
            if (!data || !data.classId) return;

            const summary = classSummariesMap.get(data.classId) || createEmptyClassSummary(data.classId, data.className);

            if (data.studentReports && Array.isArray(data.studentReports)) {
                data.studentReports.forEach((report: any) => {
                    const overallGrade = report?.overall?.grade;
                    const studentGender = report?.student?.gender;

                    if (overallGrade && typeof overallGrade === 'string' && summary.gradeCounts.hasOwnProperty(overallGrade)) {
                        summary.roll++;
                        summary.gradeCounts[overallGrade as keyof GradeCounts].count++;
                        if (studentGender === 'Male' && summary.genderSummaries.boys.gradeCounts[overallGrade as keyof GradeCounts]) {
                            summary.genderSummaries.boys.roll++;
                            summary.genderSummaries.boys.gradeCounts[overallGrade as keyof GradeCounts].count++;
                        } else if (studentGender === 'Female' && summary.genderSummaries.girls.gradeCounts[overallGrade as keyof GradeCounts]) {
                            summary.genderSummaries.girls.roll++;
                            summary.genderSummaries.girls.gradeCounts[overallGrade as keyof GradeCounts].count++;
                        }
                    }
                });
            }
            classSummariesMap.set(data.classId, summary);
        });

        classSummariesMap.forEach(summary => {
            if (summary.roll > 0) {
                calculatePercentages(summary);
                calculatePercentages(summary.genderSummaries.boys);
                calculatePercentages(summary.genderSummaries.girls);
            }
        });

        const validSummaries = Array.from(classSummariesMap.values())
            .filter(summary => summary.roll > 0)
            .sort((a,b) => a.className.localeCompare(b.className));
            
        const totals = calculateClassTotals(validSummaries);

        return { success: true, data: { schoolName, academicYear, term, assessment, classSummaries: validSummaries, totals } };

    } catch (error: any) {
        console.error("Error generating school summary report: ", error);
        if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: "A database index is required for this query. Please check your server logs for a 'FAILED_PRECONDITION' error. The error message will contain a URL to create the required index in the Firebase Console.", data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}
