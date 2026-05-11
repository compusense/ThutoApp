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
import { Skeleton } from '@/components/ui/skeleton';
import { Class } from '@/app/school-head/classes/page';
import { School } from '@/app/super-admin/schools/page';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Loader2, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudentTrackRecord, StudentTrackRecord } from '@/app/school-head/results-tracking/actions';

interface ClassWithStudentCount extends Class {
  studentCount: number;
}

export default function TeacherResultsTrackingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 4 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>((new Date().getFullYear() - 1).toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = typeof terms[number];
  const [selectedTerm, setSelectedTerm] = useState<Term>(terms[0]);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const [trackingData, setTrackingData] = useState<StudentTrackRecord[] | null>(null);
  const [trackingPeriods, setTrackingPeriods] = useState<string[]>([]);
  
  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) return;
    setLoadingClasses(true);
    const q = query(
        collection(firestore, 'schools', user.schoolId, 'classes'),
        where('teacherId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedClasses = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class)).sort((a, b) => a.name.localeCompare(b.name));
      setAllClasses(fetchedClasses);
      setLoadingClasses(false);
    }, (error) => {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch classes.' });
      setLoadingClasses(false);
    });
    return () => unsub();
  }, [firestore, user?.schoolId, user?.uid, toast]);
  
  const activeClassesForSelection = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    return allClasses.filter(c => c.academicYear === currentYear);
  }, [allClasses]);

  const handleGenerateReport = async () => {
    if (!user?.schoolId || !selectedClass || !selectedYear || !selectedTerm) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a class, start year, and start term.' });
      return;
    }
    setIsGenerating(true);
    setTrackingData(null);
    setTrackingPeriods([]);

    try {
      const result = await getStudentTrackRecord({
        schoolId: user.schoolId,
        classId: selectedClass,
        startYear: parseInt(selectedYear),
        startTerm: selectedTerm,
      });

      if (result.success && result.data) {
        setTrackingData(result.data.records);
        setTrackingPeriods(result.data.periods);
        if (result.data.records.length === 0) {
          toast({ title: 'No Data', description: 'No students or results found for this class.' });
        }
      } else {
        throw new Error(result.message || 'Failed to generate tracking report.');
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

  const PerformanceIndicator = ({ current, previous }: { current: number | null, previous: number | null }) => {
    if (current === null || previous === null) {
      return null;
    }
    const diff = current - previous;
    if (Math.abs(diff) < 1) return null;

    const isPositive = diff > 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';

    return (
      <span className={cn("ml-1.5 inline-flex items-center text-xs font-semibold", colorClass)}>
        {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        <span className="ml-0.5">{Math.abs(diff).toFixed(1)}</span>
      </span>
    );
  };


  return (
    <>
      <div className="printable-hidden space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Student Results Tracking</h2>
            <p className="text-muted-foreground">Track individual student performance across multiple terms.</p>
          </div>
           {trackingData && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Tracking Parameters</CardTitle>
            <CardDescription>Choose a class and a starting point to track from.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingClasses}>
                <SelectTrigger><SelectValue placeholder={loadingClasses ? "Loading..." : "Select Class"} /></SelectTrigger>
                <SelectContent>{activeClassesForSelection.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Select Start Year" /></SelectTrigger>
                <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v as Term)}>
                <SelectTrigger><SelectValue placeholder="Select Start Term" /></SelectTrigger>
                <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={handleGenerateReport} disabled={isGenerating || !selectedClass}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Track Results
              </Button>
            </div>
          </CardContent>
        </Card>

        {isGenerating && (
          <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-96 w-full" /></CardContent>
          </Card>
        )}
      </div>

      {trackingData && (
        <div className="printable-area">
          <Card>
            <CardHeader>
                <CardTitle>Performance Track for {allClasses.find(c => c.id === selectedClass)?.name}</CardTitle>
                <CardDescription>
                    Tracking student performance from {selectedTerm}, {selectedYear}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {trackingData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table className="results-tracking-table">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-card border-b">Student Name</TableHead>
                                    {trackingPeriods.map(period => <TableHead key={period} className="text-center border-b">{period}</TableHead>)}
                                    <TableHead className="text-right font-bold sticky right-0 bg-card border-b">Overall Avg.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trackingData.map(student => (
                                    <TableRow key={student.studentId} className="border-0">
                                        <TableCell className="font-medium sticky left-0 bg-card border-b">{student.studentName}</TableCell>
                                        {trackingPeriods.map((period, index) => {
                                            const result = student.results[period];
                                            const prevResult = index > 0 ? student.results[trackingPeriods[index - 1]] : null;
                                            return (
                                                <TableCell key={period} className="text-center whitespace-nowrap border-b">
                                                    {result !== null ? (
                                                        <span className={result < 50 ? 'text-red-600 font-semibold' : ''}>
                                                            {result.toFixed(1)}%
                                                            <PerformanceIndicator current={result} previous={prevResult} />
                                                        </span>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-right font-bold sticky right-0 bg-card border-b">
                                            {student.average !== null ? `${student.average.toFixed(1)}%` : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        No tracking data available for the selected criteria.
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
