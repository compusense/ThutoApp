
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Class } from '@/app/school-head/classes/page';
import { Subject } from '@/app/super-admin/subjects/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Plus, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { School } from '@/app/super-admin/schools/page';
import { AddSubjectsToClassDialog } from './add-subjects-to-class-dialog';
import { removeSubjectFromClass } from './actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface AssignedSubject extends Subject {
    assignmentId: string;
}


export default function ClassSubjectsPage() {
  const { classId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [classData, setClassData] = useState<Class | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddSubjectsDialogOpen, setAddSubjectsDialogOpen] = useState(false);
  const [subjectToRemove, setSubjectToRemove] = useState<AssignedSubject | null>(null);

  const academicYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    if (!firestore || !user?.schoolId || !classId) return;

    const unsubs: (()=>void)[] = [];

    const schoolRef = doc(firestore, 'schools', user.schoolId);
    unsubs.push(onSnapshot(schoolRef, (docSnap) => {
        setSchool(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as School : null);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}`,
            operation: 'get',
        }));
    }));

    const classRef = doc(firestore, 'schools', user.schoolId, 'classes', classId as string);
    unsubs.push(onSnapshot(classRef, (docSnap) => {
      setClassData(docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as Class : null);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}/classes/${classId}`,
            operation: 'get',
        }));
    }));
    
    // Fetch master subjects
    const masterSubjectsQuery = query(collection(firestore, 'subjects'));
    unsubs.push(onSnapshot(masterSubjectsQuery, (snapshot) => {
        const subjects = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Subject));
        setMasterSubjects(subjects);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'subjects',
            operation: 'list',
        }));
    }));

    return () => unsubs.forEach(unsub => unsub());

  }, [firestore, user, classId]);

  useEffect(() => {
    if(!firestore || !user?.schoolId || !classId) return;

    setLoading(true);
    const assignedSubjectsQuery = query(collection(firestore, 'schools', user.schoolId, 'classes', classId as string, 'subjects'), where('academicYear', '==', selectedYear));
    const unsubscribe = onSnapshot(assignedSubjectsQuery, async (snapshot) => {
        const subjectAssignments = snapshot.docs.map(doc => ({ id: doc.id, subjectId: doc.data().subjectId, ...doc.data() }));

        if (subjectAssignments.length > 0 && masterSubjects.length > 0) {
            const masterSubjectMap = new Map(masterSubjects.map(s => [s.id, s]));
            const subjects: AssignedSubject[] = subjectAssignments.map(assignment => {
                const master = masterSubjectMap.get(assignment.subjectId);
                return {
                    ...master!,
                    id: assignment.subjectId, // Use master subject Id
                    assignmentId: assignment.id // Use the unique Id from the subcollection for removal
                }
            }).filter(Boolean); // Filter out any potential mismatches
            setAssignedSubjects(subjects);
        } else {
            setAssignedSubjects([]);
        }
        setLoading(false);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}/classes/${classId}/subjects`,
            operation: 'list',
        }));
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user, classId, selectedYear, masterSubjects]);


  const handleRemoveSubject = async () => {
    if (!subjectToRemove || !user?.schoolId || !classId) return;
    try {
        const result = await removeSubjectFromClass({
            schoolId: user.schoolId,
            classId: classId as string,
            assignmentId: subjectToRemove.assignmentId,
        });
        if (result.success) {
            toast({ title: "Subject Removed", description: `${subjectToRemove.name} has been removed from the class for ${selectedYear}.` });
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to remove subject." });
    } finally {
        setSubjectToRemove(null);
    }
  }

  const availableSubjectsToAdd = useMemo(() => {
    const assignedIds = new Set(assignedSubjects.map(s => s.id));
    return masterSubjects.filter(s => s.schoolLevel === school?.schoolType && !assignedIds.has(s.id));
  }, [masterSubjects, assignedSubjects, school]);


  if (!classData && !loading) {
    return <div className="p-8 text-center">Class not found.</div>;
  }

  return (
    <>
      <div className="flex items-start justify-between space-y-2 mb-6">
        <div>
            <Button variant="ghost" onClick={() => router.push('/school-head/classes')} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Classes
            </Button>
            {loading && !classData ? (
                <>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-48" />
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-bold tracking-tight">Manage Subjects: {classData?.name}</h2>
                    <p className="text-muted-foreground">
                        Allocate subjects taught in this class for a specific academic year.
                    </p>
                </>
            )}
        </div>
        <div className="flex items-center space-x-2 pt-16">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                    {academicYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button onClick={() => setAddSubjectsDialogOpen(true)} disabled={!school}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subjects
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Subjects for {selectedYear}</CardTitle>
          <CardDescription>
            {assignedSubjects.length} subject(s) allocated for this academic year.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : assignedSubjects.length > 0 ? (
                <ul className="divide-y divide-border">
                    {assignedSubjects.map(subject => (
                        <li key={subject.assignmentId} className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium">{subject.name}</p>
                                <p className="text-sm text-muted-foreground">{subject.subjectCode}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSubjectToRemove(subject)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Remove subject</span>
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Subjects Allocated</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Get started by adding subjects for the {selectedYear} academic year.
                    </p>
                    <Button className="mt-4" onClick={() => setAddSubjectsDialogOpen(true)}>
                         <Plus className="mr-2 h-4 w-4" />
                         Add Subjects
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
      
      <AddSubjectsToClassDialog
        isOpen={isAddSubjectsDialogOpen}
        onOpenChange={setAddSubjectsDialogOpen}
        schoolId={user?.schoolId}
        classId={classId as string}
        academicYear={selectedYear}
        availableSubjects={availableSubjectsToAdd}
      />

       <AlertDialog open={!!subjectToRemove} onOpenChange={(open) => !open && setSubjectToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {subjectToRemove?.name} from {classData?.name} for {selectedYear}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubjectToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveSubject}>
                Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
