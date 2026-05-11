
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
import { createSubRegion } from '@/app/super-admin/sub-regions/actions';
import { useRouter } from 'next/navigation';
import { Region } from '@/app/super-admin/regions/page';

interface CreateSubRegionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  regions: Region[];
}

const createSubRegionSchema = z.object({
  name: z.string().min(1, 'Sub-region name is required'),
  regionId: z.string().min(1, 'Please select a parent region'),
});

type CreateSubRegionFormValues = z.infer<typeof createSubRegionSchema>;

export function CreateSubRegionDialog({ isOpen, onOpenChange, regions }: CreateSubRegionDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateSubRegionFormValues>({
    resolver: zodResolver(createSubRegionSchema),
    defaultValues: {
      name: '',
      regionId: '',
    },
  });

  const onSubmit = async (values: CreateSubRegionFormValues) => {
    setIsCreating(true);
    try {
      const result = await createSubRegion(values);
      if (result.success) {
        toast({
          title: 'Sub-Region Created',
          description: `Sub-Region "${values.name}" has been created successfully.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating Sub-Region',
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
          <DialogTitle>Create New Sub-Region</DialogTitle>
          <DialogDescription>
            Enter the name and select the parent region for the new sub-region.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Region Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Serowe" {...field} />
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
                {isCreating ? 'Creating...' : 'Create Sub-Region'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
