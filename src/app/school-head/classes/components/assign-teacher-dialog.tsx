
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Class } from '../page';
import { UserProfile } from '@/firebase/auth/use-user';
import { assignTeacherToClass } from '../actions';
import { useRouter } from 'next/navigation';

interface AssignTeacherDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  classData: Class;
  teachers: UserProfile[];
}

const assignTeacherSchema = z.object({
  teacherId: z.string().min(1, 'Please select a teacher'),
});

type AssignTeacherFormValues = z.infer<typeof assignTeacherSchema>;

export function AssignTeacherDialog({
  isOpen,
  onOpenChange,
  classData,
  teachers,
}: AssignTeacherDialogProps) {
  const { toast } = useToast();
  const [isAssigning, setIsAssigning] = React.useState(false);
  const router = useRouter();

  const form = useForm<AssignTeacherFormValues>({
    resolver: zodResolver(assignTeacherSchema),
    defaultValues: {
      teacherId: classData.teacherId || '',
    },
  });
  
  React.useEffect(() => {
    form.reset({ teacherId: classData.teacherId || '' });
  }, [classData, form, isOpen]);


  const onSubmit = async (values: AssignTeacherFormValues) => {
    setIsAssigning(true);
    try {
      const result = await assignTeacherToClass({ 
          schoolId: classData.schoolId, 
          classId: classData.id,
          ...values 
        });

      if (result.success) {
        toast({
          title: 'Teacher Assigned',
          description: result.message,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Assigning Teacher',
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
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Teacher to {classData.name}</DialogTitle>
          <DialogDescription>
            Select a teacher from the list to assign to this class.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="teacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teacher</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a teacher" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassign">
                        <span className="text-muted-foreground">Unassign Teacher</span>
                      </SelectItem>
                      {teachers.length > 0 ? (
                        teachers.map((teacher) => (
                          <SelectItem key={teacher.uid} value={teacher.uid}>
                            {teacher.displayName}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="-" disabled>
                          No teachers available in this school
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAssigning}>
                {isAssigning ? 'Assigning...' : 'Assign Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
