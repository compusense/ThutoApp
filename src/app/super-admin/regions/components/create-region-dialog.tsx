
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createRegion } from '@/app/super-admin/regions/actions';
import { useRouter } from 'next/navigation';

interface CreateRegionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const createRegionSchema = z.object({
  name: z.string().min(1, 'Region name is required'),
});

type CreateRegionFormValues = z.infer<typeof createRegionSchema>;

export function CreateRegionDialog({ isOpen, onOpenChange }: CreateRegionDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateRegionFormValues>({
    resolver: zodResolver(createRegionSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (values: CreateRegionFormValues) => {
    setIsCreating(true);
    try {
      const result = await createRegion(values);
      if (result.success) {
        toast({
          title: 'Region Created',
          description: `Region "${values.name}" has been created successfully.`,
        });
        form.reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating Region',
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
          <DialogTitle>Create New Region</DialogTitle>
          <DialogDescription>
            Enter the name for the new geographical region.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Central District" {...field} />
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
                {isCreating ? 'Creating...' : 'Create Region'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
