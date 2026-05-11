
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, FirestoreError, query } from 'firebase/firestore';
import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { UserProfile } from '@/firebase/auth/use-user';
import { getColumns } from './components/columns';
import { DataTable } from './components/data-table';
import { CreateUserDialog } from './components/create-user-dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { School } from '../schools/page';
import { SubRegion } from '../sub-regions/page';
import { Region } from '../regions/page';
import { getUsersWithAuthData } from './actions';

export default function UserManagementPage() {
  const [isCreateUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const firestore = useFirestore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
  
    let isMounted = true;
  
    const fetchAllData = async () => {
      try {
        // Use a server action to get combined Firestore and Auth data
        const enrichedUsersData = await getUsersWithAuthData();
        if (isMounted) {
          setUsers(enrichedUsersData);
        }
  
        // Fetch other collections
        const collections = [
          { path: 'schools', setter: setSchools },
          { path: 'regions', setter: setRegions },
          { path: 'subRegions', setter: setSubRegions },
        ];
  
        const unsubs = collections.map(({ path, setter }) => {
          const q = query(collection(firestore, path));
          return onSnapshot(q, (snapshot) => {
            if (isMounted) {
              const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id }));
              setter(data);
            }
          }, (err: FirestoreError) => {
            if (isMounted) {
              console.error(`Firestore subscription error (${path}):`, err);
              errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'list' }));
            }
          });
        });
        
        // This is a bit of a hack to wait for initial data, might need refinement
        await Promise.all(collections.map(({ path }) => new Promise(resolve => onSnapshot(collection(firestore, path), () => resolve(true), () => resolve(false)))));

        if (isMounted) {
            setLoading(false);
        }
        
        return () => {
          isMounted = false;
          unsubs.forEach(unsub => unsub());
        };

      } catch (error) {
        if (isMounted) {
          console.error("Error fetching initial user data:", error);
          setLoading(false);
        }
      }
    };
  
    fetchAllData();
  
  }, [firestore]);
  
  const enrichedUsers = useMemo(() => {
    const schoolMap = new Map(schools.map(s => [s.id, s.name]));
    const subRegionMap = new Map(subRegions.map(sr => [sr.id, sr.name]));
    return users.map(user => ({
        ...user,
        schoolName: user.schoolId ? schoolMap.get(user.schoolId) || 'Unknown School' : 'N/A',
        subRegionName: user.subRegionId ? subRegionMap.get(user.subRegionId) || 'Unknown Sub-Region' : 'N/A',
    }));
  }, [users, schools, subRegions]);

  const columns = useMemo(() => getColumns(schools, regions, subRegions), [schools, regions, subRegions]);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Management</h2>
          <p className="text-muted-foreground">
            Here you can manage all staff in the system.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setCreateUserDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>
      <div className="py-10">
        <DataTable columns={columns} data={enrichedUsers} loading={loading} />
      </div>
      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onOpenChange={setCreateUserDialogOpen}
        schools={schools}
        regions={regions}
        subRegions={subRegions}
      />
    </>
  );
}
