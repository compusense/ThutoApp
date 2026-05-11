
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { createStudent } from '../actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Class } from '../../classes/page';

interface CreateStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string | undefined;
  classes: Class[];
}

const createStudentSchema = z.object({
  admissionNumber: z.string().optional(),
  idNumber: z.string().optional(),
  firstName: z.string().min(1, 'First Name is required'),
  surname: z.string().min(1, 'Surname is required'),
  gender: z.enum(['Male', 'Female'], { required_error: 'Gender is required' }),
  dateOfBirth: z.date({ required_error: 'Date of birth is required' }),
  classId: z.string().optional(),
});

type CreateStudentFormValues = z.infer<typeof createStudentSchema>;

export function CreateStudentDialog({ isOpen, onOpenChange, schoolId, classes }: CreateStudentDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      admissionNumber: '',
      idNumber: '',
      firstName: '',
      surname: '',
      gender: undefined,
      dateOfBirth: undefined,
      classId: '',
    },
  });

  const onSubmit = async (values: CreateStudentFormValues) => {
    if (!schoolId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No school associated with your account. Please contact support.',
      });
      console.error('Missing schoolId:', schoolId);
      return;
    }

    setIsCreating(true);
    try {
      const result = await createStudent({ ...values, schoolId });
      if (result.success) {
        toast({
          title: 'Student Registered',
          description: `Student ${values.firstName} ${values.surname} has been added to the registry.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh(); // Refresh the current route
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Registering Student',
          description: result.message || 'An error occurred during registration.',
          duration: 9000,
        });
        console.error('Server error:', result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unknown error occurred. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Unexpected Error',
        description: errorMessage,
        duration: 9000,
      });
      console.error('Unexpected error during student creation:', error);
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
          <DialogTitle>Register New Student</DialogTitle>
          <DialogDescription>
            Enter the details for the new student. They will be added to the school's central registry.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name(s)</FormLabel>
                    <FormControl>
                      <Input placeholder="Student's first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surname</FormLabel>
                    <FormControl>
                      <Input placeholder="Student's surname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="admissionNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., S-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="idNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Certificate / ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Student's ID number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown-buttons"
                          fromYear={1980}
                          toYear={new Date().getFullYear() - 5}
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1980-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex items-center space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Male" />
                          </FormControl>
                          <FormLabel className="font-normal">Male</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Female" />
                          </FormControl>
                          <FormLabel className="font-normal">Female</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Class (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a class to enroll student" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {classes.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating} onClick={form.handleSubmit(onSubmit)}>
            {isCreating ? 'Registering...' : 'Register Student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
