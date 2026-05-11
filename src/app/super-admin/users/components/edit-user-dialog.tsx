
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
import { useRouter } from 'next/navigation';
import { School } from '../../schools/page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserProfile } from '@/firebase/auth/use-user';
import { updateUser } from '../actions';
import { SubRegion } from '../../sub-regions/page';
import { Region } from '../../regions/page';

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: UserProfile;
  schools: School[];
  regions: Region[];
  subRegions: SubRegion[];
}

const editUserSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['super-admin', 'school-head', 'teacher', 'sub-region-admin', 'developer']),
  regionId: z.string().optional(),
  subRegionId: z.string().optional(),
  schoolId: z.string().optional(),
}).refine(data => {
    if ((data.role === 'teacher' || data.role === 'school-head') && !data.schoolId) {
        return false;
    }
    return true;
}, {
    message: "School is required for this role",
    path: ["schoolId"],
}).refine(data => !(data.role === 'sub-region-admin' && !data.subRegionId), {
    message: "Sub-Region is required for this role",
    path: ["subRegionId"],
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export function EditUserDialog({ isOpen, onOpenChange, user, schools, regions, subRegions }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      displayName: user.displayName || '',
      email: user.email || '',
      role: user.role,
      regionId: '',
      subRegionId: user.subRegionId || '',
      schoolId: user.schoolId || '',
    },
  });

  React.useEffect(() => {
    if (isOpen && user && schools.length > 0 && subRegions.length > 0 && regions.length > 0) {
        const getInitialRegionId = () => {
            const school = schools.find(s => s.id === user.schoolId);
            const subRegion = subRegions.find(sr => sr.id === user.subRegionId);

            if (subRegion) return subRegion.regionId;
            if (school) {
                const subRegionForSchool = subRegions.find(sr => sr.id === school.subRegionId);
                return subRegionForSchool?.regionId || school.regionId;
            }
            return '';
        };

        form.reset({
            displayName: user.displayName || '',
            email: user.email || '',
            role: user.role,
            regionId: getInitialRegionId(),
            subRegionId: user.subRegionId || '',
            schoolId: user.schoolId || '',
        });
    }
  }, [user, schools, subRegions, regions, isOpen, form]);
  
  const role = form.watch('role');
  const regionId = form.watch('regionId');
  const subRegionId = form.watch('subRegionId');

  const availableSubRegions = React.useMemo(() => {
      if (!regionId || !subRegions) return [];
      return subRegions.filter(sr => sr.regionId === regionId);
  }, [regionId, subRegions]);

  const availableSchools = React.useMemo(() => {
    if (!regionId || !schools) return [];
    if (subRegionId) {
        return schools.filter(s => s.subRegionId === subRegionId);
    }
    return schools.filter(s => s.regionId === regionId && !s.subRegionId);
  },[regionId, subRegionId, schools]);

  React.useEffect(() => {
      form.setValue('subRegionId', '');
      form.setValue('schoolId', '');
  }, [regionId, form]);

  React.useEffect(() => {
    form.setValue('schoolId', '');
  }, [subRegionId, form]);


  const onSubmit = async (values: EditUserFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateUser({ uid: user.uid, ...values });
      if (result.success) {
        toast({
          title: 'User Updated',
          description: `User ${values.displayName} has been updated successfully.`,
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Updating User',
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
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Modify the details for {user.displayName}.
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
            {(role === 'teacher' || role === 'school-head' || role === 'sub-region-admin') && (
                 <FormField
                    control={form.control}
                    name="regionId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a region" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {(regions || []).map((region) => (
                                <SelectItem key={region.id} value={region.id}>
                                {region.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}
             {(role === 'teacher' || role === 'school-head' || role === 'sub-region-admin') && (
                <FormField
                control={form.control}
                name="subRegionId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Sub-Region</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!regionId}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a sub-region" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {(availableSubRegions || []).map((subRegion) => (
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

            {(role === 'teacher' || role === 'school-head') && (
                <FormField
                control={form.control}
                name="schoolId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>School</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!regionId}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a school" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {(availableSchools || []).map((school) => (
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
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
