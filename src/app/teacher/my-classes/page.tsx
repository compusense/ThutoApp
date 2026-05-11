'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, FirestoreError } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Class } from '@/app/school-head/classes/page';
import { DataTable } from './components/data-table';
import { getColumns } from './components/columns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function MyClassesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) {
        setLoading(false);
        return;
    }

    setLoading(true);
    // Fetch all classes ever assigned to this teacher
    const classesQuery = query(
        collection(firestore, 'schools', user.schoolId, 'classes'),
        where('teacherId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      classesQuery,
      (snapshot) => {
        const fetchedClasses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        // Sort by year descending, then by name ascending
        fetchedClasses.sort((a, b) => {
            if (a.academicYear !== b.academicYear) {
                return b.academicYear.localeCompare(a.academicYear);
            }
            return a.name.localeCompare(b.name);
        });
        setClasses(fetchedClasses);
        setLoading(false);
      },
      (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `schools/${user.schoolId}/classes`,
          operation: 'list',
        }));
        console.error("Error fetching teacher's classes: ", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]);
  
  const columns = useMemo(() => getColumns(), []);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Classes</h2>
          <p className="text-muted-foreground">
            A list of all classes you have been assigned to, past and present.
          </p>
        </div>
      </div>
      <div className="py-10">
        <DataTable columns={columns} data={classes} loading={loading} />
      </div>
    </>
  );
}
