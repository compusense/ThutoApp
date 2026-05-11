
'use client';
import { useState, useEffect } from 'react';
import { ReportData } from '../actions';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Wand2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatTeacherName } from '@/lib/utils';
import { generateReportComment } from '@/ai/flows/generate-report-comment';
import { useUser } from '@/firebase/auth/use-user';


function ReportHeader({ reportData }: { reportData: ReportData }) {
  const {
    districtCouncil,
    schoolName,
    termEnding,
    className,
    numInClass,
    academicYear,
    term,
  } = reportData;
  const { student, positionInClass } = reportData.studentReports[0];

  return (
    <div className="text-center font-bold font-sans text-xs">
      <h1 className="text-sm">{districtCouncil}</h1>
      <h2 className="text-sm">{schoolName} PROGRESS REPORT | {term.toUpperCase()} {academicYear}</h2>
      <div className="mt-4 text-left grid grid-cols-2 gap-x-4 gap-y-1">
        <p>
          NAME OF PUPIL: <span className="underline">{student.fullName}</span>
        </p>
        <p>
          AGE: <span className="underline">{student.age ?? ''}</span>
        </p>
        <p>
          TERM ENDING: <span className="underline">{termEnding}</span>
        </p>
        <p>
          STANDARD: <span className="underline">{className}</span>
        </p>
        <p>
          NUMBER OF DAYS ABSENT: <span className="underline" />
        </p>
        {numInClass > 0 && <p>NO. IN CLASS: <span className="underline">{numInClass}</span></p>}
        {positionInClass > 0 && <p>POSITION IN CLASS:{' '}<span className="underline">{positionInClass}</span></p>}
        <div className="flex items-center gap-2">
          <p>GRADE:</p>
          <div className="border-2 border-black rounded-full h-8 w-8 flex items-center justify-center font-bold text-base">
            {reportData.studentReports[0].overall.symbol}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportTable({ reportData }: { reportData: ReportData }) {
  const { subjects, overall } = reportData.studentReports[0];
  return (
    <table className="w-full border-collapse border-2 border-black text-xs">
      <thead>
        <tr className="font-bold bg-gray-200">
          <th className="border border-black p-1 text-left">SUBJECT</th>
          <th className="border border-black p-1">SYMBOL</th>
          <th className="border border-black p-1">POSSIBLE MARK</th>
          <th className="border border-black p-1">PUPIL'S MARK</th>
          <th className="border border-black p-1">PERCENTAGE</th>
          <th className="border border-black p-1">REMARKS</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject, idx) => (
          <tr key={idx}>
            <td className="border border-black p-1 font-bold">
              {subject.subjectName}
            </td>
            <td className="border border-black p-1 text-center">
              {subject.symbol}
            </td>
            <td className="border border-black p-1 text-center">
              {subject.possibleMark}
            </td>
            <td className="border border-black p-1 text-center">
              {subject.pupilMark}
            </td>
            <td className="border border-black p-1 text-center">
              {subject.percentage.toFixed(1)}%
            </td>
            <td className="border border-black p-1 text-center">
              {subject.remarks}
            </td>
          </tr>
        ))}
        <tr className="font-bold bg-gray-200">
          <td className="border border-black p-1">OVERALL</td>
          <td className="border border-black p-1 text-center">
            {overall.symbol}
          </td>
          <td className="border border-black p-1 text-center">
            {overall.possibleMark}
          </td>
          <td className="border border-black p-1 text-center">
            {overall.pupilMark}
          </td>
          <td className="border border-black p-1 text-center">
            {overall.percentage.toFixed(1)}%
          </td>
          <td className="border border-black p-1 text-center">
            {overall.remarks}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ReportFooter({
  reportData,
  teacherComment,
}: {
  reportData: ReportData;
  teacherComment?: string;
}) {
  const { classTeacherName, headTeacherName } = reportData;
  return (
    <div className="text-xs space-y-4 mt-2">
      <div>
        <p className="font-bold">Class Teacher's Remarks:</p>
        <div
          className="border-b border-black mt-1 pb-1"
          style={{ minHeight: '40px' }}
        >
          {teacherComment}
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className="text-left">
          <div className="border-b border-black min-w-[200px]">
            {formatTeacherName(classTeacherName)}
          </div>
          <p>Class Teacher's Name</p>
        </div>
        <div className="text-left">
          <div className="border-b border-black min-w-[200px]" />
          <p>Class Teacher's signature:</p>
        </div>
      </div>

      <div>
        <p className="font-bold">GUARDIAN'S REMARKS</p>
        <div className="border-b border-black mt-1" style={{ minHeight: '20px' }} />
      </div>
      <div className="flex justify-between items-end">
        <div className='text-left'>
          <div className="border-b border-black min-w-[200px]" />
           <p>Guardian's name:</p>
        </div>
        <div className='text-left'>
          <div className="border-b border-black min-w-[200px]" />
           <p>Guardians's signature:</p>
        </div>
      </div>
      
      <table className="w-full border-collapse border-2 border-black text-xs mt-4">
        <thead>
            <tr className="font-bold text-center bg-gray-200">
                <th colSpan={6} className="border border-black p-1">PUPIL'S OVERALL TERMLY ASSESMENT RATINGS (X)</th>
            </tr>
            <tr className="font-bold text-center">
                <th className="border border-black p-1 text-left">Effective Psychomotor Report</th>
                <th className="border border-black p-1">Unsatisfactory</th>
                <th className="border border-black p-1">Average</th>
                <th className="border border-black p-1">Fair</th>
                <th className="border border-black p-1">Good</th>
                <th className="border border-black p-1">Excellent</th>
            </tr>
        </thead>
        <tbody>
            {["Behavior", "School Activities", "Punctuality", "Neatness", "Carrying Out Assignments", "Health"].map(item => (
                <tr key={item}>
                    <td className="border border-black p-1 font-bold">{item}</td>
                    <td className="border border-black p-1 h-6"></td>
                    <td className="border border-black p-1 h-6"></td>
                    <td className="border border-black p-1 h-6"></td>
                    <td className="border border-black p-1 h-6"></td>
                    <td className="border border-black p-1 h-6"></td>
                </tr>
            ))}
        </tbody>
      </table>

      <div>
        <p className="font-bold">Head Teacher's Remarks:</p>
        <div className="border-b border-black mt-1" style={{ minHeight: '20px' }} />
      </div>
       <div className="flex justify-between items-end">
        <div className="text-left">
          <div className="border-b border-black min-w-[200px] text-left">
            {formatTeacherName(headTeacherName)}
          </div>
          <p>Head Teacher</p>
        </div>
        <div className="text-left">
          <div className="border-b border-black min-w-[200px]" />
          <p>Signature:</p>
        </div>
        <div className="text-left">
          <div className="border-b border-black min-w-[150px]" />
          <p>Date:</p>
        </div>
      </div>
    </div>
  );
}

function SingleReport({
  reportData,
  teacherComment,
}: {
  reportData: ReportData;
  teacherComment?: string;
}) {
  return (
    <div className="printable-page-content p-8 max-w-4xl mx-auto bg-white text-black shadow-lg">
      <div className="space-y-4">
        <ReportHeader reportData={reportData} />
        <ReportTable reportData={reportData} />
        <ReportFooter
          reportData={reportData}
          teacherComment={teacherComment}
        />
      </div>
    </div>
  );
}

type CommentMode = 'blank' | 'manual' | 'ai';

export function ProgressReport({ reportData, storageKey }: { reportData: ReportData; storageKey: string | null; }) {
  const { user } = useUser();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentMode, setCommentMode] = useState<CommentMode>('blank');
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  // Disable comment editing for students
  const isStudent = user?.role === 'student';

  useEffect(() => {
    // For students, we don't load or save comments from local storage.
    if (isStudent || !storageKey) {
        setComments({});
        return;
    };
    const savedComments = localStorage.getItem(storageKey);
    if (savedComments) {
      setComments(JSON.parse(savedComments));
    } else {
      setComments({});
    }
  }, [storageKey, isStudent]);

  useEffect(() => {
    if (!isStudent && storageKey && Object.keys(comments).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(comments));
    }
  }, [comments, storageKey, isStudent]);


  const handlePrint = () => {
    window.print();
  };
  
  const handleGenerateComment = async (studentId: string) => {
    const studentData = reportData.studentReports.find(r => r.student.id === studentId);
    if (!studentData) return;

    setIsGeneratingAi(prev => ({...prev, [studentId]: true}));
    try {
        const subjectGrades = studentData.subjects.map(s => `${s.subjectName}: ${s.symbol}`).join(', ');
        const input = {
            studentName: studentData.student.fullName,
            grades: subjectGrades,
            overallGrade: studentData.overall.symbol,
            overallRemarks: studentData.overall.remarks,
        };

        const result = await generateReportComment(input);
        
        if (result.comment) {
            setComments(prev => ({ ...prev, [studentId]: result.comment }));
        } else {
            throw new Error("AI did not return a comment.");
        }
    } catch(e: any) {
        toast({
            variant: 'destructive',
            title: "AI Error",
            description: e.message || "Could not generate comment.",
        });
    } finally {
        setIsGeneratingAi(prev => ({...prev, [studentId]: false}));
    }
  }

  return (
    <div className="printable-area">
      { !isStudent &&
        <Card className="mb-6 printable-hidden">
          <CardHeader>
            <CardTitle>Report Options</CardTitle>
            <CardDescription>
              Choose how to handle teacher comments, then print.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label htmlFor="comment-mode" className="text-sm font-medium">
                Teacher's Remarks
              </label>
              <Select
                value={commentMode}
                onValueChange={(v) => setCommentMode(v as CommentMode)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Leave Blank</SelectItem>
                  <SelectItem value="manual">Enter Manually</SelectItem>
                  <SelectItem value="ai">Generate with AI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePrint}>
              <Printer className="mr-2" />
              Print All Reports
            </Button>
          </CardContent>
        </Card>
      }
      
      {commentMode !== 'blank' && !isStudent && (
         <Card className="mb-6 printable-hidden">
             <CardHeader>
                <CardTitle>Enter Teacher Remarks</CardTitle>
                <CardDescription>
                    {commentMode === 'manual' 
                    ? 'Type the remarks for each student below.' 
                    : 'Click the wand to generate an AI-powered comment for each student.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {reportData.studentReports.map(report => (
                    <div key={report.student.id} className="space-y-2">
                        <label htmlFor={`comment-${report.student.id}`} className="font-medium">{report.student.fullName}</label>
                        <div className="flex items-center gap-2">
                            <Textarea
                                id={`comment-${report.student.id}`}
                                placeholder={`Enter remarks for ${report.student.fullName}...`}
                                value={comments[report.student.id] || ''}
                                onChange={(e) => setComments(prev => ({ ...prev, [report.student.id]: e.target.value }))}
                                readOnly={commentMode === 'ai'}
                            />
                            {commentMode === 'ai' && (
                                <Button size="icon" variant="outline" onClick={() => handleGenerateComment(report.student.id)} disabled={isGeneratingAi[report.student.id]}>
                                    {isGeneratingAi[report.student.id] ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                </Button>
                            )}
                        </div>
                    </div>
                 ))}
            </CardContent>
         </Card>
      )}

      {/* This renders all the reports for printing */}
      {reportData.studentReports.map((studentReport) => (
        <SingleReport
          key={studentReport.student.id}
          reportData={{
            ...reportData,
            studentReports: [studentReport], // Pass only the current student's report
            classTeacherName: reportData.classTeacherName,
            headTeacherName: reportData.headTeacherName,
          }}
          teacherComment={comments[studentReport.student.id]}
        />
      ))}
    </div>
  );
}
