
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Class } from '@/app/school-head/classes/page';
import { ClassResultsView } from '@/components/shared/class-results-view';
import { useToast } from '@/hooks/use-toast';

export default function SchoolHeadResultsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  
  useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setLoadingClasses(false);
      return;
    }

    setLoadingClasses(true);
    const q = query(collection(firestore, 'schools', user.schoolId, 'classes'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedClasses = snap.docs
          .map((doc) => ({ ...doc.data(), id: doc.id } as Class))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(fetchedClasses);
        setLoadingClasses(false);
      },
      (error) => {
        console.error('Error fetching classes:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch classes.' });
        setLoadingClasses(false);
      }
    );
    return () => unsub();
  }, [firestore, user?.schoolId, toast]);

  if (!user) {
    return null;
  }

  return <ClassResultsView user={user} classes={classes} loadingClasses={loadingClasses} />;
}
