
'use server';

import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';

interface ResultRecord {
  year: string;
  term: string;
  className: string;
  classPassRate: number;
  studentRoll: number;
}

interface Mark {
  studentId: string;
  schoolId: string;
  classId: string;
  academicYear: string;
  term: string;
  assessment: string;
  score: number;
  total: number;
}

export async function getTeacherTrackRecord(teacherId: string, subRegionId?: string): Promise<ResultRecord[]> {
  const db = admin.firestore();

  try {
    if (!subRegionId) {
        throw new Error("Sub-Region ID is required to fetch staff records.");
    }

    // 1. Get all schools in the sub-region
    const schoolsSnap = await db.collection('schools').where('subRegionId', '==', subRegionId).get();
    const schoolsInSubRegion = schoolsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
    const schoolIdsInSubRegion = schoolsInSubRegion.map(s => s.id);

    if (schoolIdsInSubRegion.length === 0) {
        return [];
    }
    
    // 2. Get all classes for all schools in the sub-region
    let allSubRegionClasses: any[] = [];
    for (const schoolId of schoolIdsInSubRegion) {
        const classesSnap = await db.collection('schools').doc(schoolId).collection('classes').get();
        classesSnap.forEach(doc => {
            allSubRegionClasses.push({ id: doc.id, schoolId, ...doc.data() });
        });
    }

    // 3. Filter these classes in code to find the ones taught by the target teacher
    const teacherClasses = allSubRegionClasses.filter(c => c.teacherId === teacherId);

    if (teacherClasses.length === 0) {
        return [];
    }

    const allResults: ResultRecord[] = [];

    // 4. For each class, calculate the pass rate for each term it was taught by the teacher
    for (const taughtClass of teacherClasses) {
      
        const studentsSnap = await db.collection('schools').doc(taughtClass.schoolId).collection('classes').doc(taughtClass.id).collection('students').get();
        const studentIds = studentsSnap.docs.map(doc => doc.id);
        
        if (studentIds.length === 0) continue;

        const allMarksForClassStudents: Mark[] = [];
        for (const studentId of studentIds) {
            const studentMarksSnap = await db.collection('schools').doc(taughtClass.schoolId).collection('students').doc(studentId).collection('marks').get();
            studentMarksSnap.forEach(doc => {
                allMarksForClassStudents.push({ studentId, schoolId: taughtClass.schoolId, ...doc.data()} as Mark);
            });
        }
        
        const marksByPeriod: Record<string, Mark[]> = allMarksForClassStudents
            .filter(mark => 
                mark.classId === taughtClass.id && 
                mark.assessment.startsWith('End of Term')
            )
            .reduce((acc, mark) => {
                const key = `${mark.academicYear}__${mark.term}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(mark);
                return acc;
            }, {} as Record<string, Mark[]>);
        
        for (const periodKey in marksByPeriod) {
            const [year, term] = periodKey.split('__');
            const marksInPeriod = marksByPeriod[periodKey];
            
            const marksByStudent = marksInPeriod.reduce((acc, mark) => {
                if (!acc[mark.studentId]) {
                    acc[mark.studentId] = { totalScore: 0, totalMax: 0 };
                }
                acc[mark.studentId].totalScore += mark.score;
                acc[mark.studentId].totalMax += mark.total;
                return acc;
            }, {} as Record<string, { totalScore: number, totalMax: number }>);

            const studentCount = Object.keys(marksByStudent).length;
            if (studentCount === 0) continue;

            let passingStudents = 0;
            for (const studentId in marksByStudent) {
                const { totalScore, totalMax } = marksByStudent[studentId];
                const average = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
                if (average >= 50) {
                    passingStudents++;
                }
            }
            
            const classPassRate = (passingStudents / studentCount) * 100;

            allResults.push({
                year,
                term,
                className: taughtClass.name || 'Unknown Class',
                classPassRate,
                studentRoll: studentCount,
            });
        }
    }

    return allResults.sort((a, b) =>
      b.year.localeCompare(a.year) || b.term.localeCompare(a.term)
    );

  } catch (error: any) {
    console.error('Error fetching teacher track record:', error);
    if (error.code === 5 || (error as any).code === 'FAILED_PRECONDITION') {
      console.error("**********************************************************************************");
      console.error("A Firestore index is required for the Teacher Track Record report. Please copy the link below and paste it into your browser to create the index:");
      console.error(error.message);
      console.error("**********************************************************************************");
      throw new Error('A Firestore index is required. Please check your Firestore console for index suggestions. Review logs for query details.');
    }
    throw new Error(`Failed to fetch teacher performance data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
