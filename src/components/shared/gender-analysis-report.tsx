'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface GradeInfo {
  count: number;
  percentage: number;
}
interface GenderPerformanceSummary {
    roll: number;
    grades: { 
        A: GradeInfo;
        B: GradeInfo;
        C: GradeInfo;
        D: GradeInfo;
        E: GradeInfo;
    };
    passRate: number;
    qualityPassRate: number;
}

interface SummaryData {
    overall: {
        grades: {
            A: { count: number; };
            B: { count: number; };
            C: { count: number; };
            D: { count: number; };
            E: { count: number; };
        };
        passRate: number;
        qualityPassRate: number;
    };
    gender: {
        boys: GenderPerformanceSummary;
        girls: GenderPerformanceSummary;
    }
}

interface GenderAnalysisReportProps {
  summaryData: SummaryData;
  assessmentName: string;
  term: string;
  year: string;
  className: string;
  teacherName: string | null;
}

const gradeKeys: (keyof GenderPerformanceSummary['grades'])[] = ['A', 'B', 'C', 'D', 'E'];

export function GenderAnalysisReport({ summaryData, assessmentName, term, year, className, teacherName }: GenderAnalysisReportProps) {
  const { boys, girls } = summaryData.gender;
  const totalRoll = boys.roll + girls.roll;

  if (totalRoll === 0) {
    return (
        <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
                No student data available to perform gender analysis.
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="printable-area">
      <CardHeader>
        <CardTitle>Analysis by Gender for {className}  {teacherName && ` : ${teacherName}`}</CardTitle>
        <CardDescription>
          Performance by gender for {assessmentName}, {term}, {year}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Roll</TableHead>
                {gradeKeys.map(grade => (
                  <TableHead key={grade} className="text-center">{grade}</TableHead>
                ))}
                <TableHead className="text-center font-bold">AB %</TableHead>
                <TableHead className="text-center font-bold">ABC %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Boys</TableCell>
                <TableCell className="text-center">{boys.roll}</TableCell>
                {gradeKeys.map(grade => (
                  <TableCell key={`boys-${grade}`} className="text-center">{boys.grades[grade]?.count || 0}</TableCell>
                ))}
                <TableCell className="text-center font-bold">{boys.qualityPassRate.toFixed(1)}%</TableCell>
                <TableCell className="text-center font-bold">{boys.passRate.toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Girls</TableCell>
                <TableCell className="text-center">{girls.roll}</TableCell>
                {gradeKeys.map(grade => (
                  <TableCell key={`girls-${grade}`} className="text-center">{girls.grades[grade]?.count || 0}</TableCell>
                ))}
                <TableCell className="text-center font-bold">{girls.qualityPassRate.toFixed(1)}%</TableCell>
                <TableCell className="text-center font-bold">{girls.passRate.toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Class Total</TableCell>
                <TableCell className="text-center">{totalRoll}</TableCell>
                {gradeKeys.map(grade => (
                    <TableCell key={`total-${grade}`} className="text-center">{summaryData.overall.grades[grade].count}</TableCell>
                ))}
                <TableCell className="text-center font-extrabold">{summaryData.overall.qualityPassRate.toFixed(1)}%</TableCell>
                <TableCell className="text-center font-extrabold">{summaryData.overall.passRate.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
