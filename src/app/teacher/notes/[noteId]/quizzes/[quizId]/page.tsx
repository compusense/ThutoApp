'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore, auth } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Pencil, Save, PlusCircle, Trash2, Users, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { updateQuiz, deleteQuiz } from '../../../actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AppLink } from '@/components/ui/app-link';

const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1, "Question cannot be empty"),
  type: z.enum(['multiple-choice', 'true-false']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, "A correct answer must be selected"),
});

const quizFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  questions: z.array(questionSchema).min(1, "Quiz must have at least one question."),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

interface Quiz {
  id: string;
  title: string;
  questions: z.infer<typeof questionSchema>[];
  noteId: string;
  createdBy: string;
  createdAt: string;
}

const PrintableView = ({ quiz }: { quiz: Quiz }) => {
  return (
    <div className="printable-quiz-area">
      <div className="quiz-print-page">
        <div className="quiz-print-header">
          <h1 className="quiz-print-title">{quiz.title} Quiz</h1>
          <div className="quiz-print-info">
            <span>Name: __________________________</span>
            <span>Date: __________________________</span>
          </div>
        </div>
        <div className="quiz-print-questions">
          {quiz.questions.map((q, index) => (
            <div key={index} className="quiz-question-item">
              <p className="quiz-question-text">{index + 1}. {q.question}</p>
              {q.type === 'multiple-choice' && q.options && (
                <ol type="A" className="quiz-options-list">
                  {q.options.map((option, i) => (
                    <li key={i} className="quiz-option">
                      <span>{String.fromCharCode(65 + i)}.</span>
                      <span>{option}</span>
                    </li>
                  ))}
                </ol>
              )}
              {q.type === 'true-false' && (
                <div className="pl-6 space-x-8">
                  <span>True</span>
                  <span>False</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="quiz-print-page break-before-page">
        <h2 className="answer-key-title">Answer Key - {quiz.title} Quiz</h2>
        <div className="answer-key-grid">
          {quiz.questions.map((q, index) => (
            <div key={`key-${index}`} className="answer-key-item">
              <span className="font-bold">{index + 1}.</span>
              <span>{q.correctAnswer}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function QuizPage() {
  const params = useParams();
  const { noteId, quizId } = params;
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [quiz, setQuiz] = React.useState<Quiz | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: { title: '', questions: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'questions',
  });

  React.useEffect(() => {
    if (!firestore || !noteId || !quizId) {
      setLoading(false);
      return;
    }

    const quizRef = doc(firestore, 'notes', noteId as string, 'quizzes', quizId as string);
    const unsubscribe = onSnapshot(
      quizRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Quiz;
          setQuiz(data);
          form.reset({ title: data.title, questions: data.questions });
        } else {
          setError('Quiz not found.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, noteId, quizId, form]);

  const handleSave = async (data: QuizFormValues) => {
    if (!noteId || !quizId) return;
    setIsSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication required.');

      const result = await updateQuiz(
        { noteId: noteId as string, quizId: quizId as string, ...data },
        idToken
      );
      if (result.success) {
        toast({ title: 'Quiz Saved', description: 'Your changes have been saved.' });
        setIsEditing(false);
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!noteId || !quizId) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication required.');

      await deleteQuiz(noteId as string, quizId as string, idToken);
      toast({ title: 'Quiz Deleted', description: 'The quiz has been removed.' });
      router.push(`/teacher/notes/${noteId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const addNewQuestion = (type: 'multiple-choice' | 'true-false') => {
    const newQuestion: any = {
      question: '',
      type: type,
      correctAnswer: '',
    };
    if (type === 'multiple-choice') {
      newQuestion.options = ['', '', '', ''];
    }
    append(newQuestion);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );

  if (error) return <p className="text-center text-destructive">{error}</p>;
  if (!quiz) return <p className="text-center">Quiz not found.</p>;

  const canEdit = user?.uid === quiz.createdBy;
  if (!canEdit)
    return <p className="text-center text-destructive">You do not have permission to view or edit this quiz.</p>;

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Header with Back button, title, and top actions */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.push(`/teacher/notes/${noteId}`)} className="-ml-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Note
            </Button>

            {/* Top action buttons: Print and View Attempts */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Quiz
              </Button>

              <Button asChild variant="outline">
                <AppLink href={`/teacher/notes/${noteId}/quizzes/${quizId}/attempts`}>
                  <Users className="mr-2 h-4 w-4" />
                  View Attempts
                </AppLink>
              </Button>
            </div>
          </div>

          {/* Title */}
          {isEditing ? (
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      className="text-3xl font-bold tracking-tight h-auto p-0 border-0 shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <h2 className="text-3xl font-bold tracking-tight">{quiz.title} Quiz</h2>
          )}
          <p className="text-muted-foreground">A quiz generated from your lesson notes.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              {isEditing ? 'Edit the questions, options, and correct answers below.' : 'Review the questions and answers.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {fields.map((q, index) => (
                <div key={q.id}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {index + 1}
                    </div>
                    {isEditing ? (
                      <FormField
                        control={form.control}
                        name={`questions.${index}.question`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Textarea {...field} placeholder="Type the question..." className="text-lg font-semibold" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <p className="flex-1 font-semibold text-lg">{q.question}</p>
                    )}
                    {isEditing && (
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="pl-12 mt-4 space-y-2">
                    <FormField
                      control={form.control}
                      name={`questions.${index}.correctAnswer`}
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                              {q.type === 'multiple-choice' &&
                                q.options?.map((option, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      'flex items-center gap-3 p-2 rounded-md',
                                      !isEditing && option === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/50' : ''
                                    )}
                                  >
                                    <RadioGroupItem value={option} />
                                    {isEditing ? (
                                      <FormField
                                        control={form.control}
                                        name={`questions.${index}.options.${i}`}
                                        render={({ field }) => <Input {...field} placeholder={`Option ${i + 1}`} />}
                                      />
                                    ) : (
                                      <span>{option}</span>
                                    )}
                                  </div>
                                ))}
                              {q.type === 'true-false' && (
                                <>
                                  <div
                                    className={cn(
                                      'flex items-center gap-3 p-2 rounded-md',
                                      !isEditing && 'True' === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/50' : ''
                                    )}
                                  >
                                    <RadioGroupItem value="True" />
                                    <span>True</span>
                                  </div>
                                  <div
                                    className={cn(
                                      'flex items-center gap-3 p-2 rounded-md',
                                      !isEditing && 'False' === q.correctAnswer ? 'bg-green-900/50' : ''
                                    )}
                                  >
                                    <RadioGroupItem value="False" />
                                    <span>False</span>
                                  </div>
                                </>
                              )}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Separator className="mt-8" />
                </div>
              ))}

              {isEditing && (
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => addNewQuestion('multiple-choice')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Multiple Choice
                  </Button>
                  <Button type="button" variant="outline" onClick={() => addNewQuestion('true-false')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add True/False
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom action buttons: Edit and Delete */}
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => { setIsEditing(false); form.reset(quiz); }}>
                  Cancel
                </Button>
                <Button onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Quiz
                </Button>

                <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Quiz
                </Button>
              </>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this quiz. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Printable version - hidden on screen */}
        <div className="hidden print:block mt-12 print:mt-0">
          <PrintableView quiz={quiz} />
        </div>
      </div>
    </FormProvider>
  );
}