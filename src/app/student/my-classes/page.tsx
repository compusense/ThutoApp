
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Class } from '@/app/school-head/classes/page';

export default function MyClassesPage() {
    const { user, loading } = useUser();

    // Correctly derive classData from the user object itself.
    // The useUser hook merges the firestore document data (which contains classId/className)
    // with the auth data.
    const classData: Class | null = (user && user.classId && user.className)
      ? {
          id: user.classId,
          name: user.className,
          gradeLevel: '', // This info isn't on the user object, but that's ok for display
          stream: '',
          schoolId: user.schoolId || '',
        }
      : null;


    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">My Class</h2>
                <p className="text-muted-foreground">The class you are currently enrolled in.</p>
            </div>
            {loading ? (
                <Card><CardContent className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                </CardContent></Card>
            ) : !classData ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <BookOpen className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">Not Enrolled in Any Class</h3>
                        <p className="mt-1 text-sm">Please contact your school administrator to be added to a class.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border">
                            <li key={classData.id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="font-medium">{classData.name}</p>
                                    {classData.gradeLevel && <p className="text-sm text-muted-foreground">{classData.gradeLevel}</p>}
                                </div>
                                <Button asChild variant="outline" size="sm">
                                    <AppLink href={`/student/my-classes/${classData.id}`}>
                                        View Details
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </AppLink>
                                </Button>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
