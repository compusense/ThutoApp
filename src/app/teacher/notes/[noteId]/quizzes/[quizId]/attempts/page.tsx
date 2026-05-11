
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { format, formatDistance } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getQuizAttempts } from '../../../../actions';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Quiz {
    id: string;
    title: string;
}

interface QuizAttempt {
    id: string;
    studentName: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    startedAt: string;
    completedAt: string;
    answers: {
        question: string;
        selectedAnswer: string;
        correctAnswer: string;
        isCorrect: boolean;
    }[];
}

export default function QuizAttemptsPage() {
    const params = useParams();
    const { noteId, quizId } = params;
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [quiz, setQuiz] = React.useState<Quiz | null>(null);
    const [attempts, setAttempts] = React.useState<QuizAttempt[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedAttempt, setSelectedAttempt] = React.useState<QuizAttempt | null>(null);

    React.useEffect(() => {
        if (!firestore || !noteId || !quizId) {
            setLoading(false);
            return;
        }

        const quizRef = doc(firestore, 'notes', noteId as string, 'quizzes', quizId as string);
        const unsubQuiz = onSnapshot(quizRef, (docSnap) => {
            if (docSnap.exists()) {
                setQuiz({ id: docSnap.id, ...docSnap.data() } as Quiz);
            }
        });

        const fetchAttempts = async () => {
            try {
                const idToken = await auth.currentUser?.getIdToken();
                if (!idToken) throw new Error("Authentication required.");
                
                const result = await getQuizAttempts(noteId as string, quizId as string, idToken);
                if (result.success && result.data) {
                    setAttempts(result.data as QuizAttempt[]);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: result.message });
                }
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error', description: e.message });
            } finally {
                setLoading(false);
            }
        }
        
        fetchAttempts();

        return () => unsubQuiz();
    }, [firestore, noteId, quizId, toast]);

    const getDuration = (start: string, end: string) => {
        try {
            return formatDistance(new Date(end), new Date(start));
        } catch {
            return 'N/A';
        }
    };
    
    if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Quiz
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Quiz Attempts</h2>
                <p className="text-muted-foreground">Latest results for "{quiz?.title}" quiz.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Student Submissions</CardTitle>
                    <CardDescription>{attempts.length} student(s) have attempted this quiz.</CardDescription>
                </CardHeader>
                <CardContent>
                    {attempts.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No students have attempted this quiz yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Date of Last Attempt</TableHead>
                                    <TableHead className="text-center">Last Score</TableHead>
                                    <TableHead className="text-center">Percentage</TableHead>
                                    <TableHead className="text-center">Duration</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attempts.map(attempt => (
                                    <TableRow key={attempt.id}>
                                        <TableCell className="font-medium">{attempt.studentName}</TableCell>
                                        <TableCell>{format(new Date(attempt.completedAt), 'PPP p')}</TableCell>
                                        <TableCell className="text-center">{attempt.score} / {attempt.totalQuestions}</TableCell>
                                        <TableCell className="text-center font-semibold">{attempt.percentage.toFixed(0)}%</TableCell>
                                        <TableCell className="text-center">{getDuration(attempt.startedAt, attempt.completedAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(attempt)}>View Details</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {selectedAttempt && (
                <Dialog open={!!selectedAttempt} onOpenChange={() => setSelectedAttempt(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Last Attempt Details for {selectedAttempt.studentName}</DialogTitle>
                            <DialogDescription>Completed on {format(new Date(selectedAttempt.completedAt), 'PPP p')}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] p-4">
                            <div className="space-y-6">
                                {selectedAttempt.answers.map((answer, index) => (
                                    <div key={index}>
                                        <p className="font-semibold">{index + 1}. {answer.question}</p>
                                        <div className="mt-2 text-sm">
                                            {answer.isCorrect ? (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span>Correct: {answer.selectedAnswer}</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle className="h-4 w-4" />
                                                        <span>Selected: {answer.selectedAnswer || '(No answer)'}</span>
                                                    </div>
                                                     <div className="flex items-center gap-2 text-muted-foreground pl-6">
                                                        <span>Correct Answer: {answer.correctAnswer}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
