'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, FirestoreError, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { School } from '@/app/super-admin/schools/page';
import { DataTable } from './components/data-table';
import { getColumns } from './components/columns';
import { CreateStudentDialog } from './components/create-student-dialog';
import { Class } from '../classes/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportStudentsAsCSV } from './components/csv-utils';
import { useToast } from '@/hooks/use-toast';
import { ImportStudentsDialog } from './components/import-students-dialog';

export interface Student {
  id: string;
  admissionNumber: string;
  idNumber?: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  gender: string;
  schoolId: string;
  classId?: string; // class they are enrolled in
  status: 'Active' | 'Dropped Out' | 'Transferred Out' | 'Deceased';
  dateOfStatusChange?: string;
  reasonForStatusChange?: string;
  uid?: string; // UID from Firebase Auth if an account exists
  // This will be composed on the client
  fullName?: string;
  className?: string;
}

export default function StudentRegistryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateStudentDialogOpen, setCreateStudentDialogOpen] = useState(false);
  const [isImportStudentDialogOpen, setImportStudentDialogOpen] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    const schoolQuery = query(collection(firestore, 'schools'), where('schoolHeadId', '==', user.uid));
    const schoolUnsub = onSnapshot(schoolQuery, (snapshot) => {
      if (isMounted) {
        if (!snapshot.empty) {
          const schoolData = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as School;
          setSchool(schoolData);

          const studentsQuery = query(collection(firestore, 'schools', schoolData.id, 'students'));
          const studentsUnsub = onSnapshot(studentsQuery, (studentSnapshot) => {
             if (isMounted) {
               const fetchedStudents = studentSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
               setStudents(fetchedStudents);
             }
          }, (err: FirestoreError) => {
             if (isMounted) {
               errorEmitter.emit('permission-error', new FirestorePermissionError({
                 path: `schools/${schoolData.id}/students`,
                 operation: 'list',
               }));
             }
          });
          unsubscribes.push(studentsUnsub);

           const classesQuery = query(collection(firestore, 'schools', schoolData.id, 'classes'));
           const classesUnsub = onSnapshot(classesQuery, async (classesSnap) => {
               if (isMounted) {
                setClasses(classesSnap.docs.map(d => ({...d.data(), id: d.id} as Class)));
               }
           });
           unsubscribes.push(classesUnsub);

        } else {
          setSchool(null);
          setStudents([]);
        }
        setLoading(false);
      }
    }, (err: FirestoreError) => {
      if (isMounted) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'schools', operation: 'list' }));
        setLoading(false);
      }
    });
    unsubscribes.push(schoolUnsub);

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [firestore, user]);

  const enrichedStudents = useMemo(() => {
    const classMap = new Map(classes.map(c => [c.id, c.name]));
    return students.map(s => ({
      ...s,
      fullName: `${s.firstName} ${s.surname}`,
      className: s.classId ? classMap.get(s.classId) || "Unassigned" : "Unassigned",
    }));
  }, [students, classes]);
  
  const activeStudents = useMemo(() => enrichedStudents.filter(s => s.status === 'Active'), [enrichedStudents]);
  const unassignedStudents = useMemo(() => activeStudents.filter(s => !s.classId), [activeStudents]);
  const inactiveStudents = useMemo(() => enrichedStudents.filter(s => s.status !== 'Active'), [enrichedStudents]);
  
  const currentYearClasses = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    return classes.filter(c => c.academicYear === currentYear);
  }, [classes]);

  const columns = useMemo(() => getColumns(), []);

  const handleExport = () => {
    if (!school) return;
    try {
        exportStudentsAsCSV(activeStudents, school.name);
        toast({ title: 'Export Successful', description: 'The student list has been downloaded as a CSV file.'});
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Export Failed', description: e.message});
    }
  };

  if (!loading && !school) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight">No School Assigned</h2>
                <p className="text-muted-foreground">
                    You are not yet assigned as the head of any school. Please contact the super-administrator.
                </p>
            </div>
        </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Registry</h2>
          <p className="text-muted-foreground">
            A list of all {enrichedStudents.length} students registered at {school?.name || 'your school'}.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setImportStudentDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
           <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setCreateStudentDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>
      <div className="py-10">
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active Students ({activeStudents.length})</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned ({unassignedStudents.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inactive Students ({inactiveStudents.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <DataTable columns={columns} data={activeStudents} loading={loading} classes={currentYearClasses} />
          </TabsContent>
          <TabsContent value="unassigned" className="mt-4">
            <DataTable columns={columns} data={unassignedStudents} loading={loading} filterPlaceholder="Filter unassigned students..." classes={[]} />
          </TabsContent>
          <TabsContent value="inactive" className="mt-4">
             <DataTable columns={columns} data={inactiveStudents} loading={loading} filterPlaceholder="Filter inactive students..." classes={currentYearClasses} />
          </TabsContent>
        </Tabs>
      </div>
      <CreateStudentDialog
        isOpen={isCreateStudentDialogOpen}
        onOpenChange={setCreateStudentDialogOpen}
        schoolId={school?.id}
        classes={currentYearClasses}
      />
      <ImportStudentsDialog
        isOpen={isImportStudentDialogOpen}
        onOpenChange={setImportStudentDialogOpen}
        schoolId={school?.id}
      />
    </>
  );
}
