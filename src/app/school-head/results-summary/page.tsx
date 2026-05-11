
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getCountFromServer, doc, FirestoreError } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateSchoolResultsSummary, SchoolSummaryReport } from './actions';
import { cn } from '@/lib/utils';
import { GradeCounts } from './actions';


const assessmentsByTerm: Record<string, string[]> = {
  "Term 1": ["January Test", "February Test", "March Test", "End of Term 1"],
  "Term 2": ["May Test", "June Test", "July Test", "End of Term 2"],
  "Term 3": ["September Test", "October Test", "November Test", "End of Term 3"],
};

// Helper to create empty gender summary (for safe fallback)
function createEmptyGenderSummary() {
  return {
    roll: 0,
    grades: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    combinedCounts: { AB: 0, ABC: 0, DE: 0 },
    gradePercentages: { A: 0, B: 0, C: 0, D: 0, E: 0, AB: 0, ABC: 0, DE: 0 },
  };
}

export default function ResultsSummaryPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);

  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');

  const [report, setReport] = useState<SchoolSummaryReport | null>(null);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const handleTermChange = (termValue: string) => {
    const term = termValue as Term;
    setSelectedTerm(term);
    setSelectedAssessment('');
  };

  const handleGenerateReport = async () => {
    if (!user?.schoolId || !selectedYear || !selectedTerm || !selectedAssessment) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a year, term, and assessment.' });
      return;
    }
    setIsGenerating(true);
    setReport(null);
    setOpenRows(new Set());

    try {
      const result = await generateSchoolResultsSummary({
        schoolId: user.schoolId,
        academicYear: selectedYear,
        term: selectedTerm,
        assessment: selectedAssessment,
      });

      if (result.success && result.data) {
        setReport(result.data);
        if (result.data.classSummaries.length === 0) {
          toast({ title: 'No Data', description: 'No results found for any class in the selected period.' });
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

  const handlePrint = () => {
    window.print();
  };

  const gradeKeys = ['A', 'B', 'C', 'D', 'E'] as const;
  const combinedGradeKeys = ['AB', 'ABC', 'DE'] as const;
  const percentageKeys = ['A', 'B', 'C', 'D', 'E', 'AB', 'ABC', 'DE'] as const;

  const toggleRow = (classId: string) => {
    setOpenRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  };

  const GenderRow = ({ title, data }: { title: string; data: SchoolSummaryReport['classSummaries'][0]['genderSummaries']['boys' | 'girls'] }) => (
    <TableRow className="bg-muted/30">
      <TableCell className="pl-12 text-muted-foreground">{title}</TableCell>
      <TableCell className="text-center border-r">{data?.roll || 0}</TableCell>
      {gradeKeys.map(k => <TableCell key={`val-count-${k}`} className="text-center">{data?.gradeCounts?.[k]?.count || 0}</TableCell>)}
      {combinedGradeKeys.map(k => <TableCell key={`val-comb-${k}`} className="text-center font-bold">{data?.combinedCounts?.[k] || 0}</TableCell>)}
      {percentageKeys.map(k => <TableCell key={`val-perc-${k}`} className={cn('text-center border-l', k.length > 1 && 'font-bold')}>{(data?.gradePercentages?.[k] || 0).toFixed(1)}%</TableCell>)}
    </TableRow>
  );

  return (
    <>
      <div className="printable-hidden space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">School Results Summary</h2>
            <p className="text-muted-foreground">View aggregated results for the entire school for a specific assessment.</p>
          </div>
          {report && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>Select a year, term, and assessment to generate the school-wide results summary.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedTerm} onValueChange={handleTermChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment} disabled={!selectedTerm}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Assessment" />
                </SelectTrigger>
                <SelectContent>
                  {(assessmentsByTerm[selectedTerm] || []).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedAssessment}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </CardContent>
        </Card>

        {isGenerating && (
          <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-96 w-full" /></CardContent>
          </Card>
        )}
      </div>

      {report && (
        <div className="printable-area">
          <Card>
            <CardHeader>
              <CardTitle>Results Summary for {report.schoolName} - {report.assessment}, {report.term} {report.academicYear}</CardTitle>
              <CardDescription>An overview of performance across all classes for the selected assessment.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.classSummaries?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table className="summary-report-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="sticky left-0 bg-white border-r no-wrap">Standard</TableHead>
                        <TableHead rowSpan={2} className="border-r">Roll</TableHead>
                        <TableHead colSpan={8} className="text-center border-r">Grades</TableHead>
                        <TableHead colSpan={8} className="text-center">Grade Percentages</TableHead>
                      </TableRow>
                      <TableRow>
                        {gradeKeys.map(k => <TableHead key={`count-${k}`} className="text-center">{k}</TableHead>)}
                        {combinedGradeKeys.map(k => <TableHead key={`count-comb-${k}`} className="text-center font-bold">{k}</TableHead>)}
                        <TableHead className="border-l text-center">%A</TableHead>
                        <TableHead className="text-center">%B</TableHead>
                        <TableHead className="text-center">%C</TableHead>
                        <TableHead className="text-center">%D</TableHead>
                        <TableHead className="text-center">%E</TableHead>
                        <TableHead className="text-center font-bold">%AB</TableHead>
                        <TableHead className="text-center font-bold">%ABC</TableHead>
                        <TableHead className="text-center font-bold">%DE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.classSummaries.map(summary => (
                        <React.Fragment key={summary.classId}>
                          <TableRow>
                            <TableCell className="font-medium sticky left-0 bg-white border-r no-wrap">
                              <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleRow(summary.classId)}>
                                {openRows.has(summary.classId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="ml-2">{summary.className}</span>
                              </Button>
                            </TableCell>
                            <TableCell className="text-center border-r">{summary.roll || 0}</TableCell>
                            {gradeKeys.map(k => <TableCell key={`val-count-${k}`} className="text-center">{summary.gradeCounts?.[k]?.count || 0}</TableCell>)}
                            {combinedGradeKeys.map(k => <TableCell key={`val-comb-${k}`} className="text-center font-bold">{summary.combinedCounts?.[k] || 0}</TableCell>)}
                            {percentageKeys.map(k => <TableCell key={`val-perc-${k}`} className={cn('text-center border-l', k.length > 1 && 'font-bold')}>{(summary.gradePercentages?.[k] || 0).toFixed(1)}%</TableCell>)}
                          </TableRow>
                          {openRows.has(summary.classId) && (
                            <>
                              <GenderRow title="Boys" data={summary.genderSummaries?.boys || createEmptyGenderSummary()} />
                              <GenderRow title="Girls" data={summary.genderSummaries?.girls || createEmptyGenderSummary()} />
                            </>
                          )}
                        </React.Fragment>
                      ))}
                      <React.Fragment>
                        <TableRow className="font-bold bg-muted">
                          <TableCell className="sticky left-0 bg-muted border-r no-wrap">
                            <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleRow(report.totals.classId)}>
                              {openRows.has(report.totals.classId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="ml-2">TOTAL</span>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center border-r">{report.totals?.roll || 0}</TableCell>
                          {gradeKeys.map(k => <TableCell key={`total-count-${k}`} className="text-center">{report.totals?.gradeCounts?.[k]?.count || 0}</TableCell>)}
                          {combinedGradeKeys.map(k => <TableCell key={`total-comb-${k}`} className="text-center">{report.totals?.combinedCounts?.[k] || 0}</TableCell>)}
                          {percentageKeys.map(k => <TableCell key={`total-perc-${k}`} className="text-center border-l">{(report.totals?.gradePercentages?.[k] || 0).toFixed(1)}%</TableCell>)}
                        </TableRow>
                        {openRows.has(report.totals.classId) && (
                          <>
                            <GenderRow title="Boys (Total)" data={report.totals?.genderSummaries?.boys || createEmptyGenderSummary()} />
                            <GenderRow title="Girls (Total)" data={report.totals?.genderSummaries?.girls || createEmptyGenderSummary()} />
                          </>
                        )}
                      </React.Fragment>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No results found for the selected period.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
