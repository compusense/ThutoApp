'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/firebase';
import { AppLink } from '../ui/app-link';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);

  // 1. Add a new state to track successful login
  const [isSuccess, setIsSuccess] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: LoginFormValues) {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);

      // 2. Lock the form button permanently upon success
      setIsSuccess(true);

      toast({
        title: 'Success',
        description: `Login successful...`,
      });
      // The AuthGuard component will handle the redirection automatically.
    } catch (error: any) {
      let description = 'An unexpected error occurred. Please try again later.';

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          description = 'Invalid credentials. Please check your email and password.';
          break;
        case 'auth/user-disabled':
          description = 'This user account has been disabled. Please contact support.';
          break;
        case 'auth/too-many-requests':
          description = 'Access temporarily disabled due to multiple failed attempts. Try again later.';
          break;
        default:
          console.error('Login error:', error);
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: description,
      });
    }
  }

  // 3. Create a combined loading state for cleaner UI logic
  const isLoading = isSubmitting || isSuccess;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  className="bg-transparent"
                  {...field}
                  disabled={isLoading} // Optional: Lock inputs too
                />
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
              <div className="flex items-center">
                <FormLabel>Password</FormLabel>
                <AppLink href="/forgot-password" className="ml-auto inline-block text-sm underline">
                  Forgot password?
                </AppLink>
              </div>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="bg-transparent"
                    {...field}
                    disabled={isLoading} // Optional: Lock inputs too
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={!field.value || isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Hide password' : 'Show password'}
                  </span>
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full font-headline"
          disabled={isLoading} // 4. Apply combined state here
        >
          {/* 5. Update text to reflect redirection */}
          {isSuccess ? 'Redirecting...' : isSubmitting ? 'Signing In...' : 'Sign In'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <AppLink href="/signup" className="underline">
          Sign up
        </AppLink>
      </div>
    </Form>
  );
}