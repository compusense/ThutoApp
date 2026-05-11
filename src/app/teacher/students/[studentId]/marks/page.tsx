'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Student } from '@/app/school-head/students/page';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DetailedMark {
    subjectName: string;
    score: number;
    total: number;
    percentage: number;
    grade: string;
}

interface AssessmentRecord {
    academicYear: string;
    term: string;
    assessment: string;
    className: string;
    marks: DetailedMark[];
}

export default function TeacherViewStudentMarksPage() {
  const params = useParams();
  const { studentId } = params;
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [student, setStudent] = React.useState<Student | null>(null);
  const [assessments, setAssessments] = React.useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const getGrade = (percentage: number): string => {
    if (percentage >= 80) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 30) return 'D';
    return 'E';
  };

  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !studentId) {
      setLoading(false);
      return;
    }

    // 1. Fetch student details
    const studentRef = doc(firestore, 'schools', user.schoolId, 'students', studentId as string);
    const unsubStudent = onSnapshot(studentRef, (docSnap) => {
      setStudent(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Student : null);
    });

    // 2. Fetch all marks and group them by assessment session
    const fetchMarks = async () => {
        try {
            const marksQuery = query(collection(firestore, `schools/${user.schoolId}/students/${studentId}/marks`));
            const marksSnap = await getDocs(marksQuery);

            if (marksSnap.empty) {
                setAssessments([]);
                setLoading(false);
                return;
            }

            // Fetch all subjects and classes needed for names
            const subjectIds = new Set(marksSnap.docs.map(d => d.data().subjectId));
            const classIds = new Set(marksSnap.docs.map(d => d.data().classId));
            
            const subjectMap = new Map<string, string>();
            const classMap = new Map<string, string>();

            const subjectPromises = Array.from(subjectIds).map(id => getDoc(doc(firestore, 'subjects', id)));
            const classPromises = Array.from(classIds).map(id => getDoc(doc(firestore, `schools/${user.schoolId}/classes/${id}`)));
            
            const [subjectSnaps, classSnaps] = await Promise.all([
                Promise.all(subjectPromises),
                Promise.all(classPromises)
            ]);

            subjectSnaps.forEach(s => s.exists() && subjectMap.set(s.id, s.data().name));
            classSnaps.forEach(c => c.exists() && classMap.set(c.id, c.data().name));

            // Group marks by session
            const sessionsMap = new Map<string, AssessmentRecord>();

            marksSnap.docs.forEach(d => {
                const mark = d.data();
                const sessionKey = `${mark.academicYear}-${mark.term}-${mark.assessment}-${mark.classId}`;
                
                if (!sessionsMap.has(sessionKey)) {
                    sessionsMap.set(sessionKey, {
                        academicYear: mark.academicYear,
                        term: mark.term,
                        assessment: mark.assessment,
                        className: classMap.get(mark.classId) || 'Unknown Class',
                        marks: []
                    });
                }
                
                const percentage = mark.total > 0 ? (mark.score / mark.total) * 100 : 0;
                sessionsMap.get(sessionKey)!.marks.push({
                    subjectName: subjectMap.get(mark.subjectId) || 'Unknown Subject',
                    score: mark.score,
                    total: mark.total,
                    percentage,
                    grade: getGrade(percentage)
                });
            });

            const sortedRecords = Array.from(sessionsMap.values())
                .map(record => ({
                    ...record,
                    marks: record.marks.sort((a,b) => a.subjectName.localeCompare(b.subjectName))
                }))
                .sort((a, b) => 
                    b.academicYear.localeCompare(a.academicYear) || 
                    b.term.localeCompare(a.term)
                );

            setAssessments(sortedRecords);

        } catch (error: any) {
            console.error("Error fetching marks:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load marks history.' });
        } finally {
            setLoading(false);
        }
    };
    
    fetchMarks();

    return () => unsubStudent();

  }, [firestore, user?.schoolId, studentId, toast]);

  const groupedByYear = React.useMemo(() => {
    return assessments.reduce((acc, current) => {
      const year = current.academicYear;
      if (!acc[year]) acc[year] = [];
      acc[year].push(current);
      return acc;
    }, {} as Record<string, AssessmentRecord[]>);
  }, [assessments]);

  const academicYears = Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a));

  if (loading) {
      return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        </div>
      );
  }

  if (!student) {
    return <p className="text-center py-10">Student not found.</p>;
  }

  return (
    <div className="space-y-6">
       <div>
            <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
          <h2 className="text-3xl font-bold tracking-tight">Academic History: {student.firstName} {student.surname}</h2>
          <p className="text-muted-foreground">
            Complete record of all assessment results for this student.
          </p>
        </div>
        
        {assessments.length === 0 ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No assessment marks have been recorded for this student.</p>
                </CardContent>
            </Card>
        ) : (
            <Accordion type="multiple" defaultValue={academicYears} className="w-full space-y-4">
                {academicYears.map(year => (
                     <Card key={year}>
                        <AccordionItem value={year} className="border-b-0">
                            <AccordionTrigger className="p-6 text-xl font-semibold hover:no-underline">
                                {year} Academic Year
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0 space-y-6">
                                {groupedByYear[year].map((session, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex justify-between items-end border-b pb-2">
                                            <h4 className="font-bold text-primary">{session.assessment} ({session.term})</h4>
                                            <span className="text-xs text-muted-foreground italic">Class: {session.className}</span>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="h-10">
                                                    <TableHead className="h-10">Subject</TableHead>
                                                    <TableHead className="h-10 text-center">Mark</TableHead>
                                                    <TableHead className="h-10 text-center">Percentage</TableHead>
                                                    <TableHead className="h-10 text-right">Grade</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {session.marks.map((m, mIdx) => (
                                                    <TableRow key={mIdx} className="h-8">
                                                        <TableCell className="py-2 font-medium">{m.subjectName}</TableCell>
                                                        <TableCell className="py-2 text-center">{m.score} / {m.total}</TableCell>
                                                        <TableCell className="py-2 text-center">{m.percentage.toFixed(1)}%</TableCell>
                                                        <TableCell className="py-2 text-right font-bold">{m.grade}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                ))}
            </Accordion>
        )}
    </div>
  );
}
