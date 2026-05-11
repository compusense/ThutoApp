
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from 'firebase/auth';
import { auth } from '@/firebase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PasswordInput } from '@/components/ui/password-input';


function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 items-start">
      <p className="md:col-span-1 text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="md:col-span-2 text-base">{value}</p>
    </div>
  );
}

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});


type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function StudentDetailsPage() {
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setIsSubmitting(true);
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Not logged in or email not found.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Create a credential for re-authentication
      const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
      
      // Re-authenticate the user to ensure they know their current password
      await reauthenticateWithCredential(currentUser, credential);
      
      // If re-authentication is successful, update the password
      await updatePassword(currentUser, values.newPassword);

      toast({
        title: 'Success',
        description: 'Your password has been changed successfully.',
      });
      form.reset();

    } catch (error: any) {
      console.error("Error changing password:", error);
      let errorMessage = 'An unexpected error occurred.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'The current password you entered is incorrect.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      toast({
        variant: 'destructive',
        title: 'Error Changing Password',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!user) {
    return <p>User not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-center text-center space-y-4">
          <Avatar className="h-24 w-24 text-3xl">
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ''} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">{user.displayName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 border-t pt-6">
            <DetailItem label="Full Name" value={user.displayName} />
            <DetailItem label="Email Address" value={user.email} />
            <DetailItem label="Role" value={user.role?.replace('-', ' ')} />
            <DetailItem label="Class" value={user.className} />
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <Card>
            <AccordionItem value="item-1" className="border-b-0">
                <AccordionTrigger className="p-6 hover:no-underline">
                     <div className="text-left">
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription className="mt-1.5">
                            Click to expand and change your password.
                        </CardDescription>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
                        <FormField
                            control={form.control}
                            name="currentPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                <PasswordInput {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                <PasswordInput {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                <PasswordInput {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Change Password
                        </Button>
                        </form>
                    </Form>
                </AccordionContent>
            </AccordionItem>
        </Card>
      </Accordion>
    </div>
  );
}
