
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, FirestoreError, query, where, getDocs, doc } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { getColumns } from './components/columns';
import { DataTable } from './components/data-table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { School } from '@/app/super-admin/schools/page';
import { CreateClassDialog } from './components/create-class-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Class {
  id: string;
  name: string;
  gradeLevel: string;
  stream: string;
  schoolId: string;
  academicYear: string;
  teacherId?: string;
  schoolType?: string;
  promotedFrom?: {
    fromClassId: string;
    fromYear: string;
  }
}

export default function ClassManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateClassDialogOpen, setCreateClassDialogOpen] = useState(false);
  
  const academicYears = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    if (!firestore || !user?.schoolId) {
        setLoading(false);
        return;
    }

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];
    setLoading(true);

    const schoolRef = doc(firestore, 'schools', user.schoolId);
    unsubscribes.push(onSnapshot(schoolRef, (snap) => {
        if(isMounted) setSchool(snap.exists() ? { id: snap.id, ...snap.data() } as School : null);
    }));

    // Fetch all classes for the school.
    const classesQuery = query(collection(firestore, 'schools', user.schoolId, 'classes'));
    unsubscribes.push(onSnapshot(classesQuery, (snapshot) => {
        if (!isMounted) return;
        const fetchedClasses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setAllClasses(fetchedClasses);
        setLoading(false);
    }, (err: FirestoreError) => {
        if (isMounted) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${user.schoolId}/classes`, operation: 'list' }));
            setLoading(false);
        }
    }));

    const staffRoles = ['teacher', 'school-head', 'deputy-school-head', 'HOD', 'Senior Teacher 1', 'Senior Teacher 2'];
    const teachersQuery = query(collection(firestore, 'users'), where('schoolId', '==', user.schoolId), where('role', 'in', staffRoles));
    unsubscribes.push(onSnapshot(teachersQuery, (snapshot) => {
        if (isMounted) setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }));


    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [firestore, user?.schoolId]);
  
  const filteredClasses = useMemo(() => {
    return allClasses.filter(c => c.academicYear === selectedYear).sort((a,b) => a.name.localeCompare(b.name));
  }, [allClasses, selectedYear]);

  const columns = useMemo(() => getColumns(teachers), [teachers]);
  
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
          <h2 className="text-2xl font-bold tracking-tight">Class Management</h2>
          <p className="text-muted-foreground">
            Manage classes at {school?.name || 'your school'}.
          </p>
        </div>
        <div className="flex items-center space-x-2">
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
          <Button onClick={() => setCreateClassDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Class
          </Button>
        </div>
      </div>
      <div className="py-10">
        <DataTable columns={columns} data={filteredClasses} loading={loading} />
      </div>
      <CreateClassDialog
        isOpen={isCreateClassDialogOpen}
        onOpenChange={setCreateClassDialogOpen}
        school={school}
        academicYear={selectedYear}
      />
    </>
  );
}
