
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Subject } from '@/app/super-admin/subjects/page';
import { Student } from '@/app/school-head/students/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Book, Users, Loader2, StickyNote, HelpCircle } from 'lucide-react';
import { AppLink } from '@/components/ui/app-link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Class } from '@/app/school-head/classes/page';
import { getStudentClassDetails, Assignment } from '../actions';
import { auth } from '@/firebase';

export default function StudentClassDetailsPage() {
    const { user, loading: userLoading } = useUser();
    const { classId } = useParams() as { classId: string };
    const { toast } = useToast();

    const [subjects, setSubjects] = React.useState<Subject[]>([]);
    const [classmates, setClassmates] = React.useState<Student[]>([]);
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [loadingData, setLoadingData] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    
    const classData: Class | null = React.useMemo(() => {
        if (user && user.classId === classId) {
            return {
                id: user.classId,
                name: user.className || 'My Class',
                gradeLevel: '',
                stream: '',
                schoolId: user.schoolId || '',
            };
        }
        return null;
    }, [user, classId]);

    React.useEffect(() => {
        if (userLoading) {
            return; 
        }

        if (!classData) {
            setLoadingData(false);
            setError("You are not enrolled in this class.");
            return;
        }

        let isMounted = true;
        setLoadingData(true);
        console.log("[PAGE LOG] Fetching class details...");


        const fetchData = async () => {
            try {
                const idToken = await auth.currentUser?.getIdToken();
                if (!idToken) {
                    throw new Error("Authentication token not available.");
                }

                const result = await getStudentClassDetails({ classId: classData.id }, idToken);
                console.log("[PAGE LOG] Result from getStudentClassDetails:", result);


                if (!isMounted) return;

                if (result.success && result.data) {
                    setSubjects(result.data.subjects);
                    setClassmates(result.data.classmates);
                    setAssignments(result.data.assignments);
                    setError(null);
                } else {
                    throw new Error(result.message);
                }

            } catch (err: any) {
                 if (isMounted) {
                    console.error("Failed to get class details:", err);
                    setError(err.message || "Could not load class details.");
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: err.message || "An unexpected error occurred.",
                    });
                }
            } finally {
                if (isMounted) {
                    setLoadingData(false);
                }
            }
        };
        
        fetchData();

        return () => { isMounted = false; }
        
    }, [userLoading, classId, toast, classData]);


    const isLoading = userLoading || loadingData;

    if (isLoading) {
        return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                 <p className="text-red-500">{error}</p>
                 <Button asChild variant="link">
                    <AppLink href="/student/my-classes">Return to My Classes</AppLink>
                 </Button>
            </div>
        );
    }
    
    if (!classData) {
        return <div className="p-8 text-center">Class not found or you are not enrolled in it.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <Button asChild variant="ghost" className="-ml-4">
                    <AppLink href="/student/my-classes">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to My Classes
                    </AppLink>
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">{classData.name}</h2>
                <p className="text-muted-foreground">Assignments, subjects and classmates for this class.</p>
            </div>
            
            <Card>
                <Tabs defaultValue="assignments" className="w-full">
                    <CardHeader>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="assignments"><StickyNote className="mr-2 h-4 w-4" /> Assignments</TabsTrigger>
                            <TabsTrigger value="subjects"><Book className="mr-2 h-4 w-4" /> Subjects</TabsTrigger>
                            <TabsTrigger value="classmates"><Users className="mr-2 h-4 w-4" /> Classmates</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                     <TabsContent value="assignments">
                        <CardContent>
                            {assignments.length > 0 ? (
                                <ul className="divide-y divide-border">
                                    {assignments.map(assignment => (
                                        <li key={assignment.id} className="py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {assignment.type === 'quiz' ? <HelpCircle className="h-6 w-6 text-blue-500"/> : <StickyNote className="h-6 w-6 text-yellow-500"/>}
                                                <div>
                                                    <p className="font-medium">{assignment.title}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {assignment.type === 'quiz' ? 'Quiz Assignment' : 'Lesson Note'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="sm">
                                                <AppLink href={assignment.type === 'quiz' && assignment.quizId ? `/student/notes/${assignment.noteId}/quizzes/${assignment.quizId}` : `/student/notes/${assignment.noteId}`}>
                                                    Open
                                                </AppLink>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="py-10 text-center text-muted-foreground">No assignments for this class yet.</p>
                            )}
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="subjects">
                        <CardContent>
                            {subjects.length > 0 ? (
                                <ul className="divide-y divide-border">
                                    {subjects.map(subject => (
                                        <li key={subject.id} className="py-3">
                                            <p className="font-medium">{subject.name}</p>
                                            {subject.subjectCode && <p className="text-sm text-muted-foreground">{subject.subjectCode}</p>}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="py-10 text-center text-muted-foreground">No subjects have been allocated to this class for the current year.</p>
                            )}
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="classmates">
                        <CardContent>
                            {classmates.length > 0 ? (
                                <ScrollArea className="h-96">
                                    <ul className="divide-y divide-border">
                                        {classmates.map(student => (
                                            <li key={student.id} className="flex items-center space-x-3 py-3">
                                                <p className="font-medium">{student.fullName}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            ) : (
                                <p className="py-10 text-center text-muted-foreground">You seem to be the only one here!</p>
                            )}
                        </CardContent>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
