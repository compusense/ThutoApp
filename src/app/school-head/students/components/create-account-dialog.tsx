
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Student } from '../page';
import { createStudentUserAccount } from '../actions';
import { Loader2, Copy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CreateAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string;
  student: Student;
}

export function CreateAccountDialog({ isOpen, onOpenChange, schoolId, student }: CreateAccountDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setCredentials(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createStudentUserAccount({
        schoolId,
        studentId: student.id,
      });

      if (result.success && result.data) {
        setCredentials(result.data);
        toast({
          title: 'Account Created',
          description: `Login account created for ${student.fullName}.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Creating Account',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Credentials copied to clipboard.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Login Account</DialogTitle>
          <DialogDescription>
            This will create a user account for {student.fullName} and generate a temporary password.
          </DialogDescription>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Account Created Successfully!</AlertTitle>
              <AlertDescription>
                Please provide these credentials to the student. They will be required to change their password on first login.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <div>
                    <label className="text-sm font-medium text-muted-foreground">Username / Email</label>
                    <p className="font-mono p-2 bg-muted rounded-md">{credentials.email}</p>
                </div>
                 <div>
                    <label className="text-sm font-medium text-muted-foreground">Temporary Password</label>
                    <p className="font-mono p-2 bg-muted rounded-md">{credentials.password}</p>
                </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => copyToClipboard(`Username: ${credentials.email}\nPassword: ${credentials.password}`)}>
                <Copy className="mr-2 h-4 w-4" /> Copy Credentials
            </Button>
          </div>
        ) : (
          <p>
            Are you sure you want to create a login account for this student?
          </p>
        )}

        <DialogFooter>
          {credentials ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Create
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
