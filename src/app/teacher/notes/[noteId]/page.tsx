'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth, useStorage } from '@/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Edit, Save, Trash2, Wand2, HelpCircle, ListChecks, Users, Printer, UploadCloud, Copy, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateNote, deleteNote, generateAINote, generateAndSaveQuiz, getAssignmentsForClass, deleteAssignment, assignNoteToClass, assignQuizToClass, getNoteAccessLogs } from '../actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MarkdownViewer } from '@/components/markdown-viewer';
import { AppLink } from '@/components/ui/app-link';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';


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

interface PublishedAssignment {
    id: string;
    title: string;
    type: 'note' | 'quiz';
    noteId: string;
    quizId?: string;
    assignedAt: string;
}

interface AccessLog {
    studentName: string;
    accessedAt: string;
}


function AssignDialog({ note, quizzes }: { note: Note, quizzes: QuizStub[] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);
    const [isAssigning, setIsAssigning] = React.useState<Record<string, boolean>>({});
    const [publishedAssignments, setPublishedAssignments] = React.useState<PublishedAssignment[]>([]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    React.useEffect(() => {
        if (!isDialogOpen || !note) return;

        const fetchAssignments = async () => {
            try {
                const idToken = await auth.currentUser?.getIdToken();
                if (!idToken) throw new Error("Authentication required.");

                const result = await getAssignmentsForClass(note.classId, idToken);
                if (result.success && result.data) {
                    setPublishedAssignments(result.data as PublishedAssignment[]);
                } else {
                    throw new Error(result.message);
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Could not fetch assignments: ${e.message}` });
            }
        };

        fetchAssignments();
    }, [isDialogOpen, note, toast]);

    const handleAction = async (action: 'assignNote' | 'assignQuiz' | 'unassign', payload: { noteId: string, quizId?: string, classId: string, assignmentId?: string}) => {
        const actionKey = payload.assignmentId || payload.quizId || 'note';
        setIsAssigning(prev => ({...prev, [actionKey]: true }));
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            let result;
            if (action === 'assignNote') {
                result = await assignNoteToClass(payload, idToken);
            } else if (action === 'assignQuiz') {
                result = await assignQuizToClass(payload, idToken);
            } else if (action === 'unassign') {
                result = await deleteAssignment(payload.assignmentId!, idToken);
            }

            if (result?.success) {
                toast({ title: 'Success', description: result.message });
                // Re-fetch assignments
                const fetchResult = await getAssignmentsForClass(note.classId, idToken);
                if(fetchResult.success && fetchResult.data) {
                    setPublishedAssignments(fetchResult.data as PublishedAssignment[]);
                }
            } else {
                throw new Error(result?.message);
            }
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message});
        } finally {
            setIsAssigning(prev => ({...prev, [actionKey]: false }));
        }
    };
    
    const handleGenerateQuiz = async () => {
        if (!note) return;
        setIsGeneratingQuiz(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");
            const result = await generateAndSaveQuiz({
                noteId: note.id,
                title: note.title,
                content: note.content
            }, idToken);
            if (result.success && result.quizId) {
                toast({ title: 'Quiz Generated', description: 'Your new quiz is now available.' });
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Quiz Generation Failed', description: e.message });
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const isNoteAssigned = publishedAssignments.some(pa => pa.type === 'note' && pa.noteId === note.id);
    const getQuizAssignmentId = (quizId: string) => publishedAssignments.find(pa => pa.quizId === quizId)?.id;

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <ListChecks className="mr-2 h-4 w-4" />
                    Assign / Manage
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign Materials</DialogTitle>
                    <DialogDescription>
                        Manage what materials from this note are visible to students in your class.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="flex items-center justify-between p-4 border rounded-md">
                        <div>
                            <p className="font-semibold">Lesson Note: "{note.title}"</p>
                            <p className="text-sm text-muted-foreground">{isNoteAssigned ? "Currently assigned to students" : "Not yet assigned"}</p>
                        </div>
                        {isNoteAssigned ? (
                           <Button variant="destructive" size="sm" onClick={() => handleAction('unassign', { noteId: note.id, classId: note.classId, assignmentId: publishedAssignments.find(pa => pa.type === 'note')?.id })} disabled={isAssigning[publishedAssignments.find(pa => pa.type === 'note')?.id!]}>
                                {isAssigning[publishedAssignments.find(pa => pa.type === 'note')?.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Take Down
                            </Button>
                        ) : (
                             <Button size="sm" onClick={() => handleAction('assignNote', { noteId: note.id, classId: note.classId })} disabled={isAssigning['note']}>
                                {isAssigning['note'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Assign Note
                            </Button>
                        )}
                    </div>

                    <Separator />
                    
                    <h4 className="font-semibold text-center text-muted-foreground">Quizzes for this Note</h4>
                    
                    {quizzes.length > 0 ? (
                        <ul className="divide-y divide-border -mx-6">
                            {quizzes.map(quiz => {
                                const assignmentId = getQuizAssignmentId(quiz.id);
                                const isAssigned = !!assignmentId;
                                return (
                                <li key={quiz.id} className="flex items-center justify-between px-6 py-3">
                                    <div>
                                        <p className="font-medium">{quiz.title} Quiz</p>
                                        <p className="text-sm text-muted-foreground">{isAssigned ? "Currently assigned to students" : "Not yet assigned"}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => router.push(`/teacher/notes/${note.id}/quizzes/${quiz.id}`)}>
                                            View/Edit
                                        </Button>
                                         {isAssigned ? (
                                             <Button variant="destructive" size="sm" onClick={() => handleAction('unassign', { noteId: note.id, classId: note.classId, assignmentId })} disabled={isAssigning[assignmentId!]}>
                                                {isAssigning[assignmentId!] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Take Down
                                            </Button>
                                         ) : (
                                            <Button size="sm" onClick={() => handleAction('assignQuiz', { noteId: note.id, classId: note.classId, quizId: quiz.id })} disabled={isAssigning[quiz.id]}>
                                                {isAssigning[quiz.id] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Assign
                                            </Button>
                                         )}
                                    </div>
                                </li>
                            )})}
                        </ul>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No quizzes have been generated for this note yet.</p>
                    )}
                    <Separator />
                     <Button onClick={handleGenerateQuiz} disabled={isGeneratingQuiz} className="w-full" variant="outline">
                        {isGeneratingQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <HelpCircle className="mr-2 h-4 w-4" />}
                        Generate New Quiz
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ViewActivityDialog({ noteId }: { noteId: string }) {
    const [logs, setLogs] = React.useState<AccessLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isOpen, setIsOpen] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (!isOpen) return;
        setLoading(true);

        const fetchLogs = async () => {
             try {
                const idToken = await auth.currentUser?.getIdToken();
                if (!idToken) throw new Error("Authentication required.");

                const result = await getNoteAccessLogs(noteId, idToken);
                if (result.success && result.data) {
                    // Deduplicate logs, showing only the most recent access per student
                    const latestLogs = new Map<string, AccessLog>();
                    (result.data as any[]).forEach(log => {
                        if (!latestLogs.has(log.studentId) || new Date(log.accessedAt) > new Date(latestLogs.get(log.studentId)!.accessedAt)) {
                            latestLogs.set(log.studentId, log);
                        }
                    });
                    setLogs(Array.from(latestLogs.values()).sort((a,b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()));
                } else {
                    throw new Error(result.message);
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Could not load activity: ${e.message}` });
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [isOpen, noteId, toast]);

    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><Users className="mr-2 h-4 w-4" /> View Activity</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Student Activity</DialogTitle>
                    <DialogDescription>
                        Students who have accessed this lesson note.
                    </DialogDescription>
                </DialogHeader>
                 {loading ? (
                    <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No student has accessed this note yet.</p>
                ) : (
                    <ScrollArea className="max-h-80">
                        <ul className="divide-y">
                            {logs.map(log => (
                                <li key={log.studentName+log.accessedAt} className="flex justify-between items-center py-2">
                                    <span className="font-medium">{log.studentName}</span>
                                    <span className="text-sm text-muted-foreground">{format(new Date(log.accessedAt), 'PPP p')}</span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}

function NoteImageManager({ noteId }: { noteId: string }) {
    const storage = useStorage();
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [images, setImages] = React.useState<{ name: string; url: string }[]>([]);
    const [uploadingFiles, setUploadingFiles] = React.useState<Record<string, number>>({});
    const [loading, setLoading] = React.useState(true);
    const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

    const listImages = React.useCallback(async () => {
        if (!storage) return;
        setLoading(true);
        try {
            const listRef = ref(storage, `notes/${noteId}/images`);
            const res = await listAll(listRef);
            const urls = await Promise.all(
                res.items.map(async (itemRef) => ({
                    name: itemRef.name,
                    url: await getDownloadURL(itemRef),
                }))
            );
            setImages(urls);
        } catch (error) {
            console.error("Error listing images:", error);
        } finally {
            setLoading(false);
        }
    }, [storage, noteId]);

    React.useEffect(() => {
        listImages();
    }, [listImages]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !storage) return;
        const files = Array.from(e.target.files);

        files.forEach(file => {
            const storageRef = ref(storage, `notes/${noteId}/images/${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadingFiles(prev => ({ ...prev, [file.name]: progress }));
                },
                (error) => {
                    toast({ variant: 'destructive', title: 'Upload Failed', description: `Could not upload ${file.name}.` });
                    setUploadingFiles(prev => {
                        const newState = { ...prev };
                        delete newState[file.name];
                        return newState;
                    });
                },
                async () => {
                    await getDownloadURL(uploadTask.snapshot.ref);
                    setUploadingFiles(prev => {
                        const newState = { ...prev };
                        delete newState[file.name];
                        return newState;
                    });
                    toast({ title: 'Upload Complete!', description: `${file.name} has been uploaded.` });
                    listImages(); // Refresh the list
                }
            );
        });

         if(fileInputRef.current) fileInputRef.current.value = "";
    };
    
    const copyMarkdown = (url: string, name: string) => {
        const altText = name.split('.')[0].replace(/[-_]/g, ' ');
        navigator.clipboard.writeText(`![${altText}](${url})`);
        toast({
            title: 'Copied to Clipboard!',
            description: 'Image markdown is ready to paste.',
        });
    }
    
    const handleDeleteImage = async (imageName: string) => {
        if(!storage) return;
        setIsDeleting(imageName);
        const imageRef = ref(storage, `notes/${noteId}/images/${imageName}`);
        try {
            await deleteObject(imageRef);
            toast({title: 'Image Deleted'});
            listImages();
        } catch (error) {
            toast({variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the image.'});
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Image Manager</CardTitle>
                <CardDescription>Upload images for this note. Copy the markdown and paste it into the editor above.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="p-4 border-2 border-dashed rounded-lg text-center">
                        <Button type="button" variant="link" onClick={() => fileInputRef.current?.click()}>
                           <UploadCloud className="mr-2 h-4 w-4"/> Click to upload images
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                    </div>

                    {Object.keys(uploadingFiles).length > 0 && (
                        <div className="space-y-2">
                             <h4 className="font-semibold text-sm">Uploading...</h4>
                            {Object.entries(uploadingFiles).map(([name, progress]) => (
                                <div key={name} className="flex items-center gap-2">
                                    <p className="text-sm truncate flex-1">{name}</p>
                                    <Progress value={progress} className="w-1/3" />
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {loading ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
                        images.length > 0 && (
                             <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Uploaded Images</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {images.map(image => (
                                        <Card key={image.name} className="overflow-hidden group">
                                            <div className="relative aspect-video">
                                                <Image src={image.url} alt={image.name} layout="fill" objectFit="cover" unoptimized />
                                            </div>
                                            <div className="p-2 bg-muted/50">
                                                <p className="text-xs font-medium truncate">{image.name}</p>
                                                <div className="flex gap-1 mt-2">
                                                     <Button size="sm" variant="outline" className="w-full" onClick={() => copyMarkdown(image.url, image.name)}>
                                                        <Copy className="h-3 w-3 mr-1"/> Copy
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="w-full" onClick={() => handleDeleteImage(image.name)} disabled={isDeleting === image.name}>
                                                        {isDeleting === image.name ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 className="h-3 w-3 mr-1"/>}
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function NotePage() {
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
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [content, setContent] = React.useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const hasLoggedAccess = React.useRef(false);

    React.useEffect(() => {
        if (!firestore || !noteId || !user?.schoolId) {
            setLoading(false);
            if(user) setError("You are not currently assigned to a class.");
            return;
        }

        const noteRef = doc(firestore, 'notes', noteId as string);
        const unsubNote = onSnapshot(noteRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Note;
                
                setNote(data);
                setTitle(data.title);
                setContent(data.content);
                setError(null);
                
                // Log access for students
                if (user?.role === 'student' && data.classId === user.classId && !hasLoggedAccess.current) {
                    auth.currentUser?.getIdToken().then(idToken => {
                        logMaterialAccess({ materialId: data.id, materialType: 'note' }, idToken)
                            .catch(e => console.error("Failed to log note access:", e));
                    });
                    hasLoggedAccess.current = true;
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
    
    const handleSave = async () => {
        if (!note) return;
        setIsSaving(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            const result = await updateNote({ noteId: note.id, title, content }, idToken);
            if (result.success) {
                toast({ title: "Note Saved", description: "Your changes have been saved." });
                setIsEditing(false);
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error Saving", description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateAiNote = async () => {
        if (!note) return;
        setIsGeneratingAi(true);
        try {
            const result = await generateAINote({ topic: title, objectives: content });
            if (result.success && result.noteContent) {
                setContent(result.noteContent);
                toast({ title: 'AI Note Generated', description: 'Content has been updated with AI-generated notes.' });
            } else {
                throw new Error(result.message || "Failed to generate AI content.");
            }
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'AI Generation Failed', description: e.message });
        } finally {
            setIsGeneratingAi(false);
        }
    }
    
    const handleDelete = async () => {
        if (!note) return;
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication required.");

            const result = await deleteNote(note.id, idToken);
            if (result.success) {
                toast({ title: "Note Deleted", description: "The note has been permanently deleted." });
                router.push('/teacher/notes');
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error Deleting", description: e.message });
        } finally {
            setIsDeleteDialogOpen(false);
        }
    }

    const handlePrint = () => {
        window.print();
    };

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
    
    const canEdit = user?.uid === note.createdBy;
    const canView = canEdit || (user?.role === 'student' && user?.classId === note.classId);

    if (!canView) {
        return <p className="text-center text-destructive">You do not have permission to view this note.</p>;
    }


    return (
        <div className="space-y-6">
            <div className="printable-hidden flex justify-between items-start">
                <div>
                    <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    {isEditing ? (
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-3xl font-bold tracking-tight h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                        />
                    ) : (
                        <h2 className="text-3xl font-bold tracking-tight">{note.title}</h2>
                    )}
                    <p className="text-muted-foreground">Read, edit, or print the lesson note below.</p>
                </div>

                {!isEditing && canEdit && (
                    <div className="flex items-center space-x-2">
                        <ViewActivityDialog noteId={note.id} />
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print Note
                        </Button>
                    </div>
                )}
            </div>
            
            {quizzes.length > 0 && !isEditing && (
                 <Card className="bg-blue-50 border-blue-200 printable-hidden">
                    <CardHeader>
                        <CardTitle>Available Quiz</CardTitle>
                        <CardDescription>A quiz is available for this lesson note..</CardDescription>
                    </CardHeader>
                    <CardContent>
                    
                    </CardContent>
                </Card>
            )}
            <div className="printable-area">
                <div className="printable-page-content">
                    <div className="print:block hidden mb-4 text-center">
                        <h1 className="text-2xl font-bold">{note.title}</h1>
                        <p className="text-sm">Class: {user?.className}</p>
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            {isEditing && canEdit ? (
                                <>
                                <Textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="min-h-[40vh] text-base"
                                />
                                <NoteImageManager noteId={note.id} />
                                </>
                            ) : (
                                <MarkdownViewer content={content} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>


            {canEdit && (
              <>
                <div className="flex justify-end gap-2 printable-hidden">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                             <Button onClick={handleGenerateAiNote} disabled={isGeneratingAi || isSaving}>
                                {isGeneratingAi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Generate with AI
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving || isGeneratingAi}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Note
                            </Button>
                            <AssignDialog note={note} quizzes={quizzes} />
                             <Button onClick={() => setIsEditing(true)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Note
                            </Button>
                        </>
                    )}
                </div>
              </>
            )}
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the note titled "{note.title}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
