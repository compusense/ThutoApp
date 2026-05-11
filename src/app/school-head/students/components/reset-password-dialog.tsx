
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
import { resetStudentPassword } from '../actions';
import { Loader2, Copy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string;
  student: Student;
}

export function ResetPasswordDialog({ isOpen, onOpenChange, schoolId, student }: ResetPasswordDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setNewPassword(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await resetStudentPassword({
        schoolId,
        studentId: student.id,
      });

      if (result.success && result.data) {
        setNewPassword(result.data.newPassword);
        toast({
          title: 'Password Reset',
          description: `Password for ${student.fullName} has been successfully reset.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Resetting Password',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const copyToClipboard = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    toast({ title: 'Copied!', description: 'New password copied to clipboard.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            This will generate a new temporary password for {student.fullName}.
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Password Reset Successfully!</AlertTitle>
              <AlertDescription>
                Please provide this new temporary password to the student. They will be required to change it on their next login.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
                 <div>
                    <label className="text-sm font-medium text-muted-foreground">New Temporary Password</label>
                    <p className="font-mono p-2 bg-muted rounded-md">{newPassword}</p>
                </div>
            </div>
            <Button variant="outline" className="w-full" onClick={copyToClipboard}>
                <Copy className="mr-2 h-4 w-4" /> Copy New Password
            </Button>
          </div>
        ) : (
          <p>
            Are you sure you want to reset the password for this student? This action cannot be undone.
          </p>
        )}

        <DialogFooter>
          {newPassword ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Reset
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
