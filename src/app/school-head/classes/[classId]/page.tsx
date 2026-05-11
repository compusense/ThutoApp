
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, writeBatch, deleteDoc, getDoc, where, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Class } from '../page';
import { Student } from '../../students/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '../../students/components/data-table';
import { getColumns } from './columns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AddStudentsToClassDialog } from './add-students-to-class-dialog';
import { removeStudentFromClass } from './actions';
import { useToast } from '@/hooks/use-toast';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ClassRollPage() {
  const { classId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [classData, setClassData] = useState<Class | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [allSchoolStudents, setAllSchoolStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddStudentsDialogOpen, setAddStudentsDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);

  useEffect(() => {
    if (!firestore || !user?.schoolId || !classId) return;

    const classRef = doc(firestore, 'schools', user.schoolId, 'classes', classId as string);
    const classUnsub = onSnapshot(classRef, (docSnap) => {
      if (docSnap.exists()) {
        setClassData({ ...docSnap.data(), id: docSnap.id } as Class);
      } else {
        setClassData(null);
      }
      setLoading(false);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}/classes/${classId}`,
            operation: 'get',
        }));
    });

    // Fetches all students in the school
    const allStudentsQuery = query(collection(firestore, 'schools', user.schoolId, 'students'));
    const allStudentsUnsub = onSnapshot(allStudentsQuery, (allStudentsSnapshot) => {
        const allStudents = allStudentsSnapshot.docs.map(d => ({ ...d.data(), id: d.id, fullName: `${d.data().firstName} ${d.data().surname}` } as Student));
        setAllSchoolStudents(allStudents);

        // Filter for currently enrolled students based on their classId field
        const currentlyEnrolled = allStudents.filter(s => s.classId === classId);
        setEnrolledStudents(currentlyEnrolled);

    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}/students`,
            operation: 'list',
        }));
    });
    

    return () => {
      classUnsub();
      allStudentsUnsub();
    };
  }, [firestore, user, classId]);

  const handleRemoveStudent = async () => {
    if (!studentToRemove || !user?.schoolId || !classId) return;
    try {
        const result = await removeStudentFromClass({
            schoolId: user.schoolId,
            classId: classId as string,
            studentId: studentToRemove.id,
        });
        if (result.success) {
            toast({ title: "Student Removed", description: `${studentToRemove.fullName} has been removed from the class.` });
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to remove student." });
    } finally {
        setStudentToRemove(null);
    }
  }


  const columns = useMemo(() => getColumns(setStudentToRemove), [setStudentToRemove]);
  
  if (loading) {
    return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!classData) {
    return <div className="p-8 text-center">Class not found.</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
            <Button variant="ghost" onClick={() => router.push('/school-head/classes')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Classes
            </Button>
          <h2 className="text-3xl font-bold tracking-tight">Class Roll: {classData.name}</h2>
          <p className="text-muted-foreground">
            Manage students currently enrolled in this class.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setAddStudentsDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Students
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students</CardTitle>
          <CardDescription>
            {enrolledStudents.length} student(s) currently in this class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={enrolledStudents} loading={false} classes={[]} />
        </CardContent>
      </Card>
      
      <AddStudentsToClassDialog
        isOpen={isAddStudentsDialogOpen}
        onOpenChange={setAddStudentsDialogOpen}
        schoolId={user!.schoolId!}
        classId={classId as string}
        allSchoolStudents={allSchoolStudents}
        enrolledStudentIds={enrolledStudents.map(s => s.id)}
      />

       <AlertDialog open={!!studentToRemove} onOpenChange={(open) => !open && setStudentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {studentToRemove?.fullName} from {classData.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStudentToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveStudent}>
                Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
