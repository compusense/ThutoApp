
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Region } from '@/app/super-admin/regions/page';
import { SubRegion } from '@/app/super-admin/sub-regions/page';
import { UserProfile } from '@/firebase/auth/use-user';
import { CreateSchoolDialog } from './components/create-school-dialog';
import { DataTable } from './components/data-table';
import { getColumns } from './components/columns';


export interface School {
  id: string;
  name: string;
  regionId: string;
  subRegionId?: string;
  schoolHeadId?: string;
  regNo: string;
  group?: string;
  category?: string;
  schoolType?: string;
  regionName?: string;
  subRegionName?: string;
}

export default function SchoolsPage() {
  const [isCreateSchoolDialogOpen, setCreateSchoolDialogOpen] = useState(false);
  const firestore = useFirestore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Effect for fetching all data
  useEffect(() => {
    if (!firestore) return;

    let isMounted = true;
    console.log('[SchoolsPage] Setting up Firestore listeners...');

    const unsubscribes: (() => void)[] = [];

    unsubscribes.push(onSnapshot(collection(firestore, 'regions'), (snapshot) => {
      if (isMounted) setRegions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Region)));
    }, (err: FirestoreError) => {
      if (isMounted) {
        console.error("Firestore subscription error (regions):", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'regions', operation: 'list' }));
      }
    }));

    unsubscribes.push(onSnapshot(collection(firestore, 'subRegions'), (snapshot) => {
      if (isMounted) setSubRegions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubRegion)));
    }, (err: FirestoreError) => {
      if (isMounted) {
        console.error("Firestore subscription error (sub-regions):", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'subRegions', operation: 'list' }));
      }
    }));

    unsubscribes.push(onSnapshot(collection(firestore, 'schools'), (snapshot) => {
      if (isMounted) setSchools(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as School)));
    }, (err: FirestoreError) => {
      if (isMounted) {
        console.error("Firestore subscription error (schools):", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'schools', operation: 'list' }));
      }
    }));

     unsubscribes.push(onSnapshot(collection(firestore, 'users'), (snapshot) => {
      if (isMounted) setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }, (err: FirestoreError) => {
      if (isMounted) {
        console.error("Firestore subscription error (users):", err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
      }
    }));
    
    // Set loading to false once all initial data has been fetched
    Promise.all([
      new Promise(resolve => onSnapshot(collection(firestore, 'regions'), () => resolve(true), () => resolve(false))),
      new Promise(resolve => onSnapshot(collection(firestore, 'subRegions'), () => resolve(true), () => resolve(false))),
      new Promise(resolve => onSnapshot(collection(firestore, 'schools'), () => resolve(true), () => resolve(false))),
      new Promise(resolve => onSnapshot(collection(firestore, 'users'), () => resolve(true), () => resolve(false))),
    ]).then(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      console.log('[DEBUG] Unsubscribing from Firestore listeners (Schools)...');
      unsubscribes.forEach(unsub => unsub());
    };
  }, [firestore]);

  const enrichedSchools = useMemo(() => {
    const regionMap = new Map(regions.map(r => [r.id, r.name]));
    const subRegionMap = new Map(subRegions.map(sr => [sr.id, sr.name]));
    return schools.map(school => ({
      ...school,
      regionName: regionMap.get(school.regionId) || 'Unknown Region',
      subRegionName: school.subRegionId ? subRegionMap.get(school.subRegionId) || 'Unknown Sub-Region' : undefined,
    }));
  }, [schools, regions, subRegions]);

  const columns = useMemo(() => getColumns(users), [users]);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schools</h2>
          <p className="text-muted-foreground">
            Manage schools within regions and sub-regions.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setCreateSchoolDialogOpen(true)} disabled={regions.length === 0}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add School
          </Button>
        </div>
      </div>
      {regions.length === 0 && !loading && (
        <div className="py-10 text-center text-muted-foreground">
            You must create a region before you can add a school.
        </div>
      )}
      <div className="py-10">
        <DataTable columns={columns} data={enrichedSchools} loading={loading} />
      </div>
      <CreateSchoolDialog
        isOpen={isCreateSchoolDialogOpen}
        onOpenChange={setCreateSchoolDialogOpen}
        regions={regions}
        subRegions={subRegions}
      />
    </>
  );
}
