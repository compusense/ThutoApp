
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { SchoolClassSummaryReport } from "../actions";

interface ClassSummaryReportProps {
  report: SchoolClassSummaryReport;
}

export function ClassSummaryReport({ report }: ClassSummaryReportProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const gradeKeys: (keyof SchoolClassSummaryReport['classSummaries'][0]['gradeCounts'])[] = ['A', 'B', 'C', 'D', 'E'];
  const combinedGradeKeys: (keyof SchoolClassSummaryReport['classSummaries'][0]['combinedCounts'])[] = ['AB', 'ABC', 'DE'];

  return (
    <div className="printable-area">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Results Summary by Class for {report.schoolName}</CardTitle>
              <CardDescription>{report.assessment}, {report.term} {report.academicYear}</CardDescription>
            </div>
            <Button variant="outline" onClick={handlePrint} className="printable-hidden">
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {report.classSummaries.length > 0 ? (
            <div className='overflow-x-auto rounded-md border'>
              <Table noWrap className='report-table min-w-full'>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className='sticky left-0 bg-white border-r'>Class</TableHead>
                    <TableHead rowSpan={2} className='border-r'>Roll</TableHead>
                    <TableHead colSpan={8} className='text-center border-r'>Grades</TableHead>
                    <TableHead colSpan={3} className='text-center'>Grade Percentages</TableHead>
                  </TableRow>
                  <TableRow>
                    {gradeKeys.map(k => <TableHead key={`count-${k}`} className='text-center'>{k}</TableHead>)}
                    {combinedGradeKeys.map(k => <TableHead key={`count-comb-${k}`} className='text-center font-bold'>{k}</TableHead>)}
                    <TableHead className='text-center font-bold border-l'>% Pass (A-C)</TableHead>
                    <TableHead className='text-center font-bold'>% Quality (A-B)</TableHead>
                    <TableHead className='text-center font-bold'>% Fail (D-E)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.classSummaries.map(summary => (
                    <TableRow key={summary.classId}>
                      <TableCell className='font-medium sticky left-0 bg-white border-r'>
                        <span className="p-0 h-auto font-medium">
                          {summary.className}
                        </span>
                      </TableCell>
                      <TableCell className='text-center border-r'>{summary.roll || 0}</TableCell>
                      {gradeKeys.map(k => <TableCell key={`val-count-${k}`} className='text-center'>{summary.gradeCounts?.[k]?.count || 0}</TableCell>)}
                      {combinedGradeKeys.map(k => <TableCell key={`val-comb-${k}`} className='text-center font-bold'>{summary.combinedCounts?.[k] || 0}</TableCell>)}
                      <TableCell className='text-center font-bold border-l'>{(summary.gradePercentages?.ABC ?? 0).toFixed(1)}%</TableCell>
                      <TableCell className='text-center font-bold'>{(summary.gradePercentages?.AB ?? 0).toFixed(1)}%</TableCell>
                      <TableCell className='text-center font-bold'>{(summary.gradePercentages?.DE ?? 0).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className='font-bold bg-muted'>
                    <TableCell className='sticky left-0 bg-muted border-r'>TOTAL</TableCell>
                    <TableCell className='text-center border-r'>{report.totals.roll}</TableCell>
                    {gradeKeys.map(k => <TableCell key={`total-count-${k}`} className='text-center'>{report.totals.gradeCounts?.[k]?.count || 0}</TableCell>)}
                    {combinedGradeKeys.map(k => <TableCell key={`total-comb-${k}`} className='text-center'>{report.totals.combinedCounts?.[k] || 0}</TableCell>)}
                    <TableCell className='text-center border-l'>{(report.totals.gradePercentages?.ABC ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className='text-center'>{(report.totals.gradePercentages?.AB ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className='text-center'>{(report.totals.gradePercentages?.DE ?? 0).toFixed(1)}%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              No results found for this school for the selected period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
