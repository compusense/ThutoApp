
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, FirestoreError, query, where, doc } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { getColumns } from './components/columns';
import { DataTable } from './components/data-table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { School } from '@/app/super-admin/schools/page';

export default function TeacherManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    // 1. Get the school document using the schoolId from the user's profile.
    const schoolRef = doc(firestore, 'schools', user.schoolId);
    const schoolUnsub = onSnapshot(schoolRef, (schoolSnap) => {
      if (isMounted) {
        if (schoolSnap.exists()) {
          const schoolData = { ...schoolSnap.data(), id: schoolSnap.id } as School;
          setSchool(schoolData);

          // 2. Once we have the school, query for the staff in that school.
          // This now correctly filters to only include staff roles.
          const staffRoles = ['teacher', 'school-head', 'deputy-school-head', 'HOD', 'Senior Teacher 1', 'Senior Teacher 2'];
          const teachersQuery = query(
            collection(firestore, 'users'), 
            where('schoolId', '==', schoolData.id),
            where('role', 'in', staffRoles)
          );
          const teachersUnsub = onSnapshot(teachersQuery, (teacherSnapshot) => {
            if (isMounted) {
              const fetchedTeachers = teacherSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
              setTeachers(fetchedTeachers);
            }
          }, (err: FirestoreError) => {
            if (isMounted) {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users (where schoolId == ${schoolData.id})`,
                operation: 'list',
              }));
            }
          });
          unsubscribes.push(teachersUnsub);

        } else {
          // No school found for this head
          setSchool(null);
          setTeachers([]);
        }
        setLoading(false);
      }
    }, (err: FirestoreError) => {
      if (isMounted) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${user.schoolId}`, operation: 'get' }));
        setLoading(false);
      }
    });
    unsubscribes.push(schoolUnsub);

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [firestore, user]);
  
  const columns = useMemo(() => getColumns(), []);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">School Staff</h2>
          <p className="text-muted-foreground">
            A list of all teachers and other staff assigned to {school?.name || 'your school'}.
          </p>
        </div>
      </div>
      <div className="py-10">
        <DataTable columns={columns} data={teachers} loading={loading} />
      </div>
    </>
  );
}
