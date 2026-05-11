
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { UserProfile } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Subject } from '@/app/super-admin/subjects/page';
import { getSubjectPerformance, SubjectPerformanceReport, generateAllSubjectsReport, AllSubjectsReportData } from '@/app/reports/results-metrics/actions';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, LabelList } from 'recharts';
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from '@/components/ui/chart';

const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

// Function to get color based on percentage
const getGradientColor = (percentage: number) => {
    // Hue from red (0) to green (120)
    const hue = (percentage / 100) * 120;
    return `hsl(${hue}, 70%, 50%)`;
};


export function ResultsMetricsView({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isGenerating, setIsGenerating] = useState(false);

  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const [report, setReport] = useState<SubjectPerformanceReport | null>(null);
  const [allSubjectsReport, setAllSubjectsReport] = useState<AllSubjectsReportData[] | null>(null);


  React.useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setLoadingSubjects(false);
      return;
    }

    const schoolTypeQuery = query(collection(firestore, 'schools'), where('__name__', '==', user.schoolId));
    const unsubSchool = onSnapshot(schoolTypeQuery, (schoolSnap) => {
        if (!schoolSnap.empty) {
            const schoolData = schoolSnap.docs[0].data();
            const q = query(collection(firestore, 'subjects'), where('schoolLevel', '==', schoolData.schoolType));
            const unsubSubjects = onSnapshot(q, (subjectsSnap) => {
                const fetchedSubjects = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
                setSubjects(fetchedSubjects.sort((a,b) => a.name.localeCompare(b.name)));
                setLoadingSubjects(false);
            });
            return () => unsubSubjects();
        }
    });

    return () => unsubSchool();

  }, [firestore, user?.schoolId]);

  const handleGenerateReport = async () => {
    if (!user?.schoolId || !selectedYear || !selectedTerm || !selectedAssessment || !selectedSubject) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select all filter options.' });
      return;
    }
    setIsGenerating(true);
    setReport(null);
    setAllSubjectsReport(null);

    try {
        if (selectedSubject === 'all-subjects') {
            const result = await generateAllSubjectsReport({
                schoolId: user.schoolId,
                academicYear: selectedYear,
                term: selectedTerm,
                assessment: selectedAssessment,
            });
            if (result.success && result.data) {
                setAllSubjectsReport(result.data);
                 if (result.data.length === 0) {
                    toast({ title: 'No Data', description: 'No results found for any subject in the selected period.' });
                }
            } else {
                throw new Error(result.message || 'Failed to generate all subjects report.');
            }
        } else {
             const result = await getSubjectPerformance({
                schoolId: user.schoolId,
                academicYear: selectedYear,
                term: selectedTerm,
                assessment: selectedAssessment,
                subjectId: selectedSubject,
            });

            if (result.success && result.data) {
                setReport(result.data);
                if (result.data.classPerformances.length === 0) {
                toast({ title: 'No Data', description: 'No results found for this subject in the selected period.' });
                }
            } else {
                throw new Error(result.message || 'Failed to generate report.');
            }
        }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Generating Report', description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const singleSubjectChartData = useMemo(() => {
    return report?.classPerformances.map(cp => ({
      name: cp.className.replace('Standard ', 'Std '),
      'Quality Pass (A+B)': parseFloat(cp.abPassPercentage.toFixed(1)),
      'Overall Pass (A-C)': parseFloat(cp.abcPassPercentage.toFixed(1)),
    })) || [];
  }, [report]);
  
  const singleSubjectChartConfig = {
    'Quality Pass (A+B)': {
        label: 'Quality Pass (A,B)',
        color: '#10b981',
    },
    'Overall Pass (A-C)': {
        label: 'Overall Pass (A,B,C)',
        color: '#3b82f6',
    },
  };

  const allSubjectsChartData = useMemo(() => {
    return allSubjectsReport?.map(sub => ({
        name: sub.subjectName,
        'Pass Rate': sub.passRate,
    })) || [];
  }, [allSubjectsReport]);

  const allSubjectsChartConfig = {
     'Pass Rate': {
         label: 'Overall Pass % (A-C)',
         color: '#3b82f6',
     }
  };
  

  return (
    <>
      <div className="printable-hidden space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Results Metrics</h2>
            <p className="text-muted-foreground">Analyze and compare subject performance across all classes.</p>
          </div>
            {(report || allSubjectsReport) && (
             <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
            )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Subject Report</CardTitle>
            <CardDescription>Select a period and a subject to compare performance across classes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v as Term)}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Term" /></SelectTrigger>
                <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
                <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={!selectedTerm}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Select Assessment" /></SelectTrigger>
                <SelectContent>{(assessmentsByTerm[selectedTerm] || []).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder={loadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all-subjects">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedAssessment || !selectedSubject}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </CardContent>
        </Card>

        {isGenerating && (
             <Card>
                 <CardHeader><Skeleton className='h-8 w-1/2' /></CardHeader>
                 <CardContent><Skeleton className='h-96 w-full' /></CardContent>
             </Card>
        )}
      </div>

      {report && (
        <div className="printable-area mt-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Subject Report: {report?.subjectName}</CardTitle>
                    <CardDescription>{report?.assessment}, {report?.term} {report?.academicYear}</CardDescription>
                </CardHeader>
                <CardContent>
                {report.classPerformances.length > 0 ? (
                    <div className="grid lg:grid-cols-2 gap-8">
                      <div className='overflow-x-auto'>
                        <Table className='report-table'>
                           <TableHeader>
                                <TableRow>
                                    <TableHead>Class</TableHead>
                                    <TableHead className="text-center">Roll</TableHead>
                                    <TableHead className="text-center">A</TableHead>
                                    <TableHead className="text-center">B</TableHead>
                                    <TableHead className="text-center">C</TableHead>
                                    <TableHead className="text-center">D</TableHead>
                                    <TableHead className="text-center">E</TableHead>
                                    <TableHead className="text-center font-bold">AB %</TableHead>
                                    <TableHead className="text-center font-bold">ABC %</TableHead>
                                </TableRow>
                           </TableHeader>
                            <TableBody>
                                {report.classPerformances.map(summary => (
                                    <TableRow key={summary.classId}>
                                        <TableCell className='font-medium no-wrap'>{summary.className}</TableCell>
                                        <TableCell className='text-center'>{summary.roll}</TableCell>
                                        <TableCell className='text-center'>{summary.gradeCounts.A}</TableCell>
                                        <TableCell className='text-center'>{summary.gradeCounts.B}</TableCell>
                                        <TableCell className='text-center'>{summary.gradeCounts.C}</TableCell>
                                        <TableCell className='text-center'>{summary.gradeCounts.D}</TableCell>
                                        <TableCell className='text-center'>{summary.gradeCounts.E}</TableCell>
                                        <TableCell className='text-center font-medium'>{summary.abPassPercentage.toFixed(1)}%</TableCell>
                                        <TableCell className='text-center font-medium'>{summary.abcPassPercentage.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold bg-muted/50">
                                    <TableCell>Total</TableCell>
                                    <TableCell className="text-center">{report.totals.roll}</TableCell>
                                    <TableCell className="text-center">{report.totals.gradeCounts.A}</TableCell>
                                    <TableCell className="text-center">{report.totals.gradeCounts.B}</TableCell>
                                    <TableCell className="text-center">{report.totals.gradeCounts.C}</TableCell>
                                    <TableCell className="text-center">{report.totals.gradeCounts.D}</TableCell>
                                    <TableCell className="text-center">{report.totals.gradeCounts.E}</TableCell>
                                    <TableCell className='text-center font-bold'>{report.totals.abPassPercentage.toFixed(1)}%</TableCell>
                                    <TableCell className='text-center font-bold'>{report.totals.abcPassPercentage.toFixed(1)}%</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                      </div>
                      
                      <div className="h-[300px] w-full">
                        <ChartContainer config={singleSubjectChartConfig} className="h-full w-full">
                           <BarChart data={singleSubjectChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                               <CartesianGrid vertical={false} />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                              <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                              <Legend content={<ChartLegendContent />} />
                              <Bar dataKey="Quality Pass (A+B)" fill={singleSubjectChartConfig['Quality Pass (A+B)'].color} radius={4}>
                                <LabelList dataKey="Quality Pass (A+B)" position="top" offset={4} className="fill-foreground" fontSize={10} formatter={(value: number) => `${value}%`} />
                              </Bar>
                              <Bar dataKey="Overall Pass (A-C)" fill={singleSubjectChartConfig['Overall Pass (A-C)'].color} radius={4}>
                                <LabelList dataKey="Overall Pass (A-C)" position="top" offset={4} className="fill-foreground" fontSize={10} formatter={(value: number) => `${value}%`} />
                              </Bar>
                            </BarChart>
                        </ChartContainer>
                      </div>

                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        No results found for this subject in the selected period.
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
      )}

      {allSubjectsReport && (
         <div className="printable-area mt-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>All Subjects Performance</CardTitle>
                    <CardDescription>{selectedAssessment}, {selectedTerm} {selectedYear}</CardDescription>
                </CardHeader>
                 <CardContent>
                     {allSubjectsReport.length > 0 ? (
                        <div className="h-[600px] w-full">
                            <ChartContainer config={allSubjectsChartConfig} className="h-full w-full">
                                <BarChart data={allSubjectsChartData} layout="vertical" margin={{ left: 80, right: 40, top: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={150} />
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                    <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                                    <Bar dataKey="Pass Rate" radius={5}>
                                        <LabelList 
                                            dataKey="Pass Rate" 
                                            position="insideRight" 
                                            offset={8} 
                                            className="fill-white" 
                                            fontSize={12}
                                            formatter={(value: number) => `${value.toFixed(1)}%`}
                                        />
                                         {allSubjectsChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getGradientColor(entry['Pass Rate'])} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </div>
                     ) : (
                         <div className="text-center py-10 text-muted-foreground">
                            No results found for any subject in the selected period.
                        </div>
                     )}
                 </CardContent>
            </Card>
         </div>
      )}
    </>
  );
}
