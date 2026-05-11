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
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { changeStudentStatus } from '../actions';
import { Student } from '../page';
import { Textarea } from '@/components/ui/textarea';

interface ChangeStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string;
  student: Student;
}

const statusSchema = z.object({
  status: z.enum(['Active', 'Dropped Out', 'Transferred Out', 'Deceased']),
  reasonForStatusChange: z.string().optional(),
});

type ChangeStatusFormValues = z.infer<typeof statusSchema>;

export function ChangeStatusDialog({ isOpen, onOpenChange, schoolId, student }: ChangeStatusDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const form = useForm<ChangeStatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      status: student.status,
      reasonForStatusChange: student.reasonForStatusChange || '',
    },
  });

  React.useEffect(() => {
    form.reset({
      status: student.status,
      reasonForStatusChange: student.reasonForStatusChange || '',
    });
  }, [student, form, isOpen]);

  const watchedStatus = form.watch('status');
  const showReasonField = watchedStatus === 'Dropped Out' || watchedStatus === 'Transferred Out';

  const onSubmit = async (values: ChangeStatusFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await changeStudentStatus({ ...values, schoolId, studentId: student.id });
      if (result.success) {
        toast({
          title: 'Status Updated',
          description: result.message,
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Changing Status',
          description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unexpected Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
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
          <DialogTitle>Change Status for {student.fullName}</DialogTitle>
          <DialogDescription>
            Update the student's current status. Inactive students will be removed from class rolls.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Dropped Out">Dropped Out</SelectItem>
                      <SelectItem value="Transferred Out">Transferred Out</SelectItem>
                      <SelectItem value="Deceased">Deceased</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showReasonField && (
                <FormField
                control={form.control}
                name="reasonForStatusChange"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Reason for Status Change (Optional)</FormLabel>
                    <FormControl>
                        <Textarea 
                            placeholder={watchedStatus === 'Transferred Out' ? 'e.g., School transferred to' : 'e.g., Reason for dropping out'}
                            {...field} 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Status'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
