
'use client';

import { useFieldArray, useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createForm } from '../actions';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth } from '@/firebase';

const columnSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  type: z.enum(['text', 'textarea', 'date', 'number', 'select-teacher']),
});

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(1, 'Description is required'),
  columns: z.array(columnSchema).min(1, 'You must add at least one column'),
});

type FormBuilderValues = z.infer<typeof formSchema>;

export default function CreateFormPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormBuilderValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      columns: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'columns',
  });

  const addColumn = () => {
    append({ id: uuidv4(), label: '', type: 'text' });
  };
  
  const onSubmit = async (values: FormBuilderValues) => {
    setIsSubmitting(true);
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
            throw new Error("Authentication token not found.");
        }
        const result = await createForm(values, idToken);
        if (result.success) {
            toast({ title: "Success", description: "Form created and published successfully." });
            router.push('/forms');
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not create form.' });
    } finally {
        setIsSubmitting(false);
    }
  };

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
                <h2 className="text-3xl font-bold tracking-tight">Create New Form</h2>
                <p className="text-muted-foreground">
                Build a new form to collect data from school heads.
                </p>
            </div>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & Publish
            </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Form Title</FormLabel>
                <FormControl><Input placeholder="e.g., Term 1 Teacher Absences" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Form Description</FormLabel>
                <FormControl><Textarea placeholder="A brief description of what this form is for." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Form Columns</CardTitle>
          <CardDescription>Define the columns for the data entry table.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <Card key={field.id} className="p-4">
              <div className="flex items-end gap-4">
                <FormField
                  control={form.control}
                  name={`columns.${index}.label`}
                  render={({ field }) => (
                    <FormItem className='flex-grow'>
                      <FormLabel>Column Label</FormLabel>
                      <FormControl><Input placeholder="e.g., Teacher Name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`columns.${index}.type`}
                  render={({ field }) => (
                    <FormItem className='flex-grow'>
                      <FormLabel>Column Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Text Area</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="select-teacher">Teacher Selector</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button variant="destructive" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
           {form.formState.errors.columns && (
             <p className="text-sm font-medium text-destructive">{form.formState.errors.columns.root?.message}</p>
           )}
          <Button type="button" variant="outline" onClick={addColumn}>
            <Plus className="mr-2 h-4 w-4" /> Add Column
          </Button>
        </CardContent>
      </Card>
    </form>
    </FormProvider>
  );
}
