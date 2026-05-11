
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Student } from '../../../students/page';
import { AssessmentRecord, getStudentMarksHistory, deleteStudentAssessmentMarks } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function ManageStudentMarksPage() {
  const params = useParams();
  const { studentId } = params;
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [student, setStudent] = React.useState<Student | null>(null);
  const [assessments, setAssessments] = React.useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [assessmentToDelete, setAssessmentToDelete] = React.useState<AssessmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !studentId) {
      setLoading(false);
      return;
    }

    // Fetch student details
    const studentRef = doc(firestore, 'schools', user.schoolId, 'students', studentId as string);
    const unsubStudent = onSnapshot(studentRef, (docSnap) => {
      setStudent(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Student : null);
    });

    // Fetch marks history
    const fetchHistory = async () => {
        try {
            const result = await getStudentMarksHistory({ schoolId: user.schoolId!, studentId: studentId as string });
            if (result.success && result.data) {
                setAssessments(result.data);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };
    
    fetchHistory();

    return () => unsubStudent();

  }, [firestore, user?.schoolId, studentId, toast]);

  const handleDelete = async () => {
    if (!assessmentToDelete || !user?.schoolId || !studentId) return;
    
    setIsDeleting(true);
    try {
        const result = await deleteStudentAssessmentMarks({
            schoolId: user.schoolId,
            studentId: studentId as string,
            ...assessmentToDelete,
        });

        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setAssessments(prev => prev.filter(a => !(a.academicYear === assessmentToDelete.academicYear && a.term === assessmentToDelete.term && a.assessment === assessmentToDelete.assessment)));
        } else {
            throw new Error(result.message);
        }

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsDeleting(false);
        setAssessmentToDelete(null);
    }
  };

  const groupedAssessments = React.useMemo(() => {
    return assessments.reduce((acc, current) => {
      const year = current.academicYear;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(current);
      return acc;
    }, {} as Record<string, AssessmentRecord[]>);
  }, [assessments]);

  const academicYears = Object.keys(groupedAssessments).sort((a, b) => b.localeCompare(a));

  if (loading) {
      return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
      );
  }

  if (!student) {
    return <p className="text-center">Student not found.</p>;
  }

  return (
    <div className="space-y-6">
       <div>
            <Button variant="ghost" onClick={() => router.push('/school-head/students')} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Student Registry
            </Button>
          <h2 className="text-3xl font-bold tracking-tight">Manage Marks for {student.firstName} {student.surname}</h2>
          <p className="text-muted-foreground">
            View and remove assessment marks recorded for this student. This action is permanent.
          </p>
        </div>
        
        {assessments.length === 0 ? (
            <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    No assessment marks have been recorded for this student.
                </CardContent>
            </Card>
        ) : (
            <Accordion type="multiple" defaultValue={academicYears} className="w-full space-y-4">
                {academicYears.map(year => (
                     <Card key={year}>
                        <AccordionItem value={year} className="border-b-0">
                            <AccordionTrigger className="p-6 text-xl font-semibold">
                                {year} Academic Year
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <ul className="divide-y divide-border">
                                    {groupedAssessments[year].map(assessment => (
                                        <li key={`${assessment.term}-${assessment.assessment}`} className="flex items-center justify-between py-3">
                                            <div>
                                                <p className="font-medium">{assessment.assessment}</p>
                                                <p className="text-sm text-muted-foreground">{assessment.term} - In Class: {assessment.className}</p>
                                            </div>
                                            <Button variant="destructive" size="sm" onClick={() => setAssessmentToDelete(assessment)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Marks
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                ))}
            </Accordion>
        )}

        <AlertDialog open={!!assessmentToDelete} onOpenChange={(open) => !open && setAssessmentToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete these marks?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete all marks for <span className="font-bold">{assessmentToDelete?.assessment}</span> ({assessmentToDelete?.term}, {assessmentToDelete?.academicYear}) for this student. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
