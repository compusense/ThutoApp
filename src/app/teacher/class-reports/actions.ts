'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '@/app/super-admin/schools/page';
import { Region } from '@/app/super-admin/regions/page';
import { generateComprehensiveClassReport } from '@/ai/flows/generate-comprehensive-report';
import { revalidatePath } from 'next/cache';

// 1. -------- INPUT SCHEMA --------
const reportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
});

type ReportInput = z.infer<typeof reportSchema>;

// 2. -------- DATA STRUCTURES FOR THE REPORT --------
interface Subject {
  id: string;
  name: string;
}

interface StudentReport {
  student: {
    id: string;
    fullName: string;
    age: number | null;
    admissionNumber: string;
    gender?: 'Male' | 'Female';
  };
  subjects: {
    subjectName: string;
    symbol: string;
    possibleMark: number;
    pupilMark: number;
    percentage: number;
    remarks: string;
  }[];
  overall: {
    symbol: string;
    possibleMark: number;
    pupilMark: number;
    percentage: number;
    remarks: string;
  };
  positionInClass: number;
}

export interface ClassReportData {
  districtCouncil: string;
  schoolName: string;
  termEnding: string;
  className: string;
  classTeacherName: UserProfile | null;
  headTeacherName: UserProfile | null;
  numInClass: number;
  studentReports: StudentReport[];
  academicYear: string;
  term: string;
  classData: any; // Include raw class data for context
  summaryData: any; // Include summary data for AI
}

// 3. -------- HELPER FUNCTIONS --------
function getGrade(percentage: number): { symbol: string; remarks: string } {
  if (percentage >= 80) return { symbol: 'A', remarks: 'Excellent' };
  if (percentage >= 65) return { symbol: 'B', remarks: 'Very Good' };
  if (percentage >= 50) return { symbol: 'C', remarks: 'Good' };
  if (percentage >= 30) return { symbol: 'D', remarks: 'Fair' };
  return { symbol: 'E', remarks: 'Unsatisfactory' };
}

function getAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  try {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null; // Invalid date string
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

// 4. -------- MAIN SERVER ACTION --------
export async function generateClassReport(
  values: ReportInput
): Promise<{
  success: boolean;
  message: string;
  data: ClassReportData | null;
}> {
  const validatedFields = reportSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input', data: null };
  }
  const { schoolId, classId, academicYear, term } = validatedFields.data;
  const db = admin.firestore();
  const assessmentName = `End of ${term}`;

  try {
    // ---- Step 1: Fetch Primary Data (School, Class, Teachers) ----
    const schoolSnap = await db.collection('schools').doc(schoolId).get();
    if (!schoolSnap.exists) throw new Error('School not found');
    const schoolData = schoolSnap.data() as School;

    const regionSnap = await db
      .collection('regions')
      .doc(schoolData.regionId)
      .get();
    const districtCouncil =
      (regionSnap.data() as Region)?.name.toUpperCase() + ' DISTRICT COUNCIL';

    const classSnap = await db
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .doc(classId)
      .get();
    if (!classSnap.exists) throw new Error('Class not found');
    const classData = { id: classSnap.id, ...classSnap.data()! };

    let classTeacher: UserProfile | null = null;
    if (classData.teacherId) {
      const teacherSnap = await db
        .collection('users')
        .doc(classData.teacherId)
        .get();
      if (teacherSnap.exists) {
        classTeacher = teacherSnap.data() as UserProfile;
      }
    }

    let headTeacher: UserProfile | null = null;
    if (schoolData.schoolHeadId) {
      const headTeacherSnap = await db
        .collection('users')
        .doc(schoolData.schoolHeadId)
        .get();
      if (headTeacherSnap.exists) {
        headTeacher = headTeacherSnap.data() as UserProfile;
      }
    }

    // ---- Step 2: Fetch Students and Subjects ----
    const studentsSnap = await db
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .doc(classId)
      .collection('students')
      .get();
    const studentIds = studentsSnap.docs.map((doc) => doc.id);
    
    // Construct a base report data object that can be returned even if there are no students
    const baseReportData: ClassReportData = {
        districtCouncil,
        schoolName: schoolData.name.toUpperCase(),
        termEnding: '',
        className: `STANDARD ${classData.gradeLevel.replace(
          'Standard ',
          ''
        )}${classData.stream || ''}`,
        classTeacherName: classTeacher,
        headTeacherName: headTeacher,
        numInClass: studentIds.length,
        studentReports: [],
        academicYear: academicYear,
        term: term,
        classData,
        summaryData: {
            totalStudents: 0,
            overallAverage: 0,
            topStudent: 'N/A',
            studentPerformanceData: [],
            subjectPerformanceData: [],
        },
    };

    if (studentIds.length === 0) {
      return { success: true, message: 'No students in this class.', data: baseReportData };
    }

    const studentPromises = studentIds.map((id) =>
      db.collection('schools').doc(schoolId).collection('students').doc(id).get()
    );
    const studentDocs = await Promise.all(studentPromises);
    const students = studentDocs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const classSubjectsSnap = await db
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .doc(classId)
      .collection('subjects')
      .where('academicYear', '==', academicYear)
      .get();
    const subjectIds = classSubjectsSnap.docs.map((doc) => doc.data().subjectId);
    
    let subjects: Subject[] = [];
    if (subjectIds.length > 0) {
        const masterSubjectsSnap = await db
            .collection('subjects')
            .where(firestore.FieldPath.documentId(), 'in', subjectIds)
            .get();
        subjects = masterSubjectsSnap.docs
            .map((doc) => ({ id: doc.id, name: doc.data().name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }


    // ---- Step 3: Fetch ONLY "End of Term" marks ----
    const allMarks: any[] = [];
    const markPromises = studentIds.map(studentId => 
        db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('classId', '==', classId)
            .where('assessment', '==', assessmentName) // Correctly filter for only the end of term assessment
            .get()
    );

    const markSnapshots = await Promise.all(markPromises);
    markSnapshots.forEach((marksSnap, index) => {
        const studentId = studentIds[index];
        marksSnap.forEach(doc => {
            allMarks.push({
                ...doc.data(),
                studentId,
            });
        });
    });
    

    // ---- Step 4: Process Data for Each Student ----
    const studentReports: Omit<StudentReport, 'positionInClass'>[] = students.map(
      (student) => {
        const studentData = student as any;
        let totalPupilMark = 0;
        let totalPossibleMark = 0;
        let hasAnyMarks = false;

        const subjectResults = subjects.map((subject) => {
          const mark = allMarks.find(
            (m) => m.studentId === student.id && m.subjectId === subject.id
          );
          if (mark) hasAnyMarks = true;

          const pupilMark = mark?.score || 0;
          const possibleMark = mark?.total || 0;
          const percentage =
            possibleMark > 0 ? (pupilMark / possibleMark) * 100 : 0;
          const grade = mark ? getGrade(percentage) : { symbol: '-', remarks: 'N/A' };

          totalPupilMark += pupilMark;
          totalPossibleMark += possibleMark;

          return {
            subjectName: subject.name,
            symbol: grade.symbol,
            possibleMark,
            pupilMark,
            percentage,
            remarks: grade.remarks,
          };
        });

        const overallPercentage =
          totalPossibleMark > 0 ? (totalPupilMark / totalPossibleMark) * 100 : 0;
        const overallGrade = hasAnyMarks ? getGrade(overallPercentage) : { symbol: '-', remarks: 'N/A' };

        return {
          student: {
            id: student.id,
            fullName:
              `${studentData.firstName} ${studentData.surname}`.toUpperCase(),
            age: getAge(studentData.dateOfBirth),
            admissionNumber: studentData.admissionNumber,
            gender: studentData.gender,
          },
          subjects: subjectResults,
          overall: {
            symbol: overallGrade.symbol,
            possibleMark: totalPossibleMark,
            pupilMark: totalPupilMark,
            percentage: overallPercentage,
            remarks: overallGrade.remarks,
          },
          hasNoMarks: !hasAnyMarks
        };
      }
    );

    // ---- Step 5: Calculate Positions and Finalize ----
    const studentsWithResults = studentReports.filter(r => !(r as any).hasNoMarks);
    studentsWithResults.sort((a, b) => b.overall.percentage - a.overall.percentage);

    const finalStudentReports = studentReports.map((report) => {
      const position = (report as any).hasNoMarks 
        ? 0 
        : studentsWithResults.findIndex(r => r.student.id === report.student.id) + 1;
      
      return {
        ...report,
        positionInClass: position,
      };
    });

    // ---- Step 6: Generate Summary Data for AI ----
    const subjectPerformanceData = subjects.map(subject => {
        const totalWithMarksForSubject = finalStudentReports.filter(r => {
            const subjectResult = r.subjects.find(s => s.subjectName === subject.name);
            return subjectResult && subjectResult.possibleMark > 0;
        }).length;

        if (totalWithMarksForSubject === 0) {
            return { subjectName: subject.name, overallPassRate: 0 };
        }

        const overallPassCount = finalStudentReports.reduce((acc, r) => {
            const subjectResult = r.subjects.find(s => s.subjectName === subject.name);
            if (subjectResult && ['A', 'B', 'C'].includes(subjectResult.symbol)) {
                return acc + 1;
            }
            return acc;
        }, 0);

        return {
            subjectName: subject.name,
            overallPassRate: parseFloat(((overallPassCount / totalWithMarksForSubject) * 100).toFixed(1)),
        };
    });
    
    const totalStudentsWithMarks = studentsWithResults.length;
    const totalOverallPasses = studentsWithResults.filter(r => ['A', 'B', 'C'].includes(r.overall.symbol)).length;
    const overallAverage = totalStudentsWithMarks > 0 
        ? parseFloat((studentsWithResults.reduce((acc, r) => acc + r.overall.percentage, 0) / totalStudentsWithMarks).toFixed(1))
        : 0;

    const summaryData = {
        totalStudents: totalStudentsWithMarks,
        overallAverage: overallAverage,
        classOverallPassRate: totalStudentsWithMarks > 0 
            ? parseFloat(((totalOverallPasses / totalStudentsWithMarks) * 100).toFixed(1)) 
            : 0,
        topStudent: studentsWithResults[0]?.student.fullName || 'N/A',
        studentPerformanceData: studentsWithResults.map(r => ({
            studentName: r.student.fullName,
            overallPercentage: parseFloat(r.overall.percentage.toFixed(1)),
        })),
        subjectPerformanceData,
    };


    const finalReportData: ClassReportData = {
      ...baseReportData,
      studentReports: finalStudentReports as StudentReport[],
      summaryData,
    };

    return {
      success: true,
      message: 'Report generated successfully',
      data: finalReportData,
    };
  } catch (error: any) {
    console.error('Error generating progress report data: ', error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred.',
      data: null,
    };
  }
}

// Server action to call the Genkit flow
export async function generateComprehensiveReport(reportData: ClassReportData) {
  try {
    if (!reportData || reportData.studentReports.length === 0) {
      return { success: false, message: 'No student data available to generate a report.' };
    }
    const input = {
      className: reportData.className,
      academicYear: reportData.academicYear,
      term: reportData.term,
      totalStudents: reportData.summaryData.totalStudents,
      overallAverage: reportData.summaryData.overallAverage,
      classOverallPassRate: reportData.summaryData.classOverallPassRate,
      topStudent: reportData.summaryData.topStudent,
      studentPerformanceData: reportData.summaryData.studentPerformanceData,
      subjectPerformanceData: reportData.summaryData.subjectPerformanceData,
    };

    // ADDING LOG HERE
    console.log('[AI ACTION LOG] Input to generateComprehensiveClassReport flow:', JSON.stringify(input, null, 2));

    const result = await generateComprehensiveClassReport(input);
    return { success: true, report: result.report };
  } catch (e: any) {
    console.error('[AI ACTION ERROR]', e);
    return { success: false, message: e.message || 'Failed to generate AI report.' };
  }
}


const saveReportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  reportText: z.string(),
});

export async function saveNarrativeReport(values: z.infer<typeof saveReportSchema>) {
    const validatedFields = saveReportSchema.safeParse(values);
    if (!validatedFields.success) {
        console.error('[SAVE REPORT ERROR] Zod validation failed:', validatedFields.error.flatten().fieldErrors);
        return { success: false, message: 'Invalid data' };
    }
    
    const { schoolId, classId, academicYear, term, reportText } = validatedFields.data;
    const db = admin.firestore();
    
    try {
        const reportId = `${academicYear}-${term.replace(' ', '')}`;
        const reportRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('narrativeReports').doc(reportId);
        
        await reportRef.set({
            academicYear,
            term,
            reportText,
            lastSaved: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        revalidatePath(`/teacher/class-reports`);
        return { success: true, message: 'Report saved successfully.' };
    } catch (e: any) {
        console.error('Error saving narrative report:', e);
        return { success: false, message: e.message || 'Failed to save report.' };
    }
}

const getReportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
});

export async function getNarrativeReport(values: z.infer<typeof getReportSchema>) {
    const validatedFields = getReportSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data', reportText: null };
    }
    
    const { schoolId, classId, academicYear, term } = validatedFields.data;
    const db = admin.firestore();
    
    try {
        const reportId = `${academicYear}-${term.replace(' ', '')}`;
        const reportRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('narrativeReports').doc(reportId);
        
        const docSnap = await reportRef.get();
        if (docSnap.exists) {
            return { success: true, message: 'Report found.', reportText: docSnap.data()?.reportText || '' };
        } else {
            return { success: true, message: 'No saved report found.', reportText: '' };
        }
    } catch (e: any) {
        console.error('Error getting narrative report:', e);
        return { success: false, message: 'Failed to get report.', reportText: null };
    }
}
