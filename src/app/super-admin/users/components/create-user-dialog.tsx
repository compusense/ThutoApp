
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
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createUser } from '@/app/super-admin/users/actions';
import { useRouter } from 'next/navigation';
import { School } from '../../schools/page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SubRegion } from '../../sub-regions/page';
import { Region } from '../../regions/page';
import { PasswordInput } from '@/components/ui/password-input';

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schools: School[];
  regions: Region[];
  subRegions: SubRegion[];
}

const createUserSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['super-admin', 'school-head', 'teacher', 'sub-region-admin', 'developer']),
  idNumber: z.string().min(1, 'ID number is required'),
  schoolId: z.string().optional(),
  subRegionId: z.string().optional(),
}).refine(data => {
    if ((data.role === 'teacher' || data.role === 'school-head') && !data.schoolId) {
        return false;
    }
    return true;
}, {
    message: "School is required for this role",
    path: ["schoolId"],
}).refine(data => {
    if (data.role === 'sub-region-admin' && !data.subRegionId) {
        return false;
    }
    return true;
}, {
    message: "Sub-Region is required for this role",
    path: ["subRegionId"],
});


type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function CreateUserDialog({ isOpen, onOpenChange, schools, regions, subRegions }: CreateUserDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      role: 'teacher',
      idNumber: '',
      schoolId: '',
      subRegionId: '',
    },
  });
  
  const role = form.watch('role');

  const onSubmit = async (values: CreateUserFormValues) => {
    setIsCreating(true);
    try {
      const result = await createUser(values);
      if (result.success) {
        toast({
          title: 'User Created',
          description: `User ${values.displayName} has been created successfully.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating User',
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
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Enter the details for the new user and assign them a role.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='max-h-[70vh] p-4'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Mpho Bokang" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="mpho.bokang@example.com" {...field} />
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
                  <FormLabel>ID Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter national ID number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="school-head">School Head</SelectItem>
                        <SelectItem value="sub-region-admin">Sub-Region Admin</SelectItem>
                        <SelectItem value="super-admin">Super Admin</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                      </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(role === 'teacher' || role === 'school-head') && (
                <FormField
                control={form.control}
                name="schoolId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>School</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a school" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {schools.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                            {school.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
             {role === 'sub-region-admin' && (
                <FormField
                control={form.control}
                name="subRegionId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Sub-Region</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a sub-region" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {subRegions.map((subRegion) => (
                            <SelectItem key={subRegion.id} value={subRegion.id}>
                            {subRegion.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
