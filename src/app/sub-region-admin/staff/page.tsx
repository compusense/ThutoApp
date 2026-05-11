
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, FirestoreError, query, where, getDocs } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { School } from '@/app/super-admin/schools/page';
import { DataTable } from './components/data-table';
import { getColumns } from './components/columns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface StaffMember extends UserProfile {
    schoolName?: string;
}

export default function SubRegionStaffPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !user?.subRegionId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];
    setLoading(true);

    const schoolsQuery = query(collection(firestore, 'schools'), where('subRegionId', '==', user.subRegionId));
    
    unsubscribes.push(onSnapshot(schoolsQuery, (schoolsSnapshot) => {
        if (!isMounted) return;
        const fetchedSchools = schoolsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as School));
        setSchools(fetchedSchools);
        
        if (fetchedSchools.length === 0) {
            setStaff([]);
            setLoading(false);
            return;
        }

        const schoolIds = fetchedSchools.map(s => s.id);
        const staffRoles = ['teacher', 'school-head', 'deputy-school-head', 'HOD', 'Senior Teacher 1', 'Senior Teacher 2'];
        
        const usersQuery = query(
            collection(firestore, 'users'), 
            where('schoolId', 'in', schoolIds),
            where('role', 'in', staffRoles)
        );

        unsubscribes.push(onSnapshot(usersQuery, (usersSnapshot) => {
            if (!isMounted) return;
            const schoolMap = new Map(fetchedSchools.map(s => [s.id, s.name]));
            const fetchedStaff = usersSnapshot.docs.map(doc => {
                const userData = doc.data() as UserProfile;
                return {
                    ...userData,
                    uid: doc.id,
                    schoolName: userData.schoolId ? schoolMap.get(userData.schoolId) || 'Unknown School' : 'N/A'
                }
            });
            setStaff(fetchedStaff);
            setError(null);
            setLoading(false);
        }, (err) => {
            if (isMounted) {
                console.error("Error fetching staff data:", err);
                setError("Could not load staff data for your sub-region.");
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
                setLoading(false);
            }
        }));

    }, (err) => {
        if (isMounted) {
            console.error("Error fetching schools in sub-region:", err);
            setError("Could not load schools in your sub-region.");
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'schools', operation: 'list' }));
            setLoading(false);
        }
    }));


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
          <h2 className="text-2xl font-bold tracking-tight">Sub-Region Staff</h2>
          <p className="text-muted-foreground">
            A list of all staff members in the schools within your sub-region.
          </p>
        </div>
      </div>
      {error && (
         <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="py-10">
        <DataTable columns={columns} data={staff} loading={loading} schools={schools}/>
      </div>
    </>
  );
}
