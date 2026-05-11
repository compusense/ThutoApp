
'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit, UserX, UserCheck, KeyRound, Eraser, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Student } from '../page';
import { EditStudentDialog } from './edit-student-dialog';
import { ChangeStatusDialog } from './change-status-dialog';
import { useUser } from '@/firebase/auth/use-user';
import { CreateAccountDialog } from './create-account-dialog';
import { AppLink } from '@/components/ui/app-link';
import { ResetPasswordDialog } from './reset-password-dialog';


interface StudentActionsProps {
  student: Student;
}

export function StudentActions({ student }: StudentActionsProps) {
  const { user } = useUser();
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isStatusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isCreateAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);

  if (!user?.schoolId) return null;

  return (
    <>
      <EditStudentDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setEditDialogOpen}
        student={student}
        schoolId={user.schoolId}
      />
      <ChangeStatusDialog
        isOpen={isStatusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        student={student}
        schoolId={user.schoolId}
      />
       <CreateAccountDialog
        isOpen={isCreateAccountDialogOpen}
        onOpenChange={setCreateAccountDialogOpen}
        student={student}
        schoolId={user.schoolId}
      />
      <ResetPasswordDialog
        isOpen={isResetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        student={student}
        schoolId={user.schoolId}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Details</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
            {student.status === 'Active' ? (
                <UserX className="mr-2 h-4 w-4 text-destructive" />
            ) : (
                <UserCheck className="mr-2 h-4 w-4 text-green-600" />
            )}
            <span>Change Status</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <AppLink href={`/school-head/students/${student.id}/marks`}>
              <Eraser className="mr-2 h-4 w-4" />
              <span>Manage Marks</span>
            </AppLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
           <DropdownMenuItem onClick={() => setCreateAccountDialogOpen(true)} disabled={!!student.uid}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Create Login Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetPasswordDialogOpen(true)} disabled={!student.uid}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            <span>Reset Password</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
