
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, HelpCircle, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownViewer } from '@/components/markdown-viewer';
import { AppLink } from '@/components/ui/app-link';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { logMaterialAccess } from '@/app/teacher/notes/actions';
import { useToast } from '@/hooks/use-toast';

interface Note {
    id: string;
    title: string;
    content: string;
    createdBy: string;
    classId: string;
}

interface QuizStub {
    id: string;
    title: string;
    createdAt: string;
}

export default function StudentNotePage() {
    const params = useParams();
    const { noteId } = params;
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [note, setNote] = React.useState<Note | null>(null);
    const [quizzes, setQuizzes] = React.useState<QuizStub[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const hasLoggedAccess = React.useRef(false);

    React.useEffect(() => {
        if (!firestore || !noteId || !user?.schoolId || !user?.classId) {
            setLoading(false);
            if(user) setError("You are not currently assigned to a class.");
            return;
        }

        const noteRef = doc(firestore, 'notes', noteId as string);
        const unsubNote = onSnapshot(noteRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Note;
                
                // Security Check: Is this note for the student's class?
                if (data.classId === user.classId) {
                    setNote(data);
                    setError(null);
                    
                    // Log access only once per component mount
                    if (!hasLoggedAccess.current) {
                        auth.currentUser?.getIdToken().then(idToken => {
                            logMaterialAccess({ materialId: data.id, materialType: 'note' }, idToken)
                                .catch(e => console.error("Failed to log note access:", e));
                        });
                        hasLoggedAccess.current = true;
                    }
                } else {
                    setError("You do not have permission to view this note.");
                }
            } else {
                setError("Note not found.");
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching note:", err);
            setError("Failed to load note due to a permission or network error.");
            setLoading(false);
        });

        const quizzesQuery = query(collection(noteRef, 'quizzes'), orderBy('createdAt', 'desc'));
        const unsubQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
            const fetchedQuizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizStub));
            setQuizzes(fetchedQuizzes);
        });


        return () => {
            unsubNote();
            unsubQuizzes();
        };
    }, [firestore, noteId, user]);


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (error) {
        return <p className="text-center text-destructive">{error}</p>;
    }

    if (!note) {
        return <p className="text-center">Note not found.</p>;
    }
    
    const canView = user?.role === 'student' && user?.classId === note.classId;

    if (!canView) {
        return <p className="text-center text-destructive">You do not have permission to view this note.</p>;
    }


    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">{note.title}</h2>
                <p className="text-muted-foreground">Read through the note below.</p>
            </div>
            
            {quizzes.length > 0 && (
                 <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle>Available Quiz</CardTitle>
                        <CardDescription>A quiz is available for this lesson note. Click the button to start.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <AppLink href={`/student/notes/${note.id}/quizzes/${quizzes[0].id}`}>
                                <HelpCircle className="mr-2 h-4 w-4" />
                                Start Quiz: {quizzes[0].title}
                            </AppLink>
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-6">
                    <MarkdownViewer content={note.content} />
                </CardContent>
            </Card>
        </div>
    );
}
