
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Loader2, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, auth } from '@/firebase';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { FormDocument } from '../page';
import { useForm, FormProvider, useFieldArray, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSchoolTeachers, submitForm } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function FillFormPage() {
  const params = useParams();
  const { formId } = params;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [formDef, setFormDef] = useState<FormDocument | null>(null);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = useMemo(() => {
    if (!formDef) return z.object({});
    
    const rowSchema = z.object(
        formDef.fields.reduce((acc, field) => {
            let schema: z.ZodType<any, any>;
            switch (field.type) {
                case 'number': schema = z.coerce.number(); break;
                case 'date': schema = z.date(); break;
                default: schema = z.string().min(1, 'This field is required');
            }
            acc[field.id] = schema;
            return acc;
        }, {} as Record<string, z.ZodType<any, any>>)
    );

    return z.object({
        rows: z.array(rowSchema).min(1, 'At least one record is required.'),
    });

  }, [formDef]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
        rows: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  useEffect(() => {
    if (!firestore || !formId || !user) return;
    setLoading(true);

    const formRef = doc(firestore, 'forms', formId as string);
    const unsub = onSnapshot(formRef, async (docSnap) => {
      if (docSnap.exists()) {
        const formDoc = { id: docSnap.id, ...docSnap.data() } as FormDocument;
        setFormDef(formDoc);

        const hasTeacherSelector = formDoc.fields.some(f => f.type === 'select-teacher');
        if (hasTeacherSelector && user.schoolId) {
          try {
            const schoolTeachers = await getSchoolTeachers(user.schoolId);
            setTeachers(schoolTeachers);
          } catch (e) {
            console.error("Could not fetch teachers for form");
          }
        }
         // Add one default row to start with
        if (form.getValues('rows').length === 0) {
            append({}, { shouldFocus: false });
        }
      } else {
        setFormDef(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [firestore, formId, user, append, form]);

  const onSubmit = async (values: { rows: Record<string, any>[] }) => {
    if (!formDef) return;
    setIsSubmitting(true);
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
            throw new Error("Authentication failed. Please log in again.");
        }
        const result = await submitForm({formId: formDef.id, rows: values.rows }, idToken);
        if (result.success) {
            toast({title: "Success", description: "Form submitted successfully."});
            router.push('/forms');
        } else {
            throw new Error(result.message);
        }
    } catch(error: any) {
        toast({variant: 'destructive', title: 'Error', description: error.message || "Failed to submit form."})
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderField = (fieldDef: FormDocument['fields'][0], index: number) => {
    const fieldName = `rows.${index}.${fieldDef.id}` as const;

    switch (fieldDef.type) {
      case 'textarea':
        return <Textarea placeholder={fieldDef.label} {...form.register(fieldName)} />;
      case 'number':
        return <Input type="number" placeholder={fieldDef.label} {...form.register(fieldName)} />;
      case 'date':
        return (
          <Controller
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
              </Popover>
            )}
          />
        );
      case 'select-teacher':
        return (
          <Controller
            control={form.control}
            name={fieldName}
            render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.displayName}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
          />
        );
      case 'text':
      default:
        return <Input placeholder={fieldDef.label} {...form.register(fieldName)} />;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!formDef) {
    return <Card><CardContent className="p-10 text-center">Form not found.</CardContent></Card>;
  }

  return (
    <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
       <div className='flex items-center justify-between'>
        <div>
            <Button asChild variant="ghost" className="-ml-4">
                <AppLink href="/forms">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to All Forms
                </AppLink>
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">{formDef.title}</h2>
            <p className="text-muted-foreground">{formDef.description}</p>
        </div>
        <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Form
        </Button>
       </div>

        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {formDef.fields.map(field => <TableHead key={field.id}>{field.label}</TableHead>)}
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((row, index) => (
                                <TableRow key={row.id}>
                                    {formDef.fields.map(fieldDef => (
                                        <TableCell key={fieldDef.id} className="p-2 min-w-[200px]">
                                             <FormField
                                                control={form.control}
                                                name={`rows.${index}.${fieldDef.id}`}
                                                render={() => (
                                                    <FormItem>
                                                        <FormControl>{renderField(fieldDef, index)}</FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell className="p-2">
                                        <Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        <div className="flex items-center space-x-4">
            <Button type="button" variant="outline" onClick={() => append({}, { shouldFocus: true })}>
                <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
             {form.formState.errors.rows && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.rows.root?.message || form.formState.errors.rows.message}</p>
           )}
        </div>
    </form>
    </FormProvider>
  );
}
