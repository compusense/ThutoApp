
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { SubRegion } from '@/app/super-admin/sub-regions/page';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function SubRegionAdminDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [subRegion, setSubRegion] = React.useState<SubRegion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!firestore || !user) {
      setLoading(false);
      return;
    }

    if (!user.subRegionId) {
      setError("Your account is not assigned to any sub-region.");
      setLoading(false);
      return;
    }

    const subRegionRef = doc(firestore, 'subRegions', user.subRegionId);
    const unsubscribe = onSnapshot(subRegionRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          setSubRegion({ id: docSnap.id, ...docSnap.data() } as SubRegion);
          setError(null);
        } else {
          setSubRegion(null);
          setError("The sub-region assigned to your account could not be found.");
        }
        setLoading(false);
      },
      (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `subRegions/${user.subRegionId}`,
            operation: 'get',
        }));
        setError("An error occurred while fetching your data. This may be due to a network connectivity issue.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]);

  if (loading) {
     return (
      <div>
        <h1 className="text-3xl font-bold mb-6">
          <Skeleton className="h-8 w-1/2" />
        </h1>
         <Card>
          <CardHeader>
            <CardTitle><Skeleton className="h-6 w-1/4" /></CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/> Error</CardTitle>
                <CardDescription>
                    There was a problem loading your dashboard.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                    Please contact a super-administrator if this issue persists.
                </p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        {subRegion?.name || 'Sub-Region'} Admin
      </h1>
       <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the dashboard for the Sub-Region Administrator.</p>
        </CardContent>
      </Card>
    </div>
  );
}
