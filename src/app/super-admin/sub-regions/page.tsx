
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Region } from '@/app/super-admin/regions/page';
import { CreateSubRegionDialog } from './components/create-sub-region-dialog';
import { DataTable } from './components/data-table';
import { columns } from './components/columns';


export interface SubRegion {
  id: string;
  name: string;
  regionId: string;
  regionName?: string;
}

export default function SubRegionsPage() {
  const [isCreateSubRegionDialogOpen, setCreateSubRegionDialogOpen] = useState(false);
  const firestore = useFirestore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegion[]>([]);
  const [loading, setLoading] = useState(true);

  // Combined effect to fetch all data and manage loading states
  useEffect(() => {
    if (!firestore) return;

    let isMounted = true;
    console.log('[SubRegionsPage] Setting up Firestore listeners...');

    const regionsUnsubscribe = onSnapshot(collection(firestore, 'regions'), 
      (snapshot) => {
        if (isMounted) {
          const fetchedRegions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Region));
          setRegions(fetchedRegions);
        }
      },
      (err: FirestoreError) => {
        if (isMounted) {
          console.error("Firestore subscription error (regions):", err);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'regions', operation: 'list' }));
        }
      }
    );

    const subRegionsUnsubscribe = onSnapshot(collection(firestore, 'subRegions'), 
      (snapshot) => {
        if (isMounted) {
          const fetchedSubRegions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubRegion));
          setSubRegions(fetchedSubRegions);
        }
      },
      (err: FirestoreError) => {
        if (isMounted) {
          console.error("Firestore subscription error (sub-regions):", err);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'subRegions', operation: 'list' }));
        }
      }
    );

    // This is a simple way to set loading to false once both listeners have fired at least once.
    Promise.all([
      new Promise(resolve => onSnapshot(collection(firestore, 'regions'), () => resolve(true), () => resolve(false))),
      new Promise(resolve => onSnapshot(collection(firestore, 'subRegions'), () => resolve(true), () => resolve(false)))
    ]).then(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      console.log('[DEBUG] Unsubscribing from Firestore listener (SubRegions)...');
      regionsUnsubscribe();
      subRegionsUnsubscribe();
    };
  }, [firestore]);

  const enrichedSubRegions = useMemo(() => {
    const regionMap = new Map(regions.map(r => [r.id, r.name]));
    return subRegions.map(sr => ({
      ...sr,
      regionName: regionMap.get(sr.regionId) || 'Unknown Region'
    }));
  }, [regions, subRegions]);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sub-Regions</h2>
          <p className="text-muted-foreground">
            Manage sub-regions within a region.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setCreateSubRegionDialogOpen(true)} disabled={regions.length === 0}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Sub-Region
          </Button>
        </div>
      </div>
      {regions.length === 0 && !loading && (
        <div className="py-10 text-center text-muted-foreground">
            You must create a region before you can add a sub-region.
        </div>
      )}
      <div className="py-10">
        <DataTable columns={columns} data={enrichedSubRegions} loading={loading} />
      </div>
      <CreateSubRegionDialog
        isOpen={isCreateSubRegionDialogOpen}
        onOpenChange={setCreateSubRegionDialogOpen}
        regions={regions}
      />
    </>
  );
}
