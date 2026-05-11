
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, getDoc, where, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Class } from '@/app/school-head/classes/page';
import { Student } from '@/app/school-head/students/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/app/school-head/students/components/data-table';
import { getColumns } from './columns';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function TeacherClassRollPage() {
  const { classId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [classData, setClassData] = useState<Class | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.schoolId || !classId) return;

    const classRef = doc(firestore, 'schools', user.schoolId, 'classes', classId as string);
    const classUnsub = onSnapshot(classRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().teacherId === user.uid) {
        const data = { ...docSnap.data(), id: docSnap.id } as Class;
        setClassData(data);
        
        setLoading(true);
        // Query all students in the school and filter by current classId
        const studentsQuery = query(collection(firestore, 'schools', user.schoolId!, 'students'), where('classId', '==', classId));
        const studentsUnsub = onSnapshot(studentsQuery, async (studentSnapshot) => {
            const enrolled = studentSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, fullName: `${doc.data()?.firstName} ${doc.data()?.surname}`, className: data.name } as Student));
            setEnrolledStudents(enrolled);
            setLoading(false);
        }, (err: FirestoreError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `schools/${user.schoolId}/students`,
                operation: 'list',
            }));
            setLoading(false);
        });

        // Cleanup student listener when component unmounts or deps change
        return () => studentsUnsub();

      } else {
        setClassData(null);
        setLoading(false);
      }
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${user.schoolId}/classes/${classId}`, operation: 'get' }));
        setLoading(false);
    });

    return () => {
      classUnsub();
    };
  }, [firestore, user, classId]);


  const columns = useMemo(() => getColumns(), []);
  
  if (loading) {
    return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!classData) {
    return <div className="p-8 text-center">Class not found or you do not have permission to view it.</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-6">
        <div>
            <Button variant="ghost" onClick={() => router.push('/teacher/my-classes')} className="mb-4 -ml-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Classes
            </Button>
          <h2 className="text-3xl font-bold tracking-tight">Class Roll: {classData.name}</h2>
          <p className="text-muted-foreground">
            A list of all students currently enrolled in your class.
          </p>
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
    </>
  );
}
