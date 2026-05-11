'use server';

import { z } from 'zod';
import { admin } from '@/firebase/admin';
import { firestore } from 'firebase-admin';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '@/app/super-admin/schools/page';
import { Region } from '@/app/super-admin/regions/page';
import { generateComprehensiveClassReport } from '@/ai/flows/generate-comprehensive-report';
import { revalidatePath } from 'next/cache';
import { formatTeacherName } from '@/lib/utils';

// 1. -------- INPUT SCHEMA --------
const reportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
  term: z.string(),
  assessment: z.string(),
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
  classTeacherName: UserProfile | null;   // kept for AI / internal use
  headTeacherName: UserProfile | null;
  teacherName: string;                     // formatted string
  numInClass: number;
  studentReports: StudentReport[];
  academicYear: string;
  term: string;
  classData: any;
  summaryData: any;
  subjects: Subject[];
}

export interface ContinuousAssessmentData {
  studentReports: {
    student: {
      id: string;
      fullName: string;
    };
    term1: TermResult;
    term2: TermResult;
    term3: TermResult;
  }[];
  schoolName: string;
  className: string;
  teacherName: string;
  academicYear: string;
}

interface TermResult {
  assessments: string[];
  subjects: {
    [subjectName: string]: {
      [assessmentName: string]: {
        mark: number;
        percentage: number;
        grade: string;
      };
    };
  };
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
export async function generateProgressReportData(
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
  const { schoolId, classId, academicYear, term, assessment } = validatedFields.data;
  const db = admin.firestore();

  const assessmentToQuery = assessment === 'Attainment' ? `End of ${term}` : assessment;

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

    const teacherName = classTeacher 
      ? formatTeacherName(classTeacher) 
      : 'N/A';

    // Fetch official assessment totals to override document-level totals (handles total changes)
    const assessmentTotalsId = `${academicYear}-${term.replace(/\s+/g, '-')}-${assessmentToQuery.replace(/\s+/g, '-')}`;
    const assessmentTotalsRef = db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('assessmentTotals').doc(assessmentTotalsId);
    const assessmentTotalsSnap = await assessmentTotalsRef.get();
    const assessmentTotals = assessmentTotalsSnap.exists ? assessmentTotalsSnap.data()?.totals || {} : {};

    // ---- Step 2: Fetch Students and Subjects ----
    const studentsSnap = await db
      .collection('schools')
      .doc(schoolId)
      .collection('classes')
      .doc(classId)
      .collection('students')
      .get();
    const studentIds = studentsSnap.docs.map((doc) => doc.id);
    
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
        teacherName,
        numInClass: studentIds.length,
        studentReports: [],
        academicYear: academicYear,
        term: term,
        classData,
        summaryData: null,
        subjects: [],
    };

    if (studentIds.length === 0) {
      return { success: true, message: 'No students in this class.', data: baseReportData };
    }

    // Fetch student details with chunking if needed (Promise.all handles large amounts fine, but let's be consistent if we hit quota)
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
        // Handle 'in' limit of 30 for subjects
        const subjectChunks = [];
        for (let i = 0; i < subjectIds.length; i += 30) {
            subjectChunks.push(subjectIds.slice(i, i + 30));
        }
        for (const chunk of subjectChunks) {
            const masterSubjectsSnap = await db
                .collection('subjects')
                .where(firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            subjects.push(...masterSubjectsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name })));
        }
        subjects.sort((a, b) => a.name.localeCompare(b.name));
    }


    // ---- Step 3: Fetch ONLY marks for the selected assessment ----
    const allMarks: any[] = [];
    const markPromises = studentIds.map(studentId => 
        db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .where('classId', '==', classId)
            .where('assessment', '==', assessmentToQuery)
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
        let studentHasMarks = false;

        const subjectResults = subjects.map((subject) => {
          const mark = allMarks.find(
            (m) => m.studentId === student.id && m.subjectId === subject.id
          );
          
          if (mark) {
              studentHasMarks = true;
              const subjectPossibleMark = assessmentTotals[subject.id] ?? mark.total ?? 0;
              const pupilMark = mark.score || 0;
              const percentage = subjectPossibleMark > 0 ? (pupilMark / subjectPossibleMark) * 100 : 0;
              const grade = getGrade(percentage);

              totalPupilMark += pupilMark;
              totalPossibleMark += subjectPossibleMark;

              return {
                subjectName: subject.name,
                symbol: grade.symbol,
                possibleMark: subjectPossibleMark,
                pupilMark,
                percentage,
                remarks: grade.remarks,
              };
          } else {
              // Mark doesn't exist: Signal "Not Sat" with possibleMark: 0
              return {
                subjectName: subject.name,
                symbol: '-',
                possibleMark: 0,
                pupilMark: 0,
                percentage: 0,
                remarks: 'N/A',
              };
          }
        });

        const overallPercentage =
          totalPossibleMark > 0 ? (totalPupilMark / totalPossibleMark) * 100 : 0;
        const overallGrade = studentHasMarks ? getGrade(overallPercentage) : { symbol: '-', remarks: 'N/A' };

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
          hasNoMarks: !studentHasMarks
        };
      }
    );

    // ---- Step 5: Calculate Positions and Finalize ----
    // ONLY include students who sat for at least one exam in ranking
    const studentsWithMarks = studentReports.filter(r => !(r as any).hasNoMarks);
    studentsWithMarks.sort((a, b) => b.overall.percentage - a.overall.percentage);

    const finalStudentReports = studentReports.map((report) => {
      const position = (report as any).hasNoMarks 
        ? 0 
        : studentsWithMarks.findIndex(r => r.student.id === report.student.id) + 1;
      
      return {
        ...report,
        positionInClass: position,
      };
    });

    // ---- Step 6: Generate Summary Data ----
    const subjectPerformanceData = subjects.map(subject => {
        // Roll for this subject is only students who SAT for it (possibleMark > 0)
        const studentsWhoSat = finalStudentReports.filter(r => {
            const subjectResult = r.subjects.find(s => s.subjectName === subject.name);
            return subjectResult && subjectResult.possibleMark > 0;
        });
        const totalWithMarksForSubject = studentsWhoSat.length;

        if (totalWithMarksForSubject === 0) {
            return { subjectName: subject.name, overallPassRate: 0 };
        }

        const overallPassCount = studentsWhoSat.reduce((acc, r) => {
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
    
    const totalStudentsWithMarks = studentsWithMarks.length;
    const totalOverallPasses = studentsWithMarks.filter(r => ['A', 'B', 'C'].includes(r.overall.symbol)).length;
    const overallAverage = totalStudentsWithMarks > 0 
        ? parseFloat((studentsWithMarks.reduce((acc, r) => acc + r.overall.percentage, 0) / totalStudentsWithMarks).toFixed(1))
        : 0;

    const genderSummary = {
        boys: { roll: 0, grades: { A: { count: 0 }, B: { count: 0 }, C: { count: 0 }, D: { count: 0 }, E: { count: 0 } } },
        girls: { roll: 0, grades: { A: { count: 0 }, B: { count: 0 }, C: { count: 0 }, D: { count: 0 }, E: { count: 0 } } },
    };

    studentsWithMarks.forEach(report => {
        const grade = report.overall.symbol as keyof typeof genderSummary.boys.grades;
        if (report.student.gender === 'Male') {
            genderSummary.boys.roll++;
            if (grade && genderSummary.boys.grades[grade]) genderSummary.boys.grades[grade].count++;
        } else if (report.student.gender === 'Female') {
            genderSummary.girls.roll++;
            if (grade && genderSummary.girls.grades[grade]) genderSummary.girls.grades[grade].count++;
        }
    });
    
    const processGenderBlock = (block: any) => {
        if (block.roll === 0) return { ...block, passRate: 0, qualityPassRate: 0, failRate: 0 };
        const totalPass = block.grades.A.count + block.grades.B.count + block.grades.C.count;
        const qualityPass = block.grades.A.count + block.grades.B.count;
        const totalFail = block.grades.D.count + block.grades.E.count;
        return {
            ...block,
            passRate: (totalPass / block.roll) * 100,
            qualityPassRate: (qualityPass / block.roll) * 100,
            failRate: (totalFail / block.roll) * 100,
        };
    };

    const overallGradesCount = { A: { count: 0 }, B: { count: 0 }, C: { count: 0 }, D: { count: 0 }, E: { count: 0 } };
    studentsWithMarks.forEach(r => {
        const grade = r.overall.symbol as keyof typeof overallGradesCount;
        if (grade && overallGradesCount[grade]) overallGradesCount[grade].count++;
    });

    const summaryData = {
        totalStudents: totalStudentsWithMarks,
        overallAverage,
        classOverallPassRate: totalStudentsWithMarks > 0 ? parseFloat(((totalOverallPasses / totalStudentsWithMarks) * 100).toFixed(1)) : 0,
        topStudent: studentsWithMarks[0]?.student.fullName || 'N/A',
        studentPerformanceData: studentsWithMarks.map(r => ({
            studentName: r.student.fullName,
            overallPercentage: parseFloat(r.overall.percentage.toFixed(1)),
        })),
        subjectPerformanceData,
        gender: {
            boys: processGenderBlock(genderSummary.boys),
            girls: processGenderBlock(genderSummary.girls),
        },
        overall: {
            grades: overallGradesCount,
            passRate: totalStudentsWithMarks > 0 ? (totalOverallPasses / totalStudentsWithMarks) * 100 : 0,
            qualityPassRate: totalStudentsWithMarks > 0 ? ((overallGradesCount.A.count + overallGradesCount.B.count) / totalStudentsWithMarks) * 100 : 0,
            failRate: totalStudentsWithMarks > 0 ? ((overallGradesCount.D.count + overallGradesCount.E.count) / totalStudentsWithMarks) * 100 : 0,
        }
    };

    const finalReportData: ClassReportData = {
      ...baseReportData,
      studentReports: finalStudentReports as StudentReport[],
      summaryData,
      subjects: subjects,
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

const continuousAssessmentReportSchema = z.object({
  schoolId: z.string(),
  classId: z.string(),
  academicYear: z.string(),
});

export async function generateContinuousAssessmentReport(values: z.infer<typeof continuousAssessmentReportSchema>): Promise<{ success: boolean, message: string, data: ContinuousAssessmentData | null }> {
    const validatedFields = continuousAssessmentReportSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, message: 'Invalid input.', data: null };
    }

    const { schoolId, classId, academicYear } = validatedFields.data;
    const db = admin.firestore();

    const assessmentsByTerm: Record<string, string[]> = {
      "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
      "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
      "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
    };

    try {
        const classSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).get();
        if (!classSnap.exists) throw new Error("Class not found.");
        const classData = classSnap.data()!;

        const schoolSnap = await db.collection('schools').doc(schoolId).get();
        const schoolName = schoolSnap.data()?.name || 'Unknown School';
        
        let teacherName = 'N/A';
        if (classData.teacherId) {
            const teacherSnap = await db.collection('users').doc(classData.teacherId).get();
            if(teacherSnap.exists) teacherName = formatTeacherName(teacherSnap.data() as UserProfile);
        }

        const studentsSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('students').get();
        const studentIds = studentsSnap.docs.map(doc => doc.id);
        
        const baseReportData: ContinuousAssessmentData = { 
            studentReports: [], schoolName, className: classData.name, teacherName, academicYear 
        };

        if (studentIds.length === 0) {
            return { success: true, data: baseReportData, message: 'No students in this class.'};
        }
        
        // Fetch student details with chunking
        const studentDocs: any[] = [];
        const studentChunks = [];
        for (let i = 0; i < studentIds.length; i += 30) {
            studentChunks.push(studentIds.slice(i, i + 30));
        }
        for (const chunk of studentChunks) {
            const snap = await db.collection('schools').doc(schoolId).collection('students').where(firestore.FieldPath.documentId(), 'in', chunk).get();
            studentDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        const students = studentDocs;

        const classSubjectsSnap = await db.collection('schools').doc(schoolId).collection('classes').doc(classId).collection('subjects').where('academicYear', '==', academicYear).get();
        const subjectIds = classSubjectsSnap.docs.map(doc => doc.data().subjectId);
        
        let subjects: {id: string, name: string}[] = [];
        if (subjectIds.length > 0) {
            const subjectChunks = [];
            for (let i = 0; i < subjectIds.length; i += 30) {
                subjectChunks.push(subjectIds.slice(i, i + 30));
            }
            for (const chunk of subjectChunks) {
                const snap = await db.collection('subjects').where(firestore.FieldPath.documentId(), 'in', chunk).get();
                subjects.push(...snap.docs.map(doc => ({ id: doc.id, name: doc.data()!.name })));
            }
        }
        
        // Optimize mark fetching by using parallel queries for each student
        const allMarks: any[] = [];
        const markPromises = studentIds.map(studentId => 
            db.collection('schools').doc(schoolId).collection('students').doc(studentId).collection('marks')
                .where('academicYear', '==', academicYear)
                .where('classId', '==', classId)
                .get()
        );

        const markSnapshots = await Promise.all(markPromises);
        markSnapshots.forEach((snap, index) => {
            const studentId = studentIds[index];
            snap.forEach(doc => allMarks.push({ ...doc.data(), studentId }));
        });

        const studentReports = students.map(student => {
            const studentReport: ContinuousAssessmentData['studentReports'][0] = {
                student: { id: student.id, fullName: `${student.firstName} ${student.surname}` },
                term1: { assessments: [], subjects: {} },
                term2: { assessments: [], subjects: {} },
                term3: { assessments: [], subjects: {} },
            };
            
            const studentMarks = allMarks.filter(m => m.studentId === student.id);

            studentMarks.forEach(mark => {
                const termKey = mark.term.replace(' ', '').toLowerCase() as 'term1' | 'term2' | 'term3';
                if (!studentReport[termKey]) return;

                const subject = subjects.find(s => s.id === mark.subjectId);
                if (!subject) return;

                if (!studentReport[termKey].assessments.includes(mark.assessment)) {
                    studentReport[termKey].assessments.push(mark.assessment);
                }

                if (!studentReport[termKey].subjects[subject.name]) {
                    studentReport[termKey].subjects[subject.name] = {};
                }
                
                const percentage = mark.total > 0 ? (mark.score / mark.total) * 100 : 0;
                studentReport[termKey].subjects[subject.name][mark.assessment] = {
                    mark: mark.score,
                    percentage: percentage,
                    grade: getGrade(percentage).symbol,
                };
            });

            const assessmentOrder = [...assessmentsByTerm['Term 1'], ...assessmentsByTerm['Term 2'], ...assessmentsByTerm['Term 3']];
            studentReport.term1.assessments.sort((a,b) => assessmentOrder.indexOf(a) - assessmentOrder.indexOf(b));
            studentReport.term2.assessments.sort((a,b) => assessmentOrder.indexOf(a) - assessmentOrder.indexOf(b));
            studentReport.term3.assessments.sort((a,b) => assessmentOrder.indexOf(a) - assessmentOrder.indexOf(b));

            return studentReport;
        });

        const reportData: ContinuousAssessmentData = {
            studentReports,
            schoolName,
            className: classData.name,
            teacherName,
            academicYear,
        };
        
        return { success: true, message: "Report generated.", data: reportData };

    } catch (error: any) {
        console.error("Error generating continuous assessment report: ", error);
         if (error.code === 5 || error.code === 'FAILED_PRECONDITION') {
           return { success: false, message: `A Firestore index is required for this operation.`, data: null };
        }
        return { success: false, message: error.message, data: null };
    }
}