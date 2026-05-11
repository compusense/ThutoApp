
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { SubRegion } from '@/app/super-admin/sub-regions/page';

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 items-start">
      <p className="md:col-span-1 text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="md:col-span-2 text-base">{value}</p>
    </div>
  );
}

export default function SubRegionAdminDetailsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [subRegion, setSubRegion] = useState<SubRegion | null>(null);
  const [subRegionLoading, setSubRegionLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.subRegionId) {
      setSubRegionLoading(false);
      return;
    }

    const subRegionRef = doc(firestore, 'subRegions', user.subRegionId);
    const unsubscribe = onSnapshot(subRegionRef, (docSnap) => {
      if (docSnap.exists()) {
        setSubRegion({ id: docSnap.id, ...docSnap.data() } as SubRegion);
      } else {
        setSubRegion(null);
      }
      setSubRegionLoading(false);
    }, (err: FirestoreError) => {
      console.error("Error fetching sub-region:", err);
      setSubRegionLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const loading = userLoading || subRegionLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between space-y-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">My Details</h2>
              <p className="text-muted-foreground">Your personal and professional information.</p>
            </div>
        </div>
        <Card>
          <CardHeader className="flex flex-col items-center text-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user) {
    return <div>User not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Details</h2>
          <p className="text-muted-foreground">
            Your personal and professional information as recorded in the system.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-col items-center text-center space-y-4">
          <Avatar className="h-24 w-24 text-3xl">
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ''} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">{user.displayName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 border-t pt-6">
            <DetailItem label="Full Name" value={user.displayName} />
            <DetailItem label="Email Address" value={user.email} />
            <DetailItem label="National ID" value={user.idNumber} />
            <DetailItem label="Role" value={user.role?.replace('-', ' ')} />
            <DetailItem label="Assigned Sub-Region" value={subRegion?.name} />
        </CardContent>
      </Card>
    </div>
  );
}
