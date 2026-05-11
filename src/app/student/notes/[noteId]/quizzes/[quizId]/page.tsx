
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { saveQuizAttempt, logMaterialAccess } from '@/app/teacher/notes/actions';
import { useToast } from '@/hooks/use-toast';

const questionSchema = z.object({
  question: z.string(),
  type: z.enum(['multiple-choice', 'true-false']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
});

interface Quiz {
  id: string;
  title: string;
  questions: z.infer<typeof questionSchema>[];
  noteId: string;
}

export default function StudentQuizPage() {
    const params = useParams();
    const { noteId, quizId } = params;
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [quiz, setQuiz] = React.useState<Quiz | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [answers, setAnswers] = React.useState<Record<number, string>>({});
    const [submitted, setSubmitted] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const startTimeRef = React.useRef<Date | null>(null);
    
    React.useEffect(() => {
        startTimeRef.current = new Date();
    }, []);


    React.useEffect(() => {
        if (!firestore || !noteId || !quizId) {
            setLoading(false);
            return;
        }

        const quizRef = doc(firestore, 'notes', noteId as string, 'quizzes', quizId as string);
        const unsubscribe = onSnapshot(quizRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Quiz;
                setQuiz(data);
                 // Log access
                if (user) {
                     auth.currentUser?.getIdToken().then(idToken => {
                        logMaterialAccess({ materialId: data.id, materialType: 'quiz' }, idToken)
                            .catch(e => console.error("Failed to log quiz access:", e));
                    });
                }
            } else {
                setError("Quiz not found.");
            }
            setLoading(false);
        }, (err) => {
            setError("Failed to load quiz.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, noteId, quizId, user]);

    const handleAnswerChange = (questionIndex: number, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
    };

    const handleSubmit = async () => {
        if (!quiz || !user) return;
        setIsSubmitting(true);
        setSubmitted(true);

        const endTime = new Date();
        const finalScore = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
        const finalPercentage = (finalScore / quiz.questions.length) * 100;

        const attemptData = {
            quizId: quiz.id,
            noteId: quiz.noteId,
            score: finalScore,
            totalQuestions: quiz.questions.length,
            percentage: finalPercentage,
            startedAt: startTimeRef.current?.toISOString() || new Date().toISOString(),
            completedAt: endTime.toISOString(),
            answers: quiz.questions.map((q, i) => ({
                question: q.question,
                selectedAnswer: answers[i] || '',
                correctAnswer: q.correctAnswer,
                isCorrect: answers[i] === q.correctAnswer,
            })),
        };
        
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication failed.");
            await saveQuizAttempt(attemptData, idToken);
            toast({ title: "Quiz Submitted!", description: `You scored ${finalScore} out of ${quiz.questions.length}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: `Could not save your score: ${e.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <p className="text-center text-destructive">{error}</p>;
    if (!quiz) return <p className="text-center">Quiz not found.</p>;

    const score = submitted ? quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0) : 0;
    const percentage = submitted ? (score / quiz.questions.length) * 100 : 0;

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Note
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">{quiz.title} Quiz</h2>
                <p className="text-muted-foreground">Answer the questions below to test your knowledge.</p>
            </div>
            
            {submitted && (
                <Card className={cn(percentage >= 50 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <CardHeader>
                        <CardTitle>Quiz Results</CardTitle>
                        <CardDescription>You scored {score} out of {quiz.questions.length}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">{percentage.toFixed(0)}%</p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-6">
                    <div className="space-y-8">
                        {quiz.questions.map((q, index) => (
                            <div key={index}>
                               <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</div>
                                    <p className="flex-1 font-semibold text-lg">{q.question}</p>
                                </div>
                                <div className="pl-12 mt-4 space-y-2">
                                     <RadioGroup onValueChange={(val) => handleAnswerChange(index, val)} value={answers[index] || ''} disabled={submitted}>
                                        {q.type === 'multiple-choice' && q.options?.map((option, i) => {
                                            const isCorrect = option === q.correctAnswer;
                                            const isSelected = answers[index] === option;
                                            return (
                                                <div key={i} className={cn("flex items-center gap-3 p-3 rounded-lg border", 
                                                    submitted && isCorrect && "bg-green-100 dark:bg-green-900/50",
                                                    submitted && isSelected && !isCorrect && "bg-red-100 border-red-300"
                                                )}>
                                                    <RadioGroupItem value={option} id={`q${index}-opt${i}`} />
                                                    <Label htmlFor={`q${index}-opt${i}`} className="flex-1 cursor-pointer">{option}</Label>
                                                    {submitted && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500"/>}
                                                    {submitted && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500"/>}
                                                </div>
                                            )
                                        })}
                                        {q.type === 'true-false' && (
                                            <>
                                                {['True', 'False'].map(option => {
                                                     const isCorrect = option === q.correctAnswer;
                                                    const isSelected = answers[index] === option;
                                                    return (
                                                         <div key={option} className={cn("flex items-center gap-3 p-3 rounded-lg border", 
                                                            submitted && isCorrect && "bg-green-100 dark:bg-green-900/50",
                                                            submitted && isSelected && !isCorrect && "bg-red-100 border-red-300"
                                                        )}>
                                                            <RadioGroupItem value={option} id={`q${index}-${option}`} />
                                                            <Label htmlFor={`q${index}-${option}`} className="flex-1 cursor-pointer">{option}</Label>
                                                            {submitted && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500"/>}
                                                            {submitted && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500"/>}
                                                        </div>
                                                    )
                                                })}
                                            </>
                                        )}
                                    </RadioGroup>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {!submitted && (
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== quiz.questions.length || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Quiz
                    </Button>
                </div>
            )}
        </div>
    );
}
