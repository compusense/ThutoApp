
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
import { School } from '../page';
import { UserProfile } from '@/firebase/auth/use-user';
import { updateSchool } from '../actions';
import { useRouter } from 'next/navigation';

interface AssignSchoolHeadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  school: School;
  schoolHeads: UserProfile[];
}

const assignSchoolHeadSchema = z.object({
  schoolHeadId: z.string().min(1, 'Please select a school head'),
});

type AssignSchoolHeadFormValues = z.infer<typeof assignSchoolHeadSchema>;

export function AssignSchoolHeadDialog({
  isOpen,
  onOpenChange,
  school,
  schoolHeads,
}: AssignSchoolHeadDialogProps) {
  const { toast } = useToast();
  const [isAssigning, setIsAssigning] = React.useState(false);
  const router = useRouter();

  const form = useForm<AssignSchoolHeadFormValues>({
    resolver: zodResolver(assignSchoolHeadSchema),
    defaultValues: {
      schoolHeadId: school.schoolHeadId || '',
    },
  });
  
  React.useEffect(() => {
    form.reset({ schoolHeadId: school.schoolHeadId || '' });
  }, [school, form, isOpen]);


  const onSubmit = async (values: AssignSchoolHeadFormValues) => {
    setIsAssigning(true);
    try {
      const result = await updateSchool({ schoolId: school.id, ...values });
      if (result.success) {
        toast({
          title: 'School Head Assigned',
          description: `Successfully assigned school head to ${school.name}.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Assigning School Head',
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
          <DialogTitle>Assign School Head</DialogTitle>
          <DialogDescription>
            Assign a registered School Head to {school.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="schoolHeadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Head</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a school head" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolHeads.length > 0 ? (
                        schoolHeads.map((head) => (
                          <SelectItem key={head.uid} value={head.uid}>
                            {head.displayName}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="-" disabled>
                          No users with role 'School Head' found
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
                {isAssigning ? 'Assigning...' : 'Assign Head'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
