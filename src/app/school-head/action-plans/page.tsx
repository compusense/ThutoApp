
'use client';

import * as React from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveActionPlan } from './actions';

interface ActionPlanDocument {
    id: string;
    academicYear: string;
    term: string;
    events: ActionPlanEvent[];
}

interface ActionPlanEvent {
    id: string; // Client-side ID
    title: string;
    date: Date;
    type: 'Meeting' | 'Sports' | 'Exam' | 'Cultural' | 'Other';
    description?: string;
}

const actionPlanEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  date: z.date({ required_error: 'Date is required'}),
  type: z.enum(['Meeting', 'Sports', 'Exam', 'Cultural', 'Other']),
  description: z.string().optional(),
});

const actionPlanSchema = z.object({
  events: z.array(actionPlanEventSchema),
});

type ActionPlanFormValues = z.infer<typeof actionPlanSchema>;

export default function ActionPlansPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [loading, setLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const academicYears = React.useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()), []);
    const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());
    const terms = ["Term 1", "Term 2", "Term 3"] as const;
    type Term = typeof terms[number];
    const [selectedTerm, setSelectedTerm] = React.useState<Term>(terms[0]);
    
    const form = useForm<ActionPlanFormValues>({
        resolver: zodResolver(actionPlanSchema),
        defaultValues: {
            events: [],
        },
    });

    const { fields, append, remove, control, handleSubmit } = useFieldArray({
        control: form.control,
        name: 'events',
    });

    React.useEffect(() => {
        if (!firestore || !user?.schoolId) return;

        setLoading(true);
        const docId = `${selectedYear}-${selectedTerm.replace(' ', '')}`;
        const actionPlanRef = doc(firestore, 'schools', user.schoolId, 'actionPlans', docId);

        const unsubscribe = onSnapshot(actionPlanRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const fetchedEvents = (data.events || []).map((event: any) => ({
                    ...event,
                    id: uuidv4(), // Assign a new client-side ID
                    date: new Date(event.date),
                }));
                form.reset({ events: fetchedEvents });
            } else {
                form.reset({ events: [] });
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching action plan:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load action plan data.' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user?.schoolId, selectedYear, selectedTerm, form, toast]);


    const addEvent = () => {
        append({
            id: uuidv4(),
            title: '',
            date: new Date(),
            type: 'Meeting',
            description: '',
        });
    };

    const removeEvent = (index: number) => {
        remove(index);
        // After removing from form state, immediately trigger a save.
        handleSubmit(onSubmit)();
    }


    const onSubmit = async (values: ActionPlanFormValues) => {
        if (!user?.schoolId) return;
        setIsSubmitting(true);
        try {
            const result = await saveActionPlan({
                schoolId: user.schoolId,
                academicYear: selectedYear,
                term: selectedTerm,
                events: values.events,
            });

            if (result.success) {
                toast({ title: 'Success', description: 'Action plan saved successfully.' });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">School Action Plans</h2>
                <p className="text-muted-foreground">
                    Create and manage the calendar of events for each term.
                </p>
            </div>
            
            <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Period</CardTitle>
                        <CardDescription>Choose the year and term to plan for.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                            <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v as Term)}>
                            <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                            <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                         <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Events for {selectedTerm}, {selectedYear}</CardTitle>
                                <CardDescription>Add, edit, or remove events for this period.</CardDescription>
                            </div>
                             <Button type="button" variant="outline" onClick={addEvent}><PlusCircle className="mr-2 h-4 w-4" /> Add Event</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : fields.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">No events for this period. Click "Add Event" to start.</div>
                        ) : (
                            fields.map((field, index) => (
                                <Card key={field.id} className="p-4 relative">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={control} name={`events.${index}.title`} render={({ field }) => (<FormItem><FormLabel>Event Title</FormLabel><FormControl><Input placeholder="e.g., Staff Meeting" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={control} name={`events.${index}.type`} render={({ field }) => (<FormItem><FormLabel>Event Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Meeting">Meeting</SelectItem><SelectItem value="Sports">Sports</SelectItem><SelectItem value="Exam">Exam</SelectItem><SelectItem value="Cultural">Cultural</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                        <FormField control={control} name={`events.${index}.date`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
                                        <div className="md:col-span-3">
                                            <FormField control={control} name={`events.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Add any extra details here..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeEvent(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </Card>
                            ))
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting || loading}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Action Plan
                    </Button>
                </div>
            </form>
            </FormProvider>
        </div>
    );
}
