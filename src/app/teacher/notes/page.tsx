
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, StickyNote, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';

interface Note {
    id: string;
    title: string;
    createdAt: string;
    subjectId: string;
}

export default function MyNotesPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [notes, setNotes] = React.useState<Note[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!firestore || !user?.uid) {
            setLoading(false);
            return;
        }

        const q = query(collection(firestore, 'notes'), where('createdBy', '==', user.uid));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedNotes = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Note));
            
            fetchedNotes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setNotes(fetchedNotes);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching notes: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user?.uid]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">My Notes</h2>
                <p className="text-muted-foreground">
                    A list of all the notes you have created from syllabus topics.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : notes.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center text-muted-foreground">
                        <StickyNote className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Notes Created</h3>
                        <p className="mt-1 text-sm">
                            You can create notes from the <AppLink href="/teacher/syllabus" className="underline">Syllabus Explorer</AppLink>.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {notes.map(note => (
                        <Card key={note.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="line-clamp-2">{note.title}</CardTitle>
                                <CardDescription>Created on {format(new Date(note.createdAt), 'PPP')}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                {/* Future content snippet can go here */}
                            </CardContent>
                            <div className="p-6 pt-0">
                                <Button asChild className="w-full">
                                    <AppLink href={`/teacher/notes/${note.id}`}>
                                        View Note <ArrowRight className="ml-2 h-4 w-4" />
                                    </AppLink>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
