
'use client';

import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  FileText,
  Printer,
  BarChart,
  Wand2,
  CalendarIcon,
  Copy,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Class } from '@/app/school-head/classes/page';
import {
  generateProgressReportData,
  ReportData,
  generateContinuousAssessmentReport,
  ContinuousAssessmentData,
} from './actions';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressReport } from './components/progress-report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContinuousAssessmentReport } from './components/continuous-assessment-report';
import { Textarea } from '@/components/ui/textarea';
import { generateReportComment } from '@/ai/flows/generate-report-comment';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

type CommentMode = 'blank' | 'manual' | 'ai';


function EndOfTermReportTab({
  classes,
  loadingClasses,
}: {
  classes: Class[];
  loadingClasses: boolean;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const academicYears = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        (new Date().getFullYear() - 2 + i).toString()
      ),
    []
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const terms = ['Term 1', 'Term 2', 'Term 3'] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');
  const [termEndingDate, setTermEndingDate] = useState<Date | undefined>();

  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  const [currentAssessments, setCurrentAssessments] = useState<string[]>([]);
  
  const filteredClasses = React.useMemo(() => {
    return classes.filter(c => c.academicYear === selectedYear);
  }, [selectedYear, classes]);

  // Update available assessments when term changes
  React.useEffect(() => {
    setCurrentAssessments(assessmentsByTerm[selectedTerm] || []);
    setSelectedAssessment(''); // Reset assessment when term changes
  }, [selectedTerm]);


  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedClass('');
    setSelectedTerm(terms[0]);
    setSelectedAssessment('');
    setReportData(null);
  };
  
  const handleClassChange = (classId: string) => {
      setSelectedClass(classId);
      setSelectedTerm(terms[0]);
      setSelectedAssessment('');
      setReportData(null);
  }
  
  const handleTermChange = (term: Term) => {
      setSelectedTerm(term);
      setSelectedAssessment('');
      setReportData(null);
  };

  const handleGenerateReport = async () => {
    if (!user?.schoolId || !selectedClass || !selectedYear || !selectedTerm || !selectedAssessment || !termEndingDate) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a class, year, term, assessment, and term ending date.',
      });
      return;
    }
    setIsGenerating(true);
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
        setReportData({
            ...result.data,
            termEnding: format(termEndingDate, 'PPP'),
        });
        if (result.data.studentReports.length === 0) {
          toast({
            title: 'No Data',
            description: 'No students or marks found for the selected class/term.',
          });
        }
      } else {
        throw new Error(result.message || 'Failed to generate report.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStorageKey = useCallback(() => {
    if (!selectedClass || !selectedYear || !selectedTerm) return null;
    return `thuto-progress-report-comments-${selectedClass}-${selectedYear}-${selectedTerm}`;
  }, [selectedClass, selectedYear, selectedTerm]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate End of Term Report</CardTitle>
          <CardDescription>
            Select a class and a term to generate printable progress reports for all students.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
             <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedClass}
              onValueChange={handleClassChange}
              disabled={loadingClasses || filteredClasses.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingClasses ? 'Loading...' : (filteredClasses.length === 0 ? "No classes for year" : "Select Class")}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedTerm}
              onValueChange={(v) => handleTermChange(v as Term)}
              disabled={!selectedClass}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={!selectedTerm}>
                <SelectTrigger><SelectValue placeholder="Select Assessment" /></SelectTrigger>
                <SelectContent>{currentAssessments.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent>
            </Select>
             <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="term-ending-date"
                  variant={'outline'}
                  disabled={!selectedClass}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !termEndingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {termEndingDate ? (
                    format(termEndingDate, "PPP")
                  ) : (
                    <span>Term Ends: Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={termEndingDate}
                  onSelect={setTermEndingDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || !selectedClass || !termEndingDate || !selectedAssessment}
              className="self-end"
            >
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>
      {isGenerating && (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      )}

      {reportData && (
        <div className="mt-6">
          <ProgressReport reportData={reportData} storageKey={getStorageKey()} />
        </div>
      )}
      {!isGenerating && !reportData && (
        <Card className="mt-6">
          <CardContent className="py-20 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12" />
            <h3 className="mt-4 text-lg font-semibold">
              Reports will be displayed here
            </h3>
            <p className="mt-1 text-sm">
              Select all filters and click "Generate" to see the reports.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContinuousAssessmentTab({ classes, loadingClasses }: { classes: Class[], loadingClasses: boolean }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [reportData, setReportData] = useState<ContinuousAssessmentData | null>(null);

  const [comments, setComments] = useState<Record<string, Record<string, string>>>({});
  const [commentMode, setCommentMode] = useState<CommentMode>('blank');
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});

  const filteredClasses = useMemo(() => {
    return classes.filter(c => c.academicYear === selectedYear);
  }, [classes, selectedYear]);

  React.useEffect(() => {
    setSelectedClass('');
  }, [selectedYear]);

  const handleGenerateReport = async () => {
     if (!user?.schoolId || !selectedClass || !selectedYear) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a class and year.' });
      return;
    }
    setIsGenerating(true);
    setReportData(null);
    try {
      const result = await generateContinuousAssessmentReport({
        schoolId: user.schoolId,
        classId: selectedClass,
        academicYear: selectedYear,
      });
       if (result.success && result.data) {
        setReportData(result.data);
        if (result.data.studentReports.length === 0) {
          toast({ title: 'No Data', description: 'No assessment marks found for the selected class and year.' });
        }
      } else {
        throw new Error(result.message || 'Failed to generate report.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Generating Report', description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleGenerateComment = async (studentId: string, term: 'term1' | 'term2' | 'term3') => {
    const studentReport = reportData?.studentReports.find(r => r.student.id === studentId);
    if (!studentReport) return;
    
    const termData = studentReport[term];
    const termNumber = term.replace('term', '');
    const endOfTermAssessment = `End of Term ${termNumber}`;

    const hasEndOfTermData = termData.assessments.includes(endOfTermAssessment);

    if (!hasEndOfTermData) {
        toast({variant: 'destructive', title: 'No Data', description: `No End of Term marks found for ${term.replace('m', 'm ')} to generate a comment.`});
        return;
    }

    const grades = Object.entries(termData.subjects).map(([subjectName, assessments]) => {
        const assessmentData = assessments[endOfTermAssessment];
        return assessmentData ? `${subjectName}: ${assessmentData.grade}` : null;
    }).filter(Boolean).join(', ');

    if (!grades) {
        toast({variant: 'destructive', title: 'No Data', description: `Not enough data for ${term.replace('m', 'm ')} to generate a comment.`});
        return;
    }

    const loadingKey = `${studentId}-${term}`;
    setIsGeneratingAi(prev => ({...prev, [loadingKey]: true}));
    try {
        const result = await generateReportComment({
            studentName: studentReport.student.fullName,
            grades,
            overallGrade: '', 
            overallRemarks: ''
        });

        if (result.comment) {
            setComments(prev => ({
                ...prev, 
                [studentId]: {
                    ...prev[studentId],
                    [term]: result.comment
                }
            }));
        } else {
            throw new Error("AI did not return a comment.");
        }
    } catch (e: any) {
        toast({variant: 'destructive', title: 'AI Error', description: e.message || "Could not generate comment."});
    } finally {
        setIsGeneratingAi(prev => ({...prev, [loadingKey]: false}));
    }
  }


  return (
    <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Continuous Assessment Report</CardTitle>
            <CardDescription>Select a class and year to see a summary of all test and exam marks for the entire year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
               <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingClasses || filteredClasses.length === 0}>
                <SelectTrigger><SelectValue placeholder={loadingClasses ? "Loading..." : (filteredClasses.length === 0 ? "No classes for year" : "Select Class")} /></SelectTrigger>
                <SelectContent>{filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
               <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedClass}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {isGenerating && <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>}
        
        {reportData && (
             <div className="mt-6">
                <Card className="mb-6 printable-hidden">
                    <CardHeader>
                        <CardTitle>Report Options</CardTitle>
                        <CardDescription>Choose how to handle teacher comments for the end of each term.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="comment-mode" className="text-sm font-medium">Teacher's Remarks</Label>
                        <Select value={commentMode} onValueChange={(v) => setCommentMode(v as CommentMode)}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">Leave Blank</SelectItem><SelectItem value="manual">Enter Manually</SelectItem><SelectItem value="ai">Generate with AI</SelectItem></SelectContent></Select>
                    </div>
                    </CardContent>
                </Card>

                 {commentMode !== 'blank' && (
                    <Card className="mb-6 printable-hidden">
                        <CardHeader>
                            <CardTitle>Enter Teacher Remarks</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {reportData.studentReports.map(report => (
                                <div key={report.student.id} className="space-y-4 p-4 border rounded-lg">
                                    <h4 className="font-semibold">{report.student.fullName}</h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                    {([ 'term1', 'term2', 'term3' ] as const).map(term => (
                                        <div key={term} className="space-y-2">
                                            <Label className="text-sm font-medium text-muted-foreground">Comment for {term.replace('m', 'm ').toUpperCase()}</Label>
                                            <div className="flex items-center gap-2">
                                                <Textarea
                                                    placeholder={`Enter remarks for ${term.replace('m', 'm ')}...`}
                                                    value={comments[report.student.id]?.[term] || ''}
                                                    onChange={(e) => setComments(prev => ({ ...prev, [report.student.id]: { ...prev[report.student.id], [term]: e.target.value } }))}
                                                    readOnly={commentMode === 'ai'}
                                                />
                                                 {commentMode === 'ai' && (
                                                    <Button size="icon" variant="outline" onClick={() => handleGenerateComment(report.student.id, term)} disabled={isGeneratingAi[`${report.student.id}-${term}`]}>
                                                        {isGeneratingAi[`${report.student.id}-${term}`] ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <ContinuousAssessmentReport data={reportData} comments={comments} />
             </div>
        )}

        {!isGenerating && !reportData && (
             <Card className="mt-6"><CardContent className="py-20 text-center text-muted-foreground">
                <BarChart className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Report will be displayed here</h3>
                <p className="mt-1 text-sm">Select a class and year, then click "Generate".</p>
            </CardContent></Card>
        )}
    </div>
  );
}


export default function GenerateReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  
  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) return;
    setLoadingClasses(true);
    const q = query(
      collection(firestore, 'schools', user.schoolId, 'classes'),
      where('teacherId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedClasses = snap.docs
          .map((doc) => ({ ...(doc.data() as Class), id: doc.id }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(fetchedClasses);
        setLoadingClasses(false);
      },
      (error) => {
        console.error('Error fetching classes:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch your classes.',
        });
        setLoadingClasses(false);
      }
    );
    return () => unsub();
  }, [firestore, user?.schoolId, user?.uid, toast]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assessment Reports</h2>
          <p className="text-muted-foreground">
            Generate and view reports for your students.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="end-of-term" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="end-of-term">End of Term Report</TabsTrigger>
            <TabsTrigger value="continuous-assessment">Continuous Assessment</TabsTrigger>
        </TabsList>
        <TabsContent value="end-of-term" className="mt-6">
            <EndOfTermReportTab classes={classes} loadingClasses={loadingClasses} />
        </TabsContent>
        <TabsContent value="continuous-assessment" className="mt-6">
            <ContinuousAssessmentTab classes={classes} loadingClasses={loadingClasses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    