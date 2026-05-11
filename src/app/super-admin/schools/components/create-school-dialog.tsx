
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
import { createSchool } from '@/app/super-admin/schools/actions';
import { useRouter } from 'next/navigation';
import { Region } from '@/app/super-admin/regions/page';
import { SubRegion } from '@/app/super-admin/sub-regions/page';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateSchoolDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  regions: Region[];
  subRegions: SubRegion[];
}

const createSchoolSchema = z.object({
  name: z.string().min(1, 'School name is required'),
  regionId: z.string().min(1, 'Please select a parent region'),
  subRegionId: z.string().optional(),
  regNo: z.string().min(1, 'Registration number is required'),
  group: z.string().optional(),
  category: z.string().optional(),
  schoolType: z.enum([
    "Primary School",
    "Junior Secondary School",
    "Senior Secondary School",
  ], { required_error: 'School type is required' }),
});

type CreateSchoolFormValues = z.infer<typeof createSchoolSchema>;

const schoolTypes = [
  "Primary School",
  "Junior Secondary School",
  "Senior Secondary School",
];

export function CreateSchoolDialog({ isOpen, onOpenChange, regions, subRegions }: CreateSchoolDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateSchoolFormValues>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: {
      name: '',
      regionId: '',
      subRegionId: '',
      regNo: '',
      group: '',
      category: '',
      schoolType: undefined,
    },
  });

  const selectedRegionId = form.watch('regionId');
  const availableSubRegions = React.useMemo(() => {
    return subRegions.filter(sr => sr.regionId === selectedRegionId);
  }, [selectedRegionId, subRegions]);
  
  React.useEffect(() => {
    form.setValue('subRegionId', '');
  }, [selectedRegionId, form]);

  const onSubmit = async (values: CreateSchoolFormValues) => {
    setIsCreating(true);
    try {
      const result = await createSchool(values);
      if (result.success) {
        toast({
          title: 'School Created',
          description: `School "${values.name}" has been created successfully.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating School',
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
          <DialogTitle>Create New School</DialogTitle>
          <DialogDescription>
            Enter the details for the new school.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>School Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Maru-a-Pula School" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="regNo"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Registration Number (REG.NO)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="regionId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Parent Region</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a parent region" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {regions.map((region) => (
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
                <FormField
                control={form.control}
                name="subRegionId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Sub-Region (Optional)</FormLabel>
                        <Select 
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={availableSubRegions.length === 0}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder={availableSubRegions.length > 0 ? "Select a sub-region" : "No sub-regions in selected region"} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {availableSubRegions.map((subRegion) => (
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
                <FormField
                control={form.control}
                name="schoolType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>School Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a school type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {schoolTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
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
                name="group"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Group (Temporary)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Group 1" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Category (Temporary)</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., 1" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create School'}
                </Button>
                </DialogFooter>
            </form>
            </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
