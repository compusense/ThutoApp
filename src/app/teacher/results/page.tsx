'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Class } from '@/app/school-head/classes/page';
import { ClassResultsView } from '@/components/shared/class-results-view';
import { useToast } from '@/hooks/use-toast';

export default function TeacherResultsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [classes, setClasses] = React.useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) {
      setLoadingClasses(false);
      return;
    }
    
    setLoadingClasses(true);
    const q = query(collection(firestore, 'schools', user.schoolId, 'classes'), where('teacherId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedClasses = snap.docs
          .map((doc) => ({ ...doc.data() as Class, id: doc.id }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClasses(fetchedClasses);
        setLoadingClasses(false);
      },
      (error) => {
        console.error("Error fetching teacher's classes:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your classes.' });
        setLoadingClasses(false);
      }
    );
    return () => unsub();
  }, [firestore, user?.schoolId, user?.uid, toast]);

  if (!user) {
    return null;
  }

  return <ClassResultsView user={user} classes={classes} loadingClasses={loadingClasses} />;
}
