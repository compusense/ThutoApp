
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

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
    qualityPassRate: number; // A+B
    passRate: number; // A+B+C
    failRate: number; // D+E
}
interface SummaryData {
    bySubject: Record<string, GradeSummary>;
    overall: GradeSummary;
}
interface Subject { id: string; name: string; }

interface ClassReportSummaryProps {
  summaryData: SummaryData;
  subjects: Subject[];
}

const abbreviateSubject = (name: string): string => {
    const abbreviations: Record<string, string> = {
        "social studies": "S/Studies",
        "religious and moral education": "R.M.E",
        "environmental science": "E/Science",
        "cultural studies": "C/Studies",
        "mathematics": "Maths",
    };
    const lowerCaseName = name.toLowerCase();
    if (abbreviations[lowerCaseName]) {
        return abbreviations[lowerCaseName];
    }
    const words = name.split(' ');
    if (words.length > 2) {
      return words.map(word => word.charAt(0).toUpperCase()).join('.');
    }
    return name;
};

export function ClassReportSummary({ summaryData, subjects }: ClassReportSummaryProps) {
  const gradeKeys: (keyof GradeSummary['grades'])[] = ['A', 'B', 'C', 'D', 'E'];
  
  return (
    <div className="space-y-6 summary-container">
      <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-1.5">
          <h3 className="text-2xl font-semibold leading-none tracking-tight summary-title">Performance Summary</h3>
          <p className="text-sm text-black/60 summary-description">Grade distribution and pass rates for each subject and the overall class average.</p>
        </div>
        <div className="overflow-x-auto rounded-md border">
            <Table noWrap className="summary-table min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Subject</TableHead>
                  {gradeKeys.map(grade => <TableHead key={grade} className="text-center font-bold">{grade}</TableHead>)}
                  <TableHead className="text-center font-bold">Quality Pass % (A+B)</TableHead>
                  <TableHead className="text-center font-bold">Pass % (A-C)</TableHead>
                  <TableHead className="text-center font-bold">Fail % (D-E)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(subject => {
                  const subjectSummary = summaryData?.bySubject?.[subject.id];
                  return (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium" title={subject.name}>{abbreviateSubject(subject.name)}</TableCell>
                      {gradeKeys.map(grade => {
                          const gradeInfo = subjectSummary?.grades?.[grade];
                          return (
                            <TableCell key={grade} className="text-center">
                                {gradeInfo?.count ?? 0} ({(gradeInfo?.percentage ?? 0).toFixed(1)}%)
                            </TableCell>
                          )
                      })}
                      <TableCell className="text-center font-semibold">{(subjectSummary?.qualityPassRate ?? 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-center font-semibold">{(subjectSummary?.passRate ?? 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-center font-semibold text-destructive">{(subjectSummary?.failRate ?? 0).toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold bg-muted/50 text-base">
                    <TableCell>Overall Class Performance</TableCell>
                    {gradeKeys.map(grade => {
                      const gradeInfo = summaryData?.overall?.grades?.[grade];
                      return (
                        <TableCell key={grade} className="text-center">
                            {gradeInfo?.count ?? 0} ({(gradeInfo?.percentage ?? 0).toFixed(1)}%)
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center">{(summaryData?.overall?.qualityPassRate ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-center">{(summaryData?.overall?.passRate ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-center text-destructive">{(summaryData?.overall?.failRate ?? 0).toFixed(1)}%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
        </div>
      </div>
    </div>
  );
}
