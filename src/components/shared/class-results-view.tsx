'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Printer, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Class } from '@/app/school-head/classes/page';
import { Skeleton } from '@/components/ui/skeleton';
import { ClassReportSummary } from '@/app/school-head/results/components/class-report-summary';
import { exportReportAsCSV } from '@/app/teacher/results/csv-utils';
import { useSearchParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { Subject } from '@/app/super-admin/subjects/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GenderAnalysisReport } from './gender-analysis-report';
import { Checkbox } from "@/components/ui/checkbox";
import { generateProgressReportData, ClassReportData } from '@/app/teacher/reports/actions';

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
    qualityPassRate: number;
    passRate: number;
    failRate: number;
}

const assessmentsByTerm = {
  'Term 1': ['January Test', 'February Test', 'March Test', 'End of Term 1'],
  'Term 2': ['May Test', 'June Test', 'July Test', 'End of Term 2'],
  'Term 3': ['September Test', 'October Test', 'November Test', 'End of Term 3'],
} as const;

const ATTAINMENT_SUBJECTS = ['Setswana', 'English', 'Mathematics'];

interface ClassResultsViewProps {
  user: UserProfile;
  classes: Class[];
  loadingClasses: boolean;
}

function getGrade(percentage: number): string {
    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 30) return 'D';
    return 'E';
}

function createEmptyGradeSummary() {
    return {
        grades: { A: { count: 0, percentage: 0 }, B: { count: 0, percentage: 0 }, C: { count: 0, percentage: 0 }, D: { count: 0, percentage: 0 }, E: { count: 0, percentage: 0 } },
        qualityPassRate: 0, passRate: 0, failRate: 0,
    };
}

function calculateClientSummary(reportData: any[], subjects: Subject[]) {
    // ONLY include students who have at least one mark in the subjects being calculated
    const studentsWithMarks = reportData.filter(r => !r.hasNoMarks);
    const totalStudentsCount = studentsWithMarks.length;

    const summary: any = { 
        bySubject: {}, 
        overall: createEmptyGradeSummary(),
        gender: {
            boys: { ...createEmptyGradeSummary(), roll: 0 },
            girls: { ...createEmptyGradeSummary(), roll: 0 },
        }
    };
    subjects.forEach(subject => { summary.bySubject[subject.id] = createEmptyGradeSummary(); });

    if (totalStudentsCount === 0) return summary;

    studentsWithMarks.forEach(item => {
        const studentGender = item.student?.gender;
        
        // Subject grades
        subjects.forEach(subject => {
            const subjectResult = item.subjects.find((s: any) => s.subjectName === subject.name);
            const grade = subjectResult?.symbol;
            // Only count if the student has a grade AND it's not the placeholder
            if (grade && grade !== '-' && summary.bySubject[subject.id]) {
                summary.bySubject[subject.id].grades[grade as keyof GradeSummary['grades']].count++;
            }
        });
        // Overall grades
        const overallGrade = item.overall?.symbol;
        if (overallGrade && overallGrade !== '-') {
            summary.overall.grades[overallGrade as keyof GradeSummary['grades']].count++;
            
            if (studentGender === 'Male') {
                summary.gender.boys.roll++;
                summary.gender.boys.grades[overallGrade as keyof GradeSummary['grades']].count++;
            } else if (studentGender === 'Female') {
                summary.gender.girls.roll++;
                summary.gender.girls.grades[overallGrade as keyof GradeSummary['grades']].count++;
            }
        }
    });

    const processPercentages = (summaryBlock: any) => {
        const roll = summaryBlock.roll !== undefined && summaryBlock.roll > 0 
            ? summaryBlock.roll 
            : Object.values<{count: number}>(summaryBlock.grades).reduce((acc, val) => acc + val.count, 0);
        
        if (roll === 0) return;
        ['A', 'B', 'C', 'D', 'E'].forEach(grade => {
            summaryBlock.grades[grade].percentage = (summaryBlock.grades[grade].count / roll) * 100;
        });
        summaryBlock.passRate = ((summaryBlock.grades.A.count + summaryBlock.grades.B.count + summaryBlock.grades.C.count) / roll) * 100;
        summaryBlock.qualityPassRate = ((summaryBlock.grades.A.count + summaryBlock.grades.B.count) / roll) * 100;
        summaryBlock.failRate = ((summaryBlock.grades.D.count + summaryBlock.grades.E.count) / roll) * 100;
    };
    
    processPercentages(summary.overall);
    processPercentages(summary.gender.boys);
    processPercentages(summary.gender.girls);
    subjects.forEach(s => processPercentages(summary.bySubject[s.id]));

    return summary;
}

export function ClassResultsView({
  user,
  classes: allClasses,
  loadingClasses,
}: ClassResultsViewProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('standard');

  const academicYears = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        (new Date().getFullYear() - 2 + i).toString()
      ),
    []
  );

  const [selectedYear, setSelectedYear] = useState<string>(
    searchParams.get('year') || new Date().getFullYear().toString()
  );
  const terms = ['Term 1', 'Term 2', 'Term 3'] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(
    (searchParams.get('term') as Term) || terms[0]
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    searchParams.get('classId') || ''
  );
  const [selectedAssessment, setSelectedAssessment] = useState<string>(
    searchParams.get('assessment') || ''
  );
  const [currentAssessments, setCurrentAssessments] = useState<string[]>([]);
  
  const [reportData, setReportData] = useState<ClassReportData | null>(null);

  const [customSelectedSubjects, setCustomSelectedSubjects] = useState<string[]>([]);
  
  const pageTitle = "Class Results";
  const pageDescription = "View and print results for a specific class and assessment.";

  const filteredClasses = useMemo(() => {
    if (!selectedYear) return [];
    return allClasses.filter(c => c.academicYear === selectedYear);
  }, [allClasses, selectedYear]);
  
  const handleGenerateReport = useCallback(async () => {
    if (!user?.schoolId || !selectedClass || !selectedYear || !selectedTerm || !selectedAssessment) return;
    setLoadingData(true);
    setReportData(null);
    try {
        const result = await generateProgressReportData({
            schoolId: user.schoolId,
            classId: selectedClass,
            academicYear: selectedYear,
            term: selectedTerm,
            assessment: selectedAssessment
        });

        if (result.success && result.data) {
            setReportData(result.data);
            setCustomSelectedSubjects(result.data.subjects.map(s => s.id));
             if (result.data.studentReports.length === 0) {
                toast({ title: 'No Data', description: 'No results were found for this class and assessment period.' });
            }
        } else {
            throw new Error(result.message || 'Failed to generate report.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setLoadingData(false);
    }
  }, [user, selectedClass, selectedYear, selectedTerm, selectedAssessment, toast]);

  useEffect(() => {
    const classIdParam = searchParams.get('classId');
    if (classIdParam) setSelectedClass(classIdParam);
    const yearParam = searchParams.get('year');
    if (yearParam) setSelectedYear(yearParam);
    const termParam = searchParams.get('term') as Term;
    if (termParam) setSelectedTerm(termParam);
    const assessmentParam = searchParams.get('assessment');
    if (assessmentParam) setSelectedAssessment(assessmentParam);
  }, [searchParams]);

  useEffect(() => {
    if (selectedClass && selectedYear && selectedTerm && selectedAssessment) {
        handleGenerateReport();
    }
  }, [selectedClass, selectedYear, selectedTerm, selectedAssessment, handleGenerateReport]);

  useEffect(() => {
    const selectedClassData = allClasses.find((c) => c.id === selectedClass);
    let termAssessments = assessmentsByTerm[selectedTerm] || [];
    if (selectedClassData?.gradeLevel === 'Standard 4') {
      termAssessments = [...termAssessments, 'Attainment'];
    }
    setCurrentAssessments(termAssessments as unknown as string[]);
    if (!(termAssessments as unknown as string[]).includes(selectedAssessment)) {
      setSelectedAssessment('');
    }
  }, [selectedTerm, selectedClass, allClasses, selectedAssessment]);
  
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedClass('');
    setSelectedAssessment('');
  };
  
  const handleClassChange = (classId: string) => {
      setSelectedClass(classId);
      setSelectedAssessment('');
  };
  
  const handleTermChange = (term: Term) => {
      setSelectedTerm(term);
      setSelectedAssessment('');
  };
  
  const handleAssessmentChange = (assessment: string) => {
    setSelectedAssessment(assessment);
  }

  const handlePrint = () => window.print();

  const handleExport = (isCustom: boolean) => {
    const dataToExport = processedStudentReports;
    const subjectsToExport = displayedSubjects;

    if (!dataToExport || !subjectsToExport || !reportData?.classData) {
      toast({ variant: 'destructive', title: 'Error', description: 'No data to export.' });
      return;
    }
    exportReportAsCSV({
      reportData: dataToExport as any[],
      subjects: subjectsToExport,
      classData: reportData.classData,
      assessment: selectedAssessment,
      term: selectedTerm,
      year: selectedYear,
    });
  };

  const displayedSubjects = useMemo(() => {
    if (!reportData) return [];
    if (activeTab === 'custom') {
        return reportData.subjects.filter(s => customSelectedSubjects.includes(s.id));
    }
    if (selectedAssessment === 'Attainment') {
        return reportData.subjects.filter(s => ATTAINMENT_SUBJECTS.includes(s.name));
    }
    return reportData.subjects;
  }, [reportData, activeTab, customSelectedSubjects, selectedAssessment]);

  const processedStudentReports = useMemo(() => {
      if (!reportData) return null;
      
      const displayedSubjectNames = new Set(displayedSubjects.map(s => s.name));

      return reportData.studentReports.map(studentReport => {
          let totalScore = 0;
          let totalMax = 0;
          let marksCount = 0;
          
          studentReport.subjects.forEach(mark => {
              if (displayedSubjectNames.has(mark.subjectName)) {
                  // Only count subject towards average IF the student sat for it (possibleMark > 0)
                  if (mark.possibleMark > 0) {
                      totalScore += mark.pupilMark;
                      totalMax += mark.possibleMark;
                      marksCount++;
                  }
              }
          });

          const hasNoMarks = marksCount === 0;
          const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
          const grade = hasNoMarks ? '-' : getGrade(percentage);
          const oldOverall = studentReport.overall;
          
          return {
              ...studentReport,
              hasNoMarks,
              overall: { 
                  ...oldOverall, 
                  pupilMark: totalScore, 
                  possibleMark: totalMax, 
                  percentage, 
                  symbol: grade 
              },
          };
      }).sort((a,b) => {
          if (a.hasNoMarks && !b.hasNoMarks) return 1;
          if (!a.hasNoMarks && b.hasNoMarks) return -1;
          return b.overall.percentage - a.overall.percentage;
      });
  }, [reportData, displayedSubjects]);
  
  const processedSummaryData = useMemo(() => {
      if (!processedStudentReports || !displayedSubjects) return null;
      return calculateClientSummary(processedStudentReports, displayedSubjects);
  }, [processedStudentReports, displayedSubjects]);

  const handleCustomSubjectToggle = (subjectId: string) => {
    setCustomSelectedSubjects(prev => 
        prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };
  
  const handleSelectAllCustom = () => {
    setCustomSelectedSubjects(reportData?.subjects.map(s => s.id) || []);
  }
  
  const handleDeselectAllCustom = () => {
      setCustomSelectedSubjects([]);
  }

  const showReport = !loadingData && selectedAssessment && reportData;

  const renderReportTable = (data: any[] | null, subjectsToDisplay: Subject[]) => (
    data && data.length > 0 ? (
        <div className="overflow-x-auto">
            <Table className="report-table min-w-full text-xs">
              <TableHeader><TableRow>
                  <TableHead className="font-bold px-2 border-r w-[40px]">No.</TableHead>
                  <TableHead className="font-bold text-xs border-r min-w-[140px] max-w-[140px]">Student Name</TableHead>
                  {subjectsToDisplay.map((sub) => (<TableHead key={sub.id} colSpan={2} className="text-center font-bold border-l text-xs px-1 min-w-[60px]" title={sub.name}><div className="truncate max-w-[90px] mx-auto">{sub.name}</div></TableHead>))}
                  <TableHead className="text-center font-bold border-l text-xs">Overall %</TableHead>
                  <TableHead className="text-center font-bold border-l text-xs pr-4">Grade</TableHead>
              </TableRow></TableHeader>
              <TableBody>{data.map((item, i) => (<TableRow key={item.student.id} className="h-3">
                  <TableCell className="text-center border-r px-2 py-1 w-[40px]">{i + 1}</TableCell>
                  <TableCell className="text-xs truncate max-w-[140px] min-w-[140px] border-r py-1" title={item.student.fullName}>{item.student.fullName}</TableCell>
                  {subjectsToDisplay.map((sub) => {
                      const m = item.subjects.find((s: any) => s.subjectName === sub.name);
                      // Display percentage and grade only if student sat for exam (possibleMark > 0)
                      return (<React.Fragment key={sub.id}>
                          <TableCell className="text-center border-l text-xs py-1 px-1 min-w-[42px] max-w-[52px] whitespace-nowrap">{m && m.possibleMark > 0 ? `${m.percentage.toFixed(1)}%` : '-'}</TableCell>
                          <TableCell className="text-center font-semibold text-xs py-1 px-1 min-w-[32px] max-w-[40px] whitespace-nowrap">{m && m.possibleMark > 0 ? m.symbol : '-'}</TableCell>
                      </React.Fragment>);
                  })}
                  <TableCell className="text-center font-bold border-l text-xs py-1">{item.hasNoMarks ? '-' : `${item.overall.percentage.toFixed(1)}%`}</TableCell>
                  <TableCell className="text-center font-bold border-l text-xs pr-4 py-1">{item.overall.symbol}</TableCell>
              </TableRow>))}
              </TableBody>
            </Table>
        </div>
    ) : ( <p className="text-center text-muted-foreground">No marks have been recorded for this assessment.</p> )
  );

  return (
    <>
      <div className="printable-hidden space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-3xl font-bold tracking-tight">{pageTitle}</h2><p className="text-muted-foreground">{pageDescription}</p></div>
        </div>
        <Card>
          <CardHeader><CardTitle>Report Filters</CardTitle><CardDescription>Select a year to see active classes, then select a term and assessment.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
               <Select value={selectedClass} onValueChange={handleClassChange} disabled={loadingClasses || filteredClasses.length === 0}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={loadingClasses ? "Loading..." : (filteredClasses.length === 0 ? "No classes for year" : "Select Class")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedTerm} onValueChange={handleTermChange} disabled={!selectedClass}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Term" /></SelectTrigger><SelectContent>{terms.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent></Select>
              <Select value={selectedAssessment} onValueChange={handleAssessmentChange} disabled={!selectedClass || !selectedTerm}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Assessment" /></SelectTrigger><SelectContent>{(currentAssessments || []).map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent></Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {loadingData ? ( <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : !selectedAssessment ? ( <Card><CardContent className="py-20 text-center text-muted-foreground">Please select an assessment to view the report.</CardContent></Card>
      ) : showReport ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-4">
                <TabsList className="printable-hidden">
                    <TabsTrigger value="standard">Standard Report</TabsTrigger>
                    <TabsTrigger value="custom">Custom Report</TabsTrigger>
                    <TabsTrigger value="gender">Gender Analysis</TabsTrigger>
                </TabsList>
                 <div className="printable-hidden flex items-center space-x-2">
                    <Button variant="outline" onClick={() => handleExport(activeTab === 'custom')}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                    <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                </div>
            </div>
            
            <TabsContent value="standard">
                <div className="printable-area space-y-6">
                    <div className="printable-page-content space-y-6">
                        <h3 className="text-lg font-semibold text-center print:text-left">
                          {reportData?.classData.name} 
                          {reportData?.teacherName ? `- ${reportData.teacherName}` : ''} 
                          — {selectedAssessment}, {selectedYear}
                        </h3>
                        {renderReportTable(processedStudentReports, displayedSubjects)}
                    </div>
                    {processedSummaryData && displayedSubjects.length > 0 && processedStudentReports && processedStudentReports.length > 0 && (
                        <div className="printable-page-content"><ClassReportSummary summaryData={processedSummaryData} subjects={displayedSubjects} /></div>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="custom">
                <Card className="mb-6 printable-hidden">
                    <CardHeader><CardTitle>Customize Report Subjects</CardTitle><CardDescription>Select the subjects to include in the calculation.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                            {reportData?.subjects.map(subject => (
                                <div key={subject.id} className="flex items-center space-x-2">
                                    <Checkbox id={`custom-sub-${subject.id}`} checked={customSelectedSubjects.includes(subject.id)} onCheckedChange={() => handleCustomSubjectToggle(subject.id)} />
                                    <label htmlFor={`custom-sub-${subject.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{subject.name}</label>
                                </div>
                            ))}
                        </div>
                         <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleSelectAllCustom}>Select All</Button>
                            <Button size="sm" variant="outline" onClick={handleDeselectAllCustom}>Deselect All</Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="printable-area space-y-6">
                    <div className="printable-page-content space-y-6">
                         <h3 className="text-lg font-semibold text-center print:text-left">
                          {reportData?.classData.name} 
                          {reportData?.teacherName ? `- ${reportData.teacherName}` : ''} 
                          — {selectedAssessment}, {selectedYear} (Custom)
                        </h3>
                        {renderReportTable(processedStudentReports, displayedSubjects)}
                    </div>
                    {processedSummaryData && displayedSubjects.length > 0 && processedStudentReports && processedStudentReports.length > 0 && (
                        <div className="printable-page-content"><ClassReportSummary summaryData={processedSummaryData} subjects={displayedSubjects} /></div>
                    )}
                </div>
            </TabsContent>
            
            <TabsContent value="gender">
                {processedSummaryData && reportData?.classData ? (
                    <GenderAnalysisReport
                        summaryData={processedSummaryData}
                        assessmentName={selectedAssessment}
                        term={selectedTerm}
                        year={selectedYear}
                        className={reportData.classData.name}
                        teacherName={reportData?.teacherName || null}
                    />
                ) : (
                    <p className="text-center text-muted-foreground">No summary data to display for gender analysis.</p>
                )}
            </TabsContent>

        </Tabs>
      ) : ( <Card><CardContent className="py-20 text-center text-muted-foreground">No data available for the selected filters.</CardContent></Card> )}
    </>
  );
}
