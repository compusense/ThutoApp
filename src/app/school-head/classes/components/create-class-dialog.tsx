
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
import { useRouter } from 'next/navigation';
import { School } from '@/app/super-admin/schools/page';
import { createClass } from '../actions';

interface CreateClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  school: School | null;
  academicYear: string;
}

const createClassSchema = z.object({
  gradeLevel: z.string().min(1, 'Please select a grade level'),
  stream: z.string().max(5, 'Stream is too long').optional(),
});

type CreateClassFormValues = z.infer<typeof createClassSchema>;


export function CreateClassDialog({ isOpen, onOpenChange, school, academicYear }: CreateClassDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateClassFormValues>({
    resolver: zodResolver(createClassSchema),
    defaultValues: {
      gradeLevel: '',
      stream: '',
    },
  });
  
  const gradeLevels = React.useMemo(() => {
    if (school?.schoolType === 'Primary School') {
        return ["Reception", "Standard 1", "Standard 2", "Standard 3", "Standard 4", "Standard 5", "Standard 6", "Standard 7"];
    }
    if (school?.schoolType === 'Junior Secondary School') {
        return ["Form 1", "Form 2", "Form 3"];
    }
    if (school?.schoolType === 'Senior Secondary School') {
        return ["Form 4", "Form 5"];
    }
    return [];
  }, [school]);

  const onSubmit = async (values: CreateClassFormValues) => {
    if (!school) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No school associated with your account.',
        });
        return;
    }

    setIsCreating(true);
    try {
      const result = await createClass({ ...values, schoolId: school.id, academicYear });
      if (result.success) {
        const className = values.stream ? `${values.gradeLevel} ${values.stream.toUpperCase()}`.trim() : values.gradeLevel;
        toast({
          title: 'Class Created',
          description: `Class "${className}" has been created for ${academicYear}. You can now allocate subjects to it for this academic year.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating Class',
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
          <DialogTitle>Create New Class for {academicYear}</DialogTitle>
          <DialogDescription>
            Enter the details for the new class. The class name will be a combination of the grade and stream.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="gradeLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a grade level" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {gradeLevels.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                                {grade}
                            </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stream"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stream (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., A, B, C" {...field} />
                  </FormControl>
                   <FormDescription>
                    Enter a letter or name for the stream if your school uses them.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Class'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
