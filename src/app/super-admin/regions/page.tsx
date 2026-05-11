
'use client';

import { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateRegionDialog } from './components/create-region-dialog';
import { collection, onSnapshot, Unsubscribe, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface Region {
  id: string;
  name: string;
}

export default function RegionsPage() {
  const [isCreateRegionDialogOpen, setCreateRegionDialogOpen] = useState(false);
  const firestore = useFirestore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    let isMounted = true;
    console.log('[RegionsPage] Setting up Firestore listener...');

    const regionsCollection = collection(firestore, 'regions');
    const unsubscribe = onSnapshot(
      regionsCollection,
      (snapshot) => {
        if (isMounted) {
          const fetchedRegions: Region[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Region));
          setRegions(fetchedRegions);
          setLoading(false);
        }
      },
      (err: FirestoreError) => {
        if (isMounted) {
            console.error("Firestore subscription error:", err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'regions',
                operation: 'list',
            }));
            setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      console.log('[DEBUG] Unsubscribing from Firestore listener (Regions)...');
      unsubscribe();
    };
  }, [firestore]);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Regions</h2>
          <p className="text-muted-foreground">
            Manage geographical regions.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setCreateRegionDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Region
          </Button>
        </div>
      </div>
      <div className="py-10">
        <DataTable columns={columns} data={regions} loading={loading} />
      </div>
      <CreateRegionDialog
        isOpen={isCreateRegionDialogOpen}
        onOpenChange={setCreateRegionDialogOpen}
      />
    </>
  );
}
