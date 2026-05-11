
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

// -------- School-Level Summary (for Sub-Region) --------

const subRegionSchoolSummarySchema = z.object({
  subRegionId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

interface SchoolSummary extends BaseSummary {
  schoolId: string;
  schoolName: string;
}

export interface SubRegionSchoolSummaryReport {
  subRegionName: string;
  academicYear: string;
  term: string;
  assessment: string;
  schoolSummaries: SchoolSummary[];
  totals: SchoolSummary;
}

export async function generateSubRegionSchoolSummary(values: z.infer<typeof subRegionSchoolSummarySchema>) {
    const { subRegionId, academicYear, term, assessment } = subRegionSchoolSummarySchema.parse(values);
    const db = admin.firestore();

    try {
        const subRegionSnap = await db.collection('subRegions').doc(subRegionId).get();
        if (!subRegionSnap.exists) throw new Error('Sub-Region not found');
        const subRegionName = subRegionSnap.data()?.name || 'Unknown Sub-Region';

        const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
        const emptyReport: SubRegionSchoolSummaryReport = { subRegionName, academicYear, term, assessment, schoolSummaries: [], totals: createEmptySchoolSummary('TOTAL', 'TOTAL') };

        if (schoolsSnap.empty) {
            return { success: true, data: emptyReport };
        }

        const schoolMap = new Map<string, string>();
        schoolsSnap.docs.forEach(doc => schoolMap.set(doc.id, doc.data().name));
        const schoolIds = Array.from(schoolMap.keys());
        
        const snapshotsQuery = db.collectionGroup('resultsSnapshots')
            .where('schoolId', 'in', schoolIds)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('assessment', '==', assessment);
        
        const snapshotsSnap = await snapshotsQuery.get();
        if (snapshotsSnap.empty) {
            return { success: true, data: emptyReport };
        }
        
        const schoolSummariesMap = new Map<string, SchoolSummary>();
        snapshotsSnap.forEach(snapshotDoc => {
            const data = snapshotDoc.data();
            const schoolId = data.schoolId;
            const schoolName = schoolMap.get(schoolId) || 'Unknown School';

            const summary = schoolSummariesMap.get(schoolId) || createEmptySchoolSummary(schoolId, schoolName);

            if (data.studentReports && Array.isArray(data.studentReports)) {
                data.studentReports.forEach((report: any) => {
                    const overallGrade = report?.overall?.grade;
                    if (overallGrade && typeof overallGrade === 'string' && summary.gradeCounts.hasOwnProperty(overallGrade)) {
                        summary.roll++;
                        summary.gradeCounts[overallGrade as keyof GradeCounts].count++;
                    }
                });
            }
            schoolSummariesMap.set(schoolId, summary);
        });

        schoolSummariesMap.forEach(summary => {
            if(summary.roll > 0) {
                calculatePercentages(summary);
            }
        });
        
        const validSummaries = Array.from(schoolSummariesMap.values()).filter(s => s.roll > 0).sort((a,b) => a.schoolName.localeCompare(b.schoolName));
        const totals = calculateSchoolTotals(validSummaries);

        return { success: true, data: { subRegionName, academicYear, term, assessment, schoolSummaries: validSummaries, totals } };

    } catch (error: any) {
        console.error("Error generating sub-region summary report: ", error);
        if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: "A database index is required for this query. Please check your server logs for a 'FAILED_PRECONDITION' error. The error message will contain a URL to create the required index in the Firebase Console.", data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}

// -------- School-Level Summary (for a single school) --------

const schoolClassSummarySchema = z.object({
  schoolId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
});

interface ClassSummary extends BaseSummary {
  classId: string;
  className: string;
}

export interface SchoolClassSummaryReport {
  schoolName: string;
  academicYear: string;
  term: string;
  assessment: string;
  classSummaries: ClassSummary[];
  totals: ClassSummary;
}

export async function generateSchoolClassSummary(values: z.infer<typeof schoolClassSummarySchema>) {
    const { schoolId, academicYear, term, assessment } = schoolClassSummarySchema.parse(values);
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

        const emptyReport: SchoolClassSummaryReport = { schoolName, academicYear, term, assessment, classSummaries: [], totals: createEmptyClassSummary('TOTAL', 'TOTAL') };
        if (snapshotsSnap.empty) return { success: true, data: emptyReport };

        const classSummariesMap = new Map<string, ClassSummary>();

        snapshotsSnap.forEach(doc => {
            const data = doc.data();
            if (!data || !data.classId) return;

            const summary = classSummariesMap.get(data.classId) || createEmptyClassSummary(data.classId, data.className);
            
            if (data.studentReports && Array.isArray(data.studentReports)) {
                data.studentReports.forEach((report: any) => {
                    const overallGrade = report?.overall?.grade;
                    if (overallGrade && typeof overallGrade === 'string' && summary.gradeCounts.hasOwnProperty(overallGrade)) {
                        summary.roll++;
                        summary.gradeCounts[overallGrade as keyof GradeCounts].count++;
                    }
                });
            }
            classSummariesMap.set(data.classId, summary);
        });

        classSummariesMap.forEach(summary => {
            if(summary.roll > 0) {
                calculatePercentages(summary);
            }
        });
        
        const validSummaries = Array.from(classSummariesMap.values()).filter(summary => summary.roll > 0).sort((a,b) => a.className.localeCompare(b.className));
        const totals = calculateClassTotals(validSummaries);

        return { success: true, data: { schoolName, academicYear, term, assessment, classSummaries: validSummaries, totals } };
    } catch (error: any) {
        console.error("Error generating school class summary report: ", error);
        if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: "A database index is required for this query. Please check your server logs for a 'FAILED_PRECONDITION' error. The error message will contain a URL to create the required index in the Firebase Console.", data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}


// -------- Helper & Processing Functions --------
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
function createEmptySchoolSummary(schoolId: string, schoolName: string): SchoolSummary {
    return { 
        ...createEmptyBaseSummary(),
        schoolId, 
        schoolName,
    };
}

function createEmptyClassSummary(classId: string, className: string): ClassSummary {
    return { 
        ...createEmptyBaseSummary(),
        classId, 
        className, 
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

function calculateSchoolTotals(summaries: SchoolSummary[]): SchoolSummary {
    const totalSummary = createEmptySchoolSummary('TOTAL', 'TOTAL');
    const gradeKeys: (keyof GradeCounts)[] = ['A', 'B', 'C', 'D', 'E'];

    summaries.forEach(summary => {
        totalSummary.roll += summary?.roll || 0;
        
        gradeKeys.forEach(key => {
            totalSummary.gradeCounts[key].count += summary?.gradeCounts?.[key]?.count || 0;
        });
    });

    calculatePercentages(totalSummary);
    return totalSummary;
}

function calculateClassTotals(summaries: ClassSummary[]): ClassSummary {
    const totalSummary = createEmptyClassSummary('TOTAL', 'TOTAL');
    const gradeKeys: (keyof GradeCounts)[] = ['A', 'B', 'C', 'D', 'E'];

    summaries.forEach(summary => {
        totalSummary.roll += summary?.roll || 0;
        
        gradeKeys.forEach(key => {
            totalSummary.gradeCounts[key].count += summary?.gradeCounts?.[key]?.count || 0;
        });
    });

    calculatePercentages(totalSummary);
    return totalSummary;
}
