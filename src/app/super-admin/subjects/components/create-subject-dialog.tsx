
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createSubject } from '../actions';
import { useRouter } from 'next/navigation';

interface CreateSubjectDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  subjectCode: z.string().optional(),
  schoolLevel: z.enum([
    "Primary School",
    "Junior Secondary School",
    "Senior Secondary School",
  ], { required_error: 'School level is required' }),
});

type CreateSubjectFormValues = z.infer<typeof createSubjectSchema>;

const schoolLevels = [
  "Primary School",
  "Junior Secondary School",
  "Senior Secondary School",
];

export function CreateSubjectDialog({ isOpen, onOpenChange }: CreateSubjectDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateSubjectFormValues>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: {
      name: '',
      subjectCode: '',
      schoolLevel: undefined,
    },
  });

  const onSubmit = async (values: CreateSubjectFormValues) => {
    setIsCreating(true);
    try {
      const result = await createSubject(values);
      if (result.success) {
        toast({
          title: 'Subject Created',
          description: `Subject "${values.name}" has been created successfully.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating Subject',
          description: result.message,
          duration: 9000,
        });
      }
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'An unexpected error occurred',
        description: 'An unknown error happened. Please try again.',
        duration: 9000,
      });
    } finally {
        setIsCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Subject</DialogTitle>
          <DialogDescription>
            Add a new subject to the master list for the entire system.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Mathematics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subjectCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Code (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., MATH101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="schoolLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a school level" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {schoolLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                                {level}
                            </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Subject'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
