'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '@/app/super-admin/schools/page';
import { Region } from '@/app/super-admin/regions/page';
import { format } from 'date-fns';
import { formatTeacherName } from '@/lib/utils';

// Reuse types from teacher's report action
import type { ReportData } from '@/app/teacher/reports/actions';
export type { ReportData } from '@/app/teacher/reports/actions';

interface Subject {
  id: string;
  name: string;
}

// Helper to get grade and remarks based on percentage
function getGrade(percentage: number): { symbol: string; remarks: string } {
  if (percentage >= 80) return { symbol: 'A', remarks: 'Excellent' };
  if (percentage >= 65) return { symbol: 'B', remarks: 'Very Good' };
  if (percentage >= 50) return { symbol: 'C', remarks: 'Good' };
  if (percentage >= 30) return { symbol: 'D', remarks: 'Fair' };
  return { symbol: 'E', remarks: 'Unsatisfactory' };
}

// Helper to calculate age from date of birth string
function getAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  try {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

// Action to get available report periods
export async function getStudentAvailableReports(idToken: string): Promise<{
  success: boolean;
  message: string;
  data: { period: string; display: string }[] | null;
}> {
  console.log('[ACTION LOG] getStudentAvailableReports: Action started.');
  try {
    if (!idToken) throw new Error("Authentication required.");
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, schoolId } = decodedToken;
    console.log(`[ACTION LOG] Decoded token: uid=${uid}, schoolId=${schoolId}`);

    if (!schoolId) throw new Error("User not associated with a school.");

    const db = admin.firestore();
    const studentRecordSnap = await db.collection('schools').doc(schoolId).collection('students').where('uid', '==', uid).limit(1).get();
    if (studentRecordSnap.empty) {
        console.log(`[ACTION LOG] No student document found in school '${schoolId}' for uid '${uid}'.`);
        throw new Error("Student record not found in the school's registry.");
    }
    const studentId = studentRecordSnap.docs[0].id;
    console.log(`[ACTION LOG] Found student document ID: ${studentId}`);

    const marksSnap = await db.collectionGroup('marks')
        .where('studentId', '==', studentId)
        .where('assessment', 'in', ['End of Term 1', 'End of Term 2', 'End of Term 3'])
        .get();
        
    console.log(`[ACTION LOG] Found ${marksSnap.size} 'End of Term' mark documents for student ${studentId}.`);
    if (marksSnap.empty) {
        return { success: true, message: 'No reports found', data: [] };
    }

    const periods = new Set<string>();
    marksSnap.forEach(doc => {
      const mark = doc.data();
      periods.add(`${mark.academicYear}|${mark.term}|${mark.classId}`);
    });
    
    console.log(`[ACTION LOG] Found ${periods.size} unique report periods:`, Array.from(periods));
    
    const sortedPeriods = Array.from(periods).sort((a, b) => b.localeCompare(a));
    
    const data = sortedPeriods.map(p => {
        const [year, term] = p.split('|');
        return {
            period: p,
            display: `${term}, ${year}`,
        }
    });

    return { success: true, message: 'Periods found', data };

  } catch (error: any) {
    console.error('[ACTION ERROR] getStudentAvailableReports:', error);
    return { success: false, message: error.message, data: null };
  }
}

// Action to get report data for a specific period
const getReportSchema = z.object({
  period: z.string(), // "year|term|classId"
});

export async function getStudentReportData(values: z.infer<typeof getReportSchema>, idToken: string): Promise<{ success: boolean; message: string; data: ReportData | null }> {
  try {
    if (!idToken) throw new Error("Authentication required.");
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const { uid, schoolId } = decodedToken;
    if (!schoolId) throw new Error("User not associated with a school.");

    const [academicYear, term, classId] = values.period.split('|');
    const assessmentName = `End of ${term}`;

    const db = admin.firestore();
    const studentRecordSnap = await db.collection('schools').doc(schoolId).collection('students').where('uid', '==', uid).limit(1).get();
    if (studentRecordSnap.empty) throw new Error("Student record not found.");
    const studentDoc = studentRecordSnap.docs[0];
    const studentData = studentDoc.data();
    
    const schoolSnap = await db.collection('schools').doc(schoolId).get();
    const schoolData = schoolSnap.data() as School;
    const regionSnap = await db.collection('regions').doc(schoolData.regionId).get();
    const districtCouncil = (regionSnap.data() as Region)?.name.toUpperCase() + ' DISTRICT COUNCIL';

    const classSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).get();
    const classData = classSnap.data()!;

    let classTeacher: UserProfile | null = null;
    if (classData.teacherId) {
        const teacherSnap = await db.collection('users').doc(classData.teacherId).get();
        if (teacherSnap.exists) classTeacher = teacherSnap.data() as UserProfile;
    }
    
    let headTeacher: UserProfile | null = null;
    if (schoolData.schoolHeadId) {
        const headTeacherSnap = await db.collection('users').doc(schoolData.schoolHeadId).get();
        if (headTeacherSnap.exists) headTeacher = headTeacherSnap.data() as UserProfile;
    }
    
    const classSubjectsSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects').where('academicYear', '==', academicYear).get();
    const subjectIds = classSubjectsSnap.docs.map(doc => doc.data().subjectId);
    
    let subjects: Subject[] = [];
    if (subjectIds.length > 0) {
        const subjectChunks = [];
        for (let i = 0; i < subjectIds.length; i += 30) {
            subjectChunks.push(subjectIds.slice(i, i + 30));
        }

        for (const chunk of subjectChunks) {
            const masterSubjectsSnap = await db.collection('subjects').where(firestore.FieldPath.documentId(), 'in', chunk).get();
            subjects.push(...masterSubjectsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        }
        subjects.sort((a,b) => a.name.localeCompare(b.name));
    }
    
    const marksSnap = await db.collection('schools').doc(schoolId).collection('students').doc(studentDoc.id).collection('marks')
      .where('academicYear', '==', academicYear)
      .where('term', '==', term)
      .where('assessment', '==', assessmentName)
      .get();
    const marks = marksSnap.docs.map(doc => doc.data());
    
    // Process marks
    let totalPupilMark = 0;
    let totalPossibleMark = 0;
    const subjectResults = subjects.map(subject => {
        const mark = marks.find(m => m.subjectId === subject.id);
        const pupilMark = mark?.score || 0;
        const possibleMark = mark?.total || 0;
        const percentage = possibleMark > 0 ? (pupilMark / possibleMark) * 100 : 0;
        const grade = mark ? getGrade(percentage) : { symbol: '-', remarks: 'N/A' };

        totalPupilMark += pupilMark;
        totalPossibleMark += possibleMark;

        return { subjectName: subject.name, symbol: grade.symbol, possibleMark, pupilMark, percentage, remarks: grade.remarks };
    });
    
    const overallPercentage = totalPossibleMark > 0 ? (totalPupilMark / totalPossibleMark) * 100 : 0;
    const overallGrade = getGrade(overallPercentage);
    
    const studentReport = {
        student: { id: studentDoc.id, fullName: `${studentData.firstName} ${studentData.surname}`.toUpperCase(), age: getAge(studentData.dateOfBirth), admissionNumber: studentData.admissionNumber },
        subjects: subjectResults,
        overall: { symbol: overallGrade.symbol, possibleMark: totalPossibleMark, pupilMark: totalPupilMark, percentage: overallPercentage, remarks: overallGrade.remarks },
        positionInClass: 0,
    };

    const teacherName = classTeacher ? formatTeacherName(classTeacher) : 'N/A';

    const finalReportData: ReportData = {
        districtCouncil,
        schoolName: schoolData.name.toUpperCase(),
        termEnding: format(new Date(), 'PPP'),
        className: `STANDARD ${classData.gradeLevel.replace('Standard ', '')}${classData.stream || ''}`,
        classTeacherName: classTeacher,
        headTeacherName: headTeacher,
        teacherName,
        numInClass: 0,
        studentReports: [studentReport],
        academicYear,
        term,
        classData,
        summaryData: null,
        subjects: subjects,
    };
    
    return { success: true, message: 'Report generated', data: finalReportData };
  } catch (error: any) {
    console.error("Error generating student report:", error);
    return { success: false, message: error.message || 'An unknown error occurred.', data: null };
  }
}