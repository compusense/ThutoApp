
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser } from '@/firebase/auth/use-user';
import { auth } from '@/firebase';
import { BookCopy, Loader2, UserCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Subject } from '@/app/super-admin/subjects/page';
import { getStudentClassDetails } from '../my-classes/actions';
import { useToast } from '@/hooks/use-toast';

export default function StudentDashboard() {
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();

  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchClassData = async () => {
      if (!user?.classId) {
        setSubjects([]);
        setLoadingSubjects(false);
        return;
      }
    
      setLoadingSubjects(true);
      const storageKey = `thuto-subjects-${user.classId}`;
      const cachedData = sessionStorage.getItem(storageKey);

      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          setSubjects(parsedData);
          setLoadingSubjects(false);
          return;
        } catch (e) {
          console.warn('Failed to parse cached subject data.');
          sessionStorage.removeItem(storageKey);
        }
      }
    
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication required.");

        const result = await getStudentClassDetails({ classId: user.classId! }, idToken);
        
        if (result.success && result.data) {
          setSubjects(result.data.subjects || []);
          sessionStorage.setItem(storageKey, JSON.stringify(result.data.subjects || []));
          setError(null);
        } else {
          throw new Error(result.message);
        }

      } catch (err: any) {
          console.error("Failed to get class details for dashboard:", err);
          setError("Could not load subject information.");
          toast({
            variant: 'destructive',
            title: 'Error',
            description: err.message || 'An unexpected error occurred.',
          });
      } finally {
          setLoadingSubjects(false);
      }
    };
    
    if (!userLoading && user) {
        fetchClassData();
    } else if (!userLoading) {
        setLoadingSubjects(false);
    }

  }, [user, userLoading, toast]);
  
  const isLoading = userLoading || loadingSubjects;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        Welcome, {user?.displayName || 'Student'}!
      </h1>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
             <UserCircle className="h-8 w-8 text-muted-foreground" />
             <div>
                <CardTitle>Profile Summary</CardTitle>
                <CardDescription>Your current enrollment details.</CardDescription>
             </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
             {userLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-4 w-2/5" />
                </div>
             ) : (
                <>
                    <p><span className="font-semibold">Name:</span> {user?.displayName}</p>
                    <p><span className="font-semibold">Email:</span> {user?.email}</p>
                    <p><span className="font-semibold">Class:</span> {user?.className || 'Not Assigned'}</p>
                </>
             )}
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center gap-4">
                <BookCopy className="h-8 w-8 text-muted-foreground" />
                <div>
                    <CardTitle>My Subjects</CardTitle>
                    <CardDescription>Subjects for the {new Date().getFullYear()} academic year.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {loadingSubjects ? (
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                ) : error ? (
                    <p className="text-destructive text-sm">{error}</p>
                ) : subjects.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                        {subjects.map(subject => (
                            <li key={subject.id}>{subject.name}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">No subjects have been allocated to your class for this year yet.</p>
                )}
            </CardContent>
        </Card>
       </div>
    </div>
  );
}
